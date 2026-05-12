# Walkthrough Screen Redesign

**Date:** 2026-04-30
**Status:** Approved — ready for implementation

## Goal

Replace the current `WalkthroughScreen.tsx` (static icon-in-a-glowing-box swipe cards) with a 5-slide animated feature tour that creates hype before the user hits onboarding. Each slide uses the app's design system — warm dark palette, Playfair Display headings, terracotta/sky/amber/sage accents — with a CSS/Lottie animation in the upper stage and readable text below.

---

## Visual Design

**Layout per slide (Layout 2 — tilted editorial → evolved to full-screen phone native):**
- Dark warm background `#1a1714` with a per-slide radial tint
- Upper stage (~55% of screen): animated scene, no text
- Lower panel: chip label → Playfair Display title → DM Sans description
- Bottom strip: morphing step dots + full-width CTA button

**Fonts:** `Playfair Display` for slide titles, `DM Sans` for all other text (already in project).

**Accent colour per slide:**
| Slide | Accent | Token |
|-------|--------|-------|
| 1 | Terracotta | `--color-primary` `#e07854` |
| 2 | Sky blue | `--color-sky` `#4f8fab` |
| 3 | Amber | `--color-amber` `#c49840` |
| 4 | Sage | `--color-sage` `#6b9470` |
| 5 | Terracotta | `--color-primary` `#e07854` |

---

## Slide Content

### Slide 1 — Persona
- **Chip:** Persona
- **Title:** Discover your travel DNA
- **Body:** 9 questions. One archetype. Every recommendation tuned to who you are.
- **Animation:** Silhouette figure materialises from blur → archetype badge pops in with bounce → three trait lines reveal staggered. Ambient terracotta glow breathes behind.
- **CTA:** Next →

### Slide 2 — Any city
- **Chip:** Explore
- **Title:** Any city, anywhere
- **Body:** Search any destination and step straight onto its map — Tokyo to Lisbon.
- **Animation:** Map grid background. Floating search bar with blinking cursor. Four colour-coded pins drop in sequence (terracotta → sky → sage → amber) each with a pulse ring on arrival.
- **CTA:** Next →

### Slide 3 — Smart picks
- **Chip:** Smart Picks
- **Title:** Knows what's worth it
- **Body:** Tracks trends, flags what to skip, surfaces hidden gems others miss.
- **Animation:** Three signal cards slide in from right, staggered 300ms apart — "Trending now" (amber, blinking dot) → "Skip this one" (red) → "Hidden gem" (sage). Each has left-border colour accent.
- **CTA:** Next →

### Slide 4 — Multi-city
- **Chip:** Multi-city
- **Title:** One trip, many cities
- **Body:** Paris, Rome, Barcelona — a full itinerary for every stop, in one place.
- **Animation:** City rows pop in top-to-bottom. Connector lines draw between them (sage → sky gradient). Third row is a dashed "Add a city" that pulses.
- **CTA:** Next →

### Slide 5 — Trip packages
- **Chip:** Trip Packages
- **Title:** First 2 trips on us
- **Body:** Your first two full itineraries are free. After that, pay only for the trips you take.
- **Animation:** Confetti dots scatter from top. FREE badge bounces in (spring easing, overshoots). Pay-per-trip card fades up 700ms later.
- **CTA:** Get started →
- **Note:** No skip button on final slide.

---

## Transitions

- **Between slides:** Background tint cross-fades (terracotta → sky → amber → sage → terracotta). Content exits left, new content enters right.
- **Within each slide (on entry):** chip (50ms delay) → title slides up (150ms) → description fades (300ms) → CTA rises (450ms). Stagger via Framer Motion `variants` + `staggerChildren`.
- **Step dots:** Active dot morphs width from 5px → 16px with spring easing. Previous dots shrink back.
- **Swipe gesture:** Existing touch handlers retained. Min delta 48px to trigger advance/back.

---

## Architecture

**File modified:** `frontend/src/modules/login/WalkthroughScreen.tsx`

No new files required. The redesign is self-contained in one component.

**Dependencies:**
- Framer Motion (being added in Phase 2 OB Visual Journey — ensure it lands first, or install independently)
- Fonts already loaded via Google Fonts in index.html
- Design tokens already in `index.css`

**CARDS data shape** (replaces current array):
```typescript
interface WalkthroughCard {
  id: string
  chip: string
  accentToken: string          // CSS var name e.g. '--color-primary'
  accentBgToken: string        // e.g. '--color-primary-bg'
  accentBdrColor: string       // rgba string for border
  title: string
  desc: string
  animation: 'persona' | 'city' | 'recs' | 'multicity' | 'pricing'
  cta: string
  hideSkip?: boolean
}
```

**Animation components** — one small component per animation type, each self-contained:
- `WTPersonaAnim` — silhouette + badge + traits
- `WTCityAnim` — map grid + pins + search bar
- `WTRecsAnim` — three signal cards staggered
- `WTMultiCityAnim` — city chain with drawing connectors
- `WTPricingAnim` — confetti + FREE bounce + pay card

**Slide transitions:** Replace manual touch handler + `setIndex` with Framer Motion `AnimatePresence` + `motion.div` so enter/exit cross-fades are automatic.

---

## Spec Self-Review

- No TBDs or placeholders — all copy, colours, and animation behaviours are defined.
- Framer Motion dependency is noted and sequenced correctly after Phase 2.
- Architecture is scoped to one file modification + five small animation sub-components.
- No contradictions between sections.
