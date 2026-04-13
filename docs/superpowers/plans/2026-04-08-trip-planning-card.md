# Trip Planning Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TripSheet bottom sheet with a cinematic floating modal where the user picks a starting point and date, and the app recommends the start time based on the opening hours of selected places.

**Architecture:** A pure utility module (`trip-utils.ts`) handles date strip generation and start time computation. A hook (`useTripPlanInput.ts`) manages all modal state and builds the store dispatch. The modal component (`TripPlanningCard.tsx`) is UI-only. `usePlaceDetails.ts` gains two exported cache accessors so `useTripPlanInput` can read cached opening hours without prop-drilling. `TripSheet.tsx` is deleted. `MapScreen.tsx` is updated to swap in the new component.

**Tech Stack:** React 19, TypeScript, Vitest (installed in the PinCard plan — run that first if tests aren't set up yet)

---

## File Map

| File | Action |
|---|---|
| `frontend/src/modules/map/usePlaceDetails.ts` | Export `getAllCachedDetails()` and `getCachedPlaceIdKey()` |
| `frontend/src/modules/map/trip-utils.ts` | New: `generateDateStrip`, `computeRecommendedStartTime`, `formatTimeDisplay` |
| `frontend/src/modules/map/trip-utils.test.ts` | New: unit tests for utilities |
| `frontend/src/modules/map/useTripPlanInput.ts` | New: hook for all modal state |
| `frontend/src/modules/map/TripPlanningCard.tsx` | New: cinematic modal component |
| `frontend/src/modules/map/MapScreen.tsx` | Swap TripSheet → TripPlanningCard |
| `frontend/src/modules/map/TripSheet.tsx` | Delete |

> All paths are relative to `.worktrees/google-maplibre/`. Work on the `feature/google-maplibre` branch.

---

### Task 1: Cache accessors + trip utilities + tests

**Files:**
- Modify: `frontend/src/modules/map/usePlaceDetails.ts`
- Create: `frontend/src/modules/map/trip-utils.ts`
- Create: `frontend/src/modules/map/trip-utils.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `frontend/src/modules/map/trip-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  generateDateStrip,
  computeRecommendedStartTime,
  formatTimeDisplay,
} from './trip-utils';
import type { Place } from '../../shared/types';
import type { PlaceDetails } from '../../shared/types';

const BASE_PLACE: Place = {
  id: 'p1', title: 'Test Place', category: 'restaurant', lat: 12.9, lon: 77.6,
};

const DETAILS_9AM: PlaceDetails = {
  place_id: 'g1', name: 'Test Place', address: '...', lat: 12.9, lon: 77.6,
  weekday_text: [
    'Monday: 9:00 AM – 11:00 PM',
    'Tuesday: 9:00 AM – 11:00 PM',
    'Wednesday: 9:00 AM – 11:00 PM',
    'Thursday: 9:00 AM – 11:00 PM',
    'Friday: 9:00 AM – 12:00 AM',
    'Saturday: 9:00 AM – 12:00 AM',
    'Sunday: 11:00 AM – 10:00 PM',
  ],
};

const DETAILS_7AM: PlaceDetails = {
  ...DETAILS_9AM,
  place_id: 'g2',
  weekday_text: DETAILS_9AM.weekday_text!.map(l => l.replace('9:00 AM', '7:00 AM').replace('11:00 AM', '7:00 AM')),
};

const DETAILS_11AM: PlaceDetails = {
  ...DETAILS_9AM,
  place_id: 'g3',
  weekday_text: DETAILS_9AM.weekday_text!.map(l => l.replace('9:00 AM', '11:00 AM')),
};

describe('generateDateStrip', () => {
  it('returns 7 entries by default', () => {
    expect(generateDateStrip()).toHaveLength(7);
  });

  it('first entry is today in ISO format', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(generateDateStrip()[0].isoDate).toBe(today);
  });

  it('each entry has isoDate, dayAbbr, and dayNum', () => {
    const strip = generateDateStrip(1);
    expect(strip[0]).toHaveProperty('isoDate');
    expect(strip[0]).toHaveProperty('dayAbbr');
    expect(strip[0]).toHaveProperty('dayNum');
  });
});

