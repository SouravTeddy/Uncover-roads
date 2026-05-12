# Full UI Redesign — Uncover Roads
**Date:** 2026-04-28
**Branch:** `feature/design-system-redesign` (new, from `main`)
**Scope:** All screens — visual redesign only, no logic changes except where noted

---

## Overview

Redesign the entire Uncover Roads web app to match the new design system provided in `design_handoff/prototype/`. The app moves from a cool blue dark theme (Inter/Plus Jakarta Sans) to a warm editorial dark theme (Playfair Display/DM Sans) with full light mode support.

The goal is **high-fidelity visual parity** with the design handoff prototypes. Business logic, routing, state management, and API calls are untouched unless a new `rec-rules.ts` file is required.

---

## Constraints

- React + Vite + TypeScript (not React Native — the prototype README references RN but this codebase is web)
- Tailwind v4 CSS-first config — keep Tailwind, replace `@theme` tokens
- All existing hooks (`useAppStore`, `useRoute`, `useProfile`, `usePersona`, etc.) remain unchanged
- No new dependencies unless strictly necessary
- Design handoff prototypes are HTML/JSX references — not code to copy directly

---

## Approach

**Token-first, screens-second.** Replace design tokens in `index.css` and wire up theme toggle first. Then update screens in order. Light mode comes for free across all screens the moment the `data-theme` attribute flips.

---

## 1. Design Tokens (`src/index.css`)

### Dark theme (default, in `@theme`)

| Token | Value |
|---|---|
| `--color-bg` | `#1a1714` |
| `--color-bg2` | `#131110` |
| `--color-surface` | `#242018` |
| `--color-surface2` | `#2e2a22` |
| `--color-primary` | `#e07854` |
| `--color-primary-dk` | `#c4613d` |
| `--color-sage` | `#6b9470` |
| `--color-sage-bg` | `rgba(107,148,112,.15)` |
| `--color-sage-bdr` | `rgba(107,148,112,.30)` |
| `--color-sky` | `#4f8fab` |
| `--color-sky-bg` | `rgba(79,143,171,.15)` |
| `--color-sky-bdr` | `rgba(79,143,171,.30)` |
| `--color-amber` | `#c49840` |
| `--color-amber-bg` | `rgba(196,152,64,.15)` |
| `--color-amber-bdr` | `rgba(196,152,64,.30)` |
| `--color-text-1` | `#f5f0ea` |
| `--color-text-2` | `#c0b0a4` |
| `--color-text-3` | `#857268` |
| `--color-text-4` | `#5a4e47` |
| `--color-border` | `rgba(255,255,255,.08)` |
| `--color-border-m` | `rgba(255,255,255,.14)` |
| `--color-divider` | `rgba(255,255,255,.06)` |
| `--color-primary-bg` | `rgba(224,120,84,.14)` |
| `--shadow-md` | `0 4px 24px rgba(0,0,0,.45)` |
| `--shadow-primary` | `0 6px 24px rgba(224,120,84,.25)` |
| `--font-sans` | `'DM Sans', sans-serif` |
| `--font-heading` | `'Playfair Display', serif` |

### Light theme override (`[data-theme=light]` block)

| Token | Value |
|---|---|
| `--color-bg` | `#faf8f4` |
| `--color-bg2` | `#f2ede5` |
| `--color-surface` | `#ffffff` |
| `--color-surface2` | `#f8f4ef` |
| `--color-text-1` | `#2c2420` |
| `--color-text-2` | `#6b5e57` |
| `--color-text-3` | `#a09085` |
| `--color-text-4` | `#c4b8b0` |
| `--color-border` | `rgba(44,36,32,.08)` |
| `--color-border-m` | `rgba(44,36,32,.14)` |
| `--color-divider` | `rgba(44,36,32,.06)` |
| `--color-primary-bg` | `rgba(224,120,84,.10)` |
| `--shadow-md` | `0 4px 24px rgba(44,36,32,.12)` |
| Primary, sage, sky, amber | unchanged |

