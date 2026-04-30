# Phase 3: TypeScript Types & State Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all new TypeScript types needed by Phases 4–8 and expand the app store with new state fields, actions, and reducer cases for the rebuilt map/itinerary architecture.

**Architecture:** All type additions go to `frontend/src/shared/types.ts`. All state, actions, and reducer cases go to `frontend/src/shared/store.tsx`. All tests extend `frontend/src/shared/store.test.ts`. No UI code in this phase — this phase lays the data foundations.

**Tech Stack:** TypeScript, React Context + useReducer (existing store pattern), Vitest.

**Depends on:** Phase 1 complete. If Phase 2 is already merged, `EngineWeights` will already exist in `types.ts` — see note in Task 1.

**Working directory:** `frontend/.worktrees/full-ui-redesign` (the `feature/full-ui-redesign` worktree). Run all commands from there.

**Baseline:** 329 tests passing in the worktree. Every task must keep all tests green.

---

## File Map

```
Modified:
  frontend/src/shared/types.ts      → add ArchetypeId, EngineWeights (if not from Phase 2),
                                       EngineMessage, DiscoveryMode, PinLayer, MapPin,
                                       MapFilterChip, CityContext, EngineItineraryStop,
                                       EngineItineraryDay, EngineItinerary
  frontend/src/shared/store.tsx     → add 7 new AppState fields, 12 new actions,
                                       12 new reducer cases, update initialState + imports
  frontend/src/shared/store.test.ts → add ~30 new tests for all new reducer cases
```

---

## Task 1: Add EngineWeights and ArchetypeId to types.ts

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Test: `frontend/src/shared/store.test.ts`

