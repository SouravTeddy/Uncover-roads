# OB Visual Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 9-step onboarding from a form into a visual journey — reordered questions, 5-layer illustrated background compositor, a per-answer persona silhouette, and a 3-beat persona reveal that lands surprise before recognition.

**Architecture:** Three new files handle the visual system: `ob-layers.ts` (layer configs per answer), `OBBackground.tsx` (the Framer Motion compositor), and `PersonaSilhouette.tsx` (SVG that builds up). `OnboardingShell.tsx` is modified to render in the new order with conditional kid-focus. `PersonaScreen.tsx` receives a 3-beat reveal overhaul. All visual logic is isolated from engine logic — this plan has zero overlap with ob-resolver or engine weight vector work.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion (already in project or add it), Vitest.

**Depends on:** Phase 2 complete (`ob-resolver.ts` engine weights, `PersonaScreen` base rebuild, OB content questions updated).

**Working directory:** `frontend/` within the `feature/full-ui-redesign` worktree, or main branch if Phase 2 is merged.

**Baseline:** All tests passing before starting.

---

## File Map

```
Created:
  frontend/src/modules/onboarding/ob-layers.ts          → layer state configs per OB step + answer
  frontend/src/modules/onboarding/OBBackground.tsx       → 5-layer Framer Motion compositor
  frontend/src/modules/onboarding/PersonaSilhouette.tsx  → SVG silhouette that builds per answer
  frontend/src/modules/onboarding/ob-layers.test.ts      → tests for layer resolution

Modified:
  frontend/src/modules/onboarding/OnboardingShell.tsx    → reorder steps, conditional kid-focus, add OBBackground + Silhouette
  frontend/src/modules/persona/PersonaScreen.tsx         → 3-beat reveal (atmosphere → traits → name)
```

---

## Task 1: Install Framer Motion (if not already present)

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Check if framer-motion is installed**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
grep "framer-motion" package.json
```

If it appears, skip to Task 2.

- [ ] **Step 2: Install if missing**

```bash
npm install framer-motion
```

Expected: `added framer-motion@x.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add framer-motion for OB visual journey"
```

---

## Task 2: Define layer types and config in ob-layers.ts

**Files:**
- Create: `frontend/src/modules/onboarding/ob-layers.ts`
- Create: `frontend/src/modules/onboarding/ob-layers.test.ts`

Each OB answer contributes to one or more of the 5 visual layers. This file is pure data — no React, no side effects.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/onboarding/ob-layers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveLayerState, INITIAL_LAYER_STATE } from './ob-layers'
import type { LayerState, OBLayerUpdate } from './ob-layers'

describe('resolveLayerState', () => {
  it('returns initial state with no updates', () => {
    const state = resolveLayerState([])
    expect(state).toEqual(INITIAL_LAYER_STATE)
  })

  it('applies a single layer update', () => {
    const updates: OBLayerUpdate[] = [
      { layer: 'sky', value: 'dusk-blue' }
    ]
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('dusk-blue')
    expect(state.environment).toBe(INITIAL_LAYER_STATE.environment)
  })

  it('later updates override earlier ones on the same layer', () => {
    const updates: OBLayerUpdate[] = [
      { layer: 'sky', value: 'golden-hour' },
      { layer: 'sky', value: 'dusk-blue' },
    ]
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('dusk-blue')
  })

  it('group=solo sets sky to golden-dusk', () => {
    const updates = getLayerUpdatesForAnswer('group', 'solo')
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('golden-dusk')
  })

  it('group=family sets sky to warm-noon', () => {
    const updates = getLayerUpdatesForAnswer('group', 'family')
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('warm-noon')
  })

  it('mood=explore sets environment to cobblestone-alley', () => {
    const updates = getLayerUpdatesForAnswer('mood', 'explore')
    const state = resolveLayerState(updates)
    expect(state.environment).toBe('cobblestone-alley')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/onboarding/ob-layers.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Create ob-layers.ts**

Create `frontend/src/modules/onboarding/ob-layers.ts`:

```typescript
// Layer keys and their possible values.
// Values are CSS class names applied to each layer div in OBBackground.
export type SkyVariant =
  | 'midnight-indigo'   // default — deep blue night
  | 'golden-dusk'       // solo traveller
  | 'warm-noon'         // family / couple
  | 'cool-dawn'         // explorer / voyager
  | 'electric-night'    // pulse / nightlife

