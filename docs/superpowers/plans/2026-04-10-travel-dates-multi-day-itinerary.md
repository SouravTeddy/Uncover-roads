# Travel Date Range + Multi-Day Itinerary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent travel date range bar to the explore tab, remove the single-date picker from TripPlanningCard, and build multi-day itineraries in one shot using N parallel API calls.

**Architecture:** `travelStartDate`/`travelEndDate` live in AppState (sessionStorage-persisted). `TravelDateBar` reads/writes these and shows an overflow/shortage indicator. `useTripPlanInput.handleBuild` reads the date range and sets `tripContext.days = totalDays`. `useRoute.buildItinerary` fires N parallel `aiItinerary` calls and stores results in `itineraryDays: Itinerary[]`. `RouteScreen` renders a sequential multi-day view with day dividers when `itineraryDays.length > 1`, falling back to single-day `ItineraryCards` otherwise.

**Tech Stack:** React 18, TypeScript, Vitest, inline styles matching app design tokens (`PRIMARY=#3b82f6`, `TEXT1=#f1f5f9`, `TEXT3=#8e9099`, Plus Jakarta Sans / Inter fonts, Material Symbols Outlined icons).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/shared/store.tsx` | Modify | Add `travelStartDate`, `travelEndDate`, `itineraryDays` to AppState; add `SET_TRAVEL_DATES`, `SET_ITINERARY_DAYS` actions |
| `frontend/src/modules/map/trip-capacity-utils.ts` | **Create** | Pure functions: `getTripCapacityStatus`, `computeTotalDays`, `addDaysToIso` |
| `frontend/src/modules/map/trip-capacity-utils.test.ts` | **Create** | Vitest tests for all three functions (11 tests) |
| `frontend/src/modules/map/TravelDateBar.tsx` | **Create** | Persistent date bar + DateRangeSheet bottom sheet |
| `frontend/src/modules/map/MapScreen.tsx` | Modify | Import + render TravelDateBar; update events date check |
| `frontend/src/modules/map/useTripPlanInput.ts` | Modify | Remove date strip state; read `travelStartDate` from store; set `days: totalDays` in handleBuild |
| `frontend/src/modules/map/TripPlanningCard.tsx` | Modify | Remove date strip section; add trip summary badge; update CTA copy |
| `frontend/src/modules/route/useRoute.ts` | Modify | `buildItinerary` fires N parallel calls for multi-day; dispatches `SET_ITINERARY_DAYS` |
| `frontend/src/modules/route/RouteScreen.tsx` | Modify | Render multi-day sequential view with day dividers when `itineraryDays.length > 1` |

---

## Task 1: Store — travelStartDate, travelEndDate, itineraryDays

**Files:**
- Modify: `frontend/src/shared/store.tsx`

- [ ] **Step 1: Read the current store**

Read `frontend/src/shared/store.tsx` to confirm the current `AppState` interface, `initialState`, `Action` union, and reducer structure.

- [ ] **Step 2: Add fields to AppState and initialState**

In `AppState`, add three new fields after `itinerary`:
```typescript
export interface AppState {
  // ... existing fields ...
  itinerary: Itinerary | null;
  itineraryDays: Itinerary[];          // ← ADD: multi-day results
  travelStartDate: string | null;      // ← ADD: ISO date "YYYY-MM-DD"
  travelEndDate: string | null;        // ← ADD: ISO date "YYYY-MM-DD"
  // ... rest of existing fields ...
}
```

In `initialState`, add the three new field initializers after `itinerary`:
```typescript
export const initialState: AppState = {
  // ... existing fields ...
  itinerary: ssGet<Itinerary>('ur_ss_itinerary') ?? null,
  itineraryDays:    ssGet<Itinerary[]>('ur_ss_itin_days')   ?? [],
  travelStartDate:  ssGet<string>('ur_ss_start_date')        ?? null,
  travelEndDate:    ssGet<string>('ur_ss_end_date')          ?? null,
  // ... rest of existing fields ...
};
```

- [ ] **Step 3: Add the two new actions to the Action union**

In the `Action` type union, add after `SET_ITINERARY`:
```typescript
| { type: 'SET_ITINERARY_DAYS'; days: Itinerary[] }
| { type: 'SET_TRAVEL_DATES'; startDate: string; endDate: string }
```

- [ ] **Step 4: Add reducer cases**

In the reducer `switch`, add after the `SET_ITINERARY` case:
```typescript
case 'SET_ITINERARY_DAYS':
  ssSave('ur_ss_itin_days', action.days);
  return { ...state, itineraryDays: action.days };

