# Reel Rebuild & Reco Engine Fix — Design Spec

## Goal

Full component rewrite of the itinerary reel (all 9 card types) using `frontend/public/reel-mock.html` as the single source of truth, plus three structural reco engine fixes that have silently broken intelligence output since the OB flow was rebuilt.

## Architecture

**Approach:** Delete the body of each card component and rewrite from mock HTML values. No guessing, no approximation — every pixel value is extracted from the mock. CSS keyframes are fixed in the same pass. Engine fixes are separate tasks after UI is solid.

**Source of truth:** `frontend/public/reel-mock.html` (read-only reference, never modified)

---

## File Structure

| File | Action | Reason |
|---|---|---|
| `frontend/src/index.css` | Fix 8 keyframes | `precip`, `snowFall`, `snowSway1/2/3`, `fogDriftL/R`, `rayRotate`, `sunGlow` + add missing `hailFall` |
| `frontend/src/modules/route/reel/reel-constants.ts` | **New** | All design tokens extracted from mock — sizes, colors, durations, easing |
| `frontend/src/modules/route/reel/ReelIntroCard.tsx` | Full rewrite | Sky layers, weather canvas, ToD gradient, content layout |
| `frontend/src/modules/route/reel/ReelStopCard.tsx` | Full rewrite | Weather layers, time row, content, fact strips, AI line |
| `frontend/src/modules/route/reel/ReelRecoCard.tsx` | Full rewrite | Trigger chip, place rows — remove "Add to plan" CTA not in mock |
| `frontend/src/modules/route/reel/ReelDayDividerCard.tsx` | Full rewrite | Ghost number layout, city, date, separator |
| `frontend/src/modules/route/reel/ReelTransitCard.tsx` | Audit + patch | Cinematic scenes are mostly correct — fix any gaps found |
| `frontend/src/modules/route/reel/ReelIntelCard.tsx` | Audit + patch | Review against mock intel section |
| `frontend/src/modules/route/reel/ReelBalanceCard.tsx` | Audit + patch | Review against mock balance section |
| `frontend/src/modules/route/reel/ReelSummaryCard.tsx` | Audit + patch | Review against mock summary section |
| `frontend/src/modules/route/reel/ReelFinaleCard.tsx` | Audit + patch | Review against mock finale section |
| `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` | Targeted fix | Remove `!savedItem` guard on line 82; engine runs for all reels |
| `frontend/src/modules/route/reco-engine/signal.ts` | Fix field read | Read `rawOBAnswers` instead of legacy `obAnswers` |
| `frontend/src/modules/route/reco-engine/engine.ts` | Add 4 templates | `hasHiddenGem`, `categoryDiversity`, `timeBalance`, `geoEfficiency` |
| `frontend/src/shared/store.tsx` | Fix persistence | Save full `personaProfile` to localStorage, restore on init |

---

## Section 1: CSS Keyframe Fixes (`index.css`)

All values extracted directly from mock. No approximation.

| Keyframe | Current (broken) | Mock (correct) |
|---|---|---|
| `precip` | `translateY(-10px) rotate(15deg)` + opacity fade | `from{transform:translateY(-40px)} to{transform:translateY(700px)}` — pure vertical |
| `snowFall` | `translateY(-10px)` + opacity fade | `from{transform:translateY(-40px)} to{transform:translateY(700px)}` — no fade |
| `snowSway1` | `translateX(0 → 18px)` | `margin-left: -8px → 8px` (avoids conflict with translateY on same element) |
| `snowSway2` | `translateX(0 → -22px)` | `margin-left: 6px → -6px` |
| `snowSway3` | `translateX(0 → 14px)` | `margin-left: -4px → 4px` |
| `fogDriftL` | `translateX(-30px → +30px)` + opacity fade | `from{transform:translateX(-15%)} to{transform:translateX(25%)}` — no fade |
| `fogDriftR` | `translateX(+30px → -30px)` + opacity fade | `from{transform:translateX(25%)} to{transform:translateX(-15%)}` |
| `rayRotate` | `rotate(0deg → 360deg)` — full spin | `from{transform:rotate(-2deg)} to{transform:rotate(2deg)}` — oscillation |
| `sunGlow` | opacity `0.45–0.65` + `scale(1.08)` | `0%,100%{opacity:.65} 50%{opacity:1}` — no scale |
| `hailFall` | **Missing** | `from{transform:translateY(-40px)} to{transform:translateY(700px)}` |