export type EnvironmentVariant =
  | 'minimal'           // default
  | 'cobblestone-alley' // explore / wanderer
  | 'forest-path'       // slow traveller / scenic
  | 'market-street'     // food / culture
  | 'rooftop-cityscape' // pulse / efficiency
  | 'coastal-promenade' // voyager

export type ForegroundVariant =
  | 'empty'             // default
  | 'lantern-table'     // food / epicurean
  | 'camera-strap'      // explorer / wanderer
  | 'wine-glass'        // evening-wind / rest
  | 'worn-map'          // historian / culture
  | 'running-shoes'     // pace-fast / efficiency

export type ColourTempVariant =
  | 'neutral'           // default
  | 'warm-amber'        // food / culture / slow
  | 'cool-steel'        // efficiency / voyager
  | 'electric-saturated' // pulse / nightlife
  | 'muted-earth'       // wanderer / crowd-averse

export type AtmosphereVariant =
  | 'clear'             // default
  | 'soft-mist'         // slow traveller / wanderer
  | 'golden-glow'       // epicurean / food
  | 'rain-sheen'        // temperate / oceanic
  | 'dappled-light'     // explorer / scenic
  | 'neon-haze'         // pulse / nightlife

export interface LayerState {
  sky: SkyVariant
  environment: EnvironmentVariant
  foreground: ForegroundVariant
  colorTemp: ColourTempVariant
  atmosphere: AtmosphereVariant
}

export interface OBLayerUpdate {
  layer: keyof LayerState
  value: LayerState[keyof LayerState]
}

export const INITIAL_LAYER_STATE: LayerState = {
  sky: 'midnight-indigo',
  environment: 'minimal',
  foreground: 'empty',
  colorTemp: 'neutral',
  atmosphere: 'clear',
}

// Answer → layer updates mapping
const ANSWER_LAYER_MAP: Record<string, Record<string, OBLayerUpdate[]>> = {
  group: {
    solo:    [{ layer: 'sky', value: 'golden-dusk' }],
    couple:  [{ layer: 'sky', value: 'warm-noon' }, { layer: 'atmosphere', value: 'golden-glow' }],
    family:  [{ layer: 'sky', value: 'warm-noon' }],
    friends: [{ layer: 'sky', value: 'electric-night' }, { layer: 'colorTemp', value: 'electric-saturated' }],
  },
  mood: {
    explore:   [{ layer: 'environment', value: 'cobblestone-alley' }, { layer: 'atmosphere', value: 'dappled-light' }],
    culture:   [{ layer: 'environment', value: 'market-street' }, { layer: 'foreground', value: 'worn-map' }],
    food:      [{ layer: 'foreground', value: 'lantern-table' }, { layer: 'colorTemp', value: 'warm-amber' }],
    nightlife: [{ layer: 'sky', value: 'electric-night' }, { layer: 'atmosphere', value: 'neon-haze' }],
    relax:     [{ layer: 'environment', value: 'coastal-promenade' }, { layer: 'atmosphere', value: 'soft-mist' }],
  },
  pace: {
    slow:      [{ layer: 'atmosphere', value: 'soft-mist' }, { layer: 'colorTemp', value: 'muted-earth' }],
    balanced:  [],
    fast:      [{ layer: 'foreground', value: 'running-shoes' }, { layer: 'colorTemp', value: 'cool-steel' }],
  },
  movement: {
    walk:      [{ layer: 'environment', value: 'cobblestone-alley' }],
    mixed:     [],
    transit:   [{ layer: 'colorTemp', value: 'cool-steel' }],
  },
  crowd_aversion: {
    always:    [{ layer: 'colorTemp', value: 'muted-earth' }, { layer: 'atmosphere', value: 'soft-mist' }],
    sometimes: [],
    never:     [{ layer: 'colorTemp', value: 'electric-saturated' }],
  },
  spontaneity: {
    always:    [{ layer: 'atmosphere', value: 'dappled-light' }],
    sometimes: [],
    never:     [{ layer: 'colorTemp', value: 'cool-steel' }],
  },
  evening: {
    dinner_wind: [{ layer: 'foreground', value: 'wine-glass' }, { layer: 'sky', value: 'golden-dusk' }],
    explore:     [{ layer: 'atmosphere', value: 'dappled-light' }],
    nightlife:   [{ layer: 'sky', value: 'electric-night' }, { layer: 'atmosphere', value: 'neon-haze' }],
    rest:        [{ layer: 'atmosphere', value: 'soft-mist' }, { layer: 'colorTemp', value: 'muted-earth' }],
  },
  budget: {
    budget:     [{ layer: 'colorTemp', value: 'muted-earth' }],
    mid_range:  [],
    splurge:    [{ layer: 'foreground', value: 'wine-glass' }, { layer: 'atmosphere', value: 'golden-glow' }],
  },
}

