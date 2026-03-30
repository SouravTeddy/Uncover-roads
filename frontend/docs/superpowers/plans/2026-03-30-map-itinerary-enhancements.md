# Map & Itinerary Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persona-aware "Our Picks" on the map, a trip context bottom sheet before itinerary generation, enriched itinerary display with meal-gap detection, and a CSS weather animation on the itinerary screen.

**Architecture:** All changes are purely frontend React components. "Our Picks" calls a new `/recommended-places` API with a client-side fallback. Trip context is collected in a new bottom-sheet overlay on MapScreen. Itinerary enrichment and weather animation are isolated new components dropped into existing screens.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4 (CSS-first `@theme {}`), react-leaflet, Vite. No test framework — use `npm run build` to verify each task.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `src/shared/types.ts` | Add `reason?: string` to `Place` |
| Modify | `src/shared/api.ts` | Add `api.recommended()` |
| Modify | `src/modules/map/useMap.ts` | Add recommended places logic |
| Modify | `src/modules/map/PinCard.tsx` | Show `place.reason` |
| Create | `src/modules/map/TripSheet.tsx` | Bottom-sheet trip context form |
| Modify | `src/modules/map/MapScreen.tsx` | Wire TripSheet |
| Modify | `src/modules/route/ItineraryView.tsx` | Styled tips + meal gap cards |
| Modify | `src/modules/route/RouteScreen.tsx` | Pass `selectedPlaces`, use WeatherCanvas |
| Create | `src/modules/route/WeatherCanvas.tsx` | CSS weather animation |
| Modify | `src/index.css` | Weather keyframe animations |

---

## Task 1: Extend Place type and add `api.recommended`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/api.ts`

- [ ] **Step 1: Add `reason` to Place in types.ts**

Open `src/shared/types.ts`. Find the `Place` interface and add the optional field:

```ts
export interface Place {
  id: string;
  title: string;
  category: Category;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  imageUrl?: string | null;
  reason?: string;          // AI-generated reason this place matches the persona
}
```

- [ ] **Step 2: Add `api.recommended` to api.ts**

Open `src/shared/api.ts`. Add to the `api` object after `mapData`:

```ts
recommended: (city: string, persona: Persona) =>
  get<Place[]>(
    `/recommended-places?city=${encodeURIComponent(city)}&persona=${encodeURIComponent(JSON.stringify(persona))}`
  ),
```

Also add `Persona` to the existing import at the top if not already present (it should already be imported via `type { ... } from './types'` — verify and add if missing).

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built in ...ms` — no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/shared/types.ts frontend/src/shared/api.ts
git commit -m "feat: add Place.reason and api.recommended"
```

---

## Task 2: "Our Picks" logic in useMap

**Files:**
- Modify: `src/modules/map/useMap.ts`

- [ ] **Step 1: Replace useMap.ts with the updated version**

Replace the entire file content of `src/modules/map/useMap.ts`:

```ts
import { useEffect, useState } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import type { Place, MapFilter } from '../../shared/types';

export function useMap() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const [recommendedPlaces, setRecommendedPlaces] = useState<Place[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const { city, places, selectedPlaces, activeFilter, cityGeo, persona } = state;

  useEffect(() => {
    if (city && places.length === 0) {
      loadPlaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  useEffect(() => {
    if (activeFilter === 'recommended' && recommendedPlaces.length === 0 && city && persona) {
      loadRecommended();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  async function loadPlaces() {
    setLoading(true);
    setError(false);
    try {
      const data = await api.mapData(city);
      const raw: Place[] = Array.isArray(data) ? data : [];
      const withIds = raw.map((p, i) => ({ ...p, id: p.id ?? `${p.title}-${i}` }));
      dispatch({ type: 'SET_PLACES', places: withIds });
      if (withIds.length === 0) setError(true);
    } catch (e) {
      console.error('[useMap] loadPlaces failed:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecommended() {
    if (!persona) return;
    setRecLoading(true);
    try {
      const data = await api.recommended(city, persona);
      const withIds = (Array.isArray(data) ? data : []).map((p, i) => ({
        ...p,
        id: p.id ?? `${p.title}-${i}`,
      }));
      setRecommendedPlaces(withIds.length > 0 ? withIds : clientSideFallback());
    } catch {
      setRecommendedPlaces(clientSideFallback());
    } finally {
      setRecLoading(false);
    }
  }

  // Fallback: filter loaded places by persona.venue_filters categories + add a generic reason
  function clientSideFallback(): Place[] {
    if (!persona) return [];
    const filters = new Set(persona.venue_filters ?? []);
    return places
      .filter(p => filters.has(p.category))
      .map(p => ({
        ...p,
        reason: `Matches your interest in ${p.category}`,
      }));
  }

  const filteredPlaces: Place[] =
    activeFilter === 'recommended'
      ? recommendedPlaces
      : activeFilter === 'all'
      ? places
      : places.filter(p => p.category === (activeFilter as string));

  function togglePlace(place: Place) {
    dispatch({ type: 'TOGGLE_PLACE', place });
  }

  function setFilter(f: MapFilter) {
    dispatch({ type: 'SET_FILTER', filter: f });
  }

  function goToRoute() {
    dispatch({ type: 'GO_TO', screen: 'route' });
  }

  function goBack() {
    dispatch({ type: 'GO_TO', screen: 'destination' });
  }

  return {
    city,
    cityGeo,
    places,
    filteredPlaces,
    selectedPlaces,
    activeFilter,
    loading: loading || recLoading,
    error,
    loadPlaces,
    activePlace,
    setActivePlace,
    togglePlace,
    setFilter,
    goToRoute,
    goBack,
  };
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built` — no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/modules/map/useMap.ts
git commit -m "feat: add Our Picks recommended places logic with fallback"
```

---

## Task 3: Show `place.reason` in PinCard

**Files:**
- Modify: `src/modules/map/PinCard.tsx`

- [ ] **Step 1: Add reason display to PinCard**

Open `src/modules/map/PinCard.tsx`. After the `<div className="font-heading font-bold ...">` title line and before the `{/* Actions */}` comment, add:

```tsx
{place.reason && (
  <div className="flex items-start gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
    <span className="ms text-primary text-sm flex-shrink-0">auto_awesome</span>
    <span className="text-primary text-xs leading-relaxed">{place.reason}</span>
  </div>
)}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/modules/map/PinCard.tsx
git commit -m "feat: show AI reason in PinCard for recommended places"
```

---

## Task 4: Create TripSheet bottom-sheet component

**Files:**
- Create: `src/modules/map/TripSheet.tsx`

- [ ] **Step 1: Create TripSheet.tsx**

Create `src/modules/map/TripSheet.tsx` with the full content:

```tsx
import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import type { StartType } from '../../shared/types';

interface Props {
  onClose: () => void;
}

const START_TYPES: { value: StartType; icon: string; label: string }[] = [
  { value: 'hotel',   icon: 'hotel',      label: 'Hotel' },
  { value: 'airport', icon: 'flight',     label: 'Airport' },
  { value: 'station', icon: 'train',      label: 'Station' },
  { value: 'airbnb',  icon: 'cottage',    label: 'Airbnb' },
];

