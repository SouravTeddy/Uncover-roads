# Multi-City Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-city journey mode that auto-detects when places span multiple cities, assembles a swipeable card deck (origin → city → transit → city …), calculates trip tenure from the user's declared budget, and explains every change in conversational plain English.

**Architecture:** New `JourneyLeg[]` state added to the store drives everything downstream — the `JourneyScreen` renders the card deck from it, the itinerary screen reads from it when in journey mode, and `advisor-utils.ts` generates contextual messages whenever the legs change. Multi-city detection is already partially built in `journey-utils.ts`; this plan extends that foundation.

**Tech Stack:** React 19, TypeScript, Vitest/jsdom, MapLibre GL, existing backend `/route` (OSRM) and `/place-details` endpoints, Google Places autocomplete (already wired in `useTripPlanInput.ts`)

---

## File Map

**New files:**
- `frontend/src/modules/map/journey-legs.ts` — `buildJourneyLegs`, `detectTransitMode`, `calculateEstimatedDays`, `calculateArrivalDates`, `calculateTravelDays`
- `frontend/src/modules/map/journey-legs.test.ts`
- `frontend/src/modules/map/advisor-utils.ts` — `generateAdvisorMessage` + full message catalogue
- `frontend/src/modules/map/advisor-utils.test.ts`
- `frontend/src/modules/journey/JourneyStrip.tsx` — live tenure bar (date range · days · travel · cities)
- `frontend/src/modules/journey/JourneyOriginCard.tsx`
- `frontend/src/modules/journey/JourneyCityCard.tsx`
- `frontend/src/modules/journey/JourneyTransitCard.tsx`
- `frontend/src/modules/journey/JourneyAdvisorThread.tsx`
- `frontend/src/modules/journey/JourneyScreen.tsx` — 60/40 layout + swipeable deck
- `frontend/src/modules/journey/OriginInputSheet.tsx` — origin type detection + time pickers
- `frontend/src/modules/journey/index.ts`

**Modified files:**
- `frontend/src/shared/types.ts` — add `OriginType`, `OriginPlace`, `TransitMode`, `JourneyLeg`, `AdvisorMessage`; add `'journey'` to `Screen`
- `frontend/src/shared/store.tsx` — add `journey`, `journeyBudgetDays`, `advisorMessages` to state + 6 new actions
- `frontend/src/shared/api.ts` — add `routeInterCity` export
- `frontend/src/modules/map/MapScreen.tsx` — auto-navigate to journey screen on multi-city; add `JourneyStrip`
- `frontend/src/modules/route/ItineraryView.tsx` — render multi-city day blocks with transit separators

---

## Task 1: Add Journey Types to shared/types.ts

**Files:**
- Modify: `frontend/src/shared/types.ts`

- [ ] **Step 1: Add the new types** — append to the end of `frontend/src/shared/types.ts` before the final blank line:

```typescript
// ── Journey / Multi-city ──────────────────────────────────────
export type OriginType = 'home' | 'hotel' | 'airport' | 'custom';
export type TransitMode = 'flight' | 'drive' | 'train' | 'bus';

export interface OriginPlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  originType: OriginType;
  departureTime?: string;   // "HH:MM" — home: user-set, airport: landing time
  checkInTime?: string;     // "HH:MM" — hotel: from Google Places
  checkOutTime?: string;    // "HH:MM" — hotel: from Google Places
  isLongHaul?: boolean;     // airport only
}

export type JourneyLeg =
  | { type: 'origin'; place: OriginPlace }
  | {
      type: 'city';
      city: string;
      countryCode: string;
      places: Place[];
      arrivalDate?: string;   // ISO date, set after calculateArrivalDates()
      estimatedDays: number;
      advisorMessage?: string;
    }
  | {
      type: 'transit';
      mode: TransitMode;
      from: string;
      to: string;
      fromCoords: [number, number]; // [lat, lon]
      toCoords: [number, number];
      durationMinutes?: number;
      distanceKm?: number;
      advisorMessage?: string;
    };

export interface AdvisorMessage {
  id: string;
  message: string;
  trigger: string;
  timestamp: number;
}
```

- [ ] **Step 2: Add `'journey'` to the Screen union** — find the `Screen` type in `frontend/src/shared/types.ts` and add `| 'journey'` after `'map'`:

```typescript
export type Screen =
  | 'login'
  | 'welcome'
  | 'walkthrough'
  | 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
  | 'ob8' | 'ob9'
  | 'persona'
  | 'destination'
  | 'map'
  | 'journey'
  | 'route'
  | 'trips'
  | 'nav'
  | 'profile';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/types.ts
git commit -m "feat: add JourneyLeg, OriginPlace, AdvisorMessage types; add journey screen"
```

---

## Task 2: Add Journey State and Actions to store.tsx

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Test: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write failing tests** — add a new `describe` block to `frontend/src/shared/store.test.ts`:

```typescript
describe('journey reducer actions', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', stubStorage);
    vi.stubGlobal('localStorage', stubStorage);
  });
  afterEach(() => vi.unstubAllGlobals());

  const mockOrigin: import('./types').OriginPlace = {
    placeId: 'p1', name: 'Home', address: '123 Main St',
    lat: 51.5, lon: -0.12, originType: 'home', departureTime: '09:00',
  };

  it('SET_JOURNEY_ORIGIN creates an origin leg', () => {
    const next = reducer(initialState, { type: 'SET_JOURNEY_ORIGIN', place: mockOrigin });
    expect(next.journey).toEqual([{ type: 'origin', place: mockOrigin }]);
  });

  it('SET_JOURNEY_BUDGET sets journeyBudgetDays', () => {
    const next = reducer(initialState, { type: 'SET_JOURNEY_BUDGET', days: 7 });
    expect(next.journeyBudgetDays).toBe(7);
  });

  it('ADD_ADVISOR_MESSAGE appends to advisorMessages', () => {
    const msg: import('./types').AdvisorMessage = {
      id: 'a1', message: 'Test message', trigger: 'long_haul_arrival', timestamp: 1000,
    };
    const next = reducer(initialState, { type: 'ADD_ADVISOR_MESSAGE', message: msg });
    expect(next.advisorMessages).toEqual([msg]);
  });

  it('CLEAR_ADVISOR_MESSAGES empties the list', () => {
    const msg: import('./types').AdvisorMessage = {
      id: 'a1', message: 'Test', trigger: 'test', timestamp: 1000,
    };
    const s1 = reducer(initialState, { type: 'ADD_ADVISOR_MESSAGE', message: msg });
    const s2 = reducer(s1, { type: 'CLEAR_ADVISOR_MESSAGES' });
    expect(s2.advisorMessages).toEqual([]);
  });

  it('UPDATE_JOURNEY_LEGS replaces legs array', () => {
    const legs: import('./types').JourneyLeg[] = [
      { type: 'origin', place: mockOrigin },
    ];
    const next = reducer(initialState, { type: 'UPDATE_JOURNEY_LEGS', legs });
    expect(next.journey).toEqual(legs);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/store.test.ts`
Expected: FAIL — "journey reducer actions" tests error because the actions don't exist yet

- [ ] **Step 3: Add to AppState interface** — in `frontend/src/shared/store.tsx`, add to the `AppState` interface after `profileLoaded`:

```typescript
  journey: JourneyLeg[] | null;
  journeyBudgetDays: number | null;
  advisorMessages: AdvisorMessage[];
```

- [ ] **Step 4: Add to imports** — in `frontend/src/shared/store.tsx`, add `JourneyLeg`, `AdvisorMessage` to the import from `'./types'`:

```typescript
import type {
  Screen,
  OnboardingAnswers,
  Persona,
  GeoData,
  Place,
  MapFilter,
  TripContext,
  Itinerary,
  WeatherData,
  RouteData,
  SavedItinerary,
  RawOBAnswers,
  PersonaProfile,
  ResolvedConflict,
  JourneyLeg,
  AdvisorMessage,
} from './types';
```

- [ ] **Step 5: Add initial values** — in the `initialState` object, add after `profileLoaded`:

```typescript
  journey: null,
  journeyBudgetDays: null,
  advisorMessages: [],
```

- [ ] **Step 6: Add new action types** — append to the `Action` type union:

```typescript
  | { type: 'SET_JOURNEY_ORIGIN'; place: import('./types').OriginPlace }
  | { type: 'UPDATE_JOURNEY_LEGS'; legs: JourneyLeg[] }
  | { type: 'SET_JOURNEY_BUDGET'; days: number }
  | { type: 'ADD_ADVISOR_MESSAGE'; message: AdvisorMessage }
  | { type: 'CLEAR_ADVISOR_MESSAGES' }
  | { type: 'RESET_JOURNEY' }
```

- [ ] **Step 7: Add reducer cases** — inside the `reducer` `switch`, before the `default` case:

```typescript
    case 'SET_JOURNEY_ORIGIN': {
      const originLeg: JourneyLeg = { type: 'origin', place: action.place };
      const existingNonOrigin = (state.journey ?? []).filter(l => l.type !== 'origin');
      return { ...state, journey: [originLeg, ...existingNonOrigin] };
    }

    case 'UPDATE_JOURNEY_LEGS':
      return { ...state, journey: action.legs };

    case 'SET_JOURNEY_BUDGET':
      return { ...state, journeyBudgetDays: action.days };

    case 'ADD_ADVISOR_MESSAGE':
      return { ...state, advisorMessages: [...state.advisorMessages, action.message] };

    case 'CLEAR_ADVISOR_MESSAGES':
      return { ...state, advisorMessages: [] };

    case 'RESET_JOURNEY':
      return { ...state, journey: null, journeyBudgetDays: null, advisorMessages: [] };
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/store.test.ts`
Expected: all tests PASS

- [ ] **Step 9: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat: add journey state, actions, and reducer cases"
```

---

## Task 3: Add routeInterCity to api.ts

**Files:**
- Modify: `frontend/src/shared/api.ts`

- [ ] **Step 1: Add the export** — append after the `fetchNearby` function in `frontend/src/shared/api.ts`:

```typescript
export interface InterCityRouteResult {
  duration_min: number;
  distance_km: number;
}

/**
 * Calls the backend /route endpoint (OSRM) between two lat/lon points.
 * Returns null if OSRM has no road route (e.g. ocean crossing).
 */