/** Get the layer updates triggered by a specific question + answer. */
export function getLayerUpdatesForAnswer(
  question: string,
  answer: string
): OBLayerUpdate[] {
  return ANSWER_LAYER_MAP[question]?.[answer] ?? []
}

/** Merge a list of layer updates onto the initial state. Later updates win. */
export function resolveLayerState(updates: OBLayerUpdate[]): LayerState {
  return updates.reduce<LayerState>(
    (state, update) => ({ ...state, [update.layer]: update.value }),
    { ...INITIAL_LAYER_STATE }
  )
}
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/onboarding/ob-layers.test.ts
```

Expected: `PASS` — all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/onboarding/ob-layers.ts src/modules/onboarding/ob-layers.test.ts
git commit -m "feat(ob): add layer state config for visual journey"
```

---

## Task 3: Build OBBackground compositor component

**Files:**
- Create: `frontend/src/modules/onboarding/OBBackground.tsx`

This component renders 5 absolutely-positioned divs that cross-dissolve when `layerState` changes. It sits behind all OB question content.

- [ ] **Step 1: Create OBBackground.tsx**

```typescript
import { motion, AnimatePresence } from 'framer-motion'
import type { LayerState } from './ob-layers'

interface Props {
  layerState: LayerState
}

// Tailwind classes for each layer variant — extend as illustration assets are added
const SKY_CLASSES: Record<LayerState['sky'], string> = {
  'midnight-indigo':    'bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-800',
  'golden-dusk':        'bg-gradient-to-b from-orange-900 via-amber-800 to-amber-600',
  'warm-noon':          'bg-gradient-to-b from-sky-700 via-sky-500 to-amber-300',
  'cool-dawn':          'bg-gradient-to-b from-slate-800 via-slate-600 to-sky-400',
  'electric-night':     'bg-gradient-to-b from-violet-950 via-violet-900 to-indigo-800',
}

const ENVIRONMENT_CLASSES: Record<LayerState['environment'], string> = {
  'minimal':             '',
  'cobblestone-alley':   'bg-[url(/illustrations/env-alley.svg)] bg-bottom bg-no-repeat bg-contain',
  'forest-path':         'bg-[url(/illustrations/env-forest.svg)] bg-bottom bg-no-repeat bg-contain',
  'market-street':       'bg-[url(/illustrations/env-market.svg)] bg-bottom bg-no-repeat bg-contain',
  'rooftop-cityscape':   'bg-[url(/illustrations/env-rooftop.svg)] bg-bottom bg-no-repeat bg-contain',
  'coastal-promenade':   'bg-[url(/illustrations/env-coastal.svg)] bg-bottom bg-no-repeat bg-contain',
}

const FOREGROUND_CLASSES: Record<LayerState['foreground'], string> = {
  'empty':         '',
  'lantern-table': 'bg-[url(/illustrations/fg-lantern.svg)] bg-bottom bg-no-repeat bg-auto',
  'camera-strap':  'bg-[url(/illustrations/fg-camera.svg)] bg-bottom-right bg-no-repeat bg-auto',
  'wine-glass':    'bg-[url(/illustrations/fg-wine.svg)] bg-bottom-right bg-no-repeat bg-auto',
  'worn-map':      'bg-[url(/illustrations/fg-map.svg)] bg-bottom-left bg-no-repeat bg-auto',
  'running-shoes': 'bg-[url(/illustrations/fg-shoes.svg)] bg-bottom bg-no-repeat bg-auto',
}

const COLOUR_TEMP_CLASSES: Record<LayerState['colorTemp'], string> = {
  'neutral':            'opacity-0',
  'warm-amber':         'bg-amber-500/20',
  'cool-steel':         'bg-slate-400/20',
  'electric-saturated': 'bg-violet-500/25',
  'muted-earth':        'bg-stone-600/20',
}

const ATMOSPHERE_CLASSES: Record<LayerState['atmosphere'], string> = {
  'clear':        'opacity-0',
  'soft-mist':    'bg-white/10 backdrop-blur-[1px]',
  'golden-glow':  'bg-amber-300/15',
  'rain-sheen':   'bg-slate-300/15',
  'dappled-light':'bg-amber-200/10',
  'neon-haze':    'bg-fuchsia-500/15',
}

const TRANSITION = { duration: 0.6, ease: 'easeInOut' }

export function OBBackground({ layerState }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Layer 1 — Sky */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.sky}
          className={`absolute inset-0 ${SKY_CLASSES[layerState.sky]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>

      {/* Layer 2 — Environment */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.environment}
          className={`absolute inset-0 ${ENVIRONMENT_CLASSES[layerState.environment]}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>

      {/* Layer 3 — Foreground element */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.foreground}
          className={`absolute inset-0 ${FOREGROUND_CLASSES[layerState.foreground]}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ ...TRANSITION, duration: 0.8 }}
        />
      </AnimatePresence>

      {/* Layer 4 — Colour temperature overlay */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.colorTemp}
          className={`absolute inset-0 ${COLOUR_TEMP_CLASSES[layerState.colorTemp]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>

      {/* Layer 5 — Atmosphere overlay */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.atmosphere}
          className={`absolute inset-0 ${ATMOSPHERE_CLASSES[layerState.atmosphere]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>
    </div>
  )
}
```

> **Note on illustration assets:** The `bg-[url(...)]` classes reference SVG files under `frontend/public/illustrations/`. These can be placeholder empty files at first — the gradient sky layers work without them. Add actual illustrations iteratively. Create the directory now:
> ```bash
> mkdir -p /Users/souravbiswas/uncover-roads/frontend/public/illustrations
> ```

- [ ] **Step 2: Create the illustrations directory**

```bash
mkdir -p /Users/souravbiswas/uncover-roads/frontend/public/illustrations
# Create placeholder SVGs so CSS references don't 404
for name in env-alley env-forest env-market env-rooftop env-coastal fg-lantern fg-camera fg-wine fg-map fg-shoes; do
  echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>' \
    > /Users/souravbiswas/uncover-roads/frontend/public/illustrations/${name}.svg
