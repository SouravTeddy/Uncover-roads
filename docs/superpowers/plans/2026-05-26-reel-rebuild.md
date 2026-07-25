# Reel Rebuild & Reco Engine Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all reel card components from `reel-mock.html` as source of truth, fix 8 CSS keyframes, and repair three structural reco engine bugs that have silently broken intelligence output.

**Architecture:** Full component rewrites using a new shared `reel-constants.ts` for all pixel values. Engine fixes are isolated to `signal.ts` (wrong state field), `ItineraryReelScreen.tsx` (guard removal), and `engine.ts` (missing templates). `personaProfile` persisted to localStorage so engine works after page reload.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, inline styles (no CSS modules on reel cards)

**Reference:** `frontend/public/reel-mock.html` — read-only source of truth. Every value in this plan was extracted from that file.

---

## File Map

| File | Action |
|---|---|
| `frontend/src/index.css` | Fix 8 keyframes, add `hailFall` |
| `frontend/src/modules/route/reel/reel-constants.ts` | **Create** — all design tokens |
| `frontend/src/shared/store.tsx` | Fix `personaProfile` persistence |
| `frontend/src/modules/route/reco-engine/signal.ts` | Read `rawOBAnswers` not `obAnswers` |
| `frontend/src/modules/route/reco-engine/signal.test.ts` | Update tests to use `rawOBAnswers` |
| `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` | Remove `!savedItem` guard; fix telemetry field |
| `frontend/src/modules/route/reco-engine/engine.ts` | Add 4 missing `gapToCard` templates |
| `frontend/src/modules/route/reco-engine/engine.test.ts` | Add tests for 4 new templates |
| `frontend/src/modules/route/reel/ReelIntroCard.tsx` | Full rewrite |
| `frontend/src/modules/route/reel/ReelStopCard.tsx` | Full rewrite |
| `frontend/src/modules/route/reel/ReelRecoCard.tsx` | Full rewrite |
| `frontend/src/modules/route/reel/ReelDayDividerCard.tsx` | Full rewrite |
| `frontend/src/modules/route/reel/ReelTransitCard.tsx` | Audit + patch |
| `frontend/src/modules/route/reel/ReelIntelCard.tsx` | Audit + patch |
| `frontend/src/modules/route/reel/ReelBalanceCard.tsx` | Audit + patch |
| `frontend/src/modules/route/reel/ReelSummaryCard.tsx` | Audit + patch |
| `frontend/src/modules/route/reel/ReelFinaleCard.tsx` | Audit + patch |

---

### Task 1: Fix CSS Keyframes

**Files:**
- Modify: `frontend/src/index.css`

The current keyframes are wrong in 6 places and `hailFall` is missing entirely. All values below are extracted directly from `reel-mock.html`.

- [ ] **Step 1: Find and replace all 8 broken keyframes**

Open `frontend/src/index.css`. Find the `@keyframes precip` block and replace everything from `@keyframes precip` through `@keyframes sunGlow { ... }`. Replace with:

```css
@keyframes precip {
  from { transform: translateY(-40px); }
  to   { transform: translateY(700px); }
}
@keyframes snowFall {
  from { transform: translateY(-40px); }
  to   { transform: translateY(700px); }
}
@keyframes hailFall {
  from { transform: translateY(-40px); }
  to   { transform: translateY(700px); }
}
@keyframes snowSway1 {
  0%, 100% { margin-left: -8px; }
  50%      { margin-left:  8px; }
}
@keyframes snowSway2 {
  0%, 100% { margin-left:  6px; }
  50%      { margin-left: -6px; }
}
@keyframes snowSway3 {
  0%, 100% { margin-left: -4px; }
  50%      { margin-left:  4px; }
}
@keyframes fogDriftL {
  from { transform: translateX(-15%); }
  to   { transform: translateX(25%);  }
}
@keyframes fogDriftR {
  from { transform: translateX(25%);  }
  to   { transform: translateX(-15%); }
}
@keyframes rayRotate {
  from { transform: rotate(-2deg); }
  to   { transform: rotate(2deg);  }
}
@keyframes sunGlow {
  0%, 100% { opacity: .65; }
  50%      { opacity: 1;   }
}
```

- [ ] **Step 2: Run dev server and visually verify rain is vertical**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run dev
```

Navigate to the reel. Rain streaks must fall straight down (no diagonal). Sun rays must oscillate gently (not spin). Fog must drift left/right slowly.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix(reel): correct 8 broken CSS keyframes, add hailFall"
```

---

### Task 2: Create `reel-constants.ts`

**Files:**
- Create: `frontend/src/modules/route/reel/reel-constants.ts`

All pixel values, colors, and animation parameters extracted from `reel-mock.html`. Card components import from here — no literals scattered across files.

- [ ] **Step 1: Create the file**

