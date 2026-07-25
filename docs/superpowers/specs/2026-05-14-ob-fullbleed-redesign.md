# OB Full-Bleed Redesign + Transitions
**Date:** 2026-05-14
**Branch:** `feature/login-ob-ui-fixes`
**Status:** Approved — ready for implementation

---

## Goal

Four changes to the onboarding experience:
1. Full-bleed per-step background images in `OnboardingShell` (the current solid dark overlay hides everything)
2. Question reorder — move budget to Q2 so it informs all downstream questions
3. Dynamic Q2 options — when group=family, swap mood options to family-specific ones (no badge, silent)
4. App-wide calming crossfade transitions (400ms ease-in-out) replacing instant screen cuts

---

## 1. OnboardingShell — Full-Bleed Background

### Problem

`OnboardingShell.tsx:66` has `background: 'rgba(12,12,14,.82)'` on the full-screen fixed div. This covers the `OBBackground` 5-layer compositor and the `STEP_HERO` images entirely. The `h-44` hero thumbnail at the top is a band, not an immersive background.

### New Layout Structure

```
div.fixed.inset-0 (outer shell — no background)
  ── Background stack (absolute, inset-0, z-0):
     AnimatePresence > motion.img  key={step}, full-screen object-cover, crossfade 600ms
     div.gradient-overlay          transparent top → rgba(12,12,14,1) at 68%, solid at 80%
     OBBackground                  answer-driven gradient tinting (existing, keep)
     PersonaSilhouette             builds with each answer (existing, keep)

  ── Content stack (absolute, inset-0, z-10, flex col):
     ── Header (floating, transparent):
        back button (blur backdrop circle)
        "Travel Preferences" label (blur backdrop pill)
        progress bar (2px, rgba white track, amber fill)

     ── flex-1 spacer             background breathes here

     ── Bottom content (no card, no bg — sits on gradient):
        step label (e.g. "Step 02 of 07") — amber/60 color
        question title — Cormorant Garamond 700 22px, text1
        PhotoGrid2x2 children

     ── Footer:
        step dots + Next/Finish button
```

### Hero Image Crossfade

Use `AnimatePresence mode="wait"` with `motion.img key={step}`:
- `initial`: `opacity: 0`
- `animate`: `opacity: 1`, transition `duration: 0.6, ease: 'easeInOut'`
- `exit`: `opacity: 0`, transition `duration: 0.4`

### Gradient Overlay

```css
background: linear-gradient(
  to bottom,
  rgba(12,12,14,0.05)  0%,
  rgba(12,12,14,0.15)  22%,
  rgba(12,12,14,0.75)  50%,
  rgba(12,12,14,0.97)  68%,
  rgba(12,12,14,1.0)   80%,
  rgba(12,12,14,1.0)  100%
);
```

### Floating Header Style

```tsx
// Back button
<div style={{
  width: 36, height: 36, borderRadius: '50%',
  border: '1px solid rgba(242,237,230,.12)',
  background: 'rgba(12,12,14,.4)',
  backdropFilter: 'blur(8px)',
}}/>

// Title pill
<div style={{
  background: 'rgba(12,12,14,.35)',
  backdropFilter: 'blur(6px)',
  borderRadius: 20, padding: '4px 14px',
  fontSize: 13, fontWeight: 600, color: '#f2ede6',
}}/>
```

### Remove

- The `h-44` hero `<img>` element from the body section
- The `background: 'rgba(12,12,14,.82)'` from the fixed inner div
- The `backdropFilter: 'blur(0px)'` style

---

## 2. Question Order

### Current

`BASE_OB_STEPS = ['ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7']`

Meaning: group → mood → pace → day_open → dietary → budget → evening

### New

`BASE_OB_STEPS = ['ob1', 'ob6', 'ob2', 'ob3', 'ob7', 'ob5', 'ob4']`

Meaning: group → **budget** → mood → pace → evening → dietary → day_open

### Why

Budget is the largest filter in the recommendation engine. Moving it to Q2 (immediately after group) means:
- Mood/pace options can be framed within that budget context
- The full-day-arc is natural: who → money → vibe → pace → evening close
- Dietary and day_open move to end as operational details

### File Changes

- `frontend/src/modules/onboarding/types.ts` — update `BASE_OB_STEPS` array only
- `STEP_TITLES` stays unchanged (titles still map by step key, not position)
- `useOnboarding.ts` — no changes needed (reads `BASE_OB_STEPS` dynamically)
- `ob-context-resolvers.ts` — no changes needed (resolvers check answer values, not position)

---

## 3. Dynamic Q2 Options — Family

### Current Behaviour

`OB2Mood` always shows the same 4 options regardless of Q1 answer. `resolveQ2Mood` changes the *title* for family, but the options (Explore / Unwind / Eat & Drink / Culture) are unchanged.

### New Behaviour

