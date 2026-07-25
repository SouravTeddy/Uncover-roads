# Reco Engine L1/L2 Two-Level System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the reco engine into two levels — L1 (softer thresholds, always fires) and L2 (persona-amplified copy, bolder suggestions) — so every plan gets contextually relevant recos, while L2 cards upgrade to persona-named framing when the user's archetype actively drives the suggestion.

**Architecture:** Three changes to the engine layer: (1) lower `BASE_THRESHOLD` from 0.20 to 0.10 so more gaps surface as L1 recos; (2) tag recos as `l2` when significance ≥ 0.25 AND the dimension aligns with the user's archetype group, and swap in persona-named copy; (3) after building the reco list, suppress any L1 reco whose trigger is already covered by an adjacent L2 reco. A fourth change widens the walkable-detour window for L1 (drop the persona gate) and adds a bolder L2 variant for explorer archetypes. A fifth change fixes the "Rebuild" button always showing on first open by using a session-level flag instead of persisted itinerary state. No visual difference exists between L1 and L2 cards — the distinction is internal only.

**Tech Stack:** TypeScript, Vitest (test runner via `npm test` in `/Users/souravbiswas/Uncover-roads/frontend`)

## Global Constraints

- No visual distinction between L1 and L2 cards — `recoLevel` is internal-only, never rendered
- `recoLevel` is optional on `ReelRecoCard` (`'l1' | 'l2' | undefined`) — cards without it behave as before
- L2 suppresses adjacent L1 of the SAME trigger category only — different triggers never suppress each other
- "Adjacent" means the L1 and L2 recos have `afterStopId`s that are the SAME stop or consecutive stops (stop indices differ by ≤ 1 in time-sorted order)
- L2 copy must be persona-named (reference the archetype group) and make a bolder suggestion than L1
- Floor reco always fires (already implemented) — this plan makes it always L2
- `hasBuiltThisSession` is NOT persisted to localStorage — it resets to `false` on every page load/refresh
- Test command: `npm test` from `/Users/souravbiswas/Uncover-roads/frontend`
- All new constants must be named exports so tests can import them directly

---

## File Map

| File | Change |
|------|--------|
| `src/modules/route/reel/types.ts` | Add optional `recoLevel?: 'l1' \| 'l2'` to `ReelRecoCard` |
| `src/modules/route/reco-engine/engine.ts` | Replace `BASE_THRESHOLD` with `L1_THRESHOLD`/`L2_THRESHOLD`; add L2 tagging + copy in `gapToCard`; add `suppressAdjacentL1`; update floor reco significance |
| `src/modules/route/reel/reel-builder.ts` | Update `buildWalkableDetourObservations`: widen L1 gate, add L2 path with larger distance + bolder copy |
| `src/shared/store.tsx` | Add `hasBuiltThisSession: boolean` (non-persisted) to AppState; set to `true` in `SET_ENGINE_ITINERARY` / `PUSH_ITINERARY_HISTORY` cases |
| `src/modules/map/MapScreen.tsx` | Change `hasExistingItinerary={!!state.engineItinerary}` → `hasExistingItinerary={state.hasBuiltThisSession}` |
| `src/modules/route/reco-engine/engine.test.ts` | New tests for L1 threshold, L2 tagging, suppression pass |
| `src/modules/route/reel/reel-builder.test.ts` | New tests for widened detour gate and L2 detour copy |

---

### Task 1: Add `recoLevel` type field + L1/L2 threshold constants

**Files:**
- Modify: `src/modules/route/reel/types.ts` (line 127 — ReelRecoCard interface)
- Modify: `src/modules/route/reco-engine/engine.ts` (lines 19-21 — constants block)
- Test: `src/modules/route/reco-engine/engine.test.ts`

**Interfaces:**
- Produces: `ReelRecoCard.recoLevel?: 'l1' | 'l2'`; exported constants `L1_THRESHOLD = 0.10`, `L2_THRESHOLD = 0.25`

- [ ] **Step 1: Write the failing test**

In `engine.test.ts`, first add the missing type imports at the top of the file (after the existing imports):

```typescript
import type { ReelRecoCard, RecoTrigger } from '../reel/types';
```

Then add a new `describe` block at the bottom:

```typescript
import { deriveRecos, gapToCard, L1_THRESHOLD, L2_THRESHOLD } from './engine';

describe('L1/L2 threshold constants', () => {
  it('L1_THRESHOLD is 0.10', () => {
    expect(L1_THRESHOLD).toBe(0.10);
  });

  it('L2_THRESHOLD is 0.25', () => {
    expect(L2_THRESHOLD).toBe(0.25);
  });

  it('L2_THRESHOLD is greater than L1_THRESHOLD', () => {
    expect(L2_THRESHOLD).toBeGreaterThan(L1_THRESHOLD);
  });

  it('fires more recos at L1 threshold than old 0.20 threshold would', () => {
    // A gap with significance 0.15 would have been filtered at 0.20 but fires at 0.10
    // Use a weak persona signal — low weights, low spontaneity
    const signal = makeSignal({
      weights: { ...HIGH_FOOD_WEIGHTS, w_food_density: 0.3, w_culture_depth: 0.2 },
      archetypeGroup: 'explorer',
    });
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'museum' }),
      stop({ id: 's2', time: '14:00', category: 'park' }),
    ];
    const recos = deriveRecos(stops, signal);
    // With L1 threshold at 0.10, at least one reco fires even for weak gaps
    expect(recos.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- engine.test.ts
```

Expected: FAIL — `L1_THRESHOLD is not exported from './engine'`

- [ ] **Step 3: Add `recoLevel` to `ReelRecoCard` in `types.ts`**

In `src/modules/route/reel/types.ts`, find the `ReelRecoCard` interface (line ~127) and add the field:

```typescript
export interface ReelRecoCard {
  type: 'reco';
  id: string;
  trigger: RecoTrigger;
  label: string;
  consequence: string;
  nearbyCity: string;
  persona: string;
  afterStopId: string;
  weightScore?: number;
  recoLevel?: 'l1' | 'l2';
  // Coordinates of the anchor stop — used to fetch nearby recommendations
  stopLat?: number;
  stopLon?: number;
  // Photo of the anchor stop — used as background in the reco card top half
  anchorPhotoUrl?: string | null;
}
```

- [ ] **Step 4: Replace threshold constants in `engine.ts`**

In `src/modules/route/reco-engine/engine.ts`, replace the constants block (lines 19-22):

```typescript
// Replace this:
const CONFIDENCE_THRESHOLD_BOOST = 0.15;
const BASE_THRESHOLD = 0.20;
const MAX_RECOS = 3;
const CONFLICT_BOOST = 1.4;

// With this:
const CONFIDENCE_THRESHOLD_BOOST = 0.15;
export const L1_THRESHOLD = 0.10;   // softer gate — more recos surface at L1
export const L2_THRESHOLD = 0.25;   // significance floor for persona-amplified L2 copy
const MAX_RECOS = 3;
const CONFLICT_BOOST = 1.4;
```

- [ ] **Step 5: Update `detectGaps` to use `L1_THRESHOLD`**

In `detectGaps` (line ~33), replace `BASE_THRESHOLD`:

```typescript
// Replace:
const threshold = BASE_THRESHOLD + (signal.archetypeConfidence < 0.5 ? CONFIDENCE_THRESHOLD_BOOST : 0);

// With:
const threshold = L1_THRESHOLD + (signal.archetypeConfidence < 0.5 ? CONFIDENCE_THRESHOLD_BOOST : 0);
```

Also update the floor reco significance (line ~278):

```typescript
// Replace:
significance: BASE_THRESHOLD + 0.01,

// With:
significance: L2_THRESHOLD + 0.01,   // floor is always persona-aligned → always L2
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- engine.test.ts
```

Expected: all tests PASS including the new threshold tests.

- [ ] **Step 7: Commit**

```bash
git add src/modules/route/reel/types.ts src/modules/route/reco-engine/engine.ts src/modules/route/reco-engine/engine.test.ts
git commit -m "feat(reco): add L1/L2 threshold constants and recoLevel field"
```

---

### Task 2: L2 tagging + persona-amplified copy in `gapToCard` + floor reco

**Files:**
- Modify: `src/modules/route/reco-engine/engine.ts` — `gapToCard` function and floor reco block
- Test: `src/modules/route/reco-engine/engine.test.ts`