---

## Section 2: Shared Design Tokens (`reel-constants.ts`)

New file. All components import from here — no literals scattered across files.

```typescript
// Layout
export const REEL_CONTENT_PADDING_INTRO = '0 17px 32px'
export const REEL_CONTENT_PADDING_STOP  = '0 15px 26px'
export const REEL_CONTENT_PADDING_RECO  = '0 18px 88px'

// Scrim (identical across all photo cards)
export const REEL_SCRIM = 'linear-gradient(180deg,transparent 0%,transparent 35%,rgba(0,0,0,.45) 65%,rgba(0,0,0,.85) 90%,rgba(10,10,13,.95) 100%)'

// Sky tints
export const SKY_TINT_SUNNY    = 'linear-gradient(180deg,rgba(255,210,140,.18),rgba(255,210,140,.04) 40%,transparent 70%)'
export const SKY_TINT_RAIN_1   = 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))'   // mix-blend-mode: multiply
export const SKY_TINT_RAIN_2   = 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))'   // opacity: 0.6
export const SKY_TINT_THUNDER_1= 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))'  // mix-blend-mode: multiply
export const SKY_TINT_THUNDER_2= 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))'  // opacity: 0.6
export const SKY_TINT_OVERCAST = 'linear-gradient(180deg,rgba(70,82,100,.65) 0%,rgba(70,82,100,.48) 60%,rgba(70,82,100,.35) 100%)'
export const SKY_TINT_PC       = 'linear-gradient(180deg,rgba(150,165,185,.16),rgba(150,165,185,.04) 60%,transparent)'
export const SKY_TINT_FOG      = 'linear-gradient(180deg,rgba(90,100,115,.55),rgba(70,82,95,.40))'
export const SKY_TINT_DRIZZLE  = 'linear-gradient(180deg,rgba(40,55,80,.55),rgba(40,55,80,.35))'
export const SKY_TINT_NIGHT    = 'linear-gradient(180deg,rgba(20,28,55,.30),rgba(35,50,98,.45) 45%,rgba(40,55,110,.65) 75%,rgba(22,32,72,.85))'
export const SKY_TINT_SNOW     = 'linear-gradient(180deg,rgba(50,65,90,.45),rgba(50,65,90,.28))'

// ToD gradients (all reduced 80% from reference as per mock comment)
export const TOD_EARLY_MORNING = 'linear-gradient(180deg,rgba(255,210,180,.08) 0%,rgba(255,180,140,.18) 40%,rgba(250,150,110,.40) 72%,rgba(228,118,86,.62) 92%,rgba(212,98,68,.68) 100%)'
export const TOD_MORNING       = 'linear-gradient(180deg,rgba(255,225,180,.05) 0%,rgba(255,205,140,.16) 50%,rgba(238,168,100,.40) 78%,rgba(216,138,80,.62) 100%)'
export const TOD_AFTERNOON     = 'linear-gradient(180deg,rgba(180,210,235,.14) 0%,rgba(220,225,210,.08) 35%,rgba(245,225,170,.24) 70%,rgba(232,205,150,.40) 92%,rgba(218,188,130,.50) 100%)'
export const TOD_DUSK          = 'linear-gradient(180deg,rgba(80,55,120,.18) 0%,rgba(180,70,110,.28) 38%,rgba(200,80,90,.44) 60%,rgba(160,55,110,.60) 82%,rgba(95,40,130,.68) 100%)'
export const TOD_NIGHT         = 'linear-gradient(180deg,rgba(20,28,55,.24) 0%,rgba(35,50,98,.36) 45%,rgba(40,55,110,.52) 75%,rgba(22,32,72,.68) 100%)'

// ToD badge dot colours
export const TOD_DOT_EARLY_MORNING = '#f0a079'
export const TOD_DOT_MORNING       = '#f0b878'
export const TOD_DOT_AFTERNOON     = '#e8d292'
export const TOD_DOT_DUSK          = '#d4706a'
export const TOD_DOT_NIGHT         = '#6a82c8'

// Rain particle params (seeded RNG, seed=42 for rain, seed=8 for stop cards)
export const RAIN_COUNT  = 64
export const RAIN_SEED   = 42
export const RAIN_WIDTH  = '1.5px'
export const RAIN_LEN_MIN = 20
export const RAIN_LEN_RANGE = 26
export const RAIN_DUR_MIN = 0.45
export const RAIN_DUR_RANGE = 0.45
export const RAIN_DELAY_RANGE = 1.8
export const RAIN_OPACITY_MIN = 0.6
export const RAIN_OPACITY_RANGE = 0.4
export const RAIN_BG = 'linear-gradient(to bottom,transparent,rgba(200,225,255,1))'

// Snow particle params (seed=2)
export const SNOW_COUNT = 44
export const SNOW_SEED  = 2

// Intro card
export const INTRO_CITY_FONT_SIZE = 50
export const INTRO_CITY_MB        = 13
export const INTRO_LABEL_MB       = 7
export const INTRO_TEXT_SHADOW    = '0 1px 6px rgba(0,0,0,.9),0 2px 18px rgba(0,0,0,.6)'

// Stop card
export const STOP_H2_FONT_SIZE  = 30
export const STOP_H2_LINE_HEIGHT = 1.05
export const STOP_H2_MB         = 8
export const STOP_H2_TEXT_SHADOW = '0 1px 5px rgba(0,0,0,.85),0 2px 14px rgba(0,0,0,.5)'
export const STOP_META_ROW_MB   = 9
export const STOP_TIME_ROW_BR   = 6   // border-radius px
export const STOP_TIME_ROW_PAD  = '3px 9px'
export const STOP_COUNTER_BR    = 5
export const STOP_COUNTER_PAD   = '2px 8px'

// Reco card
export const RECO_NEAR_BADGE_BR   = 9
export const RECO_TRIGGER_CHIP_BR = 7
export const RECO_HEADLINE_FS     = 26
export const RECO_HEADLINE_MB     = 5
export const RECO_PLACE_ROWS_GAP  = 7
export const RECO_PLACE_ROWS_MB   = 14
export const RECO_RANK_SIZE       = 20
export const RECO_RANK_FS         = 9

// Day divider
export const DIVIDER_GHOST_FS   = 88
export const DIVIDER_CITY_FS    = 42
export const DIVIDER_DATE_FS    = 10
export const DIVIDER_LINE_W     = 40
export const DIVIDER_BG         = 'linear-gradient(160deg,#0c1018 0%,#141820 50%,#0e1410 100%)'
```

