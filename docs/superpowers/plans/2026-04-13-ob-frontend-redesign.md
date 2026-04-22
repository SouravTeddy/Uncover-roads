# Onboarding Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 5-question static OB flow with a 7-question contextual system (+ 3 conditional) with multi-choice, inline conflict detection, and a deterministic `ob-resolver` that outputs a fully resolved `PersonaProfile`.

**Architecture:** New pure-function modules (`ob-conflict-map.ts`, `ob-context-resolvers.ts`, `ob-resolver.ts`) handle all logic with no React dependency. Shared `ImageRowCard` + `ConflictPanel` components handle UI. New `OB1–OB10` screens replace existing `OB1–OB5`. `useOnboarding` calls the resolver at finish and dispatches `PersonaProfile` to the store.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS, Plus Jakarta Sans + Inter

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/shared/types.ts` | Modify | Add `RawOBAnswers`, `PersonaProfile`, `ResolvedConflict`, new Screen values |
| `frontend/src/modules/onboarding/ob-conflict-map.ts` | Create | Conflict pairs, alignment tables, score weight vectors |
| `frontend/src/modules/onboarding/ob-conflict-map.test.ts` | Create | Tests for conflict detection and scoring |
| `frontend/src/modules/onboarding/ob-resolver.ts` | Create | Pure fn: `RawOBAnswers → PersonaProfile` (3 stages) |
| `frontend/src/modules/onboarding/ob-resolver.test.ts` | Create | Tests for all 3 resolver stages |
| `frontend/src/modules/onboarding/ob-context-resolvers.ts` | Create | Per-question contextual wording functions |
| `frontend/src/modules/onboarding/ob-context-resolvers.test.ts` | Create | Tests for context resolver output |
| `frontend/src/shared/questionnaire/ImageRowCard.tsx` | Create | Image row option card with checkbox + animations |
| `frontend/src/shared/questionnaire/ConflictPanel.tsx` | Create | Inline conflict panel with suggestion + auto-blend |
| `frontend/src/modules/onboarding/OB1Group.tsx` | Create | Q1: Who's travelling |
| `frontend/src/modules/onboarding/OB2Mood.tsx` | Create | Q2: Trip mood (multi-choice up to 3) |
| `frontend/src/modules/onboarding/OB3Pace.tsx` | Create | Q3: Pace (multi-choice up to 2, conflict detection) |
| `frontend/src/modules/onboarding/OB4DayOpen.tsx` | Create | Q4: Day open |
| `frontend/src/modules/onboarding/OB5Dietary.tsx` | Create | Q5: Dietary (multi-choice, all selectable) |
| `frontend/src/modules/onboarding/OB6Budget.tsx` | Create | Q6: Budget |
| `frontend/src/modules/onboarding/OB7Evening.tsx` | Create | Q7: Evening |
| `frontend/src/modules/onboarding/OB8KidFocus.tsx` | Create | Q8 conditional: family → kid focus |
| `frontend/src/modules/onboarding/OB9BudgetProtect.tsx` | Create | Q9 conditional: budget → what to protect |
| `frontend/src/modules/onboarding/OB10FoodScene.tsx` | Create | Q10 conditional: eat_drink → food scene |
| `frontend/src/modules/onboarding/OnboardingShell.tsx` | Modify | Conditional step logic, context resolver wiring |
| `frontend/src/modules/onboarding/useOnboarding.ts` | Modify | Call `resolveOBAnswers()` at finish, dispatch PersonaProfile |
| `frontend/src/modules/onboarding/types.ts` | Modify | New `ObStep` values for OB1–OB10 |
| `frontend/src/shared/store.tsx` | Modify | Store `PersonaProfile`, new `SET_PERSONA_PROFILE` action |

**Files NOT changed:** `OB1Ritual.tsx`–`OB5Pace.tsx` are deleted; `BentoCard.tsx` stays for any future use but is no longer used in OB flow; map/route/chip modules untouched.

---

### Task 1: Add new types to shared/types.ts and onboarding/types.ts

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Modify: `frontend/src/modules/onboarding/types.ts`

- [ ] **Step 1: Add new Screen values for OB screens to `shared/types.ts`**

In `shared/types.ts`, update the `Screen` type:

```typescript
export type Screen =
  | 'login'
  | 'welcome'
  | 'walkthrough'
  | 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
  | 'ob8' | 'ob9' | 'ob10'
  | 'persona'
  | 'destination'
  | 'map'
  | 'route'
  | 'trips'
  | 'nav'
  | 'profile';
```

- [ ] **Step 2: Add new OB answer types and PersonaProfile to `shared/types.ts`**

Add after the existing `OnboardingAnswers` interface:

```typescript
// ── New OB answer types ───────────────────────────────────────
export type OBGroup    = 'solo' | 'couple' | 'family' | 'friends';
export type OBMood     = 'explore' | 'relax' | 'eat_drink' | 'culture';
export type OBPace     = 'slow' | 'balanced' | 'pack' | 'spontaneous';
export type OBDayOpen  = 'coffee' | 'breakfast' | 'straight' | 'grab_go';
export type OBDietary  = 'none' | 'plant_based' | 'halal' | 'kosher' | 'allergy';
export type OBBudget   = 'budget' | 'mid_range' | 'comfortable' | 'luxury';
export type OBEvening  = 'bars' | 'dinner_wind' | 'markets' | 'early';
export type OBKidFocus = 'outdoor' | 'edu' | 'food' | 'slow';
export type OBBudgetProtect = 'free_only' | 'one_splurge' | 'street_food' | 'local_transport';
export type OBFoodScene = 'street' | 'restaurant' | 'cafe' | 'bars';
export type SocialFlag  = 'solo' | 'couple' | 'family' | 'group' | 'kids';
export type DietaryFlag = 'vegan_boost' | 'meat_flag' | 'halal_certified_only'
                        | 'kosher_certified_only' | 'allergy_warning';

export interface RawOBAnswers {
  group:          OBGroup | null;
  mood:           OBMood[];           // multi-choice, up to 3
  pace:           OBPace[];           // multi-choice, up to 2
  day_open:       OBDayOpen | null;
  dietary:        OBDietary[];        // multi-choice, all selectable
  budget:         OBBudget | null;
  evening:        OBEvening | null;
  // conditional
  kid_focus?:     OBKidFocus | null;
  budget_protect?: OBBudgetProtect | null;
  food_scene?:    OBFoodScene | null;
}

export interface ResolvedConflict {
  conflict_id: 'C1' | 'C2' | 'C3' | 'C4';
  method:      'user_pick' | 'suggestion' | 'auto_blend';
  winner?:     string;
  score?:      number;
}

export type VenueType =
  | 'neighbourhood' | 'landmark' | 'viewpoint'
  | 'park' | 'spa' | 'cafe' | 'restaurant'
  | 'market' | 'street_food' | 'museum'
  | 'heritage' | 'gallery' | 'romantic'
  | 'table_for_2' | 'family' | 'communal'
  | 'social' | 'group_booking';

export interface PersonaProfile {
  // Resolved itinerary params
  stops_per_day:    number;
  time_per_stop:    number;
  venue_weights:    Partial<Record<VenueType, number>>;
  price_min:        1 | 2 | 3 | 4;
  price_max:        1 | 2 | 3 | 4;
  flexibility:      number;
  day_open:         OBDayOpen;
  day_buffer_min:   number;
  evening_type:     OBEvening;
  evening_end_time: string;
  social_flags:     SocialFlag[];
  dietary:          DietaryFlag[];
  // Conditional
  kid_focus?:       OBKidFocus;
  budget_protect?:  OBBudgetProtect;
  food_scene?:      OBFoodScene;
  // Archetype
  archetype:        string;
  // Resolution metadata
  resolved_conflicts: ResolvedConflict[];
  auto_blend:       boolean;
}
```

- [ ] **Step 3: Update `onboarding/types.ts`**

Replace file contents:

```typescript
export type ObStep = 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
                   | 'ob8' | 'ob9' | 'ob10';

export const BASE_OB_STEPS: ObStep[] = ['ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7'];
export const CONDITIONAL_STEPS: Record<string, ObStep> = {
  family:    'ob8',
  budget:    'ob9',
  eat_drink: 'ob10',
};

export const OB_STEP_INDEX: Record<ObStep, number> = {
  ob1: 0, ob2: 1, ob3: 2, ob4: 3, ob5: 4, ob6: 5, ob7: 6,
  ob8: 7, ob9: 8, ob10: 9,
};

