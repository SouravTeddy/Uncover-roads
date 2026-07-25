# Screen-by-Screen Fix Design
**Date:** 2026-05-13
**Branch:** `feature/google-maplibre`
**Source of truth:** `~/Downloads/Uncover_Roads_Design/design_handoff/HANDOFF.md` + prototype

---

## Goal

Fix every screen systematically using a token-first approach (Layer 1) followed by a screen-by-screen sweep (Layer 2). All visual decisions reference the design handoff as the single authority.

---

## Layer 1 — Design System

Fix once. Every screen inherits the result.

### 1.1 Color Tokens (`frontend/src/index.css`)

Replace all terracotta (`#e07854`) tokens with the correct amber/gold palette from the handoff:

```
bg:          #0c0c0e
bg2:         #111114
surface:     #18181c
surface2:    #1f1f24

primary:     #d4a853
primaryDark: #b8893a
primaryBg:   rgba(212,168,83,.10)
primaryGlow: rgba(212,168,83,.22)

text1:       #f2ede6
text2:       #a09888
text3:       #6a6058
text4:       #3e3830

border:      rgba(242,237,230,.07)
borderM:     rgba(242,237,230,.13)
divider:     rgba(242,237,230,.06)

nav-bg:      rgba(18,18,22,.92)
```

### 1.2 Light Theme (`[data-theme=light]`)

Rebuild light theme vars so switching doesn't break the UI:

```
bg:      #faf8f4
bg2:     #f2ede5
surface: #ffffff
surface2:#f8f4ef
text1:   #2c2420
text2:   #6b5e57
text3:   #a09085
text4:   #c4b8b0
border:  rgba(44,36,32,.08)
borderM: rgba(44,36,32,.14)
divider: rgba(44,36,32,.06)
```

### 1.3 Fonts (`frontend/index.html`)

Replace Playfair Display with Cormorant Garamond. Two fonts only:

| Role | Family | Weights |
|---|---|---|
| Display / headlines / city names | Cormorant Garamond | 600, 700, 700 italic |
| All UI / body / labels / buttons | DM Sans | 300, 400, 500, 600, 700 |

Update Google Fonts link in `index.html`. Update `--font-heading` CSS var.

### 1.4 Community Removal

Grep and delete all references to `community` across:
- `shared/types.ts` — remove from `MapFilter` union if present
- `map/types.ts` — remove from `FILTER_CHIPS`
- Any UI rendering `community` label or chip

---

## Layer 2 — Screens

Fix in this order. Each screen has a clear checklist.

---

### Screen 1 — Login + Walkthrough

Token and font pass only. Structure is correct per handoff.

**Checklist:**
- All hardcoded hex colors → CSS vars
- Heading font → Cormorant Garamond
- Primary button gradient → `linear-gradient(135deg, #d4a853, #b8893a)`
- Walkthrough progress dots active color → `--color-primary`

---

### Screen 2 — Onboarding

Rebuild question cards as 2×2 photo grid per handoff. Currently rendering as a list.

**Grid spec:**
```
Layout:   2-column grid, gap 8px, padding 0 12px
Each cell: height 130px, borderRadius 18px, overflow hidden
Photo:    full-bleed cover
Label:    bottom-anchored — Cormorant Garamond 700 18px + DM Sans 10px sublabel
Overlay:  rgba(0,0,0,.20 → .72) unselected | rgba(0,0,0,.05 → .55) selected
```

**Selected state:**
```
scale(1.03)
boxShadow: 0 0 0 2.5px {archetypeColor}, 0 8px 28px rgba(0,0,0,.5)
Check badge: top-right, 24×24 circle, solid {archetypeColor} bg, white check 14px
Animation: dotPop .25s spring on select
```

**Unselected (when another is chosen):** `scale(.97)`, `opacity .52`

**Multi-select questions (steps 4, 5):**
- Empty checkbox outline on unselected: 22×22, borderRadius 6, `rgba(255,255,255,.35)` border
- "Pick all that apply" amber pill badge top-right of grid
- Manual Continue button (no auto-advance)

---

### Screen 3 — Persona Reveal

3-beat entrance per handoff. Archetype colors use warm palette from `ARCHETYPE_COLORS`.

**Checklist:**
- Confetti on reveal (24 pieces, archetype palette colors)
- Archetype hero card: correct gradient `linear-gradient(150deg, {primary}15, rgba(255,255,255,.02))`
- Match bars: animated fill `0 → pct`, transition `.9s cubic-bezier(.25,0,0,1)`, stagger `index × 120ms`
- All hardcoded colors → archetype palette vars

---

### Screen 4 — Map

#### 4.1 FilterBar

Two chips only: **All** and **Curated**.

