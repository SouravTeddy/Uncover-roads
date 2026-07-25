# Reel Reco Engine Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five reco engine detection bugs and ship six new card features (walkable detour, photo moment, local food, local events, photography detour, persona floor reco).

**Architecture:** Bug fixes live entirely in `profile.ts` and `useReelRecommendations.ts`. New card features layer on top of the existing reel-builder pipeline: `reel-builder.ts` builds the observation, `ItineraryReelScreen.tsx` groups/renders it. New card types reuse `ReelScenicCard` where possible and add new React components only where the layout is fundamentally different.

**Tech Stack:** TypeScript, React, Vitest, Material Symbols icons, `sunrise-sunset.org` free API (no key), existing `api.ts` proxy pattern.

## Global Constraints

- **No new npm packages** — use `fetch` directly for the sunset API; no third-party solar library
- **No backend changes for Tasks 1–6** — all changes are frontend only
- **Task 8 (local events)** calls `api.events()` which already exists in `api.ts`; no new backend endpoint needed
- **Vitest** — run tests with `npm test` (alias for `vitest run`) from `/Users/souravbiswas/Uncover-roads/frontend`
- **All new reco triggers** must be added to the `RecoTrigger` union in `src/modules/route/reel/types.ts`
- **Card IDs** must be stable and unique: follow pattern `${trigger}-${anchorStopId}` or `${trigger}-${city}-${dayIdx}`
- **TypeScript strict** — no `any` without a comment explaining why; no `ts-ignore`
- **No Unsplash fallback for new card types** — use gradient background `linear-gradient(135deg, #1a1714 0%, #0f0d0c 100%)` when no photo is available

---

## Task 1: Fix stop detection windows (lunch, dinner, rest)

**Files:**
- Modify: `src/modules/route/reco-engine/profile.ts:95–117`
- Modify: `src/modules/route/reco-engine/profile.test.ts` (add new test cases)

> **Note on `semantics.ts`:** The original bug description mentions fixing `evening_wind` threshold in `semantics.ts`. This is NOT needed — Step 4's `hasDinner` fix checks `FOOD_CATS.has(s.category)` directly, removing any dependency on semantic roles. `semantics.ts` is unchanged.

**Interfaces:**
- Consumes: nothing new — bug fix in existing `computeActualProfile()`
- Produces: `hasLunch`, `hasDinner`, `hasRest` now return correct values; downstream `deriveRecos()` in `engine.ts` benefits automatically

**Root cause summary (read before touching code):**
1. `hasLunch` window: `m >= 690 && m <= 870` = 11:30–14:30. A restaurant at 11:00 (660 min) or 3 PM (900 min) misses.
2. `hasDinner` checks `roles[i] === 'evening_wind' || roles[i] === 'fuel_stop'`. But `evening_wind` in `semantics.ts` requires `startMin >= 19*60` (19:00). A restaurant at 17:30 gets `fuel_stop` only if `durationMin < 45`; otherwise falls through to `transit_filler`. So dinner at 17:30–19:00 often produces 0.
3. `hasRest` fires only for `scenic_rest` role, which requires outdoor weather + scenic neighbour. A cafe in bad weather always = `fuel_stop` → `hasRest = 0` despite a rest stop being present.

- [ ] **Step 1: Write failing tests**

Add to `src/modules/route/reco-engine/profile.test.ts`:

```ts
// --- Task 1 regression tests ---

it('hasLunch = 1 when restaurant at 11:00 (below old 690 floor)', () => {
  const stops = [stop({ id: 's1', time: '11:00', category: 'restaurant', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasLunch).toBe(1);
});

it('hasLunch = 1 when cafe at 15:00 (above old 870 ceiling)', () => {
  const stops = [stop({ id: 's1', time: '15:00', category: 'cafe', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasLunch).toBe(1);
});

it('hasLunch = 0 when no food stop between 11:00–15:00', () => {
  const stops = [stop({ id: 's1', time: '10:30', category: 'restaurant', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasLunch).toBe(0);
});

it('hasDinner = 1 when restaurant at 17:30', () => {
  const stops = [stop({ id: 's1', time: '17:30', category: 'restaurant', durationMin: 90 })];
  expect(computeActualProfile(stops, makeSignal()).hasDinner).toBe(1);
});

it('hasDinner = 0 when no food stop after 17:00', () => {
  const stops = [stop({ id: 's1', time: '16:30', category: 'restaurant', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasDinner).toBe(0);
});

it('hasRest = 1 when cafe present regardless of weather', () => {
  const signal = makeSignal({ weather: { condition: 'rain', tempC: 12, isOutdoorFriendly: false } });
  const stops = [stop({ id: 's1', time: '11:00', category: 'cafe', durationMin: 30 })];
  expect(computeActualProfile(stops, signal).hasRest).toBe(1);
});

it('hasRest = 0 when only museums and restaurants', () => {
  const stops = [
    stop({ id: 's1', time: '09:00', category: 'museum', durationMin: 90 }),
    stop({ id: 's2', time: '12:00', category: 'restaurant', durationMin: 60 }),
  ];
  expect(computeActualProfile(stops, makeSignal()).hasRest).toBe(0);
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend
npm test -- --reporter=verbose src/modules/route/reco-engine/profile.test.ts
```

Expected: 7 new tests FAIL (the old tests still pass).

- [ ] **Step 3: Fix `hasLunch` — widen window in `profile.ts`**

In `src/modules/route/reco-engine/profile.ts`, replace lines 95–99:

```ts
  // Lunch: food category in 11:00–15:00 window (660–900 min)
  const hasLunch = sorted.some((s, i) => {
    const m = timeToMin(s.time);
    return m >= 660 && m <= 900 && (FOOD_CATS.has(s.category) || roles[i] === 'fuel_stop' || roles[i] === 'scenic_rest' || roles[i] === 'evening_wind');
  }) ? 1 : 0;
```

- [ ] **Step 4: Fix `hasDinner` — check food category directly, not just semantic role**

In `profile.ts`, replace lines 101–105:

```ts
  // Dinner: food category after 17:00 (1020 min)
  const hasDinner = sorted.some((s) => {
    const m = timeToMin(s.time);
    return m >= 1020 && FOOD_CATS.has(s.category);
  }) ? 1 : 0;
```

- [ ] **Step 5: Fix `hasRest` — fire for any cafe/park stop, not just scenic_rest role**

In `profile.ts`, replace line 117:

```ts
  // Rest: any cafe or park in the schedule counts, regardless of weather or neighbours
  const REST_CATS = new Set(['cafe', 'park']);
  const hasRest = sorted.some(s => REST_CATS.has(s.category)) ? 1 : 0;
```

- [ ] **Step 6: Run tests — all 7 new tests should pass, all existing tests still pass**

```bash
npm test -- --reporter=verbose src/modules/route/reco-engine/profile.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Run full suite to catch regressions**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/modules/route/reco-engine/profile.ts src/modules/route/reco-engine/profile.test.ts
git commit -m "fix(reco): widen lunch/dinner windows, hasRest fires for any cafe/park"
```

---

## Task 2: Hotel arrival/departure clips available day window

**Files:**
- Modify: `src/modules/route/reco-engine/profile.ts:51–75` (`computeTargetProfile`)
- Modify: `src/modules/route/reco-engine/profile.test.ts` (add new tests)

**Interfaces:**
- Consumes: `signal.trip.arrivalTime` (string `"HH:MM"` or null), `signal.trip.departureTime` (same), `signal.trip.isFirstDay`, `signal.trip.isLastDay` — all already in `RecoSignal`
- Produces: `hasLunch`, `hasDinner`, `hasEveningActivity`, `densityScore` targets are clipped when arrival is late or departure is early

**Root cause:** `computeTargetProfile()` always uses static weights regardless of `arrivalTime`/`departureTime`. A user arriving at 3pm still gets `hasLunch: 0.9` as target, so the gap fires and a "no lunch" reco appears even though lunch is impossible.

**Clip rules:**
- Arrival on first day at time T (min `A`):
  - If `A > 900` (after 15:00): `hasLunch` target = 0
  - If `A > 1020` (after 17:00): `hasDinner` target = 0 (extremely late arrival)
  - `densityScore` target scales as `targetDensity * (availableHours / 14)` where `availableHours = (22*60 - A) / 60`
- Departure on last day at time D (min):
  - If `D < 750` (before 12:30): `hasDinner` target = 0, `hasEveningActivity` target = 0
  - If `D < 1020` (before 17:00): `hasDinner` target = 0, `hasEveningActivity` target = 0
  - `densityScore` target scales as `targetDensity * (availableHours / 14)` where `availableHours = (D - 9*60) / 60`

- [ ] **Step 1: Write failing tests**

Add to `profile.test.ts`:

```ts
// --- Task 2 ---

it('hasLunch target = 0 when arrival is after 15:00 on first day', () => {
  const signal = makeSignal({
    trip: { ...makeSignal().trip, isFirstDay: true, isLastDay: false, arrivalTime: '16:00', departureTime: null },
  });
  expect(computeTargetProfile(signal).hasLunch).toBe(0);
});

it('hasLunch target = 0.9 when arrival is 11:00 on first day (lunch still possible)', () => {
  const signal = makeSignal({
    trip: { ...makeSignal().trip, isFirstDay: true, isLastDay: false, arrivalTime: '11:00', departureTime: null },
  });
  expect(computeTargetProfile(signal).hasLunch).toBeCloseTo(0.9);
});

it('hasDinner target = 0 when departure before 17:00 on last day', () => {
  const signal = makeSignal({
    trip: { ...makeSignal().trip, isFirstDay: false, isLastDay: true, arrivalTime: null, departureTime: '11:00' },
  });
  expect(computeTargetProfile(signal).hasDinner).toBe(0);
});

it('hasEveningActivity target = 0 when departure before 17:00 on last day', () => {
  const signal = makeSignal({
    trip: { ...makeSignal().trip, isFirstDay: false, isLastDay: true, arrivalTime: null, departureTime: '14:00' },
  });
  expect(computeTargetProfile(signal).hasEveningActivity).toBe(0);
});

it('densityScore target is reduced when arrival is late', () => {
  const baseSignal = makeSignal({ pace: 'moderate' });
  const lateArrival = makeSignal({
    pace: 'moderate',
    trip: { ...makeSignal().trip, isFirstDay: true, isLastDay: false, arrivalTime: '18:00', departureTime: null },
  });
  const base = computeTargetProfile(baseSignal).densityScore!;
  const late = computeTargetProfile(lateArrival).densityScore!;
  expect(late).toBeLessThan(base);
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
npm test -- --reporter=verbose src/modules/route/reco-engine/profile.test.ts
```

Expected: 5 new tests FAIL.

- [ ] **Step 3: Implement clipping in `computeTargetProfile`**

In `src/modules/route/reco-engine/profile.ts`, replace the `computeTargetProfile` function body (lines 51–75) with:

```ts
export function computeTargetProfile(signal: RecoSignal): ItineraryProfile {
  const w = signal.weights;
  const { pace, isFamily, trip } = signal;
  // timeToMin is already defined at module scope in this file — no redefinition needed

  // Clip meal/activity targets based on arrival/departure constraints
  const arrivalMin  = trip.isFirstDay  && trip.arrivalTime   ? timeToMin(trip.arrivalTime)   : null;
  const departureMin = trip.isLastDay  && trip.departureTime ? timeToMin(trip.departureTime) : null;

  // Lunch is unreachable if arriving after 15:00 (900)
  const hasLunchTarget = (arrivalMin !== null && arrivalMin > 900) ? 0 : 0.9;

  // Dinner/evening are unreachable if departing before 17:00 (1020)
  const dinnerBlocked   = departureMin !== null && departureMin < 1020;
  const eveningBlocked  = departureMin !== null && departureMin < 1020;

  const baseDinnerTarget   = w.w_food_density * 0.8 + 0.2;
  const baseEveningTarget  = w.w_nightlife;

  // Density: scale by fraction of day available (baseline = 14h)
  const BASE_DAY_HOURS = 14;
  let densityMult = 1;
  if (arrivalMin !== null) {
    const availHours = Math.max(0, (22 * 60 - arrivalMin)) / 60;
    densityMult = Math.min(1, availHours / BASE_DAY_HOURS);
  }
  if (departureMin !== null) {
    const availHours = Math.max(0, (departureMin - 9 * 60)) / 60;
    densityMult = Math.min(densityMult, availHours / BASE_DAY_HOURS);
  }

  const baseDensity = pace === 'slow' ? 0.35 : pace === 'fast' ? 0.75 : 0.55;

  return {
    hasLunch:           hasLunchTarget,
    hasDinner:          dinnerBlocked ? 0 : baseDinnerTarget,
    hasEveningActivity: eveningBlocked ? 0 : baseEveningTarget,
    hasCulture:         w.w_culture_depth,
    hasOutdoor:         w.w_scenic * 0.7 + (isFamily ? 0.3 : 0),
    hasRest:            Math.min(1, w.w_rest_need * 0.7 + (pace === 'slow' ? 0.3 : 0)),
    hasSocialStop:      signal.social === 'solo' ? 0.2 : 0.6,
    hasHiddenGem:       signal.spontaneityBias * 0.6,
    densityScore:       baseDensity * densityMult,
    walkIntensity:      w.w_walk_affinity * 0.7,
    categoryDiversity:  signal.spontaneityBias * 0.5 + 0.3,
    timeBalance:        pace === 'slow' ? 0.5 : 0.7,
    geoEfficiency:      w.w_efficiency * 0.6 + 0.2,
    weatherAlignment:   signal.weather?.isOutdoorFriendly ? w.w_scenic * 0.7 + 0.3 : (1 - w.w_scenic) * 0.8,
    crowdOptimization:  w.w_crowd_aversion,
    budgetAlignment:    1 - w.w_budget_sensitivity * 0.8,
    liveEventOverlap:   signal.savedEvents.length > 0 || signal.dismissedPinIds.size > 0 ? signal.spontaneityBias : null,
    trendAlignment: null, localVelocity: null, curatedCoverage: null, routeScenicity: null,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose src/modules/route/reco-engine/profile.test.ts
```

Expected: all tests PASS (including the 5 new ones and all prior tests).

