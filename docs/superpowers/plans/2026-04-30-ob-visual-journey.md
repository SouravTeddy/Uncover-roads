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

---

## Task 7: Redesign WalkthroughScreen — 5-slide animated feature tour

**Spec:** `docs/superpowers/specs/2026-04-30-walkthrough-redesign.md`

**Files:**
- Modify: `frontend/src/modules/login/WalkthroughScreen.tsx`
- Create: `frontend/src/modules/login/anim/WTPersonaAnim.tsx`
- Create: `frontend/src/modules/login/anim/WTCityAnim.tsx`
- Create: `frontend/src/modules/login/anim/WTRecsAnim.tsx`
- Create: `frontend/src/modules/login/anim/WTMultiCityAnim.tsx`
- Create: `frontend/src/modules/login/anim/WTPricingAnim.tsx`

**Depends on:** Task 1 (framer-motion installed).

Replace the current static icon-card walkthrough with a 5-slide animated feature tour using the app design system (dark warm palette, Playfair Display, terracotta/sky/amber/sage accents).

- [ ] **Step 1: Read current WalkthroughScreen**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/login/WalkthroughScreen.tsx
```

Note the current CARDS array shape, touch handlers, and `finish()` dispatch.

- [ ] **Step 2: Create animation sub-components**

Create `frontend/src/modules/login/anim/` directory and implement each animation component. Each is a self-contained `motion.div` scene using Framer Motion + Tailwind.

**WTPersonaAnim.tsx** — Silhouette materialises, archetype badge pops, three trait lines reveal:

```typescript
import { motion } from 'framer-motion'

export function WTPersonaAnim() {
  return (
    <div className="relative flex flex-col items-center gap-3">
      {/* Ambient glow */}
      <motion.div
        className="absolute w-28 h-28 rounded-full"
        style={{ background: 'rgba(224,120,84,.18)', filter: 'blur(32px)', top: '-10%' }}
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.12, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Silhouette */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <div className="relative w-12">
          <div className="w-6 h-6 rounded-full mx-auto" style={{ background: 'linear-gradient(160deg,#e07854,#c4613d)', boxShadow: '0 4px 16px rgba(224,120,84,.4)' }} />
          <div className="w-11 h-12 rounded-[14px_14px_10px_10px] mt-0.5 mx-auto" style={{ background: 'linear-gradient(160deg,#c4613d,#8b3d22)', boxShadow: '0 6px 20px rgba(196,97,61,.35)' }}>
            <motion.div
              className="absolute top-2.5 -right-2.5 w-3 h-2.5 rounded bg-[var(--color-surface2)] border border-white/10"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            />
          </div>
        </div>
      </motion.div>
      {/* Archetype badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.8, type: 'spring', stiffness: 300, damping: 18 }}
        className="px-4 py-1.5 rounded-full border"
        style={{ background: 'var(--color-surface)', borderColor: 'rgba(224,120,84,.3)', boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}
      >
        <span className="font-[family-name:var(--font-heading)] text-sm font-bold" style={{ color: 'var(--color-primary)' }}>The Wanderer</span>
      </motion.div>
      {/* Trait lines */}
      <div className="flex flex-col gap-1 w-28">
        {[1, 0.8, 0.6].map((w, i) => (
          <motion.div key={i}
            className="h-1 rounded-full"
            style={{ background: `rgba(224,120,84,${0.25 - i * 0.06})`, width: `${w * 100}%` }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1 + i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}
```

**WTCityAnim.tsx** — Map grid + pins drop + pulse rings + search bar:

```typescript
import { motion } from 'framer-motion'

const PINS = [
  { top: '28%', left: '32%', color: 'var(--color-primary)', shadow: 'rgba(224,120,84,.6)', delay: 0.2 },
  { top: '45%', left: '58%', color: 'var(--color-sky)',     shadow: 'rgba(79,143,171,.6)',  delay: 0.5 },
  { top: '60%', left: '26%', color: 'var(--color-sage)',    shadow: 'rgba(107,148,112,.6)', delay: 0.8 },
  { top: '36%', left: '64%', color: 'var(--color-amber)',   shadow: 'rgba(196,152,64,.6)',  delay: 1.1 },
]

export function WTCityAnim() {
  return (
    <div className="absolute inset-0">
      {/* Map grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)',
        backgroundSize: '18px 18px',
      }} />
      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="absolute top-4 left-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-m)', boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}
      >
        <span className="ms text-[var(--color-text-3)] text-sm">search</span>
        <div className="flex-1 h-1 rounded-full bg-[var(--color-surface2)]" />
        <motion.div
          className="w-0.5 h-3 rounded-sm bg-[var(--color-primary)]"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </motion.div>
      {/* Pins */}
      {PINS.map((pin, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top: pin.top, left: pin.left }}
          initial={{ opacity: 0, y: -20, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: pin.delay, type: 'spring', stiffness: 300, damping: 14 }}
        >
          <div className="relative">
            <div className="w-3 h-3 rounded-full border-2 border-white/80" style={{ background: pin.color, boxShadow: `0 0 8px ${pin.shadow}` }} />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: pin.color, opacity: 0.35 }}
              animate={{ scale: [0.5, 2.6], opacity: [0.7, 0] }}
              transition={{ delay: pin.delay + 0.3, duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  )
}
```

**WTRecsAnim.tsx** — Three signal cards staggered:

```typescript
import { motion } from 'framer-motion'

const CARDS = [
  { label: 'Trending now', color: 'var(--color-amber)',   border: 'rgba(196,152,64,.4)',  blink: true,  delay: 0.2 },
  { label: 'Skip this one', color: '#e57373',             border: 'rgba(192,57,43,.4)',   blink: false, delay: 0.5 },
  { label: 'Hidden gem',   color: 'var(--color-sage)',    border: 'rgba(107,148,112,.4)', blink: false, delay: 0.8 },
]

export function WTRecsAnim() {
  return (
    <div className="flex flex-col gap-2 w-36">
      {CARDS.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: card.delay }}
          className="rounded-xl p-2.5 border border-white/8 border-l-[3px]"
          style={{ background: 'var(--color-surface)', borderLeftColor: card.color, boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <motion.div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: card.color }}
              animate={card.blink ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: card.color }}>{card.label}</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--color-surface2)] w-4/5 mb-1" />
          <div className="h-1 rounded-full bg-[var(--color-surface2)] w-3/5 opacity-60" />
        </motion.div>
      ))}
    </div>
  )
}
```

**WTMultiCityAnim.tsx** — City chain with drawing connectors:

```typescript
import { motion } from 'framer-motion'