---

## Section 3: Intro Card (`ReelIntroCard.tsx`)

Complete rewrite. Z-index layer stack (bottom to top):

1. **City photo** — `z-index:0`, `object-fit:cover`, `position:absolute;inset:0`
2. **Sky tint** — `z-index:2`, condition-branched: sunny single layer / rain double layer (multiply + 0.6 opacity) / thunder double layer / overcast / night
3. **GRADIENT scrim** — `z-index:3`, always present, `REEL_SCRIM` constant
4. **ToD gradient** — `z-index:4`, computed from `new Date().getHours()` at render time
5. **Sun rays** (sunny only) — `z-index:4` — corner glow ellipse + rotating ray fan (`rayRotate 80s linear infinite`)
6. **Weather canvas** (rain/snow/thunder) — `z-index:5`, seeded RNG particles
7. **Content** — `z-index:10`, `position:absolute;bottom:0;left:0;right:0`, padding `REEL_CONTENT_PADDING_INTRO`

**ToD gradient function** — maps hour to gradient:
- 0–5: `TOD_NIGHT`
- 6–7: `TOD_EARLY_MORNING`
- 8–10: `TOD_MORNING`
- 11–16: `TOD_AFTERNOON`
- 17–19: `TOD_DUSK`
- 20–23: `TOD_NIGHT`