case 'SET_TRAVEL_DATES':
  ssSave('ur_ss_start_date', action.startDate);
  ssSave('ur_ss_end_date', action.endDate);
  return { ...state, travelStartDate: action.startDate, travelEndDate: action.endDate };
```

Also update the `RESET_MAP` case to clear the new fields:
```typescript
case 'RESET_MAP':
  ssSave('ur_ss_city', '');
  ssSave('ur_ss_geo', null);
  ssSave('ur_ss_places', []);
  ssSave('ur_ss_sel', []);
  ssSave('ur_ss_itinerary', null);
  ssSave('ur_ss_itin_days', []);
  ssSave('ur_ss_start_date', null);
  ssSave('ur_ss_end_date', null);
  ssSave('ur_ss_weather', null);
  return {
    ...state,
    city: '', cityGeo: null, places: [], selectedPlaces: [],
    itinerary: null, itineraryDays: [], travelStartDate: null,
    travelEndDate: null, route: null, weather: null,
  };
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 74 passed (0 failures) — purely additive changes.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git add frontend/src/shared/store.tsx && git commit -m "feat: add travelStartDate, travelEndDate, itineraryDays to store"
```

---

## Task 2: trip-capacity-utils — pure functions + tests

**Files:**
- Create: `frontend/src/modules/map/trip-capacity-utils.ts`
- Create: `frontend/src/modules/map/trip-capacity-utils.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `frontend/src/modules/map/trip-capacity-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getTripCapacityStatus,
  computeTotalDays,
  addDaysToIso,
} from './trip-capacity-utils';

describe('getTripCapacityStatus', () => {
  it('returns unset when totalDays is 0', () => {
    expect(getTripCapacityStatus(5, 0)).toBe('unset');
  });
  it('returns unset when placeCount is 0', () => {
    expect(getTripCapacityStatus(0, 3)).toBe('unset');
  });
  it('returns shortage when placeCount < totalDays', () => {
    expect(getTripCapacityStatus(2, 5)).toBe('shortage');
  });
  it('returns ok when exactly 1 place per day', () => {
    expect(getTripCapacityStatus(3, 3)).toBe('ok');
  });
  it('returns ok when 4 places per day (mid range)', () => {
    expect(getTripCapacityStatus(8, 2)).toBe('ok'); // 8 <= 2*5=10
  });
  it('returns overflow when > 5 places per day', () => {
    expect(getTripCapacityStatus(11, 2)).toBe('overflow'); // 11 > 2*5=10
  });
});

describe('computeTotalDays', () => {
  it('returns 0 when start is null', () => {
    expect(computeTotalDays(null, '2026-04-14')).toBe(0);
  });
  it('returns 0 when end is null', () => {
    expect(computeTotalDays('2026-04-10', null)).toBe(0);
  });
  it('returns 1 for same-day range', () => {
    expect(computeTotalDays('2026-04-10', '2026-04-10')).toBe(1);
  });
  it('returns 5 for a 5-day range', () => {
    expect(computeTotalDays('2026-04-10', '2026-04-14')).toBe(5);
  });
});

describe('addDaysToIso', () => {
  it('adds 0 days (no change)', () => {
    expect(addDaysToIso('2026-04-10', 0)).toBe('2026-04-10');
  });
  it('adds 1 day', () => {
    expect(addDaysToIso('2026-04-10', 1)).toBe('2026-04-11');
  });
  it('handles month boundary', () => {
    expect(addDaysToIso('2026-04-30', 1)).toBe('2026-05-01');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: FAIL — "Cannot find module './trip-capacity-utils'"

- [ ] **Step 3: Create the implementation**

Create `frontend/src/modules/map/trip-capacity-utils.ts`:

```typescript
export type CapacityStatus = 'unset' | 'ok' | 'overflow' | 'shortage';

/**
 * Returns a capacity status based on how many places fit into the trip duration.
 * Threshold: 5 places/day (fast pace cap). Will be parameterised when pace setting exists.
 */
export function getTripCapacityStatus(
  placeCount: number,
  totalDays: number,
): CapacityStatus {
  if (totalDays === 0 || placeCount === 0) return 'unset';
  if (placeCount < totalDays) return 'shortage';        // < 1 place/day
  if (placeCount > totalDays * 5) return 'overflow';    // > 5 places/day
  return 'ok';
}

