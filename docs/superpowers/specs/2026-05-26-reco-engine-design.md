# Reco Engine — Design Spec
**Date:** 2026-05-26  
**Status:** Approved for implementation  
**Replaces:** `buildMealRecos` + `buildPersonaRecos` in `reel-builder.ts`

---

## 1. Problem

The current reco system is a collection of hardcoded if-statements. Every new scenario requires a new function, a new threshold, a new branch. There is no principled way to prioritize recos against each other, no way to detect scenarios we haven't anticipated, and no behavior data captured to improve the system over time.

The result: recos rarely fire (threshold bug), feel generic, and the system cannot grow without manual effort per scenario.

---

## 2. Design Principle

**Don't write rules. Define what a good itinerary looks like for a persona, measure the actual itinerary against it, and derive scenarios from the delta.**

A persona's preferences define a *target profile* — a vector of expected values across all meaningful itinerary dimensions. The actual itinerary produces a *measured profile*. The delta between target and actual, weighted by dimension relevance to this persona, produces a ranked list of gaps. Each significant gap becomes a reco card. Adding a new signal means adding a new dimension — detection, scoring, and ranking are automatic.

This is the same separation-of-concerns as the persona mapping system: define the space, let the system do the mapping.

---

## 3. Architecture Overview

```
OB answers + persona weights + itinerary + context
                    ↓
           computeRecoSignal()          → RecoSignal (all inputs in one place)
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
computeTargetProfile(signal)   computeActualProfile(stops, signal)
    ↓                               ↓
    └───────────────┬───────────────┘
                    ↓
            ItineraryProfile (target)
            ItineraryProfile (actual)
                    ↓
         detectGaps(target, actual, signal)
                    ↓
         gaps[] sorted by significance
                    ↓
         resolveConflicts(gaps)
                    ↓
         gapToCard(gap, stops, signal)   [LLM writes copy only]
                    ↓
         ReelRecoCard[]  →  reel-builder
                    ↓
         trackRecoInteraction()  →  Supabase
```

**AI role:** The LLM is called once, after the engine has decided which gaps to surface, to write the human-readable label and consequence text. It never decides what surfaces, which gaps are significant, or how cards are ranked. The system owns all decisions. The LLM is a copywriter.

---

## 4. Module Structure

```
frontend/src/modules/route/reco-engine/
  signal.ts          — RecoSignal type + computeRecoSignal()
  profile.ts         — ItineraryProfile + computeTargetProfile() + computeActualProfile()
  semantics.ts       — SemanticRole + computeStopSemantics()
  engine.ts          — deriveRecos() + detectGaps() + resolveConflicts() + gapToCard()
  behavior.ts        — RecoInteraction + trackRecoInteraction() + Supabase sync
  dimensions.ts      — dimension definitions, weight mappings, Phase 2 stubs
  index.ts           — public API: deriveRecos()
```

`reel-builder.ts` imports only from `index.ts`. Internal module structure is not exposed.

---

## 5. RecoSignal — All Inputs In One Place

Computed once per day, passed to all downstream functions. No function reaches into global state.

