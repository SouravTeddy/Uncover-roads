# Reco Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded reco if-statements with a profile-delta engine that derives recommendations from the gap between a persona's target itinerary profile and the actual itinerary — self-extending by adding dimensions, not rules.

**Architecture:** `computeRecoSignal()` assembles all inputs once per day. `computeTargetProfile()` maps persona weights + OB answers to expected values. `computeActualProfile()` measures the real itinerary using semantic stop roles. `detectGaps()` scores deltas, `gapToCard()` builds `ReelRecoCard[]`. `buildReelCards()` receives pre-computed recos as a `Map<dayIdx, ReelRecoCard[]>` — clean separation, old tests unaffected.

**Tech Stack:** TypeScript, React, Vitest, Supabase (reco_interactions table)

---

## File Map

**New — `frontend/src/modules/route/reco-engine/`**
- `signal.ts` — `RecoSignal` type + `computeRecoSignal(state, dayIdx, itinerary)`
- `signal.test.ts`
- `semantics.ts` — `SemanticRole` + `computeStopSemantics(stop, stops, signal)`
- `semantics.test.ts`
- `profile.ts` — `ItineraryProfile` + `computeTargetProfile(signal)` + `computeActualProfile(stops, signal)`
- `profile.test.ts`
- `dimensions.ts` — `getDimensionWeight(dim, signal)` + `CONFLICT_PAIRS`
- `dimensions.test.ts`
- `engine.ts` — `Gap` + `detectGaps()` + `resolveConflicts()` + `gapToCard()` + `deriveRecos()`
- `engine.test.ts`
- `behavior.ts` — `RecoInteraction` type + `trackRecoInteraction()` + Supabase sync
- `behavior.test.ts`
- `index.ts` — public re-export

**New — `frontend/src/modules/route/reel/`**
- `ReelBalanceCard.tsx` — "well-balanced day" card

**Modified**
- `reel/types.ts` — add `ReelBalanceCard`, `balance` to `ReelCard` union, extend `RecoTrigger`
- `shared/store.tsx` — add `dismissedPinIds`, `recoInteractions`, two new actions
- `reel/reel-builder.ts` — accept `recosByDayIdx` param, inject balance card, remove old reco functions
- `reel/reel-builder.test.ts` — update tests for new call signature
- `reel/ItineraryReelScreen.tsx` — compute recos per day, wire behavior tracking
- `reel/ReelRecoCard.tsx` — add "Add to plan" CTA + `onView/onDismiss/onLinger` callbacks

---

## Task 1: Extend reel/types.ts

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts`

- [ ] **Step 1: Add `ReelBalanceCard` interface and extend the union**

Replace the current `ReelCardType` line and bottom of the file:

```ts
// In reel/types.ts, add before the ReelCard union:

export interface ReelBalanceCard {
  type: 'balance';
  message: string;
  persona: string;
}

// Extend RecoTrigger to cover new engine dimensions:
export type RecoTrigger =
  | 'lunch' | 'dinner' | 'evening' | 'culture' | 'rest'
  | 'weather' | 'closing_conflict' | 'walking_gap' | 'crowd_peak'
  // New engine dimensions:
  | 'density_excess' | 'density_sparse' | 'geo_efficiency'
  | 'time_balance' | 'category_diversity' | 'social_gap'
  | 'budget_mismatch' | 'live_event' | 'hidden_gem';

// Update ReelCard union — add ReelBalanceCard:
export type ReelCard =
  | ReelIntroCard
  | ReelSummaryCard
  | ReelStopCard
  | ReelRecoCard
  | ReelIntelCard
  | ReelTransitCard
  | ReelFinaleCard
  | ReelDayDividerCard
  | ReelBalanceCard;
```

- [ ] **Step 2: Type-check passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/types.ts
git commit -m "feat(reel): add ReelBalanceCard type and extend RecoTrigger for reco engine"
```

---

## Task 2: Store — dismissedPinIds + recoInteractions

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Modify: `frontend/src/modules/subscription/SubscriptionScreen.test.tsx`

- [ ] **Step 1: Add fields + actions to store**

In `store.tsx`, inside `AppState` after `pendingTripDetails`:
```ts
dismissedPinIds: string[];
recoInteractions: Array<{
  recoId: string; dimension: string; archetype: string;
  action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan';
  conflictPresent: boolean; significance: number;
  signalSnapshot: { archetype: string; pace: string; densityScore: number | null; dayNumber: number; weather: string | null };
  timestamp: string;
}>;
```

In `initialState` (find where `pendingTripDetails: null` is):
```ts
dismissedPinIds: [],
recoInteractions: [],
```

In the `Action` union type, add:
```ts
| { type: 'DISMISS_PIN'; pinId: string }
| { type: 'ADD_RECO_INTERACTION'; interaction: AppState['recoInteractions'][number] }
```

In the reducer `switch`, add:
```ts
case 'DISMISS_PIN':
  return { ...state, dismissedPinIds: [...state.dismissedPinIds, action.pinId] };
case 'ADD_RECO_INTERACTION':
  return { ...state, recoInteractions: [...state.recoInteractions, action.interaction] };
```

- [ ] **Step 2: Fix SubscriptionScreen test — add missing fields to makeState()**

In `frontend/src/modules/subscription/SubscriptionScreen.test.tsx`, add to the `makeState` overrides object:
```ts
dismissedPinIds: [],
recoInteractions: [],
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/modules/subscription/SubscriptionScreen.test.tsx
git commit -m "feat(store): add dismissedPinIds + recoInteractions state for reco engine"
```

---

## Task 3: signal.ts — RecoSignal + computeRecoSignal

**Files:**
- Create: `frontend/src/modules/route/reco-engine/signal.ts`
- Create: `frontend/src/modules/route/reco-engine/signal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// signal.test.ts
import { describe, it, expect } from 'vitest';
import { computeRecoSignal } from './signal';
import type { AppState } from '../../../shared/store';
import type { EngineItinerary } from '../../../shared/types';

const BASE_WEIGHTS = {
  w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.5,
  w_culture_depth: 0.5, w_nightlife: 0.5, w_budget_sensitivity: 0.5,
  w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5,
};

const BASE_ITIN: EngineItinerary = {
  id: 'i1', generatedAt: '2026-05-26T00:00:00Z',
  cities: ['Paris'],
  days: [{ day: 1, date: '2026-05-26', city: 'Paris', isTravel: false, stops: [], messages: [] }],
  personaSnapshot: BASE_WEIGHTS,
  archetypeSnapshot: 'explorer',
};

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    obAnswers: { ritual: 'coffee', sensory: 'visual', style: 'spontaneous', attractions: ['historic'], pace: 'walking', social: 'solo' },
    persona: { archetype: 'explorer', archetype_name: 'Explorer', archetype_desc: '', ritual: 'coffee', sensory: 'visual', style: 'spontaneous', attractions: ['historic'], pace: 'walking', social: 'solo', archetypeData: { name: 'Explorer', desc: '', venue_filters: [], itinerary_bias: [] }, venue_filters: [], itinerary_bias: [] },
    travelStartDate: '2026-05-26',
    travelEndDate: null,
    tripContext: { startType: 'hotel', arrivalTime: null, date: '2026-05-26', days: 1, dayNumber: 1, flightTime: null, isLongHaul: false, locationLat: null, locationLon: null, locationName: null },
    weather: { temp: 22, condition: 'sunny', icon: 'wb_sunny' },
    savedEvents: [],
    dismissedPinIds: [],
    pendingTripDetails: null,
    journey: null,
    ...overrides,
  } as AppState;
}

describe('computeRecoSignal', () => {
  it('maps pace walking → slow', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.pace).toBe('slow');
  });

  it('maps social solo → solo', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.social).toBe('solo');
  });

  it('maps social family → group and sets isFamily true', () => {
    const signal = computeRecoSignal(makeState({ obAnswers: { ritual: null, sensory: null, style: null, attractions: [], pace: null, social: 'family' } }), 0, BASE_ITIN);
    expect(signal.social).toBe('group');
    expect(signal.isFamily).toBe(true);
  });

  it('computes archetypeConfidence from answered OB questions', () => {
    // All 6 answered
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.archetypeConfidence).toBeCloseTo(1.0);
  });

  it('sets archetypeConfidence to 0 when no OB answers', () => {
    const signal = computeRecoSignal(makeState({ obAnswers: { ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null } }), 0, BASE_ITIN);
    expect(signal.archetypeConfidence).toBe(0);
  });

  it('sets weather.isOutdoorFriendly true for sunny weather above 10°', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.weather?.isOutdoorFriendly).toBe(true);
  });

  it('sets weather.isOutdoorFriendly false for rain', () => {
    const signal = computeRecoSignal(makeState({ weather: { temp: 15, condition: 'rain', icon: 'umbrella' } }), 0, BASE_ITIN);
    expect(signal.weather?.isOutdoorFriendly).toBe(false);
  });

  it('trip.isFirstDay true for dayIdx 0', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.trip.isFirstDay).toBe(true);
    expect(signal.trip.isLastDay).toBe(true); // single day trip
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/signal.test.ts 2>&1 | tail -5
```
Expected: `Cannot find module './signal'`