/**
 * Computes the number of trip days (inclusive) from two ISO date strings.
 * Returns 0 if either date is null.
 */
export function computeTotalDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

/**
 * Returns a new ISO date string offset by `days` days from `isoDate`.
 * Uses T12:00:00 to avoid DST boundary issues.
 */
export function addDaysToIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 85 passed (74 existing + 11 new).

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git add frontend/src/modules/map/trip-capacity-utils.ts frontend/src/modules/map/trip-capacity-utils.test.ts && git commit -m "feat: trip-capacity-utils — getTripCapacityStatus, computeTotalDays, addDaysToIso"
```

---

## Task 3: TravelDateBar component

**Files:**
- Create: `frontend/src/modules/map/TravelDateBar.tsx`

- [ ] **Step 1: Create TravelDateBar.tsx**

Create `frontend/src/modules/map/TravelDateBar.tsx` with the full content below.

The component has two parts:
1. The bar itself (always rendered) — shows unset or set dates + capacity indicator
2. `DateRangeSheet` (conditional) — bottom sheet with two date pill strips

```tsx
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { generateDateStrip } from './trip-utils';
import {
  getTripCapacityStatus,
  computeTotalDays,
  type CapacityStatus,
} from './trip-capacity-utils';

// ── Design tokens ────────────────────────────────────────────
const PRIMARY        = '#3b82f6';
const PRIMARY_BG     = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1          = '#f1f5f9';
const TEXT3          = '#8e9099';
const BORDER         = 'rgba(255,255,255,.08)';
const SURFACE        = '#141921';
const SURFACE2       = '#1A1F2B';

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  }); // "Apr 10"
}

function statusConfig(status: CapacityStatus): { label: string; color: string } | null {
  switch (status) {
    case 'overflow':  return { label: '⚠ may overflow', color: '#fbbf24' };
    case 'shortage':  return { label: '◎ add more?',    color: '#60a5fa' };
    case 'ok':        return { label: '✓ looks good',   color: '#4ade80' };
    default:          return null;
  }
}

// ── Main component ────────────────────────────────────────────

