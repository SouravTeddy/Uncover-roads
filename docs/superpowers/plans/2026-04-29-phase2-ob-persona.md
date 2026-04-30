# Phase 2: Onboarding Expansion & Persona Reveal Rebuild

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the OB resolver to output a 10-dimension engine weight vector, compute archetype via cosine similarity, and rebuild the persona reveal screen with story headline + mood image + trait chips + retake button.

**Architecture:** OB questions OB4 and OB9 get new content. The resolver (`ob-resolver.ts`) gains the engine weight vector output and cosine similarity archetype resolution. PersonaScreen is rebuilt from scratch — mood image, serif headline, archetype pill, trait chips, two CTAs.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest. No new dependencies.

**Depends on:** Phase 1 complete (no blockers from Phase 1, but run tests first).

---

## File Map

```
Modified:
  frontend/src/modules/onboarding/OB4DayOpen.tsx         → replaced with movement style question
  frontend/src/modules/onboarding/OB9BudgetProtect.tsx   → replaced with spontaneity question
  frontend/src/modules/onboarding/ob-resolver.ts         → add engine weight vector output
  frontend/src/modules/onboarding/ob-conflict-map.ts     → add new weight mappings
  frontend/src/modules/onboarding/types.ts               → add ObStep crowd_aversion to OB2
  frontend/src/modules/onboarding/OB2Mood.tsx            → add crowd aversion sub-question
  frontend/src/shared/types.ts                           → add EngineWeights, update PersonaProfile

Created:
  frontend/src/modules/persona/PersonaScreen.tsx         → full rebuild (delete old)
  frontend/src/modules/onboarding/ob-resolver.test.ts    → new tests for weight vector

Unchanged:
  OB1Group, OB3Pace, OB5Dietary, OB6Budget, OB7Evening, OB8KidFocus
  OnboardingShell, useOnboarding, ob-conflict-map (hard conflicts unchanged)
```

---

## Task 1: Add EngineWeights and updated PersonaProfile to shared types

**Files:**
- Modify: `frontend/src/shared/types.ts`

- [ ] **Step 1: Write failing test for new type shape**

Create `frontend/src/modules/onboarding/ob-resolver.test.ts` (new file, add to existing if it exists):
```typescript
import { describe, it, expect } from 'vitest'
import { resolveOBAnswers } from './ob-resolver'
import type { RawOBAnswers } from '../../shared/types'

const BASE_ANSWERS: RawOBAnswers = {
  group: 'solo',
  mood: ['explore'],
  pace: ['balanced'],
  movement: 'mixed',
  dietary: ['none'],
  budget: 'mid_range',
  evening: 'dinner_wind',
  crowd_aversion: 'sometimes',
  spontaneity: 'sometimes',
}

describe('resolveOBAnswers — engine weight vector', () => {
  it('returns engine_weights with all 10 dimensions', () => {
    const profile = resolveOBAnswers(BASE_ANSWERS)
    expect(profile.engine_weights).toBeDefined()
    const w = profile.engine_weights!
    expect(typeof w.w_walk_affinity).toBe('number')
    expect(typeof w.w_scenic).toBe('number')
    expect(typeof w.w_efficiency).toBe('number')
    expect(typeof w.w_food_density).toBe('number')
    expect(typeof w.w_culture_depth).toBe('number')
    expect(typeof w.w_nightlife).toBe('number')
    expect(typeof w.w_budget_sensitivity).toBe('number')
    expect(typeof w.w_crowd_aversion).toBe('number')
    expect(typeof w.w_spontaneity).toBe('number')
    expect(typeof w.w_rest_need).toBe('number')
  })

  it('all weight values are between 0 and 1', () => {
    const profile = resolveOBAnswers(BASE_ANSWERS)
    const weights = Object.values(profile.engine_weights!)
    weights.forEach(w => {
      expect(w).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThanOrEqual(1)
    })
  })

  it('resolves archetype via cosine similarity (not hardcoded)', () => {
    // Walker + scenic + slow → should be wanderer or slowtraveller
    const walkerAnswers: RawOBAnswers = {
      ...BASE_ANSWERS,
      movement: 'walk_first',
      pace: ['slow'],
      crowd_aversion: 'actively_avoid',
      spontaneity: 'always',
    }
    const profile = resolveOBAnswers(walkerAnswers)
    expect(['wanderer', 'slowtraveller', 'explorer']).toContain(profile.archetype)
  })

  it('packs-it-in + efficient → voyager or pulse', () => {
    const efficientAnswers: RawOBAnswers = {
      ...BASE_ANSWERS,
      movement: 'transit_first',
      pace: ['pack'],
      evening: 'bars',
      spontaneity: 'keep_me_on_plan',
    }
    const profile = resolveOBAnswers(efficientAnswers)
    expect(['voyager', 'pulse']).toContain(profile.archetype)
  })

  it('transport_openness is set from movement answer', () => {
    const profile = resolveOBAnswers({ ...BASE_ANSWERS, movement: 'walk_first' })
    expect(profile.transport_openness).toBe('walk_first')
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/modules/onboarding/ob-resolver.test.ts
```
Expected: Multiple failures — `engine_weights`, `transport_openness` undefined

