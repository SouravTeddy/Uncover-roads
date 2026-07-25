# OB Full-Bleed Redesign + Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the onboarding experience with full-bleed background photos, reordered questions (budget moves to Q2), dynamic family-specific mood options, and a calming 400ms crossfade across all app screen transitions.

**Architecture:** Four isolated changes across four files — `App.tsx` (transition wrapper), `types.ts` (step order), `OnboardingShell.tsx` (full-bleed layout), and `OB2Mood.tsx` (dynamic options). No new files. No changes to the resolver engine, OBBackground, or any OB3–OB9 screens.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion (already installed), Vitest.

**Working directory:** `frontend/` in the `feature/login-ob-ui-fixes` branch.

**Baseline:** Run `npx vitest run` before starting. All tests must pass.

---

## File Map

| File | What changes |
|---|---|
| `frontend/src/App.tsx` | Add `AnimatePresence` + `motion.div` wrapper around screen list |
| `frontend/src/modules/onboarding/types.ts` | Reorder `BASE_OB_STEPS` array |
| `frontend/src/modules/onboarding/OnboardingShell.tsx` | Full rewrite — full-bleed bg, gradient overlay, floating header, `heroUrl` prop |
| `frontend/src/modules/onboarding/OB2Mood.tsx` | Add `getMoodOptions()`, family `FAMILY_OPTIONS`, pass `heroUrl` to shell |

---

## Task 1: App-Wide Calming Transitions

**Files:**
- Modify: `frontend/src/App.tsx`

Wraps every screen render in `AnimatePresence` + `motion.div` keyed on `currentScreen`. `BottomNav` and `InstallPrompt` stay outside so they don't flash on transitions.

- [ ] **Step 1: Verify baseline tests pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass. Note the count — it must not decrease after this task.

- [ ] **Step 2: Add AnimatePresence import to App.tsx**

Open `frontend/src/App.tsx`. The top of the file currently has:
```tsx
import React, { useEffect, useState } from 'react';
```

Add the framer-motion import directly after the React import line:
```tsx
import { AnimatePresence, motion } from 'framer-motion';
```

- [ ] **Step 3: Wrap the screen list in AnimatePresence**

In `App.tsx`, find the `ScreenRouter` return statement. The outer `<div>` currently looks like:

```tsx
return (
  <div
    className="relative w-full"
    style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}
  >
    {currentScreen === 'login'        && <LoginScreen />}
    {currentScreen === 'welcome'      && <WelcomeBackScreen />}
    {/* ... all screens ... */}
    <InstallPrompt />
    <BottomNav />
  </div>
);
```

Replace it with:

```tsx
return (
  <div
    className="relative w-full"
    style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={currentScreen}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{ position: 'absolute', inset: 0, minHeight: '100dvh' }}
      >
        {currentScreen === 'login'        && <LoginScreen />}
        {currentScreen === 'welcome'      && <WelcomeBackScreen />}
        {currentScreen === 'walkthrough'  && <WalkthroughScreen />}
        {currentScreen === 'ob1'          && <OB1Group />}
        {currentScreen === 'ob2'          && <OB2Mood />}
        {currentScreen === 'ob3'          && <OB3Pace />}
        {currentScreen === 'ob4'          && <OB4DayOpen />}
        {currentScreen === 'ob5'          && <OB5Dietary />}
        {currentScreen === 'ob6'          && <OB6Budget />}
        {currentScreen === 'ob7'          && <OB7Evening />}
        {currentScreen === 'ob8'          && <OB8KidFocus />}
        {currentScreen === 'ob9'          && <OB9BudgetProtect />}
        {currentScreen === 'persona'     && <PersonaScreen />}
        {currentScreen === 'destination' && <DestinationScreen />}
        {currentScreen === 'map'         && <MapScreen />}
        {currentScreen === 'journey'     && <JourneyScreen />}
        {currentScreen === 'route'          && <RouteScreen />}
        {currentScreen === 'itinerary-reel' && <ItineraryReelScreen />}
        {currentScreen === 'trips'       && <TripsScreen />}
        {currentScreen === 'saved'       && <SavedScreen />}
        {currentScreen === 'nav'         && <NavScreen />}
        {currentScreen === 'profile'     && <ProfileScreen />}
        {currentScreen === 'subscription' && <SubscriptionScreen />}
      </motion.div>
    </AnimatePresence>
    <InstallPrompt />
    <BottomNav />
  </div>
);
```