```ts
// Defined in signal.ts
type ArchetypeGroup = 'sensory' | 'cultural' | 'social' | 'explorer';

// Mapping: archetype → group
const ARCHETYPE_GROUPS: Record<string, ArchetypeGroup> = {
  slowscholar: 'cultural',  aesthete: 'sensory',   historian: 'cultural',
  nightcreature: 'social',  pulse: 'social',        ritualseeker: 'sensory',
  flaneur: 'explorer',      drifter: 'explorer',    // extend as archetypes are added
};

interface RecoSignal {
  // ── Persona ──────────────────────────────────────────────────
  weights: EngineWeights;           // w_nightlife, w_culture_depth, etc.
  archetype: string;                // 'slowscholar', 'pulse', 'flaneur', etc.
  archetypeGroup: ArchetypeGroup;
  archetypeConfidence: number;      // 0–1; computed as (answered OB questions / total OB questions)

  // ── Raw behavioral patterns (from state.obAnswers, not just derived archetype) ──
  // Derived in computeRecoSignal() from obAnswers fields:
  //   pace       → obAnswers.pace ('slow'|'moderate'|'fast') direct
  //   social     → obAnswers.social ('solo'|'duo'|'group') direct
  //   ritual     → obAnswers.ritual: map answer options to 0.0/0.4/0.7/1.0
  //   sensory    → obAnswers.sensory: map answer options to 0.0/0.4/0.7/1.0
  //   style      → obAnswers.style: used for spontaneityBias + isFamily
  pace: 'slow' | 'moderate' | 'fast';
  social: 'solo' | 'duo' | 'group';
  isFamily: boolean;                // Phase 1: social==='group' && pace==='slow' && style includes 'family'
                                    // Phase 2: explicit OB flag
  ritualStrength: number;           // 0–1 mapped from obAnswers.ritual
  sensoryIntensity: number;         // 0–1 mapped from obAnswers.sensory
  spontaneityBias: number;          // 0–1: w_spontaneity * 0.6 + (style==='spontaneous' ? 0.4 : 0)

  // ── Trip context ─────────────────────────────────────────────
  trip: {
    totalDays: number;
    dayNumber: number;
    isFirstDay: boolean;
    isLastDay: boolean;
    isWeekend: boolean;             // derived from travelStartDate + dayNumber
    isLongHaul: boolean;
    startType: 'hotel' | 'airport' | 'other';
    arrivalTime: string | null;
    departureTime: string | null;   // from pendingTripDetails or savedItem.tripDetails
    city: string;
    // countryCode omitted — not in current state, add in Phase 2 if needed
  };

  // ── Context ──────────────────────────────────────────────────
  weather: {
    condition: string;
    tempC: number;
    isOutdoorFriendly: boolean;     // computed: not in BAD_WEATHER_CONDITIONS && tempC > 10
  } | null;

  // ── Viewed/dismissed pins ─────────────────────────────────────
  // viewedEventIds removed: we don't track event views, only saves and explicit dismissals.
  // Phase 1: liveEventOverlap uses savedEventIds + dismissedPinIds only.
  // Phase 2: add view tracking when event detail screen is built.
  dismissedPinIds: Set<string>;     // from new state.dismissedPinIds
  savedEventIds: Set<string>;       // from state.savedEvents mapped to ids
}
```

`computeRecoSignal(state: AppState, dayNumber: number): RecoSignal` — pure function, no side effects.

---

## 6. ItineraryProfile — The Measurement Space

Every dimension is a number in `[0, 1]` or `null`. `null` means data was unavailable — the dimension is skipped entirely, not treated as a gap. This prevents absent data feeds from generating false recos.

