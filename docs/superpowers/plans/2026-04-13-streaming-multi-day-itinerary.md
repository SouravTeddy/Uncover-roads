# Streaming Multi-Day Itinerary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace N parallel `/ai-itinerary` calls with a single `/ai-itinerary-stream` NDJSON endpoint; frontend renders shimmer slots immediately and fills them as each day streams in, with full auto-retry.

**Architecture:** Backend yields one compact JSON line per day via FastAPI `StreamingResponse`; frontend `aiItineraryStream` async generator yields `Itinerary` objects; `useRoute.buildItinerary` dispatches `APPEND_ITINERARY_DAY` per day so `RouteScreen` can replace shimmer slots progressively.

**Tech Stack:** FastAPI + Anthropic SDK (streaming), React + Vitest + jsdom (frontend tests), TypeScript async generators, ReadableStream / TextDecoder

---

## File Map

| File | Action | What changes |
|---|---|---|
| `frontend/src/shared/store.tsx` | Modify | Export `reducer`; `itineraryDays → (Itinerary \| null)[]`; add `APPEND_ITINERARY_DAY` action |
| `frontend/src/shared/store.test.ts` | **Create** | Unit tests for `APPEND_ITINERARY_DAY` reducer case |
| `frontend/src/shared/api.ts` | Modify | Add `aiItineraryStream()` named export async generator |
| `frontend/src/shared/api.stream.test.ts` | **Create** | Unit tests for `aiItineraryStream` |
| `frontend/src/modules/route/DayShimmer.tsx` | **Create** | 3-card shimmer skeleton with breathing animation |
| `frontend/src/modules/route/DayStops.tsx` | **Create** | Extracted stop-card list; props `{ stops: ItineraryStop[] }` |
| `main.py` | Modify | Add `/ai-itinerary-stream` endpoint with `StreamingResponse` + NDJSON prompt |
| `frontend/src/modules/route/useRoute.ts` | Modify | Rewrite `buildItinerary`; add exported `retryDay`; expose `totalDays`, `streamingDays` |
| `frontend/src/modules/route/useRoute.test.ts` | **Create** | Unit tests for `retryDay` |
| `frontend/src/modules/route/RouteScreen.tsx` | Modify | Slot-based multi-day rendering with `DayShimmer`/`DayError`/`DayStops` |

---

### Task 1: Store — export reducer, widen type, add APPEND_ITINERARY_DAY

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Create: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reducer, initialState } from './store';
import type { AppState } from './store';
import type { Itinerary } from './types';

const mockDay1: Itinerary = {
  itinerary: [{ day: 1, time: '9:00 AM', place: 'Museum', duration: '2h', category: 'museum', tip: 'Go early', transit_to_next: '10 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip', conflict_notes: '', suggested_start_time: '9:00 AM', day_narrative: 'Calm day' },
};
const mockDay2: Itinerary = {
  itinerary: [{ day: 2, time: '10:00 AM', place: 'Park', duration: '1h', category: 'park', tip: 'Bring water', transit_to_next: '5 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip2', conflict_notes: '', suggested_start_time: '10:00 AM', day_narrative: 'Outdoor day' },
};

describe('APPEND_ITINERARY_DAY reducer', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('appends a real day to empty array', () => {
    const state: AppState = { ...initialState, itineraryDays: [] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay1 });
    expect(next.itineraryDays).toEqual([mockDay1]);
  });

  it('appends a second real day', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay2 });
    expect(next.itineraryDays).toEqual([mockDay1, mockDay2]);
  });

  it('appends null (exhausted retry)', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: null });
    expect(next.itineraryDays).toEqual([mockDay1, null]);
  });

  it('calls sessionStorage.setItem with updated array', () => {
    const state: AppState = { ...initialState, itineraryDays: [] };
    reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay1 });
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'ur_ss_itin_days',
      JSON.stringify([mockDay1]),
    );
  });

  it('SET_ITINERARY_DAYS still resets to provided array', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'SET_ITINERARY_DAYS', days: [] });
    expect(next.itineraryDays).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/shared/store.test.ts