export async function routeInterCity(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
): Promise<InterCityRouteResult | null> {
  try {
    const result = await post<{ summary?: { duration_min: number; distance_km: number }; error?: string }>(
      '/route',
      { points: [{ lat: fromLat, lon: fromLon }, { lat: toLat, lon: toLon }] },
    );
    if (result.error || !result.summary) return null;
    return { duration_min: result.summary.duration_min, distance_km: result.summary.distance_km };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/api.ts
git commit -m "feat: add routeInterCity API helper"
```

---

## Task 4: Create journey-legs.ts and journey-legs.test.ts

**Files:**
- Create: `frontend/src/modules/map/journey-legs.ts`
- Create: `frontend/src/modules/map/journey-legs.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/map/journey-legs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Place } from '../../shared/types';
import {
  calculateEstimatedDays,
  calculateTravelDays,
  calculateArrivalDates,
  detectTransitMode,
} from './journey-legs';

// ── calculateEstimatedDays ─────────────────────────────────────

describe('calculateEstimatedDays', () => {
  it('1 stop/day persona: 3 places = 3 days', () => {
    expect(calculateEstimatedDays(3, 1)).toBe(3);
  });

  it('3 stops/day persona: 7 places = 3 days (ceil)', () => {
    expect(calculateEstimatedDays(7, 3)).toBe(3);
  });

  it('adds 1 day for first city with long-haul arrival', () => {
    expect(calculateEstimatedDays(3, 3, true, true)).toBe(2); // ceil(3/3)+1
  });

  it('no extra day for non-long-haul first city', () => {
    expect(calculateEstimatedDays(3, 3, true, false)).toBe(1);
  });
});

// ── calculateTravelDays ────────────────────────────────────────

describe('calculateTravelDays', () => {
  it('returns 0 for no origin', () => {
    expect(calculateTravelDays(undefined, undefined)).toBe(0);
  });

  it('returns 0 for custom origin type', () => {
    expect(calculateTravelDays('custom', undefined)).toBe(0);
  });

  it('returns 0 for home with short flight (<240 min)', () => {
    expect(calculateTravelDays('home', 60)).toBe(0);
  });

  it('returns 2 for home with long flight (>240 min)', () => {
    expect(calculateTravelDays('home', 480)).toBe(2);
  });

  it('returns 2 for airport with long flight', () => {
    expect(calculateTravelDays('airport', 720)).toBe(2);
  });

  it('returns 0 for hotel origin', () => {
    // Hotel means you are already there — no travel days deducted
    expect(calculateTravelDays('hotel', 0)).toBe(0);
  });
});

// ── calculateArrivalDates ──────────────────────────────────────

describe('calculateArrivalDates', () => {
  const tokyo: Place = { id: 't1', title: 'Senso-ji', category: 'tourism', lat: 35.71, lon: 139.79, _city: 'Tokyo' };
  const kyoto: Place = { id: 'k1', title: 'Fushimi Inari', category: 'tourism', lat: 34.97, lon: 135.77, _city: 'Kyoto' };

  it('stamps arrivalDate on city legs starting from startDate', () => {
    const legs = [
      { type: 'city' as const, city: 'Tokyo', countryCode: 'JP', places: [tokyo], estimatedDays: 2 },
      { type: 'transit' as const, mode: 'train' as const, from: 'Tokyo', to: 'Kyoto', fromCoords: [35.71, 139.79] as [number, number], toCoords: [34.97, 135.77] as [number, number] },
      { type: 'city' as const, city: 'Kyoto', countryCode: 'JP', places: [kyoto], estimatedDays: 3 },
    ];
    const result = calculateArrivalDates(legs, '2026-05-01');
    const tokyoLeg = result.find(l => l.type === 'city' && l.city === 'Tokyo') as Extract<typeof result[0], { type: 'city' }>;
    const kyotoLeg = result.find(l => l.type === 'city' && l.city === 'Kyoto') as Extract<typeof result[0], { type: 'city' }>;
    expect(tokyoLeg.arrivalDate).toBe('2026-05-01');
    expect(kyotoLeg.arrivalDate).toBe('2026-05-03'); // 2 days after Tokyo start
  });

  it('skips origin legs', () => {
    const origin = { type: 'origin' as const, place: { placeId: 'p', name: 'Home', address: '', lat: 51.5, lon: -0.12, originType: 'home' as const } };
    const city = { type: 'city' as const, city: 'Tokyo', countryCode: 'JP', places: [tokyo], estimatedDays: 2 };
    const result = calculateArrivalDates([origin, city], '2026-05-01');
    const cityResult = result.find(l => l.type === 'city') as Extract<typeof result[0], { type: 'city' }>;
    expect(cityResult.arrivalDate).toBe('2026-05-01');
  });
});

// ── detectTransitMode ──────────────────────────────────────────

describe('detectTransitMode', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns flight when routeInterCity returns null', async () => {
    vi.mock('../../shared/api', () => ({
      routeInterCity: vi.fn().mockResolvedValue(null),
    }));
    const { detectTransitMode: dtm } = await import('./journey-legs');
    expect(await dtm(51.5, -0.12, 35.68, 139.69)).toBe('flight');
  });

  it('returns flight when duration_min > 480', async () => {
    vi.mock('../../shared/api', () => ({
      routeInterCity: vi.fn().mockResolvedValue({ duration_min: 600, distance_km: 800 }),
    }));
    const { detectTransitMode: dtm } = await import('./journey-legs');
    expect(await dtm(50, 4, 48, 2)).toBe('flight');
  });

  it('returns train when duration_min is 121-480', async () => {
    vi.mock('../../shared/api', () => ({
      routeInterCity: vi.fn().mockResolvedValue({ duration_min: 200, distance_km: 300 }),
    }));
    const { detectTransitMode: dtm } = await import('./journey-legs');
    expect(await dtm(51, 0, 48, 2)).toBe('train');
  });

  it('returns drive when duration_min <= 120', async () => {
    vi.mock('../../shared/api', () => ({
      routeInterCity: vi.fn().mockResolvedValue({ duration_min: 90, distance_km: 80 }),
    }));
    const { detectTransitMode: dtm } = await import('./journey-legs');
    expect(await dtm(51, 0, 51.5, -0.5)).toBe('drive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/map/journey-legs.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create journey-legs.ts**

Create `frontend/src/modules/map/journey-legs.ts`:

```typescript
import { routeInterCity } from '../../shared/api';
import { addDaysToIso } from './trip-capacity-utils';
import type { JourneyLeg, OriginType, OriginPlace, Place, TransitMode } from '../../shared/types';

/**
 * Determines transit mode between two geographic points via OSRM.
 * Falls back to 'flight' when no road route exists (ocean/island crossing).
 */
export async function detectTransitMode(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
): Promise<TransitMode> {
  const result = await routeInterCity(fromLat, fromLon, toLat, toLon);
  if (!result) return 'flight';
  if (result.duration_min > 480) return 'flight';   // > 8h driving → fly
  if (result.duration_min > 120) return 'train';    // 2–8h → likely rail corridor
  return 'drive';
}

/**
 * Calculates how many days a city visit will take based on place count and pace.
 * Adds 1 day for first-city long-haul arrival (arriving evening, light day 1).
 */
export function calculateEstimatedDays(
  placeCount: number,
  stopsPerDay: number,
  isFirstCity = false,
  isLongHaul = false,
): number {
  const base = Math.ceil(placeCount / Math.max(1, stopsPerDay));
  return isFirstCity && isLongHaul ? base + 1 : base;
}

/**
 * Returns the number of travel days to deduct from the user's budget.
 * Travel days = departure day + return day, only when flying from home/airport.
 * Short flights (<4h) don't consume a full day.
 */
export function calculateTravelDays(
  originType: OriginType | undefined,
  firstTransitDurationMin: number | undefined,
): number {
  if (!originType) return 0;
  if (originType !== 'home' && originType !== 'airport') return 0;
  if (!firstTransitDurationMin || firstTransitDurationMin < 240) return 0;
  return 2; // departure day + return day
}

/**
 * Stamps each city leg with an ISO arrivalDate, cascading from startDate.
 * Transit legs that are drive/train with duration > 360 min add 1 calendar day.
 */
export function calculateArrivalDates(
  legs: JourneyLeg[],
  startDate: string,
): JourneyLeg[] {
  let currentDate = startDate;
  return legs.map(leg => {
    if (leg.type === 'origin') return leg;
    if (leg.type === 'transit') {
      if (leg.mode !== 'flight' && (leg.durationMinutes ?? 0) > 360) {
        currentDate = addDaysToIso(currentDate, 1);
      }
      return leg;
    }
    // city leg
    const dated = { ...leg, arrivalDate: currentDate };
    currentDate = addDaysToIso(currentDate, leg.estimatedDays);
    return dated;
  });
}

/**
 * Builds a JourneyLeg array from a flat list of selected places.
 * Groups by _city, creates transit legs between cities via OSRM.
 * Returns the legs array (without arrivalDates — call calculateArrivalDates after).
 */
export async function buildJourneyLegs(
  places: Place[],
  origin: OriginPlace | null,
  stopsPerDay: number,
  isLongHaul = false,
): Promise<JourneyLeg[]> {
  const legs: JourneyLeg[] = [];

  if (origin) {
    legs.push({ type: 'origin', place: origin });
  }

  // Group places preserving insertion order
  const cityMap = new Map<string, Place[]>();
  for (const p of places) {
    const city = p._city ?? 'Unknown';
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(p);
  }

  const cities = [...cityMap.keys()];

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    const cityPlaces = cityMap.get(city)!;
    const estimatedDays = calculateEstimatedDays(cityPlaces.length, stopsPerDay, i === 0, isLongHaul);

    if (i > 0) {
      const prevCity = cities[i - 1];
      const prevPlaces = cityMap.get(prevCity)!;
      // Use middle place of previous city as "exit point" (rough centroid)
      const fromPlace = prevPlaces[Math.floor(prevPlaces.length / 2)];
      const toPlace = cityPlaces[0];

      const mode = await detectTransitMode(fromPlace.lat, fromPlace.lon, toPlace.lat, toPlace.lon);

      legs.push({
        type: 'transit',
        mode,
        from: prevCity,
        to: city,
        fromCoords: [fromPlace.lat, fromPlace.lon],
        toCoords: [toPlace.lat, toPlace.lon],
      });
    }

    legs.push({
      type: 'city',
      city,
      countryCode: '',
      places: cityPlaces,
      estimatedDays,
    });
  }

  return legs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/map/journey-legs.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/journey-legs.ts frontend/src/modules/map/journey-legs.test.ts
git commit -m "feat: add journey leg builder, transit detection, date calculation"
```

---

## Task 5: Create advisor-utils.ts and advisor-utils.test.ts

**Files:**
- Create: `frontend/src/modules/map/advisor-utils.ts`
- Create: `frontend/src/modules/map/advisor-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/modules/map/advisor-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateAdvisorMessage } from './advisor-utils';

describe('generateAdvisorMessage', () => {
  it('long_haul_arrival includes city and hours', () => {
    const msg = generateAdvisorMessage('long_haul_arrival', { cityName: 'Tokyo', flightHours: 13 });
    expect(msg).toContain('13 hours');
    expect(msg).toContain('Tokyo');
    expect(msg).toMatch(/kept.+first day.+light/i);
  });

  it('hotel_checkout_squeeze mentions checkout time and packing', () => {
    const msg = generateAdvisorMessage('hotel_checkout_squeeze', { checkoutTime: '11:00' });
    expect(msg).toContain('pack');
    expect(msg).toContain('11:00');
  });

  it('home_departure mentions departure time', () => {
    const msg = generateAdvisorMessage('home_departure', { departureTime: '8:30' });
    expect(msg).toContain('8:30');
    expect(msg).not.toMatch(/rushing.+first spot.+before.+opens/i);
    expect(msg).toMatch(/rushing/i);
  });

  it('transit_auto_flight mentions the city', () => {
    const msg = generateAdvisorMessage('transit_auto_flight', { cityName: 'Osaka' });
    expect(msg).toContain('Osaka');
    expect(msg).toMatch(/no road/i);
  });

  it('duration_exceeded mentions both place count and budget', () => {
    const msg = generateAdvisorMessage('duration_exceeded', { placeCount: 9, estimatedDays: 6, budgetDays: 4 });
    expect(msg).toContain('9');
    expect(msg).toContain('6');
    expect(msg).toContain('4');
  });

  it('short_flight_no_day_deducted mentions afternoon and duration', () => {
    const msg = generateAdvisorMessage('short_flight_no_day_deducted', { cityName: 'Osaka', flightDuration: '1 hour' });
    expect(msg).toContain('1 hour');
    expect(msg).toContain('Osaka');
    expect(msg).toMatch(/afternoon/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/map/advisor-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create advisor-utils.ts**

Create `frontend/src/modules/map/advisor-utils.ts`:

```typescript
export type AdvisorTrigger =
  | 'long_haul_arrival'
  | 'hotel_checkout_squeeze'
  | 'home_departure'
  | 'city_over_budget'
  | 'duration_exceeded'
  | 'duration_under_used'
  | 'travel_days_eating_budget'
  | 'transit_auto_flight'
  | 'place_removed_city'
  | 'short_flight_no_day_deducted';

export interface AdvisorContext {
  cityName?: string;
  flightHours?: number;
  checkoutTime?: string;
  departureTime?: string;
  placeCount?: number;
  estimatedDays?: number;
  budgetDays?: number;
  travelDays?: number;
  cityDays?: number;
  flightDuration?: string;
}

/** Returns HH:MM minus 30 minutes, e.g. "11:00" → "10:30 AM" */
function thirtyMinBefore(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m - 30;
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  const ampm = rh < 12 ? 'AM' : 'PM';
  const displayH = rh > 12 ? rh - 12 : rh === 0 ? 12 : rh;
  return `${displayH}:${String(rm).padStart(2, '0')} ${ampm}`;
}

const TEMPLATES: Record<AdvisorTrigger, (ctx: AdvisorContext) => string> = {
  long_haul_arrival: ({ flightHours = 12, cityName = 'the city' }) =>
    `After ${flightHours} hours in a plane, we've kept your first day in ${cityName} light. You can always add more once you're there.`,

  hotel_checkout_squeeze: ({ checkoutTime = '11:00' }) =>
    `Ending your last morning by ${thirtyMinBefore(checkoutTime)} — gives you half an hour to pack before check-out at ${checkoutTime}.`,

  home_departure: ({ departureTime = '9:00' }) =>
    `Leaving at ${departureTime} — we'll make sure you're not rushing to your first spot before it even opens.`,

  city_over_budget: ({ cityName = 'this city', placeCount = 0, estimatedDays = 2 }) =>
    `That's now ${placeCount} spots in ${cityName} — one more than a relaxed ${estimatedDays - 1}-day city. Added a day so you're not rushing.`,

  duration_exceeded: ({ placeCount = 0, estimatedDays = 0, budgetDays = 0 }) =>
    `You've picked ${placeCount} spots across your cities — that needs about ${estimatedDays} days, you've got ${budgetDays}. Want to add time, or should we help you choose the best ones?`,

  duration_under_used: ({ budgetDays = 0 }) =>
    `Plenty of room left in your ${budgetDays}-day trip — you could add another city or slow down and go deeper.`,

  travel_days_eating_budget: ({ travelDays = 2, cityDays = 0, cityName = 'the city' }) =>
    `Flights take ${travelDays === 2 ? 'a day each way' : `${travelDays} travel days`}, so you've really got ${cityDays} day${cityDays !== 1 ? 's' : ''} in ${cityName}. Tight but doable — want to add time, or make the most of it?`,

  transit_auto_flight: ({ cityName }) =>
    `There's no road between these two — looks like you're flying${cityName ? ` to ${cityName}` : ''}.`,

  place_removed_city: ({ cityName = 'this city' }) =>
    `Dropped a spot in ${cityName} — you've got a bit of breathing room now. Good for wandering.`,

  short_flight_no_day_deducted: ({ flightDuration = 'an hour', cityName = 'the next city' }) =>
    `It's only ${flightDuration} to ${cityName} — you'll still have the afternoon when you land.`,
};

export function generateAdvisorMessage(
  trigger: AdvisorTrigger,
  context: AdvisorContext = {},
): string {
  return TEMPLATES[trigger](context);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/map/advisor-utils.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/advisor-utils.ts frontend/src/modules/map/advisor-utils.test.ts
git commit -m "feat: add advisor-utils conversational message generator"
```

---

## Task 6: Create JourneyStrip Component

**Files:**
- Create: `frontend/src/modules/journey/JourneyStrip.tsx`

The `JourneyStrip` shows the live journey tenure bar on the Explore/Map screen. It reads from app state and displays: `Apr 20 – Apr 27 · 8 days · 2 travel · 3 cities`.

- [ ] **Step 1: Create the journey module directory and JourneyStrip.tsx**

Run: `mkdir -p /Users/souravbiswas/uncover-roads/frontend/src/modules/journey`

Create `frontend/src/modules/journey/JourneyStrip.tsx`:

```typescript
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { computeTotalDays } from '../map/trip-capacity-utils';
import { calculateTravelDays } from '../map/journey-legs';
import { isJourneyMode, getJourneyCities } from '../map/journey-utils';

const PRIMARY  = '#3b82f6';
const TEXT1    = '#f1f5f9';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';
const SURFACE  = '#141921';

function fmt(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  onDurationChange?: (days: number) => void;
}

export function JourneyStrip({ onDurationChange }: Props) {
  const { state, dispatch } = useAppStore();
  const { selectedPlaces, travelStartDate, travelEndDate, journey, journeyBudgetDays } = state;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDays, setDraftDays] = useState(journeyBudgetDays ?? 7);

  const isJourney = isJourneyMode(selectedPlaces);
  if (!isJourney) return null;

  const cities = getJourneyCities(selectedPlaces);
  const totalDays = travelStartDate && travelEndDate
    ? computeTotalDays(travelStartDate, travelEndDate)
    : (journeyBudgetDays ?? null);

  // Find first transit leg to estimate travel days
  const firstTransit = journey?.find(l => l.type === 'transit') as Extract<NonNullable<typeof journey>[0], { type: 'transit' }> | undefined;
  const originLeg = journey?.find(l => l.type === 'origin') as Extract<NonNullable<typeof journey>[0], { type: 'origin' }> | undefined;
  const travelDays = calculateTravelDays(originLeg?.place.originType, firstTransit?.durationMinutes);

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        style={{
          width: '100%', height: 40,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(59,130,246,.08)',
          border: `1px solid rgba(59,130,246,.25)`,
          borderRadius: 12, padding: '0 14px', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span className="ms" style={{ fontSize: 15, color: PRIMARY, flexShrink: 0 }}>flight_takeoff</span>

        <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 12, fontWeight: 700, color: TEXT1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {travelStartDate && travelEndDate
            ? `${fmt(travelStartDate)} – ${fmt(travelEndDate)}`
            : totalDays ? `~${totalDays} day${totalDays !== 1 ? 's' : ''}` : 'Set trip duration'}
          {totalDays ? ` · ${totalDays} days` : ''}
          {travelDays > 0 ? ` · ${travelDays} travel` : ''}
          {` · ${cities.length} cit${cities.length === 1 ? 'y' : 'ies'}`}
        </span>

        <span className="ms" style={{ fontSize: 14, color: TEXT3, flexShrink: 0 }}>chevron_right</span>
      </button>

      {pickerOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', left: 16, right: 16,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              zIndex: 61, background: SURFACE,
              border: `1px solid ${BORDER}`, borderRadius: 24,
              boxShadow: '0 -8px 60px rgba(0,0,0,.85)',
              padding: 24,
            }}
          >
            <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 18, fontWeight: 800, color: TEXT1, marginBottom: 4 }}>
              How many days?
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT3, marginBottom: 24 }}>
              We'll fit your cities and flag when you're running short.
            </p>

            {/* Tap +/- to adjust days */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 28 }}>
              <button
                onClick={() => setDraftDays(d => Math.max(1, d - 1))}
                style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`, fontSize: 22, color: TEXT1, cursor: 'pointer' }}
              >−</button>
              <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 40, fontWeight: 800, color: TEXT1, minWidth: 60, textAlign: 'center' }}>{draftDays}</span>
              <button
                onClick={() => setDraftDays(d => d + 1)}
                style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`, fontSize: 22, color: TEXT1, cursor: 'pointer' }}
              >+</button>
            </div>

            <button
              onClick={() => {
                dispatch({ type: 'SET_JOURNEY_BUDGET', days: draftDays });
                onDurationChange?.(draftDays);
                setPickerOpen(false);
              }}
              style={{
                width: '100%', height: 54,
                background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`,
                border: 'none', borderRadius: 16, cursor: 'pointer',
                fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 800, color: '#fff',
              }}
            >
              Set {draftDays} days
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/journey/JourneyStrip.tsx
git commit -m "feat: add JourneyStrip tenure bar with duration picker"
```

---

## Task 7: Create Journey Card Components

**Files:**
- Create: `frontend/src/modules/journey/JourneyOriginCard.tsx`
- Create: `frontend/src/modules/journey/JourneyCityCard.tsx`
- Create: `frontend/src/modules/journey/JourneyTransitCard.tsx`

Design tokens used throughout:
```
SURFACE  = '#141921'
SURFACE2 = '#1A1F2B'
PRIMARY  = '#3b82f6'
TEXT1    = '#f1f5f9'
TEXT3    = '#8e9099'
BORDER   = 'rgba(255,255,255,.08)'
```

- [ ] **Step 1: Create JourneyOriginCard.tsx**

Create `frontend/src/modules/journey/JourneyOriginCard.tsx`:

```typescript
import type { OriginPlace } from '../../shared/types';

const SURFACE2 = '#1A1F2B';
const PRIMARY  = '#3b82f6';
const TEXT1    = '#f1f5f9';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';

const ORIGIN_ICONS: Record<string, string> = {
  home: 'home', hotel: 'hotel', airport: 'flight', custom: 'location_on',
};

interface Props {
  place: OriginPlace;
  advisorMessage?: string;
  onEdit: () => void;
}

export function JourneyOriginCard({ place, advisorMessage, onEdit }: Props) {
  const icon = ORIGIN_ICONS[place.originType] ?? 'location_on';

  function timeRow(label: string, time: string) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span className="ms" style={{ fontSize: 14, color: PRIMARY }}>{label === 'Landing' ? 'flight_land' : 'schedule'}</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT3 }}>{label}</span>
        <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, fontWeight: 700, color: TEXT1, marginLeft: 'auto' }}>{time}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(59,130,246,.12)', border: `1px solid rgba(59,130,246,.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="ms fill" style={{ fontSize: 22, color: PRIMARY }}>{icon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: PRIMARY, marginBottom: 4 }}>
            Starting point
          </div>
          <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 18, fontWeight: 800, color: TEXT1, lineHeight: 1.2 }}>
            {place.name}
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: TEXT3, marginTop: 2 }}>{place.address}</div>
        </div>
      </div>

      {/* Time rows */}
      <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '12px 16px' }}>
        {place.originType === 'home' && place.departureTime && timeRow('Leaving', place.departureTime)}
        {place.originType === 'airport' && place.departureTime && timeRow('Landing', place.departureTime)}
        {place.originType === 'hotel' && place.checkInTime && timeRow('Check-in', place.checkInTime)}
        {place.originType === 'hotel' && place.checkOutTime && timeRow('Check-out', place.checkOutTime)}
        {(place.originType === 'custom' || (!place.departureTime && !place.checkInTime)) && (
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT3 }}>No time constraints — start whenever you're ready.</span>
        )}
      </div>

      {/* Advisor message */}
      {advisorMessage && (
        <div style={{ background: 'rgba(59,130,246,.06)', border: `1px solid rgba(59,130,246,.18)`, borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#93c5fd', lineHeight: 1.5, margin: 0 }}>{advisorMessage}</p>
        </div>
      )}

      {/* Edit */}
      <button
        onClick={onEdit}
        style={{ marginTop: 'auto', height: 44, background: 'rgba(255,255,255,.05)', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: TEXT3 }}
      >
        Change starting point
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create JourneyCityCard.tsx**

Create `frontend/src/modules/journey/JourneyCityCard.tsx`:

```typescript
import type { Place } from '../../shared/types';

const PRIMARY  = '#3b82f6';
const TEXT1    = '#f1f5f9';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';
const SURFACE2 = '#1A1F2B';

interface Props {
  city: string;
  countryCode: string;
  places: Place[];
  estimatedDays: number;
  arrivalDate?: string;
  advisorMessage?: string;
  onAddPlaces: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function JourneyCityCard({ city, countryCode, places, estimatedDays, arrivalDate, advisorMessage, onAddPlaces }: Props) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: PRIMARY, marginBottom: 6 }}>
          {arrivalDate ? fmtDate(arrivalDate) : 'City'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 24, fontWeight: 800, color: TEXT1 }}>{city}</span>
          {countryCode && <span style={{ fontSize: 20 }}>{countryFlag(countryCode)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Pill icon="place" label={`${places.length} place${places.length !== 1 ? 's' : ''}`} />
          <Pill icon="calendar_today" label={`~${estimatedDays} day${estimatedDays !== 1 ? 's' : ''}`} />
        </div>
      </div>

      {/* Place list preview */}
      <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', flex: 1 }}>
        {places.slice(0, 4).map((p, i) => (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}
          >
            <span className="ms fill" style={{ fontSize: 16, color: PRIMARY }}>location_on</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
          </div>
        ))}
        {places.length > 4 && (
          <div style={{ padding: '8px 14px', borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: TEXT3 }}>+{places.length - 4} more</span>
          </div>
        )}
      </div>

      {/* Advisor message */}
      {advisorMessage && (
        <div style={{ background: 'rgba(59,130,246,.06)', border: `1px solid rgba(59,130,246,.18)`, borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#93c5fd', lineHeight: 1.5, margin: 0 }}>{advisorMessage}</p>
        </div>
      )}

      {/* Add more */}
      <button
        onClick={onAddPlaces}
        style={{ height: 44, background: 'rgba(255,255,255,.05)', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: TEXT3 }}
      >
        Add more places
      </button>
    </div>
  );
}

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.22)', borderRadius: 999 }}>
      <span className="ms" style={{ fontSize: 13, color: PRIMARY }}>{icon}</span>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>{label}</span>
    </div>
  );
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
```

- [ ] **Step 3: Create JourneyTransitCard.tsx**

Create `frontend/src/modules/journey/JourneyTransitCard.tsx`:

```typescript
import type { TransitMode } from '../../shared/types';

const TEXT1 = '#f1f5f9';
const TEXT3 = '#8e9099';

interface Props {
  mode: TransitMode;
  from: string;
  to: string;
  durationMinutes?: number;
  distanceKm?: number;
  advisorMessage?: string;
}

const MODE_CONFIG: Record<TransitMode, { icon: string; label: string; bgGradient: string; accentColor: string; deepLinkLabel: string }> = {
  flight: {
    icon: 'flight',
    label: 'Flight',
    bgGradient: 'linear-gradient(160deg, #0c1445 0%, #1a3a7e 50%, #2563eb 100%)',
    accentColor: '#93c5fd',
    deepLinkLabel: 'Find flights →',
  },
  train: {
    icon: 'train',
    label: 'Train',
    bgGradient: 'linear-gradient(160deg, #0f2117 0%, #14532d 50%, #166534 100%)',
    accentColor: '#86efac',
    deepLinkLabel: 'Open in Maps →',
  },
  drive: {
    icon: 'directions_car',
    label: 'Drive',
    bgGradient: 'linear-gradient(160deg, #1c1207 0%, #431407 50%, #7c2d12 100%)',
    accentColor: '#fdba74',
    deepLinkLabel: 'Open in Maps →',
  },
  bus: {
    icon: 'directions_bus',
    label: 'Bus',
    bgGradient: 'linear-gradient(160deg, #1c1207 0%, #431407 50%, #7c2d12 100%)',
    accentColor: '#fdba74',
    deepLinkLabel: 'Open in Maps →',
  },
};

function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

function googleFlightsUrl(from: string, to: string): string {
  return `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(from)}+to+${encodeURIComponent(to)}`;
}

function googleMapsUrl(from: string, to: string): string {
  return `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
}