```typescript
// frontend/src/modules/route/reel/reel-constants.ts
// All values extracted from frontend/public/reel-mock.html — do not edit without checking mock first.

// ── Layout ────────────────────────────────────────────────────
export const REEL_CONTENT_PADDING_INTRO = '0 17px 32px'
export const REEL_CONTENT_PADDING_STOP  = '0 15px 26px'
export const REEL_CONTENT_PADDING_RECO  = '0 18px 88px'

// ── Shared scrim (identical on all photo cards) ───────────────
export const REEL_SCRIM =
  'linear-gradient(180deg,transparent 0%,transparent 35%,rgba(0,0,0,.45) 65%,rgba(0,0,0,.85) 90%,rgba(10,10,13,.95) 100%)'

// ── Sky tints ─────────────────────────────────────────────────
export const SKY_TINT_SUNNY    = 'linear-gradient(180deg,rgba(255,210,140,.18),rgba(255,210,140,.04) 40%,transparent 70%)'
export const SKY_TINT_RAIN     = 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))'   // used as double layer
export const SKY_TINT_THUNDER  = 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))'  // used as double layer
export const SKY_TINT_OVERCAST = 'linear-gradient(180deg,rgba(70,82,100,.65) 0%,rgba(70,82,100,.48) 60%,rgba(70,82,100,.35) 100%)'
export const SKY_TINT_PC       = 'linear-gradient(180deg,rgba(150,165,185,.16),rgba(150,165,185,.04) 60%,transparent)'
export const SKY_TINT_FOG      = 'linear-gradient(180deg,rgba(90,100,115,.55),rgba(70,82,95,.40))'
export const SKY_TINT_DRIZZLE  = 'linear-gradient(180deg,rgba(40,55,80,.55),rgba(40,55,80,.35))'
export const SKY_TINT_SNOW     = 'linear-gradient(180deg,rgba(50,65,90,.45),rgba(50,65,90,.28))'
export const SKY_TINT_NIGHT    = 'linear-gradient(180deg,rgba(20,28,55,.30),rgba(35,50,98,.45) 45%,rgba(40,55,110,.65) 75%,rgba(22,32,72,.85))'

// ── Time-of-day gradients (reduced 80% per mock comment) ─────
export const TOD_EARLY_MORNING = 'linear-gradient(180deg,rgba(255,210,180,.08) 0%,rgba(255,180,140,.18) 40%,rgba(250,150,110,.40) 72%,rgba(228,118,86,.62) 92%,rgba(212,98,68,.68) 100%)'
export const TOD_MORNING       = 'linear-gradient(180deg,rgba(255,225,180,.05) 0%,rgba(255,205,140,.16) 50%,rgba(238,168,100,.40) 78%,rgba(216,138,80,.62) 100%)'
export const TOD_AFTERNOON     = 'linear-gradient(180deg,rgba(180,210,235,.14) 0%,rgba(220,225,210,.08) 35%,rgba(245,225,170,.24) 70%,rgba(232,205,150,.40) 92%,rgba(218,188,130,.50) 100%)'
export const TOD_DUSK          = 'linear-gradient(180deg,rgba(80,55,120,.18) 0%,rgba(180,70,110,.28) 38%,rgba(200,80,90,.44) 60%,rgba(160,55,110,.60) 82%,rgba(95,40,130,.68) 100%)'
export const TOD_NIGHT         = 'linear-gradient(180deg,rgba(20,28,55,.24) 0%,rgba(35,50,98,.36) 45%,rgba(40,55,110,.52) 75%,rgba(22,32,72,.68) 100%)'

// ── ToD badge dot colours ─────────────────────────────────────
export const TOD_DOT_EARLY_MORNING = '#f0a079'
export const TOD_DOT_MORNING       = '#f0b878'
export const TOD_DOT_AFTERNOON     = '#e8d292'
export const TOD_DOT_DUSK          = '#d4706a'
export const TOD_DOT_NIGHT         = '#6a82c8'

// ── ToD helpers ───────────────────────────────────────────────
export function todGradient(hour: number): string {
  if (hour >= 20 || hour < 6) return TOD_NIGHT
  if (hour < 8)               return TOD_EARLY_MORNING
  if (hour < 11)              return TOD_MORNING
  if (hour < 17)              return TOD_AFTERNOON
  return TOD_DUSK
}

export function todDotColor(hour: number): string {
  if (hour >= 20 || hour < 6) return TOD_DOT_NIGHT
  if (hour < 8)               return TOD_DOT_EARLY_MORNING
  if (hour < 11)              return TOD_DOT_MORNING
  if (hour < 17)              return TOD_DOT_AFTERNOON
  return TOD_DOT_DUSK
}

export function todLabel(hour: number): string {
  if (hour >= 20 || hour < 6) return 'Night · 20:00–04:30'
  if (hour < 8)               return 'Early morning · 06:00–08:00'
  if (hour < 11)              return 'Morning · 08:00–11:00'
  if (hour < 17)              return 'Afternoon · 11:00–16:00'
  return 'Dusk · 18:00–20:00'
}

// ── Sky tint helper ───────────────────────────────────────────
// Returns the tint gradient string(s). Double-layer conditions return an array.
export type SkyTintResult = { single: string } | { double: string }

export function skyTintForCondition(condition: string): SkyTintResult {
  const c = condition.toLowerCase()
  if (c.includes('thunder') || c.includes('storm')) return { double: SKY_TINT_THUNDER }
  if (c === 'rain')                                  return { double: SKY_TINT_RAIN }
  if (c.includes('snow') || c.includes('blizzard'))  return { single: SKY_TINT_SNOW }
  if (c === 'drizzle')                               return { single: SKY_TINT_DRIZZLE }
  if (c === 'fog' || c === 'mist')                   return { single: SKY_TINT_FOG }
  if (c.includes('overcast') || c === 'cloud')       return { single: SKY_TINT_OVERCAST }
  if (c.includes('partly'))                          return { single: SKY_TINT_PC }
  if (c === 'night' || c === 'clear night')          return { single: SKY_TINT_NIGHT }
  return { single: SKY_TINT_SUNNY } // sunny, clear, default
}

// ── Rain / drizzle particle params ───────────────────────────
export const RAIN_COUNT         = 64    // full rain streak count
export const DRIZZLE_COUNT      = 44    // drizzle streak count
export const RAIN_SEED          = 42    // deterministic seed (intro card)
export const RAIN_WIDTH         = '1.5px'
export const RAIN_LEN_MIN       = 20    // px
export const RAIN_LEN_RANGE     = 26    // px added by rng
export const RAIN_DUR_MIN       = 0.45  // seconds
export const RAIN_DUR_RANGE     = 0.45
export const RAIN_DELAY_RANGE   = 1.8   // max negative delay
export const RAIN_OPACITY_MIN   = 0.6
export const RAIN_OPACITY_RANGE = 0.4
export const RAIN_BG = 'linear-gradient(to bottom,transparent,rgba(200,225,255,1))'

export const DRIZZLE_WIDTH      = '1px'
export const DRIZZLE_LEN_MIN   = 8
export const DRIZZLE_LEN_RANGE = 10
export const DRIZZLE_DUR_MIN   = 0.9
export const DRIZZLE_DUR_RANGE = 0.5

// ── Thunder extra ─────────────────────────────────────────────
export const THUNDER_COUNT  = 56
export const THUNDER_SEED   = 55
export const THUNDER_LEN_MIN    = 22
export const THUNDER_LEN_RANGE  = 30
export const THUNDER_COLOR  = 'rgba(230,220,255,1)'

// ── Snow particle params ──────────────────────────────────────
export const SNOW_COUNT = 44
export const SNOW_SEED  = 2

// ── Intro card ────────────────────────────────────────────────
export const INTRO_CITY_FS          = 50
export const INTRO_CITY_MB          = 13
export const INTRO_LABEL_MB         = 7
export const INTRO_PILL_GAP         = 6
export const INTRO_PILL_MB          = 11
export const INTRO_STRIP_BR         = 9
export const INTRO_STRIP_GAP        = 5
export const INTRO_TEXT_SHADOW      = '0 1px 6px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.6)'
export const TOD_BADGE_TOP          = 48
export const TOD_BADGE_LEFT         = 13

// ── Stop card ─────────────────────────────────────────────────
export const STOP_H2_FS             = 30
export const STOP_H2_LH             = 1.05
export const STOP_H2_MB             = 8
export const STOP_H2_TEXT_SHADOW    = '0 1px 5px rgba(0,0,0,.85),0 2px 14px rgba(0,0,0,.5)'
export const STOP_COUNTER_BR        = 5
export const STOP_COUNTER_PAD       = '2px 8px'
export const STOP_COUNTER_MB        = 5
export const STOP_TIME_ROW_BR       = 6
export const STOP_TIME_ROW_PAD      = '3px 9px'
export const STOP_TIME_ROW_MB       = 8
export const STOP_META_ROW_MB       = 9

// ── Reco card ─────────────────────────────────────────────────
export const RECO_NEAR_BR           = 9
export const RECO_NEAR_MB           = 12
export const RECO_TRIGGER_BR        = 7
export const RECO_TRIGGER_MB        = 9
export const RECO_HEADLINE_FS       = 26
export const RECO_HEADLINE_MB       = 5
export const RECO_CONSEQUENCE_MB    = 16
export const RECO_PLACE_ROWS_GAP    = 7
export const RECO_PLACE_ROWS_MB     = 14
export const RECO_RANK_SIZE         = 20
export const RECO_RANK_FS           = 9

// ── Day divider card ──────────────────────────────────────────
export const DIVIDER_BG       = 'linear-gradient(160deg,#0c1018 0%,#141820 50%,#0e1410 100%)'
export const DIVIDER_GHOST_FS = 88
export const DIVIDER_CITY_FS  = 42
export const DIVIDER_DATE_FS  = 10
export const DIVIDER_LINE_W   = 40

// ── Weather icon map ──────────────────────────────────────────
export const WEATHER_ICON: Record<string, string> = {
  sunny: 'wb_sunny', clear: 'wb_sunny',
  partly_cloudy: 'partly_cloudy_day',
  overcast: 'cloud', cloud: 'cloud',
  drizzle: 'rainy_light',
  rain: 'water_drop',
  thunderstorm: 'thunderstorm', storm: 'thunderstorm',
  snow: 'ac_unit', sleet: 'weather_mix', blizzard: 'ac_unit',
  fog: 'foggy', mist: 'foggy',
  night: 'bedtime', 'clear night': 'bedtime',
}

// ── Engine strip copy (intro card engine changes) ─────────────
export const ENGINE_STRIP_COPY: Record<string, { icon: string; text: (n: number) => string }> = {
  swap:       { icon: 'swap_horiz', text: n => n > 1 ? `Rearranged ${n} stops to improve your route` : 'Rearranged one stop to improve your route' },
  insert:     { icon: 'add_circle', text: n => `Added ${n > 1 ? `${n} stops` : 'a stop'} based on your preferences` },
  resequence: { icon: 'swap_horiz', text: n => `Reordered ${n > 1 ? `${n} stops` : 'stops'} for a better route` },
  weather:    { icon: 'wb_cloudy',  text: _ => 'Outdoor stops adjusted around the weather forecast' },
  transit:    { icon: 'train',      text: _ => 'Timing adjusted around your transit' },
  advisory:   { icon: 'info',       text: _ => 'A few adjustments based on local knowledge' },
  evening:    { icon: 'nightlife',  text: _ => 'Evening kept open based on your exploration preference' },
  culture:    { icon: 'museum',     text: _ => 'Added a cultural stop matching your profile' },
}

// ── Seeded RNG factory ────────────────────────────────────────
// Same algorithm as reel-mock.html: (seed * 9301 + 49297) % 233280
export function makeRng(initial: number): () => number {
  let seed = initial
  return () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors from `reel-constants.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/reel-constants.ts