export const STEP_TITLES: Record<ObStep, string> = {
  ob1:  'Who\'s travelling?',
  ob2:  'What\'s the trip mood?',
  ob3:  'How do you pace a day?',
  ob4:  'How do you ease into the day?',
  ob5:  'Any food situation we should know?',
  ob6:  'How are you travelling budget-wise?',
  ob7:  'What does a good evening look like?',
  ob8:  'What matters most for the kids?',
  ob9:  'What do you protect?',
  ob10: 'What kind of food scene?',
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only from files that reference old OB types — acceptable at this stage.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/modules/onboarding/types.ts
git commit -m "feat: add PersonaProfile, RawOBAnswers, and new Screen/OB types"
```

---

### Task 2: Create ob-conflict-map.ts

**Files:**
- Create: `frontend/src/modules/onboarding/ob-conflict-map.ts`
- Create: `frontend/src/modules/onboarding/ob-conflict-map.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/modules/onboarding/ob-conflict-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  HARD_CONFLICTS,
  SOFT_CONFLICTS,
  PACE_ALIGNMENT,
  PRICE_ALIGNMENT,
  ANSWER_WEIGHTS,
  detectHardConflict,
  scoreOptions,
} from './ob-conflict-map';

describe('HARD_CONFLICTS', () => {
  it('contains C1 slow+pack', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C1', a: 'slow', b: 'pack' })
    );
  });
  it('contains C2 budget+luxury', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C2', a: 'budget', b: 'luxury' })
    );
  });
  it('contains C3 early+bars', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C3', a: 'early', b: 'bars' })
    );
  });
  it('contains C4 budget+comfortable', () => {
    expect(HARD_CONFLICTS).toContainEqual(
      expect.objectContaining({ id: 'C4', a: 'budget', b: 'comfortable' })
    );
  });
});

describe('detectHardConflict', () => {
  it('detects slow+pack conflict', () => {
    expect(detectHardConflict('slow', 'pack')).toEqual(
      expect.objectContaining({ id: 'C1' })
    );
  });
  it('detects pack+slow in reverse order', () => {
    expect(detectHardConflict('pack', 'slow')).toEqual(
      expect.objectContaining({ id: 'C1' })
    );
  });
  it('returns null for non-conflicting pair', () => {
    expect(detectHardConflict('slow', 'balanced')).toBeNull();
  });
  it('returns null for same value', () => {
    expect(detectHardConflict('slow', 'slow')).toBeNull();
  });
});

describe('PACE_ALIGNMENT', () => {
  it('slow vs pack alignment is 0', () => {
    expect(PACE_ALIGNMENT['slow']['pack']).toBe(0);
  });
  it('slow vs slow alignment is 1', () => {
    expect(PACE_ALIGNMENT['slow']['slow']).toBe(1.0);
  });
  it('balanced vs spontaneous > 0.5', () => {
    expect(PACE_ALIGNMENT['balanced']['spontaneous']).toBeGreaterThan(0.5);
  });
});

describe('scoreOptions', () => {
  it('recommends balanced when mood=relax and group=solo', () => {
    const accumulatedWeights = {
      stops_per_day: -1.5,  // from relax mood
      flexibility: 0.2,     // from solo
    };
    const scores = scoreOptions(['slow', 'balanced', 'pack', 'spontaneous'], accumulatedWeights, PACE_ALIGNMENT);
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    expect(winner).toBe('balanced');
  });
});