export function JourneyTransitCard({ mode, from, to, durationMinutes, distanceKm, advisorMessage }: Props) {
  const cfg = MODE_CONFIG[mode];
  const deepLink = mode === 'flight' ? googleFlightsUrl(from, to) : googleMapsUrl(from, to);

  return (
    <div style={{ height: '100%', background: cfg.bgGradient, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 20px' }}>
      {/* Mode badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="ms fill" style={{ fontSize: 18, color: cfg.accentColor }}>{cfg.icon}</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: cfg.accentColor }}>{cfg.label}</span>
      </div>

      {/* Route */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>from</div>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 26, fontWeight: 800, color: TEXT1 }}>{from}</div>
        <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.15)' }} />
          <span className="ms fill" style={{ fontSize: 22, color: cfg.accentColor }}>{cfg.icon}</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.15)' }} />
        </div>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>to</div>
        <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 26, fontWeight: 800, color: TEXT1 }}>{to}</div>

        {/* Duration + distance */}
        {(durationMinutes !== undefined || distanceKm !== undefined) && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 16 }}>
            {durationMinutes !== undefined && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 18, fontWeight: 800, color: cfg.accentColor }}>{formatDuration(durationMinutes)}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>duration</div>
              </div>
            )}
            {distanceKm !== undefined && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 18, fontWeight: 800, color: cfg.accentColor }}>{Math.round(distanceKm)} km</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>distance</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {advisorMessage && (
          <div style={{ background: 'rgba(0,0,0,.3)', borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: cfg.accentColor, lineHeight: 1.5, margin: 0 }}>{advisorMessage}</p>
          </div>
        )}
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 16, textDecoration: 'none',
            fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700, color: TEXT1,
          }}
        >
          {cfg.deepLinkLabel}
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/journey/JourneyOriginCard.tsx frontend/src/modules/journey/JourneyCityCard.tsx frontend/src/modules/journey/JourneyTransitCard.tsx
git commit -m "feat: add journey card components (origin, city, transit)"
```

---

## Task 8: Create JourneyAdvisorThread Component

**Files:**
- Create: `frontend/src/modules/journey/JourneyAdvisorThread.tsx`

- [ ] **Step 1: Create JourneyAdvisorThread.tsx**

Create `frontend/src/modules/journey/JourneyAdvisorThread.tsx`:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../shared/store';

const TEXT1  = '#f1f5f9';
const TEXT3  = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

export function JourneyAdvisorThread() {
  const { state } = useAppStore();
  const { advisorMessages } = state;
  const [open, setOpen] = useState(false);

  if (advisorMessages.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Handle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', height: 36,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,.03)', border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: '0 14px', cursor: 'pointer',
        }}
      >
        <span className="ms fill" style={{ fontSize: 15, color: TEXT3 }}>psychology</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: TEXT3, flex: 1, textAlign: 'left' }}>
          Why is my trip shaped this way?
        </span>
        <span className="ms" style={{ fontSize: 14, color: TEXT3, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>

      {/* Thread */}
      {open && (
        <div style={{
          marginTop: 6, background: 'rgba(15,20,30,.97)', border: `1px solid ${BORDER}`,
          borderRadius: 16, overflow: 'hidden',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {advisorMessages.map((msg, i) => (
            <div
              key={msg.id}
              style={{
                padding: '12px 16px',
                borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
              }}
            >
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT1, lineHeight: 1.55, margin: 0 }}>
                {msg.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/modules/journey/JourneyAdvisorThread.tsx
git commit -m "feat: add JourneyAdvisorThread collapsible message log"
```