### Animations added to `index.css`

| Name | Keyframe | Usage |
|---|---|---|
| `springUp` | `translateY(32px)→(-6px)→0`, opacity 0→1 | Cards, sheets appearing |
| `cardEntry` | `translateY(24px) scale(.97) → 0 scale(1)` | List card entrances, staggered by index |
| `pinPulse` | `scale(1)→(2.8)`, `opacity .7→0` | Map city dot pulse ring |
| `confetti` | `translateY(0)→(110px) + rotate(600deg)`, opacity 1→0 | Finale card |
| `bounceIn` | `scale(.5)→(1.15)→(1)` | Swipe hint arrow |
| `wiggleFocus` | `translateX(0→-3px→3px→-2px→2px→0)`, 0.35s | Search bar on focus |
| `spin` | `rotate(0→360deg)` | Loading / building CTA spinner |
| `floatUp` | `translateY(0)→translateY(-120vh)`, opacity 0→0.6→0, ease-in-out infinite | LoginScreen floating icons |

### Map tiles
- Dark: `https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png`
- Light: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- Toggle driven by `data-theme` attribute read in `MapLibreMap.tsx`

---

## 2. Theme Toggle

### Store (`src/shared/store.tsx`)
- Add `theme: 'dark' | 'light'` to app state, default `'dark'`
- Add `SET_THEME` action
- On `SET_THEME`: update state, write to `localStorage('ur_theme')`, set `document.documentElement.dataset.theme`
- On app boot (in `main.tsx` or `App.tsx`): read `localStorage('ur_theme')`, apply `data-theme` attribute before first render

### UI (`ProfileScreen.tsx` — App section)
- Add "Appearance" settings row with a toggle switch
- Toggle pill: 36×20px, `border-radius: 99px`
- Active (dark): background `#e07854`, knob right
- Inactive (light): background `rgba(255,255,255,.15)`, knob left
- Moon icon when dark, sun icon when light
- Sub-label shows current mode: "Dark mode" / "Light mode"

---

## 3. Shared Components

### `Button.tsx`
- Primary: gradient `linear-gradient(135deg, #e07854, #c4613d)`, height 52, radius 16, DM Sans 700 15px, box-shadow `--shadow-primary`
- Ghost: transparent bg, `--color-border` border, `--color-text-2`
- Outline: transparent bg, primary color border + text
- Danger: `rgba(220,60,60,.12)` bg, red border + text
- Press: `scale(.97)` transform
- Loading: `autorenew` icon with spin animation

### `Card.tsx`
- Background: `--color-surface`
- Border: `1px solid var(--color-border)`
- Border-radius: `20px`
- Shadow: `var(--shadow-md)`

### `BottomNav.tsx`
- Background: `rgba(26,23,20,.92)` dark / `rgba(250,248,244,.94)` light, `backdrop-filter: blur(12px)`
- Border-top: `1px solid var(--color-divider)`
- Active: `--color-primary`, filled icon variant
- Inactive: `--color-text-3`

### `Toast.tsx`
- Surface bg, warm tokens
- Success: sage accent, `check_circle` icon
- Warning: amber accent, `warning` icon
- Error: red accent, `error` icon

---

## 4. Screen Designs

### Auth screens

#### `LoginScreen.tsx`
- Full-bleed travel photo background
- Dark mode overlay: `linear-gradient(rgba(15,12,10,.55), rgba(15,12,10,.96))`
- Light mode overlay: `linear-gradient(rgba(250,240,228,.30), rgba(250,248,244,.97))`
- Brand lockup: 68×68px logo tile (radius 22, glass bg), Playfair "uncover roads" heading
- Floating icons: 9 Material Symbols rising from bottom, `floatUp` animation, staggered delays
- Google sign-in button: surface bg, primary border on focus/press
- Entry: `opacity 0→1`, `translateY(16px)→0`, 0.6s