export function TravelDateBar() {
  const { state, dispatch } = useAppStore();
  const { travelStartDate, travelEndDate, selectedPlaces } = state;
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalDays = computeTotalDays(travelStartDate, travelEndDate);
  const status    = getTripCapacityStatus(selectedPlaces.length, totalDays);
  const indicator = statusConfig(status);
  const isSet     = !!(travelStartDate && travelEndDate);

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        style={{
          width: '100%', height: 40,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,.04)',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '0 14px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          className="ms"
          style={{ fontSize: 16, color: isSet ? PRIMARY : TEXT3, flexShrink: 0 }}
        >
          calendar_month
        </span>

        {isSet ? (
          <>
            <span style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 13, fontWeight: 700, color: TEXT1, flex: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {formatDateShort(travelStartDate!)} → {formatDateShort(travelEndDate!)}
            </span>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12, fontWeight: 600, color: '#93c5fd', flexShrink: 0,
            }}>
              · {totalDays} day{totalDays !== 1 ? 's' : ''}
            </span>
            {indicator && (
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11, fontWeight: 600, color: indicator.color,
                flexShrink: 0, marginLeft: 4,
              }}>
                {indicator.label}
              </span>
            )}
          </>
        ) : (
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13, fontWeight: 500, color: TEXT3, flex: 1,
          }}>
            Set travel dates
          </span>
        )}

        <span className="ms" style={{ fontSize: 14, color: TEXT3, flexShrink: 0 }}>
          chevron_right
        </span>
      </button>

      {sheetOpen && (
        <DateRangeSheet
          initialStart={travelStartDate}
          initialEnd={travelEndDate}
          onDone={(start, end) => {
            dispatch({ type: 'SET_TRAVEL_DATES', startDate: start, endDate: end });
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

// ── DateRangeSheet ────────────────────────────────────────────

interface SheetProps {
  initialStart: string | null;
  initialEnd:   string | null;
  onDone:  (start: string, end: string) => void;
  onClose: () => void;
}

function DateRangeSheet({ initialStart, initialEnd, onDone, onClose }: SheetProps) {
  const dates = useMemo(() => generateDateStrip(21), []); // 3 weeks
  const [localStart, setLocalStart] = useState(initialStart ?? dates[0].isoDate);
  const [localEnd,   setLocalEnd]   = useState(initialEnd   ?? dates[0].isoDate);

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleStartPick(iso: string) {
    setLocalStart(iso);
    // If new start is after end, move end to match
    if (iso > localEnd) setLocalEnd(iso);
  }

  function handleEndPick(iso: string) {
    // Ignore dates before start
    if (iso < localStart) return;
    setLocalEnd(iso);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 55,
          background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      />

      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 16, right: 16,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
          zIndex: 56,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          position: 'relative',
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${BORDER}`,
          background: 'linear-gradient(135deg, rgba(59,130,246,.08) 0%, rgba(15,23,42,0) 60%)',
        }}>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: PRIMARY, marginBottom: 4,
            fontFamily: 'Inter, sans-serif',
          }}>
            Travel dates
          </div>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 18, fontWeight: 800, color: TEXT1,
          }}>
            {formatDateShort(localStart)} → {formatDateShort(localEnd)}
            <span style={{
              fontSize: 13, fontWeight: 600, color: '#93c5fd', marginLeft: 8,
              fontFamily: 'Inter, sans-serif',
            }}>
              {computeTotalDays(localStart, localEnd)} day{computeTotalDays(localStart, localEnd) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Departure */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Departure
            </div>
            <DateStrip
              dates={dates}
              selected={localStart}
              disabledBefore={null}
              onSelect={handleStartPick}
            />
          </div>

          {/* Return */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Return
            </div>
            <DateStrip
              dates={dates}
              selected={localEnd}
              disabledBefore={localStart}
              onSelect={handleEndPick}
            />
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: 20 }}>
          <button
            onClick={() => onDone(localStart, localEnd)}
            style={{
              width: '100%', height: 54,
              background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`,
              border: 'none', borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 0.2,
              boxShadow: '0 4px 24px rgba(59,130,246,.35)',
            }}
          >
            <span className="ms" style={{ fontSize: 20 }}>check</span>
            Done
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── DateStrip sub-component ────────────────────────────────────

interface DateStripProps {
  dates:          ReturnType<typeof generateDateStrip>;
  selected:       string;
  disabledBefore: string | null;
  onSelect:       (iso: string) => void;
}

function DateStrip({ dates, selected, disabledBefore, onSelect }: DateStripProps) {
  return (
    <div style={{
      display: 'flex', gap: 6,
      overflowX: 'auto', paddingBottom: 4,
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
    } as React.CSSProperties}>
      {dates.map((d, idx) => {
        const active   = d.isoDate === selected;
        const disabled = disabledBefore !== null && d.isoDate < disabledBefore;
        return (
          <button
            key={d.isoDate}
            onClick={() => !disabled && onSelect(d.isoDate)}
            aria-label={`Select ${d.dayAbbr} ${d.dayNum}`}
            aria-pressed={active}
            disabled={disabled}
            style={{
              flexShrink: 0, width: 52,
              padding: '10px 4px 8px',
              background: active ? PRIMARY_BG : 'rgba(255,255,255,.04)',
              border: `1.5px solid ${active ? PRIMARY_BORDER : BORDER}`,
              borderRadius: 14, textAlign: 'center', cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.3 : 1,
              transition: 'all .15s ease',
            }}
          >
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: active ? '#93c5fd' : TEXT3,
              fontFamily: 'Inter, sans-serif', marginBottom: 4,
            }}>
              {idx === 0 ? 'TODAY' : d.dayAbbr.toUpperCase()}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, lineHeight: 1,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              color: active ? TEXT1 : 'rgba(255,255,255,.45)',
            }}>
              {d.dayNum}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 85 passed (TravelDateBar is pure UI, no logic under test here — existing tests still pass).

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git add frontend/src/modules/map/TravelDateBar.tsx && git commit -m "feat: TravelDateBar — persistent date range bar + DateRangeSheet"
```

---

## Task 4: MapScreen — wire TravelDateBar

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Read MapScreen.tsx**

Read `frontend/src/modules/map/MapScreen.tsx` to find:
1. The imports section (top of file) — to add the new import
2. The JSX block containing the FilterBar render — to insert TravelDateBar before it

- [ ] **Step 2: Add import**

At the top of `MapScreen.tsx`, alongside the other local imports, add:
```typescript
import { TravelDateBar } from './TravelDateBar';
```

- [ ] **Step 3: Insert TravelDateBar before FilterBar**

Find the JSX block that renders FilterBar:
```tsx
{/* Filter bar */}
<div style={{ pointerEvents: 'auto' }}>
  <FilterBar active={activeFilter as MapFilter} counts={counts} onSelect={handleFilterSelect} />
</div>
```

Insert TravelDateBar immediately before it:
```tsx
{/* Travel date bar */}
<div style={{ pointerEvents: 'auto' }}>
  <TravelDateBar />
</div>

{/* Filter bar */}
<div style={{ pointerEvents: 'auto' }}>
  <FilterBar active={activeFilter as MapFilter} counts={counts} onSelect={handleFilterSelect} />
</div>
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 85 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git add frontend/src/modules/map/MapScreen.tsx && git commit -m "feat: wire TravelDateBar into MapScreen above FilterBar"
```

---

## Task 5: useTripPlanInput — remove date state, read from store

**Files:**
- Modify: `frontend/src/modules/map/useTripPlanInput.ts`

- [ ] **Step 1: Read useTripPlanInput.ts**

Read `frontend/src/modules/map/useTripPlanInput.ts` in full to understand the current structure before editing.

- [ ] **Step 2: Remove date strip state, import computeTotalDays**

At the top of the file, add this import:
```typescript
import { computeTotalDays } from './trip-capacity-utils';
```

Remove this import from `trip-utils`:
```typescript
import {
  computeRecommendedStartTime,
  formatTimeDisplay,
  generateDateStrip,  // ← REMOVE THIS
} from './trip-utils';
```

(Keep `computeRecommendedStartTime` and `formatTimeDisplay`.)

Remove the date strip state (two lines to delete):
```typescript
// DELETE THESE TWO LINES:
const dates = useMemo(() => generateDateStrip(7), []);
const [selectedDate, setSelectedDate] = useState(dates[0].isoDate);
```

- [ ] **Step 3: Read travelStartDate/travelEndDate from store**

The hook already reads `const selectedPlaces = state.selectedPlaces;`. Add right after:
```typescript
const travelStartDate = state.travelStartDate;
const travelEndDate   = state.travelEndDate;
```

- [ ] **Step 4: Update startTime computation**

Find:
```typescript
const startTime = useMemo(() => {
  const getDetails = (title: string, lat: number, lon: number) => {
    const placeId = getCachedPlaceIdKey(title, lat, lon);
    if (!placeId) return undefined;
    return getAllCachedDetails().get(placeId);
  };
  return computeRecommendedStartTime(selectedPlaces, getDetails, selectedDate);
}, [selectedPlaces, selectedDate]);
```

Replace with:
```typescript
const startTime = useMemo(() => {
  const getDetails = (title: string, lat: number, lon: number) => {
    const placeId = getCachedPlaceIdKey(title, lat, lon);
    if (!placeId) return undefined;
    return getAllCachedDetails().get(placeId);
  };
  const dateForCalc = travelStartDate ?? new Date().toISOString().split('T')[0];
  return computeRecommendedStartTime(selectedPlaces, getDetails, dateForCalc);
}, [selectedPlaces, travelStartDate]);
```

- [ ] **Step 5: Update handleBuild**

Find the `handleBuild` callback. Replace it entirely:

```typescript
const handleBuild = useCallback((pinDropResult?: { lat: number; lon: number } | null) => {
  const locationLat = pinDropResult?.lat ?? selectedLocation?.lat ?? null;
  const locationLon = pinDropResult?.lon ?? selectedLocation?.lon ?? null;
  const locationName = pinDropResult
    ? 'Custom pin'
    : selectedLocation?.name ?? (locationQuery.trim() || null);

  const totalDays = computeTotalDays(travelStartDate, travelEndDate);
  const days      = totalDays > 0 ? totalDays : 1;
  const startDate = travelStartDate ?? new Date().toISOString().split('T')[0];

  dispatch({ type: 'SET_ITINERARY',      itinerary: null });
  dispatch({ type: 'SET_ITINERARY_DAYS', days: [] });
  dispatch({
    type: 'SET_TRIP_CONTEXT',
    ctx: {
      date:        startDate,
      startType:   startChip === 'pin' ? 'pin' : startChip,
      arrivalTime: startTime,
      days,
      dayNumber:   1,
      locationLat,
      locationLon,
      locationName,
      flightTime:  null,
      isLongHaul:  false,
    },
  });
  dispatch({ type: 'GO_TO', screen: 'route' });
}, [dispatch, travelStartDate, travelEndDate, startChip, startTime, selectedLocation, locationQuery]);
```

- [ ] **Step 6: Update canBuild and return value**

Replace:
```typescript
const canBuild = !!selectedDate;
```
With:
```typescript
const canBuild = selectedPlaces.length >= 1;
```

Update the return object — remove `dates`, `selectedDate`, `setSelectedDate`:
```typescript
return {
  // starting point
  startChip,
  handleChipChange,
  locationQuery,
  locationResults,
  locationLoading,
  selectedLocation,
  handleLocationInput,
  handleSelectLocation,
  // start time
  startTime,
  startTimeDisplay,
  // build
  canBuild,
  handleBuild,
};
```

- [ ] **Step 7: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 85 passed. TypeScript compiler may warn if TripPlanningCard still tries to destructure `dates`/`selectedDate`/`setSelectedDate` — that's fixed in Task 6.

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git add frontend/src/modules/map/useTripPlanInput.ts && git commit -m "feat: useTripPlanInput reads travelStartDate from store, fires multi-day build"
```

---

## Task 6: TripPlanningCard — remove date strip, add trip summary badge

**Files:**
- Modify: `frontend/src/modules/map/TripPlanningCard.tsx`

- [ ] **Step 1: Read TripPlanningCard.tsx**

Read `frontend/src/modules/map/TripPlanningCard.tsx` in full to understand the current structure before editing.

- [ ] **Step 2: Add imports**

At the top of `TripPlanningCard.tsx`, add after the existing imports:
```typescript
import { computeTotalDays } from './trip-capacity-utils';
```

- [ ] **Step 3: Remove dates/selectedDate/setSelectedDate from hook destructuring**

Find the `useTripPlanInput()` destructuring. It currently includes `dates, selectedDate, setSelectedDate`. Remove those three:

```typescript
const {
  startChip, handleChipChange,
  locationQuery, locationResults, locationLoading, selectedLocation,
  handleLocationInput, handleSelectLocation,
  startTimeDisplay,
  canBuild, handleBuild,
} = useTripPlanInput();
```

- [ ] **Step 4: Read travelStartDate/travelEndDate from store and compute totalDays**

After `const placesCount = state.selectedPlaces.length;`, add:

```typescript
const { travelStartDate, travelEndDate } = state;
const totalDays = computeTotalDays(travelStartDate, travelEndDate);
```

And add a local helper function inside the component (before the return):
```typescript
function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}
```

- [ ] **Step 5: Replace header badges**

Find the header section that currently has the "N places selected" pill:
```tsx
<div style={{
  marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 24, padding: '0 10px',
  background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
  borderRadius: 999,
}}>
  <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>place</span>
  <span style={{
    fontSize: 11, fontWeight: 700, color: '#93c5fd',
    fontFamily: 'Inter, sans-serif',
  }}>
    {placesCount} place{placesCount !== 1 ? 's' : ''} selected
  </span>
</div>
```

Replace with two badges side by side:
```tsx
<div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  {/* Date range badge */}
  {travelStartDate && travelEndDate ? (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 24, padding: '0 10px',
      background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
      borderRadius: 999,
    }}>
      <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>calendar_month</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
        {formatDateShort(travelStartDate)} – {formatDateShort(travelEndDate)} · {totalDays} day{totalDays !== 1 ? 's' : ''}
      </span>
    </div>
  ) : (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 24, padding: '0 10px',
      background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`,
      borderRadius: 999,
    }}>
      <span className="ms" style={{ fontSize: 12, color: TEXT3 }}>calendar_month</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: TEXT3, fontFamily: 'Inter, sans-serif' }}>
        Set dates in explore
      </span>
    </div>
  )}
  {/* Places badge */}
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 24, padding: '0 10px',
    background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
    borderRadius: 999,
  }}>
    <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>place</span>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
      {placesCount} place{placesCount !== 1 ? 's' : ''} selected
    </span>
  </div>