done
```

- [ ] **Step 3: Run full test suite — no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass (OBBackground has no tests — it's a pure UI component verified visually).

- [ ] **Step 4: Commit**

```bash
git add src/modules/onboarding/OBBackground.tsx frontend/public/illustrations/
git commit -m "feat(ob): add OBBackground 5-layer compositor"
```

---

## Task 4: Build PersonaSilhouette SVG component

**Files:**
- Create: `frontend/src/modules/onboarding/PersonaSilhouette.tsx`

The silhouette is an SVG that starts as a bare outline and gains visible detail elements (bag, camera, wine glass, map) as the user answers questions. Each detail corresponds to a foreground layer variant.

- [ ] **Step 1: Create PersonaSilhouette.tsx**

```typescript
import { motion } from 'framer-motion'
import type { LayerState } from './ob-layers'

interface Props {
  layerState: LayerState
  /** 0–9: how many questions answered so far */
  answeredCount: number
}

export function PersonaSilhouette({ layerState, answeredCount }: Props) {
  const opacity = 0.15 + (answeredCount / 9) * 0.55  // 0.15 → 0.70 over 9 steps

  return (
    <motion.div
      className="absolute bottom-8 right-6 w-20 h-32 pointer-events-none"
      animate={{ opacity }}
      transition={{ duration: 0.6 }}
    >
      <svg viewBox="0 0 80 128" fill="none" xmlns="http://www.w3.org/2000/svg"
           className="w-full h-full">
        {/* Base silhouette — always visible */}
        <ellipse cx="40" cy="16" rx="10" ry="12" className="fill-white/60" />
        <rect x="28" y="28" width="24" height="40" rx="4" className="fill-white/60" />
        <rect x="18" y="30" width="10" height="30" rx="4" className="fill-white/50" />
        <rect x="52" y="30" width="10" height="30" rx="4" className="fill-white/50" />
        <rect x="28" y="68" width="10" height="36" rx="4" className="fill-white/60" />
        <rect x="42" y="68" width="10" height="36" rx="4" className="fill-white/60" />

        {/* Camera — visible when foreground=camera-strap */}
        {layerState.foreground === 'camera-strap' && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <rect x="46" y="38" width="14" height="10" rx="2" className="fill-white/80" />
            <circle cx="53" cy="43" r="3" className="fill-white/40" />
          </motion.g>
        )}

        {/* Wine glass — visible when foreground=wine-glass */}
        {layerState.foreground === 'wine-glass' && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <path d="M20 56 L16 70 L24 70 L20 80 M18 70 L22 70"
                  className="stroke-white/80" strokeWidth="1.5" />
          </motion.g>
        )}

        {/* Map — visible when foreground=worn-map */}
        {layerState.foreground === 'worn-map' && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <rect x="44" y="54" width="14" height="10" rx="1" className="fill-white/80" />
            <line x1="46" y1="57" x2="56" y2="57" className="stroke-white/40" strokeWidth="0.8" />
            <line x1="46" y1="60" x2="54" y2="60" className="stroke-white/40" strokeWidth="0.8" />
          </motion.g>
        )}

        {/* Bag strap — visible when answeredCount > 4 */}
        {answeredCount > 4 && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ duration: 0.6 }}>
            <path d="M38 28 Q34 22 30 24 Q28 26 30 30"
                  className="stroke-white/70" fill="none" strokeWidth="1.5" />
          </motion.g>
        )}
      </svg>
    </motion.div>
  )
}
```

- [ ] **Step 2: Run full test suite — no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/modules/onboarding/PersonaSilhouette.tsx
git commit -m "feat(ob): add PersonaSilhouette SVG that builds with each answer"
```