const CITIES = [
  { color: 'var(--color-sage)', bg: 'var(--color-sage-bg)', bdr: 'var(--color-sage-bdr)', delay: 0.2, width: 56 },
  { color: 'var(--color-sky)',  bg: 'var(--color-sky-bg)',  bdr: 'var(--color-sky-bdr)',  delay: 0.65, width: 48 },
]

export function WTMultiCityAnim() {
  return (
    <div className="flex flex-col items-center w-36">
      {CITIES.map((city, i) => (
        <div key={i} className="w-full flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: city.delay, type: 'spring', stiffness: 280, damping: 18 }}
            className="w-full flex items-center gap-2 p-2 rounded-xl border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border" style={{ background: city.bg, borderColor: city.bdr }}>
              <div className="w-2 h-2 rounded-full" style={{ background: city.color, boxShadow: `0 0 5px ${city.color}` }} />
            </div>
            <div>
              <div className="h-1.5 rounded-full bg-white/25 mb-1" style={{ width: city.width }} />
              <div className="h-1 rounded-full bg-white/10" style={{ width: city.width * 0.65 }} />
            </div>
          </motion.div>
          {i < CITIES.length - 1 && (
            <motion.div
              className="w-0.5 rounded-full"
              style={{ background: 'linear-gradient(to bottom, var(--color-sage), var(--color-sky))' }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 14, opacity: 1 }}
              transition={{ delay: city.delay + 0.35, duration: 0.3 }}
            />
          )}
        </div>
      ))}
      {/* After last connector */}
      <motion.div
        className="w-0.5 rounded-full"
        style={{ background: 'linear-gradient(to bottom, var(--color-sky), rgba(79,143,171,.2))' }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 14, opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.3 }}
      />
      {/* Add city */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.1, type: 'spring', stiffness: 280, damping: 18 }}
        className="w-full flex items-center gap-2 p-2 rounded-xl border"
        style={{ borderColor: 'rgba(79,143,171,.35)', borderStyle: 'dashed', background: 'transparent' }}
      >
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border border-dashed border-sky/40 bg-white/4">
          <span className="text-sky/70 text-sm leading-none font-light">+</span>
        </div>
        <span className="text-[9px] font-semibold text-[var(--color-sky)] opacity-70">Add a city</span>
      </motion.div>
    </div>
  )
}
```

**WTPricingAnim.tsx** — Confetti dots, FREE bounce, pay card:

```typescript
import { motion } from 'framer-motion'