**ToD badge dot colour** — same hour mapping to `TOD_DOT_*` constants.

**Content structure:**
```
<p> Your N-day trip / Your day in      10px 700 .1em uppercase t4 mb:7px
<h1> {city}                            Cormorant 50px 700 white lh:1 mb:13px text-shadow
<pills row>                            flex-wrap gap:6px mb:11px
<engine strips>                        flex-direction:column gap:5px
  each strip: inline-flex gap:6px pad:5px 10px br:9px bg:rgba(0,0,0,.28) border:1px solid var(--bdr) backdrop:blur(6px)
    icon: 12px color:var(--primary)
    text: 11px color:var(--t2)
<swipe hint>                           text-align:center mt:12px — ms swipe_up 17px rgba(255,255,255,.18)
```

**Top controls (absolute):**
- ToD badge: `top:48px left:13px z-index:11`
- Trip details button: `top:48px right:13px z-index:10` — two variants: "Add trip details" (no hotel set) / "Hotel set" (hotel set, amber style)

---

## Section 4: Stop Card (`ReelStopCard.tsx`)

Complete rewrite. Same z-index layer stack as intro (photo → sky tint → scrim → ToD gradient → sun rays or weather canvas → content at z-index 10).

**Sky tint branching:**
- `sunny/clear`: single layer `SKY_TINT_SUNNY`
- `partly_cloudy`: single layer `SKY_TINT_PC`
- `overcast`: single layer `SKY_TINT_OVERCAST`
- `drizzle`: single layer `SKY_TINT_DRIZZLE`
- `rain`: **double layer** — first `mix-blend-mode:multiply`, second `opacity:0.6`
- `thunderstorm`: **double layer** — `SKY_TINT_THUNDER_1/2`, same pattern
- `fog`: single layer `SKY_TINT_FOG`
- `snow`: single layer `SKY_TINT_SNOW`

**Rain streaks** — seeded RNG (seed varies per stop index), 64 streaks:
```
background: linear-gradient(to bottom, transparent, rgba(200,225,255,1))
width: 1.5px
height: 20 + rng()*26 px
opacity: 0.6 + rng()*0.4
top: -15%
animation: precip {0.45+rng()*0.45}s linear {-rng()*1.8}s infinite
```

**Thunder** — same rain streaks (56 count, seed varies) + flash overlay:
```
position:absolute;inset:0;z-index:6
background:radial-gradient(ellipse at 50% 25%,rgba(230,220,255,.95),rgba(180,150,230,.5) 32%,rgba(120,80,180,0) 70%)
mix-blend-mode:screen
animation:flashFlicker 3.4s ease-out -1.3s infinite
```