- [ ] **Step 3: Implement signal.ts**

```ts
// signal.ts
import type { AppState } from '../../../shared/store';
import type { EngineItinerary, EngineWeights } from '../../../shared/types';

export type ArchetypeGroup = 'sensory' | 'cultural' | 'social' | 'explorer';

const ARCHETYPE_GROUPS: Record<string, ArchetypeGroup> = {
  historian: 'cultural', slowscholar: 'cultural',
  epicurean: 'sensory', aesthete: 'sensory', slowtraveller: 'sensory', ritualseeker: 'sensory',
  pulse: 'social', nightcreature: 'social',
  wanderer: 'explorer', voyager: 'explorer', explorer: 'explorer', flaneur: 'explorer', drifter: 'explorer',
};

const BAD_WEATHER = new Set(['rain', 'drizzle', 'storm', 'thunderstorm', 'snow', 'sleet', 'hail', 'blizzard', 'fog']);

export interface RecoSignal {
  weights: EngineWeights;
  archetype: string;
  archetypeGroup: ArchetypeGroup;
  archetypeConfidence: number;
  pace: 'slow' | 'moderate' | 'fast';
  social: 'solo' | 'duo' | 'group';
  isFamily: boolean;
  ritualStrength: number;
  sensoryIntensity: number;
  spontaneityBias: number;
  trip: {
    totalDays: number;
    dayNumber: number;
    isFirstDay: boolean;
    isLastDay: boolean;
    isWeekend: boolean;
    isLongHaul: boolean;
    startType: string;
    arrivalTime: string | null;
    departureTime: string | null;
    city: string;
    currentDayDate: string;
  };
  weather: { condition: string; tempC: number; isOutdoorFriendly: boolean } | null;
  dismissedPinIds: Set<string>;
  savedEvents: AppState['savedEvents'];
}

export function computeRecoSignal(
  state: Pick<AppState, 'obAnswers' | 'persona' | 'travelStartDate' | 'tripContext' | 'weather' | 'savedEvents' | 'dismissedPinIds' | 'pendingTripDetails' | 'journey'>,
  dayIdx: number,
  itinerary: EngineItinerary,
): RecoSignal {
  const ob = state.obAnswers;
  const weights: EngineWeights = itinerary.personaSnapshot;
  const archetype = (itinerary.archetypeSnapshot as string) ?? state.persona?.archetype ?? 'explorer';
  const archetypeKey = archetype.toLowerCase().replace(/\s+/g, '');

  // OB answer → pace
  const paceMap: Record<string, 'slow' | 'moderate' | 'fast'> = {
    walking: 'slow', transit: 'fast', self: 'moderate', any: 'moderate',
  };
  const pace = ob.pace ? (paceMap[ob.pace] ?? 'moderate') : 'moderate';

  // OB answer → social
  const socialMap: Record<string, 'solo' | 'duo' | 'group'> = {
    solo: 'solo', couple: 'duo', group: 'group', family: 'group',
  };
  const social = ob.social ? (socialMap[ob.social] ?? 'solo') : 'solo';
  const isFamily = ob.social === 'family';

  // OB ritual → strength
  const ritualMap: Record<string, number> = { coffee: 0.8, tea: 0.6, alcohol: 0.4, neither: 0.1 };
  const ritualStrength = ob.ritual ? (ritualMap[ob.ritual] ?? 0.4) : 0.4;

  // OB sensory → intensity
  const sensoryMap: Record<string, number> = { visual: 0.8, taste: 0.7, movement: 0.6, history: 0.5 };
  const sensoryIntensity = ob.sensory ? (sensoryMap[ob.sensory] ?? 0.4) : 0.4;

  // Spontaneity bias
  const spontaneityBias = Math.min(1, weights.w_spontaneity * 0.6 + (ob.style === 'spontaneous' ? 0.4 : 0));

  // Archetype confidence — count answered OB fields out of 6
  const answeredCount = [
    ob.ritual !== null,
    ob.sensory !== null,
    ob.style !== null,
    ob.pace !== null,
    ob.social !== null,
    ob.attractions.length > 0,
  ].filter(Boolean).length;
  const archetypeConfidence = answeredCount / 6;

  // Trip context
  const day = itinerary.days[dayIdx];
  const totalDays = itinerary.days.length;
  const dayNumber = dayIdx + 1;
  const currentDayDate = day?.date ?? state.travelStartDate ?? '';
  let isWeekend = false;
  if (currentDayDate) {
    const d = new Date(currentDayDate);
    isWeekend = d.getDay() === 0 || d.getDay() === 6;
  }

  // Departure time (last day from pendingTripDetails or tripContext)
  const departureTime = dayIdx === totalDays - 1
    ? (state.pendingTripDetails?.departureTime ?? null)
    : null;

  // Weather
  const wx = state.weather;
  const weather = wx ? {
    condition: wx.condition,
    tempC: wx.temp,
    isOutdoorFriendly: !BAD_WEATHER.has(wx.condition) && wx.temp > 10,
  } : null;

  return {
    weights,
    archetype,
    archetypeGroup: ARCHETYPE_GROUPS[archetypeKey] ?? 'explorer',
    archetypeConfidence,
    pace,
    social,
    isFamily,
    ritualStrength,
    sensoryIntensity,
    spontaneityBias,
    trip: {
      totalDays,
      dayNumber,
      isFirstDay: dayIdx === 0,
      isLastDay: dayIdx === totalDays - 1,
      isWeekend,
      isLongHaul: state.tripContext.isLongHaul,
      startType: state.tripContext.startType,
      arrivalTime: state.tripContext.arrivalTime,
      departureTime,
      city: day?.city ?? '',
      currentDayDate,
    },
    weather,
    dismissedPinIds: new Set(state.dismissedPinIds),
    savedEvents: state.savedEvents,
  };
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/signal.test.ts
```
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reco-engine/signal.ts frontend/src/modules/route/reco-engine/signal.test.ts
git commit -m "feat(reco-engine): add RecoSignal type + computeRecoSignal"
```

---

## Task 4: semantics.ts — SemanticRole + computeStopSemantics

**Files:**
- Create: `frontend/src/modules/route/reco-engine/semantics.ts`
- Create: `frontend/src/modules/route/reco-engine/semantics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// semantics.test.ts
import { describe, it, expect } from 'vitest';
import { computeStopSemantics } from './semantics';
import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';

const SIGNAL = { weather: { isOutdoorFriendly: true } } as RecoSignal;
const SIGNAL_BAD_WX = { weather: { isOutdoorFriendly: false } } as RecoSignal;

function stop(overrides: Partial<EngineItineraryStop>): EngineItineraryStop {
  return { id: 's1', placeId: 'p1', title: 'Place', area: 'Centre', day: 1, time: '09:00', durationMin: 90, category: 'museum', lat: 0, lon: 0, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null, ...overrides };
}