export function TripSheet({ onClose }: Props) {
  const { state, dispatch } = useAppStore();
  const ctx = state.tripContext;

  const [date, setDate] = useState(ctx.date);
  const [startType, setStartType] = useState<StartType>(ctx.startType);
  const [arrivalTime, setArrivalTime] = useState(ctx.arrivalTime ?? '');
  const [days, setDays] = useState(ctx.days);
  const [dayNumber, setDayNumber] = useState(ctx.dayNumber);

  const needsArrival = startType === 'airport' || startType === 'station';
  const canGenerate = date && startType;

  function handleGenerate() {
    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date,
        startType,
        arrivalTime: needsArrival && arrivalTime ? arrivalTime : null,
        days,
        dayNumber: Math.min(dayNumber, days),
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 25, background: 'rgba(0,0,0,.5)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-surface flex flex-col"
        style={{
          zIndex: 26,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
          maxHeight: '85dvh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="overflow-y-auto px-5 pb-2">
          <h2 className="font-heading font-bold text-text-1 text-lg mb-1">Trip details</h2>
          <p className="text-text-3 text-sm mb-5">Help us build the perfect itinerary for you</p>

          {/* Travel date */}
          <label className="block mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Travel date
            </span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
              style={{ colorScheme: 'dark' }}
            />
          </label>

          {/* Starting point */}
          <div className="mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Starting from
            </span>
            <div className="grid grid-cols-4 gap-2">
              {START_TYPES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStartType(s.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${
                    startType === s.value
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-bg border-white/10 text-text-3'
                  }`}
                >
                  <span className="ms text-xl">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Arrival time — only for airport / station */}
          {needsArrival && (
            <label className="block mb-4">
              <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                Arrival time
              </span>
              <input
                type="time"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
                className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
                style={{ colorScheme: 'dark' }}
              />
            </label>
          )}

          {/* Days */}
          <div className="mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Trip length
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDays(d => Math.max(1, d - 1))}
                className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
              >−</button>
              <span className="text-text-1 font-semibold text-sm flex-1 text-center">
                {days} {days === 1 ? 'day' : 'days'}
              </span>
              <button
                onClick={() => setDays(d => Math.min(14, d + 1))}
                className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
              >+</button>
            </div>
          </div>

          {/* Day number */}
          {days > 1 && (
            <div className="mb-4">
              <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                Planning for day
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDayNumber(d => Math.max(1, d - 1))}
                  className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                >−</button>
                <span className="text-text-1 font-semibold text-sm flex-1 text-center">
                  Day {Math.min(dayNumber, days)} of {days}
                </span>
                <button
                  onClick={() => setDayNumber(d => Math.min(days, d + 1))}
                  className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <div className="px-5 pt-3 flex-shrink-0">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-14 rounded-2xl bg-orange font-heading font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span className="ms fill text-base">auto_fix</span>
            Generate Itinerary
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Export from map index**

Open `src/modules/map/index.ts` and add the export:

```ts
export { TripSheet } from './TripSheet';
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/modules/map/TripSheet.tsx frontend/src/modules/map/index.ts
git commit -m "feat: add TripSheet bottom-sheet component"
```

---

## Task 5: Wire TripSheet into MapScreen

**Files:**
- Modify: `src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add TripSheet import and showTripSheet state**

Open `src/modules/map/MapScreen.tsx`.

Add `useState` to the React import if not already present (it should already be there from `useCallback, useEffect, useMemo, useRef`). Change the first import line to:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Add the TripSheet import after the existing local imports:

```tsx
import { TripSheet } from './TripSheet';
```

- [ ] **Step 2: Add showTripSheet state inside MapScreen**

Inside the `MapScreen` function, after the `useMap()` destructuring, add:

```tsx
const [showTripSheet, setShowTripSheet] = useState(false);
```

- [ ] **Step 3: Replace the CTA button to open TripSheet instead of going directly to route**

Find the "Create Itinerary CTA" section:

```tsx
{selectedPlaces.length >= 2 && (
  <div
    className="absolute inset-x-4 flex gap-3"
    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', zIndex: 20 }}
  >
    <button
      onClick={goToRoute}
      className="flex-1 h-14 rounded-2xl bg-orange font-heading font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg"
    >
      <span className="ms fill text-base">auto_fix</span>
      Create Itinerary ({selectedPlaces.length})
    </button>
  </div>
)}
```

Replace `onClick={goToRoute}` with `onClick={() => setShowTripSheet(true)}`.

- [ ] **Step 4: Render TripSheet at the bottom of MapScreen's return**

Just before the closing `</div>` of the MapScreen return, add:

```tsx
{showTripSheet && <TripSheet onClose={() => setShowTripSheet(false)} />}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: wire TripSheet into MapScreen CTA"
```

---

## Task 6: Enrich ItineraryView — styled tips + meal gap detection

**Files:**
- Modify: `src/modules/route/ItineraryView.tsx`
- Modify: `src/modules/route/RouteScreen.tsx` (pass selectedPlaces)

- [ ] **Step 1: Replace ItineraryView.tsx**

Replace the entire file `src/modules/route/ItineraryView.tsx`:

```tsx
import type { ItineraryStop, Place } from '../../shared/types';

interface Props {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  startTime?: string; // "HH:MM"
  onRemove: (idx: number) => void;
  onAddMeal: () => void; // navigates back to map with restaurant filter
}

function parseTimeLabel(startMins: number): string {
  const h = Math.floor(startMins / 60) % 24;
  const m = Math.round(startMins % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${(h % 12) || 12}:${m < 10 ? '0' : ''}${m} ${ap}`;
}

function parseDurationMins(s?: string): number {
  if (!s) return 60;
  const hm = s.match(/(\d+\.?\d*)\s*h/i);
  const mm = s.match(/(\d+)\s*min/i);
  return (hm ? parseFloat(hm[1]) * 60 : 0) + (mm ? parseInt(mm[1]) : 0) || 60;
}

function parseTransitMins(s?: string): number {
  if (!s) return 10;
  const mm = s.match(/(\d+)\s*min/i);
  const hh = s.match(/(\d+)\s*h/i);
  return (mm ? parseInt(mm[1]) : 0) + (hh ? parseInt(hh[1]) * 60 : 0) || 10;
}

const FOOD_KEYWORDS = ['restaurant', 'café', 'cafe', 'lunch', 'dinner', 'eat', 'food', 'bistro', 'pub', 'bar', 'brasserie', 'diner', 'kitchen'];

interface StopWithTime {
  stop: ItineraryStop;
  index: number;
  startMins: number;
  endMins: number;
  isFoodStop: boolean;
}

interface MealGap {
  label: string;        // "Lunch" | "Dinner"
  insertAfterIndex: number; // insert gap card after this stop in render order
}

function buildTimeline(stops: ItineraryStop[], startMins: number, selectedPlaces: Place[]): StopWithTime[] {
  let running = startMins;
  return stops.map((stop, i) => {
    if (i > 0) {
      const prev = stops[i - 1];
      running += Math.max(30, parseDurationMins(prev.duration));
      running += parseTransitMins(prev.transit_to_next);
    }
    const endMins = running + parseDurationMins(stop.duration);
    const nameLower = (stop.place ?? '').toLowerCase();
    const matchedPlace = selectedPlaces.find(p => {
      const t = p.title.toLowerCase();
      return t === nameLower || nameLower.includes(t.slice(0, 8)) || t.includes(nameLower.slice(0, 8));
    });
    const isFoodStop =
      (matchedPlace != null && (matchedPlace.category === 'restaurant' || matchedPlace.category === 'cafe')) ||
      FOOD_KEYWORDS.some(kw => nameLower.includes(kw));
    return { stop, index: i, startMins: running, endMins, isFoodStop };
  });
}

function detectMealGaps(timeline: StopWithTime[]): MealGap[] {
  const gaps: MealGap[] = [];

  // Lunch window: 12:00–14:00 (720–840 mins)
  const lunchStart = 720, lunchEnd = 840;
  const hasLunch = timeline.some(t => t.isFoodStop && t.startMins < lunchEnd && t.endMins > lunchStart);
  if (!hasLunch) {
    // Find last stop that ends before 14:00, or use last stop
    const beforeLunch = timeline.filter(t => t.startMins < lunchEnd);
    const insertAfter = beforeLunch.length > 0 ? beforeLunch[beforeLunch.length - 1].index : -1;
    // Only warn if the itinerary actually spans the lunch window
    const spansLunch = timeline.some(t => t.startMins <= lunchStart) && timeline.some(t => t.endMins >= lunchEnd);
    if (spansLunch) gaps.push({ label: 'Lunch', insertAfterIndex: insertAfter });
  }

  // Dinner window: 18:30–20:30 (1110–1230 mins)
  const dinnerStart = 1110, dinnerEnd = 1230;
  const hasDinner = timeline.some(t => t.isFoodStop && t.startMins < dinnerEnd && t.endMins > dinnerStart);
  if (!hasDinner) {
    const beforeDinner = timeline.filter(t => t.startMins < dinnerEnd);
    const insertAfter = beforeDinner.length > 0 ? beforeDinner[beforeDinner.length - 1].index : -1;
    const spansDinner = timeline.some(t => t.startMins <= dinnerStart) && timeline.some(t => t.endMins >= dinnerEnd);
    if (spansDinner) gaps.push({ label: 'Dinner', insertAfterIndex: insertAfter });
  }

  return gaps;
}

function MealGapCard({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6 bg-orange/5">
      <div className="w-8 h-8 rounded-full bg-orange/15 flex items-center justify-center flex-shrink-0">
        <span className="ms text-orange text-base">restaurant</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-1 text-sm font-semibold">No {label.toLowerCase()} stop planned</p>
        <p className="text-text-3 text-xs">Your schedule has a gap during {label.toLowerCase()} time</p>
      </div>
      <button
        onClick={onAdd}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-orange/15 text-orange text-xs font-semibold border border-orange/20"
      >
        Add
      </button>
    </div>
  );
}

export function ItineraryView({ stops, selectedPlaces, startTime, onRemove, onAddMeal }: Props) {
  const [startH, startM] = (startTime ?? '9:00').split(':').map(Number);
  const startMins = (startH || 9) * 60 + (startM || 0);

  const timeline = buildTimeline(stops, startMins, selectedPlaces);
  const mealGaps = detectMealGaps(timeline);

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/8 bg-surface/50"
      style={{ margin: '0 4px' }}
    >
      {timeline.map(({ stop, index, startMins: tMins }) => {
        const timeLabel = parseTimeLabel(tMins);
        const isLast = index === stops.length - 1;
        const transit = stop.transit_to_next;
        const gapAfter = mealGaps.filter(g => g.insertAfterIndex === index);

        return (
          <div key={index}>
            <div className="flex gap-3 px-4 py-4 border-b border-white/6">
              {/* Left: time + line */}
              <div className="flex flex-col items-center" style={{ width: 52 }}>
                <span className="text-text-3 text-xs font-semibold">{timeLabel}</span>
                <div className="w-3 h-3 rounded-full bg-primary mt-1 mb-1 flex-shrink-0" />
                {!isLast && <div className="w-px flex-1 bg-white/10 min-h-[24px]" />}
              </div>

              {/* Right: content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="font-heading font-bold text-text-1 text-sm">{stop.place}</div>
                  <button
                    onClick={() => onRemove(index)}
                    className="ms text-text-3 text-base ml-2 flex-shrink-0"
                  >
                    close
                  </button>
                </div>

                {/* Styled tip / insight block */}
                {stop.tip && (
                  <div className="mt-1.5 px-2.5 py-2 rounded-lg border-l-2 border-primary/60 bg-primary/6">
                    <p className="text-text-2 text-xs leading-relaxed">{stop.tip}</p>
                  </div>
                )}

                {stop.duration && (
                  <span className="text-text-3 text-xs mt-1.5 inline-block">{stop.duration}</span>
                )}

                {!isLast && transit && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="ms text-text-3 text-xs">directions_transit</span>
                    <span className="text-text-3 text-xs">{transit}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Meal gap cards injected after this stop */}
            {gapAfter.map(gap => (
              <MealGapCard key={gap.label} label={gap.label} onAdd={onAddMeal} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update RouteScreen to pass selectedPlaces and onAddMeal to ItineraryView**

Open `src/modules/route/RouteScreen.tsx`.

Add `selectedPlaces` to the `useRoute()` destructuring. The `useRoute` hook already exposes it via `state` — add it to the return in `useRoute.ts`:

In `src/modules/route/useRoute.ts`, add `selectedPlaces` to the returned object:

```ts
// Inside useRoute(), the destructuring already has:
const { city, selectedPlaces, persona, tripContext, itinerary, weather, savedItineraries } = state;

// Add selectedPlaces to the return object:
return {
  loading,
  error,
  tab,
  setTab,
  itinerary,
  weather,
  city,
  selectedPlaces,   // ← add this
  savedItineraries,
  removeStop,
  saveItinerary,
  buildItinerary,
  goBack,
  goToNav,
};
```

In `src/modules/route/RouteScreen.tsx`, update the `useRoute()` destructuring to include `selectedPlaces`:

```ts
const {
  loading,
  error,
  tab,
  setTab,
  itinerary,
  weather,
  city,
  selectedPlaces,   // ← add
  savedItineraries,
  removeStop,
  saveItinerary,
  buildItinerary,
  goBack,
  goToNav,
} = useRoute();
```

Then update the `ItineraryView` usage in `RouteScreen.tsx`:

```tsx
<ItineraryView
  stops={itinerary.itinerary}
  selectedPlaces={selectedPlaces}
  onRemove={removeStop}
  onAddMeal={() => {
    dispatch({ type: 'SET_FILTER', filter: 'restaurant' });
    dispatch({ type: 'GO_TO', screen: 'map' });
  }}
/>
```

Because `RouteScreen` doesn't have `dispatch` yet, add `useAppStore` import and destructure it:

```tsx
import { useAppStore } from '../../shared/store';
// inside RouteScreen():
const { dispatch } = useAppStore();
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built` — no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/modules/route/ItineraryView.tsx frontend/src/modules/route/useRoute.ts frontend/src/modules/route/RouteScreen.tsx
git commit -m "feat: enrich itinerary with styled tips and meal gap detection"
```

---

## Task 7: Create WeatherCanvas component + add keyframes

**Files:**
- Create: `src/modules/route/WeatherCanvas.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add weather keyframe animations to index.css**

Open `src/index.css`. Append the following after the `.no-scrollbar` block:

```css
/* ── Weather animations ───────────────────────────────── */
@keyframes weather-pulse {
  0%, 100% { opacity: .25; transform: scale(1); }
  50%       { opacity: .45; transform: scale(1.15); }
}
@keyframes weather-drift {
  0%   { transform: translateX(-8px); }
  100% { transform: translateX(8px); }
}
@keyframes weather-fall {
  0%   { transform: translateY(-20px); opacity: 0; }
  10%  { opacity: .7; }
  90%  { opacity: .7; }
  100% { transform: translateY(160px); opacity: 0; }
}
@keyframes weather-flicker {
  0%, 100% { opacity: 0; }
  5%, 15%  { opacity: .6; }
  10%, 20% { opacity: 0; }
}
```

- [ ] **Step 2: Create WeatherCanvas.tsx**

Create `src/modules/route/WeatherCanvas.tsx`:

```tsx
interface Props {
  condition: string; // e.g. "Sunny", "Rain", "Cloudy", "Snow"
}

type WeatherType = 'sunny' | 'rain' | 'cloud' | 'snow' | 'thunder' | 'none';

function classify(condition: string): WeatherType {
  const c = condition.toLowerCase();
  if (/thunder|storm/.test(c)) return 'thunder';
  if (/rain|drizzle|shower/.test(c)) return 'rain';
  if (/snow|blizzard|sleet/.test(c)) return 'snow';
  if (/cloud|overcast|fog|mist|haze/.test(c)) return 'cloud';
  if (/sun|clear|fair|bright/.test(c)) return 'sunny';
  return 'none';
}

const DROP_COUNT = 14;
const SNOW_COUNT = 20;

export function WeatherCanvas({ condition }: Props) {
  const type = classify(condition);

  if (type === 'none') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: 140,
          background: 'linear-gradient(to bottom, rgba(59,130,246,.08) 0%, transparent 100%)',
        }}
        aria-hidden
      />
    );
  }

  if (type === 'sunny') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
        style={{ height: 140 }}
        aria-hidden
      >
        {/* Warm amber pulse rings */}
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 200 + i * 60,
              height: 200 + i * 60,
              top: -80 - i * 30,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'radial-gradient(circle, rgba(251,191,36,.18) 0%, transparent 70%)',
              animation: `weather-pulse ${4 + i}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
            }}
          />
        ))}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(251,191,36,.07) 0%, transparent 100%)' }}
        />
      </div>
    );
  }

  if (type === 'rain' || type === 'thunder') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
        style={{ height: 140 }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{
            background: type === 'thunder'
              ? 'linear-gradient(to bottom, rgba(99,102,241,.12) 0%, transparent 100%)'
              : 'linear-gradient(to bottom, rgba(59,130,246,.1) 0%, transparent 100%)',
          }}
        />
        {/* Thunder flicker */}
        {type === 'thunder' && (
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(255,255,255,.15)',
              animation: 'weather-flicker 3s ease-in-out infinite',
            }}
          />
        )}
        {/* Rain drops */}
        {Array.from({ length: DROP_COUNT }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 1.5,
              height: 10 + Math.random() * 8,
              left: `${(i / DROP_COUNT) * 100 + Math.random() * 5}%`,
              top: 0,
              background: 'rgba(147,197,253,.55)',
              animation: `weather-fall ${1.2 + Math.random() * 0.8}s linear infinite`,
              animationDelay: `${(i / DROP_COUNT) * 1.5}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (type === 'snow') {
    return (
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
        style={{ height: 140 }}
        aria-hidden
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(226,232,240,.08) 0%, transparent 100%)' }}
        />
        {Array.from({ length: SNOW_COUNT }, (_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 3,
              height: 4 + Math.random() * 3,
              left: `${Math.random() * 100}%`,
              top: 0,
              background: 'rgba(255,255,255,.65)',
              animation: `weather-fall ${2.5 + Math.random() * 1.5}s linear infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // cloud / overcast / fog
  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
      style={{ height: 140 }}
      aria-hidden
    >
      {[0, 1].map(i => (
        <div
          key={i}
          className="absolute"
          style={{
            width: '120%',
            height: '100%',
            left: '-10%',
            background: `linear-gradient(to bottom, rgba(148,163,184,${0.07 + i * 0.04}) 0%, transparent 100%)`,
            animation: `weather-drift ${8 + i * 3}s ease-in-out infinite alternate`,
            animationDelay: `${i * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Export from route module index**

Open `src/modules/route/index.ts`. Add:

```ts
export { WeatherCanvas } from './WeatherCanvas';
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built`.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/modules/route/WeatherCanvas.tsx frontend/src/modules/route/index.ts frontend/src/index.css
git commit -m "feat: add WeatherCanvas CSS animation component"
```

---

## Task 8: Wire WeatherCanvas into RouteScreen

**Files:**
- Modify: `src/modules/route/RouteScreen.tsx`

- [ ] **Step 1: Import WeatherCanvas**

Open `src/modules/route/RouteScreen.tsx`. Add the import:

```tsx
import { WeatherCanvas } from './WeatherCanvas';
```

- [ ] **Step 2: Replace the static weather gradient div with WeatherCanvas**

Find and remove this existing block:

```tsx
{weather && (
  <div
    className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
    style={{
      background: 'linear-gradient(to bottom, rgba(59,130,246,.08) 0%, transparent 100%)',
    }}
  />
)}
```

Replace it with:

```tsx
<WeatherCanvas condition={weather?.condition ?? ''} />
```

Note: `WeatherCanvas` handles the empty string case by rendering the default static gradient, so it is always rendered (not conditionally on `weather`).

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```
Expected: `✓ built`.

- [ ] **Step 4: Deploy to production**

```bash
cd frontend && npx vercel --prod
```

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/react-migration
git add frontend/src/modules/route/RouteScreen.tsx
git commit -m "feat: replace static weather gradient with WeatherCanvas animation"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Issue 1 — "Our Picks" backend call + client fallback: Tasks 1–3
- ✅ Issue 2 — Trip context bottom sheet: Tasks 4–5
- ✅ Issue 3 — Enriched tips + meal gap cards: Task 6
- ✅ Issue 3 — Weather animation: Tasks 7–8

**Placeholder scan:** No TBD/TODO found.

**Type consistency:**
- `Place.reason?: string` added in Task 1, used in Task 3 (PinCard) ✅
- `api.recommended` added in Task 1, called in Task 2 ✅
- `ItineraryView` new props `selectedPlaces` + `onAddMeal` defined in Task 6 and passed in Task 6 ✅
- `WeatherCanvas` prop `condition: string` defined in Task 7, used in Task 8 ✅
- `selectedPlaces` added to `useRoute` return in Task 6, destructured in RouteScreen in Task 6 ✅