```ts
interface ItineraryProfile {
  // ── Categorical presence ──────────────────────────────────────
  hasLunch: number | null;
  hasDinner: number | null;
  hasEveningActivity: number | null;
  hasCulture: number | null;        // museum, gallery, historic
  hasOutdoor: number | null;        // park, viewpoint, beach
  hasRest: number | null;           // semantic scenic_rest role (not just cafe category)
  hasSocialStop: number | null;     // group-friendly venue
  hasHiddenGem: number | null;      // low tourist-index stops

  // ── Behavioral fit ────────────────────────────────────────────
  densityScore: number | null;      // 0=sparse, 1=packed
  walkIntensity: number | null;     // normalized avg walk minutes between stops
  categoryDiversity: number | null; // entropy across semantic roles
  timeBalance: number | null;       // how evenly morning/afternoon/evening are covered
  geoEfficiency: number | null;     // route compactness vs spread

  // ── Context alignment ─────────────────────────────────────────
  weatherAlignment: number | null;  // outdoor stop ratio vs forecast friendliness
  crowdOptimization: number | null; // popular stops timed against peak hours
                                    // Phase 1: use stop.category + hardcoded peak windows
                                    // (museums 10-12, markets 9-11, beaches 11-15)
                                    // Phase 2: real-time crowd data per place_id
  budgetAlignment: number | null;   // cost tier distribution vs w_budget_sensitivity
                                    // Phase 1: use stop.priceLevel (Google Places field, 0-4)
                                    // null if no stops have priceLevel set

  // ── Live / event ──────────────────────────────────────────────
  liveEventOverlap: number | null;  // viewed/dismissed events within trip dates
  // Phase 1: uses savedEvents + dismissedPinIds
  // Phase 2: real-time event feed

  // ── Trend & content (Phase 2 stubs — return null until feed connected) ──
  trendAlignment: number | null;    // itinerary vs trending spots in city
  localVelocity: number | null;     // fast-rising local spots vs tourist circuit
  curatedCoverage: number | null;   // editorial / seasonal picks included

  // ── Route quality (Phase 2) ───────────────────────────────────
  routeScenicity: number | null;    // parks/scenic paths along walking legs
}
```

### 6a. computeTargetProfile(signal) → ItineraryProfile

Maps persona weights + behavioral patterns to expected values for every dimension. This is the "what should a good day look like for this persona" computation.

Key mappings:
- `hasLunch` target: always 0.9 (near-universal)
- `hasDinner` target: `w_food_density * 0.8 + 0.2`
- `hasCulture` target: `w_culture_depth` (direct)
- `hasRest` target: `w_rest_need * 0.7 + pace === 'slow' ? 0.3 : 0`
- `densityScore` target: `pace === 'slow' ? 0.35 : pace === 'fast' ? 0.75 : 0.55`
- `walkIntensity` target: `w_walk_affinity * 0.7`
- `weatherAlignment` target: `isOutdoorFriendly ? w_scenic : 1 - w_scenic` (bad weather → indoor plan is correct)
- `liveEventOverlap` target: `(w_spontaneity * 0.5 + spontaneityBias * 0.5)` when dismissed events exist
- `routeScenicity` target: `isFamily ? 0.7 : w_scenic * 0.6`

**Confidence banding:** Low `archetypeConfidence` widens the target. A dimension with target `0.7` at confidence `1.0` becomes an acceptable range of `[0.55, 0.85]` at confidence `0.5`. Below the band minimum is a gap. Above is excess.

### 6b. computeActualProfile(stops, signal) → ItineraryProfile

Analyzes the real stops. Uses semantic roles (Section 7), not raw categories.

Key computations:
- `hasLunch`: any stop with `semanticRole === 'fuel_stop' | 'scenic_rest'` in 11:30–14:30 window
- `hasRest`: any stop with `semanticRole === 'scenic_rest'` (context-aware, not just category === 'cafe')
- `weatherAlignment`: `outdoorStops.length / totalStops` vs `signal.weather.isOutdoorFriendly`
- `densityScore`: `totalScheduledMinutes / (16 * 60)` — how much of the waking day is booked
- `liveEventOverlap`: any event in `signal.viewedEventIds | dismissedPinIds` whose date falls within trip dates and is not in the current plan
- Phase 2 dimensions: return `null` until data feed is connected

---

## 7. Semantic Roles — Solving Contextual Correlation

A stop's raw category is not enough. A `cafe` at a beach at 14:00 after two outdoor stops means rest and atmosphere. A `cafe` in a busy Hanoi market at 12:00 means fuel and momentum. The same category satisfies different gaps.

```ts
type SemanticRole =
  | 'anchor'         // main attraction, drives the visit (museum, landmark)
  | 'scenic_rest'    // cafe/park used for atmosphere + recovery
  | 'fuel_stop'      // quick food/drink, keeps momentum
  | 'cultural_deep'  // extended cultural engagement (2h+ museum, gallery)
  | 'social_hub'     // primarily for social interaction (rooftop bar, plaza)
  | 'evening_wind'   // bar/restaurant for day closure (after 19:00)
  | 'transit_filler' // fills time between anchors, low engagement
```