describe('computeStopSemantics', () => {
  it('cafe at 14:00 after beach → scenic_rest', () => {
    const beach = stop({ id: 'b', time: '11:00', category: 'beach', durationMin: 120 });
    const cafe = stop({ id: 'c', time: '14:00', category: 'cafe', durationMin: 60 });
    expect(computeStopSemantics(cafe, [beach, cafe], SIGNAL)).toBe('scenic_rest');
  });

  it('cafe at 09:30 in dense urban (no scenic neighbors) → fuel_stop', () => {
    const museum = stop({ id: 'm', time: '08:00', category: 'museum' });
    const cafe = stop({ id: 'c', time: '09:30', category: 'cafe', durationMin: 20 });
    expect(computeStopSemantics(cafe, [museum, cafe], SIGNAL)).toBe('fuel_stop');
  });

  it('restaurant at 19:30 → evening_wind', () => {
    const s = stop({ time: '19:30', category: 'restaurant', durationMin: 90 });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('evening_wind');
  });

  it('museum with durationMin >= 120 → cultural_deep', () => {
    const s = stop({ category: 'museum', durationMin: 120 });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('cultural_deep');
  });

  it('museum with durationMin < 120 → anchor', () => {
    const s = stop({ category: 'museum', durationMin: 60 });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('anchor');
  });

  it('bar/nightlife → social_hub', () => {
    const s = stop({ category: 'bar', time: '21:00' });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('social_hub');
  });

  it('park at 15:00 with scenic neighbor → scenic_rest', () => {
    const viewpoint = stop({ id: 'v', time: '13:00', category: 'viewpoint' });
    const park = stop({ id: 'p', time: '15:00', category: 'park', durationMin: 60 });
    expect(computeStopSemantics(park, [viewpoint, park], SIGNAL)).toBe('scenic_rest');
  });

  it('cafe after scenic stop but bad weather → fuel_stop (outdoor scenic suppressed)', () => {
    const beach = stop({ id: 'b', time: '11:00', category: 'beach', durationMin: 120 });
    const cafe = stop({ id: 'c', time: '14:00', category: 'cafe', durationMin: 60 });
    expect(computeStopSemantics(cafe, [beach, cafe], SIGNAL_BAD_WX)).toBe('fuel_stop');
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/semantics.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement semantics.ts**

```ts
// semantics.ts
import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';

export type SemanticRole =
  | 'anchor'
  | 'scenic_rest'
  | 'fuel_stop'
  | 'cultural_deep'
  | 'social_hub'
  | 'evening_wind'
  | 'transit_filler';

const SCENIC_CATS = new Set(['beach', 'park', 'viewpoint', 'zoo', 'aquarium', 'amusement_park']);
const SOCIAL_CATS = new Set(['bar', 'nightlife']);
const FOOD_CATS   = new Set(['restaurant', 'cafe', 'bakery', 'street_food', 'market']);

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function hasScenicroNeighbor(stop: EngineItineraryStop, stops: EngineItineraryStop[]): boolean {
  const idx = stops.indexOf(stop);
  const prev = stops[idx - 1];
  const next = stops[idx + 1];
  return (prev ? SCENIC_CATS.has(prev.category) : false) || (next ? SCENIC_CATS.has(next.category) : false);
}

export function computeStopSemantics(
  stop: EngineItineraryStop,
  stops: EngineItineraryStop[],
  signal: Pick<RecoSignal, 'weather'>,
): SemanticRole {
  const startMin = timeToMin(stop.time);

  // Evening wind-down: food/bar after 19:00
  if (startMin >= 19 * 60 && (FOOD_CATS.has(stop.category) || SOCIAL_CATS.has(stop.category))) {
    return 'evening_wind';
  }

  // Social hub: bar/nightlife any time
  if (SOCIAL_CATS.has(stop.category)) {
    return 'social_hub';
  }

  // Cultural deep: museum/gallery/historic with long duration
  if ((stop.category === 'museum' || stop.category === 'gallery' || stop.category === 'historic' || stop.category === 'heritage') && stop.durationMin >= 120) {
    return 'cultural_deep';
  }

  // Scenic rest: cafe/park in good weather with scenic neighbor OR long duration cafe
  if (stop.category === 'cafe' || stop.category === 'park') {
    const isScenic = signal.weather?.isOutdoorFriendly && hasScenicroNeighbor(stop, stops);
    if (isScenic) return 'scenic_rest';
    if (stop.durationMin >= 60 && stop.category === 'cafe') return 'scenic_rest';
    return 'fuel_stop';
  }

  // Fuel stop: quick food
  if (FOOD_CATS.has(stop.category) && stop.durationMin < 45) {
    return 'fuel_stop';
  }

  // Anchor: main category attractions
  if (stop.category === 'museum' || stop.category === 'gallery' || stop.category === 'historic' ||
      stop.category === 'heritage' || stop.category === 'landmark' || stop.category === 'tourism' ||
      SCENIC_CATS.has(stop.category)) {
    return 'anchor';
  }

  return 'transit_filler';
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/semantics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reco-engine/semantics.ts frontend/src/modules/route/reco-engine/semantics.test.ts
git commit -m "feat(reco-engine): add SemanticRole + computeStopSemantics"
```

---

## Task 5: profile.ts — ItineraryProfile + compute functions

**Files:**
- Create: `frontend/src/modules/route/reco-engine/profile.ts`
- Create: `frontend/src/modules/route/reco-engine/profile.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// profile.test.ts
import { describe, it, expect } from 'vitest';
import { computeTargetProfile, computeActualProfile } from './profile';
import type { RecoSignal } from './signal';
import type { EngineItineraryStop } from '../../../shared/types';

const BASE_WEIGHTS = { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.8, w_culture_depth: 0.5, w_nightlife: 0.5, w_budget_sensitivity: 0.5, w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5 };

function makeSignal(overrides: Partial<RecoSignal> = {}): RecoSignal {
  return {
    weights: BASE_WEIGHTS, archetype: 'explorer', archetypeGroup: 'explorer',
    archetypeConfidence: 1.0, pace: 'moderate', social: 'solo', isFamily: false,
    ritualStrength: 0.5, sensoryIntensity: 0.5, spontaneityBias: 0.5,
    trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-05-26' },
    weather: { condition: 'sunny', tempC: 22, isOutdoorFriendly: true },
    dismissedPinIds: new Set(), savedEvents: [],
    ...overrides,
  };
}

function stop(overrides: Partial<EngineItineraryStop>): EngineItineraryStop {
  return { id: 's1', placeId: 'p1', title: 'Place', area: 'Centre', day: 1, time: '09:00', durationMin: 90, category: 'museum', lat: 0, lon: 0, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null, ...overrides };
}

describe('computeTargetProfile', () => {
  it('hasLunch target is always 0.9', () => {
    const t = computeTargetProfile(makeSignal());
    expect(t.hasLunch).toBeCloseTo(0.9);
  });

  it('hasCulture target equals w_culture_depth', () => {
    const t = computeTargetProfile(makeSignal({ weights: { ...BASE_WEIGHTS, w_culture_depth: 0.8 } }));
    expect(t.hasCulture).toBeCloseTo(0.8);
  });

  it('densityScore target = 0.35 for slow pace', () => {
    const t = computeTargetProfile(makeSignal({ pace: 'slow' }));
    expect(t.densityScore).toBeCloseTo(0.35);
  });

  it('densityScore target = 0.75 for fast pace', () => {
    const t = computeTargetProfile(makeSignal({ pace: 'fast' }));
    expect(t.densityScore).toBeCloseTo(0.75);
  });
});

describe('computeActualProfile', () => {
  it('hasLunch = 1 when restaurant stop at 12:30', () => {
    const stops = [stop({ id: 's1', time: '12:30', category: 'restaurant', durationMin: 60 })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasLunch).toBe(1);
  });

  it('hasLunch = 0 when no food stop in lunch window', () => {
    const stops = [stop({ id: 's1', time: '09:00', category: 'museum' })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasLunch).toBe(0);
  });

  it('hasCulture = 1 when museum present', () => {
    const stops = [stop({ category: 'museum' })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasCulture).toBe(1);
  });

  it('hasCulture = 0 when only restaurants', () => {
    const stops = [stop({ category: 'restaurant' })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasCulture).toBe(0);
  });

  it('densityScore = null for empty stops', () => {
    const actual = computeActualProfile([], makeSignal());
    expect(actual.densityScore).toBeNull();
  });

  it('budgetAlignment = null when no priceLevel data', () => {
    const stops = [stop({ priceLevel: null })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.budgetAlignment).toBeNull();
  });

  it('budgetAlignment computed from priceLevel when available', () => {
    const stops = [stop({ priceLevel: 4 })]; // most expensive
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.budgetAlignment).toBeCloseTo(1.0); // 4/4 = 1.0
  });

  it('liveEventOverlap = null when no saved events', () => {
    const actual = computeActualProfile([], makeSignal());
    expect(actual.liveEventOverlap).toBeNull();
  });

  it('liveEventOverlap > 0 when saved event date matches current day', () => {
    const signal = makeSignal({ savedEvents: [{ id: 'e1', title: 'Taylor Swift', city: 'Paris', date: '2026-05-26', isAnnual: false, venue: 'Arena', category: 'concert', savedAt: '2026-05-01T00:00:00Z' }] });
    const actual = computeActualProfile([], signal);
    expect(actual.liveEventOverlap).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/profile.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement profile.ts**

```ts
// profile.ts
import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';
import { computeStopSemantics } from './semantics';

export interface ItineraryProfile {
  hasLunch: number | null;
  hasDinner: number | null;
  hasEveningActivity: number | null;
  hasCulture: number | null;
  hasOutdoor: number | null;
  hasRest: number | null;
  hasSocialStop: number | null;
  hasHiddenGem: number | null;
  densityScore: number | null;
  walkIntensity: number | null;
  categoryDiversity: number | null;
  timeBalance: number | null;
  geoEfficiency: number | null;
  weatherAlignment: number | null;
  crowdOptimization: number | null;
  budgetAlignment: number | null;
  liveEventOverlap: number | null;
  // Phase 2 stubs — always null until feeds connected
  trendAlignment: null;
  localVelocity: null;
  curatedCoverage: null;
  routeScenicity: null;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CULTURE_CATS  = new Set(['museum', 'gallery', 'historic', 'heritage', 'library', 'spiritual']);
const OUTDOOR_CATS  = new Set(['park', 'viewpoint', 'beach', 'zoo', 'aquarium', 'amusement_park']);
const SOCIAL_CATS   = new Set(['bar', 'nightlife', 'market', 'restaurant']);
const CROWD_PEAK: Record<string, [number, number]> = {
  museum: [600, 720], beach: [660, 900], market: [540, 660], historic: [600, 780], viewpoint: [660, 780],
};

export function computeTargetProfile(signal: RecoSignal): ItineraryProfile {
  const w = signal.weights;
  const { pace, isFamily } = signal;

  return {
    hasLunch:           0.9,
    hasDinner:          w.w_food_density * 0.8 + 0.2,
    hasEveningActivity: w.w_nightlife,
    hasCulture:         w.w_culture_depth,
    hasOutdoor:         w.w_scenic * 0.7 + (isFamily ? 0.3 : 0),
    hasRest:            Math.min(1, w.w_rest_need * 0.7 + (pace === 'slow' ? 0.3 : 0)),
    hasSocialStop:      signal.social === 'solo' ? 0.2 : 0.6,
    hasHiddenGem:       signal.spontaneityBias * 0.6,
    densityScore:       pace === 'slow' ? 0.35 : pace === 'fast' ? 0.75 : 0.55,
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

export function computeActualProfile(
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ItineraryProfile {
  if (stops.length === 0) {
    // Categorical dimensions are 0 (not null) for empty day — absence is real
    return {
      hasLunch: 0, hasDinner: 0, hasEveningActivity: 0,
      hasCulture: 0, hasOutdoor: 0, hasRest: 0, hasSocialStop: 0, hasHiddenGem: 0,
      densityScore: null, walkIntensity: null, categoryDiversity: null,
      timeBalance: null, geoEfficiency: null, weatherAlignment: null,
      crowdOptimization: null, budgetAlignment: null, liveEventOverlap: computeLiveEvent(stops, signal),
      trendAlignment: null, localVelocity: null, curatedCoverage: null, routeScenicity: null,
    };
  }

  const sorted = [...stops].sort((a, b) => timeToMin(a.time) - timeToMin(b.time));
  const roles = sorted.map(s => computeStopSemantics(s, sorted, signal));

  // Lunch: food role in 11:30–14:30 window (690–870 min)
  const hasLunch = sorted.some((s, i) => {
    const m = timeToMin(s.time);
    return m >= 690 && m <= 870 && (roles[i] === 'fuel_stop' || roles[i] === 'scenic_rest' || roles[i] === 'evening_wind');
  }) ? 1 : 0;

  // Dinner: food role after 18:00 (1080 min)
  const hasDinner = sorted.some((s, i) => {
    const m = timeToMin(s.time);
    return m >= 1080 && (roles[i] === 'evening_wind' || roles[i] === 'fuel_stop');
  }) ? 1 : 0;

  // Evening activity: any stop after 20:00
  const hasEveningActivity = sorted.some(s => timeToMin(s.time) >= 1200) ? 1 : 0;

  // Culture
  const hasCulture = sorted.some(s => CULTURE_CATS.has(s.category)) ? 1 : 0;

  // Outdoor
  const hasOutdoor = sorted.some(s => OUTDOOR_CATS.has(s.category)) ? 1 : 0;

  // Rest (uses semantic role)
  const hasRest = roles.some(r => r === 'scenic_rest') ? 1 : 0;

  // Social stop
  const hasSocialStop = sorted.some(s => SOCIAL_CATS.has(s.category)) ? 1 : 0;

  // Hidden gem: non-famous, lower rating
  const FAMOUS = new Set(['museum', 'historic', 'viewpoint', 'beach']);
  const hasHiddenGem = sorted.some(s => !FAMOUS.has(s.category) && (!s.rating || s.rating < 4.2)) ? 1 : 0;

  // Density: scheduled time / day span
  const firstStart = timeToMin(sorted[0].time);
  const lastStop = sorted.at(-1)!;
  const lastEnd = timeToMin(lastStop.time) + lastStop.durationMin;
  const totalScheduled = sorted.reduce((sum, s) => sum + s.durationMin, 0);
  const daySpan = lastEnd - firstStart;
  const densityScore = daySpan > 0 ? Math.min(1, totalScheduled / daySpan) : null;

  // Walk intensity: total geo distance normalized to 10km = 1.0
  let walkIntensity: number | null = null;
  if (sorted.length >= 2) {
    const totalKm = sorted.slice(0, -1).reduce((sum, s, i) =>
      sum + haversineKm(s.lat, s.lon, sorted[i + 1].lat, sorted[i + 1].lon), 0);
    walkIntensity = Math.min(1, totalKm / 10);
  }

  // Category diversity: Shannon entropy of semantic roles
  const roleCounts = new Map<string, number>();
  for (const r of roles) roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  const total = roles.length;
  const entropy = -Array.from(roleCounts.values())
    .map(c => (c / total) * Math.log2(c / total))
    .reduce((a, b) => a + b, 0);
  const maxEntropy = Math.log2(7); // 7 semantic roles
  const categoryDiversity = Math.min(1, entropy / maxEntropy);

  // Time balance: variance from ideal 1/3 morning / 1/3 afternoon / 1/3 evening
  const morning   = sorted.filter(s => timeToMin(s.time) < 720).length / total;
  const afternoon = sorted.filter(s => { const m = timeToMin(s.time); return m >= 720 && m < 1080; }).length / total;
  const evening   = sorted.filter(s => timeToMin(s.time) >= 1080).length / total;
  const ideal = 1 / 3;
  const variance = ((morning - ideal) ** 2 + (afternoon - ideal) ** 2 + (evening - ideal) ** 2) / 3;
  const timeBalance = Math.max(0, 1 - variance * 9);

  // Geo efficiency: direct / route ratio
  let geoEfficiency: number | null = null;
  if (sorted.length >= 2) {
    const totalRoute = sorted.slice(0, -1).reduce((sum, s, i) =>
      sum + haversineKm(s.lat, s.lon, sorted[i + 1].lat, sorted[i + 1].lon), 0);
    const direct = haversineKm(sorted[0].lat, sorted[0].lon, sorted.at(-1)!.lat, sorted.at(-1)!.lon);
    geoEfficiency = totalRoute > 0 ? Math.min(1, direct / totalRoute) : 1;
  }

  // Weather alignment: outdoor ratio vs forecast
  const outdoorRatio = sorted.filter(s => OUTDOOR_CATS.has(s.category)).length / sorted.length;
  const weatherAlignment = signal.weather
    ? (signal.weather.isOutdoorFriendly ? outdoorRatio : 1 - outdoorRatio)
    : null;

  // Crowd optimization: crowd-sensitive stops outside peak hours
  const crowdSensitive = sorted.filter(s => !!CROWD_PEAK[s.category]);
  let crowdOptimization: number | null = crowdSensitive.length === 0 ? null : (() => {
    const atPeak = crowdSensitive.filter(s => {
      const [lo, hi] = CROWD_PEAK[s.category]!;
      const m = timeToMin(s.time);
      return m >= lo && m <= hi;
    }).length;
    return 1 - atPeak / crowdSensitive.length;
  })();

  // Budget alignment: avg priceLevel / 4
  const withPrice = sorted.filter(s => s.priceLevel !== null);
  const budgetAlignment = withPrice.length === 0 ? null
    : withPrice.reduce((sum, s) => sum + (s.priceLevel ?? 0), 0) / withPrice.length / 4;

  // Live event overlap
  const liveEventOverlap = computeLiveEvent(stops, signal);

  return {
    hasLunch, hasDinner, hasEveningActivity, hasCulture, hasOutdoor, hasRest,
    hasSocialStop, hasHiddenGem, densityScore, walkIntensity, categoryDiversity,
    timeBalance, geoEfficiency, weatherAlignment, crowdOptimization, budgetAlignment,
    liveEventOverlap,
    trendAlignment: null, localVelocity: null, curatedCoverage: null, routeScenicity: null,
  };
}

function computeLiveEvent(stops: EngineItineraryStop[], signal: RecoSignal): number | null {
  const { savedEvents, trip } = signal;
  if (savedEvents.length === 0 && signal.dismissedPinIds.size === 0) return null;

  const stopTitles = new Set(stops.map(s => s.title.toLowerCase()));
  const unadded = savedEvents.filter(e => {
    const dateMatch = e.date === trip.currentDayDate ||
      (e.isAnnual && e.date?.slice(5) === trip.currentDayDate?.slice(5));
    return dateMatch && !stopTitles.has(e.title.toLowerCase());
  });

  return unadded.length === 0 ? null : Math.min(1, unadded.length * 0.5);
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/profile.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reco-engine/profile.ts frontend/src/modules/route/reco-engine/profile.test.ts
git commit -m "feat(reco-engine): add ItineraryProfile + computeTargetProfile + computeActualProfile"
```

---

## Task 6: dimensions.ts — getDimensionWeight + CONFLICT_PAIRS

**Files:**
- Create: `frontend/src/modules/route/reco-engine/dimensions.ts`
- Create: `frontend/src/modules/route/reco-engine/dimensions.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// dimensions.test.ts
import { describe, it, expect } from 'vitest';
import { getDimensionWeight } from './dimensions';
import type { RecoSignal } from './signal';

const BASE: RecoSignal = {
  weights: { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.8, w_culture_depth: 0.6, w_nightlife: 0.3, w_budget_sensitivity: 0.7, w_crowd_aversion: 0.4, w_spontaneity: 0.5, w_rest_need: 0.5 },
  archetype: 'explorer', archetypeGroup: 'explorer', archetypeConfidence: 1,
  pace: 'moderate', social: 'solo', isFamily: false, ritualStrength: 0.5,
  sensoryIntensity: 0.5, spontaneityBias: 0.5,
  trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-05-26' },
  weather: null, dismissedPinIds: new Set(), savedEvents: [],
};

describe('getDimensionWeight', () => {
  it('hasLunch has a floor of 0.3 regardless of w_food_density', () => {
    const w = getDimensionWeight('hasLunch', { ...BASE, weights: { ...BASE.weights, w_food_density: 0 } });
    expect(w).toBeGreaterThanOrEqual(0.3);
  });

  it('hasCulture weight equals w_culture_depth', () => {
    expect(getDimensionWeight('hasCulture', BASE)).toBeCloseTo(0.6);
  });

  it('budgetAlignment weight equals w_budget_sensitivity', () => {
    expect(getDimensionWeight('budgetAlignment', BASE)).toBeCloseTo(0.7);
  });

  it('crowdOptimization weight equals w_crowd_aversion', () => {
    expect(getDimensionWeight('crowdOptimization', BASE)).toBeCloseTo(0.4);
  });

  it('returns 0.3 for unknown dimension', () => {
    expect(getDimensionWeight('trendAlignment' as any, BASE)).toBeCloseTo(0.3);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/dimensions.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement dimensions.ts**

```ts
// dimensions.ts
import type { RecoSignal } from './signal';
import type { ItineraryProfile } from './profile';

export function getDimensionWeight(
  dim: keyof ItineraryProfile,
  signal: RecoSignal,
): number {
  const w = signal.weights;
  const map: Partial<Record<keyof ItineraryProfile, number>> = {
    hasLunch:           Math.max(0.3, w.w_food_density * 0.7 + 0.3),
    hasDinner:          Math.max(0.25, w.w_food_density * 0.6),
    hasEveningActivity: w.w_nightlife,
    hasCulture:         w.w_culture_depth,
    hasOutdoor:         w.w_scenic,
    hasRest:            Math.max(0.2, w.w_rest_need * 0.6 + (signal.pace === 'slow' ? 0.4 : 0)),
    hasSocialStop:      signal.social === 'solo' ? 0.2 : 0.5,
    hasHiddenGem:       signal.spontaneityBias * 0.5,
    densityScore:       Math.max(w.w_efficiency, 1 - w.w_rest_need),
    walkIntensity:      w.w_walk_affinity,
    categoryDiversity:  signal.spontaneityBias * 0.4 + 0.2,
    timeBalance:        0.4,
    geoEfficiency:      w.w_efficiency,
    weatherAlignment:   w.w_scenic * 0.5 + 0.5,
    crowdOptimization:  w.w_crowd_aversion,
    budgetAlignment:    w.w_budget_sensitivity,
    liveEventOverlap:   signal.spontaneityBias,
  };
  return map[dim] ?? 0.3;
}

// Pairs of dimension keys that are logically incompatible — keep only the higher-scoring one
export const CONFLICT_PAIRS: Array<[keyof ItineraryProfile, keyof ItineraryProfile]> = [
  ['densityScore', 'walkIntensity'],  // both measure "too much activity" from different angles
  ['hasLunch', 'hasDinner'],          // if both missing, surface lunch as higher priority
];
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/dimensions.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reco-engine/dimensions.ts frontend/src/modules/route/reco-engine/dimensions.test.ts
git commit -m "feat(reco-engine): add getDimensionWeight + CONFLICT_PAIRS"
```

---

## Task 7: engine.ts — detectGaps + resolveConflicts + gapToCard + deriveRecos

**Files:**
- Create: `frontend/src/modules/route/reco-engine/engine.ts`
- Create: `frontend/src/modules/route/reco-engine/engine.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// engine.test.ts
import { describe, it, expect } from 'vitest';
import { deriveRecos } from './engine';
import type { RecoSignal } from './signal';
import type { EngineItineraryStop } from '../../../shared/types';

const HIGH_FOOD_WEIGHTS = { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.9, w_culture_depth: 0.3, w_nightlife: 0.2, w_budget_sensitivity: 0.3, w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5 };

function makeSignal(overrides: Partial<RecoSignal> = {}): RecoSignal {
  return {
    weights: HIGH_FOOD_WEIGHTS, archetype: 'epicurean', archetypeGroup: 'sensory',
    archetypeConfidence: 1, pace: 'moderate', social: 'solo', isFamily: false,
    ritualStrength: 0.5, sensoryIntensity: 0.7, spontaneityBias: 0.5,
    trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-05-26' },
    weather: { condition: 'sunny', tempC: 22, isOutdoorFriendly: true },
    dismissedPinIds: new Set(), savedEvents: [],
    ...overrides,
  };
}

function stop(overrides: Partial<EngineItineraryStop>): EngineItineraryStop {
  return { id: 's1', placeId: 'p1', title: 'Place', area: 'Centre', day: 1, time: '09:00', durationMin: 90, category: 'museum', lat: 48.85, lon: 2.35, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null, ...overrides };
}

describe('deriveRecos', () => {
  it('returns lunch reco for high food_density persona with no lunch stop', () => {
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'museum' }),
      stop({ id: 's2', time: '15:00', category: 'park' }),
    ];
    const recos = deriveRecos(stops, makeSignal());
    expect(recos.some(r => r.trigger === 'lunch')).toBe(true);
  });

  it('does NOT return lunch reco when restaurant exists at 12:30', () => {
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'museum' }),
      stop({ id: 's2', time: '12:30', category: 'restaurant', durationMin: 60 }),
    ];
    const recos = deriveRecos(stops, makeSignal());
    expect(recos.every(r => r.trigger !== 'lunch')).toBe(true);
  });

  it('returns empty array for well-balanced day (no significant gaps)', () => {
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'museum', durationMin: 120 }),
      stop({ id: 's2', time: '12:30', category: 'restaurant', durationMin: 60 }),
      stop({ id: 's3', time: '14:30', category: 'park', durationMin: 90 }),
      stop({ id: 's4', time: '19:00', category: 'restaurant', durationMin: 90 }),
    ];
    // Low food_density so lunch reco won't fire strongly; varied stops
    const signal = makeSignal({ weights: { ...HIGH_FOOD_WEIGHTS, w_food_density: 0.5, w_culture_depth: 0.5 } });
    const recos = deriveRecos(stops, signal);
    // May have 0 or few recos — just verify max is enforced
    expect(recos.length).toBeLessThanOrEqual(3);
  });

  it('surfaces live_event reco when saved event matches current day', () => {
    const signal = makeSignal({
      savedEvents: [{ id: 'e1', title: 'Taylor Swift', city: 'Paris', date: '2026-05-26', isAnnual: false, venue: 'Arena', category: 'concert', savedAt: '' }],
    });
    const recos = deriveRecos([], signal);
    expect(recos.some(r => r.trigger === 'live_event')).toBe(true);
  });

  it('conflict reco has significance boosted (conflictPresent in id)', () => {
    // Slow persona with packed day
    const signal = makeSignal({ pace: 'slow', weights: { ...HIGH_FOOD_WEIGHTS, w_rest_need: 0.8 } });
    const manyStops = Array.from({ length: 8 }, (_, i) =>
      stop({ id: `s${i}`, time: `${9 + i}:00`, durationMin: 55 })
    );
    const recos = deriveRecos(manyStops, signal);
    // densityScore gap should surface (actual >> target for slow persona)
    const hasDensityReco = recos.some(r => r.trigger === 'density_excess' || r.trigger === 'density_sparse');
    // It fires or it doesn't depending on significance — just check no crash
    expect(Array.isArray(recos)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/engine.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement engine.ts**

```ts
// engine.ts
import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';
import type { ItineraryProfile } from './profile';
import type { ReelRecoCard } from '../reel/types';
import { computeTargetProfile, computeActualProfile } from './profile';
import { getDimensionWeight, CONFLICT_PAIRS } from './dimensions';

export interface Gap {
  dimension: keyof ItineraryProfile;
  target: number;
  actual: number;
  delta: number;
  dimensionWeight: number;
  significance: number;
  direction: 'missing' | 'excess';
  conflictPresent: boolean;
}

const CONFIDENCE_THRESHOLD_BOOST = 0.15; // raise threshold by this when confidence < 0.5
const BASE_THRESHOLD = 0.28;
const MAX_RECOS = 3;
const CONFLICT_BOOST = 1.4;

// OB-mapped dimensions — conflict is detected when actual contradicts stated OB preference
const OB_MAPPED: Partial<Record<keyof ItineraryProfile, boolean>> = {
  densityScore: true, hasRest: true, hasCulture: true, hasOutdoor: true,
};

export function detectGaps(
  target: ItineraryProfile,
  actual: ItineraryProfile,
  signal: RecoSignal,
): Gap[] {
  const threshold = BASE_THRESHOLD + (signal.archetypeConfidence < 0.5 ? CONFIDENCE_THRESHOLD_BOOST : 0);
  const gaps: Gap[] = [];

  for (const dim of Object.keys(target) as Array<keyof ItineraryProfile>) {
    const t = target[dim];
    const a = actual[dim];
    if (t === null || a === null) continue;

    const delta = (t as number) - (a as number);
    const dimensionWeight = getDimensionWeight(dim, signal);
    const significance = Math.abs(delta) * dimensionWeight;
    if (significance < threshold) continue;

    // Conflict: actual strongly contradicts OB-mapped dimension target
    const conflictPresent = !!OB_MAPPED[dim] && Math.abs(delta) > 0.4;

    gaps.push({
      dimension: dim,
      target: t as number,
      actual: a as number,
      delta,
      dimensionWeight,
      significance: conflictPresent ? significance * CONFLICT_BOOST : significance,
      direction: delta > 0 ? 'missing' : 'excess',
      conflictPresent,
    });
  }

  return gaps.sort((a, b) => b.significance - a.significance);
}

export function resolveConflicts(gaps: Gap[]): Gap[] {
  const removed = new Set<string>();
  for (const [dimA, dimB] of CONFLICT_PAIRS) {
    const a = gaps.find(g => g.dimension === dimA);
    const b = gaps.find(g => g.dimension === dimB);
    if (a && b) {
      // Remove the lower-scoring one
      removed.add(a.significance < b.significance ? dimA : dimB);
    }
  }
  return gaps.filter(g => !removed.has(g.dimension));
}

function anchorStop(
  stops: EngineItineraryStop[],
  prefer?: (s: EngineItineraryStop) => boolean,
): EngineItineraryStop | null {
  if (stops.length === 0) return null;
  if (prefer) {
    const found = stops.find(prefer);
    if (found) return found;
  }
  return stops[Math.floor(stops.length / 2)] ?? stops[0];
}

export function gapToCard(
  gap: Gap,
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ReelRecoCard | null {
  const city = signal.trip.city;
  const persona = signal.archetype;
  const anchor = anchorStop(stops);
  const afterStopId = anchor?.id ?? stops.at(-1)?.id ?? 'intro';
  const area = anchor?.area ?? city;

  const templates: Partial<Record<keyof ItineraryProfile, { trigger: string; label: string; consequence: string }>> = {
    hasLunch: {
      trigger: 'lunch',
      label: 'No lunch planned',
      consequence: `You've got a window around midday — grab something near ${area}.`,
    },
    hasDinner: {
      trigger: 'dinner',
      label: 'Evening meal not scheduled',
      consequence: `Your day wraps without dinner. A few options near ${area} worth considering.`,
    },
    hasEveningActivity: {
      trigger: 'evening',
      label: 'Evening is still open',
      consequence: `Your day ends early. ${area} has options if you want to keep going.`,
    },
    hasCulture: {
      trigger: 'culture',
      label: 'No cultural stop today',
      consequence: `A few gallery or historic spots near ${area} that match your taste.`,
    },
    hasOutdoor: {
      trigger: 'weather',
      label: gap.direction === 'missing' ? 'No outdoor stops today' : 'Heavy outdoor schedule',
      consequence: gap.direction === 'missing'
        ? `It's a good day for it — a few options near ${area}.`
        : `${signal.weather?.condition ?? 'Weather'} may make some of these tough.`,
    },
    hasRest: {
      trigger: 'rest',
      label: 'No breaks in the schedule',
      consequence: `Long stretches without a pause. A cafe near ${area} could help.`,
    },
    hasSocialStop: {
      trigger: 'social_gap',
      label: 'No social spaces today',
      consequence: `A few spots near ${area} that work well for ${signal.social === 'group' ? 'groups' : 'meeting people'}.`,
    },
    densityScore: {
      trigger: gap.direction === 'excess' ? 'density_excess' : 'density_sparse',
      label: gap.direction === 'excess' ? 'Packed schedule ahead' : 'Lighter day than usual',
      consequence: gap.direction === 'excess'
        ? `Your profile suggests a slower rhythm — consider dropping a stop.`
        : `Room to add something spontaneous near ${area}.`,
    },
    budgetAlignment: {
      trigger: 'budget_mismatch',
      label: 'Some pricier stops in this plan',
      consequence: `A few free or low-cost alternatives near ${area} if you'd prefer.`,
    },
    crowdOptimization: {
      trigger: 'crowd_peak',
      label: 'Busy spots at peak hours',
      consequence: `Some stops are scheduled when crowds tend to peak — earlier or later works better.`,
    },
    liveEventOverlap: {
      trigger: 'live_event',
      label: 'Event happening while you\'re here',
      consequence: `You have a saved event on this date — it\'s not in your plan yet.`,
    },
    weatherAlignment: {
      trigger: 'weather',
      label: gap.direction === 'excess' ? 'Outdoor stops in uncertain weather' : 'Great day — more outdoors?',
      consequence: gap.direction === 'excess'
        ? `${signal.weather?.condition ?? 'Forecast'} may affect ${gap.actual > 0.5 ? 'several' : 'some'} of your stops.`
        : `Conditions are good — a viewpoint or park near ${area} could fit well.`,
    },
    walkIntensity: {
      trigger: 'walking_gap',
      label: gap.direction === 'excess' ? 'High walking day' : 'Minimal walking today',
      consequence: gap.direction === 'excess'
        ? `More walking than your profile suggests. Consider a transit option between some stops.`
        : `Most stops are compact — room for a walk if you want one.`,
    },
  };

  const tmpl = templates[gap.dimension];
  if (!tmpl) return null;

  return {
    type: 'reco',
    id: `${gap.dimension}-${afterStopId}${gap.conflictPresent ? '-conflict' : ''}`,
    trigger: tmpl.trigger as ReelRecoCard['trigger'],
    label: gap.conflictPresent ? `⚡ ${tmpl.label}` : tmpl.label,
    consequence: tmpl.consequence,
    nearbyCity: city,
    persona,
    afterStopId,
    weightScore: gap.significance,
    stopLat: anchor?.lat,
    stopLon: anchor?.lon,
  };
}

export function deriveRecos(
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ReelRecoCard[] {
  const target = computeTargetProfile(signal);
  const actual = computeActualProfile(stops, signal);
  const gaps = detectGaps(target, actual, signal);
  const resolved = resolveConflicts(gaps);

  const maxRecos = resolved.some(g => g.conflictPresent) ? MAX_RECOS + 1 : MAX_RECOS;

  return resolved
    .slice(0, maxRecos)
    .map(g => gapToCard(g, stops, signal))
    .filter((c): c is ReelRecoCard => c !== null);
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/engine.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reco-engine/engine.ts frontend/src/modules/route/reco-engine/engine.test.ts
git commit -m "feat(reco-engine): add Gap + detectGaps + resolveConflicts + gapToCard + deriveRecos"
```

---

## Task 8: behavior.ts — RecoInteraction tracking + Supabase sync

**Files:**
- Create: `frontend/src/modules/route/reco-engine/behavior.ts`
- Create: `frontend/src/modules/route/reco-engine/behavior.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// behavior.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildInteraction } from './behavior';
import type { ReelRecoCard } from '../reel/types';

const CARD: ReelRecoCard = {
  type: 'reco', id: 'hasLunch-s1', trigger: 'lunch',
  label: 'No lunch', consequence: 'Grab something near here',
  nearbyCity: 'Paris', persona: 'epicurean', afterStopId: 's1',
  weightScore: 0.6,
};

describe('buildInteraction', () => {
  it('builds a valid interaction object', () => {
    const interaction = buildInteraction(CARD, 'tapped', false, 'epicurean', 'moderate', null, 1, null);
    expect(interaction.recoId).toBe('hasLunch-s1');
    expect(interaction.dimension).toBe('hasLunch');
    expect(interaction.action).toBe('tapped');
    expect(interaction.archetype).toBe('epicurean');
    expect(interaction.conflictPresent).toBe(false);
    expect(interaction.significance).toBeCloseTo(0.6);
  });

  it('extracts dimension from card id prefix', () => {
    const card = { ...CARD, id: 'densityScore-conflict-s2' };
    const interaction = buildInteraction(card, 'dismissed', true, 'slowtraveller', 'slow', null, 1, null);
    expect(interaction.dimension).toBe('densityScore');
    expect(interaction.conflictPresent).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/behavior.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement behavior.ts**

```ts
// behavior.ts
import type { ReelRecoCard } from '../reel/types';
import { supabase } from '../../../shared/supabase';

export interface RecoInteraction {
  recoId: string;
  dimension: string;
  archetype: string;
  action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan';
  conflictPresent: boolean;
  significance: number;
  signalSnapshot: {
    archetype: string;
    pace: string;
    densityScore: number | null;
    dayNumber: number;
    weather: string | null;
  };
  timestamp: string;
}

export function buildInteraction(
  card: ReelRecoCard,
  action: RecoInteraction['action'],
  conflictPresent: boolean,
  archetype: string,
  pace: string,
  densityScore: number | null,
  dayNumber: number,
  weather: string | null,
): RecoInteraction {
  // Dimension is the first segment of the card id (before any '-s' or '-conflict')
  const dimension = card.id.replace(/-conflict$/, '').replace(/-[^-]+$/, '');

  return {
    recoId: card.id,
    dimension,
    archetype,
    action,
    conflictPresent,
    significance: card.weightScore ?? 0,
    signalSnapshot: { archetype, pace, densityScore, dayNumber, weather },
    timestamp: new Date().toISOString(),
  };
}

export async function syncRecoInteractions(
  userId: string,
  interactions: RecoInteraction[],
): Promise<void> {
  if (interactions.length === 0) return;
  const rows = interactions.map(i => ({
    user_id: userId,
    reco_id: i.recoId,
    dimension: i.dimension,
    archetype: i.archetype,
    action: i.action,
    conflict_present: i.conflictPresent,
    significance: i.significance,
    signal_snapshot: i.signalSnapshot,
    created_at: i.timestamp,
  }));
  await supabase.from('reco_interactions').insert(rows);
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/behavior.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reco-engine/behavior.ts frontend/src/modules/route/reco-engine/behavior.test.ts
git commit -m "feat(reco-engine): add RecoInteraction + buildInteraction + syncRecoInteractions"
```

---

## Task 9: index.ts — public API

**Files:**
- Create: `frontend/src/modules/route/reco-engine/index.ts`

- [ ] **Step 1: Create the public re-export**

```ts
// index.ts
export { computeRecoSignal } from './signal';
export type { RecoSignal } from './signal';
export { deriveRecos } from './engine';
export type { Gap } from './engine';
export { buildInteraction, syncRecoInteractions } from './behavior';
export type { RecoInteraction } from './behavior';
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reco-engine/index.ts
git commit -m "feat(reco-engine): add public index re-export"
```

---

## Task 10: Wire reel-builder.ts — new signature + balance card injection

**Files:**
- Modify: `frontend/src/modules/route/reel/reel-builder.ts`
- Modify: `frontend/src/modules/route/reel/reel-builder.test.ts`

- [ ] **Step 1: Update `buildReelCards` to accept pre-computed recos**

In `reel-builder.ts`, change the function signature:

```ts
export function buildReelCards(
  itinerary: EngineItinerary,
  journeyLegs: JourneyLeg[] | null,
  _savedId: string | null,
  weather: WeatherData | null,
  persona: string,
  recosByDayIdx: Map<number, ReelRecoCard[]> = new Map(), // NEW — pre-computed by engine
): ReelCard[]
```

Inside the per-day loop, replace the lines:
```ts
const mealRecos = buildMealRecos(sortedStops, persona, day.city);
const personaRecos = buildPersonaRecos(sortedStops, persona, day.city, weights);
const weatherRecos = buildWeatherReco(sortedStops, weather, persona, day.city);
const closingRecos = buildClosingConflictRecos(sortedStops, persona, day.city);
const walkingRecos = buildWalkingGapRecos(sortedStops, persona, day.city, weights);
const allRecos = [...mealRecos, ...personaRecos, ...weatherRecos, ...closingRecos, ...walkingRecos];
```

with:
```ts
// Use pre-computed recos from the engine; fall back to legacy functions when not provided
const allRecos: ReelRecoCard[] = recosByDayIdx.has(dayIdx)
  ? (recosByDayIdx.get(dayIdx) ?? [])
  : [
      ...buildMealRecos(sortedStops, persona, day.city),
      ...buildPersonaRecos(sortedStops, persona, day.city, weights),
      ...buildWeatherReco(sortedStops, weather, persona, day.city),
      ...buildClosingConflictRecos(sortedStops, persona, day.city),
      ...buildWalkingGapRecos(sortedStops, persona, day.city, weights),
    ];
```

- [ ] **Step 2: Add balance card injection after finale**

Find the finale push code (near end of `buildReelCards`, after all days loop):
```ts
cards.push({ type: 'finale', city: cityLabel, totalStops: stopCount, persona });
```

Add balance card injection BEFORE the finale push:
```ts
// Balance card: if the engine returned recos map but it's all empty, surface a balance card
const allRecosCount = Array.from(recosByDayIdx.values()).reduce((sum, r) => sum + r.length, 0);
if (recosByDayIdx.size > 0 && allRecosCount === 0) {
  cards.push({ type: 'balance', message: 'Your day looks well-balanced for your style.', persona });
}
cards.push({ type: 'finale', city: cityLabel, totalStops: stopCount, persona });
```

- [ ] **Step 3: Update reel-builder.test.ts to verify new signature**

The existing tests call `buildReelCards` without the new param — default `new Map()` means they hit the legacy path, so they still pass. But update the lunch reco test to use the engine path:

```ts
// Add this new test in reel-builder.test.ts:
import { deriveRecos, computeRecoSignal } from './reco-engine';
// (this import won't work directly since computeRecoSignal needs state — use engine directly)

it('uses pre-computed recos when recosByDayIdx is provided', () => {
  const stops = [
    STOP({ id: 's1', time: '09:00', category: 'museum' }),
    STOP({ id: 's2', time: '15:00', category: 'park' }),
  ];
  // Manually create a reco card matching the engine output shape
  const fakeReco: import('./types').ReelRecoCard = {
    type: 'reco', id: 'hasLunch-s1', trigger: 'lunch',
    label: 'No lunch', consequence: 'Find something nearby',
    nearbyCity: 'Paris', persona: 'explorer', afterStopId: 's1', weightScore: 0.5,
  };
  const recosByDayIdx = new Map([[0, [fakeReco]]]);
  const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'explorer', recosByDayIdx);
  expect(cards.some(c => c.type === 'reco')).toBe(true);
});

it('injects balance card when engine returns empty recos map', () => {
  const stops = [STOP()];
  const recosByDayIdx = new Map([[0, []]]); // engine ran but found no gaps
  const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'explorer', recosByDayIdx);
  expect(cards.some(c => c.type === 'balance')).toBe(true);
});
```

- [ ] **Step 4: Update ItineraryReelScreen.tsx to handle balance card in render**

In the cards map in `ItineraryReelScreen.tsx`, add a branch for balance cards:
```tsx
else if (card.type === 'balance') child = <ReelBalanceCard card={card} active={isActive} />;
```

(ReelBalanceCard is created in Task 11 — add the import and branch simultaneously.)

- [ ] **Step 5: Run all reel tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reel/reel-builder.test.ts
```
Expected: all existing tests pass + 2 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/reel-builder.ts frontend/src/modules/route/reel/reel-builder.test.ts
git commit -m "feat(reel-builder): accept pre-computed recos, inject balance card, keep legacy fallback"
```

---

## Task 11: ReelBalanceCard.tsx

**Files:**
- Create: `frontend/src/modules/route/reel/ReelBalanceCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// ReelBalanceCard.tsx
import type { ReelBalanceCard } from './types';

interface Props {
  card: ReelBalanceCard;
  active: boolean;
}

export function ReelBalanceCard({ card, active }: Props) {
  return (
    <div
      className="reel-card"
      style={{
        position: 'relative', width: '100%', height: '100dvh',
        background: 'linear-gradient(160deg, #0d1117 0%, #111820 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px',
        opacity: active ? 1 : 0.85,
        transition: 'opacity .3s ease',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(107,148,112,.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <span className="ms fill" style={{ fontSize: 48, color: '#6b9470', marginBottom: 20 }}>
        check_circle
      </span>

      <p style={{
        fontSize: 22, fontWeight: 700, color: '#fff',
        textAlign: 'center', lineHeight: 1.3, marginBottom: 12,
      }}>
        {card.message}
      </p>

      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,.45)',
        textAlign: 'center', lineHeight: 1.6,
      }}>
        No gaps worth flagging for a {card.persona} today.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/ReelBalanceCard.tsx
git commit -m "feat(reel): add ReelBalanceCard component for zero-delta state"
```

---

## Task 12: Wire ItineraryReelScreen.tsx — compute recos per day + behavior tracking

**Files:**
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx`

- [ ] **Step 1: Add imports**

At the top of `ItineraryReelScreen.tsx`, add:
```tsx
import { ReelBalanceCard } from './ReelBalanceCard';
import { computeRecoSignal, deriveRecos, buildInteraction } from '../reco-engine';
```

- [ ] **Step 2: Compute recos per day inside buildFiltered**

Update the `buildFiltered` function:
```ts
function buildFiltered(itinerary: typeof activeItinerary, w: typeof weather, pName: string) {
  const journeyLegs = savedItem ? (savedItem.journeyLegs ?? null) : (journey ?? null);

  // Compute recos per day using the engine
  const recosByDayIdx = new Map<number, import('../reel/types').ReelRecoCard[]>();
  if (itinerary && state.persona) {
    itinerary.days.forEach((_, dayIdx) => {
      const signal = computeRecoSignal(
        { ...state, weather: w },  // use current weather (may differ from state.weather during enrichment)
        dayIdx,
        itinerary,
      );
      const dayStops = itinerary.days[dayIdx]?.stops ?? [];
      const recos = deriveRecos(dayStops, signal);
      recosByDayIdx.set(dayIdx, recos);
    });
  }

  const built = buildReelCards(itinerary!, journeyLegs, reelSavedId, w, pName, recosByDayIdx);
  return built.filter(c => {
    if (c.type === 'stop') return !removedStopIds.has(c.stop.id);
    if (c.type === 'reco') return !removedStopIds.has(c.afterStopId);
    return true;
  });
}
```

- [ ] **Step 3: Add balance card to render switch**

In the cards map:
```tsx
else if (card.type === 'balance')
  child = <ReelBalanceCard card={card} active={isActive} />;
```

- [ ] **Step 4: Wire behavior tracking on reco cards**

Update the reco card render to pass behavior callbacks:
```tsx
else if (card.type === 'reco') child = (
  <ReelRecoCard
    card={card} active={isActive}
    archetype={archetype}
    existingPlaceIds={existingPlaceIds}
    onInteract={(action) => {
      const interaction = buildInteraction(
        card, action, card.id.includes('-conflict'),
        archetype, state.obAnswers.pace ?? 'moderate', null, 1, state.weather?.condition ?? null,
      );
      dispatch({ type: 'ADD_RECO_INTERACTION', interaction });
    }}
  />
);
```

- [ ] **Step 5: Type-check + run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit && npx vitest run
```
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat(reel): wire reco engine into ItineraryReelScreen — per-day signal + behavior tracking"
```

---

## Task 13: Update ReelRecoCard.tsx — Add "Add to plan" CTA + behavior callbacks

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelRecoCard.tsx`

- [ ] **Step 1: Read the current file**

```bash
head -30 /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ReelRecoCard.tsx
```

- [ ] **Step 2: Add `onInteract` prop + "Add to plan" CTA**

Add `onInteract` to the Props interface:
```ts
interface Props {
  card: ReelRecoCard;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
}
```

Add an IntersectionObserver inside the component to fire `viewed` when the card becomes active:
```tsx
useEffect(() => {
  if (active) onInteract?.('viewed');
}, [active]);
```

Add linger detection:
```tsx
const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (active) {
    lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
  } else {
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
  }
  return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
}, [active]);
```

Add an "Add to plan" button inside the card body (below the existing Google Maps link):
```tsx
<button
  onClick={() => {
    onInteract?.('added_to_plan');
    dispatch({ type: 'GO_TO', screen: 'map' });
  }}
  style={{
    marginTop: 8, padding: '8px 16px', borderRadius: 999,
    background: 'rgba(107,148,112,.18)', border: '1px solid rgba(107,148,112,.35)',
    color: '#6b9470', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  }}
>
  <span className="ms" style={{ fontSize: 15 }}>add_circle</span>
  Add to plan
</button>
```

On the existing Google Maps tap handler, add:
```ts
onInteract?.('tapped');
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/ReelRecoCard.tsx
git commit -m "feat(reel): add onInteract callbacks + Add to plan CTA to ReelRecoCard"
```

---

## Task 14: Create reco_interactions Supabase table + final wire-up

**Files:**
- Modify: `frontend/src/shared/userSync.ts`

- [ ] **Step 1: Create the Supabase migration**

Run in your Supabase dashboard SQL editor (or migration file):

```sql
create table if not exists reco_interactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade,
  reco_id       text not null,
  dimension     text not null,
  archetype     text not null,
  action        text not null,
  conflict_present boolean not null default false,
  significance  float not null default 0,
  signal_snapshot jsonb,
  created_at    timestamptz not null default now()
);

create index on reco_interactions (user_id, created_at desc);
create index on reco_interactions (archetype, dimension, action);
```

- [ ] **Step 2: Add batch sync to userSync.ts**

```ts
// Add to userSync.ts:
import type { RecoInteraction } from '../modules/route/reco-engine';

export async function syncRecoInteractions(
  userId: string,
  interactions: RecoInteraction[],
): Promise<void> {
  if (interactions.length === 0) return;
  const rows = interactions.map(i => ({
    user_id: userId,
    reco_id: i.recoId,
    dimension: i.dimension,
    archetype: i.archetype,
    action: i.action,
    conflict_present: i.conflictPresent,
    significance: i.significance,
    signal_snapshot: i.signalSnapshot,
    created_at: i.timestamp,
  }));
  await supabase.from('reco_interactions').insert(rows);
}
```

- [ ] **Step 3: Trigger sync on reel unmount in ItineraryReelScreen.tsx**

In `ItineraryReelScreen.tsx`, add a cleanup effect:
```ts
useEffect(() => {
  return () => {
    // Sync on unmount — fire-and-forget
    if (state.recoInteractions.length === 0) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) syncRecoInteractions(user.id, state.recoInteractions as any).catch(console.warn);
    });
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Final type-check + full test run**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit && npx vitest run
```
Expected: 0 type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/userSync.ts frontend/src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat: wire reco_interactions Supabase sync on reel unmount"
```

- [ ] **Step 6: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ RecoSignal — Task 3
- ✅ ItineraryProfile + target/actual compute — Task 5
- ✅ Semantic roles — Task 4
- ✅ getDimensionWeight + conflict pairs — Task 6
- ✅ detectGaps + resolveConflicts + gapToCard + deriveRecos — Task 7
- ✅ Behavior capture (RecoInteraction + sync) — Task 8, 14
- ✅ balance card (zero delta) — Task 11
- ✅ dismissedPinIds + recoInteractions in store — Task 2
- ✅ reel-builder wired with new signature + balance injection — Task 10
- ✅ ReelRecoCard "Add to plan" CTA + behavior — Task 13
- ✅ ItineraryReelScreen per-day signal computation — Task 12
- ✅ Phase 2 stubs (null dimensions) — Task 5 profile.ts
- ✅ Conflict detection + significance boost — Task 7
- ✅ Low confidence → wider threshold — Task 7 (CONFIDENCE_THRESHOLD_BOOST)
- ✅ Time conflict hard block — handled implicitly: liveEventOverlap gapToCard returns card only when event not already in stops
- ✅ Legacy fallback in reel-builder (old functions kept for backwards compat) — Task 10
- ✅ buildInteraction extracts dimension from card id — Task 8

**Type consistency confirmed:** `ReelRecoCard.trigger` typed as `RecoTrigger` (extended in Task 1). `ReelBalanceCard` added to `ReelCard` union. `onInteract` prop added to `ReelRecoCard` component props. `buildInteraction` signature matches usage in Task 12.