---

## Task 5: Update OnboardingShell to use new sequence and visual system

**Files:**
- Modify: `frontend/src/modules/onboarding/OnboardingShell.tsx`

Read the current `OnboardingShell.tsx` before modifying — understand how it maps steps to components and manages progress. The changes are:
1. Reorder the step array to match the Act 1/2/3 sequence
2. Make kid-focus conditional (only when group = family)
3. Wrap existing question content in the OBBackground + PersonaSilhouette layer

- [ ] **Step 1: Read the current shell**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/onboarding/OnboardingShell.tsx
```

Note the current step order and how step components are rendered.

- [ ] **Step 2: Update the step order**

Find the step/screen array in `OnboardingShell.tsx`. Replace it with:

```typescript
// New sequence — Act 1: who you are, Act 2: how you move, Act 3: how you close
const OB_STEPS = [
  'group',        // OB1 — who's coming
  'mood',         // OB2 — what pulls you to travel (emotional hook)
  'pace',         // OB3 — pace in a new city
  'movement',     // OB4 — how you move (from Phase 2 redesign)
  'crowd',        // OB5 — crowds (was OB2 sub-question, now standalone)
  'spontaneity',  // OB6 — planning vs winging it (from Phase 2 redesign)
  'evening',      // OB7 — how your evening ends
  'budget',       // OB8 — money mindset (was OB6)
  'dietary',      // OB9 — needs (was OB5, now last)
] as const
```

- [ ] **Step 3: Add conditional kid-focus**

After the step array, add:

```typescript
function getActiveSteps(answers: Partial<RawOBAnswers>): typeof OB_STEPS[number][] {
  const steps = [...OB_STEPS]
  // Insert kid-focus after 'group' only when group = family
  if (answers.group === 'family') {
    const groupIdx = steps.indexOf('group')
    steps.splice(groupIdx + 1, 0, 'kid_focus' as any)
  }
  return steps as any
}
```

Use `getActiveSteps(answers)` instead of the static array when rendering.

- [ ] **Step 4: Import and add OBBackground and PersonaSilhouette**

At the top of `OnboardingShell.tsx` add:

```typescript
import { OBBackground } from './OBBackground'
import { PersonaSilhouette } from './PersonaSilhouette'
import { getLayerUpdatesForAnswer, resolveLayerState, INITIAL_LAYER_STATE } from './ob-layers'
import type { OBLayerUpdate } from './ob-layers'
```

- [ ] **Step 5: Compute layerState from accumulated answers**

Inside the shell component, compute the layer state from all answers collected so far:

```typescript
const layerState = useMemo(() => {
  const updates: OBLayerUpdate[] = []
  // answers is the accumulated RawOBAnswers object
  for (const [question, answer] of Object.entries(answers)) {
    const ans = Array.isArray(answer) ? answer : [answer]
    for (const a of ans) {
      updates.push(...getLayerUpdatesForAnswer(question, String(a)))
    }
  }
  return resolveLayerState(updates)
}, [answers])

