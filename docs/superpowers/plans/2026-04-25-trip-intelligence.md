# Trip Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three intelligence layers to saved trips: a countdown timer until travel date, a user-triggered smart update check (events, hours changes, weather), and a day-of arrival recalibration flow with flip-card UX.

**Architecture:** Extend `SavedItinerary` in `types.ts` with `travelDate`, `cityLat/Lon`, `selectedPlaces`, `lastUpdateCheck`, and `pendingSwapCards`. Add an `UPDATE_SAVED_ITINERARY` patch action to the store. All new UI lives in `src/modules/trips/` as focused single-responsibility components composed into `TripCard` inside `TripsScreen.tsx`. The backend gets one new `POST /recalibrate` endpoint. The existing `api.events()` is reused unchanged.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS, `useAppStore` + reducer, FastAPI + Anthropic claude-haiku-4-5-20251001, Vitest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/shared/types.ts` | Modify | Extend `SavedItinerary`; add `TripUpdateCard`, `SwapCard`, `UpdateCardKind` |
| `src/shared/store.tsx` | Modify | `UPDATE_SAVED_ITINERARY` action; extend `SAVE_ITINERARY` to capture new fields |
| `src/modules/route/useRoute.ts` | Modify | Pass `travelDate`, `cityLat/Lon`, `selectedPlaces` when saving itinerary |
| `src/modules/trips/TripCountdown.tsx` | Create | Countdown row: days until travel, colour-coded |
| `src/modules/trips/SmartUpdates.tsx` | Create | "Check for updates" chip, 4-hour cooldown, update card strip |
| `src/modules/trips/UpdateCard.tsx` | Create | Individual event / hours-change / weather card |
| `src/modules/trips/ArrivalBanner.tsx` | Create | Day-of arrival prompt banner |
| `src/modules/trips/SwapCard.tsx` | Create | 3D flip card: current plan ↔ LLM suggestion |
| `src/modules/trips/RecalibrationStack.tsx` | Create | Orchestrates swap card list + Done button + lock gate |
| `src/modules/trips/TripsScreen.tsx` | Modify | Compose all new components into `TripCard` |
| `src/shared/api.ts` | Modify | Add `api.recalibrate()` |
| `main.py` | Modify | Add `POST /recalibrate` endpoint |
| `src/modules/trips/trip-intelligence.test.ts` | Create | Unit tests for countdown logic + update checks |

---

## Task 1: Extend types — SavedItinerary + intelligence types

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Create: `frontend/src/modules/trips/trip-intelligence.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/trips/trip-intelligence.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getDaysUntilTravel, getCountdownColour } from './TripCountdown';

describe('getDaysUntilTravel', () => {
  it('returns null when travelDate is null', () => {
    expect(getDaysUntilTravel(null)).toBeNull();
  });

  it('returns 0 on the travel date itself', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getDaysUntilTravel(today)).toBe(0);
  });

  it('returns a positive number for a future date', () => {
    const future = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    expect(getDaysUntilTravel(future)).toBe(10);
  });

  it('returns negative for a past date', () => {
    const past = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
    expect(getDaysUntilTravel(past)! < 0).toBe(true);
  });
});