git commit -m "feat(reel): add reel-constants.ts with all design tokens from mock"
```

---

### Task 3: Fix `personaProfile` Persistence

**Files:**
- Modify: `frontend/src/shared/store.tsx`

`personaProfile` is currently lost on page reload — only `{ archetype }` is saved. The reco engine needs the full profile to work after a refresh.

- [ ] **Step 1: Add `getStoredPersonaProfile` helper after `getStoredPersona` function**

Find `function getStoredPersona()` in `store.tsx` (around line 156). Add this function immediately after it:

```typescript
function getStoredPersonaProfile(): import('./types').PersonaProfile | null {
  try {
    const stored = localStorage.getItem('ur_persona_profile');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Wire initial state to restore personaProfile**

Find the `personaProfile: null` line in the initial state object (around line 254). Change it to:

```typescript
personaProfile: getStoredPersonaProfile(),
```

- [ ] **Step 3: Persist full profile in `SET_PERSONA_PROFILE` reducer case**

Find the `case 'SET_PERSONA_PROFILE':` block (around line 605). Replace the try/catch inside it:

```typescript
case 'SET_PERSONA_PROFILE':
  try {
    localStorage.setItem('ur_persona', JSON.stringify({ archetype: action.profile.archetype }));
    localStorage.setItem('ur_persona_profile', JSON.stringify(action.profile));
  } catch { /* ignore */ }
  return { ...state, personaProfile: action.profile };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Manual test — personaProfile survives reload**

Start dev server (`npm run dev`). Complete onboarding. Open DevTools → Application → localStorage → verify `ur_persona_profile` is present with full JSON. Hard-refresh. Open app — `personaProfile` should still be non-null (confirm in React DevTools or by checking that map/reel features work normally).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/store.tsx
git commit -m "fix(store): persist full personaProfile to localStorage on SET_PERSONA_PROFILE"
```

---

### Task 4: Fix Reco Signal — Read `rawOBAnswers`

**Files:**
- Modify: `frontend/src/modules/route/reco-engine/signal.ts`
- Modify: `frontend/src/modules/route/reco-engine/signal.test.ts`

`computeRecoSignal` reads `state.obAnswers` which is always null in the current app. The OB flow populates `state.rawOBAnswers` instead. This makes `archetypeConfidence` always 0 and all behavioral signals default to generic values.

- [ ] **Step 1: Update signal tests to use `rawOBAnswers`**

Replace the full contents of `frontend/src/modules/route/reco-engine/signal.test.ts`:

```typescript
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
    rawOBAnswers: {
      group: 'solo',
      mood: ['explore', 'culture'],
      pace: ['slow'],
      day_open: 'coffee',
      dietary: [],
      budget: 'mid_range',
      evening: 'dinner_wind',
    },
    persona: { archetype: 'explorer', archetype_name: 'Explorer', archetype_desc: '', ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null, archetypeData: { name: 'Explorer', desc: '', venue_filters: [], itinerary_bias: [] }, venue_filters: [], itinerary_bias: [] },
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
  it('maps pace slow → slow', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.pace).toBe('slow');
  });

  it('maps pace pack → fast', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, pace: ['pack'] } }), 0, BASE_ITIN);
    expect(signal.pace).toBe('fast');
  });

  it('maps pace balanced → moderate', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, pace: ['balanced'] } }), 0, BASE_ITIN);
    expect(signal.pace).toBe('moderate');
  });

  it('maps group solo → solo', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.social).toBe('solo');
  });

  it('maps group family → group and sets isFamily true', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, group: 'family' } }), 0, BASE_ITIN);
    expect(signal.social).toBe('group');
    expect(signal.isFamily).toBe(true);
  });

  it('maps group couple → duo', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, group: 'couple' } }), 0, BASE_ITIN);
    expect(signal.social).toBe('duo');
  });

  it('sets archetypeConfidence to 1.0 (mandatory OB)', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.archetypeConfidence).toBe(1.0);
  });

  it('maps day_open coffee → ritualStrength 0.8', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.ritualStrength).toBe(0.8);
  });

  it('maps day_open straight → ritualStrength 0.1', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, day_open: 'straight' } }), 0, BASE_ITIN);
    expect(signal.ritualStrength).toBe(0.1);
  });

  it('sets sensoryIntensity from mood max', () => {
    // culture → 0.7, explore → 0.6 — max = 0.7
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.sensoryIntensity).toBe(0.7);
  });

  it('sets weather.isOutdoorFriendly true for sunny above 10°', () => {
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
    expect(signal.trip.isLastDay).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — they will fail (signal still reads obAnswers)**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/signal.test.ts 2>&1 | tail -20
```

Expected: multiple FAIL — pace, social, archetypeConfidence, ritualStrength, sensoryIntensity.

- [ ] **Step 3: Rewrite `signal.ts` to read `rawOBAnswers`**

Replace the full contents of `frontend/src/modules/route/reco-engine/signal.ts`:

```typescript
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
  state: Pick<AppState, 'rawOBAnswers' | 'persona' | 'travelStartDate' | 'tripContext' | 'weather' | 'savedEvents' | 'dismissedPinIds' | 'pendingTripDetails' | 'journey'>,
  dayIdx: number,
  itinerary: EngineItinerary,
): RecoSignal {
  const raw = state.rawOBAnswers;
  const weights: EngineWeights = itinerary.personaSnapshot;
  const archetype = (itinerary.archetypeSnapshot as string) ?? state.persona?.archetype ?? 'explorer';
  const archetypeKey = archetype.toLowerCase().replace(/\s+/g, '');

  // pace: first entry in raw.pace array
  const paceMap: Record<string, 'slow' | 'moderate' | 'fast'> = {
    slow: 'slow', balanced: 'moderate', pack: 'fast', spontaneous: 'moderate',
  };
  const pace = raw?.pace?.[0] ? (paceMap[raw.pace[0]] ?? 'moderate') : 'moderate';

  // social
  const socialMap: Record<string, 'solo' | 'duo' | 'group'> = {
    solo: 'solo', couple: 'duo', family: 'group', friends: 'group',
  };
  const social = raw?.group ? (socialMap[raw.group] ?? 'solo') : 'solo';
  const isFamily = raw?.group === 'family';

  // ritual strength from day_open answer
  const ritualMap: Record<string, number> = {
    coffee: 0.8, breakfast: 0.5, grab_go: 0.3, straight: 0.1,
  };
  const ritualStrength = raw?.day_open ? (ritualMap[raw.day_open] ?? 0.4) : 0.4;

  // sensory intensity: max of mood array values
  const sensoryMap: Record<string, number> = {
    culture: 0.7, eat_drink: 0.7, explore: 0.6, relax: 0.4,
  };
  const sensoryIntensity = raw?.mood?.length
    ? Math.max(...raw.mood.map(m => sensoryMap[m] ?? 0.4))
    : 0.4;

  // spontaneity bias
  const spontaneityBias = Math.min(
    1,
    weights.w_spontaneity * 0.6 + (raw?.pace?.includes('spontaneous') ? 0.4 : 0),
  );

  // archetypeConfidence: OB is mandatory — always 1.0
  const archetypeConfidence = 1.0;

  const day = itinerary.days[dayIdx];
  const totalDays = itinerary.days.length;
  const dayNumber = dayIdx + 1;
  const currentDayDate = day?.date ?? state.travelStartDate ?? '';
  let isWeekend = false;
  if (currentDayDate) {
    const d = new Date(currentDayDate);
    isWeekend = d.getDay() === 0 || d.getDay() === 6;
  }

  const departureTime = dayIdx === totalDays - 1
    ? (state.pendingTripDetails?.departureTime ?? null)
    : null;

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

- [ ] **Step 4: Run tests — all must pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/signal.test.ts 2>&1 | tail -20
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reco-engine/signal.ts frontend/src/modules/route/reco-engine/signal.test.ts
git commit -m "fix(reco-engine): read rawOBAnswers instead of legacy obAnswers in computeRecoSignal"
```

---

### Task 5: Fix Engine — Remove Guard + Add 4 Missing Templates

**Files:**
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx`
- Modify: `frontend/src/modules/route/reco-engine/engine.ts`
- Modify: `frontend/src/modules/route/reco-engine/engine.test.ts`

Two separate fixes: (1) the `!savedItem` guard prevents the engine running for saved-trip reels, (2) four `gapToCard` templates are missing so those gaps are silently dropped.

- [ ] **Step 1: Write failing engine tests for the 4 missing templates**

Open `frontend/src/modules/route/reco-engine/engine.test.ts`. Add these tests at the end of the file (before the closing `}`):

```typescript
describe('gapToCard — previously missing templates', () => {
  const BASE_STOPS: EngineItineraryStop[] = [{
    id: 's1', placeId: 'p1', title: 'Test Place', area: 'Shinjuku', day: 1,
    time: '10:00', durationMin: 60, category: 'museum', lat: 35.6, lon: 139.7,
    priceLevel: 2, rating: 4.2, weekdayText: null, whyForYou: '', localTip: null,
    googleMapsUrl: null, website: null, photoRef: null,
  }];

  const BASE_SIGNAL: RecoSignal = {
    weights: { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.5, w_culture_depth: 0.5, w_nightlife: 0.5, w_budget_sensitivity: 0.5, w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5 },
    archetype: 'explorer', archetypeGroup: 'explorer', archetypeConfidence: 1.0,
    pace: 'moderate', social: 'solo', isFamily: false,
    ritualStrength: 0.5, sensoryIntensity: 0.5, spontaneityBias: 0.5,
    trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Tokyo', currentDayDate: '2026-05-26' },
    weather: null, dismissedPinIds: new Set(), savedEvents: [],
  };

  function makeGap(dimension: keyof ItineraryProfile, direction: 'missing' | 'excess' = 'missing'): Gap {
    return { dimension, target: 1, actual: 0, delta: direction === 'missing' ? 1 : -1, dimensionWeight: 0.5, significance: 0.5, direction, conflictPresent: false };
  }

  it('hasHiddenGem returns a card with trigger hidden_gem', () => {
    const card = gapToCard(makeGap('hasHiddenGem'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('hidden_gem');
  });

  it('categoryDiversity returns a card with trigger category_diversity', () => {
    const card = gapToCard(makeGap('categoryDiversity'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('category_diversity');
  });

  it('timeBalance missing returns time_balance card', () => {
    const card = gapToCard(makeGap('timeBalance', 'missing'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('time_balance');
  });

  it('geoEfficiency returns a card with trigger geo_efficiency', () => {
    const card = gapToCard(makeGap('geoEfficiency'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('geo_efficiency');
  });
});
```

- [ ] **Step 2: Run tests — they must fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/engine.test.ts 2>&1 | tail -20
```

Expected: 4 new tests FAIL with "card is null".

- [ ] **Step 3: Add 4 missing templates to `engine.ts`**

Open `frontend/src/modules/route/reco-engine/engine.ts`. Find the `templates` object inside `gapToCard` (it starts with `const templates: Partial<Record<...>> = {`). Add these four entries before the closing `}`:

```typescript
    hasHiddenGem: {
      trigger: 'hidden_gem',
      label: 'A local spot worth knowing about',
      consequence: `Close to your route — the kind of place most visitors walk past.`,
    },
    categoryDiversity: {
      trigger: 'category_diversity',
      label: 'All similar stops today',
      consequence: `One different kind of stop often makes the rest feel better.`,
    },
    timeBalance: {
      trigger: 'time_balance',
      label: gap.direction === 'excess' ? 'Heavy start, quiet finish' : 'Light start to the day',
      consequence: gap.direction === 'excess'
        ? `Most of today is front-loaded. The afternoon is clear if you want to add something.`
        : `The morning is quiet — room to add something before the day picks up.`,
    },
    geoEfficiency: {
      trigger: 'geo_efficiency',
      label: 'Route doubles back today',
      consequence: `A couple of stops are out of sequence — reordering saves meaningful time.`,
    },
```

- [ ] **Step 4: Remove `!savedItem` guard and fix telemetry field**

Open `frontend/src/modules/route/reel/ItineraryReelScreen.tsx`.

Find line ~82:
```typescript
if (itinerary && state.persona && !savedItem) {
```
Change to:
```typescript
if (itinerary && state.persona) {
```

Find line ~247 (in `buildInteraction` call):
```typescript
archetype, state.obAnswers.pace ?? 'moderate', null, 1, state.weather?.condition ?? null,
```
Change to:
```typescript
archetype, state.rawOBAnswers?.pace?.[0] ?? 'moderate', null, 1, state.weather?.condition ?? null,
```

- [ ] **Step 5: Run all engine tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/reco-engine/engine.test.ts 2>&1 | tail -20
```

Expected: all tests PASS including the 4 new ones.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/reel/ItineraryReelScreen.tsx frontend/src/modules/route/reco-engine/engine.ts frontend/src/modules/route/reco-engine/engine.test.ts
git commit -m "fix(reco-engine): add 4 missing gapToCard templates, remove !savedItem guard, fix telemetry field"
```

---

### Task 6: Rewrite `ReelIntroCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelIntroCard.tsx`

Full rewrite from mock values. The existing component has ToD gradient drift, incorrect sky tint layers (single instead of double for rain/thunder), and wrong engine strip styling.

- [ ] **Step 1: Read current component to understand any interaction props to preserve**

```bash
head -30 /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ReelIntroCard.tsx
```

Note: preserve `onInteract` prop and its `viewed`/`lingered` effects if present.

- [ ] **Step 2: Replace the full contents of `ReelIntroCard.tsx`**

```typescript
import { useEffect, useRef, useMemo } from 'react';
import type { ReelIntroCard as ReelIntroCardType } from './types';
import {
  REEL_SCRIM, REEL_CONTENT_PADDING_INTRO,
  SKY_TINT_RAIN, SKY_TINT_THUNDER,
  todGradient, todDotColor, todLabel, skyTintForCondition,
  RAIN_COUNT, RAIN_SEED, RAIN_WIDTH, RAIN_LEN_MIN, RAIN_LEN_RANGE,
  RAIN_DUR_MIN, RAIN_DUR_RANGE, RAIN_DELAY_RANGE, RAIN_OPACITY_MIN, RAIN_OPACITY_RANGE, RAIN_BG,
  THUNDER_COUNT, THUNDER_SEED, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR,
  SNOW_COUNT, SNOW_SEED,
  INTRO_CITY_FS, INTRO_CITY_MB, INTRO_LABEL_MB, INTRO_PILL_GAP, INTRO_PILL_MB,
  INTRO_STRIP_BR, INTRO_STRIP_GAP, INTRO_TEXT_SHADOW,
  TOD_BADGE_TOP, TOD_BADGE_LEFT,
  WEATHER_ICON, ENGINE_STRIP_COPY, makeRng,
} from './reel-constants';

interface Props {
  card: ReelIntroCardType;
  active: boolean;
  onInteract?: (action: 'viewed' | 'lingered') => void;
}

function makeRainParticles(count: number, seedVal: number, lenMin: number, lenRange: number, color: string) {
  const rng = makeRng(seedVal);
  return Array.from({ length: count }, () => ({
    position: 'absolute' as const,
    left: `${rng() * 100}%`,
    top: '-15%',
    width: RAIN_WIDTH,
    height: `${lenMin + rng() * lenRange}px`,
    background: color === 'rain' ? RAIN_BG : `linear-gradient(to bottom,transparent,${color})`,
    opacity: RAIN_OPACITY_MIN + rng() * RAIN_OPACITY_RANGE,
    animation: `precip ${RAIN_DUR_MIN + rng() * RAIN_DUR_RANGE}s linear ${-rng() * RAIN_DELAY_RANGE}s infinite`,
  }));
}

function makeSnowParticles(seedVal: number) {
  const rng = makeRng(seedVal);
  return Array.from({ length: SNOW_COUNT }, (_, i) => {
    const size = 3 + rng() * 3;
    return {
      outer: {
        position: 'absolute' as const,
        left: `${rng() * 100}%`,
        top: '-10%',
        animation: `snowSway${(i % 3) + 1} ${2.5 + rng() * 2}s ease-in-out ${-rng() * 3}s infinite, snowFall ${3 + rng() * 4}s linear ${-rng() * 6}s infinite`,
      } as React.CSSProperties,
      inner: {
        width: size, height: size, borderRadius: '50%',
        background: 'rgba(220,235,255,0.85)', filter: 'blur(0.5px)',
      } as React.CSSProperties,
    };
  });
}

function SkyTintLayers({ condition }: { condition: string }) {
  const result = skyTintForCondition(condition);
  if ('double' in result) {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.double, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.double, opacity: 0.6, pointerEvents: 'none' }} />
      </>
    );
  }
  return <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.single, pointerEvents: 'none' }} />;
}

function SunRays() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: '-20%', top: '-20%', width: '90%', height: '80%', background: 'radial-gradient(ellipse at top right,rgba(255,215,150,.40),rgba(255,215,150,0) 60%)', filter: 'blur(6px)', animation: 'sunGlow 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '90%', height: '180%', transformOrigin: 'top right', animation: 'rayRotate 80s linear infinite' }}>
        <div style={{ position: 'absolute', top: 0, left: '40%', width: 80, height: '100%', background: 'linear-gradient(180deg,rgba(255,225,160,.25),rgba(255,225,160,0) 65%)', transform: 'rotate(18deg)', transformOrigin: 'top center', filter: 'blur(12px)' }} />
        <div style={{ position: 'absolute', top: 0, left: '55%', width: 40, height: '100%', background: 'linear-gradient(180deg,rgba(255,235,180,.35),rgba(255,235,180,0) 65%)', transform: 'rotate(14deg)', transformOrigin: 'top center', filter: 'blur(8px)' }} />
      </div>
    </div>
  );
}

export function ReelIntroCard({ card, active, onInteract }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hour = new Date().getHours();
  const condition = (card.weather?.condition ?? 'clear').toLowerCase();
  const isSunny = condition === 'sunny' || condition === 'clear';
  const isRain = condition === 'rain' || condition === 'drizzle';
  const isThunder = condition.includes('thunder') || condition.includes('storm');
  const isSnow = condition.includes('snow') || condition.includes('blizzard');

  const rainParticles = useMemo(
    () => isThunder
      ? makeRainParticles(THUNDER_COUNT, THUNDER_SEED, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR)
      : makeRainParticles(RAIN_COUNT, RAIN_SEED, RAIN_LEN_MIN, RAIN_LEN_RANGE, 'rain'),
    [isThunder],
  );
  const snowParticles = useMemo(() => makeSnowParticles(SNOW_SEED), []);

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]);

  const dayCount = card.totalDays ?? 1;
  const tripLabel = dayCount === 1 ? 'Your day in' : `Your ${dayCount}-day trip`;
  const dotColor = todDotColor(hour);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#0c0c0e' }}>

      {/* City photo z-index:0 */}
      {card.imageUrl && (
        <img src={card.imageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="" />
      )}

      {/* Sky tint z-index:2 */}
      <SkyTintLayers condition={condition} />

      {/* GRADIENT scrim z-index:3 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* ToD gradient z-index:4 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGradient(hour), pointerEvents: 'none' }} />

      {/* Sun rays z-index:4 (sunny only) */}
      {isSunny && <SunRays />}

      {/* Weather particles z-index:5 */}
      {(isRain || isThunder || isSnow) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {isSnow
            ? snowParticles.map((f, i) => (
                <div key={i} style={f.outer}><div style={f.inner as React.CSSProperties} /></div>
              ))
            : rainParticles.map((s, i) => <div key={i} style={s} />)
          }
          {isThunder && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 6, background: 'radial-gradient(ellipse at 50% 25%,rgba(230,220,255,.95),rgba(180,150,230,.5) 32%,rgba(120,80,180,0) 70%)', mixBlendMode: 'screen', pointerEvents: 'none', animation: 'flashFlicker 3.4s ease-out -1.3s infinite' }} />
          )}
        </div>
      )}

      {/* ToD badge z-index:11 */}
      <div style={{ position: 'absolute', top: TOD_BADGE_TOP, left: TOD_BADGE_LEFT, zIndex: 11, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: 'rgba(12,14,22,.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', maxWidth: 170, overflow: 'hidden' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {todLabel(hour)}
        </span>
      </div>

      {/* Trip details button z-index:10 */}
      <button style={{ position: 'absolute', top: TOD_BADGE_TOP, right: 13, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 999, background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(10px)', border: '1px solid var(--color-border-m)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.82)', cursor: 'pointer' }}>
        <span className="ms" style={{ fontSize: 13 }}>edit_calendar</span>
        Add trip details
      </button>

      {/* Content z-index:10 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: REEL_CONTENT_PADDING_INTRO }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: INTRO_LABEL_MB }}>
          {tripLabel}
        </p>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: INTRO_CITY_FS, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: INTRO_CITY_MB, textShadow: INTRO_TEXT_SHADOW }}>
          {card.city}
        </h1>

        {/* Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: INTRO_PILL_GAP, marginBottom: INTRO_PILL_MB }}>
          <span className="pill pg">
            <span className="ms fill" style={{ fontSize: 11 }}>place</span>
            {card.totalStops} stops
          </span>
          {card.weather && (
            <span className="pill pg">
              <span className="ms fill" style={{ fontSize: 11 }}>{WEATHER_ICON[condition] ?? 'wb_sunny'}</span>
              {card.weather.temp}° · {card.weather.condition}
            </span>
          )}
        </div>

        {/* Engine strips */}
        {card.engineChanges.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: INTRO_STRIP_GAP }}>
            {card.engineChanges.slice(0, 2).map((change, i) => {
              const copy = ENGINE_STRIP_COPY[change.type];
              if (!copy) return null;
              return (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: INTRO_STRIP_BR, background: 'rgba(0,0,0,.28)', border: '1px solid var(--color-border)', backdropFilter: 'blur(6px)' }}>
                  <span className="ms" style={{ fontSize: 12, color: 'var(--color-primary)' }}>{copy.icon}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-2)' }}>{copy.text(change.count)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Swipe hint */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span className="ms" style={{ fontSize: 17, color: 'rgba(255,255,255,.2)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | grep "ReelIntroCard\|reel-constants" | head -10
```

Expected: no errors.

- [ ] **Step 4: Visual test in browser**

Run `npm run dev`. Navigate to reel. Verify intro card against `frontend/public/reel-mock.html` at 390px width (Chrome DevTools → iPhone 14):
- City name: 50px Cormorant Garamond
- Engine strips: dark semi-transparent pill, 9px border-radius, primary-color icon
- ToD badge: top-left, correct colour dot for time of day
- Rain: vertical streaks only (no diagonal)
- Swipe hint: centered, faint `swipe_up` icon

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/ReelIntroCard.tsx
git commit -m "feat(reel): rewrite ReelIntroCard from mock — correct sky tints, ToD gradient, engine strips"
```

---

### Task 7: Rewrite `ReelStopCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx`

Full rewrite. Key fixes: double-layer sky tint for rain/thunder, rain streak gradient background (not solid), time row border-radius 6px, stop counter style, h2 line-height 1.05.

- [ ] **Step 1: Replace the full contents of `ReelStopCard.tsx`**

```typescript
import { useEffect, useRef, useMemo } from 'react';
import type { ReelStopCard as ReelStopCardType } from './types';
import { getPlacePhotoUrl } from '../../../shared/api';
import {
  REEL_SCRIM, REEL_CONTENT_PADDING_STOP,
  todGradient, todDotColor, todLabel, skyTintForCondition,
  RAIN_COUNT, RAIN_SEED, RAIN_WIDTH, RAIN_LEN_MIN, RAIN_LEN_RANGE,
  RAIN_DUR_MIN, RAIN_DUR_RANGE, RAIN_DELAY_RANGE, RAIN_OPACITY_MIN, RAIN_OPACITY_RANGE, RAIN_BG,
  THUNDER_COUNT, THUNDER_SEED, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR,
  SNOW_COUNT, SNOW_SEED,
  STOP_H2_FS, STOP_H2_LH, STOP_H2_MB, STOP_H2_TEXT_SHADOW,
  STOP_COUNTER_BR, STOP_COUNTER_PAD, STOP_COUNTER_MB,
  STOP_TIME_ROW_BR, STOP_TIME_ROW_PAD, STOP_TIME_ROW_MB, STOP_META_ROW_MB,
  TOD_BADGE_TOP, TOD_BADGE_LEFT,
  WEATHER_ICON, makeRng,
} from './reel-constants';

interface Props {
  card: ReelStopCardType;
  active: boolean;
  archetype: string;
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered') => void;
  onRemove?: () => void;
}

function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}:00 ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function makeRainParticles(count: number, seedVal: number, lenMin: number, lenRange: number, color: string) {
  const rng = makeRng(seedVal);
  return Array.from({ length: count }, () => ({
    position: 'absolute' as const,
    left: `${rng() * 100}%`,
    top: '-15%',
    width: RAIN_WIDTH,
    height: `${lenMin + rng() * lenRange}px`,
    background: color === 'rain' ? RAIN_BG : `linear-gradient(to bottom,transparent,${color})`,
    opacity: RAIN_OPACITY_MIN + rng() * RAIN_OPACITY_RANGE,
    animation: `precip ${RAIN_DUR_MIN + rng() * RAIN_DUR_RANGE}s linear ${-rng() * RAIN_DELAY_RANGE}s infinite`,
  }));
}

function makeSnowParticles(seedVal: number) {
  const rng = makeRng(seedVal);
  return Array.from({ length: SNOW_COUNT }, (_, i) => {
    const size = 3 + rng() * 3;
    return {
      outer: { position: 'absolute' as const, left: `${rng() * 100}%`, top: '-10%', animation: `snowSway${(i % 3) + 1} ${2.5 + rng() * 2}s ease-in-out ${-rng() * 3}s infinite, snowFall ${3 + rng() * 4}s linear ${-rng() * 6}s infinite` } as React.CSSProperties,
      inner: { width: size, height: size, borderRadius: '50%', background: 'rgba(220,235,255,0.85)', filter: 'blur(0.5px)' } as React.CSSProperties,
    };
  });
}

function SkyTintLayers({ condition }: { condition: string }) {
  const result = skyTintForCondition(condition);
  if ('double' in result) {
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.double, mixBlendMode: 'multiply', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.double, opacity: 0.6, pointerEvents: 'none' }} />
      </>
    );
  }
  return <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: result.single, pointerEvents: 'none' }} />;
}

function SunRays() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: '-20%', top: '-20%', width: '90%', height: '80%', background: 'radial-gradient(ellipse at top right,rgba(255,215,150,.38),rgba(255,215,150,0) 60%)', filter: 'blur(6px)', animation: 'sunGlow 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: '90%', height: '180%', transformOrigin: 'top right', animation: 'rayRotate 80s linear infinite' }}>
        <div style={{ position: 'absolute', top: 0, left: '40%', width: 80, height: '100%', background: 'linear-gradient(180deg,rgba(255,225,160,.25),rgba(255,225,160,0) 65%)', transform: 'rotate(18deg)', transformOrigin: 'top center', filter: 'blur(12px)' }} />
        <div style={{ position: 'absolute', top: 0, left: '55%', width: 40, height: '100%', background: 'linear-gradient(180deg,rgba(255,235,180,.35),rgba(255,235,180,0) 65%)', transform: 'rotate(14deg)', transformOrigin: 'top center', filter: 'blur(8px)' }} />
      </div>
    </div>
  );
}

export function ReelStopCard({ card, active, archetype, onInteract, onRemove }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { stop } = card;
  const hour = new Date().getHours();
  const condition = (card.weather?.condition ?? 'clear').toLowerCase();
  const isSunny = condition === 'sunny' || condition === 'clear';
  const isThunder = condition.includes('thunder') || condition.includes('storm');
  const isSnow = condition.includes('snow') || condition.includes('blizzard');
  const hasParticles = ['rain', 'drizzle'].includes(condition) || isThunder || isSnow;

  // Use stop index as seed variation so each stop has different rain pattern
  const stopSeed = RAIN_SEED + (stop.day * 100 + card.stopNumber);
  const rainParticles = useMemo(
    () => isThunder
      ? makeRainParticles(THUNDER_COUNT, THUNDER_SEED + stopSeed, THUNDER_LEN_MIN, THUNDER_LEN_RANGE, THUNDER_COLOR)
      : makeRainParticles(RAIN_COUNT, stopSeed, RAIN_LEN_MIN, RAIN_LEN_RANGE, 'rain'),
    [isThunder, stopSeed],
  );
  const snowParticles = useMemo(() => makeSnowParticles(SNOW_SEED + stopSeed), [stopSeed]);

  const photoUrl = stop.imageUrl ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 800) : null);
  const dotColor = todDotColor(hour);

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]);

  const weatherIcon = WEATHER_ICON[condition] ?? 'wb_sunny';
  const weatherColor = isThunder ? '#a78bfa' : condition === 'rain' || condition === 'drizzle' ? '#60a5fa' : '#fbbf24';
  const weatherBg = isThunder ? 'rgba(8,4,18,.88)' : 'rgba(9,12,22,.82)';
  const weatherBorder = isThunder ? '1px solid rgba(124,58,237,.2)' : '1px solid var(--color-border)';

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#0c0c0e' }}>

      {/* Photo z-index:0 */}
      {photoUrl && (
        <img src={photoUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} alt="" />
      )}

      {/* Sky tint z-index:2 */}
      <SkyTintLayers condition={condition} />

      {/* GRADIENT scrim z-index:3 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: REEL_SCRIM, pointerEvents: 'none' }} />

      {/* ToD gradient z-index:4 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGradient(hour), pointerEvents: 'none' }} />

      {/* Sun rays z-index:4 */}
      {isSunny && <SunRays />}

      {/* Weather particles z-index:5 */}
      {hasParticles && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, overflow: 'hidden', pointerEvents: 'none' }}>
          {isSnow
            ? snowParticles.map((f, i) => <div key={i} style={f.outer}><div style={f.inner} /></div>)
            : rainParticles.map((s, i) => <div key={i} style={s} />)
          }
          {isThunder && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 6, background: 'radial-gradient(ellipse at 50% 25%,rgba(230,220,255,.95),rgba(180,150,230,.5) 32%,rgba(120,80,180,0) 70%)', mixBlendMode: 'screen', animation: 'flashFlicker 3.4s ease-out -1.3s infinite', pointerEvents: 'none' }} />
          )}
        </div>
      )}

      {/* ToD badge z-index:11 */}
      <div style={{ position: 'absolute', top: TOD_BADGE_TOP, left: TOD_BADGE_LEFT, zIndex: 11, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 99, background: 'rgba(12,14,22,.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', maxWidth: 170, overflow: 'hidden' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{todLabel(hour)}</span>
      </div>

      {/* Weather badge z-index:10 */}
      {card.weather && (
        <div style={{ position: 'absolute', top: TOD_BADGE_TOP, right: 13, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: weatherBg, backdropFilter: 'blur(10px)', border: weatherBorder }}>
          <span className="ms fill" style={{ fontSize: 12, color: weatherColor }}>{weatherIcon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{card.weather.temp}°</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-3)' }}>{card.weather.condition}</span>
        </div>
      )}

      {/* Content z-index:10 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: REEL_CONTENT_PADDING_STOP }}>

        {/* Stop counter */}
        <div style={{ display: 'inline-flex', marginBottom: STOP_COUNTER_MB }}>
          <div style={{ padding: STOP_COUNTER_PAD, borderRadius: STOP_COUNTER_BR, background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(6px)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.58)', margin: 0 }}>
              Stop {card.stopNumber} of {card.totalStops}
            </p>
          </div>
        </div>

        {/* Time row */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: STOP_TIME_ROW_MB, padding: STOP_TIME_ROW_PAD, borderRadius: STOP_TIME_ROW_BR, background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(6px)' }}>
          <span className="ms" style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>schedule</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.88)', fontWeight: 600 }}>{fmt12h(stop.time)}</span>
          <span style={{ color: 'rgba(255,255,255,.18)' }}>·</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{fmtDuration(stop.durationMin)}</span>
          {card.movedFrom != null && (
            <span style={{ fontSize: 10, color: 'var(--color-primary)', fontWeight: 700, marginLeft: 3 }}>↑ rescheduled</span>
          )}
        </div>

        {/* Title */}
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: STOP_H2_FS, fontWeight: 700, color: '#fff', lineHeight: STOP_H2_LH, marginBottom: STOP_H2_MB, textShadow: STOP_H2_TEXT_SHADOW }}>
          {stop.title}
        </h2>

        {/* Metadata row */}
        <div style={{ display: 'flex', gap: 5, marginBottom: STOP_META_ROW_MB, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pill" style={{ fontSize: 10, background: 'rgba(0,0,0,.48)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.14)', color: 'rgba(255,255,255,.72)' }}>
            {stop.area}
          </span>
          {stop.rating != null && (
            <span className="pill pa" style={{ fontSize: 10 }}>{stop.rating} ★</span>
          )}
        </div>

        {/* Order reason (crowd timing / opening hours) */}
        {card.orderReason && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
            <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, marginTop: 1 }}>schedule</span>
            <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{card.orderReason}</p>
          </div>
        )}

        {/* Order consequence */}
        {card.orderConsequence && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
            <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)', flexShrink: 0, marginTop: 1 }}>check_circle</span>
            <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{card.orderConsequence}</p>
          </div>
        )}

        {/* AI line (whyForYou) */}
        {stop.whyForYou && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--color-primary)', flexShrink: 0 }}>✦</span>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.55, fontStyle: 'italic' }}>{stop.whyForYou}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | grep "ReelStopCard" | head -10