const answeredCount = Object.keys(answers).length
```

- [ ] **Step 6: Render OBBackground and PersonaSilhouette**

Wrap the existing shell container with a relative-positioned outer div, and render the background + silhouette behind the question content:

```tsx
return (
  <div className="relative min-h-screen overflow-hidden">
    {/* Visual layers — behind everything */}
    <OBBackground layerState={layerState} />
    <PersonaSilhouette layerState={layerState} answeredCount={answeredCount} />

    {/* Existing question content — above layers */}
    <div className="relative z-10">
      {/* ...existing shell content unchanged... */}
    </div>
  </div>
)
```

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass. Fix any import/type errors before committing.

- [ ] **Step 8: Commit**

```bash
git add src/modules/onboarding/OnboardingShell.tsx
git commit -m "feat(ob): reorder OB steps to 3-act sequence, add background/silhouette layers"
```

---

## Task 6: Build 3-beat persona reveal in PersonaScreen

**Files:**
- Modify: `frontend/src/modules/persona/PersonaScreen.tsx`

**Depends on:** Phase 2 must have rebuilt PersonaScreen with archetype data already available. This task replaces the reveal animation/copy layer only — it does not change how the archetype is computed or what data is displayed.

Read the Phase 2 PersonaScreen before modifying to understand what props/data are available.

The 3 beats:
1. **Atmosphere** — full-screen archetype background settles (1.5s, no text)
2. **Trait lines** — 3 lines that surprise before confirming (staggered 800ms each)
3. **Name** — archetype name arrives last, large serif

- [ ] **Step 1: Read current Phase 2 PersonaScreen**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/persona/PersonaScreen.tsx
```

Note how `archetype` / `personaProfile` is received, and what's currently rendered.

- [ ] **Step 2: Add archetype trait copy map**

Add this constant near the top of `PersonaScreen.tsx` (after imports):