- [ ] **Step 5: Full suite**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/route/reco-engine/profile.ts src/modules/route/reco-engine/profile.test.ts
git commit -m "fix(reco): clip hasLunch/hasDinner/densityScore targets for arrival/departure constraints"
```

---

## Task 3: Fix stale reco cache on itinerary rebuild

> **⚠️ Sequential implementers:** Task 4 replaces this file entirely and includes this fix. If you are implementing tasks in order, skip Task 3 and go straight to Task 4. Only implement Task 3 independently if Tasks 3 and 4 are being parallelised.

**Files:**
- Modify: `src/modules/route/reel/useReelRecommendations.ts`
- Modify: `src/modules/route/reel/useReelRecommendations.test.ts`

**Interfaces:**
- Produces: same `{ places, loading, error }` interface, but now re-fetches when card ID changes across renders

**Root cause:** `fetched.current = true` is set on first fetch and never reset when `card.id` changes. Because `fetched.current` is a ref (not state), changing `card.id` doesn't trigger a new effect run with a clean ref. When the user rebuilds the itinerary and the same anchor stop produces the same card ID, the stale places list from the previous build is returned without re-fetching.

Fix: track `card.id` in a second ref. At the start of the effect, if `card.id !== prevCardId.current`, reset `fetched.current`.

- [ ] **Step 1: Write failing test**

Add to `src/modules/route/reel/useReelRecommendations.test.ts`:

```ts
it('re-fetches when card id changes between renders', async () => {
  const spy = vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([]);
  const card1: ReelRecoCard = { ...CARD, id: 'c1' };
  const card2: ReelRecoCard = { ...CARD, id: 'c2' };

  const { rerender } = renderHook(
    ({ card }) => useReelRecommendations(card, 'explorer', [], true),
    { initialProps: { card: card1 } },
  );

  await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

  rerender({ card: card2 });

  await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --reporter=verbose src/modules/route/reel/useReelRecommendations.test.ts
```

Expected: new test FAILS (only 1 call observed, not 2).

- [ ] **Step 3: Fix `useReelRecommendations.ts`**

Replace the full file:

```ts
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import type { ReelRecoPlace } from '../../../shared/types';
import type { ReelRecoCard } from './types';

interface Result {
  places: ReelRecoPlace[];
  loading: boolean;
  error: boolean;
}

const FETCH_TIMEOUT_MS = 8000;

/**
 * Fetches persona-scored nearby recommendations when a reco card becomes active.
 * Results are cached per card ID — re-activation doesn't re-fetch.
 * Cache is invalidated when card.id changes (e.g., after itinerary rebuild).
 * No AI text in the response — all scoring is deterministic (persona_affinity.py).
 */
export function useReelRecommendations(
  card: ReelRecoCard,
  archetype: string,
  existingPlaceIds: string[],
  active: boolean,
  category?: string,
): Result {
  const [places, setPlaces] = useState<ReelRecoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetched = useRef(false);
  const prevCardId = useRef<string>(card.id);

  useEffect(() => {
    // Reset cache when the card itself changes (e.g., after itinerary rebuild with same anchor stop)
    if (card.id !== prevCardId.current) {
      fetched.current = false;
      prevCardId.current = card.id;
      setPlaces([]);
      setError(false);
    }

    if (!active || fetched.current) return;
    if (!card.stopLat || !card.stopLon) return;

    fetched.current = true;
    setLoading(true);
    setError(false);

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      cancelled = true;
      fetched.current = false;
      setLoading(false);
      setError(true);
    }, FETCH_TIMEOUT_MS);

    api.reelReco({
      lat: card.stopLat,
      lon: card.stopLon,
      trigger: card.trigger,
      archetype,
      existingPlaceIds,
      category: category ?? undefined,
    })
      .then(data => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setPlaces(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        fetched.current = false;
        setLoading(false);
        setError(true);
      });

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [active, card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { places, loading, error };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose src/modules/route/reel/useReelRecommendations.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Full suite**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/route/reel/useReelRecommendations.ts src/modules/route/reel/useReelRecommendations.test.ts
git commit -m "fix(reel): reset reco cache when card.id changes after itinerary rebuild"
```

---

## Task 4: Reco card photo from top recommended place

> **Note:** This task's implementation of `useReelRecommendations.ts` already includes the Task 3 stale cache fix. The complete file block below supersedes Task 3.

**Files:**
- Modify: `src/modules/route/reel/useReelRecommendations.ts`
- Modify: `src/modules/route/reel/ReelRecoCard.tsx:113–172`
- Modify: `src/modules/route/reel/useReelRecommendations.test.ts`

**Interfaces:**
- `useReelRecommendations` now returns `{ places, loading, error, photoUrl: string | null }`
- `ReelRecoCard` uses `photoUrl` from the hook as the card background

**Root cause:** `gapToCard()` in `engine.ts` never sets `anchorPhotoUrl` — it's always `null`. The reco card's top half shows a plain dark gradient. Fixing this client-side by fetching the top recommended place's photo via `api.placeImage()`.

**Approach:** After `api.reelReco()` resolves with places, attempt `api.placeImage(places[0].name, card.nearbyCity)`. If that returns null (not found), retry with `places[1].name`. Return the result as `photoUrl`.

- [ ] **Step 1: Write failing tests**

Add to `useReelRecommendations.test.ts`:

```ts
import * as apiModule from '../../../shared/api';

it('photoUrl is set from first place when placeImage resolves', async () => {
  vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([
    { placeId: 'p1', name: 'Saravana Bhavan', lat: 12.97, lon: 77.59, category: 'restaurant', rating: 4.5, priceLevel: 1, distanceM: 120, affinityScore: 0.9, matchReasons: [] },
  ]);
  vi.spyOn(apiModule.api, 'placeImage').mockResolvedValue('https://example.com/photo.jpg');

  const { result } = renderHook(() =>
    useReelRecommendations(CARD, 'explorer', [], true));

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.photoUrl).toBe('https://example.com/photo.jpg');
  });
});

it('photoUrl falls back to second place when first placeImage returns null', async () => {
  vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([
    { placeId: 'p1', name: 'Place One', lat: 12.97, lon: 77.59, category: 'restaurant', rating: 4.0, priceLevel: 1, distanceM: 100, affinityScore: 0.8, matchReasons: [] },
    { placeId: 'p2', name: 'Place Two', lat: 12.97, lon: 77.59, category: 'restaurant', rating: 4.3, priceLevel: 2, distanceM: 200, affinityScore: 0.7, matchReasons: [] },
  ]);
  vi.spyOn(apiModule.api, 'placeImage')
    .mockResolvedValueOnce(null)
    .mockResolvedValue('https://example.com/second.jpg');

  const { result } = renderHook(() =>
    useReelRecommendations(CARD, 'explorer', [], true));

  await waitFor(() => {
    expect(result.current.photoUrl).toBe('https://example.com/second.jpg');
  });
});

it('photoUrl is null when no places found', async () => {
  vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([]);

  const { result } = renderHook(() =>
    useReelRecommendations(CARD, 'explorer', [], true));

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.photoUrl).toBeNull();
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
npm test -- --reporter=verbose src/modules/route/reel/useReelRecommendations.test.ts
```

Expected: 3 new tests FAIL (no `photoUrl` in current return value).

- [ ] **Step 3: Add `photoUrl` to `useReelRecommendations.ts`**

Add `photoUrl` state and fetch logic after places load. Replace the `.then(data => {` block in the hook:

```ts
import { useEffect, useRef, useState } from 'react';
import { api } from '../../../shared/api';
import type { ReelRecoPlace } from '../../../shared/types';
import type { ReelRecoCard } from './types';

interface Result {
  places: ReelRecoPlace[];
  loading: boolean;
  error: boolean;
  photoUrl: string | null;
}

const FETCH_TIMEOUT_MS = 8000;

export function useReelRecommendations(
  card: ReelRecoCard,
  archetype: string,
  existingPlaceIds: string[],
  active: boolean,
  category?: string,
): Result {
  const [places, setPlaces] = useState<ReelRecoPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fetched = useRef(false);
  const prevCardId = useRef<string>(card.id);

  useEffect(() => {
    if (card.id !== prevCardId.current) {
      fetched.current = false;
      prevCardId.current = card.id;
      setPlaces([]);
      setError(false);
      setPhotoUrl(null);
    }

    if (!active || fetched.current) return;
    if (!card.stopLat || !card.stopLon) return;

    fetched.current = true;
    setLoading(true);
    setError(false);

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      cancelled = true;
      fetched.current = false;
      setLoading(false);
      setError(true);
    }, FETCH_TIMEOUT_MS);

    api.reelReco({
      lat: card.stopLat,
      lon: card.stopLon,
      trigger: card.trigger,
      archetype,
      existingPlaceIds,
      category: category ?? undefined,
    })
      .then(async data => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setPlaces(data);
        setLoading(false);

        // Fetch photo for top-scoring place, with one fallback attempt
        for (const p of data.slice(0, 2)) {
          const url = await api.placeImage(p.name, card.nearbyCity);
          if (cancelled) return;
          if (url) { setPhotoUrl(url); return; }
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        fetched.current = false;
        setLoading(false);
        setError(true);
      });

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [active, card.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { places, loading, error, photoUrl };
}
```

- [ ] **Step 4: Update `ReelRecoCard.tsx` to use `photoUrl` from the hook**

In `src/modules/route/reel/ReelRecoCard.tsx`, update lines 113–172:

Change:
```ts
  const { places, loading, error } = useReelRecommendations(card, archetype, existingPlaceIds, active, TRIGGER_CATEGORY[card.trigger]);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPhoto = !!card.anchorPhotoUrl;
```

To:
```ts
  const { places, loading, error, photoUrl } = useReelRecommendations(card, archetype, existingPlaceIds, active, TRIGGER_CATEGORY[card.trigger]);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedPhotoUrl = photoUrl ?? card.anchorPhotoUrl ?? null;
  const hasPhoto = !!resolvedPhotoUrl;
```

Change `{hasPhoto ? (<img src={card.anchorPhotoUrl!}` to `{hasPhoto ? (<img src={resolvedPhotoUrl!}`.

- [ ] **Step 5: Run tests**

```bash
npm test -- --reporter=verbose src/modules/route/reel/useReelRecommendations.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Full suite**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/route/reel/useReelRecommendations.ts src/modules/route/reel/ReelRecoCard.tsx src/modules/route/reel/useReelRecommendations.test.ts
git commit -m "feat(reel): load real place photo in reco card top half from Google Places"
```

---

## Task 5: Persona-aligned floor reco

**Files:**
- Modify: `src/modules/route/reco-engine/engine.ts:229–244` (`deriveRecos`)
- Modify: `src/modules/route/reco-engine/engine.test.ts`

**Interfaces:**
- Produces: `deriveRecos()` now guarantees at least one reco aligned to the user's archetypeGroup, injected only when no existing reco already covers that group's dimension

**Root cause:** `deriveRecos()` is purely gap-driven. A `slowscholar` (cultural group) whose plan is already full of museums gets zero culture recos — gap engine finds no deficit. But the intro card promises "a deep cultural immersion," so the reco section has no cultural reinforcement. The fix injects a persona-anchored reco when the gap list doesn't already include one for the archetype's home dimension.

**Archetype group → fallback dimension mapping:**
- `cultural` → `hasCulture` (trigger: `'culture'`)
- `sensory` → `hasRest` (trigger: `'rest'`) — sensory personas appreciate rest/cafe experiences
- `social` → `hasSocialStop` (trigger: `'social_gap'`)
- `explorer` → `hasHiddenGem` (trigger: `'hidden_gem'`)

The floor reco only fires if:
1. None of the existing gap recos covers the archetype's home dimension trigger
2. The day has at least 2 stops (not a transit-only day)

- [ ] **Step 1: Write failing test**

Add to `src/modules/route/reco-engine/engine.test.ts`. First read the file to understand the existing test pattern, then add:

```ts
import { describe, it, expect } from 'vitest';
import { deriveRecos } from './engine';
import type { RecoSignal } from './signal';
import type { EngineItineraryStop, Category } from '../../../shared/types';

// (Add to existing describe block or create a new one)
describe('deriveRecos — persona floor reco', () => {
  const BASE_WEIGHTS = { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.8, w_culture_depth: 0.9, w_nightlife: 0.2, w_budget_sensitivity: 0.3, w_crowd_aversion: 0.4, w_spontaneity: 0.3, w_rest_need: 0.3 };

  function makeStop(id: string, time: string, category: Category): EngineItineraryStop {
    return { id, placeId: id, title: `Place ${id}`, area: 'Centre', day: 1, time, durationMin: 90, category, lat: 0, lon: 0, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null };
  }

  function makeSignal(archetypeGroup: string): RecoSignal {
    return {
      weights: BASE_WEIGHTS, archetype: 'slowscholar', archetypeGroup: archetypeGroup as any,
      archetypeConfidence: 1.0, pace: 'slow', social: 'solo', isFamily: false,
      ritualStrength: 0.5, sensoryIntensity: 0.5, spontaneityBias: 0.3,
      trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-06-15' },
      weather: { condition: 'sunny', tempC: 22, isOutdoorFriendly: true },
      dismissedPinIds: new Set(), savedEvents: [],
    };
  }

  it('injects culture floor reco for cultural archetype when plan already has full culture', () => {
    // Plan is already culturally rich — no hasCulture gap
    const stops = [
      makeStop('s1', '09:00', 'museum'),
      makeStop('s2', '11:00', 'gallery'),
      makeStop('s3', '12:30', 'restaurant'),
      makeStop('s4', '14:00', 'historic'),
    ];
    const signal = makeSignal('cultural');
    const recos = deriveRecos(stops, signal);
    // Floor reco for 'cultural' group should still appear if no culture reco already present
    // In this case, hasCulture actual = 1.0 and target = 0.9, delta = -0.1, no gap → no culture reco from engine
    // Floor injects one
    expect(recos.some(r => r.trigger === 'culture')).toBe(true);
  });

  it('does NOT inject duplicate floor reco if engine already surfaced one for the archetype dimension', () => {
    // Plan has no culture at all → engine will surface hasCulture gap → floor reco should not duplicate
    const stops = [
      makeStop('s1', '09:00', 'restaurant'),
      makeStop('s2', '11:00', 'park'),
    ];
    const signal = makeSignal('cultural');
    const recos = deriveRecos(stops, signal);
    const cultureRecos = recos.filter(r => r.trigger === 'culture');
    expect(cultureRecos.length).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --reporter=verbose src/modules/route/reco-engine/engine.test.ts
```

Expected: the "injects culture floor reco" test FAILS.

- [ ] **Step 3: Implement floor reco in `deriveRecos`**

In `src/modules/route/reco-engine/engine.ts`, replace `deriveRecos` (lines 229–244):

```ts
const ARCHETYPE_FLOOR: Record<string, { dimension: keyof ItineraryProfile; trigger: string }> = {
  cultural: { dimension: 'hasCulture',   trigger: 'culture'    },
  sensory:  { dimension: 'hasRest',      trigger: 'rest'       },
  social:   { dimension: 'hasSocialStop',trigger: 'social_gap' },
  explorer: { dimension: 'hasHiddenGem', trigger: 'hidden_gem' },
};

export function deriveRecos(
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ReelRecoCard[] {
  const target = computeTargetProfile(signal);
  const actual = computeActualProfile(stops, signal);
  const gaps = detectGaps(target, actual, signal);
  const resolved = resolveConflicts(gaps);

  const maxRecos = resolved.some(g => g.conflictPresent) ? MAX_RECOS + 1 : MAX_RECOS;

  const result = resolved
    .slice(0, maxRecos)
    .map(g => gapToCard(g, stops, signal))
    .filter((c): c is ReelRecoCard => c !== null);

  // Persona floor: inject one archetype-aligned reco if none already present and day has enough stops
  if (stops.length >= 2) {
    const floor = ARCHETYPE_FLOOR[signal.archetypeGroup];
    if (floor && !result.some(r => r.trigger === floor.trigger)) {
      const floorGap: Gap = {
        dimension: floor.dimension,
        target: target[floor.dimension] as number ?? 0.5,
        actual: actual[floor.dimension] as number ?? 0.5,
        delta: 0,
        dimensionWeight: 0.5,
        significance: BASE_THRESHOLD + 0.01,
        direction: 'missing',
        conflictPresent: false,
      };
      const floorCard = gapToCard(floorGap, stops, signal);
      if (floorCard) result.push(floorCard);
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose src/modules/route/reco-engine/engine.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Full suite**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/route/reco-engine/engine.ts src/modules/route/reco-engine/engine.test.ts
git commit -m "feat(reco): inject persona-aligned floor reco when gap engine produces no archetype match"
```

---

## Task 6: Promote walkable_detour to full-screen card

**Files:**
- Modify: `src/modules/route/reel/reel-builder.ts` — build `ReelScenicCard` from detour obs, exclude from `allObservations`
- Modify: `src/modules/route/reel/reel-builder.test.ts` — add test for detour card presence

**Interfaces:**
- Consumes: `buildWalkableDetourObservations()` (already exists, no signature change)
- Produces: walkable detour observation becomes a `ReelScenicCard` pushed directly after the anchor stop; removed from `allObservations`

**Root cause:** `buildWalkableDetourObservations()` produces `DayIntelObservation[]` that go into `allObservations`, which are only counted for the balance card gate — never rendered. Fix: convert each detour observation into a `ReelScenicCard` and push it into `cards` after the `a` stop (the origin stop of the walkable leg).

- [ ] **Step 1: Read `buildScenicCards` signature to copy the card shape**

The actual `ReelScenicCard` interface (in `types.ts`) requires: `type`, `sceneType`, `accent`, `cardType`, `pos`, `total`, `timing`, `metaRight`, `place`, `from`, `to`, `modeIcon`, `tag`, `vizType`, `persona`, `personaDisplay`, `personaIcon`, `why`, `sensory`, `sensoryIcon`, `reelPos`, `detourKm`, `detourMin`. Optional: `photoUrl`. The Step 4 code below sets all required fields.

- [ ] **Step 2: Write failing test**

Add to `src/modules/route/reel/reel-builder.test.ts`. First read the file to understand the existing test pattern, then add:

```ts
// Existing imports assumed — add if missing:
// import { buildReelCards } from './reel-builder';

describe('walkable detour card', () => {
  function makeStop(id: string, lat: number, lon: number, time = '09:00'): EngineItineraryStop {
    return {
      id, placeId: id, title: `Stop ${id}`, area: 'Centre', day: 1,
      time, durationMin: 90, category: 'museum', lat, lon,
      priceLevel: null, rating: null, weekdayText: null, whyForYou: '',
      localTip: null, googleMapsUrl: null, website: null, photoRef: null,
    };
  }

  it('emits a scenic card for a walkable leg when persona is non-walk', () => {
    const weights = { w_walk_affinity: 0.3, w_scenic: 0.7, w_efficiency: 0.5, w_food_density: 0.5, w_culture_depth: 0.5, w_nightlife: 0.3, w_budget_sensitivity: 0.3, w_crowd_aversion: 0.3, w_spontaneity: 0.3, w_rest_need: 0.3 };
    // Use the existing DAY and ITIN helpers defined at the top of this test file.
    const stops = [
      makeStop('s1', 48.860, 2.350, '09:00'),  // ~300m apart — walkable
      makeStop('s2', 48.863, 2.350, '11:00'),
    ];
    const day = { ...DAY('Paris', '2026-06-20', stops), walkBaseKm: 2.0 };
    const itinerary: EngineItinerary = {
      id: 'itin-test', generatedAt: '2026-06-20T00:00:00Z',
      city: 'Paris', cities: ['Paris'],
      personaSnapshot: weights,
      archetypeSnapshot: 'explorer',
      days: [day],
    };
    const cards = buildReelCards(itinerary, null, null, new Map(), 'explorer');
    const scenicCards = cards.filter(c => c.type === 'scenic');
    // Detour card for non-walk persona on a 0.33 km leg should appear
    expect(scenicCards.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run to confirm test currently passes or provides baseline**

```bash
npm test -- --reporter=verbose src/modules/route/reel/reel-builder.test.ts
```

Note the result — if the test already passes, the scenic card builder already handles this. If it fails, proceed to Step 4.

- [ ] **Step 4: Modify `reel-builder.ts` to convert detour obs into scenic cards**

In `reel-builder.ts`, in the day loop (around line 881), replace:

```ts
    const allObservations: DayIntelObservation[] = [
      ...engineObservations,
      ...(nextDayMergesIn ? [] : buildMealObservations(sortedStops, day.city)),
      ...buildPersonaObservations(sortedStops, persona, day.city, weights),
      ...(engineTriggers.has('walking_gap') ? [] : buildWalkingGapObservations(sortedStops, day.city, weights, day.walkBaseKm ?? 2.0)),
      ...buildWalkableDetourObservations(sortedStops, day.city, weights, day.walkBaseKm ?? 2.0),
      ...(engineTriggers.has('hidden_gem') ? [] : buildDiscoveryObservations(sortedStops, day.city)),
    ];
```

With:

```ts
    // Build walkable detour scenic cards — inserted after origin stop, excluded from group tray.
    // Build the map by matching obs.id against `walkable-detour-${a.id}-${b.id}` directly
    // (don't split the id string — stop IDs can contain hyphens).
    const detourObsList = buildWalkableDetourObservations(sortedStops, day.city, weights, day.walkBaseKm ?? 2.0);
    const detourByOriginStopId = new Map<string, DayIntelObservation>();
    for (let di = 0; di < sortedStops.length - 1; di++) {
      const a = sortedStops[di];
      const b = sortedStops[di + 1];
      const matched = detourObsList.find(o => o.id === `walkable-detour-${a.id}-${b.id}`);
      if (matched) detourByOriginStopId.set(a.id, matched);
    }

    const allObservations: DayIntelObservation[] = [
      ...engineObservations,
      ...(nextDayMergesIn ? [] : buildMealObservations(sortedStops, day.city)),
      ...buildPersonaObservations(sortedStops, persona, day.city, weights),
      ...(engineTriggers.has('walking_gap') ? [] : buildWalkingGapObservations(sortedStops, day.city, weights, day.walkBaseKm ?? 2.0)),
      // walkable_detour observations are now full-screen scenic cards — excluded from group tray
      ...(engineTriggers.has('hidden_gem') ? [] : buildDiscoveryObservations(sortedStops, day.city)),
    ];
```

Then in the per-stop loop where scenic cards are pushed (around line 990, after `if (scenicCard) cards.push(scenicCard);`), add:

```ts
      // Walkable detour scenic card (for non-walk personas) — placed after origin stop.
      // DayIntelObservation does NOT carry detourKm/detourMin — recompute from coordinates.
      const matchedDetour = detourByOriginStopId.get(stop.id);
      if (matchedDetour && !scenicCard) {
        const nextStop = sortedStops[si + 1];
        if (nextStop) {
          const distKm = haversineKm(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
          const walkMins = Math.max(1, Math.round((distKm / 5) * 60));
          const distLabel = distKm < 1 ? `${Math.round(distKm * 1000)} m walk` : `${distKm.toFixed(1)} km walk`;
          cards.push({
            type:        'scenic',
            sceneType:   'walk',
            accent:      '#c4b5fd',
            cardType:    'WALKABLE DETOUR',
            pos:         1,
            total:       1,
            timing:      minutesToTime(timeToMinutes(stop.time) + (stop.durationMin ?? 60)),
            metaRight:   `${distLabel} · ~${walkMins} min`,
            place:       `${stop.title} → ${nextStop.title}`,
            from:        stop.area ?? stop.title,
            to:          nextStop.area ?? nextStop.title,
            modeIcon:    'walk',
            tag:         'Worth the walk',
            vizType:     'route',
            persona,
            personaDisplay: persona.split(/[\s_]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            personaIcon: 'walk',
            why:         matchedDetour.why,
            sensory:     'See more between stops than you would from a ride.',
            sensoryIcon: 'directions_walk',
            reelPos:     `Between Stop ${globalStopNumber} and Stop ${globalStopNumber + 1}`,
            photoUrl:    stop.imageUrl ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 600) : null),
            detourKm:    Math.round(distKm * 10) / 10,
            detourMin:   walkMins,
          } as ReelScenicCard);
        }
      }
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --reporter=verbose src/modules/route/reel/reel-builder.test.ts
```

- [ ] **Step 6: Full suite**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/route/reel/reel-builder.ts src/modules/route/reel/reel-builder.test.ts
git commit -m "feat(reel): promote walkable detour from group tray chip to full-screen scenic card"
```

---

## Task 7: Photography detour card (golden hour + viewpoint)

**Files:**
- Create: `src/modules/route/reel/golden-hour.ts`
- Modify: `src/modules/route/reel/ItineraryReelScreen.tsx` — add `enrichPhotoMomentCards` async enrichment pass
- Modify: `src/modules/route/reel/types.ts` — add `photo_detour` to `RecoTrigger`

**Interfaces:**
- `computeGoldenHour(lat: number, lon: number, dateStr: string): Promise<string | null>` — returns `"HH:MM"` local golden hour start, or null if unavailable
- Cached in a module-level `Map<string, string>` keyed by `"lat,lon,date"`

**Approach:** Call the free `https://api.sunrise-sunset.org/json?lat=X&lng=Y&date=YYYY-MM-DD&formatted=0` API. Golden hour start = civil twilight start (about 45 min before sunset). No API key required.

**Card fires when:**
- Stop category is `viewpoint`, `beach`, `park`, or `observation_deck`
- Stop scheduled time overlaps with golden hour window (within 90 min after golden hour start)
- AND the stop is not already a `ReelScenicCard` at this position

- [ ] **Step 1: Create `golden-hour.ts`**

Create `src/modules/route/reel/golden-hour.ts`:

```ts
const cache = new Map<string, string | null>();

/**
 * Returns the golden hour start time as "HH:MM" in approximate local time.
 * Uses the free sunrise-sunset.org API (no key required).
 * The API returns UTC — we apply a longitude-based UTC offset estimate
 * (±30 min accuracy, good enough for a 90-min detection window).
 * Results are cached per lat/lon/date for the session lifetime.
 */
export async function computeGoldenHour(
  lat: number,
  lon: number,
  dateStr: string,
): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${dateStr}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${dateStr}&formatted=0`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) { cache.set(key, null); return null; }
    const json = await res.json() as { results?: { sunset?: string } };
    const sunsetIso = json.results?.sunset;
    if (!sunsetIso) { cache.set(key, null); return null; }

    // Convert UTC sunset to approximate local time via longitude offset
    const utcOffsetMs = Math.round(lon / 15) * 60 * 60 * 1000;
    const sunsetMs = new Date(sunsetIso).getTime();
    // Golden hour start = 45 min before sunset, in local time
    const goldenLocalMs = sunsetMs - 45 * 60 * 1000 + utcOffsetMs;
    const goldenLocal = new Date(goldenLocalMs);
    const hh = String(goldenLocal.getUTCHours()).padStart(2, '0');
    const mm = String(goldenLocal.getUTCMinutes()).padStart(2, '0');
    const result = `${hh}:${mm}`;
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
```

- [ ] **Step 2: Add `photo_detour` trigger to `types.ts`**

In `src/modules/route/reel/types.ts`, line 125, add `'photo_detour'` to `RecoTrigger`:

```ts
export type RecoTrigger =
  | 'lunch' | 'dinner' | 'evening' | 'culture' | 'rest'
  | 'weather' | 'closing_conflict' | 'walking_gap' | 'crowd_peak'
  | 'walkable_detour' | 'photo_detour'
  // New engine dimensions:
  | 'density_excess' | 'density_sparse' | 'geo_efficiency'
  | 'time_balance' | 'category_diversity' | 'social_gap'
  | 'budget_mismatch' | 'live_event' | 'hidden_gem' | 'famous_spots';
```

- [ ] **Step 3: Add photo moment card injection in `ItineraryReelScreen.tsx`**

The photography detour card fires when a viewpoint/beach/park stop happens to fall near golden hour. Because `computeGoldenHour` is async and `reel-builder.ts` is synchronous, this is implemented as a post-build async enrichment in `ItineraryReelScreen.tsx` — same pattern as transit enrichment at line 249.

**Do NOT modify `reel-builder.ts` for this task.** All changes for Task 7 are in `ItineraryReelScreen.tsx` and `golden-hour.ts`.

Create a new enrichment function in `ItineraryReelScreen.tsx`:

```ts
async function enrichPhotoMomentCards(
  built: ReelCard[],
): Promise<ReelCard[]> {
  const result = [...built];
  for (let i = 0; i < result.length; i++) {
    const card = result[i];
    if (card.type !== 'stop') continue;
    const PHOTO_CATS = new Set(['viewpoint', 'beach', 'park', 'observation_deck']);
    if (!PHOTO_CATS.has(card.stop.category)) continue;
    // Don't inject if a scenic card already follows this stop
    const next = result[i + 1];
    if (next?.type === 'scenic') continue;
    const dayCard = built.find((c) => c.type === 'day_divider') as ReelDayDividerCard | undefined;
    const dateStr = card.visitDate ?? dayCard?.date ?? '';
    if (!dateStr) continue;
    const goldenHour = await computeGoldenHour(card.stop.lat, card.stop.lon, dateStr);
    if (!goldenHour) continue;
    const stopMin = timeToMin(card.stop.time);
    const goldenMin = timeToMin(goldenHour);
    const endMin = stopMin + (card.stop.durationMin ?? 60);
    const windowEnd = goldenMin + 90;
    if (endMin < goldenMin || stopMin > windowEnd) continue;
    const goldenHourDisplay = formatGoldenHour(goldenHour);
    const momentCard: ReelScenicCard = {
      type:          'scenic',
      sceneType:     'walk',
      accent:        '#fbbf24',     // amber — photography / warm light
      cardType:      'GOLDEN HOUR',
      pos:           1,
      total:         1,
      timing:        goldenHourDisplay,
      metaRight:     `Golden hour · ${goldenHourDisplay}`,
      place:         card.stop.title,
      from:          card.stop.area ?? card.stop.title,
      to:            '',
      modeIcon:      'walk',
      tag:           'Photo moment',
      vizType:       'route',
      persona:       '',
      personaDisplay:'',
      personaIcon:   'camera',
      why:           `${card.stop.title} is framed perfectly at golden hour (${goldenHourDisplay}).`,
      sensory:       'The light will be perfect for photography during your visit.',
      sensoryIcon:   'camera',
      reelPos:       '',
      photoUrl:      card.stop.imageUrl ?? null,
      detourKm:      0,
      detourMin:     0,
    };
    result.splice(i + 1, 0, momentCard);
    i++; // skip the just-inserted card
  }
  return result;
}
```

Add helper at top of `ItineraryReelScreen.tsx`:
```ts
function timeToMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function formatGoldenHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
```

Add import:
```ts
import { computeGoldenHour } from './golden-hour';
import type { ReelScenicCard, ReelDayDividerCard } from './types';
```

Call it in the useEffect after transit enrichment (around line 249):
```ts
enrichScenicCardsWithTransit(filtered, apiBase).then(enriched => {
  if (cancelled) return;
  enrichPhotoMomentCards(enriched).then(withMoments => {
    if (cancelled) return;
    setCards(withMoments);
  });
  setCards(enriched);
});
```

Wait — this double-sets cards. Better approach: chain them:
```ts
enrichScenicCardsWithTransit(filtered, apiBase)
  .then(enriched => enrichPhotoMomentCards(enriched))
  .then(withMoments => {
    if (cancelled) return;
    setCards(withMoments);
  })
  .catch(() => { /* non-critical — show cards without photo moments */ });
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all existing tests pass. No new tests for this task (network-dependent; manual verify in browser).

- [ ] **Step 5: Commit**

```bash
git add src/modules/route/reel/golden-hour.ts src/modules/route/reel/types.ts src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat(reel): photo moment card for viewpoint/beach stops near golden hour"
```

---

## Task 8: Local food card — editorial city facts

**Files:**
- Create: `src/modules/route/reel/local-food-facts.ts`
- Modify: `src/modules/route/reel/types.ts` — add `local_food` to `RecoTrigger`
- Modify: `src/modules/route/reel/ReelRecoCard.tsx` — add `local_food` to `TRIGGER_CFG` and `TRIGGER_CATEGORY`
- Modify: `src/modules/route/reel/ItineraryReelScreen.tsx` — add TRIGGER_META entries (Step 3b), inject local food card in `buildFiltered` (Step 4)

**Interfaces:**
- `getLocalFoodFact(city: string): LocalFoodFact | null`
- `LocalFoodFact: { dish: string; context: string; where: string }`

**Card fires when:**
- Day has a `restaurant` or `street_food` stop, OR the persona archetype group is `sensory`/`cultural`
- AND the city has a local food fact in the editorial data

- [ ] **Step 1: Create `local-food-facts.ts`**

Create `src/modules/route/reel/local-food-facts.ts`:

```ts
export interface LocalFoodFact {
  dish: string;     // e.g. "Masala dosa"
  context: string;  // e.g. "A South Indian staple — crispy rice crepe with spiced potato filling"
  where: string;    // e.g. "Best near MTR or any Darshini-style restaurant"
}

const FACTS: Record<string, LocalFoodFact> = {
  'bangalore':     { dish: 'Masala dosa',         context: 'A South Indian staple — crispy rice crepe with spiced potato filling, served with sambar and coconut chutney.',       where: 'Any Darshini-style restaurant or MTR' },
  'mumbai':        { dish: 'Vada pav',             context: 'The city\'s street food icon — a spiced potato fritter in a bread roll, eaten by millions every day.',               where: 'Street stalls outside any railway station' },
  'delhi':         { dish: 'Chole bhature',        context: 'Puffed fried bread with spiced chickpea curry — the classic Delhi breakfast that keeps you full until evening.',        where: 'Old Delhi\'s Paranthe Wali Gali or any halwai' },
  'tokyo':         { dish: 'Tonkotsu ramen',        context: 'Rich pork bone broth, thin noodles, soft-boiled egg — a dish that takes 12+ hours to make and seconds to finish.',   where: 'Ramen alleys in Shinjuku or Hakata area' },
  'kyoto':         { dish: 'Kaiseki',               context: 'Multi-course haute cuisine built around seasonal ingredients — the meal equivalent of a tea ceremony.',               where: 'Nishiki Market area or a traditional ryokan' },
  'paris':         { dish: 'Steak frites',          context: 'The honest Paris brasserie meal — pan-seared entrecôte, thin crispy frites, a glass of Côtes du Rhône.',             where: 'Any neighbourhood brasserie away from tourist squares' },
  'rome':          { dish: 'Cacio e pepe',          context: 'Three ingredients, infinite precision: pasta, pecorino, black pepper. The Roman simplicity test for any trattoria.',  where: 'Testaccio neighbourhood or Trastevere trattorias' },
  'barcelona':     { dish: 'Pa amb tomàquet',       context: 'Bread rubbed with ripe tomato and olive oil — the Catalan staple that pairs with everything.',                        where: 'Any bar with a terrace in the Gothic Quarter' },
  'istanbul':      { dish: 'Simit',                 context: 'Sesame-crusted bread rings sold by street carts — the city\'s morning ritual since the 16th century.',               where: 'Any street cart near the Bosphorus or Grand Bazaar' },
  'new york':      { dish: 'Bagel with lox',        context: 'New York\'s defining breakfast — a hand-rolled bagel, cream cheese, cured salmon. Simple perfection.',               where: 'Any classic Jewish deli in the Lower East Side' },
  'mexico city':   { dish: 'Tacos al pastor',       context: 'Pork shaved from a vertical spit, pineapple, cilantro, onion — originally Lebanese, now definitively Mexican.',      where: 'Late-night taquerías near La Condesa or Roma Norte' },
  'bangkok':       { dish: 'Pad krapao',            context: 'Stir-fried meat with holy basil and bird\'s eye chili — Thailand\'s most-ordered dish, available everywhere.',        where: 'Any street cart or shophouse restaurant' },
  'singapore':     { dish: 'Hainanese chicken rice', context: 'Poached chicken, fragrant rice cooked in chicken stock, three dipping sauces — the dish that defines the city.',   where: 'Maxwell Food Centre or Tian Tian Hainanese Chicken Rice' },
  'hong kong':     { dish: 'Dim sum',               context: 'Small steamed and fried dishes shared over tea — a weekend ritual that families return to every Sunday.',            where: 'Tim Ho Wan or any cha chaan teng' },
  'london':        { dish: 'Fish and chips',        context: 'Battered cod, thick-cut chips, malt vinegar and mushy peas — still the best in a newspaper cone by the Thames.',    where: 'Poppies in Spitalfields or Rock & Sole Plaice in Covent Garden' },
  'lisbon':        { dish: 'Pastel de nata',        context: 'Custard tart in a flaky pastry shell, dusted with cinnamon — invented by monks in Belém in the 18th century.',       where: 'Pastéis de Belém or any neighbourhood pastelaria' },
  'copenhagen':    { dish: 'Smørrebrød',            context: 'Open-faced rye bread with pickled herring, egg, or roast beef — Danish lunch architecture elevated to art.',         where: 'Torvehallerne market or traditional lunch restaurants' },
  'amsterdam':     { dish: 'Stroopwafel',           context: 'Two waffle layers bonded by caramel syrup — best placed on a hot cup of coffee to soften the filling.',             where: 'Any Albert Heijn supermarket or Stroopwafel Bakery at the Nieuwmarkt' },
  'dubai':         { dish: 'Shawarma',              context: 'Levantine spiced meat rolled in flatbread with garlic sauce — the midnight staple of Dubai\'s side streets.',        where: 'Al Ustad Special Kabab in Deira or any Al Safadi branch' },
  'sydney':        { dish: 'Meat pie',              context: 'Australia\'s answer to fast food — beef filling in a shortcrust pastry shell, eaten with a squeeze of tomato sauce.', where: 'Harry\'s Cafe de Wheels near the Woolloomooloo finger wharf' },
};

export function getLocalFoodFact(city: string): LocalFoodFact | null {
  const key = city.toLowerCase().replace(/\s+/g, ' ').trim();
  return FACTS[key] ?? null;
}
```

- [ ] **Step 2: Add `local_food` to `RecoTrigger` in `types.ts`**

```ts
export type RecoTrigger =
  | 'lunch' | 'dinner' | 'evening' | 'culture' | 'rest'
  | 'weather' | 'closing_conflict' | 'walking_gap' | 'crowd_peak'
  | 'walkable_detour' | 'photo_detour' | 'local_food'
  // New engine dimensions:
  | 'density_excess' | 'density_sparse' | 'geo_efficiency'
  | 'time_balance' | 'category_diversity' | 'social_gap'
  | 'budget_mismatch' | 'live_event' | 'hidden_gem' | 'famous_spots';
```

- [ ] **Step 3: Add `local_food` to `TRIGGER_CFG` and `TRIGGER_CATEGORY` in `ReelRecoCard.tsx`**

In the `TRIGGER_CATEGORY` object:
```ts
  local_food: 'restaurant',
```

In the `TRIGGER_CFG` object:
```ts
  local_food: { icon: 'lunch_dining', color: '#c27c4a', bg: 'rgba(194,124,74,.08)', border: 'rgba(194,124,74,.2)', chipLabel: 'Local food', searchCategory: 'restaurant' },
```

- [ ] **Step 3b: Add `local_food` and `photo_detour` to `TRIGGER_META` in `ItineraryReelScreen.tsx`**

In the `TRIGGER_META` object at line ~579, add these two entries (without them the mini-chip falls back to `'Nearby'` label and gold icon):

```ts
      local_food:      { label: 'Local food',     icon: 'lunch_dining',   color: '#c27c4a' },
      photo_detour:    { label: 'Photo moment',   icon: 'camera',         color: '#9b8eb8' },
```

- [ ] **Step 4: Add local food card injection to `ItineraryReelScreen.tsx`'s `buildFiltered`**

In `buildFiltered` (around line 150, after the famous_spots injection), add:

```ts
        // Local food reco: inject if city has editorial fact and no food reco already present
        const hasFoodReco = recos.some(r => r.trigger === 'lunch' || r.trigger === 'dinner' || r.trigger === 'local_food');
        const foodFact = getLocalFoodFact(day.city);
        if (!hasFoodReco && foodFact && dayStops.length > 0) {
          const anchor = dayStops[Math.floor(dayStops.length / 2)];
          recos.push({
            type: 'reco',
            id: `local-food-${day.city}-${dayIdx}`,
            trigger: 'local_food' as RecoTrigger,
            label: foodFact.dish,
            consequence: `${foodFact.context} ${foodFact.where}.`,
            nearbyCity: day.city,
            persona: signal.archetype,
            afterStopId: anchor.id,
            weightScore: 0.45,
            stopLat: anchor.lat,
            stopLon: anchor.lon,
          });
        }
```

Add import at top of `ItineraryReelScreen.tsx`:
```ts
import { getLocalFoodFact } from './local-food-facts';
import type { RecoTrigger } from './types';
```

- [ ] **Step 5: Write test for `getLocalFoodFact`**

Create `src/modules/route/reel/local-food-facts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getLocalFoodFact } from './local-food-facts';

describe('getLocalFoodFact', () => {
  it('returns fact for known city', () => {
    const fact = getLocalFoodFact('Tokyo');
    expect(fact).not.toBeNull();
    expect(fact!.dish).toBe('Tonkotsu ramen');
  });

  it('is case-insensitive', () => {
    expect(getLocalFoodFact('PARIS')).not.toBeNull();
    expect(getLocalFoodFact('paris')).not.toBeNull();
  });

  it('returns null for unknown city', () => {
    expect(getLocalFoodFact('Nowhere City')).toBeNull();
  });

  it('returns bangalore fact', () => {
    const fact = getLocalFoodFact('Bangalore');
    expect(fact?.dish).toBe('Masala dosa');
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --reporter=verbose src/modules/route/reel/local-food-facts.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 7: Full suite**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git add src/modules/route/reel/local-food-facts.ts src/modules/route/reel/local-food-facts.test.ts src/modules/route/reel/types.ts src/modules/route/reel/ReelRecoCard.tsx src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat(reel): local food editorial card with 20-city dataset"
```

---

## Task 9: Local events from existing events API

**Files:**
- Modify: `src/modules/route/reel/ItineraryReelScreen.tsx` — call `api.events()` at build time, feed into signal
- Modify: `src/shared/store.tsx` — add `liveEvents: LiveEvent[]` state and `SET_LIVE_EVENTS` action
- Modify: `src/modules/route/reco-engine/signal.ts` — consume `liveEvents` from state
- Modify: `src/modules/route/reco-engine/profile.ts` — update `liveEventOverlap` target (Step 3b) and `computeLiveEvent()` (Step 4)
- Modify: `src/modules/route/reco-engine/profile.test.ts` — add `liveEvents: []` to `makeSignal` (Step 3a)
- Modify: `src/modules/route/reco-engine/engine.test.ts` — add `liveEvents: []` to `makeSignal` added in Task 5 (Step 3a)

**Interfaces:**
- `state.liveEvents: LiveEvent[]` (already defined in `types.ts:672`)
- `computeRecoSignal` uses `state.liveEvents` count to set `trip.hasNearbyEvents`
- `computeLiveEvent()` now checks `liveEvents.length > 0` in addition to `savedEvents`

**Current gap:** `api.events()` already exists in `api.ts` (line 282) and calls `/events?city=X&start_date=Y&end_date=Z`. But nothing calls it. The `live_event` reco trigger only fires when the user has manually saved events — almost never. Fix: call `api.events()` at itinerary-build time and store results, then feed them into the existing `computeLiveEvent()` logic.

- [ ] **Step 1: Add `liveEvents` to store**

In `src/shared/store.tsx`, in the `AppState` interface, add:
```ts
liveEvents: import('./types').LiveEvent[];
```

In `initialState`, add:
```ts
liveEvents: [],
```

In the action union, add:
```ts
| { type: 'SET_LIVE_EVENTS'; events: import('./types').LiveEvent[] }
```

In the reducer, add:
```ts
case 'SET_LIVE_EVENTS':
  return { ...state, liveEvents: action.events };
```

- [ ] **Step 2: Fetch events after itinerary build**

In `ItineraryReelScreen.tsx`, in the `useEffect` that builds the reel (after line 245 where `setCards(filtered)` is called), add an events fetch:

```ts
      // Fetch live events for all days in the trip.
      // Clear stale events first so a city change doesn't carry over previous results.
      dispatch({ type: 'SET_LIVE_EVENTS', events: [] });
      if (activeItinerary.days.length > 0) {
        const firstDay = activeItinerary.days[0];
        const lastDay = activeItinerary.days[activeItinerary.days.length - 1];
        const primaryCity = activeItinerary.city ?? activeItinerary.cities?.[0] ?? '';
        if (primaryCity && firstDay.date && lastDay.date) {
          api.events(primaryCity, firstDay.date, lastDay.date)
            .then((places) => {
              if (cancelled) return;
              // Convert Place[] to LiveEvent[] shape.
              // Place.title (not .name), Place.id is required, Place.lat/lon are non-nullable.
              // No googleMapsUrl on Place — use place_id to build a Maps URL.
              // date is left empty so computeLiveEvent matches on title presence, not specific date.
              const events: import('../../../shared/types').LiveEvent[] = places.map(p => ({
                id:         p.place_id ?? p.id,
                title:      p.title,
                lat:        p.lat,
                lon:        p.lon,
                venueName:  p.title,
                date:       '',
                time:       '',
                genre:      p.category ?? '',
                url:        p.place_id ? `https://www.google.com/maps/place/?q=place_id:${p.place_id}` : '',
                imageUrl:   p.imageUrl ?? null,
              }));
              dispatch({ type: 'SET_LIVE_EVENTS', events });
            })
            .catch(() => { /* non-critical — events just won't show */ });
        }
      }
```

- [ ] **Step 3: Update `computeRecoSignal` to include `liveEvents`**

In `src/modules/route/reco-engine/signal.ts`, update the state Pick type to include `liveEvents`:

```ts
export function computeRecoSignal(
  state: Pick<AppState, 'rawOBAnswers' | 'persona' | 'travelStartDate' | 'tripContext' | 'weather' | 'savedEvents' | 'dismissedPinIds' | 'pendingTripDetails' | 'journey' | 'liveEvents'>,
```

Add `liveEvents: state.liveEvents` to the returned signal:
```ts
    savedEvents: state.savedEvents,
    liveEvents: state.liveEvents ?? [],
```

Update `RecoSignal` interface in `signal.ts` — add `liveEvents` as a properly typed field so `profile.ts` can access it without casting:
```ts
  liveEvents: import('../../../shared/types').LiveEvent[];
```

- [ ] **Step 3a: Update `makeSignal` test helpers that construct `RecoSignal` to include `liveEvents: []`**

Adding `liveEvents` as a required field to `RecoSignal` (Step 3) will break all test helpers that build `RecoSignal` objects manually. Update both files:

In `src/modules/route/reco-engine/profile.test.ts`, the `makeSignal` function body must add `liveEvents: []`:
```ts
function makeSignal(overrides: Partial<RecoSignal> = {}): RecoSignal {
  return {
    // … existing fields …
    dismissedPinIds: new Set(), savedEvents: [],
    liveEvents: [],   // ← add this line
    ...overrides,
  };
}
```

In `src/modules/route/reco-engine/engine.test.ts`, the `makeSignal` function added by Task 5 must also add `liveEvents: []`:
```ts
  function makeSignal(archetypeGroup: string): RecoSignal {
    return {
      // … existing fields …
      dismissedPinIds: new Set(), savedEvents: [],
      liveEvents: [],   // ← add this line
    };
  }
```

Run `npm test` to confirm no TypeScript errors after adding these.

- [ ] **Step 3b: Update `liveEventOverlap` target in `computeTargetProfile` to include live events**

`detectGaps` (engine.ts line 39) skips any dimension with `null` target. `liveEventOverlap` target is currently null when no saved/dismissed events exist, so the `live_event` reco never fires from API-fetched events. Fix line 72 in `profile.ts`:

Replace:
```ts
    liveEventOverlap:   signal.savedEvents.length > 0 || signal.dismissedPinIds.size > 0 ? signal.spontaneityBias : null,
```

With:
```ts
    liveEventOverlap:   signal.savedEvents.length > 0 || signal.dismissedPinIds.size > 0 || signal.liveEvents.length > 0 ? signal.spontaneityBias : null,
```

- [ ] **Step 4: Update `computeLiveEvent` in `profile.ts` to also check `liveEvents`**

Replace `computeLiveEvent()`. Use `signal.liveEvents` directly — it is properly typed by Step 3:

```ts
function computeLiveEvent(stops: EngineItineraryStop[], signal: RecoSignal): number | null {
  const { savedEvents, liveEvents, trip } = signal;

  if (savedEvents.length === 0 && signal.dismissedPinIds.size === 0 && liveEvents.length === 0) return null;

  const stopTitles = new Set(stops.map(s => s.title.toLowerCase()));

  const unaddedSaved = savedEvents.filter(e => {
    const dateMatch = e.date === trip.currentDayDate ||
      (e.isAnnual && e.date?.slice(5) === trip.currentDayDate?.slice(5));
    return dateMatch && !stopTitles.has(e.title.toLowerCase());
  });

  // Live events fetched from API: date is '' (trip-wide fetch) so match on title absence only.
  const unaddedLive = liveEvents.filter(e => !stopTitles.has(e.title.toLowerCase()));

  const totalUnadded = unaddedSaved.length + unaddedLive.length;
  return totalUnadded === 0 ? null : Math.min(1, totalUnadded * 0.5);
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/store.tsx src/modules/route/reco-engine/signal.ts src/modules/route/reco-engine/profile.ts src/modules/route/reel/ItineraryReelScreen.tsx src/modules/route/reco-engine/profile.test.ts src/modules/route/reco-engine/engine.test.ts
git commit -m "feat(reel): fetch live events via existing events API and surface in liveEventOverlap dimension"
```

---

## Task 10: Offbeat / locals know — improve `hidden_gem` card specificity

**Files:**
- Modify: `src/modules/route/reco-engine/engine.ts` — personalize `hidden_gem` card label and consequence per archetype group
- Modify: `src/modules/route/reel/ItineraryReelScreen.tsx` — add `walkable_detour` to TRIGGER_META and `CONTEXTUAL_IMAGES`

**Interfaces:**
- No new types — improves the existing `hidden_gem` reco card text and mini-chip presentation

**Root cause:** All `hidden_gem` cards say "A local spot worth knowing about" with the same copy for every city and persona. A cultural traveller wants a different "local spot" than a foodie. The `hidden_gem` card also lacks a contextual image.

**Fixes:**
1. In `gapToCard()`, replace the static `hidden_gem` template with archetype-group-aware copy
2. Add `hidden_gem` and `walkable_detour` entries to `CONTEXTUAL_IMAGES` in `ItineraryReelScreen.tsx`

- [ ] **Step 1: Update `hidden_gem` template in `engine.ts`**

In `gapToCard()` (line ~187), replace:
```ts
    hasHiddenGem: {
      trigger: 'hidden_gem',
      label: 'A local spot worth knowing about',
      consequence: `Close to your route — the kind of place most visitors walk past.`,
    },
```

With:
```ts
    hasHiddenGem: {
      trigger: 'hidden_gem',
      label: (() => {
        const GROUP_LABEL: Record<string, string> = {
          cultural: 'A lesser-known cultural gem',
          sensory:  'A local haunt worth finding',
          social:   'Where locals actually go',
          explorer: 'Off the tourist trail',
        };
        return GROUP_LABEL[signal.archetypeGroup] ?? 'A local spot worth knowing about';
      })(),
      consequence: (() => {
        const GROUP_COPY: Record<string, string> = {
          cultural: `A spot near ${area} that locals visit but guidebooks miss.`,
          sensory:  `A neighbourhood find near ${area} — the kind that rewards wandering.`,
          social:   `Near ${area} — frequented by locals, rarely listed on review apps.`,
          explorer: `Close to your route near ${area} — the kind of place most visitors walk past.`,
        };
        return GROUP_COPY[signal.archetypeGroup] ?? `Close to your route — the kind of place most visitors walk past.`;
      })(),
    },
```

- [ ] **Step 2: Add `walkable_detour` to TRIGGER_META in `ItineraryReelScreen.tsx`**

In `displayCards` computation (around line 584), in `TRIGGER_META`, add:
```ts
      walkable_detour:   { label: 'Worth the walk',    icon: 'directions_walk', color: '#8b9e6a' },
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/route/reco-engine/engine.ts src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat(reco): personalize hidden_gem copy per archetype group, add walkable_detour chip meta"
```

---

## Task 11: Badges — larger, missing `badgePopSage` animation

**Files:**
- Modify: `src/modules/route/reel/ReelStopCard.tsx` — enlarge chipBase, add missing badgePopSage keyframe

**Background:** The user said: "I want the badge to be more prominent and can you animate it a bit. just slightly. like jumping or light popping around it."

**Actual current state** (verified from `ReelStopCard.tsx:257–263, 506–515, 657–658, 755–756`):
- `chipBase`: `padding: '5px 10px', borderRadius: 6, fontSize: T.fsXs (13)` — too small
- Top panel "Your pick" (line 657): already has `animation: 'badgePopOrange 4s ease-in-out 1s infinite'` with 1.5px border ✅
- Top panel "We added this" (line 658): already has `animation: 'badgePopBlue 4s ease-in-out 1s infinite'` with 1.5px border ✅
- Bottom/expanded panel "We added this" (line 756): references `animation: 'badgePopSage...'` with sage/green colors — but `@keyframes badgePopSage` is **never defined in the `<style>` block** — so this badge has no animation ❌
- Keyframes live in an inline `<style>` tag inside the JSX (lines 506–515), NOT in `index.css`

**Exact changes needed:**
1. Enlarge `chipBase`: `padding: '5px 10px'` → `'7px 13px'`, `borderRadius: 6` → `8`, `fontSize: T.fsXs` → `14`
2. Add `@keyframes badgePopSage` to the inline `<style>` block (alongside the existing Orange and Blue keyframes)
3. No changes to `index.css` — keyframes are managed inline

- [ ] **Step 1: Update `chipBase` at `ReelStopCard.tsx:257–263`**

Replace:
```ts
const chipBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', borderRadius: 6,
  fontSize: T.fsXs, fontWeight: 700,
  letterSpacing: '.07em', textTransform: 'uppercase',
  backdropFilter: 'blur(8px)',
};
```

With:
```ts
const chipBase: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 13px', borderRadius: 8,
  fontSize: 14, fontWeight: 700,
  letterSpacing: '.07em', textTransform: 'uppercase',
  backdropFilter: 'blur(8px)',
};
```

- [ ] **Step 2: Add `badgePopSage` keyframe to the inline `<style>` block at `ReelStopCard.tsx:506–515`**

Replace:
```ts
      <style>{`
        @keyframes badgePopOrange {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(224,120,64,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(224,120,64,0.28); }
        }
        @keyframes badgePopBlue {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(91,155,213,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(91,155,213,0.24); }
        }
      `}</style>
```

With:
```ts
      <style>{`
        @keyframes badgePopOrange {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(224,120,64,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(224,120,64,0.28); }
        }
        @keyframes badgePopBlue {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(91,155,213,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(91,155,213,0.24); }
        }
        @keyframes badgePopSage {
          0%, 60%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(107,148,112,0); }
          30%            { transform: scale(1.08); box-shadow: 0 0 0 7px rgba(107,148,112,0.24); }
        }
      `}</style>
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Visual verification**

```bash
npm run dev
```

Open the app, build an itinerary, open the reel, and check stop badges. Confirm:
- Badges are visibly larger (7px padding vs 5px before)
- All three badge types animate (orange for "Your pick", blue for top "We added this", sage for expanded "We added this")
- Animation is subtle — scale 1.08 pulse with a ring glow, loops every 4s

- [ ] **Step 5: Commit**

```bash
git add src/modules/route/reel/ReelStopCard.tsx
git commit -m "feat(reel): enlarge badge chipBase and add missing badgePopSage keyframe"
```

---

## Self-Review

**Spec coverage check:**
1. ✅ Fix lunch/dinner windows — Task 1
2. ✅ hasRest cafe fix — Task 1 (Step 5)
3. ✅ Stale reco cache — Task 3 (included in Task 4 full file; skip Task 3 when implementing sequentially)
4. ✅ Hotel arrival/departure clipping — Task 2
5. ✅ Card photo from Google Places — Task 4
6. ✅ Walkable detour full-screen card — Task 6
7. ✅ Photography detour / photo moment card — Task 7
8. ✅ Local events API — Task 9
9. ✅ Photo moment stop timing — Task 7
10. ✅ Local food card — Task 8
11. ✅ Persona-aligned floor reco — Task 5
12. ✅ Badge animation + prominence — Task 11

**Placeholder scan:** None found. All code is complete.

**Type consistency check:**
- `RecoTrigger` extended in Task 7 (`photo_detour`) and Task 8 (`local_food`) — both in `types.ts`
- `TRIGGER_META` in `ItineraryReelScreen.tsx` updated for `walkable_detour` (Task 10), `local_food`, `photo_detour` (Task 8 Step 3b)
- `useReelRecommendations` return type: Task 4's full file includes Task 3 cache fix; Task 3 implementers skip if doing tasks in order
- `liveEvents: LiveEvent[]` added to `RecoSignal` interface in `signal.ts` (Task 9 Step 3) — `profile.ts` accesses via `signal.liveEvents` (no `any` cast)
- `haversineKm` in Task 6 is a module-level function in `reel-builder.ts` (line 141) — no import needed
- `badgePopSage` keyframe (Task 11) lives in the component's inline `<style>` tag, NOT in `index.css`
- `Place.title` (not `.name`) and `Place.lat`/`.lon` are non-nullable — Task 9 conversion uses `.title` and drops the null-filter
- `ReelScenicCard` in Tasks 6 and 7 now includes all required fields: `sceneType`, `accent`, `cardType`, `pos`, `total`, `timing` — rendered by `ReelScenicCard.tsx` lines 389–441
- Task 6 `makeStop` uses `category: Category` (not `string`) and imports `Category` from `shared/types`
- Task 6 test `buildReelCards` call passes `persona: 'explorer'` as 5th argument and uses `DAY()`/`id`/`generatedAt` from existing helpers
- Task 9 Step 3a updates `makeSignal()` helpers in `profile.test.ts` and `engine.test.ts` to include `liveEvents: []` after adding `liveEvents` to `RecoSignal`
- `timeToMin` in Task 2 replacement uses the module-scope definition from `profile.ts:30` — no redefinition inside function
- Task 7 changes are in `ItineraryReelScreen.tsx` and `golden-hour.ts` only — `reel-builder.ts` is not modified for this task