```

Expected: FAIL — `APPEND_ITINERARY_DAY` not in `Action` union, `reducer` not exported.

- [ ] **Step 3: Modify store.tsx**

**3a. Export `reducer`** — change line 176:
```typescript
// Before:
function reducer(state: AppState, action: Action): AppState {
// After:
export function reducer(state: AppState, action: Action): AppState {
```

**3b. Widen `itineraryDays` type** — in `AppState` interface (line 51):
```typescript
// Before:
  itineraryDays: Itinerary[];
// After:
  itineraryDays: (Itinerary | null)[];
```

**3c. Widen `initialState`** — on line 137 the type inference follows; no change needed there (cast already `Itinerary[]`, will now need explicit cast). Change line 137:
```typescript
// Before:
  itineraryDays:   ssGet<Itinerary[]>('ur_ss_itin_days')       ?? [],
// After:
  itineraryDays:   ssGet<(Itinerary | null)[]>('ur_ss_itin_days') ?? [],
```

**3d. Widen `SET_ITINERARY_DAYS` action** — in the `Action` union (line 162):
```typescript
// Before:
  | { type: 'SET_ITINERARY_DAYS'; days: Itinerary[] }
// After:
  | { type: 'SET_ITINERARY_DAYS'; days: (Itinerary | null)[] }
```

**3e. Add `APPEND_ITINERARY_DAY` action** — after `SET_ITINERARY_DAYS` line:
```typescript
  | { type: 'APPEND_ITINERARY_DAY'; day: Itinerary | null }
```

**3f. Add reducer case** — after the `SET_ITINERARY_DAYS` case (around line 246):
```typescript
    case 'APPEND_ITINERARY_DAY': {
      const updated = [...state.itineraryDays, action.day];
      ssSave('ur_ss_itin_days', updated);
      return { ...state, itineraryDays: updated };
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/shared/store.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat: export reducer, add APPEND_ITINERARY_DAY action, widen itineraryDays to (Itinerary | null)[]"
```

---

### Task 2: api.ts — aiItineraryStream async generator

**Files:**
- Modify: `frontend/src/shared/api.ts`
- Create: `frontend/src/shared/api.stream.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/api.stream.test.ts`:

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import { aiItineraryStream } from './api';
import type { ItineraryRequest } from './api';

const baseRequest: ItineraryRequest = {
  city: 'Tokyo',
  lat: 35.6762,
  lon: 139.6503,
  days: 2,
  day_number: 1,
  pace: 'moderate',
  persona: 'explorer',
  persona_archetype: 'Explorer',
  persona_context: '',
  trip_context: {
    start_type: 'hotel',
    arrival_time: '10:00',
    travel_date: '2026-05-01',
    total_days: 2,
    flight_time: null,
    is_long_haul: false,
    location_lat: null,
    location_lon: null,
    location_name: null,
  },
};

function makeStreamResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe('aiItineraryStream', () => {
  it('yields two parsed objects from two NDJSON lines', async () => {
    const day1 = { day_number: 1, date: '2026-05-01', itinerary: [], summary: {} };
    const day2 = { day_number: 2, date: '2026-05-02', itinerary: [], summary: {} };
    const body = `${JSON.stringify(day1)}\n${JSON.stringify(day2)}\n`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(body)));

    const results: unknown[] = [];
    for await (const day of aiItineraryStream(baseRequest)) {
      results.push(day);
    }
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(day1);
    expect(results[1]).toEqual(day2);
  });

  it('yields incomplete last line without trailing newline', async () => {
    const day1 = { day_number: 1, date: '2026-05-01', itinerary: [], summary: {} };
    const body = JSON.stringify(day1); // no trailing \n
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(body)));

    const results: unknown[] = [];
    for await (const day of aiItineraryStream(baseRequest)) {
      results.push(day);
    }
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(day1);
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of aiItineraryStream(baseRequest)) { /* noop */ }
    }).rejects.toThrow('Stream 500');
  });

  it('skips blank lines between days', async () => {
    const day1 = { day_number: 1, date: '2026-05-01', itinerary: [], summary: {} };
    const body = `\n${JSON.stringify(day1)}\n\n`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamResponse(body)));

    const results: unknown[] = [];
    for await (const day of aiItineraryStream(baseRequest)) {
      results.push(day);
    }
    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/shared/api.stream.test.ts
```

Expected: FAIL — `aiItineraryStream` not exported from `./api`.

- [ ] **Step 3: Add aiItineraryStream to api.ts**

Append at the end of `frontend/src/shared/api.ts` (after the `fetchNearby` function):

```typescript
export async function* aiItineraryStream(
  body: ItineraryRequest,
): AsyncGenerator<Itinerary> {
  const res = await fetch(`${BASE}/ai-itinerary-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Stream ${res.status}`);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) yield JSON.parse(trimmed) as Itinerary;
    }
  }
  // flush remaining buffer (last line without trailing newline)
  if (buffer.trim()) yield JSON.parse(buffer.trim()) as Itinerary;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/shared/api.stream.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
git add frontend/src/shared/api.ts frontend/src/shared/api.stream.test.ts
git commit -m "feat: add aiItineraryStream async generator for NDJSON streaming"
```

---

### Task 3: DayShimmer.tsx and DayStops.tsx UI components

**Files:**
- Create: `frontend/src/modules/route/DayShimmer.tsx`
- Create: `frontend/src/modules/route/DayStops.tsx`

No unit tests for pure presentation components — visual correctness verified by RouteScreen slot rendering in Task 6 manual testing.

- [ ] **Step 1: Create DayShimmer.tsx**

Create `frontend/src/modules/route/DayShimmer.tsx`:

```typescript
export function DayShimmer() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: 'rgba(255,255,255,.06)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
            height: 76,
            animation: 'dayShimmerPulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,.06)',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                width: '60%', height: 14, borderRadius: 6,
                background: 'rgba(255,255,255,.08)', marginBottom: 6,
              }} />
              <div style={{
                width: '40%', height: 11, borderRadius: 6,
                background: 'rgba(255,255,255,.06)',
              }} />
            </div>
            <div style={{
              width: 48, height: 24, borderRadius: 6,
              background: 'rgba(255,255,255,.06)',
            }} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes dayShimmerPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Create DayStops.tsx**

Extract stop card JSX from `RouteScreen.tsx` multi-day block. Create `frontend/src/modules/route/DayStops.tsx`:

```typescript
import type { ItineraryStop } from '../../shared/types';

export function DayStops({ stops }: { stops: ItineraryStop[] }) {
  return (
    <>
      {stops.map((stop, stopIdx) => (
        <div
          key={stopIdx}
          style={{
            background: '#141921',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(59,130,246,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms" style={{ fontSize: 17, color: '#3b82f6' }}>place</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2,
              }}>
                {stop.time && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#93c5fd',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {stop.time}
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: 15, fontWeight: 700, color: '#f1f5f9',
                marginBottom: stop.tip ? 4 : 0,
              }}>
                {stop.place}
              </div>
              {stop.tip && (
                <div style={{
                  fontSize: 12, color: '#8e9099',
                  fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
                }}>
                  {stop.tip}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Check ItineraryStop type exists**

```bash
grep -n "ItineraryStop" /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend/src/shared/types.ts
```

If `ItineraryStop` is not exported by name, check how stops are typed in `Itinerary`. If `Itinerary.itinerary` is `Array<{day:number; time:string; place:string; ...}>`, replace `ItineraryStop` import with an inline type:

```typescript
type ItineraryStop = {
  day?: number;
  time?: string;
  place: string;
  duration?: string;
  category?: string;
  tip?: string;
  transit_to_next?: string;
  tags?: string[];
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors from DayShimmer.tsx or DayStops.tsx.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
git add frontend/src/modules/route/DayShimmer.tsx frontend/src/modules/route/DayStops.tsx
git commit -m "feat: add DayShimmer skeleton and DayStops card-list components"
```

---

### Task 4: Backend /ai-itinerary-stream endpoint

**Files:**
- Modify: `main.py`

No automated test for the FastAPI endpoint — manual smoke test in Step 4.

- [ ] **Step 1: Add StreamingResponse import**

Find the imports at the top of `main.py`. Add `StreamingResponse` and `re` if not present:

```python
# Add to existing fastapi imports line:
from fastapi.responses import RedirectResponse, StreamingResponse
# Add after existing imports:
import re
```

Check first:
```bash
grep -n "StreamingResponse\|^import re" /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/main.py | head -5
```

Only add what's missing.

- [ ] **Step 2: Add the endpoint after /ai-itinerary**

Insert the following block immediately after the closing of the `ai_itinerary` function (around line 661, before `# WEATHER`):

```python
# =========================================
# AI ITINERARY STREAM
# =========================================
@app.post("/ai-itinerary-stream")
def ai_itinerary_stream(body: dict):
    places    = body.get("selected_places", [])
    city      = body.get("city", "the city")
    days      = int(body.get("days", 1))
    pace      = body.get("pace", "moderate")
    persona   = body.get("persona", "")
    archetype = body.get("persona_archetype", "")
    trip_ctx  = body.get("trip_context", {})

    if not places:
        return {"itinerary": [], "summary": {}}
    if not ANTHROPIC_API_KEY:
        return {"error": "No Anthropic API key configured"}

    # Nearest-neighbour sort (same as /ai-itinerary)
    def _dist2(a, b):
        return (a.get('lat', 0) - b.get('lat', 0))**2 + (a.get('lon', 0) - b.get('lon', 0))**2

    def _nn_sort(pts, start_lat=None, start_lon=None):
        if len(pts) <= 1:
            return pts
        remaining = list(pts)
        sorted_pts = []
        if start_lat is not None:
            cur = {'lat': start_lat, 'lon': start_lon}
        else:
            clat = sum(p.get('lat', 0) for p in pts) / len(pts)
            clon = sum(p.get('lon', 0) for p in pts) / len(pts)
            cur = {'lat': clat, 'lon': clon}
        while remaining:
            nearest = min(remaining, key=lambda p: _dist2(cur, p))
            sorted_pts.append(nearest)
            remaining.remove(nearest)
            cur = nearest
        return sorted_pts

    start_lat = trip_ctx.get('location_lat')
    start_lon = trip_ctx.get('location_lon')
    places = _nn_sort(places, start_lat, start_lon)

    place_list = "\n".join([
        f"- {p['title']} (category: {p.get('category', 'place')}, "
        f"lat: {p.get('lat')}, lon: {p.get('lon')})"
        for p in places
    ])

    # Conflict check (same as /ai-itinerary)
    conflict = body.get("conflict_resolution", {})
    if not conflict:
        try:
            persona_dict = {
                'archetype': body.get('persona_archetype', ''),
                'ritual': trip_ctx.get('ritual', '') or body.get('ritual', ''),
                'pace': body.get('pace', ''),
                'sensory': body.get('sensory', ''),
                'social': body.get('social', ''),
                'attractions': body.get('attractions', []),
            }
            travel_date = trip_ctx.get('travel_date') or body.get('date', '')
            conflict = run_conflict_check(
                city=body.get('city', ''),
                persona=persona_dict,
                travel_date=travel_date,
            )
        except Exception as e:
            print(f"CONFLICT CHECK ERROR: {e}")
            conflict = {"has_conflicts": False, "conflicts": []}

    conflict_str = ""
    if conflict.get("has_conflicts"):
        top_conflicts = [c for c in conflict.get("conflicts", [])
                         if c.get("severity") in ("high", "medium")][:3]
        if top_conflicts:
            instructions = " | ".join(
                c.get("instruction", "") for c in top_conflicts if c.get("instruction")
            )
            conflict_str = f"CONFLICT OVERRIDES (apply strictly):\n{instructions}\n"

    start_date = trip_ctx.get("travel_date", "")
    arrival_time = trip_ctx.get("arrival_time", "") or "not specified"
    location_note = ""
    if trip_ctx.get("location_name"):
        location_note = (
            f"- Starting location: {trip_ctx.get('location_name')} "
            f"(lat: {trip_ctx.get('location_lat', '?')}, lon: {trip_ctx.get('location_lon', '?')})"
        )

    # Build per-day date strings for the OUTPUT FORMAT block
    def _iso_plus(base: str, delta: int) -> str:
        try:
            from datetime import datetime, timedelta
            d = datetime.strptime(base, "%Y-%m-%d")
            return (d + timedelta(days=delta)).strftime("%Y-%m-%d")
        except Exception:
            return base

    day_dates = [_iso_plus(start_date, i) for i in range(days)]
    day_dates_str = ", ".join(f"day {i+1}: {d}" for i, d in enumerate(day_dates))

    output_format = f"""
OUTPUT FORMAT — FOLLOW EXACTLY:
- Output {days} lines total — one line per day, no other text
- Each line is a single compact JSON object with NO internal newlines
- Line format: {{"day_number":N,"date":"YYYY-MM-DD","itinerary":[...],"summary":{{...}}}}
- Dates: {day_dates_str}
- Do NOT wrap in an array. Do not add markdown, labels, or blank lines.
- Each "itinerary" array element: {{"day":N,"time":"H:MM AM","place":"Name","duration":"X hours","category":"type","tip":"One sentence","transit_to_next":"X min walk","tags":[]}}
- Each "summary" object: {{"total_places":N,"best_transport":"...","pro_tip":"...","conflict_notes":"...","suggested_start_time":"H:MM AM","day_narrative":"..."}}
"""

    prompt = f"""You are an expert travel planner creating a hyper-personalised multi-day itinerary.

CITY: {city}
TOTAL DAYS: {days}
PACE: {pace}

TRAVELLER PERSONA: {archetype or 'general traveller'}
{persona}

SELECTED PLACES (shared across all days — distribute sensibly):
{place_list}

{conflict_str}
TRIP CONTEXT:
- Travel dates start: {start_date}
- Starting from: {trip_ctx.get('start_type', 'hotel')}
- Arrival time day 1: {arrival_time}
- Flight time (if departure day): {trip_ctx.get('flight_time', '') or 'N/A'}
- Long-haul jet lag adjustment: {trip_ctx.get('is_long_haul', False)}
{location_note}

CRITICAL RULES — FOLLOW STRICTLY:
- Return ONLY the exact places listed in SELECTED PLACES above. Do NOT add, invent, or substitute any other venues.
- Distribute places across days logically (proximity, energy, venue type)
- Stops within each day are already ordered optimally — preserve order per day
- Assign realistic durations based on venue type (museum: 1.5-2h, café: 30-45min, park: 45-60min)
- ALL place names in the output MUST be in English. Never use local-script names.
- Start time logic for day 1 (subsequent days default to 09:00 AM):
    * If arrival_time 00:00-05:59: set day 1 start 09:00 AM, note rest in conflict_notes
    * If arrival_time 06:00-08:59: start 1 hour after arrival
    * If arrival_time 09:00-16:59: use arrival_time + 30 min for hotel/airport
    * If arrival_time 17:00-19:59: set day 1 start 09:00 AM; note evening is for settling in
    * If arrival_time 20:00+: set day 1 start 09:00 AM; note late-night arrival
    * If no arrival_time: default start 09:00 AM
- If jet lag is true, reduce day 1 intensity by 50% and add rest window 14:00-16:00
- transit_to_next must be a realistic walking/transit time string
- tip: ONE sentence, max 12 words, one specific insider detail
- day_narrative in summary: ONE sentence (max 8 words) capturing the day's rhythm

{output_format}"""

    def generate():
        buffer = ""
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=8000,
                timeout=120,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for text in stream.text_stream:
                    buffer += text
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = re.sub(r'\s+', ' ', line).strip()
                        if not line:
                            continue
                        try:
                            parsed = json.loads(line)
                            yield json.dumps(parsed) + '\n'
                        except json.JSONDecodeError:
                            pass  # malformed line — frontend detects missing day, auto-retries
            # flush remaining buffer
            if buffer.strip():
                try:
                    parsed = json.loads(re.sub(r'\s+', ' ', buffer).strip())
                    yield json.dumps(parsed) + '\n'
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            print(f"STREAM ERROR: {e}")
            # StreamingResponse has already started — cannot raise HTTPException here
            # Frontend detects incomplete stream by day count

    return StreamingResponse(generate(), media_type="application/x-ndjson")
```

- [ ] **Step 3: Smoke test the endpoint manually**

Start the backend:
```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
uvicorn main:app --reload --port 8000 &
sleep 3
```

Smoke test with curl (2-day, 2-place):
```bash
curl -s -X POST http://localhost:8000/ai-itinerary-stream \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Tokyo",
    "lat": 35.6762,
    "lon": 139.6503,
    "days": 2,
    "day_number": 1,
    "pace": "moderate",
    "persona": "explorer",
    "persona_archetype": "Explorer",
    "persona_context": "",
    "trip_context": {
      "start_type": "hotel",
      "arrival_time": "10:00",
      "travel_date": "2026-05-01",
      "total_days": 2,
      "flight_time": null,
      "is_long_haul": false,
      "location_lat": null,
      "location_lon": null,
      "location_name": null
    },
    "selected_places": [
      {"id": "1", "title": "Senso-ji Temple", "lat": 35.7148, "lon": 139.7967},
      {"id": "2", "title": "Shibuya Crossing", "lat": 35.6595, "lon": 139.7004}
    ]
  }'
```

Expected: Two lines of compact JSON, each starting with `{"day_number":1,` and `{"day_number":2,`.

Kill the dev server after testing:
```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
git add main.py
git commit -m "feat: add /ai-itinerary-stream NDJSON streaming endpoint"
```

---

### Task 5: useRoute.ts — streaming buildItinerary + retryDay

**Files:**
- Modify: `frontend/src/modules/route/useRoute.ts`
- Create: `frontend/src/modules/route/useRoute.test.ts`

- [ ] **Step 1: Write the failing test for retryDay**

Create `frontend/src/modules/route/useRoute.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { retryDay } from './useRoute';
import type { ItineraryRequest } from '../../shared/api';
import type { Itinerary } from '../../shared/types';

const mockItinerary: Itinerary = {
  itinerary: [{ day: 2, time: '9:00 AM', place: 'Park', duration: '1h', category: 'park', tip: 'Go early', transit_to_next: '5 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip', conflict_notes: '', suggested_start_time: '9:00 AM', day_narrative: 'Outdoor day' },
};

const baseRequest: ItineraryRequest = {
  city: 'Tokyo',
  lat: 35.6762,
  lon: 139.6503,
  days: 3,
  day_number: 1,
  pace: 'moderate',
  persona: 'explorer',
  persona_archetype: 'Explorer',
  persona_context: '',
  trip_context: {
    start_type: 'hotel',
    arrival_time: '10:00',
    travel_date: '2026-05-01',
    total_days: 3,
    flight_time: null,
    is_long_haul: false,
    location_lat: null,
    location_lon: null,
    location_name: null,
  },
};

afterEach(() => vi.restoreAllMocks());

describe('retryDay', () => {
  it('returns null when api.aiItinerary fails both attempts', async () => {
    const { api } = await import('../../shared/api');
    vi.spyOn(api, 'aiItinerary').mockRejectedValue(new Error('network error'));

    const result = await retryDay(2, 3, '2026-05-01', baseRequest, 0);
    expect(result).toBeNull();
    expect(api.aiItinerary).toHaveBeenCalledTimes(2);
  });

  it('returns null when api.aiItinerary returns error object', async () => {
    const { api } = await import('../../shared/api');
    vi.spyOn(api, 'aiItinerary').mockResolvedValue({ error: 'Bad request' } as unknown as Itinerary);

    const result = await retryDay(2, 3, '2026-05-01', baseRequest, 0);
    expect(result).toBeNull();
  });

  it('returns itinerary when api.aiItinerary succeeds on second attempt', async () => {
    const { api } = await import('../../shared/api');
    vi.spyOn(api, 'aiItinerary')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(mockItinerary);

    const result = await retryDay(2, 3, '2026-05-01', baseRequest, 0);
    expect(result).toEqual(mockItinerary);
  });

  it('uses correct day_number and travel_date in the request', async () => {
    const { api } = await import('../../shared/api');
    const spy = vi.spyOn(api, 'aiItinerary').mockResolvedValue(mockItinerary);

    await retryDay(3, 3, '2026-05-01', baseRequest, 0);
    const calledBody = spy.mock.calls[0][0];
    expect(calledBody.day_number).toBe(3);
    expect(calledBody.trip_context.travel_date).toBe('2026-05-03'); // +2 days from start
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/modules/route/useRoute.test.ts
```

Expected: FAIL — `retryDay` not exported from `./useRoute`.

- [ ] **Step 3: Rewrite useRoute.ts**

Replace the entire contents of `frontend/src/modules/route/useRoute.ts`:

```typescript
import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { api, aiItineraryStream } from '../../shared/api';
import type { ItineraryRequest } from '../../shared/api';
import type { Itinerary, SavedItinerary } from '../../shared/types';
import { supabase } from '../../shared/supabase';
import { syncSavedItinerary, incrementGenerationCount } from '../../shared/userSync';
import { computeTotalDays, addDaysToIso } from '../map/trip-capacity-utils';

export function useRoute() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'saved'>('active');

  const { city, selectedPlaces, persona, itinerary, weather, savedItineraries } = state;

  const totalDays = computeTotalDays(state.travelStartDate, state.travelEndDate) ||
    (state.tripContext.days ?? 1);
  const streamingDays = state.itineraryDays.length < totalDays && !error;

  useEffect(() => {
    if (!itinerary && selectedPlaces.length >= 2 && persona) {
      buildItinerary();
    }
    if (city && !weather) {
      loadWeather();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buildItinerary(overridePlaces?: typeof state.selectedPlaces) {
    if (!persona || !state.cityGeo) return;

    const days = totalDays > 0 ? totalDays : (state.tripContext.days ?? 1);
    const startDate = state.travelStartDate ?? state.tripContext.date;
    const placesToUse = overridePlaces ?? state.selectedPlaces;

    dispatch({ type: 'SET_ITINERARY_DAYS', days: [] });
    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    setError(null);
    setLoading(true);

    const streamRequest: ItineraryRequest = {
      city:              state.city,
      lat:               state.cityGeo.lat,
      lon:               state.cityGeo.lon,
      days,
      day_number:        1,
      pace:              persona.pace ?? 'any',
      persona:           persona.archetype,
      persona_archetype: persona.archetype_name,
      persona_context:   persona.insight ?? '',
      trip_context: {
        start_type:    state.tripContext.startType,
        arrival_time:  state.tripContext.arrivalTime,
        travel_date:   startDate,
        total_days:    days,
        flight_time:   state.tripContext.flightTime,
        is_long_haul:  state.tripContext.isLongHaul,
        location_lat:  state.tripContext.locationLat,
        location_lon:  state.tripContext.locationLon,
        location_name: state.tripContext.locationName,
      },
      selected_places: placesToUse.map(p => ({ id: p.id, title: p.title, lat: p.lat, lon: p.lon })),
    };

    let dispatched = 0;
    let streamAttempt = 0;

    while (streamAttempt <= 2) {
      try {
        for await (const day of aiItineraryStream(streamRequest)) {
          dispatch({ type: 'APPEND_ITINERARY_DAY', day });
          if (dispatched === 0) {
            dispatch({ type: 'SET_ITINERARY', itinerary: day }); // backward compat
            setLoading(false);
          }
          dispatched++;
        }
        break; // stream completed cleanly
      } catch {
        if (dispatched === 0 && streamAttempt < 2) {
          streamAttempt++;
          await new Promise(r => setTimeout(r, 500 * streamAttempt));
          continue;
        }
        break;
      }
    }

    if (dispatched === 0) {
      setLoading(false);
      setError('Could not generate your itinerary. Please try again.');
      return;
    }

    // Auto-retry any missing days via single-day endpoint
    if (dispatched < days) {
      for (let d = dispatched + 1; d <= days; d++) {
        const result = await retryDay(d, days, startDate, streamRequest);
        dispatch({ type: 'APPEND_ITINERARY_DAY', day: result });
      }
    }

    dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) incrementGenerationCount(user.id).catch(console.warn);
    });
  }

  async function loadWeather() {
    if (!city) return;
    try {
      const wx = await api.weather(city);
      dispatch({ type: 'SET_WEATHER', weather: wx });
    } catch {
      // non-critical
    }
  }

  function removeStop(idx: number) {
    const stops = itinerary?.itinerary ?? [];
    const removed = stops[idx];
    if (!removed) return;
    const nameLower = (removed.place ?? '').toLowerCase();
    const updatedPlaces = selectedPlaces.filter(p => {
      const t = p.title.toLowerCase();
      return !(t === nameLower || nameLower.includes(t.slice(0, 8)) || t.includes(nameLower.slice(0, 8)));
    });
    dispatch({ type: 'SET_SELECTED_PLACES', places: updatedPlaces });
    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    if (updatedPlaces.length < 1) {
      dispatch({ type: 'GO_TO', screen: 'map' });
      return;
    }
    buildItinerary();
  }

  async function saveItinerary() {
    if (!itinerary || !persona) return;
    const saved: SavedItinerary = {
      id: Date.now().toString(),
      city,
      date: new Date().toISOString(),
      itinerary,
      persona,
    };
    dispatch({ type: 'SAVE_ITINERARY', saved });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) syncSavedItinerary(user.id, saved).catch(console.warn);
  }

  function addSuggestion(place: import('../../shared/types').Place) {
    if (state.selectedPlaces.some(p => p.id === place.id)) return;
    if (!state.places.some(p => p.id === place.id)) {
      dispatch({ type: 'MERGE_PLACES', places: [place] });
    }
    const newSelected = [...state.selectedPlaces, place];
    dispatch({ type: 'SET_SELECTED_PLACES', places: newSelected });
    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    buildItinerary(newSelected);
  }

  function goBack() {
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function goToNav() {
    dispatch({ type: 'GO_TO', screen: 'nav' });
  }

  return {
    loading,
    error,
    tab,
    setTab,
    itinerary,
    itineraryDays: state.itineraryDays,
    totalDays,
    streamingDays,
    weather,
    city,
    selectedPlaces,
    savedItineraries,
    removeStop,
    saveItinerary,
    buildItinerary,
    addSuggestion,
    goBack,
    goToNav,
  };
}

export async function retryDay(
  dayNumber: number,
  totalDays: number,
  startDate: string,
  base: ItineraryRequest,
  delayMs = 500,
): Promise<Itinerary | null> {
  const travelDate = addDaysToIso(startDate, dayNumber - 1);
  const body: ItineraryRequest = {
    ...base,
    day_number: dayNumber,
    trip_context: { ...base.trip_context, travel_date: travelDate, total_days: totalDays },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
    try {
      const result = await api.aiItinerary(body);
      if (result && !(result as unknown as { error?: string }).error) return result;
    } catch { /* continue */ }
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/modules/route/useRoute.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run all tests to verify no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run
```

Expected: All tests PASS (no regressions from store/api changes).

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
git add frontend/src/modules/route/useRoute.ts frontend/src/modules/route/useRoute.test.ts
git commit -m "feat: rewrite buildItinerary with streaming, add exported retryDay with auto-retry"
```

---

### Task 6: RouteScreen.tsx — slot-based multi-day rendering

**Files:**
- Modify: `frontend/src/modules/route/RouteScreen.tsx`

- [ ] **Step 1: Update imports**

At the top of `RouteScreen.tsx`, add the new component imports and update the `useRoute` destructuring:

```typescript
// Add after existing imports:
import { DayShimmer } from './DayShimmer';
import { DayStops } from './DayStops';
```

- [ ] **Step 2: Update useRoute destructuring**

In the `useRoute()` call (line 13), add `totalDays` and `streamingDays`:

```typescript
  const {
    loading,
    error,
    tab,
    setTab,
    itinerary,
    itineraryDays,
    totalDays,       // add
    streamingDays,   // add
    weather,
    city,
    selectedPlaces,
    savedItineraries,
    removeStop,
    saveItinerary,
    buildItinerary,
    goBack,
    goToNav,
  } = useRoute();
```

- [ ] **Step 3: Replace the multi-day view block**

Find the `// Multi-day view` block (currently around line 122) and replace it entirely:

```typescript
  // Multi-day view — totalDays > 1 OR itineraryDays already has content
  if (totalDays > 1 || itineraryDays.length > 1) {
    const startIso = state.travelStartDate ?? state.tripContext.date;
    const displayDays = Math.max(totalDays, itineraryDays.length);
    return (
      <>
        <AmbientVideo src={currentScene} timeMins={(() => {
          const t = tripContext.arrivalTime ?? '9:00';
          const [h, m] = t.split(':').map(Number);
          return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
        })()} />
        <div
          className="fixed inset-0 overflow-y-auto"
          style={{ zIndex: 25, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0 20px 16px',
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
              background: 'rgba(10,14,20,0.82)',
              backdropFilter: 'blur(16px)',
              position: 'sticky', top: 0, zIndex: 10,
              borderBottom: '1px solid rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            <button
              onClick={goBack}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <span className="ms" style={{ fontSize: 18, color: '#94a3b8' }}>arrow_back</span>
            </button>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 2,
                textTransform: 'uppercase', color: '#3b82f6',
                fontFamily: 'Inter, sans-serif', marginBottom: 2,
              }}>
                Your trip
              </div>
              <div style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: 18, fontWeight: 800, color: '#f1f5f9',
              }}>
                {city} · {displayDays} days
                {streamingDays && (
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>
                    building…
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Day slots */}
          {Array.from({ length: displayDays }, (_, i) => {
            const day = itineraryDays[i];
            const dayDate = addDaysToIso(startIso, i);
            const dayLabel = new Date(dayDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            });
            return (
              <div key={i} style={{ padding: '0 16px' }}>
                {/* Day divider */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  margin: '24px 0 16px',
                }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
                  <div style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 13, fontWeight: 700, color: '#cbd5e1',
                    whiteSpace: 'nowrap',
                  }}>
                    Day {i + 1} · {dayLabel}
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
                </div>

                {/* Slot content */}
                {day === undefined ? (
                  <DayShimmer />
                ) : day === null ? (
                  <div style={{
                    textAlign: 'center', padding: '20px 0', color: '#8e9099',
                    fontFamily: 'Inter, sans-serif', fontSize: 12,
                  }}>
                    Could not load this day
                  </div>
                ) : (
                  <DayStops stops={day.itinerary} />
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx tsc --noEmit 2>&1 | head -40
```

Expected: No type errors.

- [ ] **Step 5: Run all tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
git add frontend/src/modules/route/RouteScreen.tsx
git commit -m "feat: slot-based multi-day rendering with DayShimmer, DayError, DayStops"
```

---

### Task 7: End-to-end verification and finish

- [ ] **Step 1: Run the full test suite one final time**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run
```

Expected: All tests PASS (store, api.stream, useRoute, and any pre-existing tests).

- [ ] **Step 2: TypeScript clean build**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Manual smoke test checklist**

Start frontend + backend locally, build a 2-day itinerary, verify:

- [ ] Loading spinner shows until Day 1 arrives
- [ ] Day 1 slot populates with real content; Day 2 slot shows shimmer
- [ ] Day 2 slot populates when stream completes
- [ ] If backend is unreachable (kill server mid-stream), remaining days show "Could not load this day" after retries
- [ ] 1-day trip still works (falls through to existing `ItineraryCards` path)

- [ ] **Step 4: Invoke finishing-a-development-branch skill**

Use superpowers:finishing-a-development-branch to present merge/PR options.