When `answers.group === 'family'`, `OB2Mood` renders a different set of 4 options:

| Default | Family |
|---------|--------|
| Explore — Hidden streets, surprises | Outdoors — Parks, nature, hikes |
| Unwind — Slow pace, cafés, parks | Educational — Museums, history, hands-on |
| Eat & Drink — Markets, tables, tastings | Eat & Explore — Kid-friendly food & markets |
| Culture — Museums, history, art | Slow & Easy — Relaxed pace, no rushing |

No visual badge or indicator. The question title changes (already implemented in `resolveQ2Mood`), the background hero crossfades to the family photo, and the options silently swap.

### Implementation

Add `getMoodOptions(answers)` function to `OB2Mood.tsx`:

```typescript
const DEFAULT_OPTIONS = [
  { value: 'explore',   label: 'Explore',     sublabel: 'Hidden streets, surprises',
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80' },
  { value: 'relax',     label: 'Unwind',       sublabel: 'Slow pace, cafés, parks',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
  { value: 'eat_drink', label: 'Eat & Drink',  sublabel: 'Markets, tables, tastings',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
  { value: 'culture',   label: 'Culture',      sublabel: 'Museums, history, art',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80' },
]

const FAMILY_OPTIONS = [
  { value: 'explore',   label: 'Outdoors',     sublabel: 'Parks, nature, hikes',
    imageUrl: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80' },
  { value: 'culture',   label: 'Educational',  sublabel: 'Museums, history, hands-on',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80' },
  { value: 'eat_drink', label: 'Eat & Explore', sublabel: 'Kid-friendly food & markets',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
  { value: 'relax',     label: 'Slow & Easy',  sublabel: 'Relaxed pace, no rushing',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
]

function getMoodOptions(answers: Partial<RawOBAnswers>) {
  return answers.group === 'family' ? FAMILY_OPTIONS : DEFAULT_OPTIONS
}
```

The underlying `value` keys (`explore`, `relax`, `eat_drink`, `culture`) are reused deliberately so the resolver engine receives the same answer keys regardless of which option set was shown.

### Background Hero for Q2 Family

Add `ob2_family` hero image to `STEP_HERO` fallback logic in `OnboardingShell`: when `step === 'ob2'` and `answers.group === 'family'`, use the family hero URL instead of the default mood image.

```typescript
const heroUrl = (step === 'ob2' && answers.group === 'family')
  ? 'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=800&q=80'
  : STEP_HERO[step]
```

---

## 4. App-Wide Calming Transitions

### Scope

Every screen change in `App.tsx` is currently an instant conditional render swap. Add a 400ms crossfade for all screen transitions.

### Implementation — `App.tsx`

Wrap the screen render block in `AnimatePresence` + `motion.div` keyed on `currentScreen`:

```tsx
import { AnimatePresence, motion } from 'framer-motion'

// Inside ScreenRouter return:
<div className="relative w-full" style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>
  <AnimatePresence mode="wait">
    <motion.div
      key={currentScreen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {currentScreen === 'login'        && <LoginScreen />}
      {/* ... all screens ... */}
    </motion.div>
  </AnimatePresence>
  <InstallPrompt />
  <BottomNav />
</div>
```

`BottomNav` and `InstallPrompt` render outside `AnimatePresence` so they don't flash on every transition.

### OB Step Transitions

OB steps are already handled by the app-wide transition above (each `ob1`–`ob9` is a different `currentScreen`). No additional OB-specific transition needed.

### Note on BottomNav

`BottomNav` is conditionally hidden on OB screens already. Moving it outside `AnimatePresence` preserves that behaviour.

---

## File Map

| File | Change |
|---|---|
| `frontend/src/modules/onboarding/OnboardingShell.tsx` | Full-bleed background, floating header, remove h-44 thumbnail, gradient overlay, dynamic hero URL |
| `frontend/src/modules/onboarding/types.ts` | Reorder `BASE_OB_STEPS` |
| `frontend/src/modules/onboarding/OB2Mood.tsx` | `getMoodOptions()` — family vs default options |
| `frontend/src/App.tsx` | `AnimatePresence` wrapper for all screen transitions |

**No changes to:** OB3–OB9 screens, `useOnboarding.ts`, `ob-context-resolvers.ts`, `ob-resolver.ts`, `OBBackground.tsx`, `PersonaSilhouette.tsx`, `PhotoGrid2x2.tsx`

---

## Spec Self-Review

- No TBDs. All copy, colours, URLs, and transition values are specified.
- `BASE_OB_STEPS` reorder uses existing step keys — no component renames needed.
- Family options reuse the same underlying `value` keys so the resolver is unaffected.
- `AnimatePresence mode="wait"` prevents two screens existing simultaneously (avoids z-index fights).
- `BottomNav` outside `AnimatePresence` — won't flash on OB transitions.
- Gradient values match the visual mockup approved in brainstorm session.