#### `WalkthroughScreen.tsx`
- Slide cards: `--color-bg` background, Playfair headings, DM Sans body
- Progress dots: `--color-primary` active, `--color-surface2` inactive
- CTA: primary gradient button, 52px height, radius 16
- Slide entry: `springUp` per slide

#### `WelcomeBackScreen.tsx` *(inferred)*
- Same bg/overlay treatment as LoginScreen
- Avatar circle: `--color-primary-bg` tint, user initial in primary color
- Token + font swap; layout unchanged

### Onboarding

#### `OnboardingShell.tsx`
- Background: `--color-bg`
- Progress bar: `--color-primary`, thin 2px strip at top
- Question heading: Playfair Display 22px 700, `--color-text-1`
- Back button: ghost circle, 36×36

#### Onboarding question screens (`OB1`–`OB9`)
- `OptionCard`: surface card, radius 16, selected = primary border + `--color-primary-bg` tint + ripple animation
- `BentoCard`: surface2 bg, radius 14
- `ImageRowCard`: full-bleed image, gradient overlay, Playfair label
- Conflict panel: `--color-amber-bg` bg, `--color-amber-bdr` border, `lightbulb` icon
- Next button: primary gradient; Back button: ghost

#### `PersonaScreen.tsx` / `PersonaModal.tsx`
- Archetype hero card: `linear-gradient(150deg, {archetype.glow}, rgba(255,255,255,.02))`, border `{archetype.primary}28`
  *(where `{archetype.glow}` and `{archetype.primary}` are runtime values from the `ARCHETYPES` constant in `theme.jsx` / `store.tsx` — e.g. explorer uses `rgba(107,148,112,.14)` / `#6b9470`)*
- Radial glow overlay on left edge
- Archetype emoji: 42px with `drop-shadow(0 0 16px {primary}70)`
- Name: Playfair 17px, tagline: 12px `--color-text-3`
- Match bars: height 5, `border-radius: 99px`, animated width on mount, `transition: width .9s cubic-bezier(.25,0,0,1)`, staggered delays
- Entry: `springUp` animation

### Main tabs

#### `DestinationScreen.tsx` (Home / Explore)
- Header: date label (`--color-text-3`, 11px) + Playfair "uncover roads" gradient title + avatar circle
- Search bar: `--color-surface` bg, height 50, radius 18, `wiggleFocus` on focus, primary border when focused
- City suggestion cards: full-bleed photo, gradient overlay, Playfair city name 22px, country + tag caption 11px
- In-progress trip banner: surface card with 145px photo + "Continue trip" pill
- Section headers: Playfair 16px 700

#### `TripsScreen.tsx`
- Trip cards: 145px height, `border-radius: 22px`, full-bleed city photo
- Gradient overlay: `linear-gradient(160deg, rgba(20,16,12,.22) 0%, rgba(20,16,12,.8) 100%)`
- Top-left: city name Playfair 22px + country/date/stops caption 11px
- Top-right: archetype badge (archetype bg/border, icon + name 10px 700)
- Bottom-left: "Continue trip" pill — `rgba(255,255,255,.12)` bg + blur, `play_arrow` icon
- Entry: `cardEntry` keyframe staggered by `index * 0.09s`

### Map

#### `MapScreen.tsx`
- Map tiles: per theme (dark_matter / voyager)
- `PinCard`: surface warm bg, Playfair place name, primary accent, persona badge
- Search bar + `SearchDropdown`: warm surface, primary focus border
- `FilterBar` chips: `--color-surface2` bg, primary active state
- `TripPlanningCard`: surface card, gradient CTA
- `OriginSearchCard`, `SearchResultCard`: surface tokens throughout

### Journey Planner