**Interfaces:**
- Consumes: `L1_THRESHOLD`, `L2_THRESHOLD` from Task 1; `ReelRecoCard.recoLevel` from Task 1
- Produces: `gapToCard` now sets `recoLevel: 'l1' | 'l2'` on returned cards; L2 cards have persona-named `consequence`

- [ ] **Step 1: Write the failing tests**

Add to the `describe('gapToCard — previously missing templates')` block in `engine.test.ts`:

```typescript
describe('gapToCard — L2 tagging and persona-amplified copy', () => {
  function makeGapAtLevel(
    dimension: keyof ItineraryProfile,
    significance: number,
    direction: 'missing' | 'excess' = 'missing',
  ): Gap {
    return {
      dimension, target: 1, actual: 0,
      delta: direction === 'missing' ? 1 : -1,
      dimensionWeight: 0.5,
      significance,
      direction,
      conflictPresent: false,
    };
  }

  it('hasCulture at significance 0.30 with cultural archetype returns recoLevel l2', () => {
    const signal: RecoSignal = {
      ...BASE_SIGNAL,
      archetypeGroup: 'cultural',
    };
    const card = gapToCard(makeGapAtLevel('hasCulture', 0.30), BASE_STOPS, signal);
    expect(card).not.toBeNull();
    expect(card?.recoLevel).toBe('l2');
  });

  it('hasCulture at significance 0.15 with cultural archetype returns recoLevel l1', () => {
    const signal: RecoSignal = {
      ...BASE_SIGNAL,
      archetypeGroup: 'cultural',
    };
    const card = gapToCard(makeGapAtLevel('hasCulture', 0.15), BASE_STOPS, signal);
    expect(card).not.toBeNull();
    expect(card?.recoLevel).toBe('l1');
  });

  it('hasCulture at significance 0.30 with sensory archetype returns recoLevel l1 (wrong archetype)', () => {
    const signal: RecoSignal = {
      ...BASE_SIGNAL,
      archetypeGroup: 'sensory',
    };
    const card = gapToCard(makeGapAtLevel('hasCulture', 0.30), BASE_STOPS, signal);
    expect(card).not.toBeNull();
    expect(card?.recoLevel).toBe('l1');
  });

  it('hasRest at significance 0.30 with sensory archetype returns recoLevel l2', () => {
    const signal: RecoSignal = {
      ...BASE_SIGNAL,
      archetypeGroup: 'sensory',
    };
    const card = gapToCard(makeGapAtLevel('hasRest', 0.30), BASE_STOPS, signal);
    expect(card).not.toBeNull();
    expect(card?.recoLevel).toBe('l2');
  });

  it('L2 hasCulture consequence contains archetype reference', () => {
    const signal: RecoSignal = {
      ...BASE_SIGNAL,
      archetypeGroup: 'cultural',
    };
    const card = gapToCard(makeGapAtLevel('hasCulture', 0.30), BASE_STOPS, signal);
    // L2 copy must reference persona/archetype ("historian" or "cultural" or "scholar" etc.)
    expect(card?.consequence.toLowerCase()).toMatch(/historian|scholar|cultural|your kind|your taste/);
  });

  it('L2 hasRest consequence contains persona reference', () => {
    const signal: RecoSignal = {
      ...BASE_SIGNAL,
      archetypeGroup: 'sensory',
    };
    const card = gapToCard(makeGapAtLevel('hasRest', 0.30), BASE_STOPS, signal);
    expect(card?.consequence.toLowerCase()).toMatch(/pace|ritual|intentional|slow|sit|settle/);
  });

  it('floor reco is always tagged l2', () => {
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'restaurant' }),
      stop({ id: 's2', time: '14:00', category: 'park' }),
    ];
    const signal = makeSignal({ archetypeGroup: 'cultural' });
    const recos = deriveRecos(stops, signal);
    const floorReco = recos.find(r => r.trigger === 'culture');
    expect(floorReco).toBeDefined();
    expect(floorReco?.recoLevel).toBe('l2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- engine.test.ts
```

Expected: multiple FAIL — `recoLevel` is not set, L2 copy not implemented.

- [ ] **Step 3: Add `L2_ALIGNED` map and L2 copy to `gapToCard` in `engine.ts`**