`computeStopSemantics(stop, stops, signal): SemanticRole`

Inputs to the role computation:
- `stop.category`
- `stop.time` — time of day
- `stop.durationMin` — short duration → fuel, long → rest or deep
- Adjacent stop categories — beach before/after → scenic_rest
- `signal.weather.isOutdoorFriendly` — bad weather suppresses outdoor scenic roles
- `geoContext` — dense urban vs scenic area (approximated from `stop.area` + nearby stop categories)

**The correlation rule:** Two stops with different categories but the same semantic role in overlapping time windows satisfy the same gap. The engine deduplicates at the role level, not the category level. A beach lunch is `scenic_rest` — it satisfies `hasLunch` AND `hasRest`. No reco fires for either.

---

## 8. Delta Engine

```ts
interface Gap {
  dimension: keyof ItineraryProfile;
  target: number;
  actual: number;
  delta: number;               // target - actual (positive = missing, negative = excess)
  dimensionWeight: number;     // how much this persona cares about this dimension
  significance: number;        // Math.abs(delta) * dimensionWeight
  direction: 'missing' | 'excess';
  conflictPresent: boolean;    // true when actual contradicts persona signal
}

function detectGaps(
  target: ItineraryProfile,
  actual: ItineraryProfile,
  signal: RecoSignal,
  threshold = 0.3,
): Gap[]
```

For each dimension:
1. If either `target[dim]` or `actual[dim]` is `null` → skip
2. Compute `delta = target - actual`
3. `dimensionWeight = getDimensionWeight(dim, signal)` — defined in `dimensions.ts`. Maps each dimension to a composite weight derived from the signal. Examples:
   - `hasLunch` → `signal.weights.w_food_density * 0.7 + 0.3` (food is near-universal so floor at 0.3)
   - `hasCulture` → `signal.weights.w_culture_depth`
   - `hasRest` → `signal.weights.w_rest_need * 0.6 + (signal.pace === 'slow' ? 0.4 : 0)`
   - `densityScore` → `Math.max(signal.weights.w_efficiency, 1 - signal.weights.w_rest_need)`
   - `weatherAlignment` → `signal.weights.w_scenic * 0.5 + 0.5` (context safety, always relevant)
   - `liveEventOverlap` → `signal.spontaneityBias`
   - `crowdOptimization` → `signal.weights.w_crowd_aversion`
   - `budgetAlignment` → `signal.weights.w_budget_sensitivity`
   Full mapping table lives in `dimensions.ts`
4. `significance = Math.abs(delta) * dimensionWeight`
5. If `significance < threshold` → below noise floor, skip

**Conflict detection:** A gap has `conflictPresent: true` when the delta direction contradicts an explicit OB preference signal — not just any gap. Specifically: `actual` moves away from `target` in a dimension that is directly mapped to an OB answer (pace → densityScore, sensory → categoryDiversity, etc.). Example: `densityScore.target = 0.35` (slow OB pace) but `densityScore.actual = 0.85` (user added many stops). User overrode their own stated preference. This is the most valuable reco moment — and the most valuable behavior data point.

### 8a. Conflict handling

When `conflictPresent`:
- Reco is promoted (significance × 1.4 multiplier)
- Card copy acknowledges the tension explicitly: "You've built a packed day — your profile suggests a slower rhythm. Want to swap a stop for breathing room?"
- User response (dismissed / accepted / lingered) is captured as a high-value behavior event
- This is the primary source of archetype calibration data

### 8b. resolveConflicts(gaps) → gaps

When two gaps are in tension with each other (e.g., `thin_day` and `walking_overload` cannot both be true), the lower-significance one is removed. Conflict pairs are defined in `dimensions.ts`.