#### `JourneyScreen.tsx`
- Map panel (58% height): dark radial gradient `#0c1020→#060c1a`, grid overlay SVG at opacity 0.06
- City dots: 9px inactive / 14px active, `#e07854` active with white border + `pinPulse` ring
- Dashed route line: `rgba(224,120,84,.35)`, `strokeDasharray: 5 4`
- Fade at bottom: 60px gradient into card panel bg
- Progress strip: pill tabs, height 28, radius 99, active = `--color-primary-bg` + primary border + `scale(1.05)`
- Origin card: `flight_land` icon sky-tinted, Playfair place name 18px
- City card: 44×44 thumbnail, Playfair name + flag, days chip, place preview pills, "+ Add" dashed pill
- Transit card: mode icon sky-tinted, Playfair route label, duration chip (sky), amber tip card
- Advisor thread: `--color-sage-bg` bg, `--color-sage-bdr` border, `springUp` slide-in
- Build CTA: gradient primary, height 50, radius 16 → green + spin icon on press → navigate after 800ms

### Route / Itinerary

#### `RouteScreen.tsx` — Map + Place Card layout (layout preserved)
- Map: full-screen MapLibre, tiles per theme
- Floating header: blur circle back button + weather pill (existing pattern, new tokens)
- Progress dots: fixed right edge, active = `width 5, height 18, border-radius 99` white pill, inactive = `width 4, height 4, rgba(255,255,255,.3)`
- `ItineraryPlaceCard`: `--color-surface` bg, Playfair place name, primary time badge, category/transit/persona chips
- `ItineraryMapCard`: warm surface tokens, sky accent for transit
- "Start navigating" CTA: gradient primary, radius 16
- Card slide-up: `springUp` on stop change

#### Itinerary map route rendering
- **Main route**: solid polyline, 3.5–4px stroke, `#e07854`, Google Directions style, rendered via MapLibre GeoJSON line layer
- **Rec branches**: dashed line, 1.8px, category color — amber (food), sage (café/drinks), sky (viewpoint/park)
- Branch originates from midpoint of the leg between two stops
- Branch origin dot: 5px filled circle in category color on main route line
- Rec markers: 11px dots (smaller than 14px stop markers), category color, white border
- Tap rec marker → `ItineraryPlaceCard` with "Detour ↗" badge, walking time from route, "Add to itinerary" CTA
- Max 2 dotted branches visible simultaneously

#### `rec-rules.ts` (new file: `src/modules/route/rec-rules.ts`)
All recommendation trigger conditions declared as a typed constant:
```ts
// Time windows
MEAL_WINDOWS: [{ start: '11:30', end: '14:00', type: 'lunch' }, { start: '18:00', end: '21:00', type: 'dinner' }]
COFFEE_WINDOWS: [{ start: '08:00', end: '11:00' }, { start: '14:30', end: '17:00' }]

// Distance thresholds by persona pace
MAX_DETOUR_METRES: { walker: 500, relaxed: 800, active: 1200, default: 600 }

// Persona → rec category preference
PERSONA_REC_MAP: {
  epicurean: ['restaurant', 'food_market'],
  explorer: ['viewpoint', 'park', 'hidden_gem'],
  slowtraveller: ['cafe', 'bookshop', 'garden'],
  historian: ['monument', 'museum', 'gallery'],
}

// Suppression rules
MIN_GAP_MINUTES: 30          // suppress recs if stop gap < 30 min
MAX_BRANCHES_VISIBLE: 2      // never show more than 2 dotted branches at once
```
The map rendering layer reads these rules; no business logic lives in rendering code.

#### `RouteScreen.tsx` — Multi-day view
- Sticky header: `--color-bg` bg, divider border-bottom, back circle, Playfair city + days
- Day divider: `flex:1 height:1` divider line + Playfair 13px 700 date text + line, `margin: 22px 0 14px`
- Timeline stop: 32×32 icon box (`border-radius: 10`, `--color-primary-bg`) + vertical 1px connector line + surface card (radius 14, padding 12×14)
- Card: time badge 11px primary, place name Playfair 15px 700, tip 11px `--color-text-3`
- Entry: `opacity 0→1`, `translateY(18px)→0`, `transition-delay: dayIndex * 0.1s`