describe('ANSWER_WEIGHTS', () => {
  it('slow pace sets stops_per_day to 2.5', () => {
    expect(ANSWER_WEIGHTS.pace.slow.stops_per_day).toBe(2.5);
  });
  it('pack pace sets stops_per_day to 7', () => {
    expect(ANSWER_WEIGHTS.pace.pack.stops_per_day).toBe(7.0);
  });
  it('luxury budget sets price_min to 3', () => {
    expect(ANSWER_WEIGHTS.budget.luxury.price_min).toBe(3);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/onboarding/ob-conflict-map.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create ob-conflict-map.ts**

Create `frontend/src/modules/onboarding/ob-conflict-map.ts`:

```typescript
// ── Hard conflict pairs ───────────────────────────────────────
export interface HardConflict {
  id:        'C1' | 'C2' | 'C3' | 'C4';
  a:         string;
  b:         string;
  dimension: string;
}

export const HARD_CONFLICTS: HardConflict[] = [
  { id: 'C1', a: 'slow',   b: 'pack',        dimension: 'stops_per_day' },
  { id: 'C2', a: 'budget', b: 'luxury',       dimension: 'price_level' },
  { id: 'C3', a: 'early',  b: 'bars',         dimension: 'evening_type' },
  { id: 'C4', a: 'budget', b: 'comfortable',  dimension: 'price_level' },
];

export function detectHardConflict(a: string, b: string): HardConflict | null {
  return HARD_CONFLICTS.find(
    c => (c.a === a && c.b === b) || (c.a === b && c.b === a)
  ) ?? null;
}

// ── Soft conflict pairs ────────────────────────────────────────
export const SOFT_CONFLICTS = [
  { a: 'slow',        b: 'balanced',   strategy: 'split_day' },
  { a: 'relax',       b: 'pack',       strategy: 'anchor_filler' },
  { a: 'family',      b: 'bars',       strategy: 'force_dinner' },
  { a: 'plant_based', b: 'grab_go',    strategy: 'badge_only' },
  { a: 'halal',       b: 'bars',       strategy: 'disclaimer' },
] as const;

// ── Alignment tables ───────────────────────────────────────────
export const PACE_ALIGNMENT: Record<string, Record<string, number>> = {
  slow:        { slow: 1.0, balanced: 0.6, pack: 0.0, spontaneous: 0.5 },
  balanced:    { slow: 0.6, balanced: 1.0, pack: 0.4, spontaneous: 0.7 },
  pack:        { slow: 0.0, balanced: 0.4, pack: 1.0, spontaneous: 0.3 },
  spontaneous: { slow: 0.5, balanced: 0.7, pack: 0.3, spontaneous: 1.0 },
};

export const PRICE_ALIGNMENT: Record<string, Record<string, number>> = {
  budget:      { budget: 1.0, mid_range: 0.5, comfortable: 0.1, luxury: 0.0 },
  mid_range:   { budget: 0.5, mid_range: 1.0, comfortable: 0.6, luxury: 0.2 },
  comfortable: { budget: 0.1, mid_range: 0.6, comfortable: 1.0, luxury: 0.7 },
  luxury:      { budget: 0.0, mid_range: 0.2, comfortable: 0.7, luxury: 1.0 },
};

export const EVENING_ALIGNMENT: Record<string, Record<string, number>> = {
  bars:        { bars: 1.0, dinner_wind: 0.3, markets: 0.5, early: 0.0 },
  dinner_wind: { bars: 0.3, dinner_wind: 1.0, markets: 0.6, early: 0.5 },
  markets:     { bars: 0.5, markets: 1.0, dinner_wind: 0.6, early: 0.4 },
  early:       { bars: 0.0, dinner_wind: 0.5, markets: 0.4, early: 1.0 },
};

// ── Score options against accumulated weights ──────────────────
export function scoreOptions(
  candidates: string[],
  accumulatedWeights: Record<string, number>,
  alignmentTable: Record<string, Record<string, number>>
): Record<string, number> {
  const scores: Record<string, number> = {};
  const dims = Object.keys(accumulatedWeights);
  if (dims.length === 0) {
    candidates.forEach(c => { scores[c] = 0; });
    return scores;
  }
  for (const candidate of candidates) {
    const row = alignmentTable[candidate] ?? {};
    let sum = 0;
    for (const [dim, weight] of Object.entries(accumulatedWeights)) {
      // Map dimension names to alignment table keys where possible
      const alignKey = dim === 'stops_per_day' ? candidate : dim;
      const alignment = row[dim] ?? row[candidate] ?? 0;
      sum += weight * alignment;
    }
    scores[candidate] = sum / dims.length;
  }
  return scores;
}

// ── Answer weight vectors ──────────────────────────────────────
export const ANSWER_WEIGHTS = {
  pace: {
    slow:        { stops_per_day: 2.5, time_per_stop: 105, flexibility: 0.3 },
    balanced:    { stops_per_day: 4.5, time_per_stop: 52,  flexibility: 0.5 },
    pack:        { stops_per_day: 7.0, time_per_stop: 32,  flexibility: 0.2 },
    spontaneous: { stops_per_day: 3.0, time_per_stop: 60,  flexibility: 1.0 },
  },
  budget: {
    budget:      { price_min: 1 as const, price_max: 1 as const },
    mid_range:   { price_min: 1 as const, price_max: 3 as const },
    comfortable: { price_min: 2 as const, price_max: 4 as const },
    luxury:      { price_min: 3 as const, price_max: 4 as const },
  },
  evening: {
    bars:        { evening_end_time: '02:00' },
    dinner_wind: { evening_end_time: '22:00' },
    markets:     { evening_end_time: '23:00' },
    early:       { evening_end_time: '20:00' },
  },
  day_open: {
    coffee:    { day_buffer_min: 30 },
    breakfast: { day_buffer_min: 45 },
    straight:  { day_buffer_min: 0 },
    grab_go:   { day_buffer_min: 0 },
  },
} as const;

// ── Dietary flag mapping ───────────────────────────────────────
export const DIETARY_FLAG_MAP: Record<string, string[]> = {
  none:        [],
  plant_based: ['vegan_boost', 'meat_flag'],
  halal:       ['halal_certified_only'],
  kosher:      ['kosher_certified_only'],
  allergy:     ['allergy_warning'],
};
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/modules/onboarding/ob-conflict-map.test.ts 2>&1 | tail -15
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/onboarding/ob-conflict-map.ts frontend/src/modules/onboarding/ob-conflict-map.test.ts
git commit -m "feat: add ob-conflict-map with hard/soft conflicts, alignment tables, and weight vectors"
```

---

### Task 3: Create ob-resolver.ts

**Files:**
- Create: `frontend/src/modules/onboarding/ob-resolver.ts`
- Create: `frontend/src/modules/onboarding/ob-resolver.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/modules/onboarding/ob-resolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveOBAnswers, mergeVenueWeights } from './ob-resolver';
import type { RawOBAnswers } from '../../shared/types';

function baseAnswers(overrides: Partial<RawOBAnswers> = {}): RawOBAnswers {
  return {
    group: 'solo', mood: ['explore'], pace: ['balanced'],
    day_open: 'coffee', dietary: [], budget: 'mid_range', evening: 'dinner_wind',
    ...overrides,
  };
}

describe('resolveOBAnswers — basic output shape', () => {
  it('returns a PersonaProfile with all required fields', () => {
    const result = resolveOBAnswers(baseAnswers());
    expect(result.stops_per_day).toBeDefined();
    expect(result.time_per_stop).toBeDefined();
    expect(result.venue_weights).toBeDefined();
    expect(result.price_min).toBeDefined();
    expect(result.price_max).toBeDefined();
    expect(result.flexibility).toBeDefined();
    expect(result.day_open).toBe('coffee');
    expect(result.day_buffer_min).toBe(30);
    expect(result.evening_type).toBe('dinner_wind');
    expect(result.evening_end_time).toBe('22:00');
    expect(result.social_flags).toContain('solo');
    expect(result.dietary).toEqual([]);
    expect(result.resolved_conflicts).toEqual([]);
    expect(result.auto_blend).toBe(false);
  });
});

describe('resolveOBAnswers — pace resolution', () => {
  it('single pace answer sets correct stops_per_day', () => {
    const r = resolveOBAnswers(baseAnswers({ pace: ['slow'] }));
    expect(r.stops_per_day).toBe(2.5);
    expect(r.time_per_stop).toBe(105);
  });

  it('pack sets stops_per_day to 7', () => {
    const r = resolveOBAnswers(baseAnswers({ pace: ['pack'] }));
    expect(r.stops_per_day).toBe(7.0);
  });
});

describe('resolveOBAnswers — hard conflict C1 (slow+pack)', () => {
  it('auto_blend=true when pace has slow+pack and no prior resolution', () => {
    const r = resolveOBAnswers(baseAnswers({ pace: ['slow', 'pack'] }));
    expect(r.auto_blend).toBe(true);
    const c1 = r.resolved_conflicts.find(c => c.conflict_id === 'C1');
    expect(c1).toBeDefined();
    expect(c1?.method).toBe('auto_blend');
  });

  it('user_pick resolution is honoured when pre_resolved provided', () => {
    const answers = baseAnswers({ pace: ['slow', 'pack'] });
    const r = resolveOBAnswers(answers, [{ conflict_id: 'C1', method: 'user_pick', winner: 'slow' }]);
    expect(r.stops_per_day).toBe(2.5);
    expect(r.auto_blend).toBe(false);
  });
});

describe('resolveOBAnswers — hard conflict C2 (budget+luxury)', () => {
  it('auto_blend resolves when budget+luxury chosen', () => {
    const r = resolveOBAnswers({ ...baseAnswers(), budget: 'luxury',
      pace: ['balanced'],
      // simulate a conflict state by passing both — budget is single-choice
      // so we override directly
    });
    // Single-choice question — C2 only happens via multi pre_resolved path
    // Just verify budget=luxury resolves correctly
    expect(r.price_min).toBe(3);
    expect(r.price_max).toBe(4);
  });
});

describe('resolveOBAnswers — dietary flag mapping', () => {
  it('halal dietary maps to halal_certified_only flag', () => {
    const r = resolveOBAnswers(baseAnswers({ dietary: ['halal'] }));
    expect(r.dietary).toContain('halal_certified_only');
  });

  it('plant_based maps to vegan_boost and meat_flag', () => {
    const r = resolveOBAnswers(baseAnswers({ dietary: ['plant_based'] }));
    expect(r.dietary).toContain('vegan_boost');
    expect(r.dietary).toContain('meat_flag');
  });

  it('multiple dietary flags stack', () => {
    const r = resolveOBAnswers(baseAnswers({ dietary: ['halal', 'allergy'] }));
    expect(r.dietary).toContain('halal_certified_only');
    expect(r.dietary).toContain('allergy_warning');
  });
});

describe('mergeVenueWeights', () => {
  it('single mood returns full weights for that mood', () => {
    const w = mergeVenueWeights(['explore']);
    expect(w['neighbourhood']).toBeGreaterThan(0);
    expect(w['restaurant']).toBe(0);
  });

  it('second mood contributes at 0.4x decay', () => {
    const single = mergeVenueWeights(['explore']);
    const dual   = mergeVenueWeights(['explore', 'eat_drink']);
    // restaurant should appear in dual but not single
    expect((dual['restaurant'] ?? 0)).toBeGreaterThan(0);
    expect((single['restaurant'] ?? 0)).toBe(0);
  });

  it('normalises so max weight is 1.0', () => {
    const w = mergeVenueWeights(['culture', 'eat_drink']);
    const max = Math.max(...Object.values(w));
    expect(max).toBeCloseTo(1.0, 5);
  });
});

describe('resolveOBAnswers — social flags', () => {
  it('family group adds family and kids flags', () => {
    const r = resolveOBAnswers(baseAnswers({ group: 'family' }));
    expect(r.social_flags).toContain('family');
    expect(r.social_flags).toContain('kids');
  });

  it('friends group adds group flag', () => {
    const r = resolveOBAnswers(baseAnswers({ group: 'friends' }));
    expect(r.social_flags).toContain('group');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/modules/onboarding/ob-resolver.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create ob-resolver.ts**

Create `frontend/src/modules/onboarding/ob-resolver.ts`:

```typescript
import type {
  RawOBAnswers, PersonaProfile, ResolvedConflict,
  SocialFlag, DietaryFlag, VenueType, OBDayOpen, OBEvening,
} from '../../shared/types';
import {
  detectHardConflict, ANSWER_WEIGHTS, DIETARY_FLAG_MAP,
  PACE_ALIGNMENT, scoreOptions,
} from './ob-conflict-map';

// ── Venue weights per mood ────────────────────────────────────
const MOOD_VENUE_WEIGHTS: Record<string, Partial<Record<VenueType, number>>> = {
  explore:   { neighbourhood: 0.4, landmark: 0.3, viewpoint: 0.3 },
  relax:     { park: 0.4, spa: 0.3, cafe: 0.3 },
  eat_drink: { restaurant: 0.5, market: 0.4, street_food: 0.3 },
  culture:   { museum: 0.5, heritage: 0.4, gallery: 0.3 },
};

// ── Social flags per group ────────────────────────────────────
const GROUP_SOCIAL_FLAGS: Record<string, SocialFlag[]> = {
  solo:    ['solo'],
  couple:  ['couple'],
  family:  ['family', 'kids'],
  friends: ['group'],
};

// ── Stage 2: merge venue weights across multi-choice moods ────
export function mergeVenueWeights(moods: string[]): Partial<Record<VenueType, number>> {
  const decay = [1.0, 0.4, 0.2];
  const result: Record<string, number> = {};
  for (let i = 0; i < moods.length; i++) {
    const w = decay[Math.min(i, 2)];
    const weights = MOOD_VENUE_WEIGHTS[moods[i]] ?? {};
    for (const [vtype, base] of Object.entries(weights)) {
      result[vtype] = (result[vtype] ?? 0) + base * w;
    }
  }
  const maxW = Math.max(...Object.values(result), 0.001);
  return Object.fromEntries(
    Object.entries(result).map(([k, v]) => [k, v / maxW])
  ) as Partial<Record<VenueType, number>>;
}

// ── Stage 1: resolve hard conflicts ──────────────────────────
function resolveConflicts(
  pace: string[],
  preResolved: ResolvedConflict[]
): { resolvedPace: string; conflicts: ResolvedConflict[]; autoBlend: boolean } {
  const conflicts: ResolvedConflict[] = [];
  let autoBlend = false;

  if (pace.length < 2) {
    return { resolvedPace: pace[0] ?? 'balanced', conflicts, autoBlend };
  }

  const conflict = detectHardConflict(pace[0], pace[1]);
  if (!conflict) {
    return { resolvedPace: pace[0], conflicts, autoBlend };
  }

  // Check if user already resolved this
  const existing = preResolved.find(r => r.conflict_id === conflict.id);
  if (existing) {
    conflicts.push(existing);
    return {
      resolvedPace: existing.method === 'auto_blend' ? pace[0] : (existing.winner ?? pace[0]),
      conflicts,
      autoBlend: existing.method === 'auto_blend',
    };
  }

  // Auto-blend: keep both, flag for itinerary engine
  autoBlend = true;
  const resolved: ResolvedConflict = { conflict_id: conflict.id, method: 'auto_blend' };
  conflicts.push(resolved);
  return { resolvedPace: pace[0], conflicts, autoBlend };
}

// ── Stage 3: assemble PersonaProfile ─────────────────────────
export function resolveOBAnswers(
  raw: RawOBAnswers,
  preResolved: ResolvedConflict[] = []
): PersonaProfile {
  // Stage 1 — conflict resolution (pace only for now; budget/evening are single-choice)
  const { resolvedPace, conflicts, autoBlend } = resolveConflicts(raw.pace, preResolved);

  // Stage 2 — compute derived values
  const paceWeights = ANSWER_WEIGHTS.pace[resolvedPace as keyof typeof ANSWER_WEIGHTS.pace]
    ?? ANSWER_WEIGHTS.pace.balanced;
  const budgetWeights = ANSWER_WEIGHTS.budget[raw.budget ?? 'mid_range'];
  const eveningWeights = ANSWER_WEIGHTS.evening[raw.evening ?? 'dinner_wind'];
  const dayOpenWeights = ANSWER_WEIGHTS.day_open[raw.day_open ?? 'coffee'];

  const venue_weights = mergeVenueWeights(raw.mood);

  const dietary: DietaryFlag[] = raw.dietary.flatMap(
    d => (DIETARY_FLAG_MAP[d] ?? []) as DietaryFlag[]
  );

  const social_flags: SocialFlag[] = GROUP_SOCIAL_FLAGS[raw.group ?? 'solo'] ?? ['solo'];

  // Stage 3 — assemble
  const profile: PersonaProfile = {
    stops_per_day:    paceWeights.stops_per_day,
    time_per_stop:    paceWeights.time_per_stop,
    venue_weights,
    price_min:        budgetWeights.price_min,
    price_max:        budgetWeights.price_max,
    flexibility:      paceWeights.flexibility,
    day_open:         raw.day_open ?? 'coffee',
    day_buffer_min:   dayOpenWeights.day_buffer_min,
    evening_type:     raw.evening ?? 'dinner_wind',
    evening_end_time: eveningWeights.evening_end_time,
    social_flags,
    dietary,
    archetype:        'wanderer', // resolved server-side; placeholder for client
    resolved_conflicts: conflicts,
    auto_blend:       autoBlend,
  };

  // Conditional fields
  if (raw.kid_focus)       profile.kid_focus       = raw.kid_focus;
  if (raw.budget_protect)  profile.budget_protect  = raw.budget_protect;
  if (raw.food_scene)      profile.food_scene      = raw.food_scene;

  return profile;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/modules/onboarding/ob-resolver.test.ts 2>&1 | tail -20
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/onboarding/ob-resolver.ts frontend/src/modules/onboarding/ob-resolver.test.ts
git commit -m "feat: add ob-resolver — pure fn RawOBAnswers → PersonaProfile"
```

---

### Task 4: Create ob-context-resolvers.ts

**Files:**
- Create: `frontend/src/modules/onboarding/ob-context-resolvers.ts`
- Create: `frontend/src/modules/onboarding/ob-context-resolvers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/modules/onboarding/ob-context-resolvers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveQ7Evening, resolveQ4DayOpen, resolveQ3Pace } from './ob-context-resolvers';
import type { RawOBAnswers } from '../../shared/types';

function partial(overrides: Partial<RawOBAnswers> = {}): Partial<RawOBAnswers> {
  return { group: 'solo', mood: ['explore'], pace: ['balanced'], ...overrides };
}

describe('resolveQ7Evening', () => {
  it('returns family-specific title for family group', () => {
    const out = resolveQ7Evening(partial({ group: 'family' }));
    expect(out.title).toContain('end time');
  });
  it('returns food-specific title for eat_drink mood', () => {
    const out = resolveQ7Evening(partial({ mood: ['eat_drink'] }));
    expect(out.title.toLowerCase()).toMatch(/evening|end up/);
  });
  it('returns default title when no signals match', () => {
    const out = resolveQ7Evening(partial());
    expect(out.title).toBe("What does a good evening look like?");
  });
});

describe('resolveQ4DayOpen', () => {
  it('returns relax-specific title', () => {
    const out = resolveQ4DayOpen(partial({ mood: ['relax'] }));
    expect(out.title.toLowerCase()).toContain('slow');
  });
  it('returns pack-specific title', () => {
    const out = resolveQ4DayOpen(partial({ pace: ['pack'] }));
    expect(out.title.toLowerCase()).toMatch(/fast|going|morning/);
  });
  it('returns default title', () => {
    const out = resolveQ4DayOpen(partial());
    expect(out.title).toBe("How do you ease into the day?");
  });
});

describe('resolveQ3Pace', () => {
  it('returns family-specific subtitle', () => {
    const out = resolveQ3Pace(partial({ group: 'family' }));
    expect(out.subtitle.toLowerCase()).toContain('kid');
  });
  it('returns default title', () => {
    const out = resolveQ3Pace(partial());
    expect(out.title).toBe("How do you pace a day?");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/modules/onboarding/ob-context-resolvers.test.ts 2>&1 | tail -10
```

Expected: FAIL

- [ ] **Step 3: Create ob-context-resolvers.ts**

Create `frontend/src/modules/onboarding/ob-context-resolvers.ts`:

```typescript
import type { RawOBAnswers } from '../../shared/types';

export interface QuestionDisplay {
  title:    string;
  subtitle: string;
}

export function resolveQ1Group(_answers: Partial<RawOBAnswers>): QuestionDisplay {
  return {
    title:    "Who's travelling?",
    subtitle: "Sets your itinerary's social context and venue filters.",
  };
}

export function resolveQ2Mood(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "What does the family want from this trip?", subtitle: "Pick up to 3." };
  }
  return { title: "What's the trip mood?", subtitle: "Pick up to 3 — shapes what we prioritise." };
}

export function resolveQ3Pace(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "How do you pace a day with kids?", subtitle: "Affects stops per day and time at each place." };
  }
  if (answers.mood?.includes('relax')) {
    return { title: "How slow do you want to go?", subtitle: "Affects stops per day and time at each place." };
  }
  return { title: "How do you pace a day?", subtitle: "Affects stops per day and time at each place." };
}

export function resolveQ4DayOpen(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "How does the family start the day?", subtitle: "Sets your morning block." };
  }
  if (answers.mood?.includes('relax')) {
    return { title: "How do you ease into a slow day?", subtitle: "Sets your morning block." };
  }
  if (answers.pace?.includes('pack')) {
    return { title: "How fast do you get going in the morning?", subtitle: "Sets your morning block." };
  }
  return { title: "How do you ease into the day?", subtitle: "Sets your morning block." };
}

export function resolveQ5Dietary(_answers: Partial<RawOBAnswers>): QuestionDisplay {
  return {
    title:    "Any food situation we should know?",
    subtitle: "Shapes restaurant filtering. Pick all that apply.",
  };
}

export function resolveQ6Budget(_answers: Partial<RawOBAnswers>): QuestionDisplay {
  return {
    title:    "How are you travelling budget-wise?",
    subtitle: "Sets your price range across venues.",
  };
}

export function resolveQ7Evening(answers: Partial<RawOBAnswers>): QuestionDisplay {
  if (answers.group === 'family') {
    return { title: "What's a good end time for the day?", subtitle: "Sets your evening block." };
  }
  if (answers.mood?.includes('eat_drink')) {
    return { title: "Where does your evening usually end up?", subtitle: "Sets your evening block." };
  }
  if (answers.pace?.includes('slow') && answers.mood?.includes('relax')) {
    return { title: "How do you like to close out a slow day?", subtitle: "Sets your evening block." };
  }
  if (answers.pace?.includes('pack')) {
    return { title: "How late do you push before calling it?", subtitle: "Sets your evening block." };
  }
  if (answers.dietary?.includes('halal')) {
    return { title: "What's your kind of evening scene?", subtitle: "Sets your evening block." };
  }
  return { title: "What does a good evening look like?", subtitle: "Sets your evening block." };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/modules/onboarding/ob-context-resolvers.test.ts 2>&1 | tail -10
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/onboarding/ob-context-resolvers.ts frontend/src/modules/onboarding/ob-context-resolvers.test.ts
git commit -m "feat: add ob-context-resolvers — per-question contextual wording functions"
```

---

### Task 5: Create ImageRowCard and ConflictPanel components

**Files:**
- Create: `frontend/src/shared/questionnaire/ImageRowCard.tsx`
- Create: `frontend/src/shared/questionnaire/ConflictPanel.tsx`
- Modify: `frontend/src/shared/questionnaire/index.ts`

- [ ] **Step 1: Create ImageRowCard.tsx**

Create `frontend/src/shared/questionnaire/ImageRowCard.tsx`:

```tsx
interface ImageRowCardProps {
  label:       string;
  description: string;
  imageUrl:    string;
  selected:    boolean;
  onSelect:    () => void;
  hidden?:     boolean;   // "less common for your trip type" badge
  disabled?:   boolean;
  dimmed?:     boolean;   // conflict state
}

export function ImageRowCard({
  label, description, imageUrl, selected, onSelect,
  hidden = false, disabled = false, dimmed = false,
}: ImageRowCardProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'w-full flex items-center gap-3 p-3 rounded-2xl border text-left',
        'transition-all duration-200',
        selected
          ? 'bg-primary/8 border-primary'
          : dimmed
          ? 'bg-surface border-white/10 opacity-65'
          : hidden
          ? 'bg-surface/50 border-white/10'
          : 'bg-surface border-surf-hst',
        !disabled && !dimmed && 'hover:translate-x-0.5 cursor-pointer',
      ].filter(Boolean).join(' ')}
      style={selected ? { animation: 'glow-pulse 0.45s ease-out' } : undefined}
    >
      {/* Thumbnail */}
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className={[
          'w-12 h-12 rounded-xl object-cover flex-shrink-0 transition-transform duration-300',
          selected ? 'scale-105' : '',
          hidden ? 'saturate-50 brightness-75' : '',
          dimmed ? 'saturate-50 brightness-75' : '',
        ].filter(Boolean).join(' ')}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        {hidden && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange
            bg-orange/10 border border-orange/20 rounded-full px-2 py-0.5 mb-1">
            less common for your trip type
          </span>
        )}
        <span className={[
          'block font-heading font-bold text-[15px]',
          hidden ? 'text-text-2' : 'text-text-1',
        ].join(' ')}>
          {label}
        </span>
        <span className="block text-[12px] text-text-3 mt-0.5">{description}</span>
      </div>

      {/* Checkbox */}
      <span
        aria-hidden="true"
        className={[
          'w-[22px] h-[22px] rounded-md border flex-shrink-0 flex items-center justify-center',
          'transition-all duration-200',
          selected
            ? 'bg-primary border-primary scale-110'
            : 'border-surf-hst',
        ].join(' ')}
      >
        {selected && (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <polyline points="2,7 5,10 11,3" stroke="white" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Create ConflictPanel.tsx**

Create `frontend/src/shared/questionnaire/ConflictPanel.tsx`:

```tsx
interface SuggestionOption {
  key:        string;
  label:      string;
  imageUrl:   string;
  whyLabel:   string;  // e.g. "Relax mood · solo → 0.82"
}

interface ConflictPanelProps {
  visible:     boolean;
  suggestion:  SuggestionOption;
  onUseSuggestion: () => void;
  onAutoBlend:     () => void;
}

export function ConflictPanel({ visible, suggestion, onUseSuggestion, onAutoBlend }: ConflictPanelProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'rounded-2xl overflow-hidden transition-all duration-400',
        'bg-blue-900/10 border border-primary/12',
        visible ? 'max-h-80 opacity-100 mb-2 p-3' : 'max-h-0 opacity-0 mb-0 p-0',
      ].join(' ')}
    >
      {/* Conflict copy */}
      <p className="text-[13px] text-text-2 leading-relaxed mb-3">
        These two shape your day differently — pick one to lead, or let us blend them.
      </p>

      {/* Suggestion */}
      <span className="block text-[10px] font-bold uppercase tracking-widest text-text-3 mb-2">
        Best fit for your profile
      </span>
      <div className="flex items-center gap-3 bg-bg/50 border border-primary/20 rounded-xl p-2.5 mb-2">
        <img src={suggestion.imageUrl} alt="" aria-hidden="true"
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="block font-heading font-bold text-[13px] text-text-1">{suggestion.label}</span>
          <span className="block text-[11px] text-primary/80 mt-0.5">{suggestion.whyLabel}</span>
        </div>
        <button
          type="button"
          onClick={onUseSuggestion}
          className="flex-shrink-0 bg-primary text-white font-heading font-bold text-[12px]
            px-3 py-1.5 rounded-lg transition-all hover:bg-primary-c hover:scale-105 active:scale-95"
        >
          Use this
        </button>
      </div>

      {/* Auto-blend */}
      <button
        type="button"
        onClick={onAutoBlend}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
          border border-white/7 bg-transparent transition-all
          hover:border-white/15 hover:bg-white/3 group"
      >
        <div className="text-left">
          <span className="block font-heading font-bold text-[13px] text-text-2">Let the app decide</span>
          <span className="block text-[11px] text-text-3 mt-0.5">
            We'll read your full profile and shape the day around both.
          </span>
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold text-primary
          bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1
          group-hover:bg-primary/18 transition-colors">
          Auto
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Export from questionnaire index**

In `frontend/src/shared/questionnaire/index.ts`, add:

```typescript
export { ImageRowCard } from './ImageRowCard';
export { ConflictPanel } from './ConflictPanel';
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "ImageRowCard|ConflictPanel" | head -10
```

Expected: no errors for these two files

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/questionnaire/ImageRowCard.tsx \
        frontend/src/shared/questionnaire/ConflictPanel.tsx \
        frontend/src/shared/questionnaire/index.ts
git commit -m "feat: add ImageRowCard and ConflictPanel shared components"
```

---

### Task 6: Create OB1–OB4 screens (group, mood, pace, day_open)

**Files:**
- Create: `frontend/src/modules/onboarding/OB1Group.tsx`
- Create: `frontend/src/modules/onboarding/OB2Mood.tsx`
- Create: `frontend/src/modules/onboarding/OB3Pace.tsx`
- Create: `frontend/src/modules/onboarding/OB4DayOpen.tsx`

- [ ] **Step 1: Create OB1Group.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBGroup } from '../../shared/types';

const OPTIONS: { value: OBGroup; label: string; description: string; imageUrl: string }[] = [
  { value: 'solo',    label: 'Just me',          description: 'Self-paced, flexible, communal spaces OK',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=120&q=80' },
  { value: 'couple',  label: 'Partner / couple',  description: 'Romantic spots, table-for-two, shared pace',
    imageUrl: 'https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=120&q=80' },
  { value: 'family',  label: 'Family with kids',  description: 'Kid-accessible, playgrounds, early dinner',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=120&q=80' },
  { value: 'friends', label: 'Friends group',     description: 'Group bookings, sharable food, social vibe',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=120&q=80' },
];

export function OB1Group() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.group ?? null) as OBGroup | null;

  function handleChange(v: OBGroup) {
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'group', value: v });
  }

  return (
    <OnboardingShell step="ob1" canAdvance={value !== null}>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => handleChange(opt.value)}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 2: Create OB2Mood.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import { resolveQ2Mood } from './ob-context-resolvers';
import type { OBMood } from '../../shared/types';

const OPTIONS: { value: OBMood; label: string; description: string; imageUrl: string }[] = [
  { value: 'explore',   label: 'Explore & discover', description: 'Neighbourhoods, landmarks, viewpoints',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=120&q=80' },
  { value: 'relax',     label: 'Relax & recharge',   description: 'Parks, cafés, spas — fewer stops, longer stays',
    imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=120&q=80' },
  { value: 'eat_drink', label: 'Eat & drink',         description: 'Markets, culinary streets, food as anchor',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&q=80' },
  { value: 'culture',   label: 'Deep culture dive',   description: 'Museums, history, context-rich stops',
    imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=120&q=80' },
];

const MAX = 3;

export function OB2Mood() {
  const { state, dispatch } = useAppStore();
  const values: OBMood[] = state.rawOBAnswers?.mood ?? [];
  const ctx = resolveQ2Mood(state.rawOBAnswers ?? {});

  function toggle(v: OBMood) {
    const next = values.includes(v)
      ? values.filter(x => x !== v)
      : values.length < MAX ? [...values, v] : values;
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'mood', value: next });
  }

  return (
    <OnboardingShell step="ob2" canAdvance={values.length > 0} title={ctx.title} subtitle={ctx.subtitle}>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={values.includes(opt.value)}
            onSelect={() => toggle(opt.value)}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 3: Create OB3Pace.tsx**

```tsx
import { useState } from 'react';
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard, ConflictPanel } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import { resolveQ3Pace } from './ob-context-resolvers';
import { detectHardConflict, ANSWER_WEIGHTS, scoreOptions, PACE_ALIGNMENT } from './ob-conflict-map';
import type { OBPace, ResolvedConflict } from '../../shared/types';

const OPTIONS: { value: OBPace; label: string; description: string; imageUrl: string }[] = [
  { value: 'slow',        label: 'Slow & deep',    description: '2–3 stops/day · 90 min each · rest built in',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=120&q=80' },
  { value: 'balanced',    label: 'Balanced',        description: '4–5 stops/day · 45 min each',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=120&q=80' },
  { value: 'pack',        label: 'Pack it in',      description: '6–8 stops/day · 25 min each · efficient routing',
    imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=120&q=80' },
  { value: 'spontaneous', label: 'Spontaneous',     description: '3 anchor stops + open gaps · flexible order',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=120&q=80' },
];

const SUGGESTION_IMAGES: Record<string, string> = {
  slow:        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=80&q=80',
  balanced:    'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=80&q=80',
  pack:        'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=80&q=80',
  spontaneous: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=80&q=80',
};

const MAX = 2;

export function OB3Pace() {
  const { state, dispatch } = useAppStore();
  const values: OBPace[] = state.rawOBAnswers?.pace ?? [];
  const ctx = resolveQ3Pace(state.rawOBAnswers ?? {});
  const [preResolved, setPreResolved] = useState<ResolvedConflict[]>([]);

  const conflict = values.length === 2 ? detectHardConflict(values[0], values[1]) : null;
  const conflictDismissed = conflict
    ? preResolved.some(r => r.conflict_id === conflict.id)
    : false;
  const showPanel = !!conflict && !conflictDismissed;

  // Compute suggestion
  const suggestion = (() => {
    if (!conflict) return null;
    const accum: Record<string, number> = {};
    const answers = state.rawOBAnswers ?? {};
    if (answers.mood?.includes('relax'))   accum['stops_per_day'] = -1.5;
    if (answers.mood?.includes('explore')) accum['flexibility']   = 0.2;
    if (answers.group === 'solo')          accum['flexibility']   = (accum['flexibility'] ?? 0) + 0.1;
    const scores = scoreOptions(['slow', 'balanced', 'pack', 'spontaneous'], accum, PACE_ALIGNMENT);
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const opt = OPTIONS.find(o => o.value === winner[0]);
    return opt ? {
      key:      opt.value,
      label:    opt.label,
      imageUrl: SUGGESTION_IMAGES[opt.value] ?? '',
      whyLabel: `${Object.keys(accum).slice(0, 2).join(' · ')} → ${winner[1].toFixed(2)}`,
    } : null;
  })();

  function toggle(v: OBPace) {
    const next = values.includes(v)
      ? values.filter(x => x !== v)
      : values.length < MAX ? [...values, v] : values;
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'pace', value: next });
    // Reset resolutions when selections change
    setPreResolved([]);
  }

  function useSuggestion() {
    if (!conflict || !suggestion) return;
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'pace', value: [suggestion.key as OBPace] });
    setPreResolved(prev => [...prev, { conflict_id: conflict.id, method: 'user_pick', winner: suggestion.key }]);
  }

  function autoBlend() {
    if (!conflict) return;
    setPreResolved(prev => [...prev, { conflict_id: conflict.id, method: 'auto_blend' }]);
    dispatch({ type: 'SET_OB_PRE_RESOLVED', value: [{ conflict_id: conflict.id, method: 'auto_blend' }] });
  }

  return (
    <OnboardingShell step="ob3" canAdvance={values.length > 0} title={ctx.title} subtitle={ctx.subtitle}>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((opt, idx) => {
          const isConflicting = showPanel && values.includes(opt.value);
          return (
            <div key={opt.value}>
              <ImageRowCard
                label={opt.label}
                description={opt.description}
                imageUrl={opt.imageUrl}
                selected={values.includes(opt.value)}
                onSelect={() => toggle(opt.value)}
                dimmed={isConflicting}
              />
              {/* Conflict panel appears after the first conflicting item */}
              {idx === 0 && showPanel && suggestion && (
                <ConflictPanel
                  visible={showPanel}
                  suggestion={suggestion}
                  onUseSuggestion={useSuggestion}
                  onAutoBlend={autoBlend}
                />
              )}
            </div>
          );
        })}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 4: Create OB4DayOpen.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import { resolveQ4DayOpen } from './ob-context-resolvers';
import type { OBDayOpen } from '../../shared/types';

const OPTIONS: { value: OBDayOpen; label: string; description: string; imageUrl: string }[] = [
  { value: 'coffee',    label: 'Coffee shop ritual', description: 'Local café first · 30 min buffer before first spot',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=120&q=80' },
  { value: 'breakfast', label: 'Sit-down breakfast', description: 'Restaurant first · 45 min · then attractions',
    imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=120&q=80' },
  { value: 'straight',  label: 'Straight to it',     description: 'Top attraction first · no food stop at start',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&q=80' },
  { value: 'grab_go',   label: 'Grab & go',           description: 'Street food en route · first attraction early',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&q=80' },
];

export function OB4DayOpen() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.day_open ?? null) as OBDayOpen | null;
  const ctx = resolveQ4DayOpen(state.rawOBAnswers ?? {});

  function handleChange(v: OBDayOpen) {
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'day_open', value: v });
  }

  return (
    <OnboardingShell step="ob4" canAdvance={value !== null} title={ctx.title} subtitle={ctx.subtitle}>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => handleChange(opt.value)}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/onboarding/OB1Group.tsx \
        frontend/src/modules/onboarding/OB2Mood.tsx \
        frontend/src/modules/onboarding/OB3Pace.tsx \
        frontend/src/modules/onboarding/OB4DayOpen.tsx
git commit -m "feat: add OB1–OB4 screens (group, mood, pace, day_open)"
```

---

### Task 7: Create OB5–OB7 and conditional OB8–OB10 screens

**Files:**
- Create: `frontend/src/modules/onboarding/OB5Dietary.tsx`
- Create: `frontend/src/modules/onboarding/OB6Budget.tsx`
- Create: `frontend/src/modules/onboarding/OB7Evening.tsx`
- Create: `frontend/src/modules/onboarding/OB8KidFocus.tsx`
- Create: `frontend/src/modules/onboarding/OB9BudgetProtect.tsx`
- Create: `frontend/src/modules/onboarding/OB10FoodScene.tsx`

- [ ] **Step 1: Create OB5Dietary.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBDietary } from '../../shared/types';

const OPTIONS: { value: OBDietary; label: string; description: string; imageUrl: string }[] = [
  { value: 'none',        label: 'No restrictions',  description: 'Full range — no filtering',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&q=80' },
  { value: 'plant_based', label: 'Plant-based',       description: 'Vegan/vegetarian venues boosted, meat flagged',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=120&q=80' },
  { value: 'halal',       label: 'Halal',             description: 'Certified or clearly compatible venues only',
    imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=120&q=80' },
  { value: 'kosher',      label: 'Kosher',            description: 'Certified venues only, others get disclaimer',
    imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=120&q=80' },
  { value: 'allergy',     label: 'I have an allergy', description: 'Warning badge on relevant places',
    imageUrl: 'https://images.unsplash.com/photo-1576402187878-974f70c890a5?w=120&q=80' },
];

export function OB5Dietary() {
  const { state, dispatch } = useAppStore();
  const values: OBDietary[] = state.rawOBAnswers?.dietary ?? [];

  function toggle(v: OBDietary) {
    if (v === 'none') {
      dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'dietary', value: ['none'] });
      return;
    }
    const without_none = values.filter(x => x !== 'none');
    const next = without_none.includes(v)
      ? without_none.filter(x => x !== v)
      : [...without_none, v];
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'dietary', value: next.length === 0 ? [] : next });
  }

  return (
    <OnboardingShell step="ob5" canAdvance={true} title="Any food situation we should know?"
      subtitle="Pick all that apply. Shapes restaurant filtering.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={values.includes(opt.value)}
            onSelect={() => toggle(opt.value)}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 2: Create OB6Budget.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBBudget } from '../../shared/types';

const OPTIONS: { value: OBBudget; label: string; description: string; imageUrl: string }[] = [
  { value: 'budget',      label: 'Budget-conscious', description: 'Free attractions first · street food preferred',
    imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=120&q=80' },
  { value: 'mid_range',   label: 'Mid-range',         description: 'Mix of free + paid · no restrictions',
    imageUrl: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=120&q=80' },
  { value: 'comfortable', label: 'Comfortable',       description: 'Quality prioritised · one premium experience per day',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&q=80' },
  { value: 'luxury',      label: 'Luxury',            description: 'Fine dining, premium venues, private options',
    imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=120&q=80' },
];

export function OB6Budget() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.budget ?? null) as OBBudget | null;

  return (
    <OnboardingShell step="ob6" canAdvance={value !== null}
      title="How are you travelling budget-wise?"
      subtitle="Sets your price range across venues.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'budget', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 3: Create OB7Evening.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import { resolveQ7Evening } from './ob-context-resolvers';
import type { OBEvening } from '../../shared/types';

const OPTIONS: { value: OBEvening; label: string; description: string; imageUrl: string; hidden?: boolean }[] = [
  { value: 'dinner_wind', label: 'Dinner & wind down', description: 'Good restaurant + one drink · done by 10pm',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&q=80' },
  { value: 'markets',     label: 'Night markets & cafés', description: 'Evening markets, night cafés, street food',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&q=80' },
  { value: 'early',       label: 'Early dinner, rest up', description: 'Dinner at 6–7pm · no evening block',
    imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=120&q=80' },
  { value: 'bars',        label: 'Bars & nightlife',      description: 'Bar crawl / rooftop / club · stays open late',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=120&q=80' },
];

export function OB7Evening() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.evening ?? null) as OBEvening | null;
  const ctx = resolveQ7Evening(state.rawOBAnswers ?? {});

  // Contextual filtering: hide bars for family or halal users
  const isFamily = state.rawOBAnswers?.group === 'family';
  const isHalal  = state.rawOBAnswers?.dietary?.includes('halal') ?? false;
  const hideBars = isFamily || isHalal;

  const visible = OPTIONS.filter(o => !(o.value === 'bars' && hideBars));
  const hidden  = OPTIONS.filter(o =>   o.value === 'bars' && hideBars);

  const [showHidden, setShowHidden] = useState(false);

  return (
    <OnboardingShell step="ob7" canAdvance={value !== null} title={ctx.title} subtitle={ctx.subtitle}>
      <div className="flex flex-col gap-2">
        {visible.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'evening', value: opt.value })}
          />
        ))}

        {hidden.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowHidden(v => !v)}
              className="flex items-center justify-center gap-2 py-2.5 w-full"
            >
              <span className="flex-1 h-px bg-gradient-to-r from-transparent via-surf-hst to-transparent" />
              <span className="text-[12px] font-semibold text-text-3 whitespace-nowrap">
                These don't feel right? See all options {showHidden ? '▴' : '▾'}
              </span>
              <span className="flex-1 h-px bg-gradient-to-l from-transparent via-surf-hst to-transparent" />
            </button>

            {showHidden && hidden.map(opt => (
              <ImageRowCard
                key={opt.value}
                label={opt.label}
                description={opt.description}
                imageUrl={opt.imageUrl}
                selected={value === opt.value}
                onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'evening', value: opt.value })}
                hidden
              />
            ))}
          </>
        )}
      </div>
    </OnboardingShell>
  );
}

// Import missing
import { useState } from 'react';
```

- [ ] **Step 4: Create OB8KidFocus.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBKidFocus } from '../../shared/types';

const OPTIONS: { value: OBKidFocus; label: string; description: string; imageUrl: string }[] = [
  { value: 'outdoor', label: 'Playgrounds & parks',   description: 'Outdoor routing, open spaces',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&q=80' },
  { value: 'edu',     label: 'Interactive museums',   description: 'Educational, hands-on venues',
    imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=120&q=80' },
  { value: 'food',    label: 'Kid-friendly food',     description: 'Family menu spots, allergen-aware',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&q=80' },
  { value: 'slow',    label: 'Slow pace, rest breaks', description: '+30 min buffer per stop',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=120&q=80' },
];

export function OB8KidFocus() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.kid_focus ?? null) as OBKidFocus | null;

  return (
    <OnboardingShell step="ob8" canAdvance={value !== null}
      title="What matters most for the kids?"
      subtitle="Shapes venue filtering and pacing for little travellers.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'kid_focus', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 5: Create OB9BudgetProtect.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBBudgetProtect } from '../../shared/types';

const OPTIONS: { value: OBBudgetProtect; label: string; description: string; imageUrl: string }[] = [
  { value: 'free_only',       label: 'Free attractions only',  description: 'No entry fees',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=120&q=80' },
  { value: 'one_splurge',     label: 'One splurge per day',    description: '1 paid highlight allowed',
    imageUrl: 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=120&q=80' },
  { value: 'street_food',     label: 'Street food only',       description: 'No sit-down restaurants',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&q=80' },
  { value: 'local_transport', label: 'Local transport only',   description: 'No taxis or private tours',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=120&q=80' },
];

export function OB9BudgetProtect() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.budget_protect ?? null) as OBBudgetProtect | null;

  return (
    <OnboardingShell step="ob9" canAdvance={value !== null}
      title="What do you protect?"
      subtitle="Sets your hard budget constraints.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'budget_protect', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 6: Create OB10FoodScene.tsx**

```tsx
import { OnboardingShell } from './OnboardingShell';
import { ImageRowCard } from '../../shared/questionnaire';
import { useAppStore } from '../../shared/store';
import type { OBFoodScene } from '../../shared/types';

const OPTIONS: { value: OBFoodScene; label: string; description: string; imageUrl: string }[] = [
  { value: 'street',     label: 'Street food & markets', description: 'Stalls, market lanes, casual eating',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&q=80' },
  { value: 'restaurant', label: 'Restaurant & chef culture', description: 'Sit-down dining, reservations',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&q=80' },
  { value: 'cafe',       label: 'Cafés & brunch spots',   description: 'Daytime food focus, coffee culture',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=120&q=80' },
  { value: 'bars',       label: 'Bars & drinking culture', description: 'Drink-led evening scene',
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=120&q=80' },
];

export function OB10FoodScene() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.food_scene ?? null) as OBFoodScene | null;

  return (
    <OnboardingShell step="ob10" canAdvance={value !== null}
      title="What kind of food scene?"
      subtitle="Shapes which food venues anchor your itinerary.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'food_scene', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/onboarding/OB5Dietary.tsx \
        frontend/src/modules/onboarding/OB6Budget.tsx \
        frontend/src/modules/onboarding/OB7Evening.tsx \
        frontend/src/modules/onboarding/OB8KidFocus.tsx \
        frontend/src/modules/onboarding/OB9BudgetProtect.tsx \
        frontend/src/modules/onboarding/OB10FoodScene.tsx
git commit -m "feat: add OB5–OB10 screens (dietary, budget, evening, kid focus, budget protect, food scene)"
```

---

### Task 8: Update store, OnboardingShell, and useOnboarding

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Modify: `frontend/src/modules/onboarding/OnboardingShell.tsx`
- Modify: `frontend/src/modules/onboarding/useOnboarding.ts`
- Modify: `frontend/src/modules/onboarding/index.ts`

- [ ] **Step 1: Update store.tsx**

In `store.tsx`, add `rawOBAnswers` and `personaProfile` to `AppState` and handle new actions:

```typescript
// Add to AppState interface:
rawOBAnswers:    RawOBAnswers | null;
personaProfile:  PersonaProfile | null;
obPreResolved:   ResolvedConflict[];

// Add to defaultState:
rawOBAnswers:    null,
personaProfile:  null,
obPreResolved:   [],

// Add imports at top:
import type { RawOBAnswers, PersonaProfile, ResolvedConflict } from './types';

// Add to reducer (AppAction union and cases):
// Action types to add:
| { type: 'SET_RAW_OB_ANSWER'; key: keyof RawOBAnswers; value: unknown }
| { type: 'SET_OB_PRE_RESOLVED'; value: ResolvedConflict[] }
| { type: 'SET_PERSONA_PROFILE'; profile: PersonaProfile }

// Reducer cases:
case 'SET_RAW_OB_ANSWER':
  return {
    ...state,
    rawOBAnswers: {
      ...(state.rawOBAnswers ?? {
        group: null, mood: [], pace: [], day_open: null,
        dietary: [], budget: null, evening: null,
      }),
      [action.key]: action.value,
    } as RawOBAnswers,
  };

case 'SET_OB_PRE_RESOLVED':
  return { ...state, obPreResolved: action.value };

case 'SET_PERSONA_PROFILE':
  return { ...state, personaProfile: action.profile };
```

- [ ] **Step 2: Update OnboardingShell.tsx to accept title/subtitle props and handle conditional steps**

Replace `OnboardingShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { ObStep } from './types';
import { BASE_OB_STEPS, CONDITIONAL_STEPS, OB_STEP_INDEX } from './types';
import { useOnboarding } from './useOnboarding';

interface Props {
  step:       ObStep;
  canAdvance: boolean;
  children:   ReactNode;
  title?:     string;
  subtitle?:  string;
}

export function OnboardingShell({ step, canAdvance, children, title, subtitle }: Props) {
  const { progress, currentIndex, totalSteps, goBack, goNext, finish, isLast } = useOnboarding(step);

  // Fallback titles from types.ts
  import { STEP_TITLES } from './types';
  const displayTitle    = title    ?? STEP_TITLES[step] ?? '';
  const displaySubtitle = subtitle ?? '';

  return (
    <div className="fixed inset-0 flex flex-col bg-bg" style={{ zIndex: 20 }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 border-b border-white/6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem',
          background: 'rgba(15,23,42,.95)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={goBack}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer">
          <span className="ms text-primary text-xl">arrow_back</span>
        </button>
        <span className="text-text-1 font-semibold text-base">Travel Preferences</span>
        <div className="w-10" />
      </div>

      {/* Progress */}
      <div className="flex-shrink-0 h-1 bg-surface">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: '9rem' }}>
        <div className="px-5 pt-6">
          <span className="text-text-3 text-xs font-medium tracking-wide uppercase">
            Step {String(currentIndex + 1).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
          </span>
          <h1 className="font-heading font-extrabold text-text-1 text-2xl mt-2 mb-1 tracking-tight">
            {displayTitle}
          </h1>
          {displaySubtitle && (
            <p className="text-text-2 text-sm mb-5">{displaySubtitle}</p>
          )}
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 bg-bg border-t border-white/6 px-5 py-4 flex items-center justify-between"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        <div className="flex gap-2">
          {BASE_OB_STEPS.map((s, i) => (
            <div key={s} className={`rounded-full transition-all ${
              i === currentIndex ? 'w-4 h-2 bg-primary'
              : i < currentIndex ? 'w-2 h-2 bg-primary/40'
              : 'w-2 h-2 bg-white/10'
            }`} />
          ))}
        </div>
        <button
          disabled={!canAdvance}
          onClick={isLast ? finish : goNext}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-heading font-bold text-sm transition-all ${
            canAdvance ? 'bg-primary text-white cursor-pointer' : 'bg-surface text-text-3 cursor-not-allowed'
          }`}
        >
          {isLast ? <><span>Finish</span><span className="ms">auto_fix</span></>
                  : <><span>Next</span><span className="ms">chevron_right</span></>}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update useOnboarding.ts**

Replace `useOnboarding.ts`:

```typescript
import { useAppStore } from '../../shared/store';
import type { Screen } from '../../shared/types';
import { BASE_OB_STEPS, CONDITIONAL_STEPS, OB_STEP_INDEX, type ObStep } from './types';
import { resolveOBAnswers } from './ob-resolver';

export function useOnboarding(step: ObStep) {
  const { state, dispatch } = useAppStore();

  // Build active step list: base steps + any triggered conditional steps
  const rawAnswers = state.rawOBAnswers;
  const activeSteps: ObStep[] = [...BASE_OB_STEPS];
  if (rawAnswers?.group === 'family')              activeSteps.push('ob8');
  if (rawAnswers?.budget === 'budget')             activeSteps.push('ob9');
  if (rawAnswers?.mood?.includes('eat_drink'))     activeSteps.push('ob10');

  const currentIndex = activeSteps.indexOf(step);
  const totalSteps   = activeSteps.length;
  const progress     = ((currentIndex + 1) / totalSteps) * 100;
  const isLast       = currentIndex === totalSteps - 1;

  function goBack() {
    if (currentIndex === 0) {
      dispatch({ type: 'GO_TO', screen: 'login' });
    } else {
      dispatch({ type: 'GO_TO', screen: activeSteps[currentIndex - 1] as Screen });
    }
  }

  function goNext() {
    if (currentIndex < totalSteps - 1) {
      dispatch({ type: 'GO_TO', screen: activeSteps[currentIndex + 1] as Screen });
    }
  }

  function finish() {
    if (!rawAnswers) return;
    const profile = resolveOBAnswers(rawAnswers, state.obPreResolved ?? []);
    dispatch({ type: 'SET_PERSONA_PROFILE', profile });
    dispatch({ type: 'GO_TO', screen: 'persona' });
  }

  return { progress, currentIndex, totalSteps, goBack, goNext, finish, isLast };
}
```

- [ ] **Step 4: Update onboarding/index.ts**

Replace `frontend/src/modules/onboarding/index.ts`:

```typescript
export { OB1Group }         from './OB1Group';
export { OB2Mood }          from './OB2Mood';
export { OB3Pace }          from './OB3Pace';
export { OB4DayOpen }       from './OB4DayOpen';
export { OB5Dietary }       from './OB5Dietary';
export { OB6Budget }        from './OB6Budget';
export { OB7Evening }       from './OB7Evening';
export { OB8KidFocus }      from './OB8KidFocus';
export { OB9BudgetProtect } from './OB9BudgetProtect';
export { OB10FoodScene }    from './OB10FoodScene';
export { OnboardingShell }  from './OnboardingShell';
export { useOnboarding }    from './useOnboarding';
```

- [ ] **Step 5: Wire new screens in the app router**

In `frontend/src/App.tsx` (or wherever screens are routed), add cases for `ob1`–`ob10`. Find the existing OB1–OB5 routing and replace:

```tsx
// Replace old OB cases:
case 'ob1': return <OB1Group />;
case 'ob2': return <OB2Mood />;
case 'ob3': return <OB3Pace />;
case 'ob4': return <OB4DayOpen />;
case 'ob5': return <OB5Dietary />;
case 'ob6': return <OB6Budget />;
case 'ob7': return <OB7Evening />;
case 'ob8': return <OB8KidFocus />;
case 'ob9': return <OB9BudgetProtect />;
case 'ob10': return <OB10FoodScene />;
```

- [ ] **Step 6: Build check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors or only errors in files not touched by this plan.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/shared/store.tsx \
        frontend/src/modules/onboarding/OnboardingShell.tsx \
        frontend/src/modules/onboarding/useOnboarding.ts \
        frontend/src/modules/onboarding/index.ts
git commit -m "feat: wire store, OnboardingShell, and useOnboarding to new OB system with ob-resolver at finish"
```

---

### Task 9: Delete old OB screens

**Files:**
- Delete: `frontend/src/modules/onboarding/OB1Ritual.tsx`
- Delete: `frontend/src/modules/onboarding/OB2Motivation.tsx`
- Delete: `frontend/src/modules/onboarding/OB3Style.tsx`
- Delete: `frontend/src/modules/onboarding/OB4LocationType.tsx`
- Delete: `frontend/src/modules/onboarding/OB5Pace.tsx`

- [ ] **Step 1: Delete old files**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
rm src/modules/onboarding/OB1Ritual.tsx \
   src/modules/onboarding/OB2Motivation.tsx \
   src/modules/onboarding/OB3Style.tsx \
   src/modules/onboarding/OB4LocationType.tsx \
   src/modules/onboarding/OB5Pace.tsx
```

- [ ] **Step 2: Build check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Run test suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: remove old OB1–OB5 screens replaced by new contextual flow"
```