**Content structure (padding `0 15px 26px`):**
```
<stop counter>   inline-flex pad:2px 8px br:5px bg:rgba(0,0,0,.40) blur(6px) mb:5px
                 text: 10px 700 ls:.08em uppercase rgba(255,255,255,.58) margin:0

<time row>       inline-flex align-items:center gap:6px mb:8px pad:3px 9px br:6px bg:rgba(0,0,0,.40) blur(6px)
                 schedule icon: 11px rgba(255,255,255,.45)
                 time: 12px rgba(255,255,255,.88) fw:600
                 dot separator: rgba(255,255,255,.18)
                 duration: 12px rgba(255,255,255,.55)
                 [if rescheduled] "↑ rescheduled": 10px var(--primary) fw:700 ml:3px

<h2>             Cormorant 30px 700 white lh:1.05 mb:8px text-shadow:STOP_H2_TEXT_SHADOW

<metadata row>   flex gap:5px mb:9px flex-wrap align-items:center
                 category pill: br:999px bg:rgba(0,0,0,.48) blur(8px) border:rgba(255,255,255,.14) color:rgba(255,255,255,.72) fs:10px
                 rating pill: class pa
                 trend badge: trending/hidden_gem/getting_busy variant

<fact strips>    each: display:flex align-items:flex-start gap:6px
                 icon: ms 13px (fill for check/info, outline for others)
                 text: 13px var(--t2) lh:1.55

<AI line>        star ✦ span + italic p fs:12px color:rgba(255,255,255,.55)
```

**Top controls:**
- ToD badge: same as intro (`top:48px left:13px`)
- Weather badge: `top:48px right:13px` — `border-radius:999px bg:rgba(9,12,22,.82) blur(10px) border:1px solid var(--bdr)` — icon + temp + condition label

---

## Section 5: Reco Card (`ReelRecoCard.tsx`)

Complete rewrite. No photo backdrop — dark `var(--color-bg)` base.

**Content (padding `0 18px 88px`, `justify-content:flex-end`):**

```
[background glow]  absolute bottom:-40px, left or right:-40px (trigger-dependent)
                   260×260px circle radial-gradient in trigger color at 0.1 opacity

[near badge]       inline-flex gap:7px pad:5px 11px br:9px
                   bg:rgba(79,143,171,.07) border:rgba(79,143,171,.16) mb:12px
                   near_me icon 12px color:var(--sky)
                   text 10px rgba(79,143,171,.85) fw:600

[trigger chip]     inline-flex gap:6px pad:4px 9px br:7px mb:9px
                   bg: trigger.bg border: trigger.color + '26'
                   icon: 12px fill trigger.color
                   label: 10px fw:700 ls:.06em uppercase trigger.color

[headline]         Cormorant 26px fw:600 lh:1.25 mb:5px color:var(--color-text-1)

[consequence]      12px color:var(--color-text-2) lh:1.6 mb:16px

[place rows]       flex-direction:column gap:7px mb:14px
  first row:       pad:11px 12px br:11px bg:var(--color-surface)
                   border: 1.5px solid {accentColor}28
    rank circle:   20×20px br:50% bg:{accentColor}22 border:{accentColor}55
                   fs:9px fw:700 color:accentColor
  other rows:      pad:10px 12px br:11px border:1px solid var(--color-border)
    rank circle:   20×20px bg:var(--color-surface2) no border
                   fs:9px fw:700 color:var(--color-text-3)
  place name:      13px fw:600 text-overflow:ellipsis
  meta row:        star 11px #d4a853 + rating 11px + price 11px t3 + distance 11px t3
  match reasons:   10px fw:600 br:999px bg:primary-bg border:primary-glow color:primary-text
  maps icon:       ms 'map' 15px color:var(--color-text-4)

[NO "Add to plan" button]  — not present in mock
```

**Glow position rule** (extracted from mock):
- `culture`, `walking_gap`, `geo_efficiency` → `left:-40px`
- all others → `right:-40px`

---

## Section 6: Day Divider Card (`ReelDayDividerCard.tsx`)

Complete rewrite. No photo — dark gradient background.