After the `OB_MAPPED` constant (around line 24), add:

```typescript
// Which profile dimensions align with each archetype group for L2 tagging
const L2_ALIGNED: Partial<Record<'cultural' | 'sensory' | 'social' | 'explorer', Array<keyof ItineraryProfile>>> = {
  cultural: ['hasCulture', 'hasHiddenGem'],
  sensory:  ['hasRest', 'hasLunch', 'hasDinner'],
  social:   ['hasSocialStop'],
  explorer: ['hasHiddenGem', 'walkIntensity'],
};
```

Inside `gapToCard`, add L2 consequence overrides. Add this block just BEFORE the `const tmpl = templates[gap.dimension];` line:

```typescript
  // Determine reco level: L2 if significance exceeds L2 threshold AND dimension aligns with archetype
  const l2Dimensions = L2_ALIGNED[signal.archetypeGroup as keyof typeof L2_ALIGNED] ?? [];
  const isL2 = gap.significance >= L2_THRESHOLD && l2Dimensions.includes(gap.dimension);
  const recoLevel: 'l1' | 'l2' = isL2 ? 'l2' : 'l1';

  // Persona-amplified copy for L2 recos — bolder, persona-named
  const l2Consequence: Partial<Record<keyof ItineraryProfile, string>> = {
    hasCulture: `A day without culture is something a historian notices. There's a spot near ${area} that earns your time — not on the tourist circuit.`,
    hasHiddenGem: signal.archetypeGroup === 'explorer'
      ? `You don't need the guidebook version of ${area}. There's a place nearby that most people never find — it's yours if you look.`
      : `A neighbourhood find near ${area} worth seeking out — the kind that rewards the curious.`,
    hasRest: `Your pace is intentional — protect it. Find a quiet spot near ${area} to sit and let the day settle.`,
    hasLunch: `You're built for proper meals, not grab-and-go. This midday window near ${area} deserves a real sit-down.`,
    hasDinner: `End the day the right way. There's good food near ${area} that fits your kind of evening.`,
    hasSocialStop: `You're at your best in a crowd. Find somewhere near ${area} worth showing up to — locals know it, tourists don't.`,
    walkIntensity: `You're built for longer stretches. This day has room — push the distance a bit near ${area}.`,
  };