- [ ] **Step 3: Add new types to shared/types.ts**

Find `PersonaProfile` in `frontend/src/shared/types.ts`. Add new fields:

```typescript
// Add this new interface before PersonaProfile:
export interface EngineWeights {
  w_walk_affinity: number      // 0–1
  w_scenic: number             // 0–1
  w_efficiency: number         // 0–1
  w_food_density: number       // 0–1
  w_culture_depth: number      // 0–1
  w_nightlife: number          // 0–1
  w_budget_sensitivity: number // 0–1
  w_crowd_aversion: number     // 0–1
  w_spontaneity: number        // 0–1
  w_rest_need: number          // 0–1
}

export type TransportOpenness = 'walk_first' | 'mixed' | 'transit_first' | 'comfort_first'
export type MobilityLevel = 'full' | 'moderate' | 'limited'
export type OBMovement = 'walk_first' | 'mixed' | 'transit_first' | 'comfort_first'
export type OBSpontaneity = 'always' | 'sometimes' | 'if_no_time_added' | 'keep_me_on_plan'
export type OBCrowdAversion = 'love_them' | 'fine_if_worth_it' | 'prefer_quieter' | 'actively_avoid'
```

Find `RawOBAnswers` in `types.ts` and add:
```typescript
// Add these fields to RawOBAnswers interface:
movement?: OBMovement
spontaneity?: OBSpontaneity
crowd_aversion?: OBCrowdAversion
```

Find `PersonaProfile` interface and add:
```typescript
// Add these fields to PersonaProfile:
engine_weights?: EngineWeights
transport_openness?: TransportOpenness
mobility_level?: MobilityLevel
```

- [ ] **Step 4: Commit type additions**

```bash
git add frontend/src/shared/types.ts
git commit -m "feat: add EngineWeights, OBMovement, OBSpontaneity, OBCrowdAversion types"
```

---

## Task 2: Expand ob-resolver to output engine weight vector

**Files:**
- Modify: `frontend/src/modules/onboarding/ob-resolver.ts`
- Modify: `frontend/src/modules/onboarding/ob-conflict-map.ts`

- [ ] **Step 1: Add weight mappings to ob-conflict-map.ts**

At the bottom of `frontend/src/modules/onboarding/ob-conflict-map.ts`, add:

```typescript
// ── Engine weight vectors per answer ──────────────────────────

export const MOVEMENT_WEIGHTS: Record<string, Partial<EngineWeightsPartial>> = {
  walk_first:    { w_walk_affinity: 0.95, w_scenic: 0.8,  w_efficiency: 0.2 },
  mixed:         { w_walk_affinity: 0.60, w_scenic: 0.5,  w_efficiency: 0.5 },
  transit_first: { w_walk_affinity: 0.30, w_scenic: 0.3,  w_efficiency: 0.8 },
  comfort_first: { w_walk_affinity: 0.15, w_scenic: 0.2,  w_efficiency: 0.9 },
}

export const SPONTANEITY_WEIGHTS: Record<string, number> = {
  always:              1.0,
  sometimes:           0.6,
  if_no_time_added:    0.3,
  keep_me_on_plan:     0.0,
}

export const CROWD_AVERSION_WEIGHTS: Record<string, number> = {
  love_them:       0.1,
  fine_if_worth_it: 0.4,
  prefer_quieter:  0.7,
  actively_avoid:  0.95,
}

export const PACE_ENGINE_WEIGHTS: Record<string, Partial<EngineWeightsPartial>> = {
  slow:        { w_efficiency: 0.1, w_rest_need: 0.9, w_culture_depth: 0.7 },
  balanced:    { w_efficiency: 0.5, w_rest_need: 0.5, w_culture_depth: 0.5 },
  pack:        { w_efficiency: 0.9, w_rest_need: 0.1, w_culture_depth: 0.3 },
  spontaneous: { w_efficiency: 0.2, w_rest_need: 0.5, w_scenic: 0.8 },
}

export const MOOD_ENGINE_WEIGHTS: Record<string, Partial<EngineWeightsPartial>> = {
  explore:   { w_scenic: 0.8,  w_culture_depth: 0.5 },
  relax:     { w_rest_need: 0.9, w_scenic: 0.6 },
  eat_drink: { w_food_density: 1.0 },
  culture:   { w_culture_depth: 1.0, w_scenic: 0.4 },
}

export const EVENING_ENGINE_WEIGHTS: Record<string, number> = {
  bars:        1.0,  // w_nightlife
  markets:     0.6,
  dinner_wind: 0.3,
  early:       0.0,
}

export const BUDGET_ENGINE_WEIGHTS: Record<string, number> = {
  budget:      1.0,  // w_budget_sensitivity
  mid_range:   0.5,
  comfortable: 0.2,
  luxury:      0.0,
}

// Reference vectors for archetype cosine similarity
// Order: [walk, scenic, efficiency, food, culture, nightlife, budget, crowd, spontaneity, rest]
export const ARCHETYPE_VECTORS: Record<string, number[]> = {
  wanderer:      [0.9, 0.95, 0.2, 0.6, 0.7, 0.4, 0.5, 0.8, 0.97, 0.6],
  historian:     [0.7, 0.6,  0.6, 0.4, 1.0, 0.2, 0.4, 0.7, 0.4,  0.5],
  epicurean:     [0.5, 0.4,  0.5, 1.0, 0.5, 0.6, 0.3, 0.4, 0.6,  0.4],
  pulse:         [0.3, 0.3,  0.8, 0.7, 0.3, 1.0, 0.5, 0.2, 0.5,  0.2],
  slowtraveller: [0.8, 0.8,  0.1, 0.7, 0.6, 0.3, 0.6, 0.9, 0.7,  0.9],
  voyager:       [0.4, 0.5,  0.9, 0.5, 0.6, 0.5, 0.7, 0.3, 0.4,  0.3],
  explorer:      [0.8, 0.7,  0.5, 0.5, 0.6, 0.4, 0.5, 0.5, 0.8,  0.5],
}

type EngineWeightsPartial = {
  w_walk_affinity: number
  w_scenic: number
  w_efficiency: number
  w_food_density: number
  w_culture_depth: number
  w_nightlife: number
  w_budget_sensitivity: number
  w_crowd_aversion: number
  w_spontaneity: number
  w_rest_need: number
}
```

- [ ] **Step 2: Add engine weight resolution to ob-resolver.ts**

At the top of `ob-resolver.ts`, add imports:
```typescript
import {
  MOVEMENT_WEIGHTS,
  SPONTANEITY_WEIGHTS,
  CROWD_AVERSION_WEIGHTS,
  PACE_ENGINE_WEIGHTS,
  MOOD_ENGINE_WEIGHTS,
  EVENING_ENGINE_WEIGHTS,
  BUDGET_ENGINE_WEIGHTS,
  ARCHETYPE_VECTORS,
} from './ob-conflict-map'
import type { EngineWeights, TransportOpenness } from '../../shared/types'
```

Add these two functions before `resolveOBAnswers`:

```typescript
function buildEngineWeights(raw: RawOBAnswers): EngineWeights {
  // Start with defaults
  const w = {
    w_walk_affinity: 0.5,
    w_scenic: 0.5,
    w_efficiency: 0.5,
    w_food_density: 0.5,
    w_culture_depth: 0.5,
    w_nightlife: 0.3,
    w_budget_sensitivity: 0.5,
    w_crowd_aversion: 0.4,
    w_spontaneity: 0.5,
    w_rest_need: 0.5,
  }

  // Apply movement weights (OB4)
  const movementW = MOVEMENT_WEIGHTS[raw.movement ?? 'mixed'] ?? {}
  Object.assign(w, movementW)

  // Apply pace weights (OB3) — primary pace choice
  const primaryPace = raw.pace[0] ?? 'balanced'
  const paceW = PACE_ENGINE_WEIGHTS[primaryPace] ?? {}
  Object.assign(w, paceW)

  // Apply mood weights (OB2) — decay first choice most
  const moodDecay = [1.0, 0.4, 0.2]
  for (let i = 0; i < raw.mood.length; i++) {
    const moodW = MOOD_ENGINE_WEIGHTS[raw.mood[i]] ?? {}
    const decay = moodDecay[Math.min(i, 2)]
    for (const [key, val] of Object.entries(moodW)) {
      w[key as keyof typeof w] = Math.min(1, w[key as keyof typeof w] + (val as number) * decay * 0.3)
    }
  }

  // Apply crowd aversion (OB2 sub-question)
  w.w_crowd_aversion = CROWD_AVERSION_WEIGHTS[raw.crowd_aversion ?? 'fine_if_worth_it']

  // Apply spontaneity (OB9)
  w.w_spontaneity = SPONTANEITY_WEIGHTS[raw.spontaneity ?? 'sometimes']

  // Apply nightlife from evening choice (OB7)
  w.w_nightlife = EVENING_ENGINE_WEIGHTS[raw.evening ?? 'dinner_wind']

  // Apply budget sensitivity (OB6)
  w.w_budget_sensitivity = BUDGET_ENGINE_WEIGHTS[raw.budget ?? 'mid_range']

  // Clamp all values to [0, 1]
  for (const key of Object.keys(w) as (keyof typeof w)[]) {
    w[key] = Math.max(0, Math.min(1, w[key]))
  }

  return w
}

function resolveArchetype(weights: EngineWeights): string {
  const userVec = [
    weights.w_walk_affinity,
    weights.w_scenic,
    weights.w_efficiency,
    weights.w_food_density,
    weights.w_culture_depth,
    weights.w_nightlife,
    weights.w_budget_sensitivity,
    weights.w_crowd_aversion,
    weights.w_spontaneity,
    weights.w_rest_need,
  ]

  const magnitude = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  const userMag = magnitude(userVec)

  let bestArchetype = 'wanderer'
  let bestScore = -1

  for (const [archetypeId, archetypeVec] of Object.entries(ARCHETYPE_VECTORS)) {
    const dot = archetypeVec.reduce((s, v, i) => s + v * userVec[i], 0)
    const score = dot / (magnitude(archetypeVec) * userMag)
    if (score > bestScore) {
      bestScore = score
      bestArchetype = archetypeId
    }
  }

  return bestArchetype
}
```