</div>
```

- [ ] **Step 6: Remove the entire "Travel date" section**

Find and delete the entire "Travel date" section from the body. It looks like this:
```tsx
{/* Travel date */}
<div>
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
    textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
    fontFamily: 'Inter, sans-serif',
  }}>
    Travel date
  </div>
  <div style={{
    display: 'flex', gap: 6,
    overflowX: 'auto', paddingBottom: 4,
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
  } as React.CSSProperties}>
    {dates.map(d => {
      ...
    })}
  </div>
</div>
```

Delete this entire block (from `{/* Travel date */}` through the closing `</div>`).

- [ ] **Step 7: Update CTA button copy**

Find the CTA button content:
```tsx
<span className="ms" style={{ fontSize: 20 }}>auto_fix</span>
Build my itinerary
```

Replace with:
```tsx
<span className="ms" style={{ fontSize: 20 }}>auto_fix</span>
{totalDays > 1 ? `Build my ${totalDays}-day itinerary` : 'Build my itinerary'}
```

- [ ] **Step 8: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 85 passed. If TypeScript errors remain, check that `dates`, `selectedDate`, `setSelectedDate` are fully removed from the component.

- [ ] **Step 9: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git add frontend/src/modules/map/TripPlanningCard.tsx && git commit -m "feat: TripPlanningCard removes date strip, shows trip summary badge + multi-day CTA"
```