**All chip (default):**
- Collapsed: shows "All" label + layers icon + total pin count
- Tap → expands inline to sub-category row (horizontal scroll):
  `Landmarks | Cafes | Parks | Dining | Galleries`
  Each sub-chip filters pins to that category
- Tap active sub-chip or tap All again → collapses back to "All"

**Curated chip:**
- Shows Our Picks pins only (Pro-gated)
- No expansion — single toggle

#### 4.2 Pin System

All pins are the same size (28px diameter). Icon + color differentiates type.

**Category → icon + color mapping:**

| Category | Icon | Color |
|---|---|---|
| Park / Nature | `park` | `#5a8a60` sage |
| Dining | `restaurant` | `#d4a853` amber |
| Cafe | `local_cafe` | `#b88c3a` amber-dark |
| Heritage / Landmark | `account_balance` | `#4a7fa0` sky |
| Gallery / Art | `palette` | `#8878b8` violet |
| Trending | `local_fire_department` | `#e05050` red-orange |
| Curated / Our Picks | `auto_awesome` | `#d4a853` primary gradient |
| Event | `celebration` | `#8878b8` violet |

**Pin states (priority order — higher wins):**

1. **Selected (added to itinerary):**
   - Pin bg: solid category color
   - Icon: white
   - Number badge: position in itinerary (1, 2, 3…), bottom-right, 16×16, dark bg
   - Entrance: `dotPop .25s spring`
   - Overrides hot state

2. **Hot / Limited (trending or crowd_ratio flag):**
   - Normal pin + fire badge overlay top-right (12×12, `#e05050` bg, `bolt` icon 8px)
   - Bounce animation: `translateY(0 → -5px → 0)`, 1.8s ease-in-out infinite
   - Only when NOT selected

3. **Normal:**
   - Pin bg: `{categoryColor}18`
   - Border: `{categoryColor}50`
   - Icon: category color, 14px Material Symbol

**Pin clustering:**
- Use existing cluster logic in `MapLibreMarkers`
- Cluster badge: count + neutral bg
- If cluster contains ≥1 hot pin → fire badge overlay on cluster bubble
- Tapping cluster zooms in and expands pins

#### 4.3 Place Card (bottom sheet)

Fixed height — not scrollable. Content:
```
Place name:    Cormorant Garamond 700 22px
Category chip + rating chip + distance chip   (Chip component)
CTA row:       "Add to Plan" (primary Btn) + "More info" (ghost Btn)
```
No overflow. If name is long: 2-line clamp.

#### 4.4 Surprise Me

Wire `SurpriseMeButton.tsx` to `POST /api/surprise-me`. On tap:
- Button shows spinner (`autorenew` spin animation)
- On response: hydrate store itinerary as normal, navigate to itinerary reel
- On error: toast "Couldn't generate — try again"

#### 4.5 Build Itinerary Minimum

Require `selectedPlaces.length >= 2` before enabling the Build CTA.

- **0–1 places:** Button disabled, `opacity .45`, `cursor: not-allowed`
- **1 place:** Nudge label below button: `"Add one more place to build"` — DM Sans 11px text3
- **≥2 places:** Button active, nudge hidden

---

### Screen 5 — Profile

Full rebuild per handoff. Currently broken fonts and layout.

**Checklist:**
- Section labels: DM Sans 700 10px uppercase, letterSpacing `.14em`, text3
- Avatar circle: `primaryBg` bg, initial letter DM Sans 800 18px primary
- Archetype hero card: gradient + radial glow on left edge
- Match bars: animated fill with stagger
- Preference accordion: `expand_more` rotates 180° when open, `springUp` on body open
- All heading text → Cormorant Garamond
- All UI text → DM Sans
- Remove any Community section

---

### Screen 6 — Itinerary / Route

Fix snap-scroll reel. Currently broken card sequence.

**Card order:** Intro → [Stop → Reco]* → Finale

**Checklist:**
- `scroll-snap-type: y mandatory`, each card `100dvh`, `scroll-snap-stop: always`
- Floating header (fixed): back button + WeatherWidget
- Progress dots (fixed right): active `5×18px` white pill, inactive `4×4px` dim dot
- Intro card: city name Cormorant 900 48px, stats pills row, swipe hint
- Stop card: `STOP N OF M` eyebrow, place name Cormorant 900 34px, remove button top-right
- Reco card: dimmed bg, transit strip, `WHILE YOU'RE HERE` eyebrow
- Finale card: star icon springUp, confetti, `Save trip` + `Saved trips` CTAs
- Multi-day view (`RouteScreen`): day dividers, timeline stops, entry animation per day group

---

## Pin State Priority (summary)

```
Selected > Hot > Normal
```

Once a place is added to the itinerary, hot animation stops. Number badge replaces fire badge.

---

## Out of Scope

- New screens or features beyond what's described here
- API changes beyond wiring Surprise Me
- Conversational origin flow
- Any screen not listed above