In `resolveOBAnswers`, add engine weights and update archetype:
```typescript
export function resolveOBAnswers(
  raw: RawOBAnswers,
  preResolved: ResolvedConflict[] = []
): PersonaProfile {
  // ... existing conflict resolution and weight computation ...

  const engine_weights = buildEngineWeights(raw)
  const archetype = resolveArchetype(engine_weights)  // replaces hardcoded 'wanderer'

  const profile: PersonaProfile = {
    // ... all existing fields ...
    archetype,          // now computed, not hardcoded
    engine_weights,     // new field
    transport_openness: (raw.movement ?? 'mixed') as TransportOpenness,
  }

  return profile
}
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npx vitest run src/modules/onboarding/ob-resolver.test.ts
```
Expected: all new tests PASS

- [ ] **Step 4: Run full suite to check no regressions**

```bash
cd frontend && npx vitest run
```
Expected: 649+ passing, 0 failing

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/onboarding/ob-resolver.ts \
        frontend/src/modules/onboarding/ob-conflict-map.ts \
        frontend/src/modules/onboarding/ob-resolver.test.ts
git commit -m "feat: add 10-dimension engine weight vector to OB resolver, cosine similarity archetype"
```

---

## Task 3: Replace OB4 with movement style question

**Files:**
- Modify: `frontend/src/modules/onboarding/OB4DayOpen.tsx`

- [ ] **Step 1: Write test**

Create `frontend/src/modules/onboarding/OB4Movement.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OB4Movement } from './OB4DayOpen'
import { AppStoreProvider } from '../../shared/store'

function wrap(ui: React.ReactElement) {
  return render(<AppStoreProvider>{ui}</AppStoreProvider>)
}