---

## Task 7: useRoute + RouteScreen — multi-day build and rendering

**Files:**
- Modify: `frontend/src/modules/route/useRoute.ts`
- Modify: `frontend/src/modules/route/RouteScreen.tsx`

- [ ] **Step 1: Read both files**

Read `frontend/src/modules/route/useRoute.ts` and `frontend/src/modules/route/RouteScreen.tsx` in full.

- [ ] **Step 2: Update useRoute.ts — add imports**

At the top of `useRoute.ts`, add:
```typescript
import { computeTotalDays, addDaysToIso } from '../map/trip-capacity-utils';
```

- [ ] **Step 3: Replace buildItinerary in useRoute.ts**

Find the `buildItinerary` function and replace it entirely:

```typescript
async function buildItinerary(overridePlaces?: typeof state.selectedPlaces) {
  if (!persona || !state.cityGeo) return;
  setLoading(true);
  setError(null);
  const placesToUse = overridePlaces ?? state.selectedPlaces;

  // Compute trip length from travel dates (falls back to tripContext.days for single-day compat)
  const totalDays = computeTotalDays(state.travelStartDate, state.travelEndDate);
  const days      = totalDays > 0 ? totalDays : (state.tripContext.days ?? 1);
  const startDate = state.travelStartDate ?? state.tripContext.date;

  try {
    const buildDay = async (dayNumber: number) => {
      const travelDate = addDaysToIso(startDate, dayNumber - 1);
      const body: ItineraryRequest = {
        city:               state.city,
        lat:                state.cityGeo!.lat,
        lon:                state.cityGeo!.lon,
        days,
        day_number:         dayNumber,
        pace:               state.persona!.pace ?? 'any',
        persona:            state.persona!.archetype,
        persona_archetype:  state.persona!.archetype_name,
        persona_context:    state.persona!.insight ?? '',
        trip_context: {
          start_type:    state.tripContext.startType,
          arrival_time:  state.tripContext.arrivalTime,
          travel_date:   travelDate,
          total_days:    days,
          flight_time:   state.tripContext.flightTime,
          is_long_haul:  state.tripContext.isLongHaul,
          location_lat:  state.tripContext.locationLat,
          location_lon:  state.tripContext.locationLon,
          location_name: state.tripContext.locationName,
        },
        selected_places: placesToUse.map(p => ({
          id: p.id, title: p.title, lat: p.lat, lon: p.lon,
        })),
      };
      const result = await api.aiItinerary(body);
      if (!result || (result as any).error) {
        throw new Error((result as any)?.error || 'Invalid response from server');
      }
      return result;
    };

    if (days > 1) {
      const allResults = await Promise.all(
        Array.from({ length: days }, (_, i) => buildDay(i + 1))
      );
      dispatch({ type: 'SET_ITINERARY_DAYS', days: allResults });
      dispatch({ type: 'SET_ITINERARY', itinerary: allResults[0] }); // backward compat
    } else {
      const result = await buildDay(1);
      dispatch({ type: 'SET_ITINERARY',      itinerary: result });
      dispatch({ type: 'SET_ITINERARY_DAYS', days: [result] });
    }

    dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) incrementGenerationCount(user.id).catch(console.warn);
    });
  } catch (err) {
    setError('Could not generate your itinerary. Please try again.');
    console.warn('Itinerary error:', err);
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 4: Update useRoute.ts — return itineraryDays**

In the `return` at the bottom of `useRoute`, add `itineraryDays`:
```typescript
return {
  loading,
  error,
  tab,
  setTab,
  itinerary,
  itineraryDays: state.itineraryDays,  // ← ADD
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
```

- [ ] **Step 5: Update RouteScreen.tsx — destructure itineraryDays**

In `RouteScreen`, destructure `itineraryDays` from `useRoute()`:
```typescript
const {
  loading,
  error,
  tab,
  setTab,
  itinerary,
  itineraryDays,   // ← ADD
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

Also add these imports at the top of `RouteScreen.tsx`:
```typescript
import { addDaysToIso } from '../map/trip-capacity-utils';
```

- [ ] **Step 6: Add multi-day rendering to RouteScreen.tsx**

Find the section in RouteScreen that currently says:
```tsx
// Main reel — itinerary exists
if (itinerary) {
  return (
    ...ItineraryCards render...
  );
}
```

**Before** the existing `if (itinerary)` block, add a new multi-day block:

```tsx
// Multi-day view — itineraryDays has >1 day
if (itineraryDays.length > 1) {
  const startIso = state.travelStartDate ?? state.tripContext.date;
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
              {city} · {itineraryDays.length} days
            </div>
          </div>
        </div>

        {/* Day sections */}
        {itineraryDays.map((dayItinerary, dayIdx) => {
          const dayDate = addDaysToIso(startIso, dayIdx);
          const dayLabel = new Date(dayDate + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          });
          return (
            <div key={dayIdx} style={{ padding: '0 16px' }}>
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
                  Day {dayIdx + 1} · {dayLabel}
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }} />
              </div>

              {/* Stop cards */}
              {dayItinerary.itinerary.map((stop, stopIdx) => (
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
            </div>
          );
        })}
      </div>
    </>
  );
}
```

Note: `state` is already available via `const { state } = useAppStore();` which is already at the top of RouteScreen.

- [ ] **Step 7: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 85 passed.

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git add frontend/src/modules/route/useRoute.ts frontend/src/modules/route/RouteScreen.tsx && git commit -m "feat: multi-day build — N parallel itinerary calls + sequential day rendering with dividers"
```

---

## Task 8: Push and verify

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend && npm run test -- --run
```

Expected: 85 passed (0 failures).

- [ ] **Step 2: Check git log**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git log --oneline -8
```

Expected commits (newest first):
```
feat: multi-day build — N parallel itinerary calls + sequential day rendering
feat: TripPlanningCard removes date strip, shows trip summary badge + multi-day CTA
feat: useTripPlanInput reads travelStartDate from store, fires multi-day build
feat: wire TravelDateBar into MapScreen above FilterBar
feat: TravelDateBar — persistent date range bar + DateRangeSheet
feat: trip-capacity-utils — getTripCapacityStatus, computeTotalDays, addDaysToIso
feat: add travelStartDate, travelEndDate, itineraryDays to store
```

- [ ] **Step 3: Push**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre && git push origin feature/google-maplibre
```

Expected: branch pushed, PR #36 updated automatically.

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `travelStartDate`/`travelEndDate` in AppState, sessionStorage-persisted | Task 1 |
| `SET_TRAVEL_DATES`, `SET_ITINERARY_DAYS` actions | Task 1 |
| `getTripCapacityStatus`, `computeTotalDays`, `addDaysToIso` | Task 2 |
| `TravelDateBar` bar (unset/set/indicator) | Task 3 |
| `DateRangeSheet` two date pill strips | Task 3 |
| TravelDateBar wired above FilterBar | Task 4 |
| Remove `dates`/`selectedDate`/`setSelectedDate` from useTripPlanInput | Task 5 |
| `handleBuild` sets `days: totalDays` | Task 5 |
| Remove date strip from TripPlanningCard | Task 6 |
| Trip summary badge (dates + places) | Task 6 |
| Multi-day CTA copy | Task 6 |
| `buildItinerary` fires N parallel calls | Task 7 |
| `itineraryDays` rendered with day dividers | Task 7 |
| Backward compat: single-day still renders `ItineraryCards` | Task 7 |

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:** `computeTotalDays` imported from `trip-capacity-utils` in Tasks 5, 6, 7. `addDaysToIso` imported in Tasks 7 only. `SET_ITINERARY_DAYS` action uses `days: Itinerary[]` consistently across store (Task 1), hook (Task 5), and useRoute (Task 7). `SET_TRAVEL_DATES` uses `startDate`/`endDate` consistently.