### 8c. Ranking and max

Gaps are sorted by `significance` descending. Top N surfaced (default: max 3 reco cards per day). In conflict scenarios, max temporarily raised to 4 to allow the tension to be shown alongside the primary reco.

---

## 9. gapToCard(gap, stops, signal) → ReelRecoCard | null

Maps a gap to the card data structure. One branch per dimension. Returns `null` if contextual data needed to build the card is unavailable (e.g., no nearby stop to anchor a lunch reco).

```ts
function gapToCard(gap: Gap, stops: EngineItineraryStop[], signal: RecoSignal): ReelRecoCard | null
```

The card's `label` and `consequence` fields are filled by a single LLM call at the end, after all cards are decided. The call receives: `{ dimension, delta, archetype, city, anchorStop, semanticContext }`. The LLM writes the copy. It is not consulted for any other decision. If the LLM call fails or times out, template strings are used as fallback — cards are never blocked on LLM availability.

**Zero delta case:** If no gaps exceed the threshold, `deriveRecos()` returns an empty array. The reel-builder detects this and injects a `balance` card (a new lightweight card type): "Your day is well-balanced for your style." This is never silent — users who have seen recos in other itineraries need to understand why there are none here.

**Insufficient data case:** If `actual[dim]` returned `null` and the dimension is considered high-value for this persona (target × dimensionWeight > 0.5), show: "We couldn't find [X] data for this area — you might find options by searching the map."

---

## 10. Behavior Capture

Every reco card interaction is captured. This is the system's feedback loop.

```ts
interface RecoInteraction {
  id: string;
  userId: string;
  recoId: string;                  // dimension + anchor stop ID
  dimension: keyof ItineraryProfile;
  archetype: string;
  action: 'viewed'                 // card entered viewport
         | 'tapped'                // user tapped CTA
         | 'dismissed'             // user swiped past in < 1.5s
         | 'lingered'              // user stayed on card > 3s
         | 'added_to_plan';        // added reco to itinerary
  conflictPresent: boolean;
  significance: number;            // the gap's significance score at time of surfacing
  signalSnapshot: {                // key signal values at time of surfacing
    archetype: string;
    pace: string;
    densityScore: number | null;
    dayNumber: number;
    weather: string | null;
  };
  timestamp: string;               // ISO
}
```

**Supabase table:** `reco_interactions`
```sql
id            uuid primary key default gen_random_uuid()
user_id       uuid references auth.users
reco_id       text
dimension     text
archetype     text
action        text
conflict_present boolean
significance  float
signal_snapshot jsonb
created_at    timestamptz default now()
```

**What this data enables over time:**
- Which dimensions generate recos that get acted on vs dismissed, per archetype
- Whether conflict recos are accepted or dismissed → calibrates how aggressively to surface them
- Which archetypes have the most delta in which dimensions → informs target profile tuning
- Dismissed pins that later appear as significant gaps → validates `liveEventOverlap` dimension

---

## 11. Edge Cases — Full Specification