describe('computeRecommendedStartTime', () => {
  // Use a Monday as the date so index is predictable (Google index 0 = Monday)
  // Find the next Monday
  function nextMonday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 1 ? 0 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  const monday = nextMonday();

  it('returns default 09:00 when no places have details', () => {
    const result = computeRecommendedStartTime([BASE_PLACE], () => undefined, monday);
    expect(result).toBe('09:00');
  });

  it('returns earliest opening time across places', () => {
    const place2 = { ...BASE_PLACE, id: 'p2', title: 'P2' };
    const result = computeRecommendedStartTime(
      [BASE_PLACE, place2],
      p => {
        if (p === BASE_PLACE.title) return DETAILS_11AM;
        if (p === place2.title) return DETAILS_9AM;
        return undefined;
      },
      monday,
    );
    expect(result).toBe('09:00');
  });

  it('floors to 08:00 when earliest is before 8 AM', () => {
    const result = computeRecommendedStartTime(
      [BASE_PLACE],
      () => DETAILS_7AM,
      monday,
    );
    expect(result).toBe('08:00');
  });
});

describe('formatTimeDisplay', () => {
  it('converts 09:00 to 9:00 AM', () => {
    expect(formatTimeDisplay('09:00')).toBe('9:00 AM');
  });

  it('converts 13:30 to 1:30 PM', () => {
    expect(formatTimeDisplay('13:30')).toBe('1:30 PM');
  });

  it('converts 12:00 to 12:00 PM', () => {
    expect(formatTimeDisplay('12:00')).toBe('12:00 PM');
  });

  it('converts 00:00 to 12:00 AM', () => {
    expect(formatTimeDisplay('00:00')).toBe('12:00 AM');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd .worktrees/google-maplibre/frontend
npm test
```

Expected: FAIL — `trip-utils` module not found.

- [ ] **Step 3: Create `trip-utils.ts`**

Create `frontend/src/modules/map/trip-utils.ts`:

```ts
import type { Place, PlaceDetails } from '../../shared/types';

export interface DateEntry {
  isoDate: string;   // "YYYY-MM-DD"
  dayAbbr: string;   // "Mon"
  dayNum: number;    // 14
}

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Generate a strip of `count` consecutive days starting from today. */
export function generateDateStrip(count = 7): DateEntry[] {
  const result: DateEntry[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    result.push({
      isoDate: d.toISOString().slice(0, 10),
      dayAbbr: DAY_ABBRS[d.getDay()],
      dayNum: d.getDate(),
    });
  }
  return result;
}

/**
 * Parse the opening time (minutes since midnight) from a weekday_text line.
 * Google's weekday_text format: "Monday: 9:00 AM – 11:00 PM"
 * Returns null if the line is "Closed" or unparseable.
 */
function parseOpeningMinutes(weekdayText: string[], jsDay: number): number | null {
  // Google weekday_text: Mon=0, Tue=1, ..., Sun=6
  const googleDay = jsDay === 0 ? 6 : jsDay - 1;
  const line = weekdayText[googleDay];
  if (!line) return null;
  const match = line.match(/:\s*(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
}

/**
 * Compute the app-recommended start time from the selected places' opening hours.
 * - Finds the earliest opening hour across all places on the selected date.
 * - Defaults to 9:00 AM if no opening hour data is available.
 * - Floors at 8:00 AM (won't suggest earlier).
 * - Rounds to the nearest 30 minutes.
 * Returns "HH:MM" in 24-hour format.
 */
export function computeRecommendedStartTime(
  selectedPlaces: Place[],
  getDetails: (title: string, lat: number, lon: number) => PlaceDetails | undefined,
  isoDate: string,
): string {
  const jsDay = new Date(isoDate + 'T12:00:00').getDay();
  let earliestMin = Infinity;

  for (const place of selectedPlaces) {
    const d = getDetails(place.title, place.lat, place.lon);
    if (!d?.weekday_text) continue;
    const openMin = parseOpeningMinutes(d.weekday_text, jsDay);
    if (openMin !== null && openMin < earliestMin) {
      earliestMin = openMin;
    }
  }

  if (!isFinite(earliestMin)) earliestMin = 9 * 60; // default 9:00 AM
  if (earliestMin < 8 * 60) earliestMin = 8 * 60;   // floor at 8:00 AM
  earliestMin = Math.round(earliestMin / 30) * 30;   // round to 30 min

  const h = Math.floor(earliestMin / 60);
  const m = earliestMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Convert "HH:MM" (24h) to "9:30 AM" display format. */
export function formatTimeDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd .worktrees/google-maplibre/frontend
npm test
```

Expected:

```
✓ generateDateStrip > returns 7 entries by default
✓ generateDateStrip > first entry is today in ISO format
✓ generateDateStrip > each entry has isoDate, dayAbbr, and dayNum
✓ computeRecommendedStartTime > returns default 09:00 when no places have details
✓ computeRecommendedStartTime > returns earliest opening time across places
✓ computeRecommendedStartTime > floors to 08:00 when earliest is before 8 AM
✓ formatTimeDisplay > converts 09:00 to 9:00 AM
✓ formatTimeDisplay > converts 13:30 to 1:30 PM
✓ formatTimeDisplay > converts 12:00 to 12:00 PM
✓ formatTimeDisplay > converts 00:00 to 12:00 AM
10 tests passed (plus 11 from pincard-utils if run together)
```

- [ ] **Step 5: Export cache accessors from `usePlaceDetails.ts`**

Open `frontend/src/modules/map/usePlaceDetails.ts`. The file has two module-level constants:

```ts
const detailsCache = new Map<string, PlaceDetails>();
const placeIdCache = new Map<string, string>();
```

Add these two exported functions immediately after those two `const` declarations:

```ts
/** Returns the full details cache (read-only intent). Used by useTripPlanInput. */
export function getAllCachedDetails(): ReadonlyMap<string, PlaceDetails> {
  return detailsCache;
}

/** Returns the cached Google place_id for a given place, if resolved. */
export function getCachedPlaceIdKey(name: string, lat: number, lon: number): string | undefined {
  return placeIdCache.get(`${name}:${lat}:${lon}`);
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd .worktrees/google-maplibre/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/map/usePlaceDetails.ts \
        frontend/src/modules/map/trip-utils.ts \
        frontend/src/modules/map/trip-utils.test.ts
git commit -m "feat(frontend): trip-utils and usePlaceDetails cache accessors"
```

---

### Task 2: `useTripPlanInput` hook

**Files:**
- Create: `frontend/src/modules/map/useTripPlanInput.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/src/modules/map/useTripPlanInput.ts`:

```ts
import { useState, useCallback, useRef, useMemo } from 'react';
import { placesAutocomplete, geocodePlace } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import type { AutocompleteResult } from '../../shared/types';
import { getAllCachedDetails, getCachedPlaceIdKey } from './usePlaceDetails';
import {
  computeRecommendedStartTime,
  formatTimeDisplay,
  generateDateStrip,
} from './trip-utils';

export type StartChip = 'hotel' | 'airport' | 'pin';

// Google Places types filter per chip
const CHIP_PLACE_TYPES: Record<StartChip, string | undefined> = {
  hotel:   'lodging',
  airport: 'airport',
  pin:     undefined,
};

function newSessionId() {
  return Math.random().toString(36).slice(2);
}

export function useTripPlanInput() {
  const { state, dispatch } = useAppStore();
  const selectedPlaces = state.selectedPlaces;

  // ── Date strip ─────────────────────────────────────────────────
  const dates = useMemo(() => generateDateStrip(7), []);
  const [selectedDate, setSelectedDate] = useState(dates[0].isoDate);

  // ── Starting point ─────────────────────────────────────────────
  const [startChip, setStartChip] = useState<StartChip>('hotel');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<AutocompleteResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string; lat: number; lon: number;
  } | null>(null);
  const sessionIdRef = useRef(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Recommended start time ──────────────────────────────────────
  const startTime = useMemo(() => {
    const getDetails = (title: string, lat: number, lon: number) => {
      const placeId = getCachedPlaceIdKey(title, lat, lon);
      if (!placeId) return undefined;
      return getAllCachedDetails().get(placeId);
    };
    return computeRecommendedStartTime(selectedPlaces, getDetails, selectedDate);
  }, [selectedPlaces, selectedDate]);

  const startTimeDisplay = formatTimeDisplay(startTime);

  // ── Handlers ────────────────────────────────────────────────────
  const handleLocationInput = useCallback((query: string) => {
    setLocationQuery(query);
    setSelectedLocation(null);
    setLocationResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const types = CHIP_PLACE_TYPES[startChip];
        const results = await placesAutocomplete(query, sessionIdRef.current, types);
        setLocationResults(results);
      } finally {
        setLocationLoading(false);
      }
    }, 300);
  }, [startChip]);

  const handleSelectLocation = useCallback(async (result: AutocompleteResult) => {
    const geo = await geocodePlace(result.place_id, sessionIdRef.current);
    sessionIdRef.current = newSessionId(); // new session after selection (billing event)
    setLocationResults([]);
    if (geo) {
      setLocationQuery(geo.name);
      setSelectedLocation({ name: geo.name, lat: geo.lat, lon: geo.lon });
    }
  }, []);

  const handleChipChange = useCallback((chip: StartChip) => {
    setStartChip(chip);
    setLocationQuery('');
    setSelectedLocation(null);
    setLocationResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    sessionIdRef.current = newSessionId();
  }, []);

  const canBuild = !!selectedDate;

  const handleBuild = useCallback((pinDropResult?: { lat: number; lon: number } | null) => {
    const locationLat = pinDropResult?.lat ?? selectedLocation?.lat ?? null;
    const locationLon = pinDropResult?.lon ?? selectedLocation?.lon ?? null;
    const locationName = pinDropResult
      ? 'Custom pin'
      : selectedLocation?.name ?? (locationQuery.trim() || null);

    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date:        selectedDate,
        startType:   startChip === 'pin' ? 'pin' : startChip,
        arrivalTime: startTime, // app-recommended start time
        days:        1,
        dayNumber:   1,
        locationLat,
        locationLon,
        locationName,
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }, [dispatch, selectedDate, startChip, startTime, selectedLocation, locationQuery]);

  return {
    // date strip
    dates,
    selectedDate,
    setSelectedDate,
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
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd .worktrees/google-maplibre/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/useTripPlanInput.ts
git commit -m "feat(frontend): useTripPlanInput hook for trip planning card"
```

---

### Task 3: `TripPlanningCard` component

**Files:**
- Create: `frontend/src/modules/map/TripPlanningCard.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/modules/map/TripPlanningCard.tsx`:

```tsx
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { useTripPlanInput } from './useTripPlanInput';
import type { StartChip } from './useTripPlanInput';

interface Props {
  onClose: () => void;
  onRequestPinDrop: () => void;
  pinDropResult: { lat: number; lon: number } | null;
  onClearPin: () => void;
}

const CHIPS: Array<{ value: StartChip; icon: string; label: string }> = [
  { value: 'hotel',   icon: '🏨', label: 'Hotel'   },
  { value: 'airport', icon: '✈',  label: 'Airport' },
  { value: 'pin',     icon: '📍', label: 'Pin'     },
];

export function TripPlanningCard({ onClose, onRequestPinDrop, pinDropResult, onClearPin }: Props) {
  const { state } = useAppStore();
  const city = state.city;
  const placesCount = state.selectedPlaces.length;

  const {
    dates, selectedDate, setSelectedDate,
    startChip, handleChipChange,
    locationQuery, locationResults, locationLoading, selectedLocation,
    handleLocationInput, handleSelectLocation,
    startTimeDisplay,
    canBuild, handleBuild,
  } = useTripPlanInput();

  function handlePinChip() {
    handleChipChange('pin');
    onRequestPinDrop();
    onClose();
  }

  function handleClearPin() {
    onClearPin();
    handleChipChange('hotel');
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '8%',
          left: '16px',
          right: '16px',
          zIndex: 51,
          background: 'linear-gradient(160deg, rgba(30,20,60,.95), rgba(10,18,30,.98))',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,.8)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Cinematic header ─────────────────────────── */}
        <div style={{ height: 90, position: 'relative', overflow: 'hidden' }}>
          {/* Gradient backdrop (no city image in state — dark gradient fallback) */}
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #0d1f35, #1a0d35, #0d1f1a)',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, transparent, rgba(20,14,50,.95))',
            }}
          />
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.1)',
              borderRadius: '50%', width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#999', fontSize: 14, cursor: 'pointer',
            }}
          >
            ✕
          </button>
          {/* Place count */}
          <div
            style={{
              position: 'absolute', top: 13, right: 48,
              fontSize: 10, color: 'rgba(255,255,255,.3)',
            }}
          >
            {placesCount} place{placesCount !== 1 ? 's' : ''}
          </div>
          {/* City name */}
          <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
            <div
              style={{
                fontSize: 10, color: 'rgba(255,255,255,.5)',
                textTransform: 'uppercase', letterSpacing: 2,
              }}
            >
              Your day in
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{city}</div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────── */}
        <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Starting point */}
          <div>
            <div
              style={{
                fontSize: 8, color: 'rgba(255,255,255,.35)',
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
              }}
            >
              Starting point
            </div>

            {/* Chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {CHIPS.map(chip => {
                const active = startChip === chip.value || (chip.value === 'pin' && !!pinDropResult);
                return (
                  <button
                    key={chip.value}
                    onClick={() => {
                      if (chip.value === 'pin') { handlePinChip(); return; }
                      handleChipChange(chip.value);
                    }}
                    style={{
                      flex: 1, padding: '6px 0',
                      background: active ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.05)',
                      border: active
                        ? '1px solid rgba(99,102,241,.4)'
                        : '1px solid rgba(255,255,255,.08)',
                      borderRadius: 20, fontSize: 9,
                      color: active ? '#a5b4fc' : 'rgba(255,255,255,.4)',
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {chip.icon} {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Pin drop confirmation */}
            {pinDropResult ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(20,184,166,.1)', border: '1px solid rgba(20,184,166,.3)', borderRadius: 11 }}>
                <span style={{ fontSize: 10, color: '#2dd4bf' }}>📍</span>
                <span style={{ fontSize: 10, color: '#5eead4', flex: 1 }}>
                  {pinDropResult.lat.toFixed(4)}, {pinDropResult.lon.toFixed(4)}
                </span>
                <button
                  onClick={handleClearPin}
                  style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear
                </button>
              </div>
            ) : startChip !== 'pin' && (
              /* Hotel/Airport search input */
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 11, padding: '9px 12px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {startChip === 'hotel' ? '🏨' : '✈'}
                  </span>
                  <input
                    type="text"
                    value={locationQuery}
                    onChange={e => handleLocationInput(e.target.value)}
                    placeholder={startChip === 'hotel' ? 'Search hotel or address…' : 'Search airport…'}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      fontSize: 11, color: 'rgba(255,255,255,.8)',
                      '::placeholder': { color: 'rgba(255,255,255,.3)' },
                    } as React.CSSProperties}
                  />
                  {locationLoading && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>⋯</span>
                  )}
                  {selectedLocation && !locationLoading && (
                    <span style={{ fontSize: 10, color: '#22c55e', flexShrink: 0 }}>✓</span>
                  )}
                </div>

                {locationResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                      background: 'rgba(10,14,24,.97)',
                      border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 11, overflow: 'hidden', zIndex: 10,
                    }}
                  >
                    {locationResults.map((r, i) => (
                      <button
                        key={r.place_id}
                        onMouseDown={() => handleSelectLocation(r)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 12px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                          {r.main_text}
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                          {r.secondary_text}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Travel date strip */}
          <div>
            <div
              style={{
                fontSize: 8, color: 'rgba(255,255,255,.35)',
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
              }}
            >
              Travel date
            </div>
            <div
              style={{
                display: 'flex', gap: 5,
                overflowX: 'auto', paddingBottom: 4,
                scrollbarWidth: 'none',
              }}
            >
              {dates.map(d => {
                const active = d.isoDate === selectedDate;
                return (
                  <button
                    key={d.isoDate}
                    onClick={() => setSelectedDate(d.isoDate)}
                    style={{
                      flexShrink: 0, width: 44, padding: '7px 4px',
                      background: active ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.04)',
                      border: active
                        ? '1px solid rgba(99,102,241,.5)'
                        : '1px solid rgba(255,255,255,.07)',
                      borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 8, color: active ? '#a5b4fc' : 'rgba(255,255,255,.3)' }}>
                      {d.dayAbbr}
                    </div>
                    <div
                      style={{
                        fontSize: 13, marginTop: 2,
                        fontWeight: active ? 800 : 700,
                        color: active ? '#fff' : 'rgba(255,255,255,.4)',
                      }}
                    >
                      {d.dayNum}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recommended start time */}
          <div
            style={{
              background: 'rgba(99,102,241,.1)',
              border: '1px solid rgba(99,102,241,.25)',
              borderRadius: 11, padding: '9px 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 8, color: '#818cf8',
                  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
                }}
              >
                ⚡ Recommended start
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c7d2fe' }}>
                {startTimeDisplay}
              </div>
            </div>
            <div
              style={{
                fontSize: 9, color: 'rgba(255,255,255,.3)',
                textAlign: 'right', lineHeight: 1.5,
              }}
            >
              Based on {placesCount} place{placesCount !== 1 ? 's' : ''}<br />
              + opening hours
            </div>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────── */}
        <div style={{ padding: 14 }}>
          <button
            onClick={() => handleBuild(pinDropResult)}
            disabled={!canBuild}
            style={{
              width: '100%',
              background: canBuild
                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                : 'rgba(255,255,255,.08)',
              borderRadius: 14, padding: 12,
              fontSize: 12, fontWeight: 800,
              color: canBuild ? '#fff' : 'rgba(255,255,255,.3)',
              letterSpacing: 0.3, border: 'none', cursor: canBuild ? 'pointer' : 'default',
            }}
          >
            Build my itinerary ✦
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd .worktrees/google-maplibre/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/TripPlanningCard.tsx
git commit -m "feat(frontend): TripPlanningCard cinematic modal component"
```

---

### Task 4: Wire into MapScreen, remove TripSheet

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`
- Delete: `frontend/src/modules/map/TripSheet.tsx`

- [ ] **Step 1: Update MapScreen.tsx imports**

Open `frontend/src/modules/map/MapScreen.tsx`.

Find this import line:
```ts
import { TripSheet } from './TripSheet';
```

Replace it with:
```ts
import { TripPlanningCard } from './TripPlanningCard';
```

- [ ] **Step 2: Replace TripSheet usage in the JSX**

In `MapScreen.tsx`, find this block near the bottom of the return statement:

```tsx
{showTripSheet && (
  <TripSheet
    onClose={() => setShowTripSheet(false)}
    onRequestPinDrop={() => { setAwaitingPinDrop(true); }}
    onClearPin={() => setPinDropResult(null)}
    pinDropResult={pinDropResult}
    cityGeo={cityGeo}
  />
)}
```

Replace it with:

```tsx
{showTripSheet && (
  <TripPlanningCard
    onClose={() => setShowTripSheet(false)}
    onRequestPinDrop={() => { setAwaitingPinDrop(true); }}
    onClearPin={() => setPinDropResult(null)}
    pinDropResult={pinDropResult}
  />
)}
```

- [ ] **Step 3: TypeScript check**

```bash
cd .worktrees/google-maplibre/frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass (no new tests for this task — MapScreen changes are wiring only).

- [ ] **Step 5: Visual check**

Start the dev server:
```bash
npm run dev
```

1. Navigate to the map, select 2+ places
2. Tap "Build Itinerary" button in the bottom bar
3. Verify the new cinematic modal appears (dark gradient header, city name, place count)
4. Verify the date strip shows 7 days, today highlighted in indigo
5. Verify "⚡ Recommended start" shows a sensible time (9:00 AM if no cached details; real time if places have been tapped and details loaded)
6. Tap Hotel / Airport chips — verify the search input appears and autocomplete works
7. Tap Pin chip — verify the modal closes and the pin-drop instruction strip appears on the map
8. After dropping a pin, reopen the modal — verify pin coordinates are shown with a Clear button
9. Select a date and tap "Build my itinerary ✦" — verify it navigates to the route/itinerary screen

- [ ] **Step 6: Delete TripSheet.tsx**

```bash
git rm frontend/src/modules/map/TripSheet.tsx
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat(frontend): replace TripSheet with TripPlanningCard, remove TripSheet"
```