describe('OB4Movement', () => {
  it('renders all 4 movement options', () => {
    wrap(<OB4Movement />)
    expect(screen.getByText('On foot, always')).toBeInTheDocument()
    expect(screen.getByText('Mix of walking and transit')).toBeInTheDocument()
    expect(screen.getByText('Transit first')).toBeInTheDocument()
    expect(screen.getByText('Comfort first')).toBeInTheDocument()
  })

  it('cannot advance without selection', () => {
    wrap(<OB4Movement />)
    const nextBtn = screen.queryByRole('button', { name: /next|continue/i })
    // canAdvance=false means button is disabled
    expect(nextBtn).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd frontend && npx vitest run src/modules/onboarding/OB4Movement.test.tsx
```

- [ ] **Step 3: Replace OB4DayOpen.tsx content**

Replace entire `frontend/src/modules/onboarding/OB4DayOpen.tsx`:
```typescript
import { OnboardingShell } from './OnboardingShell'
import { ImageRowCard } from '../../shared/questionnaire'
import { useAppStore } from '../../shared/store'
import type { OBMovement } from '../../shared/types'

const OPTIONS: { value: OBMovement; label: string; description: string; imageUrl: string }[] = [
  {
    value: 'walk_first',
    label: 'On foot, always',
    description: "I'll walk anywhere — scenic routes over shortcuts",
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=120&q=80',
  },
  {
    value: 'mixed',
    label: 'Mix of walking and transit',
    description: 'Walk when it makes sense, metro when it doesn\'t',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=120&q=80',
  },
  {
    value: 'transit_first',
    label: 'Transit first',
    description: 'Metro and bus — short walks between stops',
    imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=120&q=80',
  },
  {
    value: 'comfort_first',
    label: 'Comfort first',
    description: 'Taxi or rideshare when needed — no suffering for it',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=120&q=80',
  },
]

// Export both names so tests using either work
export function OB4Movement() {
  const { state, dispatch } = useAppStore()
  const value = (state.rawOBAnswers?.movement ?? null) as OBMovement | null

  function handleChange(v: OBMovement) {
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'movement', value: v })
  }

  return (
    <OnboardingShell step="ob4" canAdvance={value !== null}
      title="How do you move through a city?"
      subtitle="Shapes routing, walk recommendations and transit suggestions.">
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
  )
}

// Keep old export name to avoid breaking OnboardingShell's step routing
export { OB4Movement as OB4DayOpen }
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/modules/onboarding/OB4Movement.test.tsx
cd frontend && npx vitest run  # full suite
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/onboarding/OB4DayOpen.tsx \
        frontend/src/modules/onboarding/OB4Movement.test.tsx
git commit -m "feat: replace OB4 morning ritual with movement style question"
```

---

## Task 4: Replace OB9 with spontaneity question

**Files:**
- Modify: `frontend/src/modules/onboarding/OB9BudgetProtect.tsx`
- Modify: `frontend/src/modules/onboarding/OnboardingShell.tsx` (update step trigger)

- [ ] **Step 1: Write test**

Create `frontend/src/modules/onboarding/OB9Spontaneity.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OB9Spontaneity } from './OB9BudgetProtect'
import { AppStoreProvider } from '../../shared/store'

function wrap(ui: React.ReactElement) {
  return render(<AppStoreProvider>{ui}</AppStoreProvider>)
}

describe('OB9Spontaneity', () => {
  it('renders all 4 spontaneity options', () => {
    wrap(<OB9Spontaneity />)
    expect(screen.getByText(/always/i)).toBeInTheDocument()
    expect(screen.getByText(/sometimes/i)).toBeInTheDocument()
    expect(screen.getByText(/no time added/i)).toBeInTheDocument()
    expect(screen.getByText(/keep me on/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Replace OB9BudgetProtect.tsx**

```typescript
import { OnboardingShell } from './OnboardingShell'
import { ImageRowCard } from '../../shared/questionnaire'
import { useAppStore } from '../../shared/store'
import type { OBSpontaneity } from '../../shared/types'

const OPTIONS: { value: OBSpontaneity; label: string; description: string; imageUrl: string }[] = [
  {
    value: 'always',
    label: 'Always — I love detours',
    description: 'If something great is nearby, tell me every time',
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=120&q=80',
  },
  {
    value: 'sometimes',
    label: 'Sometimes — if it fits the day',
    description: "Suggest it when it makes sense, skip it when I'm rushed",
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=120&q=80',
  },
  {
    value: 'if_no_time_added',
    label: 'Only if it adds no time',
    description: "Show me things on the way — nothing that adds to the day",
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=120&q=80',
  },
  {
    value: 'keep_me_on_plan',
    label: 'Keep me on the plan',
    description: "I planned this trip — stick to it",
    imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=120&q=80',
  },
]

export function OB9Spontaneity() {
  const { state, dispatch } = useAppStore()
  const value = (state.rawOBAnswers?.spontaneity ?? null) as OBSpontaneity | null

  return (
    <OnboardingShell step="ob9" canAdvance={value !== null}
      title="If we spot something great along the way, should we tell you?"
      subtitle="Controls how often we suggest detours and spontaneous additions.">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(opt => (
          <ImageRowCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            imageUrl={opt.imageUrl}
            selected={value === opt.value}
            onSelect={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'spontaneity', value: opt.value })}
          />
        ))}
      </div>
    </OnboardingShell>
  )
}

export { OB9Spontaneity as OB9BudgetProtect }
```

- [ ] **Step 3: Update OB step routing in types.ts**

In `frontend/src/modules/onboarding/types.ts`, update `CONDITIONAL_STEPS`:
```typescript
// OB9 is now universal — shown to everyone, not just budget users
// Remove budget condition, OB8 stays conditional on family
export const CONDITIONAL_STEPS: Record<string, ObStep> = {
  family: 'ob8',
  // ob9 (spontaneity) is now always shown — remove budget condition
}
// OB9 is added to BASE_OB_STEPS:
export const BASE_OB_STEPS: ObStep[] = ['ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7', 'ob9']
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run
```
Expected: 649+ passing

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/onboarding/OB9BudgetProtect.tsx \
        frontend/src/modules/onboarding/OB9Spontaneity.test.tsx \
        frontend/src/modules/onboarding/types.ts
git commit -m "feat: replace OB9 budget-protect with universal spontaneity question"
```

---

## Task 5: Add crowd aversion sub-question to OB2

**Files:**
- Modify: `frontend/src/modules/onboarding/OB2Mood.tsx`

- [ ] **Step 1: Write test**

Add to existing OB2 test or create `frontend/src/modules/onboarding/OB2Mood.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OB2Mood } from './OB2Mood'
import { AppStoreProvider } from '../../shared/store'

function wrap(ui: React.ReactElement) {
  return render(<AppStoreProvider>{ui}</AppStoreProvider>)
}

describe('OB2Mood', () => {
  it('renders mood options', () => {
    wrap(<OB2Mood />)
    expect(screen.getByText(/explore/i)).toBeInTheDocument()
    expect(screen.getByText(/relax/i)).toBeInTheDocument()
  })

  it('shows crowd aversion question after mood selection', async () => {
    const { getByText } = wrap(<OB2Mood />)
    fireEvent.click(getByText('Explore & discover'))
    // After selection, crowd question should appear
    expect(screen.getByText(/popular spots/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Add crowd aversion to OB2Mood.tsx**

After the mood selection cards, add a conditional crowd aversion section:

```typescript
// Add to OB2Mood.tsx — after the existing mood card list:

const CROWD_OPTIONS: { value: OBCrowdAversion; label: string; description: string }[] = [
  { value: 'love_them',       label: 'Love them',            description: 'Tourist spots exist for a reason' },
  { value: 'fine_if_worth_it', label: 'Fine if worth it',   description: 'Popular is OK when the place earns it' },
  { value: 'prefer_quieter',  label: 'Prefer quieter spots', description: 'Given a choice, I go where it\'s calmer' },
  { value: 'actively_avoid',  label: 'Actively avoid crowds', description: 'Crowds ruin the experience for me' },
]

// Inside OB2Mood component, after existing state:
const crowdValue = (state.rawOBAnswers?.crowd_aversion ?? null) as OBCrowdAversion | null
const showCrowdQuestion = values.length > 0

// canAdvance needs crowd selection too:
// canAdvance={values.length > 0 && crowdValue !== null}

// After existing OPTIONS map, add:
{showCrowdQuestion && (
  <div className="mt-4 pt-4 border-t border-surf-hst">
    <p className="text-sm font-semibold text-text-2 mb-3">
      How do you feel about popular spots?
    </p>
    <div className="flex flex-col gap-2">
      {CROWD_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'crowd_aversion', value: opt.value })}
          className={[
            'text-left px-4 py-3 rounded-xl border transition-colors',
            crowdValue === opt.value
              ? 'border-primary bg-primary/10 text-text-1'
              : 'border-surf-hst bg-surface text-text-2 hover:border-primary/50',
          ].join(' ')}
        >
          <div className="text-sm font-semibold">{opt.label}</div>
          <div className="text-xs text-text-3 mt-0.5">{opt.description}</div>
        </button>
      ))}
    </div>
  </div>
)}
```

Also add `OBCrowdAversion` import at top of file.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/onboarding/OB2Mood.tsx \
        frontend/src/modules/onboarding/OB2Mood.test.tsx
git commit -m "feat: add crowd aversion sub-question to OB2 mood step"
```

---

## Task 6: Rebuild PersonaScreen

**Files:**
- Modify: `frontend/src/modules/persona/PersonaScreen.tsx` (full rebuild)

- [ ] **Step 1: Write tests**

Create `frontend/src/modules/persona/PersonaScreen.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PersonaScreen } from './PersonaScreen'
import { AppStoreProvider } from '../../shared/store'

const mockDispatch = vi.fn()
vi.mock('../../shared/store', async () => {
  const actual = await vi.importActual('../../shared/store')
  return {
    ...actual,
    useAppStore: () => ({
      state: {
        persona: {
          archetype: 'wanderer',
          engine_weights: {
            w_walk_affinity: 0.9, w_scenic: 0.95, w_efficiency: 0.2,
            w_food_density: 0.6, w_culture_depth: 0.7, w_nightlife: 0.4,
            w_budget_sensitivity: 0.5, w_crowd_aversion: 0.8, w_spontaneity: 0.97, w_rest_need: 0.6
          }
        }
      },
      dispatch: mockDispatch
    })
  }
})

describe('PersonaScreen', () => {
  it('renders archetype name', () => {
    render(<AppStoreProvider><PersonaScreen /></AppStoreProvider>)
    expect(screen.getByText(/wanderer/i)).toBeInTheDocument()
  })

  it('renders See your map CTA', () => {
    render(<AppStoreProvider><PersonaScreen /></AppStoreProvider>)
    expect(screen.getByText(/see your map/i)).toBeInTheDocument()
  })

  it('renders retake button', () => {
    render(<AppStoreProvider><PersonaScreen /></AppStoreProvider>)
    expect(screen.getByText(/retake/i)).toBeInTheDocument()
  })

  it('retake button dispatches to ob1', () => {
    render(<AppStoreProvider><PersonaScreen /></AppStoreProvider>)
    fireEvent.click(screen.getByText(/retake/i))
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/OB|screen/i) })
    )
  })

  it('See your map navigates to destination', () => {
    render(<AppStoreProvider><PersonaScreen /></AppStoreProvider>)
    fireEvent.click(screen.getByText(/see your map/i))
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GO_TO', screen: 'destination' })
    )
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd frontend && npx vitest run src/modules/persona/PersonaScreen.test.tsx
```

- [ ] **Step 3: Rebuild PersonaScreen.tsx**

Replace entire `frontend/src/modules/persona/PersonaScreen.tsx`:

```typescript
import { useAppStore } from '../../shared/store'
import type { ArchetypeId } from '../../shared/types'

// Archetype configuration
const ARCHETYPE_CONFIG: Record<string, {
  color: string
  bg: string
  glow: string
  headline: string
  story: string
  imageUrl: string
  traits: { label: string; accent: boolean }[]
}> = {
  wanderer: {
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
    glow: 'rgba(52,211,153,0.3)',
    headline: "You don't follow\nitineraries.\nYou follow curiosity.",
    story: "You're the traveler who ends up at the right place by turning left instead of right. We've built your map around hidden gems, local rhythms, and the kind of places that don't exist on listicles.",
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    traits: [
      { label: 'Off the beaten path', accent: true },
      { label: 'Slow mornings', accent: false },
      { label: 'Local markets', accent: false },
      { label: 'Serendipity over schedule', accent: true },
      { label: 'No rush', accent: false },
    ],
  },
  historian: {
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)',
    glow: 'rgba(251,191,36,0.3)',
    headline: "Every city has a\nstory. You're here\nto read it.",
    story: "You visit places to understand them — not just to see them. We've weighted your map toward temples, ruins, museums, and the neighborhoods that shaped each city's identity.",
    imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80',
    traits: [
      { label: 'Depth over breadth', accent: true },
      { label: 'Historic sites first', accent: false },
      { label: 'Context matters', accent: false },
      { label: 'Museums, not malls', accent: true },
      { label: 'Early starts', accent: false },
    ],
  },
  epicurean: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.1)',
    glow: 'rgba(248,113,113,0.3)',
    headline: "The best way to\nknow a city is\nthrough its food.",
    story: "You plan your days around meals and discover cities through their kitchens. We've tuned your map to the markets, chefs, and neighbourhoods where the real food culture lives.",
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    traits: [
      { label: 'Food-first planning', accent: true },
      { label: 'Markets over restaurants', accent: false },
      { label: 'Street food pilgrim', accent: false },
      { label: 'Local kitchens only', accent: true },
      { label: 'Lunch is sacred', accent: false },
    ],
  },
  pulse: {
    color: '#f9a8d4',
    bg: 'rgba(249,168,212,0.1)',
    glow: 'rgba(249,168,212,0.3)',
    headline: "You want to feel\nthe city, not just\nsee it.",
    story: "Rooftops, underground bars, live shows, late-night markets. You're not a tourist — you're a participant. Your map is tuned to where things are actually happening right now.",
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80',
    traits: [
      { label: 'Nightlife & events', accent: true },
      { label: 'Rooftop bars', accent: false },
      { label: 'Live music', accent: false },
      { label: 'Where locals go', accent: true },
      { label: 'Late nights', accent: false },
    ],
  },
  slowtraveller: {
    color: '#c4b5fd',
    bg: 'rgba(196,181,253,0.1)',
    glow: 'rgba(196,181,253,0.3)',
    headline: "A place deserves\nmore than a photo\nand a tick.",
    story: "You believe the real experience starts after the crowds leave. Two stops a day, done properly, beats eight stops done badly. We've built your days around depth, comfort, and unhurried presence.",
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
    traits: [
      { label: 'Two stops, done right', accent: true },
      { label: 'Afternoon rest', accent: false },
      { label: 'Coffee ritual', accent: false },
      { label: 'No FOMO', accent: true },
      { label: 'Neighbourhood walks', accent: false },
    ],
  },
  voyager: {
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.1)',
    glow: 'rgba(96,165,250,0.3)',
    headline: "Maximum cities.\nMinimum wasted\ntime.",
    story: "You've done this before and you know what you want: tight routing, reliable picks, and no time lost on mediocre choices. We've optimised your map for coverage, efficiency, and quality signals.",
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    traits: [
      { label: 'Efficient routing', accent: true },
      { label: 'Reliable over trendy', accent: false },
      { label: 'Pre-booked', accent: false },
      { label: 'Covers the ground', accent: true },
      { label: 'Quality signals', accent: false },
    ],
  },
  explorer: {
    color: '#86efac',
    bg: 'rgba(134,239,172,0.1)',
    glow: 'rgba(134,239,172,0.3)',
    headline: "You go further\nthan anyone else\ndares to.",
    story: "You find the places that require a bit more effort — the ones that reward curiosity. We've loaded your map with the kind of discoveries that take others months to find.",
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80',
    traits: [
      { label: 'Off the map', accent: true },
      { label: 'Curious by default', accent: false },
      { label: 'Hidden paths', accent: false },
      { label: 'Effort = reward', accent: true },
      { label: 'No guidebooks', accent: false },
    ],
  },
}

export function PersonaScreen() {
  const { state, dispatch } = useAppStore()
  const archetype = (state.persona?.archetype ?? 'wanderer') as string
  const config = ARCHETYPE_CONFIG[archetype] ?? ARCHETYPE_CONFIG.wanderer

  function handleSeeMap() {
    dispatch({ type: 'GO_TO', screen: 'destination' })
  }

  function handleRetake() {
    dispatch({ type: 'CLEAR_OB_ANSWERS' })
    dispatch({ type: 'GO_TO', screen: 'ob1' })
  }

  // Split headline into lines
  const headlineLines = config.headline.split('\n')
  const lastLine = headlineLines[headlineLines.length - 1]

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Mood image — top 55% */}
      <div className="relative flex-shrink-0" style={{ height: '55%' }}>
        <img
          src={config.imageUrl}
          alt={archetype}
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.55) saturate(1.2)' }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 30%, #0a0a0f 100%)' }}
        />
        {/* Archetype badge */}
        <div className="absolute bottom-4 left-5">
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border backdrop-blur-md"
            style={{ color: config.color, borderColor: config.color, background: config.bg }}
          >
            The {archetype.charAt(0).toUpperCase() + archetype.slice(1)}
          </span>
        </div>
      </div>

      {/* Card body — bottom 45% */}
      <div className="flex-1 px-5 pb-8 pt-0 flex flex-col overflow-y-auto">
        {/* Headline */}
        <h1 className="font-serif text-[22px] font-bold leading-tight text-text-1 mb-3 mt-1">
          {headlineLines.slice(0, -1).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
          <span style={{ color: config.color }}>{lastLine}</span>
        </h1>

        {/* Story paragraph — AI generated, marked with ✦ */}
        <p className="text-[13px] text-text-3 leading-relaxed mb-5">
          {config.story}
          {' '}<span className="text-[10px] opacity-50">✦</span>
        </p>

        {/* Trait chips */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {config.traits.map(trait => (
            <span
              key={trait.label}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full border"
              style={trait.accent
                ? { color: config.color, borderColor: config.color, background: config.bg }
                : { color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.08)', background: 'transparent' }
              }
            >
              {trait.label}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          {/* Primary CTA */}
          <button
            onClick={handleSeeMap}
            className="w-full py-4 rounded-2xl text-[14px] font-bold text-[#0a0a0f] transition-transform active:scale-95"
            style={{
              background: config.color,
              boxShadow: `0 0 32px ${config.glow}`,
            }}
          >
            See your map →
          </button>

          {/* Retake button */}
          <button
            onClick={handleRetake}
            className="w-full py-3 text-[12px] font-medium text-text-3 flex items-center justify-center gap-1.5"
          >
            <span className="text-[11px]">↺</span>
            Retake questions
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add CLEAR_OB_ANSWERS action to store if missing**

In `frontend/src/shared/store.tsx`, find the reducer and add:
```typescript
case 'CLEAR_OB_ANSWERS':
  return { ...state, rawOBAnswers: null, persona: null }
```

- [ ] **Step 5: Run tests**

```bash
cd frontend && npx vitest run src/modules/persona/PersonaScreen.test.tsx
cd frontend && npx vitest run
```
Expected: all passing

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/persona/PersonaScreen.tsx \
        frontend/src/modules/persona/PersonaScreen.test.tsx \
        frontend/src/shared/store.tsx
git commit -m "feat: rebuild PersonaScreen with story headline, mood image, trait chips, retake button"
```

---

## Phase 2 Complete — Verification

- [ ] `cd frontend && npx vitest run` → 649+ passing, 0 failing
- [ ] `cd frontend && npx tsc --noEmit` → 0 errors
- [ ] Manual test: complete OB1→OB9, verify archetype shown on persona screen
- [ ] Manual test: retake button returns to OB1 with cleared answers
- [ ] Manual test: "See your map →" navigates to destination screen
- [ ] OB4 shows movement options (not morning ritual)
- [ ] OB9 shows spontaneity options (not budget protect) for all users
- [ ] OB2 shows crowd aversion question after mood selection