```

Then, inside the `return { ... }` statement at the end of `gapToCard`, use the level-appropriate consequence and add `recoLevel`:

```typescript
  // Replace the final return in gapToCard:
  const consequence = (isL2 && l2Consequence[gap.dimension]) ? l2Consequence[gap.dimension]! : tmpl.consequence;

  return {
    type: 'reco',
    id: `${gap.dimension}-${afterStopId}${gap.conflictPresent ? '-conflict' : ''}`,
    trigger: tmpl.trigger as ReelRecoCard['trigger'],
    label: gap.conflictPresent ? `⚡ ${tmpl.label}` : tmpl.label,
    consequence,
    nearbyCity: city,
    persona,
    afterStopId,
    weightScore: gap.significance,
    recoLevel,
    stopLat: anchor?.lat,
    stopLon: anchor?.lon,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- engine.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/route/reco-engine/engine.ts src/modules/route/reco-engine/engine.test.ts
git commit -m "feat(reco): L2 tagging and persona-amplified copy in gapToCard"
```

---

### Task 3: Adjacency suppression — L1 dropped when adjacent L2 covers the same trigger

**Files:**
- Modify: `src/modules/route/reco-engine/engine.ts` — add `suppressAdjacentL1` + call it in `deriveRecos`
- Test: `src/modules/route/reco-engine/engine.test.ts`

**Interfaces:**
- Consumes: `ReelRecoCard.recoLevel` from Task 1; `ReelRecoCard.afterStopId`
- Produces: `deriveRecos` no longer returns both L1 and L2 of the same trigger when their afterStopId positions are ≤ 1 stop apart

- [ ] **Step 1: Write the failing tests**

Add to `engine.test.ts`:

```typescript
describe('suppressAdjacentL1', () => {
  function makeReco(trigger: RecoTrigger, afterStopId: string, recoLevel: 'l1' | 'l2'): ReelRecoCard {
    return {
      type: 'reco', id: `${trigger}-${afterStopId}-${recoLevel}`,
      trigger, label: 'test', consequence: 'test', nearbyCity: 'Paris',
      persona: 'explorer', afterStopId, weightScore: 0.3, recoLevel,
    };
  }

  function makeStop(id: string, time: string): EngineItineraryStop {
    return { id, placeId: id, title: `Place ${id}`, area: 'Centre', day: 1, time, durationMin: 60, category: 'museum', lat: 0, lon: 0, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null };
  }

  const stops3 = [
    makeStop('s1', '09:00'),
    makeStop('s2', '12:00'),
    makeStop('s3', '15:00'),
  ];

  it('suppresses L1 when L1 and L2 of same trigger have same afterStopId', () => {
    // Both recos go after s1 — they'd be back-to-back
    const recos = [
      makeReco('culture', 's1', 'l1'),
      makeReco('culture', 's1', 'l2'),
    ];
    const result = suppressAdjacentL1(recos, stops3);
    expect(result).toHaveLength(1);
    expect(result[0].recoLevel).toBe('l2');
  });

  it('suppresses L1 when L1 after s1 and L2 after s2 (consecutive stops)', () => {
    const recos = [
      makeReco('rest', 's1', 'l1'),
      makeReco('rest', 's2', 'l2'),
    ];
    const result = suppressAdjacentL1(recos, stops3);
    expect(result).toHaveLength(1);
    expect(result[0].recoLevel).toBe('l2');
  });

  it('keeps both when L1 after s1 and L2 after s3 (gap of 2 stops)', () => {
    const recos = [
      makeReco('lunch', 's1', 'l1'),
      makeReco('lunch', 's3', 'l2'),
    ];
    const result = suppressAdjacentL1(recos, stops3);
    expect(result).toHaveLength(2);
  });

  it('never suppresses L1 of a different trigger even if adjacent', () => {
    const recos = [
      makeReco('rest', 's1', 'l1'),
      makeReco('culture', 's1', 'l2'),
    ];
    const result = suppressAdjacentL1(recos, stops3);
    expect(result).toHaveLength(2);
  });

  it('never suppresses L2', () => {
    const recos = [
      makeReco('culture', 's1', 'l1'),
      makeReco('culture', 's1', 'l2'),
    ];
    const result = suppressAdjacentL1(recos, stops3);
    expect(result.every(r => r.recoLevel !== 'l1')).toBe(true);
  });
});
```

Also update the import at the top of `engine.test.ts` to include `suppressAdjacentL1`:

```typescript
import { deriveRecos, gapToCard, suppressAdjacentL1, L1_THRESHOLD, L2_THRESHOLD } from './engine';
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- engine.test.ts
```

Expected: FAIL — `suppressAdjacentL1` is not exported.

- [ ] **Step 3: Implement `suppressAdjacentL1` in `engine.ts`**

Add this function before `deriveRecos` in `engine.ts`. It requires importing `timeToMin` — but that function is in `profile.ts`. Instead, inline the conversion:

```typescript
function minutesFromTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

export function suppressAdjacentL1(
  recos: ReelRecoCard[],
  stops: EngineItineraryStop[],
): ReelRecoCard[] {
  if (recos.length < 2 || stops.length === 0) return recos;

  // Build stop index map (time-sorted)
  const sorted = [...stops].sort((a, b) => minutesFromTime(a.time) - minutesFromTime(b.time));
  const stopIdx = new Map<string, number>();
  sorted.forEach((s, i) => stopIdx.set(s.id, i));

  const toRemove = new Set<string>();

  // Group recos by trigger
  const byTrigger = new Map<string, ReelRecoCard[]>();
  for (const r of recos) {
    if (!byTrigger.has(r.trigger)) byTrigger.set(r.trigger, []);
    byTrigger.get(r.trigger)!.push(r);
  }

  for (const [, cards] of byTrigger) {
    if (cards.length < 2) continue;
    const l1Cards = cards.filter(c => c.recoLevel === 'l1');
    const l2Cards = cards.filter(c => c.recoLevel === 'l2');
    if (l1Cards.length === 0 || l2Cards.length === 0) continue;

    for (const l1 of l1Cards) {
      const l1Idx = stopIdx.get(l1.afterStopId) ?? -1;
      for (const l2 of l2Cards) {
        const l2Idx = stopIdx.get(l2.afterStopId) ?? -1;
        if (Math.abs(l1Idx - l2Idx) <= 1) {
          toRemove.add(l1.id);
          break;
        }
      }
    }
  }

  return recos.filter(r => !toRemove.has(r.id));
}
```

Then at the end of `deriveRecos`, call it before returning:

```typescript
  // Replace:
  return result;

  // With:
  return suppressAdjacentL1(result, stops);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- engine.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/route/reco-engine/engine.ts src/modules/route/reco-engine/engine.test.ts
git commit -m "feat(reco): suppress L1 reco when adjacent L2 covers same trigger"
```

---

### Task 4: Walkable detour L1/L2 — widen gate + add explorer L2 variant

**Files:**
- Modify: `src/modules/route/reel/reel-builder.ts` — `buildWalkableDetourObservations` function (lines 384–428)
- Test: `src/modules/route/reel/reel-builder.test.ts` (create if it doesn't exist)

**Interfaces:**
- Consumes: `EngineWeights.w_walk_affinity`; new optional `persona?: string` param
- Produces: detour observations fire for `w_walk_affinity < 0.80` (was `< 0.55`); explorer personas with `w_walk_affinity < 0.35` get maxKm up to `min(walkBaseKm * 2, 4.0)` and bolder copy

- [ ] **Step 1: Check if reel-builder.test.ts exists**

```bash
ls /Users/souravbiswas/Uncover-roads/frontend/src/modules/route/reel/reel-builder.test.ts 2>/dev/null || echo "NOT FOUND"
```

- [ ] **Step 2: Write failing tests**

If `reel-builder.test.ts` does not exist, create it. If it exists, add the new tests at the bottom. The file should contain:

```typescript
import { describe, it, expect } from 'vitest';
import { buildWalkableDetourObservations } from './reel-builder';
import type { EngineWeights } from '../../../shared/types';

const BASE_WEIGHTS: EngineWeights = {
  w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5,
  w_food_density: 0.5, w_culture_depth: 0.5, w_nightlife: 0.3,
  w_budget_sensitivity: 0.5, w_crowd_aversion: 0.4, w_spontaneity: 0.5, w_rest_need: 0.5,
};

function makeStop(id: string, lat: number, lon: number) {
  return {
    id, placeId: id, title: `Stop ${id}`, area: 'Centre', day: 1,
    time: '10:00', durationMin: 60, category: 'museum' as const,
    lat, lon, priceLevel: null, rating: null, weekdayText: null,
    whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null,
  };
}

// Two stops ~0.8 km apart (Paris centre to nearby)
const STOP_A = makeStop('a', 48.8566, 2.3522);
const STOP_B = makeStop('b', 48.8566, 2.3630);  // ~0.75 km east

describe('buildWalkableDetourObservations — L1/L2 thresholds', () => {
  it('fires for w_walk_affinity 0.70 (L1 gate raised to 0.80)', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.70 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0);
    expect(obs.length).toBeGreaterThan(0);
  });

  it('does NOT fire for w_walk_affinity 0.85 (above L1 gate)', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.85 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0);
    expect(obs.length).toBe(0);
  });

  it('old gate 0.55 — still fires at 0.50 (backward compat)', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.50 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0);
    expect(obs.length).toBeGreaterThan(0);
  });

  it('L2 explorer path: fires for stops > 2km when persona is explorer and walk_affinity < 0.35', () => {
    // Two stops ~3km apart
    const FAR_A = makeStop('fa', 48.8566, 2.3522);
    const FAR_B = makeStop('fb', 48.8566, 2.3926);  // ~3.0 km east
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.30 };
    const obs = buildWalkableDetourObservations([FAR_A, FAR_B], 'Paris', weights, 2.0, 'wanderer');
    expect(obs.length).toBeGreaterThan(0);
  });

  it('L2 explorer copy is bolder than L1', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.25 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0, 'wanderer');
    expect(obs[0]?.consequence.toLowerCase()).toMatch(/wander|detour|remember|yours/);
  });

  it('non-explorer persona does NOT get extended L2 range', () => {
    const FAR_A = makeStop('fa', 48.8566, 2.3522);
    const FAR_B = makeStop('fb', 48.8566, 2.3926);  // ~3.0 km — beyond L1 maxKm of 2.0
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.30 };
    const obs = buildWalkableDetourObservations([FAR_A, FAR_B], 'Paris', weights, 2.0, 'epicurean');
    expect(obs.length).toBe(0);  // 3km > 2km walkBaseKm, no L2 extension for epicurean
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- reel-builder.test.ts
```

Expected: FAIL — `buildWalkableDetourObservations` is not exported, or wrong gate values.

- [ ] **Step 4: Update `buildWalkableDetourObservations` in `reel-builder.ts`**

The function signature currently starts at line 384. Export it (add `export`) and add the `persona` param + L2 logic:

```typescript
export function buildWalkableDetourObservations(
  stops: EngineItineraryStop[],
  city: string,
  weights: EngineWeights,
  walkBaseKm = 2.0,
  persona?: string,
): DayIntelObservation[] {
  // L1 gate: raised from 0.55 to 0.80 so more personas get detour suggestions
  if (weights.w_walk_affinity >= 0.80) return [];

  const archetypeLower = (persona ?? '').toLowerCase().replace(/\s+/g, '');
  const EXPLORER_ARCHETYPES = new Set(['wanderer', 'voyager', 'explorer', 'flaneur', 'drifter']);
  const isExplorerL2 = EXPLORER_ARCHETYPES.has(archetypeLower) && weights.w_walk_affinity < 0.35;

  const minKm = 0.3;
  // L2 explorer path: extend range up to 2× walkBaseKm (max 4km) for bolder suggestions
  const maxKm = isExplorerL2 ? Math.min(walkBaseKm * 2, 4.0) : walkBaseKm;

  const obs: DayIntelObservation[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const distKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (distKm < minKm || distKm > maxKm) continue;

    const walkMins = Math.max(1, Math.round((distKm / 5) * 60));
    const distLabel = distKm < 1
      ? `${Math.round(distKm * 1000)} m`
      : `${distKm.toFixed(1)} km`;

    const consequence = isExplorerL2
      ? `~${walkMins} min walk between stops — the kind of detour you'll remember. Take it.`
      : "Worth the legs if you have time — you'll see more than from a ride.";

    obs.push({
      id: `walkable-detour-${a.id}-${b.id}`,
      trigger: 'walkable_detour',
      what: `${distLabel} walkable stretch`,
      why: `${a.title} to ${b.title} is short enough to walk — ~${walkMins} min on foot.`,
      consequence,
      ctaLabel: triggerCTA('walkable_detour', city),
      stopLat: a.lat,
      stopLon: a.lon,
      searchCategory: TRIGGER_SEARCH.walkable_detour,
      anchorCity: city,
    });

    if (obs.length >= 1) break;
  }

  return obs;
}
```

Update the call site at line 883 to pass `persona`:

```typescript
// Replace:
const detourObsList = buildWalkableDetourObservations(sortedStops, day.city, weights, day.walkBaseKm ?? 2.0);

// With:
const detourObsList = buildWalkableDetourObservations(sortedStops, day.city, weights, day.walkBaseKm ?? 2.0, persona);
```

(`persona` is already a parameter of `buildReelCards` — available in scope at line 883.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test -- reel-builder.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/route/reel/reel-builder.ts src/modules/route/reel/reel-builder.test.ts
git commit -m "feat(reco): widen walkable detour L1 gate; add L2 explorer path with extended range"
```

---

### Task 5: Fix "Rebuild" button always showing — session-level `hasBuiltThisSession` flag

**Files:**
- Modify: `src/shared/store.tsx` — add `hasBuiltThisSession` to AppState + reducer
- Modify: `src/modules/map/MapScreen.tsx` — line ~1110, change `hasExistingItinerary` prop
- Test: manual verification (no unit test needed — this is UI state wiring)

**Interfaces:**
- Consumes: `SET_ENGINE_ITINERARY` and `PUSH_ITINERARY_HISTORY` action types (already in store)
- Produces: `state.hasBuiltThisSession: boolean` — `false` on load, `true` after first build

- [ ] **Step 1: Add `hasBuiltThisSession` to AppState in `store.tsx`**

Find the `AppState` interface (around line 106) and add the field after `engineItinerary`:

```typescript
  engineItinerary: EngineItinerary | null  // current engine-built itinerary
  hasBuiltThisSession: boolean             // true after first build; resets on page load (not persisted)
```

- [ ] **Step 2: Initialize `hasBuiltThisSession` in the initial state**

Find the initial state object (around line 337 where `engineItinerary` is initialized):

```typescript
// Add alongside:
engineItinerary: ssGet<EngineItinerary>('ur_ss_engine_itin') ?? null,
hasBuiltThisSession: false,   // NOT loaded from localStorage — always false on fresh load
```

- [ ] **Step 3: Set `hasBuiltThisSession: true` in the reducer**

Find the `SET_ENGINE_ITINERARY` case (line ~825):

```typescript
case 'SET_ENGINE_ITINERARY':
  ssSave('ur_ss_engine_itin', action.itinerary)
  return { ...state, engineItinerary: action.itinerary, hasBuiltThisSession: true }

case 'PUSH_ITINERARY_HISTORY': {
  const history = [action.itinerary, ...state.itineraryHistory].slice(0, 10)
  ssSave('ur_ss_engine_itin', action.itinerary)
  ssSave('ur_ss_itin_history', history)
  return { ...state, engineItinerary: action.itinerary, itineraryHistory: history, hasBuiltThisSession: true }
}
```

- [ ] **Step 4: Update `MapScreen.tsx`**

Find the `BottomActionTray` usage (around line 1106–1110):

```typescript
// Replace:
hasExistingItinerary={!!state.engineItinerary}

// With:
hasExistingItinerary={state.hasBuiltThisSession}
```

- [ ] **Step 5: Update `SubscriptionScreen.test.tsx` mock**

`SubscriptionScreen.test.tsx` builds a full `AppState` object explicitly (not via `...initialState` spread). Adding `hasBuiltThisSession: boolean` as a required field means this mock will fail TypeScript compilation unless updated.

In `src/modules/subscription/SubscriptionScreen.test.tsx`, find the `makeState` function (around line 8) and add the field after `engineItinerary: null`:

```typescript
engineItinerary: null,
hasBuiltThisSession: false,
```

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npm test
```

Expected: all tests PASS. (TypeScript will catch any remaining AppState mock mismatches at build time.)

- [ ] **Step 7: Commit**

```bash
git add src/shared/store.tsx src/modules/map/MapScreen.tsx src/modules/subscription/SubscriptionScreen.test.tsx
git commit -m "fix(ui): show 'Build itinerary' on fresh session load, 'Rebuild' only after first build"
```

---

## Self-Review

### Spec Coverage
| Requirement | Task |
|---|---|
| L1 lower threshold (0.10) | Task 1 |
| L2 tag when significance ≥ 0.25 AND archetype-aligned | Task 2 |
| L2 persona-named copy for hasCulture, hasRest, hasLunch, hasDinner, hasSocialStop, hasHiddenGem, walkIntensity | Task 2 |
| Floor reco always L2 | Task 1 (significance = L2_THRESHOLD + 0.01) + Task 2 (l2 tag auto-set) |
| Adjacent L1 suppressed when L2 present for same trigger | Task 3 |
| Both survive when separated by > 1 stop | Task 3 |
| No visual difference — `recoLevel` is internal only | Global constraint — enforced by field being optional and never rendered |
| Walkable detour L1 gate raised (0.55 → 0.80) | Task 4 |
| Explorer L2 detour: extended range (up to 4km), bolder copy | Task 4 |
| "Build" button shows on fresh session (not "Rebuild") | Task 5 |

### Type Consistency
- `L1_THRESHOLD`, `L2_THRESHOLD` exported from `engine.ts` — imported in `engine.test.ts` ✓
- `suppressAdjacentL1` exported from `engine.ts` — imported in `engine.test.ts` ✓
- `buildWalkableDetourObservations` exported from `reel-builder.ts` — imported in `reel-builder.test.ts` ✓
- `recoLevel` added to `ReelRecoCard` as optional — backward compatible, no existing callsites break ✓
- `hasBuiltThisSession` added to `AppState` — TypeScript will enforce in `MapScreen.tsx` ✓