| Case | Handling |
|---|---|
| **Zero delta** | `deriveRecos()` returns `[]`. `reel-builder.ts` detects empty result and injects a `balance` card: "Your day is well-balanced for your style." Never silent. |
| **Insufficient data** | Dimension returns `null`. If high-value for persona, show a "couldn't find X — search the map" redirect card. |
| **Conflict** | `conflictPresent: true`. Significance × 1.4. Card acknowledges tension. Behavior captured as high-value event. |
| **Single stop day** | Sequence-dependent dimensions (densityScore, geoEfficiency, walkIntensity) return `null`. Categorical dimensions still compute. Engine runs on available dimensions only. |
| **Correlation** | Resolved by semantic roles. Same role in same window = same gap. No duplicate recos. |
| **Skip vs unseen** | `dismissedPinIds` (explicit dismiss) treated as strong signal for `liveEventOverlap`. Never-seen pins are not considered. |
| **Low archetype confidence** | Target bands widen. Threshold for surfacing raises from 0.3 to 0.45. Fewer but more confident recos. |
| **Multi-day / per-day** | `computeRecoSignal` called per day with `dayNumber`. Arrival day: suppress dense early-morning stops if `isLongHaul`. Departure day: cap stop count, add time-to-transport check as a dimension. |
| **Time conflict** | Any reco involving a specific time window is checked against existing stop schedule before surfacing. Hard block, not demotion. |
| **Cold start** | Neutral weights (0.5). Conservative recos only (higher threshold). Ideally prevented by OB flow. |
| **Family mode (Phase 1)** | Derived: `social === 'group' && pace === 'slow' && w_walk_affinity > 0.6`. Phase 2: explicit OB flag. |
| **Negative delta (excess)** | Surfaces as a different reco type: "Your day is quite packed for your pace" vs "Your day is missing X". Direction matters for copy. |

---

## 12. Phase Breakdown

### Phase 1 — Core engine + live signals

- Full `RecoSignal` computation
- `computeTargetProfile` for all non-stub dimensions
- `computeActualProfile` for all Phase 1 dimensions
- `computeStopSemantics` (semantic roles)
- Delta engine: `detectGaps` + `resolveConflicts` + `gapToCard`
- Behavior capture: `RecoInteraction` + Supabase sync
- `liveEventOverlap` using existing `savedEvents` + new `dismissedPinIds`
- Zero delta, insufficient data, conflict cards
- LLM copy call for card labels
- Phase 2 dimensions return `null` (graceful skip)

### Phase 2 — Data feed connections

- Trending spots API → `trendAlignment`, `localVelocity`
- Editorial content feed → `curatedCoverage`
- POI-along-route geo query → `routeScenicity`
- Explicit family OB flag → `isFamily` direct
- Real-time event feed → richer `liveEventOverlap`
- Behavior data from Phase 1 → target profile calibration per archetype

Phase 2 requires no engine changes. Only `computeActualProfile` functions per new dimension.

---

## 13. Integration Points

**In `reel-builder.ts`:**
```ts
// Replace buildMealRecos() + buildPersonaRecos() with:
import { deriveRecos } from './reco-engine';

const signal = computeRecoSignal(state, dayNumber);
const recos = await deriveRecos(day.stops, signal);
// recos is ReelRecoCard[]
```

**In `shared/types.ts`:**
- Add `balance` to the `ReelCard` union type:
  ```ts
  | { type: 'balance'; message: string }
  ```

**In `ReelRecoCard.tsx`:**
- Add behavior tracking: `onView`, `onTap`, `onDismiss`, `onLingerTimeout` callbacks
- These call `trackRecoInteraction()` from `behavior.ts`
- "Add to plan" CTA: dispatch `GO_TO: 'map'` with category + geo hint prefilled

**New `ReelBalanceCard.tsx`:**
- Lightweight card rendered when `deriveRecos()` returns `[]`
- Shows "Your day is well-balanced for your style" with persona archetype context
- No CTA needed

**In `store.tsx`:**
- Add `dismissedPinIds: string[]` to `AppState`
- Add `SET_DISMISSED_PIN` action
- Add `recoInteractions: RecoInteraction[]` to `AppState` (in-memory, synced async)
- Add `ADD_RECO_INTERACTION` action

**In `userSync.ts`:**
- Add `syncRecoInteractions(userId, interactions)` — batch upload to Supabase

---

## 14. What We're Not Doing

- No LLM in the decision path — zero calls during gap detection, scoring, or ranking
- No collaborative filtering — "users like you" is not a signal here
- No hardcoded reco rules — if a new scenario requires a new if-statement outside this module, that's a signal the architecture is being misused
- No global reco state — all computation is per-day, per-signal-snapshot