const CONFETTI = [
  { top: '18%', left: '30%', color: 'var(--color-primary)', delay: 0.5, size: 5 },
  { top: '16%', left: '55%', color: 'var(--color-amber)',   delay: 0.65, size: 4 },
  { top: '22%', left: '42%', color: 'var(--color-sage)',    delay: 0.8,  size: 3 },
  { top: '15%', left: '68%', color: 'var(--color-sky)',     delay: 0.55, size: 5 },
  { top: '24%', left: '20%', color: 'var(--color-primary)', delay: 0.72, size: 4 },
]

export function WTPricingAnim() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Confetti */}
      {CONFETTI.map((c, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{ top: c.top, left: c.left, width: c.size, height: c.size, background: c.color }}
          initial={{ opacity: 0, y: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 0], y: 40, rotate: 480 }}
          transition={{ delay: c.delay, duration: 0.8 }}
        />
      ))}
      <div className="flex flex-col gap-2 w-36 z-10">
        {/* FREE card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.4, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 14 }}
          className="relative rounded-2xl p-3 border text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'rgba(224,120,84,.35)', boxShadow: '0 4px 24px rgba(224,120,84,.2)' }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-lg" style={{ background: 'var(--color-primary)', boxShadow: '0 4px 12px rgba(224,120,84,.5)' }}>
            <span className="text-white text-[9px] font-black tracking-wide">FREE</span>
          </div>
          <div className="mt-2 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-1)]">First 2 trips</div>
          <div className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--color-primary)' }}>No credit card needed</div>
        </motion.div>
        {/* Pay per trip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="rounded-2xl p-3 border text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
        >
          <div className="text-[9px] font-bold text-[var(--color-text-2)] mb-1">After that</div>
          <div className="text-[9px] text-[var(--color-text-3)] mb-2">Buy only the trips you need</div>
          <div className="rounded-lg py-1 text-center" style={{ background: 'var(--color-surface2)' }}>
            <span className="text-[9px] font-bold text-[var(--color-text-1)]">Pay per trip</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite WalkthroughScreen.tsx**

Replace the existing component with:

```typescript
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../shared/store'
import { Button } from '../../shared/ui/Button'
import { WTPersonaAnim }   from './anim/WTPersonaAnim'
import { WTCityAnim }      from './anim/WTCityAnim'
import { WTRecsAnim }      from './anim/WTRecsAnim'
import { WTMultiCityAnim } from './anim/WTMultiCityAnim'
import { WTPricingAnim }   from './anim/WTPricingAnim'

const CARDS = [
  {
    id: 'persona',
    chip: 'Persona',
    accentVar: 'var(--color-primary)',
    accentBg: 'var(--color-primary-bg)',
    accentBdr: 'rgba(224,120,84,.25)',
    ctaStyle: 'linear-gradient(135deg,#e07854,#c4613d)',
    title: 'Discover your travel DNA',
    desc: '9 questions. One archetype. Every recommendation tuned to who you are.',
    Animation: WTPersonaAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(224,120,84,.12) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'city',
    chip: 'Explore',
    accentVar: 'var(--color-sky)',
    accentBg: 'var(--color-sky-bg)',
    accentBdr: 'rgba(79,143,171,.25)',
    ctaStyle: 'linear-gradient(135deg,#4f8fab,#2e6b89)',
    title: 'Any city, anywhere',
    desc: 'Search any destination and step straight onto its map — Tokyo to Lisbon.',
    Animation: WTCityAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(79,143,171,.12) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'recs',
    chip: 'Smart Picks',
    accentVar: 'var(--color-amber)',
    accentBg: 'var(--color-amber-bg)',
    accentBdr: 'rgba(196,152,64,.25)',
    ctaStyle: 'linear-gradient(135deg,#c49840,#9c7a1e)',
    title: "Knows what's worth it",
    desc: 'Tracks trends, flags what to skip, surfaces hidden gems others miss.',
    Animation: WTRecsAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(196,152,64,.1) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'multicity',
    chip: 'Multi-city',
    accentVar: 'var(--color-sage)',
    accentBg: 'var(--color-sage-bg)',
    accentBdr: 'rgba(107,148,112,.25)',
    ctaStyle: 'linear-gradient(135deg,#6b9470,#3d6642)',
    title: 'One trip, many cities',
    desc: 'Paris, Rome, Barcelona — a full itinerary for every stop, in one place.',
    Animation: WTMultiCityAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(107,148,112,.1) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'pricing',
    chip: 'Trip Packages',
    accentVar: 'var(--color-primary)',
    accentBg: 'var(--color-primary-bg)',
    accentBdr: 'rgba(224,120,84,.25)',
    ctaStyle: 'linear-gradient(135deg,#e07854,#c4613d)',
    title: 'First 2 trips on us',
    desc: 'Your first two full itineraries are free. After that, pay only for the trips you take.',
    Animation: WTPricingAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(224,120,84,.08) 0%, transparent 70%)',
    cta: 'Get started',
    hideSkip: true,
  },
] as const

const textVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const textItem = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export function WalkthroughScreen() {
  const { dispatch } = useAppStore()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const touchStartX = useRef<number | null>(null)

  const card = CARDS[index]
  const isLast = index === CARDS.length - 1

  function finish() {
    try { localStorage.setItem('ur_walkthrough_seen', '1') } catch { /* ignore */ }
    dispatch({ type: 'GO_TO', screen: 'ob1' })
  }

  function advance(dir: 1 | -1) {
    const next = index + dir
    if (next < 0 || next >= CARDS.length) return
    setDirection(dir)
    setIndex(next)
  }

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 48) advance(delta > 0 ? 1 : -1)
    touchStartX.current = null
  }

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? '60%' : '-60%', opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] } },
    exit:   (d: number) => ({ x: d > 0 ? '-60%' : '60%', opacity: 0, transition: { duration: 0.25 } }),
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[var(--color-bg)]"
      style={{ zIndex: 20 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip */}
      <div className="flex-shrink-0 flex justify-end px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 1rem)' }}>
        {!card.hideSkip ? (
          <button onClick={finish} className="text-[var(--color-text-3)] text-sm font-medium px-3 py-1.5 rounded-full hover:text-[var(--color-text-2)] transition-colors">
            Skip
          </button>
        ) : <div className="h-8" />}
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={card.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex flex-col"
          >
            {/* Animation stage */}
            <div
              className="flex-1 relative overflow-hidden flex items-center justify-center"
              style={{ background: `${card.stageBg}, var(--color-bg)` }}
            >
              <card.Animation />
            </div>

            {/* Text */}
            <motion.div
              className="flex-shrink-0 px-6 pt-5 pb-2"
              variants={textVariants}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={textItem}>
                <span
                  className="inline-block text-[10px] font-bold tracking-widest uppercase rounded-full px-3 py-1 mb-3 border"
                  style={{ background: card.accentBg, borderColor: card.accentBdr, color: card.accentVar }}
                >
                  {card.chip}
                </span>
              </motion.div>
              <motion.h1
                variants={textItem}
                className="font-[family-name:var(--font-heading)] text-[22px] font-bold text-[var(--color-text-1)] leading-snug mb-2"
              >
                {card.title}
              </motion.h1>
              <motion.p variants={textItem} className="text-[var(--color-text-2)] text-sm leading-relaxed">
                {card.desc}
              </motion.p>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom */}
      <div
        className="flex-shrink-0 px-6 pb-10 flex flex-col gap-4 items-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 2rem)' }}
      >
        {/* Step dots */}
        <div className="flex gap-1.5 items-center">
          {CARDS.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i) }}
              animate={{ width: i === index ? 16 : 5, background: i === index ? card.accentVar : 'var(--color-surface2)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="h-1.5 rounded-full"
              style={{ minWidth: 5 }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={isLast ? finish : () => advance(1)}
          className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2"
          style={{ background: card.ctaStyle, boxShadow: `0 8px 24px ${card.accentVar}40` }}
        >
          {card.cta}
          <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all 329+ tests pass. Fix any import/type errors.

- [ ] **Step 5: Smoke-test in browser**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run dev
```

Navigate to the walkthrough (clear `ur_walkthrough_seen` from localStorage first). Verify:
- All 5 slides render and swipe correctly
- Each animation stage plays on entry
- Step dots morph correctly
- Last slide has no Skip button
- "Get started" dispatches to `ob1`

- [ ] **Step 6: Commit**

```bash
git add src/modules/login/WalkthroughScreen.tsx src/modules/login/anim/
git commit -m "feat(walkthrough): 5-slide animated feature tour with app design system"
```