```typescript
const ARCHETYPE_TRAITS: Record<string, [string, string, string]> = {
  wanderer: [
    "You leave before the crowds arrive.",
    "You find the place they haven't named yet.",
    "You don't take photos of everything.",
  ],
  historian: [
    "You read the plaques everyone else walks past.",
    "A place means more when you know what stood here before.",
    "You leave with context, not just memories.",
  ],
  epicurean: [
    "The best meal of your trip won't be in a guidebook.",
    "You know the difference between a good market and a great one.",
    "You travel through your stomach, always.",
  ],
  pulse: [
    "You want to feel the city's heartbeat, not observe it.",
    "Sleep is negotiable. Energy isn't.",
    "The best nights are the ones with no plan.",
  ],
  slowtraveller: [
    "You've sat at the same café table twice.",
    "The neighbourhood matters more than the sights.",
    "A good trip feels like you almost lived there.",
  ],
  voyager: [
    "You know exactly how long it takes to get from A to B.",
    "You've seen more cities than most people dream of.",
    "Efficiency is how you fit more life in.",
  ],
  explorer: [
    "The map is a starting point, not a plan.",
    "You take the wrong turn on purpose sometimes.",
    "Familiar and surprising — you want both.",
  ],
}
```

- [ ] **Step 3: Add archetype background colours map**

```typescript
const ARCHETYPE_BG: Record<string, string> = {
  wanderer:      'bg-gradient-to-b from-stone-800 via-stone-700 to-amber-900',
  historian:     'bg-gradient-to-b from-slate-800 via-slate-700 to-stone-700',
  epicurean:     'bg-gradient-to-b from-amber-900 via-orange-800 to-amber-700',
  pulse:         'bg-gradient-to-b from-violet-950 via-violet-800 to-indigo-700',
  slowtraveller: 'bg-gradient-to-b from-teal-900 via-teal-800 to-stone-700',
  voyager:       'bg-gradient-to-b from-sky-900 via-sky-800 to-slate-700',
  explorer:      'bg-gradient-to-b from-emerald-900 via-emerald-800 to-stone-700',
}
```

- [ ] **Step 4: Implement the 3-beat reveal sequence**

Replace the existing PersonaScreen render with the 3-beat sequence:

```typescript
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
// ...existing imports...

export function PersonaScreen({ /* existing props */ }) {
  const archetypeId = personaProfile?.archetypeId ?? 'wanderer'
  const traits = ARCHETYPE_TRAITS[archetypeId] ?? ARCHETYPE_TRAITS.wanderer
  const bg = ARCHETYPE_BG[archetypeId] ?? ARCHETYPE_BG.wanderer

  // Beat 1: atmosphere (0–1500ms)
  // Beat 2: traits appear (1500ms, 800ms each = 1500–3900ms)
  // Beat 3: name appears (3900ms+)
  const [beat, setBeat] = useState<1 | 2 | 3>(1)

  useEffect(() => {
    const t1 = setTimeout(() => setBeat(2), 1500)
    const t2 = setTimeout(() => setBeat(3), 3900)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className={`relative min-h-screen flex flex-col items-center justify-center ${bg} transition-all duration-1000`}>
      {/* Beat 2 — Trait lines */}
      {beat >= 2 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-6">
          {traits.map((line, i) => (
            <motion.p
              key={i}
              className="text-white/90 text-lg text-center font-light tracking-wide"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.8, duration: 0.6 }}
            >
              {line}
            </motion.p>
          ))}
        </div>
      )}

      {/* Beat 3 — Archetype name */}
      {beat >= 3 && (
        <motion.div
          className="absolute bottom-24 left-0 right-0 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-white/50 text-sm tracking-widest uppercase">You are</p>
          <h1 className="text-white text-5xl font-serif tracking-wide capitalize">
            {archetypeId}
          </h1>
          {/* Existing CTAs from Phase 2 — retake button + enter app */}
        </motion.div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all existing tests pass. Fix any type/import errors.

- [ ] **Step 6: Smoke-test in browser**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run dev
```

Navigate through the OB flow. Verify:
- Background shifts with each answer
- Silhouette gains detail
- Reveal fires the 3 beats in sequence (atmosphere → traits → name)

- [ ] **Step 7: Commit**

```bash
git add src/modules/persona/PersonaScreen.tsx
git commit -m "feat(ob): implement 3-beat persona reveal — atmosphere, traits, name"
```