```

Expected: no errors.

- [ ] **Step 3: Visual test in browser at 390px**

Verify against mock:
- Stop counter: dark pill, `rgba(0,0,0,.40)`, border-radius 5px
- Time row: `rgba(0,0,0,.40)` pill, border-radius 6px, `schedule` icon 11px faint
- Title: 30px Cormorant, line-height 1.05
- Rain: vertical gradient streaks (no solid background, no rotation)
- Thunder: double-layer purple sky tint + lightning flash (no bolt, radial only)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "feat(reel): rewrite ReelStopCard from mock — correct sky tints, rain gradient streaks, time row"
```

---

### Task 8: Rewrite `ReelRecoCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelRecoCard.tsx`

Full rewrite. Key changes: padding `0 18px 88px` (not 22px), near badge border-radius 9px, trigger chip 7px, rank circle 20px/9px font, remove "Add to plan" CTA button not present in mock, fix place rows gap to 7px.

- [ ] **Step 1: Replace the full contents of `ReelRecoCard.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import { useReelRecommendations } from './useReelRecommendations';
import { useAppStore } from '../../../shared/store';
import type { ReelRecoCard as ReelRecoCardType } from './types';
import type { ReelRecoPlace } from '../../../shared/types';
import {
  REEL_CONTENT_PADDING_RECO,
  RECO_NEAR_BR, RECO_NEAR_MB, RECO_TRIGGER_BR, RECO_TRIGGER_MB,
  RECO_HEADLINE_FS, RECO_HEADLINE_MB, RECO_CONSEQUENCE_MB,
  RECO_PLACE_ROWS_GAP, RECO_PLACE_ROWS_MB, RECO_RANK_SIZE, RECO_RANK_FS,
} from './reel-constants';

interface Props {
  card: ReelRecoCardType;
  active: boolean;
  archetype: string;
  existingPlaceIds: string[];
  onInteract?: (action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan') => void;
}

const TRIGGER_CFG: Record<string, { icon: string; color: string; bg: string; chipLabel: string }> = {
  lunch:             { icon: 'restaurant',      color: '#c27c4a', bg: 'rgba(194,124,74,.1)',  chipLabel: 'Lunch window' },
  dinner:            { icon: 'dinner_dining',   color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Dinner window' },
  evening:           { icon: 'nightlight',      color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Evening' },
  culture:           { icon: 'museum',          color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Culture' },
  rest:              { icon: 'local_cafe',      color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Rest break' },
  weather:           { icon: 'wb_cloudy',       color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Weather alert' },
  closing_conflict:  { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Timing conflict' },
  walking_gap:       { icon: 'directions_walk', color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Long walk' },
  crowd_peak:        { icon: 'groups',          color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Peak hours' },
  density_excess:    { icon: 'schedule',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Packed day' },
  density_sparse:    { icon: 'explore',         color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Room to add' },
  geo_efficiency:    { icon: 'route',           color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Route' },
  time_balance:      { icon: 'balance',         color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', chipLabel: 'Time balance' },
  category_diversity:{ icon: 'grid_view',       color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Variety' },
  social_gap:        { icon: 'people',          color: '#4f8fab', bg: 'rgba(79,143,171,.1)',  chipLabel: 'Social' },
  budget_mismatch:   { icon: 'payments',        color: '#d4a853', bg: 'rgba(212,168,83,.1)',  chipLabel: 'Budget' },
  live_event:        { icon: 'event',           color: '#c27c4a', bg: 'rgba(194,124,74,.1)',  chipLabel: 'Live event' },
  hidden_gem:        { icon: 'auto_awesome',    color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', chipLabel: 'Hidden gem' },
};

const PRICE_DOTS: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

// Triggers where the background glow sits on the left side (from mock)
const GLOW_LEFT_TRIGGERS = new Set(['culture', 'walking_gap', 'geo_efficiency']);

function PlaceRow({ place, idx, active, accentColor }: { place: ReelRecoPlace; idx: number; active: boolean; accentColor: string }) {
  const delay = `${0.55 + idx * 0.1}s`;
  const isFirst = idx === 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: isFirst ? '11px 12px' : '10px 12px',
      borderRadius: 11,
      background: 'var(--color-surface)',
      border: isFirst ? `1.5px solid ${accentColor}28` : '1px solid var(--color-border)',
      opacity: active ? 1 : 0,
      transform: active ? 'translateY(0)' : 'translateY(8px)',
      transition: `opacity .4s ${delay} ease, transform .4s ${delay} ease`,
    }}>
      {/* Rank */}
      <div style={{
        width: RECO_RANK_SIZE, height: RECO_RANK_SIZE, borderRadius: '50%', flexShrink: 0,
        background: isFirst ? `${accentColor}22` : 'var(--color-surface2)',
        border: isFirst ? `1px solid ${accentColor}55` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: RECO_RANK_FS, fontWeight: 700,
        color: isFirst ? accentColor : 'var(--color-text-3)',
        marginTop: 1,
      }}>
        {idx + 1}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {place.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {place.rating != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--color-text-2)' }}>
              <span className="ms fill" style={{ fontSize: 10, color: '#d4a853' }}>star</span>
              {place.rating}
            </span>
          )}
          {place.priceLevel != null && (
            <span style={{ fontSize: 10, color: 'var(--color-text-3)' }}>{PRICE_DOTS[place.priceLevel]}</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--color-text-3)' }}>
            {place.distanceM < 1000 ? `${place.distanceM}m` : `${(place.distanceM / 1000).toFixed(1)}km`}
          </span>
        </div>
        {place.matchReasons.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
            {place.matchReasons.map(r => (
              <span key={r} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary-text)' }}>{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Maps link */}
      <a href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-4)', flexShrink: 0, marginTop: 1 }} onClick={e => e.stopPropagation()}>
        <span className="ms" style={{ fontSize: 15, color: 'var(--color-text-4)' }}>map</span>
      </a>
    </div>
  );
}

export function ReelRecoCard({ card, active, archetype, existingPlaceIds, onInteract }: Props) {
  const cfg = TRIGGER_CFG[card.trigger] ?? TRIGGER_CFG.lunch;
  const { places, loading } = useReelRecommendations(card, archetype, existingPlaceIds, active);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glowLeft = GLOW_LEFT_TRIGGERS.has(card.trigger);

  useEffect(() => { if (active) onInteract?.('viewed'); }, [active]);
  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => onInteract?.('lingered'), 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: REEL_CONTENT_PADDING_RECO, overflow: 'hidden' }}>

      {/* Background glow */}
      <div style={{ position: 'absolute', bottom: -40, ...(glowLeft ? { left: -40 } : { right: -40 }), width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(circle,${cfg.bg} 0%,transparent 65%)`, pointerEvents: 'none' }} />

      {/* Near badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: RECO_NEAR_BR, background: 'rgba(79,143,171,.07)', border: '1px solid rgba(79,143,171,.16)', marginBottom: RECO_NEAR_MB, alignSelf: 'flex-start', animation: active ? 'fadeUp .45s .05s both' : 'none' }}>
        <span className="ms" style={{ fontSize: 12, color: '#38bdf8' }}>near_me</span>
        <span style={{ fontSize: 10, color: 'rgba(79,143,171,.85)', fontWeight: 600 }}>Near {card.nearbyCity}</span>
      </div>

      {/* Trigger chip */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: RECO_TRIGGER_BR, background: cfg.bg, border: `1px solid ${cfg.color}26`, marginBottom: RECO_TRIGGER_MB, alignSelf: 'flex-start', animation: active ? 'fadeUp .45s .1s both' : 'none' }}>
        <span className="ms fill" style={{ fontSize: 12, color: cfg.color }}>{cfg.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: cfg.color }}>{cfg.chipLabel}</span>
      </div>

      {/* Headline */}
      <p style={{ fontFamily: 'var(--font-heading)', fontSize: RECO_HEADLINE_FS, fontWeight: 600, color: 'var(--color-text-1)', lineHeight: 1.25, marginBottom: RECO_HEADLINE_MB, animation: active ? 'fadeUp .45s .17s both' : 'none' }}>
        {card.label}
      </p>

      {/* Consequence */}
      <p style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: RECO_CONSEQUENCE_MB, animation: active ? 'fadeUp .45s .24s both' : 'none' }}>
        {card.consequence}
      </p>

      {/* Loading shimmer */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: RECO_PLACE_ROWS_GAP, marginBottom: RECO_PLACE_ROWS_MB }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 60, borderRadius: 11, background: 'var(--color-surface)', border: '1px solid var(--color-border)', opacity: 0.5 - i * 0.1, animation: 'pulse 1.6s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Place recommendations */}
      {places.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: RECO_PLACE_ROWS_GAP, marginBottom: RECO_PLACE_ROWS_MB }}>
          {places.map((p, i) => (
            <PlaceRow key={p.placeId} place={p} idx={i} active={active} accentColor={cfg.color} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | grep "ReelRecoCard" | head -10
```

Expected: no errors.

- [ ] **Step 3: Visual test in browser**

Verify against mock lunch reco card:
- Padding: 18px sides (not 22px)
- Near badge: border-radius 9px, icon 12px
- Trigger chip: border-radius 7px
- Place rows: gap 7px, rank circles 20px, font 9px
- No "Add to plan" button at bottom

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/ReelRecoCard.tsx
git commit -m "feat(reel): rewrite ReelRecoCard from mock — correct padding, badge sizing, remove extra CTA"
```

---

### Task 9: Rewrite `ReelDayDividerCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelDayDividerCard.tsx`

Full rewrite. Key: ghost large day number (88px, opacity 0.06) with `margin-bottom:-8px` overlapping city name below it, sky-blue date label, separator line.

- [ ] **Step 1: Replace the full contents of `ReelDayDividerCard.tsx`**

```typescript
import type { ReelDayDividerCard as ReelDayDividerCardType } from './types';
import {
  DIVIDER_BG, DIVIDER_GHOST_FS, DIVIDER_CITY_FS, DIVIDER_DATE_FS, DIVIDER_LINE_W,
  todGradient,
} from './reel-constants';

interface Props {
  card: ReelDayDividerCardType;
  active: boolean;
}

function formatDividerDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return isoDate;
  }
}

export function ReelDayDividerCard({ card, active }: Props) {
  const hour = new Date().getHours();

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: DIVIDER_BG }}>

      {/* City texture overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 200px 300px at 50% 40%,rgba(79,143,171,.07),transparent)', pointerEvents: 'none' }} />

      {/* Top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom,rgba(0,0,0,.5),transparent)', pointerEvents: 'none' }} />

      {/* ToD gradient z-index:4 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGradient(hour), pointerEvents: 'none' }} />

      {/* Horizon scrim z-index:4 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top,rgba(0,0,0,.88),transparent)', zIndex: 4, pointerEvents: 'none' }} />

      {/* Centered content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', zIndex: 5 }}>
        <div style={{ fontSize: DIVIDER_DATE_FS, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-sky, #4f8fab)', opacity: 0.7, marginBottom: 12 }}>
          {formatDividerDate(card.date)}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: DIVIDER_GHOST_FS, fontWeight: 700, color: 'rgba(255,255,255,.06)', lineHeight: 1, marginBottom: -8 }}>
          {card.day}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: DIVIDER_CITY_FS, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 10 }}>
          {card.city}
        </div>
        <div style={{ height: 1, width: DIVIDER_LINE_W, background: 'rgba(79,143,171,.4)', marginBottom: 10 }} />
        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
          {card.stopCount} stops
        </div>
      </div>

      {/* Swipe hint */}
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', zIndex: 8 }}>
        <span className="ms" style={{ fontSize: 17, color: 'rgba(255,255,255,.18)' }}>swipe_up</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check + visual test**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | grep "ReelDayDivider" | head -5
```

Run dev server. Verify: ghost day number overlaps city name (negative margin), separator line, sky-blue date label at 70% opacity.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/ReelDayDividerCard.tsx
git commit -m "feat(reel): rewrite ReelDayDividerCard from mock — ghost number, separator, ToD gradient"
```

---

### Task 10: Audit `ReelTransitCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelTransitCard.tsx` (only if gaps found)

Read the mock transit section and diff against current component.

- [ ] **Step 1: Read mock transit section (lines 1001–1132)**

```bash
sed -n '1001,1132p' /Users/souravbiswas/uncover-roads/frontend/public/reel-mock.html
```

Note the exact values: city name font size (28px serif), mode badge padding (`9px 18px`, border-radius 13px), connecting line dot colour (`var(--sky)`), service pill positioning (`top:56px`).

- [ ] **Step 2: Read current component**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ReelTransitCard.tsx
```

- [ ] **Step 3: Patch any deviations**

Apply targeted fixes only for values that differ from mock. Do not restructure working code. Common gaps to check:
- City name font-size: should be 28px Cormorant
- Mode badge border-radius: 13px
- Connecting line dot: `var(--sky)` (#4f8fab)
- Service/ref pill: only rendered when `card.ref` is non-null

- [ ] **Step 4: TypeScript check + commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | grep "ReelTransit" | head -5
git add frontend/src/modules/route/reel/ReelTransitCard.tsx
git commit -m "fix(reel): patch ReelTransitCard against mock values"
```

---

### Task 11: Audit `ReelIntelCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelIntelCard.tsx` (only if gaps found)

- [ ] **Step 1: Read mock intel section**

```bash
grep -n "intel\|Intel\|engine decision\|banner" /Users/souravbiswas/uncover-roads/frontend/public/reel-mock.html | head -10
# Then read those line ranges
```

- [ ] **Step 2: Read current component**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ReelIntelCard.tsx
```

- [ ] **Step 3: Patch deviations, TypeScript check, commit**

```bash
git add frontend/src/modules/route/reel/ReelIntelCard.tsx
git commit -m "fix(reel): patch ReelIntelCard against mock values"
```

---

### Task 12: Audit `ReelBalanceCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelBalanceCard.tsx` (only if gaps found)

- [ ] **Step 1: Read mock balance section**

```bash
grep -n "balance\|Balance" /Users/souravbiswas/uncover-roads/frontend/public/reel-mock.html | head -10
```

- [ ] **Step 2: Read current component, patch, TypeScript check, commit**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ReelBalanceCard.tsx
git add frontend/src/modules/route/reel/ReelBalanceCard.tsx
git commit -m "fix(reel): patch ReelBalanceCard against mock values"
```

---

### Task 13: Audit `ReelSummaryCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelSummaryCard.tsx` (only if gaps found)

- [ ] **Step 1: Read mock summary section**

```bash
grep -n "summary\|Summary\|before you go\|Before you go" /Users/souravbiswas/uncover-roads/frontend/public/reel-mock.html | head -10
```

- [ ] **Step 2: Read current component, patch, TypeScript check, commit**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ReelSummaryCard.tsx
git add frontend/src/modules/route/reel/ReelSummaryCard.tsx
git commit -m "fix(reel): patch ReelSummaryCard against mock values"
```

---

### Task 14: Audit `ReelFinaleCard`

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelFinaleCard.tsx` (only if gaps found)

- [ ] **Step 1: Read mock finale section**

```bash
grep -n "finale\|Finale\|trip complete\|all done" /Users/souravbiswas/uncover-roads/frontend/public/reel-mock.html | head -10
```

- [ ] **Step 2: Read current component, patch, TypeScript check, commit**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ReelFinaleCard.tsx
git add frontend/src/modules/route/reel/ReelFinaleCard.tsx
git commit -m "fix(reel): patch ReelFinaleCard against mock values"
```

---

### Task 15: Full Run-Through Test

**Files:** None — verification only.

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run 2>&1 | tail -30
```

Expected: all tests PASS. Pay attention to `signal.test.ts`, `engine.test.ts`, `dimensions.test.ts`, `profile.test.ts`.

- [ ] **Step 2: End-to-end reel verification**

Start dev server. Open a saved trip reel (not a freshly generated one — this tests the `!savedItem` fix). Scroll through all cards. Verify:
- At least 1 reco card appears (engine now fires for saved trips)
- Rain on stop cards: vertical gradient streaks, double-layer blue sky tint
- Thunder: purple double-layer sky + flash radial (no bolt)
- Sun rays: gentle oscillation (not spinning)
- Intro card: correct city size, engine strips with dark pill background
- Day divider: ghost number overlapping city name
- Reco card: 18px sides (not 22px), no "Add to plan" button

- [ ] **Step 3: Hard-refresh test (personaProfile persistence)**

After generating a reel, hard-refresh the page (`Cmd+Shift+R`). Open the reel again. Reco cards must still appear (engine uses personaProfile from localStorage).

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -p  # stage only deliberate changes
git commit -m "fix(reel): final polish after full run-through"
```