> **Note:** If Phase 2 is already merged, `EngineWeights` is already in `types.ts`. In that case, skip adding `EngineWeights` — only add `ArchetypeId`.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 types — EngineWeights and ArchetypeId', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('EngineWeights has all 10 dimensions', () => {
    const w: import('./types').EngineWeights = {
      w_walk_affinity: 0.9,
      w_scenic: 0.8,
      w_efficiency: 0.3,
      w_food_density: 0.5,
      w_culture_depth: 0.7,
      w_nightlife: 0.2,
      w_budget_sensitivity: 0.4,
      w_crowd_aversion: 0.6,
      w_spontaneity: 0.7,
      w_rest_need: 0.5,
    }
    expect(Object.keys(w)).toHaveLength(10)
    expect(w.w_walk_affinity).toBe(0.9)
  })

  it('ArchetypeId accepts all 7 valid values', () => {
    const ids: import('./types').ArchetypeId[] = [
      'wanderer', 'historian', 'epicurean',
      'pulse', 'slowtraveller', 'voyager', 'explorer',
    ]
    expect(ids).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — `EngineWeights` and `ArchetypeId` not found in types

- [ ] **Step 3: Add types to types.ts**

Open `frontend/src/shared/types.ts`. At the very bottom of the file, after the last `export`, add:

```typescript
// ── Engine architecture types (Phase 3) ──────────────────────

/**
 * 10-dimension weight vector produced by the OB resolver.
 * Used for cosine similarity archetype resolution and as engine
 * input for every sequencing/insert/swap decision.
 * NOTE: If Phase 2 already merged this type, skip this definition.
 */
export interface EngineWeights {
  w_walk_affinity: number       // 0–1: enjoyment of walking
  w_scenic: number              // 0–1: scenic routes vs efficient
  w_efficiency: number          // 0–1: tight schedule preference
  w_food_density: number        // 0–1: frequency of food/cafe inserts
  w_culture_depth: number       // 0–1: depth at cultural sites
  w_nightlife: number           // 0–1: evening/night weighting
  w_budget_sensitivity: number  // 0–1: penalise expensive inserts
  w_crowd_aversion: number      // 0–1: avoid high-crowd times
  w_spontaneity: number         // 0–1: openness to detours
  w_rest_need: number           // 0–1: frequency of rest breaks
}

/** The 7 traveller archetypes resolved via cosine similarity against EngineWeights. */
export type ArchetypeId =
  | 'wanderer'
  | 'historian'
  | 'epicurean'
  | 'pulse'
  | 'slowtraveller'
  | 'voyager'
  | 'explorer'
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS` — all 329 + new tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.test.ts
git commit -m "feat(types): add EngineWeights and ArchetypeId types"
```

---

## Task 2: Add EngineMessage type to types.ts

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Test: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 types — EngineMessage', () => {
  it('EngineMessage has required fields', () => {
    const msg: import('./types').EngineMessage = {
      id: 'msg-001',
      type: 'swap',
      what: 'Moved Senso-ji to 8am',
      why: 'It closes at 5pm — you\'d arrive at 4:30',
      consequence: 'You now reach Ueno with 3 hours to spare',
      dismissable: true,
    }
    expect(msg.type).toBe('swap')
    expect(msg.dismissable).toBe(true)
    expect(msg.undo_action).toBeUndefined()
  })

  it('EngineMessage with undo_action', () => {
    const msg: import('./types').EngineMessage = {
      id: 'msg-002',
      type: 'resequence',
      what: 'Reordered your afternoon',
      why: 'Ueno closes at 5pm',
      consequence: 'You arrive with 2 hours to spare',
      dismissable: true,
      undo_action: 'undo_resequence_day2',
    }
    expect(msg.undo_action).toBe('undo_resequence_day2')
  })

  it('EngineMessage accepts all valid type values', () => {
    const types: import('./types').EngineMessage['type'][] = [
      'swap', 'insert', 'resequence', 'weather', 'transit', 'advisory', 'event',
    ]
    expect(types).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — `EngineMessage` not found

- [ ] **Step 3: Add EngineMessage to types.ts**

In `frontend/src/shared/types.ts`, after the `ArchetypeId` type you added in Task 1, add:

```typescript
/**
 * Every engine decision emits one of these messages.
 * The LLM writes the three sentences from a structured payload — it does not
 * make decisions, only narrates them.
 */
export interface EngineMessage {
  id: string                   // UUID — React key + dismiss target
  type: 'swap' | 'insert' | 'resequence' | 'weather' | 'transit' | 'advisory' | 'event'
  what: string                 // "Moved Senso-ji to 8am"
  why: string                  // "It closes at 5pm — you'd arrive at 4:30"
  consequence: string          // "You now reach Ueno with 3 hours to spare"
  dismissable: boolean
  undo_action?: string         // action key to reverse this decision
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.test.ts
git commit -m "feat(types): add EngineMessage type"
```

---

## Task 3: Add map exploration types to types.ts

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Test: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 types — map exploration', () => {
  it('MapPin has all required fields', () => {
    const pin: import('./types').MapPin = {
      id: 'pin-001',
      placeId: 'ChIJ123',
      title: 'Senso-ji Temple',
      lat: 35.7148,
      lon: 139.7967,
      layer: 'famous',
      category: 'historic',
      saved: false,
      inItinerary: false,
    }
    expect(pin.layer).toBe('famous')
    expect(pin.saved).toBe(false)
    expect(pin.inItinerary).toBe(false)
  })

  it('MapPin layer accepts all 3 values', () => {
    const layers: import('./types').PinLayer[] = ['famous', 'reference', 'user']
    expect(layers).toHaveLength(3)
  })

  it('DiscoveryMode accepts anchor and deep', () => {
    const modes: import('./types').DiscoveryMode[] = ['anchor', 'deep']
    expect(modes).toHaveLength(2)
  })

  it('MapFilterChip accepts all valid values', () => {
    const chips: import('./types').MapFilterChip[] = [
      'all', 'famous', 'for_you', 'culture', 'food', 'parks', 'nightlife',
    ]
    expect(chips).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — `MapPin`, `PinLayer`, `DiscoveryMode`, `MapFilterChip` not found

- [ ] **Step 3: Add types to types.ts**

In `frontend/src/shared/types.ts`, after `EngineMessage`, add:

```typescript
// ── Map exploration types (Phase 3) ──────────────────────────

/**
 * discovery_mode is set per city.
 *   anchor → full famous layer shown (essentials)
 *   deep   → famous layer de-emphasised, hidden gem pins boosted
 */
export type DiscoveryMode = 'anchor' | 'deep'

/** Which of the three simultaneous pin layers a pin belongs to. */
export type PinLayer = 'famous' | 'reference' | 'user'

/**
 * Unified pin type for the rebuilt map screen.
 * Replaces the split between Place (famous) and ReferencePin (reference)
 * and selectedPlaces (user-added).
 */
export interface MapPin {
  id: string           // unique pin ID (may be place_id for famous, uuid for reference)
  placeId: string      // Google place_id
  title: string
  lat: number
  lon: number
  layer: PinLayer
  category: Category
  saved: boolean       // ❤️ bookmarked — NOT in itinerary
  inItinerary: boolean // blue ring — user explicitly added to trip
}

/**
 * Filter chips in the map filter bar.
 *   all       → show all pins
 *   famous    → ★ Famous layer only
 *   for_you   → ✦ Reference ghost layer only
 *   culture   → filter by category
 *   food      → filter by category
 *   parks     → filter by category
 *   nightlife → filter by category
 */
export type MapFilterChip = 'all' | 'famous' | 'for_you' | 'culture' | 'food' | 'parks' | 'nightlife'
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.test.ts
git commit -m "feat(types): add map exploration types (DiscoveryMode, PinLayer, MapPin, MapFilterChip)"
```

---

## Task 4: Add CityContext type to types.ts

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Test: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 types — CityContext', () => {
  it('CityContext has all required fields', () => {
    const ctx: import('./types').CityContext = {
      city: 'Tokyo',
      countryCode: 'JP',
      lat: 35.6762,
      lon: 139.6503,
      discoveryMode: 'deep',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      days: 5,
    }
    expect(ctx.city).toBe('Tokyo')
    expect(ctx.discoveryMode).toBe('deep')
    expect(ctx.days).toBe(5)
  })

  it('CityContext allows null dates', () => {
    const ctx: import('./types').CityContext = {
      city: 'Kyoto',
      countryCode: 'JP',
      lat: 35.0116,
      lon: 135.7681,
      discoveryMode: 'anchor',
      startDate: null,
      endDate: null,
      days: 0,
    }
    expect(ctx.startDate).toBeNull()
    expect(ctx.endDate).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — `CityContext` not found

- [ ] **Step 3: Add CityContext to types.ts**

In `frontend/src/shared/types.ts`, after `MapFilterChip`, add:

```typescript
/**
 * Context for a single city in the current trip session.
 * One CityContext per city — multi-city trips have an array of these.
 * discovery_mode is set per city when the city first loads.
 */
export interface CityContext {
  city: string
  countryCode: string
  lat: number
  lon: number
  discoveryMode: DiscoveryMode
  startDate: string | null   // ISO date "YYYY-MM-DD"
  endDate: string | null     // ISO date "YYYY-MM-DD"
  days: number               // computed from date range or 1 if no dates set
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.test.ts
git commit -m "feat(types): add CityContext type"
```

---

## Task 5: Add engine itinerary types to types.ts

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Test: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 types — EngineItinerary', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('EngineItineraryStop has all required fields', () => {
    const stop: import('./types').EngineItineraryStop = {
      id: 'stop-001',
      placeId: 'ChIJ123',
      title: 'Senso-ji',
      area: 'Asakusa',
      day: 1,
      time: '09:00',
      durationMin: 90,
      category: 'historic',
      lat: 35.7148,
      lon: 139.7967,
      priceLevel: 0,
      rating: 4.6,
      weekdayText: ['Monday: 6:00 AM – 5:00 PM'],
      whyForYou: 'Perfect for your love of ancient spaces.',
      localTip: 'The incense smoke is believed to bring good health.',
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    }
    expect(stop.day).toBe(1)
    expect(stop.time).toBe('09:00')
    expect(stop.durationMin).toBe(90)
  })

  it('EngineItineraryStop allows null optional fields', () => {
    const stop: import('./types').EngineItineraryStop = {
      id: 'stop-002',
      placeId: 'ChIJ456',
      title: 'Coffee Stop',
      area: 'Shinjuku',
      day: 1,
      time: '11:00',
      durationMin: 30,
      category: 'cafe',
      lat: 35.6896,
      lon: 139.7006,
      priceLevel: null,
      rating: null,
      weekdayText: [],
      whyForYou: 'A calm moment mid-morning.',
      localTip: null,
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    }
    expect(stop.priceLevel).toBeNull()
    expect(stop.localTip).toBeNull()
  })

  it('EngineItineraryDay has required fields', () => {
    const day: import('./types').EngineItineraryDay = {
      day: 1,
      date: '2026-06-01',
      city: 'Tokyo',
      isTravel: false,
      stops: [],
      messages: [],
    }
    expect(day.day).toBe(1)
    expect(day.isTravel).toBe(false)
  })

  it('EngineItineraryDay isTravel true has no stops', () => {
    const travelDay: import('./types').EngineItineraryDay = {
      day: 3,
      date: '2026-06-03',
      city: 'Tokyo',
      isTravel: true,
      stops: [],
      messages: [],
    }
    expect(travelDay.isTravel).toBe(true)
    expect(travelDay.stops).toHaveLength(0)
  })

  it('EngineItinerary has all required fields', () => {
    const weights: import('./types').EngineWeights = {
      w_walk_affinity: 0.9, w_scenic: 0.8, w_efficiency: 0.3,
      w_food_density: 0.5, w_culture_depth: 0.7, w_nightlife: 0.2,
      w_budget_sensitivity: 0.4, w_crowd_aversion: 0.6,
      w_spontaneity: 0.7, w_rest_need: 0.5,
    }
    const itin: import('./types').EngineItinerary = {
      id: 'itin-001',
      generatedAt: '2026-06-01T08:00:00Z',
      cities: ['Tokyo'],
      days: [],
      personaSnapshot: weights,
      archetypeSnapshot: 'wanderer',
    }
    expect(itin.cities).toEqual(['Tokyo'])
    expect(itin.archetypeSnapshot).toBe('wanderer')
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — `EngineItineraryStop`, `EngineItineraryDay`, `EngineItinerary` not found

- [ ] **Step 3: Add types to types.ts**

In `frontend/src/shared/types.ts`, after `CityContext`, add:

```typescript
// ── Engine itinerary types (Phase 3) ─────────────────────────

/**
 * A single stop in an engine-built itinerary.
 * All factual fields (rating, priceLevel, weekdayText) come from Google Places.
 * whyForYou and localTip are LLM-generated (marked ✦ in UI — no factual claims).
 */
export interface EngineItineraryStop {
  id: string               // unique stop ID (UUID)
  placeId: string          // Google place_id
  title: string
  area: string             // neighbourhood name (from city data model)
  day: number              // 1-indexed
  time: string             // "09:00" — engine-assigned start time
  durationMin: number      // engine-assigned visit duration
  category: Category
  lat: number
  lon: number
  priceLevel: number | null   // 0–4 from Google Places (0 = free)
  rating: number | null       // from Google Places
  weekdayText: string[]       // from Google Places opening hours
  whyForYou: string           // LLM ✦ — persona tone only, no hours/prices/facts
  localTip: string | null     // LLM ✦ — atmosphere only
  googleMapsUrl: string | null
  website: string | null
  photoRef: string | null     // Google Places photo reference
}

/**
 * One day in an engine itinerary.
 * Travel days (isTravel: true) have no stops — the engine does not schedule
 * sightseeing during transit days.
 * messages are engine decision banners to display between stops.
 */
export interface EngineItineraryDay {
  day: number
  date: string               // ISO date "YYYY-MM-DD"
  city: string
  isTravel: boolean          // ✈️ travel day — no stops
  stops: EngineItineraryStop[]
  messages: EngineMessage[]  // engine decision banners for this day
}

/**
 * A complete itinerary produced by the intelligence engine.
 * personaSnapshot and archetypeSnapshot capture the weights used at
 * generation time — needed to regenerate consistently.
 */
export interface EngineItinerary {
  id: string                   // UUID
  generatedAt: string          // ISO datetime
  cities: string[]             // ordered list of cities
  days: EngineItineraryDay[]
  personaSnapshot: EngineWeights   // weights at generation time
  archetypeSnapshot: ArchetypeId
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.test.ts
git commit -m "feat(types): add engine itinerary types (EngineItineraryStop, EngineItineraryDay, EngineItinerary)"
```

---

## Task 6: Expand AppState and initialState in store.tsx

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Test: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 — initialState new fields', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('initialState has cityContexts as empty array', () => {
    expect(initialState.cityContexts).toEqual([])
  })

  it('initialState has activeCityIndex as 0', () => {
    expect(initialState.activeCityIndex).toBe(0)
  })

  it('initialState has engineMessages as empty array', () => {
    expect(initialState.engineMessages).toEqual([])
  })

  it('initialState has engineItinerary as null', () => {
    expect(initialState.engineItinerary).toBeNull()
  })

  it('initialState has itineraryHistory as empty array', () => {
    expect(initialState.itineraryHistory).toEqual([])
  })

  it('initialState has activePinId as null', () => {
    expect(initialState.activePinId).toBeNull()
  })

  it('initialState has mapFilter as "all"', () => {
    expect(initialState.mapFilter).toBe('all')
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — new fields don't exist on `initialState`

- [ ] **Step 3: Update imports in store.tsx**

Open `frontend/src/shared/store.tsx`. Find the `import type {` block at the top. Add the new types to the import list:

```typescript
import type {
  // ... existing imports ...
  EngineWeights,
  ArchetypeId,
  EngineMessage,
  DiscoveryMode,
  PinLayer,
  MapPin,
  MapFilterChip,
  CityContext,
  EngineItineraryStop,
  EngineItineraryDay,
  EngineItinerary,
} from './types';
```

The existing import line starts with:
```typescript
import type {
  Screen,
  OnboardingAnswers,
```

Edit it by appending the new types to the existing import list (before the closing `} from './types'`):

```typescript
  EngineWeights,
  ArchetypeId,
  EngineMessage,
  DiscoveryMode,
  PinLayer,
  MapPin,
  MapFilterChip,
  CityContext,
  EngineItineraryStop,
  EngineItineraryDay,
  EngineItinerary,
```

(These types are only used as type annotations — TypeScript will compile them away. They don't affect runtime.)

- [ ] **Step 4: Add new fields to AppState interface**

Find the `export interface AppState {` declaration in `frontend/src/shared/store.tsx`. After the last existing field (`similarPinsState`), add:

```typescript
  // ── Phase 3: new architecture fields ─────────────────────────
  cityContexts: CityContext[]          // one per city in current multi-city trip
  activeCityIndex: number              // index into cityContexts — which city is active
  engineMessages: EngineMessage[]      // current session engine decision banners (transient)
  engineItinerary: EngineItinerary | null  // current engine-built itinerary
  itineraryHistory: EngineItinerary[]  // previous generations — max 10
  activePinId: string | null           // which pin card is currently shown
  mapFilter: MapFilterChip             // active filter chip in the map filter bar
```

- [ ] **Step 5: Update initialState**

Find `export const initialState: AppState = {` in `frontend/src/shared/store.tsx`. After the `similarPinsState: null,` line, add:

```typescript
  // ── Phase 3: new architecture fields ─────────────────────────
  cityContexts: [],
  activeCityIndex: 0,
  engineMessages: [],
  engineItinerary: ssGet<EngineItinerary>('ur_ss_engine_itin') ?? null,
  itineraryHistory: ssGet<EngineItinerary[]>('ur_ss_itin_history') ?? [],
  activePinId: null,
  mapFilter: 'all' as MapFilterChip,
```

- [ ] **Step 6: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS` — all existing tests + new initialState tests pass

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat(store): expand AppState with 7 new fields for rebuilt map/itinerary architecture"
```

---

## Task 7: Add city context actions and reducer cases

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Test: `frontend/src/shared/store.test.ts`

Four new actions:
- `SET_CITY_CONTEXTS` — replace all city contexts
- `ADD_CITY_CONTEXT` — add a new city (no-op if city already exists)
- `SET_ACTIVE_CITY_INDEX` — set which city is active
- `SET_DISCOVERY_MODE` — update discovery mode for a specific city

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 — city context reducer actions', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  const tokyoCtx: import('./types').CityContext = {
    city: 'Tokyo', countryCode: 'JP', lat: 35.67, lon: 139.65,
    discoveryMode: 'anchor', startDate: '2026-06-01', endDate: '2026-06-05', days: 5,
  }
  const kyotoCtx: import('./types').CityContext = {
    city: 'Kyoto', countryCode: 'JP', lat: 35.01, lon: 135.76,
    discoveryMode: 'deep', startDate: '2026-06-06', endDate: '2026-06-08', days: 3,
  }

  it('SET_CITY_CONTEXTS replaces all contexts', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'SET_CITY_CONTEXTS', contexts: [kyotoCtx] })
    expect(next.cityContexts).toEqual([kyotoCtx])
  })

  it('ADD_CITY_CONTEXT appends a new city', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'ADD_CITY_CONTEXT', context: kyotoCtx })
    expect(next.cityContexts).toHaveLength(2)
    expect(next.cityContexts[1].city).toBe('Kyoto')
  })

  it('ADD_CITY_CONTEXT is a no-op if city already exists', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'ADD_CITY_CONTEXT', context: tokyoCtx })
    expect(next.cityContexts).toHaveLength(1)
  })

  it('SET_ACTIVE_CITY_INDEX updates the index', () => {
    const state = { ...initialState, activeCityIndex: 0 }
    const next = reducer(state, { type: 'SET_ACTIVE_CITY_INDEX', index: 1 })
    expect(next.activeCityIndex).toBe(1)
  })

  it('SET_DISCOVERY_MODE updates discovery mode for the correct city', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx, kyotoCtx] }
    const next = reducer(state, { type: 'SET_DISCOVERY_MODE', cityIndex: 0, mode: 'deep' })
    expect(next.cityContexts[0].discoveryMode).toBe('deep')
    expect(next.cityContexts[1].discoveryMode).toBe('deep') // kyoto unchanged
  })

  it('SET_DISCOVERY_MODE does not mutate other cities', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx, kyotoCtx] }
    const next = reducer(state, { type: 'SET_DISCOVERY_MODE', cityIndex: 0, mode: 'deep' })
    expect(next.cityContexts[1].city).toBe('Kyoto')
    expect(next.cityContexts[1].discoveryMode).toBe('deep') // kyoto was already 'deep'
  })

  it('SET_DISCOVERY_MODE returns state unchanged if index out of range', () => {
    const state = { ...initialState, cityContexts: [tokyoCtx] }
    const next = reducer(state, { type: 'SET_DISCOVERY_MODE', cityIndex: 5, mode: 'deep' })
    expect(next.cityContexts).toEqual([tokyoCtx])
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — new action types not found

- [ ] **Step 3: Add actions to the Action union in store.tsx**

Find `export type Action =` in `frontend/src/shared/store.tsx`. After the last existing action in the union (before the closing `;`), add:

```typescript
  // ── Phase 3: city context actions ────────────────────────────
  | { type: 'SET_CITY_CONTEXTS'; contexts: CityContext[] }
  | { type: 'ADD_CITY_CONTEXT'; context: CityContext }
  | { type: 'SET_ACTIVE_CITY_INDEX'; index: number }
  | { type: 'SET_DISCOVERY_MODE'; cityIndex: number; mode: DiscoveryMode }
```

- [ ] **Step 4: Add reducer cases**

Find `case 'SET_SIMILAR_PINS':` in the reducer (currently the last case before `default`). Add after it:

```typescript
    // ── Phase 3: city context cases ────────────────────────────

    case 'SET_CITY_CONTEXTS':
      return { ...state, cityContexts: action.contexts }

    case 'ADD_CITY_CONTEXT': {
      const exists = state.cityContexts.some(c => c.city === action.context.city)
      if (exists) return state
      return { ...state, cityContexts: [...state.cityContexts, action.context] }
    }

    case 'SET_ACTIVE_CITY_INDEX':
      return { ...state, activeCityIndex: action.index }

    case 'SET_DISCOVERY_MODE': {
      if (action.cityIndex < 0 || action.cityIndex >= state.cityContexts.length) return state
      const contexts = state.cityContexts.map((c, i) =>
        i === action.cityIndex ? { ...c, discoveryMode: action.mode } : c
      )
      return { ...state, cityContexts: contexts }
    }
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat(store): add city context actions (SET_CITY_CONTEXTS, ADD_CITY_CONTEXT, SET_ACTIVE_CITY_INDEX, SET_DISCOVERY_MODE)"
```

---

## Task 8: Add engine message actions and reducer cases

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Test: `frontend/src/shared/store.test.ts`

Three new actions:
- `ADD_ENGINE_MESSAGE` — append a message
- `DISMISS_ENGINE_MESSAGE` — remove by id
- `CLEAR_ENGINE_MESSAGES` — wipe all

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 — engine message reducer actions', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  const msg1: import('./types').EngineMessage = {
    id: 'msg-001',
    type: 'swap',
    what: 'Moved Senso-ji to 8am',
    why: 'It closes at 5pm',
    consequence: 'You arrive at Ueno with 3 hours to spare',
    dismissable: true,
  }
  const msg2: import('./types').EngineMessage = {
    id: 'msg-002',
    type: 'weather',
    what: 'Moved outdoor stops indoors',
    why: 'Rain forecast from 2pm',
    consequence: 'Your afternoon stays on schedule',
    dismissable: true,
  }

  it('ADD_ENGINE_MESSAGE appends to empty list', () => {
    const next = reducer(initialState, { type: 'ADD_ENGINE_MESSAGE', message: msg1 })
    expect(next.engineMessages).toEqual([msg1])
  })

  it('ADD_ENGINE_MESSAGE appends to existing list', () => {
    const state = { ...initialState, engineMessages: [msg1] }
    const next = reducer(state, { type: 'ADD_ENGINE_MESSAGE', message: msg2 })
    expect(next.engineMessages).toHaveLength(2)
    expect(next.engineMessages[1].id).toBe('msg-002')
  })

  it('DISMISS_ENGINE_MESSAGE removes by id', () => {
    const state = { ...initialState, engineMessages: [msg1, msg2] }
    const next = reducer(state, { type: 'DISMISS_ENGINE_MESSAGE', id: 'msg-001' })
    expect(next.engineMessages).toHaveLength(1)
    expect(next.engineMessages[0].id).toBe('msg-002')
  })

  it('DISMISS_ENGINE_MESSAGE is a no-op for unknown id', () => {
    const state = { ...initialState, engineMessages: [msg1] }
    const next = reducer(state, { type: 'DISMISS_ENGINE_MESSAGE', id: 'does-not-exist' })
    expect(next.engineMessages).toEqual([msg1])
  })

  it('CLEAR_ENGINE_MESSAGES empties the list', () => {
    const state = { ...initialState, engineMessages: [msg1, msg2] }
    const next = reducer(state, { type: 'CLEAR_ENGINE_MESSAGES' })
    expect(next.engineMessages).toEqual([])
  })

  it('CLEAR_ENGINE_MESSAGES is a no-op on empty list', () => {
    const next = reducer(initialState, { type: 'CLEAR_ENGINE_MESSAGES' })
    expect(next.engineMessages).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — new action types not found

- [ ] **Step 3: Add actions to the Action union in store.tsx**

After the city context actions you added in Task 7, add:

```typescript
  // ── Phase 3: engine message actions ──────────────────────────
  | { type: 'ADD_ENGINE_MESSAGE'; message: EngineMessage }
  | { type: 'DISMISS_ENGINE_MESSAGE'; id: string }
  | { type: 'CLEAR_ENGINE_MESSAGES' }
```

- [ ] **Step 4: Add reducer cases**

After the city context reducer cases you added in Task 7, add:

```typescript
    // ── Phase 3: engine message cases ──────────────────────────

    case 'ADD_ENGINE_MESSAGE':
      return { ...state, engineMessages: [...state.engineMessages, action.message] }

    case 'DISMISS_ENGINE_MESSAGE':
      return {
        ...state,
        engineMessages: state.engineMessages.filter(m => m.id !== action.id),
      }

    case 'CLEAR_ENGINE_MESSAGES':
      return { ...state, engineMessages: [] }
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat(store): add engine message actions (ADD_ENGINE_MESSAGE, DISMISS_ENGINE_MESSAGE, CLEAR_ENGINE_MESSAGES)"
```

---

## Task 9: Add engine itinerary actions and reducer cases

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Test: `frontend/src/shared/store.test.ts`

Two new actions:
- `SET_ENGINE_ITINERARY` — set or clear the current itinerary, persists to localStorage
- `PUSH_ITINERARY_HISTORY` — set as current AND push previous to history (max 10), persists

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 — engine itinerary reducer actions', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
    stubStorage.setItem.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  const weights: import('./types').EngineWeights = {
    w_walk_affinity: 0.9, w_scenic: 0.8, w_efficiency: 0.3,
    w_food_density: 0.5, w_culture_depth: 0.7, w_nightlife: 0.2,
    w_budget_sensitivity: 0.4, w_crowd_aversion: 0.6,
    w_spontaneity: 0.7, w_rest_need: 0.5,
  }
  const itin1: import('./types').EngineItinerary = {
    id: 'itin-001', generatedAt: '2026-06-01T08:00:00Z',
    cities: ['Tokyo'], days: [], personaSnapshot: weights, archetypeSnapshot: 'wanderer',
  }
  const itin2: import('./types').EngineItinerary = {
    id: 'itin-002', generatedAt: '2026-06-02T09:00:00Z',
    cities: ['Tokyo'], days: [], personaSnapshot: weights, archetypeSnapshot: 'wanderer',
  }

  it('SET_ENGINE_ITINERARY sets the itinerary', () => {
    const next = reducer(initialState, { type: 'SET_ENGINE_ITINERARY', itinerary: itin1 })
    expect(next.engineItinerary).toEqual(itin1)
  })

  it('SET_ENGINE_ITINERARY null clears the itinerary', () => {
    const state = { ...initialState, engineItinerary: itin1 }
    const next = reducer(state, { type: 'SET_ENGINE_ITINERARY', itinerary: null })
    expect(next.engineItinerary).toBeNull()
  })

  it('SET_ENGINE_ITINERARY persists to localStorage', () => {
    reducer(initialState, { type: 'SET_ENGINE_ITINERARY', itinerary: itin1 })
    expect(stubStorage.setItem).toHaveBeenCalledWith(
      'ur_ss_engine_itin',
      JSON.stringify(itin1),
    )
  })

  it('PUSH_ITINERARY_HISTORY sets new itinerary as current', () => {
    const next = reducer(initialState, { type: 'PUSH_ITINERARY_HISTORY', itinerary: itin1 })
    expect(next.engineItinerary).toEqual(itin1)
  })

  it('PUSH_ITINERARY_HISTORY adds to history', () => {
    const state = { ...initialState, engineItinerary: itin1, itineraryHistory: [] }
    const next = reducer(state, { type: 'PUSH_ITINERARY_HISTORY', itinerary: itin2 })
    expect(next.itineraryHistory[0]).toEqual(itin2)
    expect(next.engineItinerary).toEqual(itin2)
  })

  it('PUSH_ITINERARY_HISTORY caps history at 10', () => {
    const manyItins: import('./types').EngineItinerary[] = Array.from({ length: 10 }, (_, i) => ({
      ...itin1, id: `itin-old-${i}`,
    }))
    const state = { ...initialState, itineraryHistory: manyItins }
    const next = reducer(state, { type: 'PUSH_ITINERARY_HISTORY', itinerary: itin2 })
    expect(next.itineraryHistory).toHaveLength(10)
    expect(next.itineraryHistory[0].id).toBe('itin-002')
  })

  it('PUSH_ITINERARY_HISTORY persists to localStorage', () => {
    reducer(initialState, { type: 'PUSH_ITINERARY_HISTORY', itinerary: itin1 })
    expect(stubStorage.setItem).toHaveBeenCalledWith('ur_ss_engine_itin', JSON.stringify(itin1))
    expect(stubStorage.setItem).toHaveBeenCalledWith('ur_ss_itin_history', JSON.stringify([itin1]))
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — new action types not found

- [ ] **Step 3: Add actions to the Action union in store.tsx**

After the engine message actions you added in Task 8, add:

```typescript
  // ── Phase 3: engine itinerary actions ────────────────────────
  | { type: 'SET_ENGINE_ITINERARY'; itinerary: EngineItinerary | null }
  | { type: 'PUSH_ITINERARY_HISTORY'; itinerary: EngineItinerary }
```

- [ ] **Step 4: Add reducer cases**

After the engine message reducer cases, add:

```typescript
    // ── Phase 3: engine itinerary cases ────────────────────────

    case 'SET_ENGINE_ITINERARY':
      ssSave('ur_ss_engine_itin', action.itinerary)
      return { ...state, engineItinerary: action.itinerary }

    case 'PUSH_ITINERARY_HISTORY': {
      const history = [action.itinerary, ...state.itineraryHistory].slice(0, 10)
      ssSave('ur_ss_engine_itin', action.itinerary)
      ssSave('ur_ss_itin_history', history)
      return { ...state, engineItinerary: action.itinerary, itineraryHistory: history }
    }
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat(store): add engine itinerary actions (SET_ENGINE_ITINERARY, PUSH_ITINERARY_HISTORY)"
```

---

## Task 10: Add map UI actions and reducer cases

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Test: `frontend/src/shared/store.test.ts`

Two new actions:
- `SET_ACTIVE_PIN_ID` — which pin card is open (null = card closed)
- `SET_MAP_FILTER` — which filter chip is active

- [ ] **Step 1: Write the failing test**

Add to the bottom of `frontend/src/shared/store.test.ts`:

```typescript
describe('Phase 3 — map UI reducer actions', () => {
  const stubStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }
  beforeEach(() => {
    vi.stubGlobal('localStorage', stubStorage)
    vi.stubGlobal('sessionStorage', stubStorage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('SET_ACTIVE_PIN_ID sets the pin id', () => {
    const next = reducer(initialState, { type: 'SET_ACTIVE_PIN_ID', id: 'pin-001' })
    expect(next.activePinId).toBe('pin-001')
  })

  it('SET_ACTIVE_PIN_ID null closes the card', () => {
    const state = { ...initialState, activePinId: 'pin-001' }
    const next = reducer(state, { type: 'SET_ACTIVE_PIN_ID', id: null })
    expect(next.activePinId).toBeNull()
  })

  it('SET_MAP_FILTER updates the filter', () => {
    const next = reducer(initialState, { type: 'SET_MAP_FILTER', filter: 'culture' })
    expect(next.mapFilter).toBe('culture')
  })

  it('SET_MAP_FILTER accepts all valid values', () => {
    const filters: import('./types').MapFilterChip[] = [
      'all', 'famous', 'for_you', 'culture', 'food', 'parks', 'nightlife',
    ]
    for (const filter of filters) {
      const next = reducer(initialState, { type: 'SET_MAP_FILTER', filter })
      expect(next.mapFilter).toBe(filter)
    }
  })

  it('SET_MAP_FILTER back to all', () => {
    const state = { ...initialState, mapFilter: 'culture' as import('./types').MapFilterChip }
    const next = reducer(state, { type: 'SET_MAP_FILTER', filter: 'all' })
    expect(next.mapFilter).toBe('all')
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `FAIL` — `SET_ACTIVE_PIN_ID` and `SET_MAP_FILTER` not found

- [ ] **Step 3: Add actions to the Action union in store.tsx**

After the engine itinerary actions you added in Task 9, add:

```typescript
  // ── Phase 3: map UI actions ───────────────────────────────────
  | { type: 'SET_ACTIVE_PIN_ID'; id: string | null }
  | { type: 'SET_MAP_FILTER'; filter: MapFilterChip }
```

- [ ] **Step 4: Add reducer cases**

After the engine itinerary reducer cases, add:

```typescript
    // ── Phase 3: map UI cases ───────────────────────────────────

    case 'SET_ACTIVE_PIN_ID':
      return { ...state, activePinId: action.id }

    case 'SET_MAP_FILTER':
      return { ...state, mapFilter: action.filter }
```

- [ ] **Step 5: Run test — expect pass**

```bash
cd frontend && npx vitest run src/shared/store.test.ts
```

Expected: `PASS`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat(store): add map UI actions (SET_ACTIVE_PIN_ID, SET_MAP_FILTER)"
```

---

## Task 11: TypeScript compilation and full test suite

**Files:** No changes — verification only.

- [ ] **Step 1: TypeScript strict compile check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors. If there are errors, they will be import/type errors — fix them before continuing.

- [ ] **Step 2: Full test suite**

```bash
cd frontend && npx vitest run
```

Expected:
```
Test Files  30 passed (30)
     Tests  ~370 passed (370)
  Start at  ...
  Duration  ...
```

All 329 original tests still pass. New tests add ~40+ more.

- [ ] **Step 3: ESLint check**

```bash
cd frontend && npx eslint src/shared/types.ts src/shared/store.tsx src/shared/store.test.ts
```

Expected: No errors.

- [ ] **Step 4: Build check**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Final commit if any lint fixes were needed**

If ESLint auto-fixes were applied:
```bash
git add frontend/src/shared/
git commit -m "fix(store): lint fixes after Phase 3 type additions"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task that covers it |
|---|---|
| EngineWeights 10-dimension vector | Task 1 |
| ArchetypeId type for 7 archetypes | Task 1 |
| EngineMessage (WHAT/WHY/CONSEQUENCE/undo) | Task 2 |
| DiscoveryMode (anchor/deep) per city | Tasks 3 + 7 |
| PinLayer (famous/reference/user) | Task 3 |
| MapPin unified type | Task 3 |
| MapFilterChip (all/famous/for_you/culture/food/parks/nightlife) | Task 3 |
| CityContext (per-city discovery mode + date range) | Task 4 |
| EngineItineraryStop (all factual + LLM fields) | Task 5 |
| EngineItineraryDay (with isTravel flag) | Task 5 |
| EngineItinerary (with personaSnapshot) | Task 5 |
| State: cityContexts[] | Task 6 |
| State: activeCityIndex | Task 6 |
| State: engineMessages[] (transient) | Task 6 |
| State: engineItinerary (persisted) | Task 6 |
| State: itineraryHistory max 10 | Task 9 |
| State: activePinId | Task 6 |
| State: mapFilter | Task 6 |
| City context actions | Task 7 |
| Engine message actions (add/dismiss/clear) | Task 8 |
| Engine itinerary actions (set/push-history) | Task 9 |
| Map UI actions (pin id/filter) | Task 10 |

**Placeholder scan:** None found.

**Type consistency check:**
- `EngineItinerary.personaSnapshot: EngineWeights` — defined Task 1, used Task 5 ✓
- `EngineItinerary.archetypeSnapshot: ArchetypeId` — defined Task 1, used Task 5 ✓
- `EngineItineraryDay.messages: EngineMessage[]` — defined Task 2, used Task 5 ✓
- `CityContext.discoveryMode: DiscoveryMode` — defined Task 3, used Task 4 ✓
- `MapPin.layer: PinLayer` — defined in same Task 3 ✓
- `AppState.cityContexts: CityContext[]` — defined Task 4, added Task 6 ✓
- `AppState.engineMessages: EngineMessage[]` — defined Task 2, added Task 6 ✓
- `AppState.engineItinerary: EngineItinerary | null` — defined Task 5, added Task 6 ✓
- `AppState.mapFilter: MapFilterChip` — defined Task 3, added Task 6 ✓
- `DISMISS_ENGINE_MESSAGE` uses `id: string` matching `EngineMessage.id: string` ✓
- `SET_DISCOVERY_MODE` uses `cityIndex: number; mode: DiscoveryMode` matching reducer case ✓
- `PUSH_ITINERARY_HISTORY` caps at 10 with `.slice(0, 10)` ✓