```
background: linear-gradient(160deg,#0c1018 0%,#141820 50%,#0e1410 100%)

[city texture]    radial-gradient(ellipse 200px 300px at 50% 40%, rgba(79,143,171,.07), transparent)
[top fade]        linear-gradient(to bottom, rgba(0,0,0,.5), transparent) — top 40%
[horizon scrim]   linear-gradient(to top, rgba(0,0,0,.88), transparent) — bottom 80px z-index:4
[ToD gradient]    z-index:4, same ToD mapping as stop card

[centered block]  position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;padding:0 24px
  date label:     10px fw:700 ls:.14em uppercase color:var(--sky) opacity:.7 mb:12px
  ghost number:   Cormorant 88px fw:700 rgba(255,255,255,.06) lh:1 mb:-8px
  city name:      Cormorant 42px fw:700 white lh:1 mb:10px
  separator:      40px wide 1px rgba(79,143,171,.4) mb:10px
  stop/km text:   11px color:var(--t3)

[swipe hint]      bottom:18px — ms swipe_up 17px rgba(255,255,255,.18)
```

---

## Section 7: Transit, Intel, Balance, Summary, Finale

These cards will be **audited against the mock** before any code is written. Each gets its own task:

1. Read the corresponding mock section
2. Diff against current component
3. Patch only what's different

If any card requires more than minor patches, it becomes a full rewrite task.

---

## Section 8: Reco Engine Fixes

### Fix 1 — `signal.ts`: Read `rawOBAnswers`

`computeRecoSignal` currently reads `state.obAnswers` (legacy field, always null defaults). Fix: read `state.rawOBAnswers`.

Field mapping:

| Signal field | New source | Mapping |
|---|---|---|
| `pace` | `rawOBAnswers.pace[0]` | `'slow'→'slow'`, `'balanced'→'moderate'`, `'pack'→'fast'`, `'spontaneous'→'moderate'` |
| `social` | `rawOBAnswers.group` | `'solo'→'solo'`, `'couple'→'duo'`, `'family'/'friends'→'group'` |
| `isFamily` | `rawOBAnswers.group` | `=== 'family'` |
| `ritualStrength` | `rawOBAnswers.day_open` | `'coffee'→0.8`, `'breakfast'→0.5`, `'grab_go'→0.3`, `'straight'→0.1` |
| `sensoryIntensity` | `rawOBAnswers.mood` | max of: `'culture'→0.7`, `'eat_drink'→0.7`, `'explore'→0.6`, `'relax'→0.4` |
| `spontaneityBias` | `rawOBAnswers.pace` | includes `'spontaneous'` → add 0.4 to weights calc |
| `archetypeConfidence` | hardcoded | always `1.0` — mandatory OB guarantees all fields |

`Pick` type in `computeRecoSignal` signature: replace `'obAnswers'` with `'rawOBAnswers'`.

### Fix 2 — `reel-builder.ts`: Remove `!savedItem` guard

```typescript
// Before (line 82 ItineraryReelScreen.tsx):
if (itinerary && state.persona && !savedItem) {

// After:
if (itinerary && state.persona) {
```

Engine runs for both new and saved trip reels.

### Fix 3 — `engine.ts`: Add 4 missing `gapToCard` templates

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

---

## Section 9: State Persistence Fix (`store.tsx`)

`personaProfile` is lost on page reload — only `{ archetype }` is currently saved to localStorage.

**Fix:**
- Key: `ur_persona_profile`
- On `SET_PERSONA_PROFILE`: `localStorage.setItem('ur_persona_profile', JSON.stringify(action.profile))`
- On init: restore with `JSON.parse(localStorage.getItem('ur_persona_profile') ?? 'null')`
- Existing `ur_persona` key and `persona` field: unchanged

---

## Testing

Each card rewrite: visual comparison against the mock at 390px width (iPhone 14 equivalent) in browser dev tools mobile mode.

Reco engine: after all fixes, open the reel from a saved trip — at least one reco card must appear per day that has a gap above threshold.

State persistence: complete OB → generate reel → hard-refresh → open reel again — reco engine must still produce cards (personaProfile available).

---

## Out of Scope

- Map screen changes (separate spec)
- SAVE_EVENT / live event wiring (separate spec)
- Curated pin redesign (separate spec, requires visual mock approval first)