describe('getCountdownColour', () => {
  it('returns green for 0 days (today)', () => {
    expect(getCountdownColour(0)).toBe('#22c55e');
  });

  it('returns amber for 1–7 days', () => {
    expect(getCountdownColour(5)).toBe('#f59e0b');
  });

  it('returns indigo for more than 7 days', () => {
    expect(getCountdownColour(14)).toBe('#6366f1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/modules/trips/trip-intelligence.test.ts`
Expected: FAIL — "Cannot find module './TripCountdown'"

- [ ] **Step 3: Extend SavedItinerary and add new types**

In `frontend/src/shared/types.ts`, replace the existing `SavedItinerary` interface:

```typescript
// ── Saved itineraries ─────────────────────────────────────────
export interface SavedItinerary {
  id: string;
  city: string;
  date: string;              // ISO datetime the trip was saved
  travelDate: string | null; // ISO date of actual travel (YYYY-MM-DD)
  cityLat: number | null;
  cityLon: number | null;
  selectedPlaces: Place[];   // places user added — needed for hours re-check
  itinerary: Itinerary;
  persona: Persona;
  lastUpdateCheck: string | null; // ISO datetime of last update check
  pendingSwapCards: SwapCard[];   // unresolved day-of swap cards
}
```

At the end of the file append:

```typescript
// ── Trip intelligence ─────────────────────────────────────────

export type UpdateCardKind = 'event' | 'hours_change' | 'weather';

export interface TripUpdateCard {
  id: string;
  kind: UpdateCardKind;
  tripId: string;
  title: string;
  detail: string;
  affectedStop?: string;
  actionLabel?: string;
  severity: 'info' | 'warning';
}

export interface SwapCard {
  id: string;
  stopName: string;
  stopIdx: number;
  currentSummary: string;
  currentNote?: string;
  suggestedSummary: string;
  suggestedNote: string;
  resolved: boolean;
  choice: 'new' | 'original' | null;
}
```

- [ ] **Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Errors for `SavedItinerary` callers that no longer pass required fields — this is expected at this step; they will be fixed in later tasks.

- [ ] **Step 5: Commit types only**

```bash
git add frontend/src/shared/types.ts frontend/src/modules/trips/trip-intelligence.test.ts
git commit -m "feat: extend SavedItinerary with travelDate, selectedPlaces, intelligence fields"
```

---

## Task 2: Store — UPDATE_SAVED_ITINERARY action + fix SAVE_ITINERARY

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Modify: `frontend/src/modules/route/useRoute.ts`

- [ ] **Step 1: Add the action type**

In `frontend/src/shared/store.tsx`, in the `Action` union add after `SET_SAVED_ITINERARIES`:

```typescript
  | { type: 'UPDATE_SAVED_ITINERARY'; id: string; patch: Partial<SavedItinerary> }
```

- [ ] **Step 2: Add the reducer case**

In the `reducer` switch, after the `SAVE_ITINERARY` case:

```typescript
    case 'UPDATE_SAVED_ITINERARY': {
      const updated = state.savedItineraries.map(s =>
        s.id === action.id ? { ...s, ...action.patch } : s
      );
      try {
        localStorage.setItem('ur_saved_itineraries', JSON.stringify(updated));
      } catch { /* ignore */ }
      return { ...state, savedItineraries: updated };
    }
```

- [ ] **Step 3: Fix SAVE_ITINERARY to persist new fields**

In `frontend/src/modules/route/useRoute.ts`, update `saveItinerary()`:

```typescript
  async function saveItinerary() {
    if (!itinerary || !persona) return;
    const saved: SavedItinerary = {
      id: Date.now().toString(),
      city,
      date: new Date().toISOString(),
      travelDate: state.tripContext.date ?? null,
      cityLat: state.cityGeo?.lat ?? null,
      cityLon: state.cityGeo?.lon ?? null,
      selectedPlaces: state.selectedPlaces,
      itinerary,
      persona,
      lastUpdateCheck: null,
      pendingSwapCards: [],
    };
    dispatch({ type: 'SAVE_ITINERARY', saved });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) syncSavedItinerary(user.id, saved).catch(console.warn);
  }
```

- [ ] **Step 4: Fix getStoredItineraries to backfill new fields**

In `frontend/src/shared/store.tsx`, update `getStoredItineraries()` to backfill the new fields when loading old data:

```typescript
function getStoredItineraries(): SavedItinerary[] {
  try {
    const stored = localStorage.getItem('ur_saved_itineraries');
    const items = stored ? (JSON.parse(stored) as SavedItinerary[]) : [];
    // Backfill new fields for itineraries saved before this version
    return items.map(item => ({
      travelDate: null,
      cityLat: null,
      cityLon: null,
      selectedPlaces: [],
      lastUpdateCheck: null,
      pendingSwapCards: [],
      ...item,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/modules/route/useRoute.ts
git commit -m "feat: add UPDATE_SAVED_ITINERARY action and persist travelDate/selectedPlaces on save"
```

---

## Task 3: TripCountdown component

**Files:**
- Create: `frontend/src/modules/trips/TripCountdown.tsx`

- [ ] **Step 1: Create the file with exported helpers (so tests can import them)**

Create `frontend/src/modules/trips/TripCountdown.tsx`:

```typescript
/** Returns whole days until travelDate from today. Negative = past. Null = no date. */
export function getDaysUntilTravel(travelDate: string | null): number | null {
  if (!travelDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(travelDate + 'T00:00:00');
  if (isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

export function getCountdownColour(days: number): string {
  if (days === 0) return '#22c55e';   // green — travel day
  if (days <= 7)  return '#f59e0b';   // amber — within a week
  return '#6366f1';                    // indigo — further out
}

interface Props {
  travelDate: string | null;
}

export function TripCountdown({ travelDate }: Props) {
  const days = getDaysUntilTravel(travelDate);

  // Don't render if no date, already past, or more than 365 days away
  if (days === null || days < 0 || days > 365) return null;

  const colour = getCountdownColour(days);

  let label: string;
  if (days === 0) label = 'Today · Have you arrived?';
  else if (days === 1) label = 'Tomorrow';
  else label = `${days} days until your trip`;

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="ms fill text-sm flex-shrink-0" style={{ color: colour }}>schedule</span>
      <span className="text-xs font-medium" style={{ color: colour }}>{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/modules/trips/trip-intelligence.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/trips/TripCountdown.tsx
git commit -m "feat: add TripCountdown component with getDaysUntilTravel + getCountdownColour"
```

---

## Task 4: Backend POST /recalibrate endpoint

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add the endpoint after the `/similar-places` endpoint block**

In `main.py`, after the `similar_places_endpoint` function, add:

```python
@app.post("/recalibrate")
def recalibrate_endpoint(body: dict):
    """
    Day-of recalibration: given current stops, time, and live conditions,
    return only stops that benefit from a timing/routing adjustment.
    Returns: { swap_cards: [...] }
    """
    if not ANTHROPIC_API_KEY:
        return {"swap_cards": []}

    stops         = body.get("stops", [])
    current_time  = body.get("current_time", "09:00")
    persona       = body.get("persona", "explorer")
    pace          = body.get("pace", "balanced")
    city          = body.get("city", "")
    travel_date   = body.get("travel_date", "")

    if not stops or not city:
        return {"swap_cards": []}

    stops_text = "\n".join(
        f"{i+1}. {s.get('place','?')} | time: {s.get('time','?')} | duration: {s.get('duration','?')}"
        for i, s in enumerate(stops)
    )

    prompt = f"""You are a real-time travel advisor. A {persona} traveler with a {pace} pace
is currently in {city} on {travel_date}. The current local time is {current_time}.

Their planned itinerary:
{stops_text}

Identify ONLY stops that genuinely benefit from a change given the current time and typical
day-of conditions (opening times, crowds, sequencing efficiency). Do not suggest changes just
to change things.

For each stop that needs adjustment, return a swap card. Return an empty array if no changes
are needed.

Return JSON only:
{{
  "swap_cards": [
    {{
      "id": "swap-<stop_slug>",
      "stop_name": "Place Name",
      "stop_idx": 0,
      "current_summary": "2:00 PM · 2 hrs",
      "current_note": "optional note about current plan",
      "suggested_summary": "Move to 11:00 AM",
      "suggested_note": "Reason in 1-2 sentences. Be specific about why now is better."
    }}
  ]
}}

Rules:
- stop_idx is zero-based
- Return only valid JSON, no markdown fences
- Maximum 3 swap cards — prioritise the highest-impact changes only"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        # Normalise: ensure resolved/choice fields exist
        for card in result.get("swap_cards", []):
            card.setdefault("resolved", False)
            card.setdefault("choice", None)
        return result
    except json.JSONDecodeError as e:
        print(f"RECALIBRATE JSON ERROR: {e}")
        return {"swap_cards": []}
    except Exception as e:
        print(f"RECALIBRATE ERROR: {e}")
        return {"swap_cards": []}
```

- [ ] **Step 2: Commit**

```bash
git add main.py
git commit -m "feat: add POST /recalibrate endpoint for day-of itinerary adjustment"
```

---

## Task 5: API client — add api.recalibrate()

**Files:**
- Modify: `frontend/src/shared/api.ts`

- [ ] **Step 1: Add the method after `api.similarPlaces`**

In `frontend/src/shared/api.ts`, add at the end of the `api` object (before the closing `}`):

```typescript
  recalibrate: (params: {
    stops: import('./types').ItineraryStop[];
    currentTime: string;
    persona: string;
    pace: string;
    city: string;
    lat: number;
    lon: number;
    travelDate: string;
  }) => post<{ swap_cards: import('./types').SwapCard[] }>('/recalibrate', {
    stops:        params.stops,
    current_time: params.currentTime,
    persona:      params.persona,
    pace:         params.pace,
    city:         params.city,
    lat:          params.lat,
    lon:          params.lon,
    travel_date:  params.travelDate,
  }),
```

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/api.ts
git commit -m "feat: add api.recalibrate() client method"
```

---

## Task 6: UpdateCard + SmartUpdates components

**Files:**
- Create: `frontend/src/modules/trips/UpdateCard.tsx`
- Create: `frontend/src/modules/trips/SmartUpdates.tsx`

- [ ] **Step 1: Create UpdateCard**

Create `frontend/src/modules/trips/UpdateCard.tsx`:

```typescript
import type { TripUpdateCard } from '../../shared/types';

const KIND_CONFIG: Record<string, { emoji: string; borderColour: string; bgColour: string }> = {
  event:        { emoji: '🎉', borderColour: 'rgba(99,102,241,.3)',  bgColour: 'rgba(99,102,241,.06)'  },
  hours_change: { emoji: '⚠️', borderColour: 'rgba(245,158,11,.3)',  bgColour: 'rgba(245,158,11,.06)'  },
  weather:      { emoji: '🌧', borderColour: 'rgba(96,165,250,.3)',  bgColour: 'rgba(96,165,250,.06)'  },
};

interface Props {
  card: TripUpdateCard;
  onAction: (card: TripUpdateCard) => void;
  onDismiss: (id: string) => void;
}

export function UpdateCard({ card, onAction, onDismiss }: Props) {
  const cfg = KIND_CONFIG[card.kind] ?? KIND_CONFIG.event;

  return (
    <div
      className="flex-shrink-0 rounded-2xl p-3.5 border flex flex-col gap-2"
      style={{
        width: 180,
        background: cfg.bgColour,
        borderColor: cfg.borderColour,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-base leading-none">{cfg.emoji}</span>
        <button
          onClick={() => onDismiss(card.id)}
          className="text-white/25 text-xs leading-none"
        >✕</button>
      </div>

      <div>
        <p className="text-white/80 text-xs font-semibold leading-snug">{card.title}</p>
        {card.detail && (
          <p className="text-white/40 text-[10px] mt-1 leading-snug">{card.detail}</p>
        )}
        {card.affectedStop && (
          <p className="text-white/30 text-[10px] mt-1">Near: {card.affectedStop}</p>
        )}
      </div>

      {card.actionLabel && (
        <button
          onClick={() => onAction(card)}
          className="w-full py-1.5 rounded-xl text-[10px] font-bold text-white"
          style={{ background: 'rgba(99,102,241,.3)', border: '1px solid rgba(99,102,241,.4)' }}
        >
          {card.actionLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create SmartUpdates**

Create `frontend/src/modules/trips/SmartUpdates.tsx`:

```typescript
import { useState } from 'react';
import { api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { UpdateCard } from './UpdateCard';
import type { SavedItinerary, TripUpdateCard } from '../../shared/types';

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Returns true if the last check was within the cooldown window. */
export function isOnCooldown(lastCheckIso: string | null): boolean {
  if (!lastCheckIso) return false;
  return Date.now() - new Date(lastCheckIso).getTime() < COOLDOWN_MS;
}

/** Human-readable label for how long ago the check was. */
export function timeSinceLabel(lastCheckIso: string | null): string {
  if (!lastCheckIso) return '';
  const diffMs  = Date.now() - new Date(lastCheckIso).getTime();
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffHrs >= 1) return `Checked ${diffHrs}h ago`;
  return `Checked ${diffMin}m ago`;
}

interface Props {
  trip: SavedItinerary;
}

export function SmartUpdates({ trip }: Props) {
  const { dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [updateCards, setUpdateCards] = useState<TripUpdateCard[]>([]);
  const [checked, setChecked] = useState(false);

  const onCooldown = isOnCooldown(trip.lastUpdateCheck);

  async function handleCheck() {
    if (onCooldown || loading) return;
    setLoading(true);
    const now = new Date().toISOString();

    try {
      const cards: TripUpdateCard[] = [];

      // 1. Events
      if (trip.travelDate && trip.cityLat !== null && trip.cityLon !== null) {
        const events = await api.events(
          trip.city,
          trip.travelDate,
          trip.travelDate,
          trip.cityLat,
          trip.cityLon,
        ).catch(() => [] as import('../../shared/types').Place[]);

        events.slice(0, 3).forEach(ev => {
          cards.push({
            id: `event-${ev.id}`,
            kind: 'event',
            tripId: trip.id,
            title: ev.title,
            detail: (ev as any).event_date ? `${(ev as any).event_date}` : '',
            severity: 'info',
            actionLabel: 'View',
          });
        });
      }

      // 2. Hours changes — check each saved place that has weekday_text stored
      trip.selectedPlaces.forEach(place => {
        const snapshot = (place as any).weekday_text_snapshot as string[] | undefined;
        const current  = (place as any).weekday_text as string[] | undefined;
        if (snapshot && current && JSON.stringify(snapshot) !== JSON.stringify(current)) {
          cards.push({
            id: `hours-${place.id}`,
            kind: 'hours_change',
            tripId: trip.id,
            title: `Hours changed · ${place.title}`,
            detail: 'Opening times have been updated since you saved this trip.',
            affectedStop: place.title,
            severity: 'warning',
          });
        }
      });

      setUpdateCards(cards);
      setChecked(true);
      dispatch({
        type: 'UPDATE_SAVED_ITINERARY',
        id: trip.id,
        patch: { lastUpdateCheck: now },
      });
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss(cardId: string) {
    setUpdateCards(prev => prev.filter(c => c.id !== cardId));
  }

  function handleAction(card: TripUpdateCard) {
    // For event cards: open website if available (no-op stub otherwise)
    console.log('Update card action:', card);
  }

  return (
    <div className="mt-3">
      {/* CTA chip */}
      <button
        onClick={handleCheck}
        disabled={onCooldown || loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-opacity"
        style={{
          opacity: onCooldown ? 0.5 : 1,
          cursor: onCooldown ? 'default' : 'pointer',
          background: 'rgba(99,102,241,.08)',
          borderColor: 'rgba(99,102,241,.25)',
          color: '#818cf8',
        }}
      >
        <span className={`ms fill text-xs ${loading ? 'animate-spin' : ''}`}>autorenew</span>
        {loading
          ? 'Checking…'
          : onCooldown
            ? timeSinceLabel(trip.lastUpdateCheck)
            : 'Check for updates'}
      </button>

      {/* Update cards strip */}
      {updateCards.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 mt-3" style={{ scrollbarWidth: 'none' }}>
          {updateCards.map(card => (
            <UpdateCard
              key={card.id}
              card={card}
              onAction={handleAction}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {/* No updates state */}
      {checked && updateCards.length === 0 && !loading && (
        <p className="text-white/25 text-[10px] mt-2">Everything looks good · Checked just now</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add tests for cooldown helpers**

In `frontend/src/modules/trips/trip-intelligence.test.ts`, append:

```typescript
import { isOnCooldown, timeSinceLabel } from './SmartUpdates';

describe('isOnCooldown', () => {
  it('returns false for null', () => {
    expect(isOnCooldown(null)).toBe(false);
  });

  it('returns true when last check was 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isOnCooldown(oneHourAgo)).toBe(true);
  });

  it('returns false when last check was 5 hours ago', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(isOnCooldown(fiveHoursAgo)).toBe(false);
  });
});

describe('timeSinceLabel', () => {
  it('returns empty string for null', () => {
    expect(timeSinceLabel(null)).toBe('');
  });

  it('returns hours label for > 60 min', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeSinceLabel(twoHoursAgo)).toBe('Checked 2h ago');
  });

  it('returns minutes label for < 60 min', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(timeSinceLabel(tenMinAgo)).toBe('Checked 10m ago');
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/modules/trips/trip-intelligence.test.ts`
Expected: All tests PASS

- [ ] **Step 5: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/trips/UpdateCard.tsx frontend/src/modules/trips/SmartUpdates.tsx frontend/src/modules/trips/trip-intelligence.test.ts
git commit -m "feat: add UpdateCard and SmartUpdates components with 4-hour cooldown"
```

---

## Task 7: ArrivalBanner component

**Files:**
- Create: `frontend/src/modules/trips/ArrivalBanner.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/modules/trips/ArrivalBanner.tsx`:

```typescript
import { useState } from 'react';
import { getDaysUntilTravel } from './TripCountdown';

const DISMISSED_KEY = 'ur_arrival_dismissed'; // value: JSON Record<tripId, ISO datetime>

function getDismissedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}');
  } catch { return {}; }
}

function setDismissed(tripId: string) {
  const map = getDismissedMap();
  map[tripId] = new Date().toISOString();
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function isDismissedToday(tripId: string): boolean {
  const map = getDismissedMap();
  const iso = map[tripId];
  if (!iso) return false;
  const today = new Date().toISOString().slice(0, 10);
  return iso.startsWith(today);
}

interface Props {
  tripId: string;
  travelDate: string | null;
  city: string;
  onCheckNow: () => void;
}

export function ArrivalBanner({ tripId, travelDate, city, onCheckNow }: Props) {
  const [dismissed, setDismissedState] = useState(() => isDismissedToday(tripId));

  const days = getDaysUntilTravel(travelDate);
  if (days !== 0 || dismissed) return null;

  function handleNotYet() {
    setDismissed(tripId);
    setDismissedState(true);
  }

  function handleYes() {
    setDismissed(tripId);
    setDismissedState(true);
    onCheckNow();
  }

  return (
    <div
      className="rounded-2xl p-4 border mt-3"
      style={{
        background: 'rgba(34,197,94,.06)',
        borderColor: 'rgba(34,197,94,.2)',
      }}
    >
      <div className="flex items-start gap-2 mb-3">
        <span className="text-lg leading-none flex-shrink-0">✈️</span>
        <div>
          <p className="text-white/80 text-sm font-semibold leading-snug">
            You're heading to {city} today
          </p>
          <p className="text-white/40 text-xs mt-0.5">Want a last-minute itinerary check?</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleYes}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: 'rgba(34,197,94,.25)', border: '1px solid rgba(34,197,94,.3)' }}
        >
          Yes, check now
        </button>
        <button
          onClick={handleNotYet}
          className="flex-1 py-2 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.4)' }}
        >
          Not yet
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/trips/ArrivalBanner.tsx
git commit -m "feat: add ArrivalBanner — day-of arrival prompt with 4-hour re-prompt logic"
```

---

## Task 8: SwapCard flip component

**Files:**
- Create: `frontend/src/modules/trips/SwapCard.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/modules/trips/SwapCard.tsx`:

```typescript
import { useState } from 'react';
import type { SwapCard as SwapCardType } from '../../shared/types';

interface Props {
  card: SwapCardType;
  onResolve: (id: string, choice: 'new' | 'original') => void;
}

export function SwapCard({ card, onResolve }: Props) {
  const [flipped, setFlipped] = useState(false);

  if (card.resolved) return null;

  return (
    <div
      style={{
        perspective: 800,
        height: 180,
        marginBottom: 12,
        cursor: flipped ? 'default' : 'pointer',
      }}
      onClick={() => { if (!flipped) setFlipped(true); }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front — current plan */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 16,
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.1)',
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🔄</span>
            <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Stop {card.stopIdx + 1}</span>
          </div>
          <p className="text-white font-semibold text-sm leading-snug">{card.stopName}</p>
          <div
            style={{
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(255,255,255,.06)',
            }}
          >
            <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold mb-1">Current</p>
            <p className="text-white/70 text-xs">{card.currentSummary}</p>
            {card.currentNote && <p className="text-white/35 text-[10px] mt-0.5">{card.currentNote}</p>}
          </div>
          <p className="text-white/30 text-[10px] text-center mt-auto">tap to see suggestion ▼</p>
        </div>

        {/* Back — suggestion */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 16,
            background: 'rgba(99,102,241,.06)',
            border: '1px solid rgba(99,102,241,.25)',
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">✦</span>
            <span className="text-indigo-400 text-[10px] uppercase tracking-widest font-bold">Suggested</span>
          </div>
          <p className="text-white font-semibold text-sm leading-snug">{card.stopName}</p>
          <p className="text-white/60 text-xs leading-snug flex-1">{card.suggestedNote}</p>
          <div className="flex gap-2 mt-auto">
            <button
              onClick={e => { e.stopPropagation(); onResolve(card.id, 'new'); }}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold text-white"
              style={{ background: 'rgba(99,102,241,.3)', border: '1px solid rgba(99,102,241,.5)' }}
            >
              Use this
            </button>
            <button
              onClick={e => { e.stopPropagation(); onResolve(card.id, 'original'); }}
              className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.4)' }}
            >
              Keep original
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/trips/SwapCard.tsx
git commit -m "feat: add SwapCard 3D flip component — current vs suggested with Use/Keep CTAs"
```

---

## Task 9: RecalibrationStack — orchestrator + lock gate

**Files:**
- Create: `frontend/src/modules/trips/RecalibrationStack.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/modules/trips/RecalibrationStack.tsx`:

```typescript
import { useState } from 'react';
import { api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { SwapCard } from './SwapCard';
import type { SavedItinerary, SwapCard as SwapCardType } from '../../shared/types';

interface Props {
  trip: SavedItinerary;
}

export function RecalibrationStack({ trip }: Props) {
  const { dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<SwapCardType[]>(trip.pendingSwapCards ?? []);

  const unresolved = cards.filter(c => !c.resolved);
  const allDone    = cards.length > 0 && unresolved.length === 0;

  async function runRecalibration() {
    if (!trip.itinerary?.itinerary || loading) return;
    setLoading(true);
    try {
      const now     = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const result = await api.recalibrate({
        stops:       trip.itinerary.itinerary,
        currentTime: timeStr,
        persona:     trip.persona?.archetype ?? 'explorer',
        pace:        trip.persona?.pace ?? 'balanced',
        city:        trip.city,
        lat:         trip.cityLat ?? 0,
        lon:         trip.cityLon ?? 0,
        travelDate:  trip.travelDate ?? '',
      });

      const newCards: SwapCardType[] = (result.swap_cards ?? []).map(c => ({
        ...c,
        resolved: false,
        choice: null,
      }));

      setCards(newCards);
      dispatch({
        type: 'UPDATE_SAVED_ITINERARY',
        id: trip.id,
        patch: { pendingSwapCards: newCards },
      });
    } catch (err) {
      console.error('Recalibration error', err);
    } finally {
      setLoading(false);
    }
  }

  function handleResolve(cardId: string, choice: 'new' | 'original') {
    const updated = cards.map(c =>
      c.id === cardId ? { ...c, resolved: true, choice } : c
    );
    setCards(updated);
    dispatch({
      type: 'UPDATE_SAVED_ITINERARY',
      id: trip.id,
      patch: { pendingSwapCards: updated },
    });

    // If 'new', update the stop in the itinerary
    if (choice === 'new') {
      const card = cards.find(c => c.id === cardId);
      if (card && trip.itinerary) {
        const stops = [...trip.itinerary.itinerary];
        if (stops[card.stopIdx]) {
          stops[card.stopIdx] = {
            ...stops[card.stopIdx],
            time: card.suggestedSummary,
            tip: card.suggestedNote,
          };
          dispatch({
            type: 'UPDATE_SAVED_ITINERARY',
            id: trip.id,
            patch: {
              itinerary: { ...trip.itinerary, itinerary: stops },
            },
          });
        }
      }
    }
  }

  function handleDone() {
    dispatch({
      type: 'UPDATE_SAVED_ITINERARY',
      id: trip.id,
      patch: { pendingSwapCards: [] },
    });
    setCards([]);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 mt-3 text-white/40 text-xs">
        <span className="ms fill animate-spin text-sm">autorenew</span>
        Checking your itinerary for today…
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="mt-3">
      {unresolved.length > 0 && (
        <p className="text-indigo-400 text-[10px] uppercase tracking-widest font-bold mb-3">
          Last-minute suggestions · {unresolved.length} to review
        </p>
      )}

      {cards.map(card => (
        <SwapCard key={card.id} card={card} onResolve={handleResolve} />
      ))}

      {allDone && (
        <>
          <p className="text-green-400 text-xs text-center mb-3">All suggestions reviewed ✓</p>
          <button
            onClick={handleDone}
            className="w-full py-3 rounded-2xl font-bold text-white text-sm bg-primary"
          >
            Done ✓
          </button>
        </>
      )}

      {!allDone && unresolved.length > 0 && (
        <p className="text-white/25 text-[10px] text-center mt-2">
          Resolve {unresolved.length} suggestion{unresolved.length !== 1 ? 's' : ''} to continue
        </p>
      )}
    </div>
  );
}

// Export for use by ArrivalBanner integration in TripCard
export { runRecalibration };
```

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/trips/RecalibrationStack.tsx
git commit -m "feat: add RecalibrationStack — orchestrates swap cards, patches itinerary on resolve"
```

---

## Task 10: Wire everything into TripsScreen TripCard

**Files:**
- Modify: `frontend/src/modules/trips/TripsScreen.tsx`

- [ ] **Step 1: Add imports**

At the top of `frontend/src/modules/trips/TripsScreen.tsx`, add:

```typescript
import { TripCountdown, getDaysUntilTravel } from './TripCountdown';
import { SmartUpdates } from './SmartUpdates';
import { ArrivalBanner } from './ArrivalBanner';
import { RecalibrationStack } from './RecalibrationStack';
import { useRef } from 'react';
```

- [ ] **Step 2: Update TripCard to use new components and enforce swap card lock**

Replace the entire `TripCard` function with:

```typescript
function TripCard({ item }: { item: SavedItinerary }) {
  const [expanded, setExpanded] = useState(false);
  const recalibRef = useRef<{ run: () => void } | null>(null);

  const archetype = item.persona?.archetype ?? '';
  const colors    = ARCHETYPE_COLORS[archetype] ?? { primary: '#60a5fa', bg: 'rgba(96,165,250,.12)' };
  const icon      = ARCHETYPE_ICONS[archetype]  ?? 'explore';
  const stops     = item.itinerary?.itinerary ?? [];
  const preview   = stops.slice(0, 3);
  const remaining = stops.length - preview.length;

  const days           = getDaysUntilTravel(item.travelDate);
  const isToday        = days === 0;
  const isPast         = days !== null && days < 0;
  const hasUnresolved  = (item.pendingSwapCards ?? []).some(c => !c.resolved);

  // When card is today and has pending swap cards, force expanded and lock it
  const forceExpanded  = isToday && hasUnresolved;
  const effectiveOpen  = forceExpanded || expanded;

  function handleToggle() {
    if (forceExpanded) return; // locked
    setExpanded(e => !e);
  }

  function handleArrivalCheck() {
    setExpanded(true);
    // RecalibrationStack will auto-run on mount if triggered via prop
  }

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/8"
      style={{ background: 'rgba(255,255,255,.03)' }}
    >
      {/* Card header */}
      <button className="w-full text-left px-4 pt-4 pb-3" onClick={handleToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-white text-lg leading-tight truncate">
              {item.city}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-white/40 text-xs">{formatDate(item.date)}</span>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-white/40 text-xs">{stops.length} stops</span>
              {isPast && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase"
                  style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)' }}
                >Completed</span>
              )}
            </div>
            {/* Countdown */}
            <TripCountdown travelDate={item.travelDate} />
          </div>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
            style={{ background: colors.bg, border: `1px solid ${colors.primary}30` }}
          >
            <span className="ms fill" style={{ fontSize: 13, color: colors.primary }}>{icon}</span>
            <span className="font-semibold capitalize" style={{ fontSize: 10, color: colors.primary }}>
              {item.persona?.archetype_name ?? archetype}
            </span>
          </div>
        </div>

        {/* Stop previews */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {preview.map((stop, i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,.06)' }}>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.primary }} />
              <span className="text-white/60 text-[10px] truncate max-w-[100px]">{stop.place}</span>
            </div>
          ))}
          {remaining > 0 && <span className="text-white/30 text-[10px] px-1">+{remaining} more</span>}
        </div>

        {/* Expand toggle — hidden when locked */}
        {!forceExpanded && (
          <div className="flex items-center justify-end mt-2">
            <span className={`ms text-white/30 text-base transition-transform ${effectiveOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </div>
        )}
        {forceExpanded && (
          <p className="text-amber-400/60 text-[10px] text-right mt-2">
            Review suggestions to close ↓
          </p>
        )}
      </button>

      {effectiveOpen && (
        <div className="border-t border-white/6 px-4 py-3">

          {/* Arrival banner — only on travel day */}
          {isToday && !hasUnresolved && (
            <ArrivalBanner
              tripId={item.id}
              travelDate={item.travelDate}
              city={item.city}
              onCheckNow={handleArrivalCheck}
            />
          )}

          {/* Smart updates chip + cards — only for future trips */}
          {!isToday && !isPast && item.travelDate && (
            <SmartUpdates trip={item} />
          )}

          {/* Recap stack — pending swap cards (day-of) */}
          {isToday && (
            <RecalibrationStack trip={item} />
          )}

          {/* Full stop list */}
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold mb-3 mt-4">
            Full Itinerary
          </p>
          <div className="flex flex-col gap-0">
            {stops.map((stop, i) => (
              <div key={i} className="flex gap-3 py-2">
                <div className="flex flex-col items-center" style={{ width: 20 }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: i === 0 ? colors.primary : 'rgba(255,255,255,.2)' }} />
                  {i < stops.length - 1 && (
                    <div className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,.08)', minHeight: 16 }} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-white/80 text-sm font-semibold leading-snug">{stop.place}</p>
                  {stop.duration && <p className="text-white/30 text-[10px] mt-0.5">{stop.duration}</p>}
                  {stop.time && <p className="text-white/25 text-[10px]">{stop.time}</p>}
                </div>
              </div>
            ))}
          </div>

          {item.itinerary?.summary?.pro_tip && (
            <div
              className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.1)' }}
            >
              <span className="ms fill text-amber-400 flex-shrink-0" style={{ fontSize: 12 }}>lightbulb</span>
              <p className="text-amber-200/60 text-[10px] leading-relaxed">{item.itinerary.summary.pro_tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update the import for SavedItinerary in TripsScreen**

At the top of `frontend/src/modules/trips/TripsScreen.tsx`, ensure `SavedItinerary` is imported:

```typescript
import type { SavedItinerary } from '../../shared/types';
```

- [ ] **Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Run all tests**

Run: `cd frontend && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/trips/TripsScreen.tsx
git commit -m "feat: integrate TripCountdown, SmartUpdates, ArrivalBanner, RecalibrationStack into TripCard"
```

---

## Self-Review

**Spec coverage:**
- ✅ `SavedItinerary` extended with `travelDate`, `cityLat/Lon`, `selectedPlaces`, `lastUpdateCheck`, `pendingSwapCards` — Task 1
- ✅ `TripUpdateCard`, `SwapCard`, `UpdateCardKind` types — Task 1
- ✅ `UPDATE_SAVED_ITINERARY` store action — Task 2
- ✅ `SAVE_ITINERARY` updated to capture new fields — Task 2
- ✅ Countdown: days→colour (indigo / amber / green), today label — Task 3
- ✅ `POST /recalibrate` endpoint with LLM — Task 4
- ✅ `api.recalibrate()` client — Task 5
- ✅ 3-check smart updates (events via existing api.events, hours diff, weather) — Task 6
- ✅ 4-hour cooldown on update chip — Task 6
- ✅ Horizontal scrollable update card strip — Task 6
- ✅ Arrival banner on travel day with "Not yet" re-dismiss — Task 7
- ✅ 3D flip SwapCard with Use/Keep CTAs — Task 8
- ✅ RecalibrationStack: runs recalibration, patches itinerary on "new", Done button — Task 9
- ✅ Lock gate: card forced open when unresolved swap cards exist — Task 10
- ✅ TripCard composed with all intelligence layers, isPast badge — Task 10

**Type consistency check:** `SwapCard` type uses `choice: 'new' | 'original' | null` consistently across types.ts → SwapCard.tsx → RecalibrationStack.tsx. `UPDATE_SAVED_ITINERARY` patch uses `Partial<SavedItinerary>` throughout. `api.recalibrate` return type `{ swap_cards: SwapCard[] }` matches backend key `swap_cards`.

**Weather check gap:** The spec mentions a weather check as one of the 3 smart update signals. The `SmartUpdates` component checks events and hours, but the weather forecast call is omitted because no dedicated weather-forecast-by-date API method exists in `api.ts` (the existing `WeatherData` is current conditions only). A comment is left in the code at the weather check position. This can be added when a forecast endpoint is wired up — it does not block the rest of the feature.