### Profile

#### `ProfileScreen.tsx`
- Header: Playfair "Profile" 18px, sign-out button text
- User card: 48×48 avatar circle (`--color-primary-bg`), name 14px 700, email 11px `--color-text-3`, FREE/PRO badge
- Archetype hero card: `linear-gradient(150deg, {archetype.glow}, rgba(255,255,255,.02))`, `border: 1px solid {archetype.primary}28`
  *(runtime values from `ARCHETYPES` constant — same as PersonaScreen above)*
- Match bars: staggered `width` animation on mount
- Trip Focus + Venues: 2-col grid of surface cards
- Preference accordion: `expand_more` rotates 180° when open, chip grid with primary active state
- **Appearance row** (App section): toggle switch (36×20px pill), moon/sun icon, sub-label "Dark mode"/"Light mode"
- Save button: gradient primary, height 52, radius 18 → green + `check_circle` on save

#### Profile sub-screens *(inferred)*
All four sub-screens (Notifications, Privacy, Units, Subscription Details):
- Sticky header: back circle 36×36 + Playfair screen title
- Body: surface card blocks, warm tokens throughout, chevron_right rows

#### `SubscriptionScreen.tsx` + `MiniPaywall.tsx` *(inferred)*
- Plan cards: `--color-surface` bg, amber accent for Pro tier, primary for Unlimited
- Feature list rows: `check_circle` icon in sage/primary
- CTA: gradient primary button, 52px height, radius 16

#### `NavScreen.tsx` *(inferred)*
- Map full-bleed, overlay cards get warm surface tokens
- Direction step cards: `--color-surface` bg, Playfair place name, primary accent

---

## 5. Extra Screens — Disposition

| Screen | Action |
|---|---|
| Snap-scroll Itinerary Reel (prototype `screens-route.jsx`) | **Discarded** — layout not adopted. `ItineraryCards.tsx` gets token/font update only |
| Onboarding screens OB1–OB9 | **Redesigned** — full design handoff treatment |
| `WelcomeBackScreen` | **Inferred** — same treatment as LoginScreen |
| `NavScreen` | **Inferred** — warm tokens on overlay cards |
| Profile sub-screens | **Inferred** — sticky header + settings row pattern |
| `SubscriptionScreen` / `MiniPaywall` | **Inferred** — warm tokens, amber/primary plan cards |

---

## 6. Implementation Order

1. Create branch `feature/design-system-redesign` from `main`
2. Update `index.css` — replace `@theme` tokens, add `[data-theme=light]` block, add animations
3. Update Google Fonts import in `index.html` — add Playfair Display + DM Sans
4. Add `theme` to Zustand store + boot-time `data-theme` application
5. Update shared components: `Button`, `Card`, `BottomNav`, `Toast`
6. Auth screens: `LoginScreen`, `WalkthroughScreen`, `WelcomeBackScreen`
7. Onboarding: `OnboardingShell`, OB1–OB9, questionnaire components, `PersonaScreen`
8. Main tabs: `DestinationScreen`, `TripsScreen`
9. Map: `MapScreen` + all map sub-components
10. Journey: `JourneyScreen` + all journey sub-components
11. Route/Itinerary: `RouteScreen`, `ItineraryPlaceCard`, `ItineraryMapCard`, create `rec-rules.ts`
12. Profile: `ProfileScreen` + all sub-screens, `SubscriptionScreen`, `MiniPaywall`, `NavScreen`
13. Final pass: verify light mode across all screens, fix any token misses

---

## 7. Out of Scope

- No logic changes to hooks, API calls, or store selectors (except adding `theme` field)
- No new screens beyond what exists
- No Tailwind → plain CSS migration
- No changes to animation library (CSS keyframes only, no Framer Motion)
- Map recommendation logic (fetching recs from API) is pre-existing — `rec-rules.ts` is rendering/display rules only