- [ ] **Step 4: Run tests — no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: same test count, all pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/App.tsx
git commit -m "feat(app): add 400ms crossfade transition between all screens"
```

---

## Task 2: Reorder OB Questions (Budget → Q2)

**Files:**
- Modify: `frontend/src/modules/onboarding/types.ts`

One array change. Moves budget (`ob6`) to position 2, and slides evening (`ob7`) to position 5, dietary (`ob5`) to position 6, and day_open (`ob4`) to position 7.

- [ ] **Step 1: Update BASE_OB_STEPS in types.ts**

Open `frontend/src/modules/onboarding/types.ts`. Find:

```typescript
export const BASE_OB_STEPS: ObStep[] = ['ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7'];
```

Replace with:

```typescript
export const BASE_OB_STEPS: ObStep[] = ['ob1', 'ob6', 'ob2', 'ob3', 'ob7', 'ob5', 'ob4'];
```

New order: group → budget → mood → pace → evening → dietary → day_open

- [ ] **Step 2: Run tests — no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass. The `useOnboarding` hook reads `BASE_OB_STEPS` dynamically so navigation, progress, and step counts update automatically.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/onboarding/types.ts
git commit -m "feat(ob): reorder questions — budget moves to Q2, evening to Q5"
```

---

## Task 3: OnboardingShell — Full-Bleed Background

**Files:**
- Modify: `frontend/src/modules/onboarding/OnboardingShell.tsx`

Full rewrite of the component. Key changes:
- Remove the solid `rgba(12,12,14,.82)` dark overlay
- Remove the `h-44` hero thumbnail
- Add full-screen hero image with crossfade on step change
- Add gradient overlay (transparent → solid dark at bottom)
- Float header with blur backdrop
- Anchor question content at the bottom over the gradient
- Add optional `heroUrl` prop for dynamic hero override (used by OB2 family flow)

- [ ] **Step 1: Replace OnboardingShell.tsx**

Overwrite `frontend/src/modules/onboarding/OnboardingShell.tsx` with:

```tsx
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ObStep } from './types';
import { BASE_OB_STEPS, STEP_TITLES } from './types';
import { useOnboarding } from './useOnboarding';
import { useAppStore } from '../../shared/store';
import { Button } from '../../shared/ui/Button';
import { OBBackground } from './OBBackground';
import { PersonaSilhouette } from './PersonaSilhouette';
import { getLayerUpdatesForAnswer, resolveLayerState } from './ob-layers';
import type { OBLayerUpdate } from './ob-layers';

const STEP_HERO: Partial<Record<ObStep, string>> = {
  ob1: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  ob2: 'https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800&q=80',
  ob3: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800&q=80',
  ob4: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
  ob5: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  ob6: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80',
  ob7: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  ob8: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80',
  ob9: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
};

interface Props {
  step:       ObStep;
  canAdvance: boolean;
  children:   ReactNode;
  title?:     string;
  subtitle?:  string;
  heroUrl?:   string;
}

export function OnboardingShell({ step, canAdvance, children, title, subtitle, heroUrl }: Props) {
  const { progress, currentIndex, totalSteps, goBack, goNext, finish, isLast } = useOnboarding(step);
  const { state } = useAppStore();

  const answers = state.rawOBAnswers ?? {};

  const layerState = useMemo(() => {
    const updates: OBLayerUpdate[] = [];
    for (const [question, answer] of Object.entries(answers)) {
      const ans = Array.isArray(answer) ? answer : [answer];
      for (const a of ans) {
        if (a != null) updates.push(...getLayerUpdatesForAnswer(question, String(a)));
      }
    }
    return resolveLayerState(updates);
  }, [answers]);

  const answeredCount = Object.keys(answers).length;
  const displayTitle    = title    ?? STEP_TITLES[step] ?? '';
  const displaySubtitle = subtitle ?? '';
  const bgHeroUrl = heroUrl ?? STEP_HERO[step];

  return (
    <div className="fixed inset-0" style={{ zIndex: 20 }}>

      {/* ── Background stack ── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Full-bleed hero — crossfades when bgHeroUrl changes */}
        <AnimatePresence mode="wait">
          {bgHeroUrl && (
            <motion.img
              key={bgHeroUrl}
              src={bgHeroUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>

        {/* Gradient: transparent top → solid dark bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(to bottom,',
              'rgba(12,12,14,0.05)  0%,',
              'rgba(12,12,14,0.15)  22%,',
              'rgba(12,12,14,0.75)  50%,',
              'rgba(12,12,14,0.97)  68%,',
              'rgba(12,12,14,1.0)   80%,',
              'rgba(12,12,14,1.0)  100%)',
            ].join(' '),
          }}
        />

        {/* OBBackground — answer-driven colour tinting */}
        <OBBackground layerState={layerState} />

        {/* PersonaSilhouette — builds opacity with each answer */}
        <PersonaSilhouette layerState={layerState} answeredCount={answeredCount} />
      </div>

      {/* ── Content stack ── */}
      <div className="absolute inset-0 flex flex-col" style={{ zIndex: 10 }}>

        {/* Floating header */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
            paddingBottom: '0.75rem',
          }}
        >
          <button
            onClick={goBack}
            aria-label="Go back"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '1px solid rgba(242,237,230,.12)',
              background: 'rgba(12,12,14,.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer',
            }}
          >
            <span className="ms text-[var(--color-text-1)] text-xl">arrow_back</span>
          </button>

          <div
            className="flex-1 text-center font-semibold"
            style={{
              background: 'rgba(12,12,14,.35)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              borderRadius: 20, padding: '4px 14px',
              fontSize: 13, color: '#f2ede6',
            }}
          >
            Travel Preferences
          </div>

          <div style={{ width: 36 }} />
        </div>

        {/* Progress bar */}
        <div
          className="flex-shrink-0 w-full h-[2px]"
          style={{ background: 'rgba(255,255,255,.07)' }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'var(--color-primary)' }}
          />
        </div>

        {/* Spacer — background photo breathes here */}
        <div className="flex-1 min-h-0" />

        {/* Question content — anchored at bottom on dark gradient */}
        <div
          className="flex-shrink-0 overflow-y-auto px-5"
          style={{ paddingBottom: '0.5rem', maxHeight: '62vh' }}
        >
          <span
            className="block font-semibold tracking-widest uppercase mb-2"
            style={{ fontSize: 10, color: 'rgba(212,168,83,.65)' }}
          >
            Step {String(currentIndex + 1).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
          </span>

          <h1
            className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-1)] leading-snug mb-1"
            style={{ fontSize: 22 }}
          >
            {displayTitle}
          </h1>

          {displaySubtitle && (
            <p className="text-[var(--color-text-2)] text-sm mb-4">{displaySubtitle}</p>
          )}

          {children}
        </div>

        {/* Footer — dots + CTA */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="flex gap-2">
            {BASE_OB_STEPS.map((s, i) => (
              <div
                key={s}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'w-4 h-2 bg-primary'
                    : i < currentIndex
                    ? 'w-2 h-2 bg-primary/40'
                    : 'w-2 h-2 bg-white/10'
                }`}
              />
            ))}
          </div>

          <Button
            variant="primary"
            disabled={!canAdvance}
            onClick={isLast ? finish : goNext}
            className="flex items-center gap-2"
          >
            {isLast ? (
              <><span>Finish</span><span className="ms">auto_fix</span></>
            ) : (
              <><span>Next</span><span className="ms">chevron_right</span></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tests — no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass. `OnboardingShell` has no direct unit tests — it is verified visually in Step 3.

- [ ] **Step 3: Smoke-test in browser**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run dev
```

Navigate to the OB flow (clear `ur_walkthrough_seen` and `ur_persona` from localStorage, then sign in). Verify:

- Full-screen background photo is visible on every OB step
- The photo fades in when a step loads (crossfade on step navigation)
- The photo is invisible at the top (transparent gradient) and fully dark at the bottom
- Header (back + "Travel Preferences") floats transparently over the photo
- Question title and `PhotoGrid2x2` are anchored at the bottom
- Progress bar tracks correctly
- Step counter shows the new order: Q1=group, Q2=budget, Q3=mood, Q4=pace, Q5=evening, Q6=dietary, Q7=day_open

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/onboarding/OnboardingShell.tsx
git commit -m "feat(ob): full-bleed background with gradient overlay and floating header"
```

---

## Task 4: Dynamic Q2 Mood Options for Family

**Files:**
- Modify: `frontend/src/modules/onboarding/OB2Mood.tsx`

When the user selects "Family" in Q1, Q2 silently shows different options (Outdoors / Educational / Eat & Explore / Slow & Easy) and crossfades to the family hero photo. The underlying answer values (`explore`, `culture`, `eat_drink`, `relax`) are reused so the resolver engine is unaffected. No badge. No visual indicator beyond the changed title (already handled by `resolveQ2Mood` in `ob-context-resolvers.ts`).

- [ ] **Step 1: Replace OB2Mood.tsx**

Overwrite `frontend/src/modules/onboarding/OB2Mood.tsx` with:

```tsx
import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import { resolveQ2Mood } from './ob-context-resolvers';
import type { RawOBAnswers } from '../../shared/types';

const DEFAULT_OPTIONS = [
  {
    value: 'explore',   label: 'Explore',      sublabel: 'Hidden streets, surprises',
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80',
  },
  {
    value: 'relax',     label: 'Unwind',        sublabel: 'Slow pace, cafés, parks',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  },
  {
    value: 'eat_drink', label: 'Eat & Drink',   sublabel: 'Markets, tables, tastings',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  },
  {
    value: 'culture',   label: 'Culture',       sublabel: 'Museums, history, art',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
  },
];

const FAMILY_OPTIONS = [
  {
    value: 'explore',   label: 'Outdoors',      sublabel: 'Parks, nature, hikes',
    imageUrl: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80',
  },
  {
    value: 'culture',   label: 'Educational',   sublabel: 'Museums, history, hands-on',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80',
  },
  {
    value: 'eat_drink', label: 'Eat & Explore',  sublabel: 'Kid-friendly food & markets',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  },
  {
    value: 'relax',     label: 'Slow & Easy',   sublabel: 'Relaxed pace, no rushing',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  },
];

const FAMILY_HERO = 'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=800&q=80';

function getMoodOptions(answers: Partial<RawOBAnswers>) {
  return answers.group === 'family' ? FAMILY_OPTIONS : DEFAULT_OPTIONS;
}

export function OB2Mood() {
  const { state, dispatch } = useAppStore();
  const answers = state.rawOBAnswers ?? {};
  const value = answers.mood?.[0] ?? null;
  const ctx = resolveQ2Mood(answers);
  const options = getMoodOptions(answers);
  const heroUrl = answers.group === 'family' ? FAMILY_HERO : undefined;

  return (
    <OnboardingShell
      step="ob2"
      canAdvance={value !== null}
      title={ctx.title}
      subtitle={ctx.subtitle}
      heroUrl={heroUrl}
    >
      <PhotoGrid2x2
        options={options}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'mood', value: [v] })}
      />
    </OnboardingShell>
  );
}
```

- [ ] **Step 2: Run tests — no regressions**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Smoke-test family flow**

In the running dev server, go through the OB flow and select "Family" in Q1. Verify:

- Q2 background crossfades to the family outdoor photo (not the default travel photo)
- Q2 title reads "What does the family want from this trip?" (from `resolveQ2Mood`)
- The four options show: Outdoors / Educational / Eat & Explore / Slow & Easy
- No badge or indicator — just the options silently adapted
- Selecting a non-family group type in Q1 shows the default options on Q2

Also verify the resolver still works: complete the full OB flow with "Family" → "Outdoors" selected, confirm the persona is generated without errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/onboarding/OB2Mood.tsx
git commit -m "feat(ob): dynamic Q2 mood options for family — outdoors/edu/eat/slow"
```

---

## Self-Review

**Spec coverage:**
- ✅ Full-bleed OnboardingShell: Task 3
- ✅ Question reorder (budget → Q2): Task 2
- ✅ Dynamic Q2 family options, no badge: Task 4
- ✅ App-wide 400ms crossfade: Task 1
- ✅ `BottomNav`/`InstallPrompt` outside `AnimatePresence`: Task 1 Step 3
- ✅ `heroUrl` prop added to `OnboardingShell` for OB2 family override: Task 3 Step 1

**Placeholder scan:** No TBDs. All code blocks are complete and directly usable.

**Type consistency:**
- `heroUrl?: string` added to `OnboardingShell` `Props` interface in Task 3 → used in Task 4 as `heroUrl={heroUrl}` ✅
- `getMoodOptions(answers: Partial<RawOBAnswers>)` defined and called in same file (Task 4) ✅
- `BASE_OB_STEPS` changed in `types.ts` (Task 2) — `useOnboarding` reads it via import, no type changes needed ✅