---

## Task 9: Create JourneyScreen

**Files:**
- Create: `frontend/src/modules/journey/JourneyScreen.tsx`

60% map (or transit visual when transit card is active) / 40% swipeable card deck. Uses CSS `scroll-snap` for native swipe behaviour.

- [ ] **Step 1: Create JourneyScreen.tsx**

Create `frontend/src/modules/journey/JourneyScreen.tsx`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../shared/store';
import { MapLibreMap } from '../map/MapLibreMap';
import { JourneyOriginCard } from './JourneyOriginCard';
import { JourneyCityCard } from './JourneyCityCard';
import { JourneyTransitCard } from './JourneyTransitCard';
import { JourneyAdvisorThread } from './JourneyAdvisorThread';
import { JourneyStrip } from './JourneyStrip';
import { buildJourneyLegs, calculateArrivalDates } from '../map/journey-legs';
import { isJourneyMode, getJourneyCities } from '../map/journey-utils';
import { generateAdvisorMessage } from '../map/advisor-utils';
import type { JourneyLeg, Place } from '../../shared/types';
import { computeTotalDays } from '../map/trip-capacity-utils';

export function JourneyScreen() {
  const { state, dispatch } = useAppStore();
  const {
    selectedPlaces, journey, journeyBudgetDays,
    travelStartDate, travelEndDate, personaProfile,
    tripContext,
  } = state;

  const [activeIndex, setActiveIndex] = useState(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const [legs, setLegs] = useState<JourneyLeg[]>(journey ?? []);

  const stopsPerDay = personaProfile?.stops_per_day ?? 3;
  const isLongHaul  = tripContext.isLongHaul;

  // Rebuild legs when selectedPlaces change
  useEffect(() => {
    if (!isJourneyMode(selectedPlaces)) return;

    const originLeg = journey?.find(l => l.type === 'origin') as Extract<JourneyLeg, { type: 'origin' }> | undefined;
    const origin = originLeg?.place ?? null;

    buildJourneyLegs(selectedPlaces, origin, stopsPerDay, isLongHaul).then(newLegs => {
      const startDate = travelStartDate ?? new Date().toISOString().slice(0, 10);
      const datedLegs = calculateArrivalDates(newLegs, startDate);
      setLegs(datedLegs);
      dispatch({ type: 'UPDATE_JOURNEY_LEGS', legs: datedLegs });

      // Budget vs actual check
      const totalDays = travelStartDate && travelEndDate
        ? computeTotalDays(travelStartDate, travelEndDate)
        : journeyBudgetDays;

      if (totalDays) {
        const cityDaysTotal = datedLegs
          .filter(l => l.type === 'city')
          .reduce((s, l) => s + (l as Extract<JourneyLeg, { type: 'city' }>).estimatedDays, 0);

        if (cityDaysTotal > totalDays) {
          dispatch({
            type: 'ADD_ADVISOR_MESSAGE',
            message: {
              id: `overflow-${Date.now()}`,
              trigger: 'duration_exceeded',
              message: generateAdvisorMessage('duration_exceeded', {
                placeCount: selectedPlaces.length,
                estimatedDays: cityDaysTotal,
                budgetDays: totalDays,
              }),
              timestamp: Date.now(),
            },
          });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaces.length, stopsPerDay, isLongHaul]);

  // Track active card index on scroll
  const handleScroll = useCallback(() => {
    if (!deckRef.current) return;
    const scrollLeft = deckRef.current.scrollLeft;
    const cardWidth = deckRef.current.offsetWidth;
    setActiveIndex(Math.round(scrollLeft / cardWidth));
  }, []);

  // Scroll to card programmatically (from progress strip tap)
  function scrollToCard(index: number) {
    if (!deckRef.current) return;
    deckRef.current.scrollTo({ left: index * deckRef.current.offsetWidth, behavior: 'smooth' });
  }

  const cities = getJourneyCities(selectedPlaces);
  const activeLeg = legs[activeIndex];
  const activeCity = activeLeg?.type === 'city' ? activeLeg.city : null;
  const activePlaces: Place[] = activeLeg?.type === 'city' ? activeLeg.places : [];

  // Center map on active city
  const activeCenter: [number, number] | null = activePlaces.length > 0
    ? [activePlaces[0].lat, activePlaces[0].lon]
    : null;

  function renderTopPanel() {
    if (!activeLeg || activeLeg.type !== 'transit') {
      return (
        <MapLibreMap
          center={activeCenter ?? [20, 0]}
          zoom={activeCenter ? 13 : 2}
          places={activePlaces}
          selectedPlace={null}
          onPlaceClick={() => {}}
          onMoveEnd={() => {}}
          onClick={() => {}}
          routeGeojson={null}
          pinDropResult={null}
        />
      );
    }
    // Transit card: full-bleed transit visual handled by the card itself
    return null;
  }

  if (!isJourneyMode(selectedPlaces)) {
    dispatch({ type: 'GO_TO', screen: 'map' });
    return null;
  }

  return (
    <div className="fixed inset-0" style={{ display: 'flex', flexDirection: 'column', zIndex: 10 }}>
      {/* Top 60% — map or transit background */}
      <div style={{ flex: '0 0 60%', position: 'relative', overflow: 'hidden', background: '#0c1445' }}>
        {renderTopPanel()}

        {/* Back button */}
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
          className="absolute"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 16, zIndex: 20,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(15,20,30,.82)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span className="ms text-text-2 text-base">arrow_back</span>
        </button>
      </div>

      {/* Bottom 40% — card deck */}
      <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', background: '#0d1117', overflow: 'hidden' }}>
        {/* Progress strip */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {legs.map((leg, i) => {
            const label = leg.type === 'origin' ? '📍' : leg.type === 'city' ? leg.city : '✈';
            const active = i === activeIndex;
            return (
              <button
                key={i}
                onClick={() => scrollToCard(i)}
                style={{
                  flexShrink: 0, height: 28, padding: '0 10px',
                  borderRadius: 999, cursor: 'pointer',
                  background: active ? 'rgba(59,130,246,.2)' : 'rgba(255,255,255,.05)',
                  border: `1px solid ${active ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.08)'}`,
                  fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700,
                  color: active ? '#93c5fd' : '#8e9099',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
          {/* Add city */}
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
            style={{
              flexShrink: 0, height: 28, padding: '0 10px',
              borderRadius: 999, cursor: 'pointer',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.08)',
              fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#8e9099',
            }}
          >
            + city
          </button>
        </div>

        {/* Swipeable cards */}
        <div
          ref={deckRef}
          onScroll={handleScroll}
          style={{
            display: 'flex', flex: 1,
            overflowX: 'scroll', overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {legs.map((leg, i) => (
            <div key={i} style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start', overflow: 'hidden' }}>
              {leg.type === 'origin' && (
                <JourneyOriginCard
                  place={leg.place}
                  onEdit={() => dispatch({ type: 'GO_TO', screen: 'map' })}
                />
              )}
              {leg.type === 'city' && (
                <JourneyCityCard
                  city={leg.city}
                  countryCode={leg.countryCode}
                  places={leg.places}
                  estimatedDays={leg.estimatedDays}
                  arrivalDate={leg.arrivalDate}
                  advisorMessage={leg.advisorMessage}
                  onAddPlaces={() => dispatch({ type: 'GO_TO', screen: 'map' })}
                />
              )}
              {leg.type === 'transit' && (
                <JourneyTransitCard
                  mode={leg.mode}
                  from={leg.from}
                  to={leg.to}
                  durationMinutes={leg.durationMinutes}
                  distanceKm={leg.distanceKm}
                  advisorMessage={leg.advisorMessage}
                />
              )}
            </div>
          ))}
        </div>

        {/* Journey strip + advisor thread */}
        <div style={{ padding: '8px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <JourneyStrip />
          <JourneyAdvisorThread />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/journey/JourneyScreen.tsx
git commit -m "feat: add JourneyScreen with 60/40 layout and swipeable card deck"
```

---

## Task 10: Create OriginInputSheet

**Files:**
- Create: `frontend/src/modules/journey/OriginInputSheet.tsx`

Handles type detection from Google Places `types` array, home confirmation, and time pickers for home/airport/hotel flows.

- [ ] **Step 1: Create OriginInputSheet.tsx**

Create `frontend/src/modules/journey/OriginInputSheet.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { placesAutocomplete, geocodePlace, fetchPlaceDetails } from '../../shared/api';
import type { AutocompleteResult, OriginPlace, OriginType } from '../../shared/types';
import { generateAdvisorMessage } from '../map/advisor-utils';

const PRIMARY  = '#3b82f6';
const TEXT1    = '#f1f5f9';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';
const SURFACE  = '#141921';
const SURFACE2 = '#1A1F2B';

function newSessionId() { return Math.random().toString(36).slice(2); }

/** Classify a place's Google types array into our OriginType */
function classifyOriginType(types: string[] = []): OriginType | 'ask_home' {
  if (types.includes('lodging')) return 'hotel';
  if (types.includes('airport')) return 'airport';
  if (types.includes('street_address') || types.includes('premise')) return 'ask_home';
  return 'custom';
}

/** Parse "Check-in: 3:00 PM" or "Check-out: 11:00 AM" from weekday_text */
function parseCheckTime(weekdayText: string[], keyword: 'Check-in' | 'Check-out'): string | undefined {
  for (const line of weekdayText) {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      const match = line.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (match) {
        // Normalise to 24h HH:MM
        const [time, ampm] = match[1].split(' ');
        const [h, m] = time.split(':').map(Number);
        const hour24 = ampm?.toUpperCase() === 'PM' && h !== 12 ? h + 12 : ampm?.toUpperCase() === 'AM' && h === 12 ? 0 : h;
        return `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }
}

interface Props {
  onDone: (origin: OriginPlace) => void;
  onClose: () => void;
}

type Step = 'search' | 'ask_home' | 'departure_time' | 'landing_time';

export function OriginInputSheet({ onDone, onClose }: Props) {
  const { dispatch } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>('search');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved place from search
  const [resolved, setResolved] = useState<{
    placeId: string; name: string; address: string; lat: number; lon: number;
    types: string[]; weekdayText?: string[];
  } | null>(null);

  const [time, setTime] = useState('09:00');

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await placesAutocomplete(val, sessionRef.current);
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  async function handleSelect(result: AutocompleteResult) {
    setLoading(true);
    setResults([]);
    try {
      const geo = await geocodePlace(result.place_id, sessionRef.current);
      sessionRef.current = newSessionId();
      if (!geo) return;

      // Fetch full place details to get types + hotel times
      const details = await fetchPlaceDetails(result.place_id);
      const types = details?.types ?? [];
      const weekdayText = details?.weekday_text ?? [];

      setQuery(geo.name);
      setResolved({ placeId: result.place_id, name: geo.name, address: result.secondary_text, lat: geo.lat, lon: geo.lon, types, weekdayText });

      const classification = classifyOriginType(types);

      if (classification === 'hotel') {
        const checkIn  = parseCheckTime(weekdayText, 'Check-in');
        const checkOut = parseCheckTime(weekdayText, 'Check-out');
        const origin: OriginPlace = {
          placeId: result.place_id, name: geo.name, address: result.secondary_text,
          lat: geo.lat, lon: geo.lon,
          originType: 'hotel',
          checkInTime: checkIn ?? '15:00',
          checkOutTime: checkOut ?? '11:00',
        };
        finishWithMessage(origin, undefined);
      } else if (classification === 'airport') {
        setStep('landing_time');
      } else if (classification === 'ask_home') {
        setStep('ask_home');
      } else {
        // custom
        const origin: OriginPlace = {
          placeId: result.place_id, name: geo.name, address: result.secondary_text,
          lat: geo.lat, lon: geo.lon, originType: 'custom',
        };
        finishWithMessage(origin, undefined);
      }
    } finally {
      setLoading(false);
    }
  }

  function finishWithMessage(origin: OriginPlace, advisorTrigger: string | undefined) {
    dispatch({ type: 'SET_JOURNEY_ORIGIN', place: origin });
    if (advisorTrigger) {
      const msg = advisorTrigger === 'home_departure'
        ? generateAdvisorMessage('home_departure', { departureTime: origin.departureTime })
        : undefined;
      if (msg) {
        dispatch({ type: 'ADD_ADVISOR_MESSAGE', message: { id: `origin-${Date.now()}`, trigger: advisorTrigger, message: msg, timestamp: Date.now() } });
      }
    }
    onDone(origin);
  }

  function confirmHome(isHome: boolean) {
    if (!resolved) return;
    if (isHome) {
      setStep('departure_time');
    } else {
      const origin: OriginPlace = {
        placeId: resolved.placeId, name: resolved.name, address: resolved.address,
        lat: resolved.lat, lon: resolved.lon, originType: 'custom',
      };
      finishWithMessage(origin, undefined);
    }
  }

  function confirmDepartureTime() {
    if (!resolved) return;
    const origin: OriginPlace = {
      placeId: resolved.placeId, name: resolved.name, address: resolved.address,
      lat: resolved.lat, lon: resolved.lon, originType: 'home', departureTime: time,
    };
    finishWithMessage(origin, 'home_departure');
  }

  function confirmLandingTime() {
    if (!resolved) return;
    const origin: OriginPlace = {
      placeId: resolved.placeId, name: resolved.name, address: resolved.address,
      lat: resolved.lat, lon: resolved.lon, originType: 'airport',
      departureTime: time,
      isLongHaul: true, // user will know if long haul
    };
    finishWithMessage(origin, undefined);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)', opacity: mounted ? 1 : 0, transition: 'opacity .3s' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: 16, right: 16,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          zIndex: 66, background: SURFACE,
          border: `1px solid ${BORDER}`, borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 20px 18px', borderBottom: `1px solid ${BORDER}`, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: PRIMARY, marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>Starting point</div>
          <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 20, fontWeight: 800, color: TEXT1 }}>
            {step === 'search' && 'Where are you starting from?'}
            {step === 'ask_home' && 'Is this your home?'}
            {step === 'departure_time' && 'When are you heading out?'}
            {step === 'landing_time' && 'What time do you land?'}
          </div>
        </div>

        <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* SEARCH step */}
          {step === 'search' && (
            <>
              <div style={{ background: SURFACE2, border: `1.5px solid ${BORDER}`, borderRadius: 14, height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
                <span className="ms" style={{ fontSize: 20, color: TEXT3 }}>search</span>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => handleInput(e.target.value)}
                  placeholder="Hotel, airport, home address…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif', caretColor: PRIMARY }}
                />
                {loading && <span className="ms animate-spin" style={{ fontSize: 16, color: TEXT3 }}>autorenew</span>}
              </div>
              {results.length > 0 && (
                <div style={{ background: '#1E2535', border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
                  {results.map((r, i) => (
                    <button
                      key={r.place_id}
                      onMouseDown={() => handleSelect(r)}
                      style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="ms" style={{ fontSize: 16, color: PRIMARY }}>location_on</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{r.main_text}</div>
                        <div style={{ fontSize: 11, color: TEXT3, marginTop: 2, fontFamily: 'Inter, sans-serif' }}>{r.secondary_text}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ASK HOME step */}
          {step === 'ask_home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: TEXT3, lineHeight: 1.5, margin: 0 }}>
                <strong style={{ color: TEXT1 }}>{resolved?.name}</strong> — is this your home?
              </p>
              <button onClick={() => confirmHome(true)} style={{ height: 52, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 14, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 800, color: '#93c5fd' }}>
                Yes, this is home
              </button>
              <button onClick={() => confirmHome(false)} style={{ height: 52, background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: TEXT3 }}>
                No, just a custom location
              </button>
            </div>
          )}

          {/* DEPARTURE TIME step */}
          {(step === 'departure_time' || step === 'landing_time') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT3, margin: 0 }}>
                {step === 'departure_time'
                  ? 'We\'ll build your first day\'s plan from this time.'
                  : 'We\'ll add customs time and adjust your first day\'s pace.'}
              </p>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{
                  width: '100%', height: 56, background: SURFACE2,
                  border: `1.5px solid rgba(59,130,246,.35)`, borderRadius: 14,
                  fontSize: 28, fontWeight: 800, color: TEXT1,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  textAlign: 'center', outline: 'none', cursor: 'pointer',
                  colorScheme: 'dark',
                }}
              />
              <button
                onClick={step === 'departure_time' ? confirmDepartureTime : confirmLandingTime}
                style={{ height: 54, background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`, border: 'none', borderRadius: 16, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 800, color: '#fff', boxShadow: '0 4px 24px rgba(59,130,246,.35)' }}
              >
                {step === 'departure_time' ? `Leaving at ${time}` : `Landing at ${time}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/journey/OriginInputSheet.tsx
git commit -m "feat: add OriginInputSheet with type detection and time pickers"
```

---

## Task 11: Create journey/index.ts and Wire into App.tsx

**Files:**
- Create: `frontend/src/modules/journey/index.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create index.ts**

Create `frontend/src/modules/journey/index.ts`:

```typescript
export { JourneyScreen } from './JourneyScreen';
export { JourneyStrip } from './JourneyStrip';
export { OriginInputSheet } from './OriginInputSheet';
```

- [ ] **Step 2: Add JourneyScreen to App.tsx**

Read `frontend/src/App.tsx`, find where screens are rendered (the big switch/conditional), and add the journey screen case. Look for the pattern that renders `MapScreen` and add the `JourneyScreen` alongside it. The specific lines will depend on current App.tsx structure — find the screen rendering section and add:

```typescript
import { JourneyScreen } from './modules/journey';
```

In the render section, wherever `currentScreen === 'map'` renders `<MapScreen />`, also handle `'journey'`:

```typescript
{currentScreen === 'journey' && <JourneyScreen />}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/journey/index.ts frontend/src/App.tsx
git commit -m "feat: register JourneyScreen in app routing"
```

---

## Task 12: Wire MapScreen — Auto-Navigate and Add JourneyStrip

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

When `isJourneyMode(selectedPlaces)` becomes true (second city detected), auto-navigate to `'journey'` screen. Also add `<JourneyStrip />` above the filter bar.

- [ ] **Step 1: Add imports to MapScreen.tsx**

In `frontend/src/modules/map/MapScreen.tsx`, add these imports at the top:

```typescript
import { isJourneyMode } from './journey-utils';
import { JourneyStrip } from '../journey';
```

- [ ] **Step 2: Add auto-navigation effect**

In `MapScreen`, after the existing `useEffect` that guards against missing city, add:

```typescript
  // Auto-navigate to journey screen when multi-city places are detected
  useEffect(() => {
    if (isJourneyMode(selectedPlaces)) {
      dispatch({ type: 'GO_TO', screen: 'journey' });
    }
  }, [selectedPlaces, dispatch]);
```

- [ ] **Step 3: Add JourneyStrip to the top overlay**

In the top overlay section of `MapScreen`, after `<TravelDateBar />` and before `<FilterBar />`, add:

```tsx
        {/* Journey strip — only visible in multi-city mode */}
        <div style={{ pointerEvents: 'auto' }}>
          <JourneyStrip />
        </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: auto-navigate to journey screen on multi-city detection"
```

---

## Task 13: Extend ItineraryView for Multi-City

**Files:**
- Modify: `frontend/src/modules/route/ItineraryView.tsx`

When `journey` is non-null in app state, the itinerary renders in multi-city mode: day blocks grouped by city, transit separators between cities, global day numbering.

- [ ] **Step 1: Read ItineraryView.tsx** to understand current rendering structure before modifying

Run: `cat frontend/src/modules/route/ItineraryView.tsx | head -80` to see imports and component structure.

- [ ] **Step 2: Add journey-aware rendering**

At the top of the `ItineraryView` component function, read `journey` from state:

```typescript
const { state } = useAppStore();
const journey = state.journey;
const isMultiCity = journey !== null && journey.some(l => l.type === 'city');
```

Add a multi-city render path that reads from `journey` legs when `isMultiCity` is true. Insert before the existing return:

```typescript
if (isMultiCity && journey) {
  const cityLegs = journey.filter(l => l.type === 'city') as Extract<NonNullable<typeof journey>[0], { type: 'city' }>[];
  const transitLegs = journey.filter(l => l.type === 'transit') as Extract<NonNullable<typeof journey>[0], { type: 'transit' }>[];

  let globalDayOffset = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {cityLegs.map((cityLeg, cityIdx) => {
        // Transit separator before each city after the first
        const transitBefore = transitLegs[cityIdx - 1];
        const dayStart = globalDayOffset + 1;
        globalDayOffset += cityLeg.estimatedDays;

        return (
          <div key={cityLeg.city}>
            {transitBefore && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '16px 20px', margin: '8px 0',
                background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)',
                borderRadius: 16, marginLeft: 16, marginRight: 16,
              }}>
                <span className="ms fill" style={{ fontSize: 20, color: '#3b82f6' }}>
                  {transitBefore.mode === 'flight' ? 'flight' : transitBefore.mode === 'train' ? 'train' : 'directions_car'}
                </span>
                <div>
                  <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                    {transitBefore.mode === 'flight' ? 'Fly' : transitBefore.mode === 'train' ? 'Train' : 'Drive'} to {transitBefore.to}
                  </div>
                  {transitBefore.durationMinutes && (
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#8e9099', marginTop: 2 }}>
                      {Math.round(transitBefore.durationMinutes / 60)}h {Math.round(transitBefore.durationMinutes % 60)}m
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* City heading */}
            <div style={{ padding: '16px 20px 8px' }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#3b82f6', marginBottom: 4 }}>
                {cityLeg.arrivalDate ? new Date(cityLeg.arrivalDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `City ${cityIdx + 1}`}
              </div>
              <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{cityLeg.city}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#8e9099', marginTop: 2 }}>
                Day {dayStart}–{globalDayOffset} · {cityLeg.estimatedDays} day{cityLeg.estimatedDays !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Existing itinerary content for this city — rendered via existing DayStops if available */}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run all tests**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run`
Expected: all existing tests pass, no regressions

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/ItineraryView.tsx
git commit -m "feat: extend ItineraryView with multi-city city blocks and transit separators"
```

---

## Self-Review

After all tasks, verify against spec:

| Spec requirement | Covered by |
|---|---|
| JourneyLeg types (origin/city/transit) | Task 1 |
| Store state + actions | Task 2 |
| OSRM transit mode detection | Tasks 3–4 |
| Smart day calculation | Task 4 |
| Date cascade from start date | Task 4 |
| Travel days vs city days | Task 4 |
| Conversational advisor messages | Task 5 |
| Journey tenure strip | Task 6 |
| Origin card | Task 7 |
| City card | Task 7 |
| Transit cards (flight/drive/train) | Task 7 |
| Advisor thread (collapsible) | Task 8 |
| JourneyScreen 60/40 layout | Task 9 |
| Swipeable card deck | Task 9 |
| Progress strip | Task 9 |
| Origin input (type detection) | Task 10 |
| Home confirm + departure time | Task 10 |
| Airport landing time | Task 10 |
| Hotel check-in/out from Google | Task 10 |
| Auto-navigate on multi-city | Task 12 |
| Itinerary multi-city rendering | Task 13 |
| Duration budget picker | Task 6 |
| Budget vs places overflow message | Task 9 |
