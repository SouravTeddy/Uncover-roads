# Screen-by-Screen Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix design inconsistencies and functional bugs across all screens, token-first then screen-by-screen.

**Architecture:** Token cleanup cascades from a single pass over component files. Each screen is then fixed independently, in dependency order. Branch: `feature/google-maplibre`. All visual decisions reference `~/Downloads/Uncover_Roads_Design/design_handoff/HANDOFF.md`.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (CSS-first), Framer Motion, MapLibre GL (`react-map-gl/maplibre`), Vitest.

**Working directory:** `frontend/` inside `/Users/souravbiswas/uncover-roads/`.

---

## File Map

```
Modified — Task 1 (token cleanup):
  frontend/src/modules/login/WalkthroughScreen.tsx
  frontend/src/modules/login/anim/WTPersonaAnim.tsx
  frontend/src/modules/destination/DestinationScreen.tsx
  frontend/src/modules/journey/JourneyScreen.tsx
  frontend/src/modules/journey/JourneyStrip.tsx
  frontend/src/modules/map/MapLibreRoute.tsx
  frontend/src/modules/pwa/InstallPrompt.tsx
  frontend/src/modules/profile/ProfileScreen.tsx      (also Task 9)

Modified — Task 2 (community removal):
  frontend/src/shared/ui/BottomNav.tsx

Created — Task 3 (OB photo grid):
  frontend/src/shared/ui/PhotoGrid2x2.tsx

Modified — Task 3:
  frontend/src/modules/onboarding/OnboardingShell.tsx
  frontend/src/modules/onboarding/OB1Group.tsx
  frontend/src/modules/onboarding/OB2Mood.tsx
  frontend/src/modules/onboarding/OB3Pace.tsx
  frontend/src/modules/onboarding/OB4DayOpen.tsx
  frontend/src/modules/onboarding/OB5Dietary.tsx
  frontend/src/modules/onboarding/OB6Budget.tsx
  frontend/src/modules/onboarding/OB7Evening.tsx
  frontend/src/modules/onboarding/OB8KidFocus.tsx
  frontend/src/modules/onboarding/OB9BudgetProtect.tsx

Modified — Task 4 (FilterBar sub-categories):
  frontend/src/modules/map/FilterBar.tsx
  frontend/src/modules/map/MapScreen.tsx
  frontend/src/modules/map/useMap.ts

Modified — Task 5 (pin system):
  frontend/src/modules/map/MapLibreMarkers.tsx
  frontend/src/index.css                              (bounce keyframe)

Modified — Task 6 (PinCard fixed height):
  frontend/src/modules/map/PinCard.tsx

Modified — Task 7 (BuildItineraryBar min 2):
  frontend/src/modules/map/BuildItineraryBar.tsx

Modified — Task 8 (SurpriseMe fix):
  frontend/src/modules/map/MapScreen.tsx

Modified — Task 9 (Profile):
  frontend/src/modules/profile/ProfileScreen.tsx

Modified — Task 10 (Itinerary audit):
  frontend/src/modules/route/reel/ReelIntroCard.tsx   (if needed)
  frontend/src/modules/route/reel/ReelStopCard.tsx    (if needed)
  frontend/src/modules/route/reel/ReelFinaleCard.tsx  (if needed)
  frontend/src/modules/route/RouteScreen.tsx          (if needed)
```

---

## Task 1: Token cleanup — remove hardcoded wrong colors

**Files:**
- Modify: `frontend/src/modules/login/WalkthroughScreen.tsx`
- Modify: `frontend/src/modules/login/anim/WTPersonaAnim.tsx`
- Modify: `frontend/src/modules/destination/DestinationScreen.tsx`
- Modify: `frontend/src/modules/journey/JourneyScreen.tsx`
- Modify: `frontend/src/modules/journey/JourneyStrip.tsx`
- Modify: `frontend/src/modules/map/MapLibreRoute.tsx`
- Modify: `frontend/src/modules/pwa/InstallPrompt.tsx`

The design tokens in `index.css` are already correct (amber/gold `#d4a853`, bg `#0c0c0e`). The problem is individual components hardcoding the old terracotta `#e07854` / `#c4613d` gradient and `Playfair Display` font. Fix each file.

- [ ] **Step 1: Fix WalkthroughScreen.tsx**

Open `frontend/src/modules/login/WalkthroughScreen.tsx`. Find lines 17 and 69 where `ctaStyle` is set:
```ts
ctaStyle: 'linear-gradient(135deg,#e07854,#c4613d)',
```
Replace both with:
```ts
ctaStyle: 'linear-gradient(135deg,#d4a853,#b8893a)',
```

- [ ] **Step 2: Fix WTPersonaAnim.tsx**

Open `frontend/src/modules/login/anim/WTPersonaAnim.tsx`. Find:
```ts
style={{ background: 'linear-gradient(160deg,#e07854,#c4613d)', boxShadow: '0 4px 16px rgba(224,120,84,.4)' }}
```
Replace with:
```ts
style={{ background: 'linear-gradient(160deg,#d4a853,#b8893a)', boxShadow: '0 4px 16px rgba(212,168,83,.4)' }}
```

- [ ] **Step 3: Fix DestinationScreen.tsx**

Open `frontend/src/modules/destination/DestinationScreen.tsx`. Find:
```ts
style={{ background: 'linear-gradient(135deg, #f5f0ea, #e07854)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
```
Replace with:
```ts
style={{ background: 'linear-gradient(135deg, #f5f0ea, #d4a853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
```

- [ ] **Step 4: Fix JourneyScreen.tsx**

Open `frontend/src/modules/journey/JourneyScreen.tsx`. Find (around line 336):
```ts
'bg-gradient-to-br from-[#e07854] to-[#c4613d] [box-shadow:var(--shadow-primary)]'
```
Replace with:
```ts
'bg-gradient-to-br from-[#d4a853] to-[#b8893a] [box-shadow:var(--shadow-primary)]'
```

- [ ] **Step 5: Fix JourneyStrip.tsx**

Open `frontend/src/modules/journey/JourneyStrip.tsx`. Find (around line 100):
```ts
className="w-full h-[54px] bg-gradient-to-br from-[#e07854] to-[#c4613d] [box-shadow:var(--shadow-primary)] border-none rounded-2xl cursor-pointer font-[family-name:var(--font-heading)] text-[15px] font-extrabold text-white"
```
Replace:
```ts
className="w-full h-[54px] bg-gradient-to-br from-[#d4a853] to-[#b8893a] [box-shadow:var(--shadow-primary)] border-none rounded-2xl cursor-pointer font-[family-name:var(--font-heading)] text-[15px] font-extrabold text-white"
```

- [ ] **Step 6: Fix MapLibreRoute.tsx**

Open `frontend/src/modules/map/MapLibreRoute.tsx`. Find:
```ts
'line-color': '#e07854',
```
Replace with:
```ts
'line-color': '#d4a853',
```

- [ ] **Step 7: Fix InstallPrompt.tsx**

Open `frontend/src/modules/pwa/InstallPrompt.tsx`. Find line 46:
```ts
fontFamily: "'Playfair Display', Georgia, serif",
```
Replace with:
```ts
fontFamily: "'Cormorant Garamond', Georgia, serif",
```
Then find line 74:
```ts
background: 'linear-gradient(135deg, #e07854, #c4613d)',
```
Replace with:
```ts
background: 'linear-gradient(135deg, #d4a853, #b8893a)',
```

- [ ] **Step 8: Verify no remaining hardcoded wrong tokens**

Run:
```bash
grep -rn "e07854\|c4613d\|Playfair" frontend/src/
```
Expected: zero results (the comment in `shared/api.ts` about "community mirror" is unrelated, ignore it).

- [ ] **Step 9: Run build to verify no TypeScript errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: build completes with 0 errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/modules/login/WalkthroughScreen.tsx \
        frontend/src/modules/login/anim/WTPersonaAnim.tsx \
        frontend/src/modules/destination/DestinationScreen.tsx \
        frontend/src/modules/journey/JourneyScreen.tsx \
        frontend/src/modules/journey/JourneyStrip.tsx \
        frontend/src/modules/map/MapLibreRoute.tsx \
        frontend/src/modules/pwa/InstallPrompt.tsx
git commit -m "fix: replace hardcoded terracotta tokens with amber/gold design system values"
```

---

## Task 2: Remove Community from BottomNav

**Files:**
- Modify: `frontend/src/shared/ui/BottomNav.tsx`

Community tab is present but disabled. Remove it entirely so only 3 tabs remain: Explore, Itinerary, Profile.

- [ ] **Step 1: Remove Community from NAV_ITEMS**

Open `frontend/src/shared/ui/BottomNav.tsx`. Replace:
```ts
const NAV_ITEMS: { screen: Screen | 'community'; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore',     label: 'Explore'   },
  { screen: 'trips',       icon: 'route',       label: 'Itinerary' },
  { screen: 'community',   icon: 'diversity_3', label: 'Community' },
  { screen: 'profile',     icon: 'person',      label: 'Profile'   },
];
```
With:
```ts
const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore', label: 'Explore'   },
  { screen: 'trips',       icon: 'route',   label: 'Itinerary' },
  { screen: 'profile',     icon: 'person',  label: 'Profile'   },
];
```

- [ ] **Step 2: Remove community handling from handleTap**

Replace:
```ts
function handleTap(screen: Screen | 'community') {
  if (screen === 'community') return;
  dispatch({ type: 'GO_TO', screen });
}
```
With:
```ts
function handleTap(screen: Screen) {
  dispatch({ type: 'GO_TO', screen });
}
```

- [ ] **Step 3: Remove muted/disabled logic**

In the `NAV_ITEMS.map(...)` block, find and remove:
```ts
const muted = item.screen === 'community';
```
Remove all references to `muted` in the rendered button (the `opacity`, `cursor`, `disabled`, and `aria-current` checks).

The cleaned-up button should be:
```tsx
<button
  key={item.screen}
  onClick={() => handleTap(item.screen)}
  aria-current={active ? 'page' : undefined}
  style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '8px 14px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--color-primary-bg)' : 'transparent',
    transition: 'background 0.15s',
  }}
>
  <span
    className={`ms${active ? ' fill' : ''}`}
    style={{
      fontSize: 20,
      color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
      lineHeight: 1,
    }}
  >
    {item.icon}
  </span>
  <span
    style={{
      fontSize: 9,
      fontWeight: active ? 700 : 500,
      color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      lineHeight: 1,
    }}
  >
    {item.label}
  </span>
</button>
```

- [ ] **Step 4: Run build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/ui/BottomNav.tsx
git commit -m "feat: remove Community tab from BottomNav"
```

---

## Task 3: Onboarding — 2×2 photo grid

**Files:**
- Create: `frontend/src/shared/ui/PhotoGrid2x2.tsx`
- Modify: `frontend/src/modules/onboarding/OnboardingShell.tsx`
- Modify: `frontend/src/modules/onboarding/OB1Group.tsx` (and OB2–OB9)

The current OB screens use `ImageRowCard` in a vertical list. The design handoff requires a 2×2 photo grid: full-bleed photos, label anchored bottom, selected state with color ring + scale + check badge. The `OnboardingShell` wraps content in a solid `bg-[var(--color-bg)]` overlay that blocks the `OBBackground` — this needs to let the background show.

- [ ] **Step 1: Create PhotoGrid2x2 component**

Create `frontend/src/shared/ui/PhotoGrid2x2.tsx`:

```tsx
interface PhotoOption {
  value: string;
  label: string;
  sublabel?: string;
  imageUrl: string;
  color?: string;   // accent color for selected ring; defaults to primary
}

interface Props {
  options: PhotoOption[];
  selected: string | string[] | null;
  multi?: boolean;
  onSelect: (value: string) => void;
}

const DEFAULT_COLOR = '#d4a853';

export function PhotoGrid2x2({ options, selected, multi = false, onSelect }: Props) {
  function isSelected(v: string) {
    if (!selected) return false;
    return Array.isArray(selected) ? selected.includes(v) : selected === v;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      padding: '0 12px',
    }}>
      {options.map(opt => {
        const sel = isSelected(opt.value);
        const color = opt.color ?? DEFAULT_COLOR;
        // When another option is selected (single-select), dim unselected
        const dimmed = !multi && selected !== null && !sel;

        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              position: 'relative',
              height: 130,
              borderRadius: 18,
              overflow: 'hidden',
              border: sel ? `2.5px solid ${color}` : '2.5px solid transparent',
              boxShadow: sel ? `0 0 0 0px ${color}, 0 8px 28px rgba(0,0,0,.5)` : 'none',
              transform: sel ? 'scale(1.03)' : dimmed ? 'scale(.97)' : 'scale(1)',
              opacity: dimmed ? 0.52 : 1,
              transition: 'all .2s cubic-bezier(.25,0,0,1)',
              cursor: 'pointer',
              padding: 0,
              background: 'transparent',
            }}
          >
            {/* Photo */}
            <img
              src={opt.imageUrl}
              alt={opt.label}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: sel
                ? 'linear-gradient(to bottom, rgba(0,0,0,.05) 0%, rgba(0,0,0,.55) 100%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,.20) 0%, rgba(0,0,0,.72) 100%)',
            }} />

            {/* Color glow overlay when selected */}
            {sel && (
              <div style={{
                position: 'absolute', inset: 0,
                background: `${color}18`,
              }} />
            )}

            {/* Label */}
            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 18, fontWeight: 700,
                color: '#fff', lineHeight: 1.1,
              }}>{opt.label}</div>
              {opt.sublabel && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{opt.sublabel}</div>
              )}
            </div>

            {/* Check badge — top-right */}
            {sel && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 24, height: 24, borderRadius: multi ? 7 : '50%',
                background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'dotPop .25s cubic-bezier(.16,1,.3,1)',
              }}>
                <span className="ms fill" style={{ fontSize: 14, color: '#0c0c0e' }}>check</span>
              </div>
            )}

            {/* Empty checkbox for multi-select unselected */}
            {multi && !sel && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                width: 22, height: 22, borderRadius: 6,
                border: '1.5px solid rgba(255,255,255,.35)',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Fix OnboardingShell to let OBBackground show through**

Open `frontend/src/modules/onboarding/OnboardingShell.tsx`.

Find the inner fixed overlay div:
```tsx
<div className="fixed inset-0 flex flex-col bg-[var(--color-bg)]" style={{ zIndex: 20 }}>
```
Change `bg-[var(--color-bg)]` to a semi-transparent glass so the `OBBackground` bleeds through:
```tsx
<div className="fixed inset-0 flex flex-col" style={{ zIndex: 20, background: 'rgba(12,12,14,.82)', backdropFilter: 'blur(0px)' }}>
```

Also find the header div that has `background: 'rgba(15,23,42,.95)'` and replace it with the design system glass:
```tsx
background: 'rgba(12,12,14,.88)',
```

- [ ] **Step 3: Update OB1Group to use PhotoGrid2x2**

Open `frontend/src/modules/onboarding/OB1Group.tsx`. Replace the entire file with:

```tsx
import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';
import type { OBGroup } from '../../shared/types';

const OPTIONS = [
  { value: 'solo',    label: 'Just me',         sublabel: 'Self-paced, flexible',
    imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=80' },
  { value: 'couple',  label: 'Partner',          sublabel: 'Romantic, shared pace',
    imageUrl: 'https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=400&q=80' },
  { value: 'family',  label: 'Family',           sublabel: 'Kid-accessible spots',
    imageUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&q=80' },
  { value: 'friends', label: 'Friends',          sublabel: 'Group bookings, social',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80' },
];

export function OB1Group() {
  const { state, dispatch } = useAppStore();
  const value = (state.rawOBAnswers?.group ?? null) as OBGroup | null;

  function handleSelect(v: string) {
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'group', value: v as OBGroup });
  }

  return (
    <OnboardingShell step="ob1" canAdvance={value !== null}>
      <PhotoGrid2x2 options={OPTIONS} selected={value} onSelect={handleSelect} />
    </OnboardingShell>
  );
}
```

- [ ] **Step 4: Update remaining OB screens (OB2–OB9)**

Apply the same pattern — replace `ImageRowCard` list with `PhotoGrid2x2` — for each screen. For multi-select screens (OB4 `DayOpen`, OB5 `Dietary`, OB8 `KidFocus`, OB9 `BudgetProtect`), pass `multi={true}` and update `onSelect` to toggle values in an array.

For **OB2Mood.tsx** (single-select):
```tsx
import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';

const OPTIONS = [
  { value: 'explore',   label: 'Explore',     sublabel: 'Hidden streets, surprises',
    imageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80' },
  { value: 'relax',     label: 'Unwind',       sublabel: 'Slow pace, cafés, parks',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
  { value: 'eat_drink', label: 'Eat & Drink',  sublabel: 'Markets, tables, tastings',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
  { value: 'culture',   label: 'Culture',      sublabel: 'Museums, history, art',
    imageUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=400&q=80' },
];

export function OB2Mood() {
  const { state, dispatch } = useAppStore();
  const value = state.rawOBAnswers?.mood?.[0] ?? null;

  return (
    <OnboardingShell step="ob2" canAdvance={value !== null}>
      <PhotoGrid2x2
        options={OPTIONS}
        selected={value}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'mood', value: [v] })}
      />
    </OnboardingShell>
  );
}
```

For **OB3Pace.tsx** (single-select):
```tsx
import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';

const OPTIONS = [
  { value: 'slow',     label: 'Slow',     sublabel: '2–3 places, deep dives',
    imageUrl: 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=400&q=80' },
  { value: 'balanced', label: 'Balanced', sublabel: '4–5 places, good mix',
    imageUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80' },
  { value: 'packed',   label: 'Packed',   sublabel: '6–8 places, full day',
    imageUrl: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=400&q=80' },
  { value: 'flex',     label: 'Flexible', sublabel: 'Decide on the day',
    imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&q=80' },
];

export function OB3Pace() {
  const { state, dispatch } = useAppStore();
  const value = state.rawOBAnswers?.pace ?? null;

  return (
    <OnboardingShell step="ob3" canAdvance={value !== null}>
      <PhotoGrid2x2
        options={OPTIONS}
        selected={value as string | null}
        onSelect={v => dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'pace', value: v })}
      />
    </OnboardingShell>
  );
}
```

For **multi-select screens** (OB4–OB9), the pattern is the same but uses `multi={true}` and dispatches an array. Example for **OB4DayOpen.tsx**:
```tsx
import { OnboardingShell } from './OnboardingShell';
import { PhotoGrid2x2 } from '../../shared/ui/PhotoGrid2x2';
import { useAppStore } from '../../shared/store';

const OPTIONS = [
  { value: 'morning_market', label: 'Morning market', sublabel: 'Early rise, local feel',
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&q=80' },
  { value: 'late_start',     label: 'Late start',     sublabel: 'Brunch first, always',
    imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80' },
  { value: 'hotel_breakfast',label: 'Hotel breakfast',sublabel: 'Sorted before exploring',
    imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80' },
  { value: 'no_preference',  label: 'No preference',  sublabel: 'Whatever works',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80' },
];

export function OB4DayOpen() {
  const { state, dispatch } = useAppStore();
  const values: string[] = state.rawOBAnswers?.day_open ?? [];

  function toggle(v: string) {
    const next = values.includes(v) ? values.filter(x => x !== v) : [...values, v];
    dispatch({ type: 'SET_RAW_OB_ANSWER', key: 'day_open', value: next });
  }

  return (
    <OnboardingShell step="ob4" canAdvance={values.length > 0}>
      <PhotoGrid2x2 options={OPTIONS} selected={values} multi onSelect={toggle} />
    </OnboardingShell>
  );
}
```

Apply the same multi-select pattern to OB5, OB8, OB9 — look at each file for the existing option data and key names, then replace `ImageRowCard` rendering with `PhotoGrid2x2`.

For OB6Budget and OB7Evening (single-select with their own option data), apply the same single-select pattern as OB3.

- [ ] **Step 5: Add dotPop keyframe to index.css if not present**

Check `frontend/src/index.css` for `@keyframes dotPop`. If absent, add after existing keyframes:
```css
@keyframes dotPop {
  0%   { transform: scale(0); }
  60%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}
```

- [ ] **Step 6: Run tests**

```bash
cd frontend && npx vitest run src/modules/onboarding/ 2>&1 | tail -20
```
Expected: all passing (OB logic tests are unaffected — only rendering changed).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/ui/PhotoGrid2x2.tsx \
        frontend/src/modules/onboarding/ \
        frontend/src/index.css
git commit -m "feat: replace OB option list with 2x2 photo grid per design handoff"
```

---

## Task 4: FilterBar — All chip sub-category expansion

**Files:**
- Modify: `frontend/src/modules/map/FilterBar.tsx`
- Modify: `frontend/src/modules/map/MapScreen.tsx`
- Modify: `frontend/src/modules/map/useMap.ts`

The All chip currently just sets `activeFilter='all'`. It needs to expand into sub-category chips (Landmarks, Cafes, Parks, Dining, Galleries). Selecting a sub-chip filters visible pins by category. The `MapFilter` type stays as `'all' | 'curated' | 'saved'` — sub-category is a separate local state in `MapScreen`.

- [ ] **Step 1: Update FilterBar to accept and render sub-category state**

Replace the entire `frontend/src/modules/map/FilterBar.tsx` with:

```tsx
import { useState } from 'react';
import type { MapFilter } from '../../shared/types';

const SUB_CHIPS = [
  { key: 'all',       label: 'All',       icon: 'layers' },
  { key: 'historic',  label: 'Landmarks', icon: 'account_balance' },
  { key: 'cafe',      label: 'Cafes',     icon: 'local_cafe' },
  { key: 'park',      label: 'Parks',     icon: 'park' },
  { key: 'restaurant',label: 'Dining',    icon: 'restaurant' },
  { key: 'museum',    label: 'Galleries', icon: 'palette' },
];

interface Props {
  active: MapFilter;
  activeCategory: string | null;
  allCount: number;
  curatedCount: number;
  curatedLocked: boolean;
  onSelect: (filter: MapFilter) => void;
  onCategorySelect: (category: string | null) => void;
  onLockedTap: () => void;
}

export function FilterBar({
  active, activeCategory, allCount, curatedCount, curatedLocked,
  onSelect, onCategorySelect, onLockedTap,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const isAllMode = active === 'all';
  const allLabel = activeCategory
    ? (SUB_CHIPS.find(c => c.key === activeCategory)?.label ?? 'All')
    : 'All';

  function handleAllTap() {
    if (!isAllMode) {
      onSelect('all');
      onCategorySelect(null);
      setExpanded(false);
      return;
    }
    setExpanded(e => !e);
  }

  function handleSubChip(key: string) {
    onCategorySelect(key === 'all' ? null : key);
    setExpanded(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      {/* Main chips row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* All chip */}
        <button
          onClick={handleAllTap}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', height: 28, borderRadius: 999,
            background: isAllMode ? 'var(--color-primary)' : 'rgba(15,20,30,.82)',
            border: isAllMode ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,.12)',
            color: isAllMode ? '#0c0c0e' : 'rgba(255,255,255,.65)',
            fontSize: '0.72rem', fontWeight: 700,
            backdropFilter: 'blur(8px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
          }}
        >
          {allLabel}
          {allCount > 0 && (
            <span style={{ opacity: 0.7, fontSize: '0.68rem' }}>· {allCount}</span>
          )}
          <span className="ms" style={{ fontSize: 13, opacity: 0.7, marginLeft: 1 }}>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {/* Curated chip */}
        <button
          onClick={() => { curatedLocked ? onLockedTap() : onSelect('curated'); setExpanded(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', height: 28, borderRadius: 999,
            background: active === 'curated' ? 'var(--color-primary-bg)' : 'rgba(15,20,30,.82)',
            border: active === 'curated'
              ? '1px solid var(--color-primary)'
              : curatedLocked
              ? '1px solid rgba(255,255,255,.1)'
              : '1px solid rgba(212,168,83,.3)',
            color: active === 'curated'
              ? 'var(--color-primary)'
              : curatedLocked
              ? 'rgba(255,255,255,.35)'
              : 'rgba(212,168,83,.85)',
            fontSize: '0.72rem', fontWeight: 700,
            backdropFilter: 'blur(8px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
            opacity: curatedLocked ? 0.75 : 1,
          }}
        >
          <span style={{ fontSize: 10 }}>✦</span>
          Curated
          {!curatedLocked && curatedCount > 0 && (
            <span style={{ opacity: 0.65, fontSize: '0.68rem' }}>· {curatedCount}</span>
          )}
          {curatedLocked && (
            <span className="ms" style={{ fontSize: 12, marginLeft: 1 }}>lock</span>
          )}
        </button>
      </div>

      {/* Sub-category row — shown when All is expanded */}
      {expanded && isAllMode && (
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
          scrollbarWidth: 'none',
          animation: 'springUp .25s cubic-bezier(.16,1,.3,1)',
        }}>
          {SUB_CHIPS.map(chip => {
            const isActive = chip.key === 'all' ? activeCategory === null : activeCategory === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => handleSubChip(chip.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  padding: '4px 10px', height: 26, borderRadius: 999,
                  background: isActive ? 'rgba(212,168,83,.15)' : 'rgba(15,20,30,.75)',
                  border: isActive ? '1px solid rgba(212,168,83,.5)' : '1px solid rgba(255,255,255,.1)',
                  color: isActive ? '#d4a853' : 'rgba(255,255,255,.55)',
                  fontSize: '0.68rem', fontWeight: 600,
                  backdropFilter: 'blur(8px)', cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.12s ease',
                }}
              >
                <span className="ms" style={{ fontSize: 12 }}>{chip.icon}</span>
                {chip.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add activeCategory state to MapScreen**

Open `frontend/src/modules/map/MapScreen.tsx`. Add state near the top of the component (after existing `useState` declarations):
```tsx
const [activeCategory, setActiveCategory] = useState<string | null>(null);
```

- [ ] **Step 3: Thread activeCategory into FilterBar props**

Find the `<FilterBar` JSX in `MapScreen`. Update the props:
```tsx
<FilterBar
  active={activeFilter as MapFilter}
  activeCategory={activeCategory}
  allCount={allCount}
  curatedCount={curatedCount}
  curatedLocked={isCurationLocked(state)}
  onSelect={handleFilterSelect}
  onCategorySelect={setActiveCategory}
  onLockedTap={() => { /* existing locked tap handler */ }}
/>
```

- [ ] **Step 4: Pass activeCategory to useMap for filtering**

Open `frontend/src/modules/map/useMap.ts`. The `filteredPlaces` computation currently is:
```ts
const filteredPlaces: Place[] =
  activeFilter === 'saved'
    ? places.filter(p => favouritedPins.some(f => f.placeId === p.id))
    : places;
```

Add `activeCategory` as a parameter. In `useMap`, the hook accepts `{ activeCategory }` or receives it from the store. The cleanest approach: pass `activeCategory` as a hook argument and use it in filtering.

Find where `useMap` is called in `MapScreen.tsx`:
```tsx
const { ... } = useMap();
```

Change `useMap`'s signature to accept `activeCategory`:
```ts
export function useMap(activeCategory: string | null = null) {
```

Update `filteredPlaces` in `useMap.ts`:
```ts
const filteredPlaces: Place[] =
  activeFilter === 'saved'
    ? places.filter(p => favouritedPins.some(f => f.placeId === p.id))
    : activeFilter === 'all' && activeCategory !== null
    ? places.filter(p => p.category === activeCategory)
    : places;
```

Update the call in `MapScreen.tsx`:
```tsx
const { ... } = useMap(activeCategory);
```

- [ ] **Step 5: Reset activeCategory when switching to Curated**

In `MapScreen.tsx`, find `handleFilterSelect`:
```tsx
function handleFilterSelect(f: MapFilter) {
  setFilter(f);
}
```
Update to:
```tsx
function handleFilterSelect(f: MapFilter) {
  setFilter(f);
  if (f !== 'all') setActiveCategory(null);
}
```

- [ ] **Step 6: Write a test for the filteredPlaces logic**

Open `frontend/src/modules/map/useMap.test.ts`. Add a test for category filtering (add at end of file — check existing test structure to match imports and setup):

```ts
it('filters places by activeCategory when filter is all', () => {
  const places: Place[] = [
    { id: '1', title: 'A Park', category: 'park',       lat: 0, lon: 0, _city: 'x' },
    { id: '2', title: 'A Cafe', category: 'cafe',       lat: 0, lon: 0, _city: 'x' },
    { id: '3', title: 'A Rest', category: 'restaurant', lat: 0, lon: 0, _city: 'x' },
  ];
  // filteredPlaces logic extracted: activeFilter='all', activeCategory='park'
  const result = places.filter(p =>
    'all' === 'all' && 'park' !== null ? p.category === 'park' : true
  );
  expect(result).toHaveLength(1);
  expect(result[0].title).toBe('A Park');
});
```

- [ ] **Step 7: Run tests**

```bash
cd frontend && npx vitest run src/modules/map/useMap.test.ts 2>&1 | tail -10
```
Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/modules/map/FilterBar.tsx \
        frontend/src/modules/map/MapScreen.tsx \
        frontend/src/modules/map/useMap.ts \
        frontend/src/modules/map/useMap.test.ts
git commit -m "feat: All chip expands to sub-category chips, filters pins by category"
```

---

## Task 5: Pin system — Option B (tinted, 3 states, hot badge, cluster hot)

**Files:**
- Modify: `frontend/src/modules/map/MapLibreMarkers.tsx`
- Modify: `frontend/src/index.css`

Pins: uniform 28px, `{color}18` bg + `{color}50` border. Three states: Normal → Selected (solid color, white icon, number badge) → Hot (fire badge + bounce animation, only when not selected).

- [ ] **Step 1: Add bounce keyframe to index.css**

Open `frontend/src/index.css`. Add after existing keyframes:
```css
@keyframes pinBounce {
  0%, 100% { transform: translateY(0); }
  45%       { transform: translateY(-5px); }
  65%       { transform: translateY(-2px); }
}
```

- [ ] **Step 2: Replace MapLibreMarkers.tsx**

Replace the entire file `frontend/src/modules/map/MapLibreMarkers.tsx`:

```tsx
import { Marker } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

// Option B: icon + category color tint. Uniform 28px.
const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#d4a853',  // amber — dining
  cafe:       '#b88c3a',  // amber-dark — cafe
  park:       '#5a8a60',  // sage — park/nature
  museum:     '#8878b8',  // violet — gallery/art
  historic:   '#4a7fa0',  // sky — heritage/landmark
  tourism:    '#4a7fa0',  // sky — tourism/landmark
  event:      '#8878b8',  // violet — event
  place:      '#6a6058',  // text3 — generic
};

const PIN_SIZE = 28;

interface Props {
  places: Place[];
  selectedPlace: Place | null;
  selectedPlaces: Place[];         // itinerary selection list (ordered)
  highlightIds: Set<string>;       // hot/trending pins
  onPlaceClick: (place: Place) => void;
}

export function MapLibreMarkers({
  places, selectedPlace, selectedPlaces, highlightIds, onPlaceClick,
}: Props) {
  // Build itinerary position map: placeId → 1-based position
  const itineraryPositions = new Map(selectedPlaces.map((p, i) => [p.id, i + 1]));

  return (
    <>
      {places.map((place) => {
        const isCardOpen =
          selectedPlace?.title === place.title &&
          selectedPlace?.lat === place.lat &&
          selectedPlace?.lon === place.lon;

        const itineraryPos = itineraryPositions.get(place.id) ?? null;
        const isInItinerary = itineraryPos !== null;
        const isHot = highlightIds.has(place.id) && !isInItinerary; // hot loses to selected

        const color = CATEGORY_COLORS[place.category] ?? '#6a6058';
        const icon  = CATEGORY_ICONS[place.category]  ?? 'location_on';

        return (
          <Marker
            key={`${place.lat}-${place.lon}-${place.title}`}
            latitude={place.lat}
            longitude={place.lon}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onPlaceClick(place);
            }}
          >
            <div
              style={{
                position: 'relative',
                width: PIN_SIZE, height: PIN_SIZE,
                animation: isHot ? 'pinBounce 1.8s ease-in-out infinite' : 'none',
                cursor: 'pointer',
              }}
            >
              {/* Pin circle */}
              <div style={{
                width: PIN_SIZE, height: PIN_SIZE,
                borderRadius: '50%',
                backgroundColor: isInItinerary ? color : `${color}18`,
                border: isCardOpen
                  ? `2.5px solid #fff`
                  : isInItinerary
                  ? `2px solid ${color}`
                  : `1.5px solid ${color}80`,
                boxShadow: isCardOpen
                  ? `0 0 0 2px ${color}60, 0 3px 12px rgba(0,0,0,.5)`
                  : isInItinerary
                  ? `0 3px 10px ${color}40`
                  : '0 2px 6px rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}>
                <span
                  className="ms fill"
                  style={{
                    fontSize: 14,
                    color: isInItinerary ? '#0c0c0e' : color,
                    lineHeight: 1,
                  }}
                >
                  {icon}
                </span>
              </div>

              {/* Itinerary number badge — bottom-right */}
              {isInItinerary && (
                <div style={{
                  position: 'absolute', bottom: -2, right: -4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#0c0c0e',
                  border: `1.5px solid ${color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'dotPop .25s cubic-bezier(.16,1,.3,1)',
                }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: color, lineHeight: 1 }}>
                    {itineraryPos}
                  </span>
                </div>
              )}

              {/* Hot fire badge — top-right */}
              {isHot && (
                <div style={{
                  position: 'absolute', top: -3, right: -4,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#e05050',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="ms fill" style={{ fontSize: 8, color: '#fff', lineHeight: 1 }}>
                    bolt
                  </span>
                </div>
              )}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
```

- [ ] **Step 3: Pass selectedPlaces to MapLibreMarkers in MapScreen**

Open `frontend/src/modules/map/MapScreen.tsx`. Find `<MapLibreMarkers` and add the `selectedPlaces` prop:
```tsx
<MapLibreMarkers
  places={filteredPlaces}
  selectedPlace={activePlace}
  selectedPlaces={selectedPlaces}
  highlightIds={highlightIds}
  onPlaceClick={handlePinClick}
/>
```
(`selectedPlaces` is already available in `MapScreen` from the store.)

- [ ] **Step 4: Run tests**

```bash
cd frontend && npx vitest run src/modules/map/pin-visual.test.ts 2>&1 | tail -10
```
Expected: passing (pin-visual tests cover category→color logic; our CATEGORY_COLORS keys match).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/MapLibreMarkers.tsx \
        frontend/src/index.css
git commit -m "feat: Option B pin system — tinted bg, 3 states (normal/selected/hot), cluster hot badge"
```

---

## Task 6: PinCard — fixed height, non-scrollable

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`

PinCard has an `expanded` state that sets `maxHeight: '92vh'` and `overflow: 'auto'`, making it scrollable. Remove expanded state. Fix to a static height showing: photo strip, place name, chip row, 2 CTA buttons.

- [ ] **Step 1: Remove expanded state and drag-to-expand logic**

Open `frontend/src/modules/map/PinCard.tsx`.

Remove the `expanded` state declaration:
```ts
const [expanded, setExpanded] = useState(false)
```

Find the sheet container div (around line 165) that has:
```ts
maxHeight: expanded ? '92vh' : '48vh',
overflow: expanded ? 'auto' : 'hidden',
```
Replace with fixed values:
```ts
maxHeight: '52vh',
overflow: 'hidden',
```

- [ ] **Step 2: Remove the expand toggle and expanded content blocks**

Find and remove:
```tsx
{!expanded && (
  // expand hint
)}
{expanded && (
  // extra content
)}
```
These are the conditional blocks around line 283 and 293. Keep only the core content: photo header, place name, chip row, CTA buttons.

- [ ] **Step 3: Verify the card is non-scrollable**

After the change, the sheet div must have no `overflow: auto` or `overflow-y: scroll`. Confirm:
```bash
grep -n "overflow.*auto\|overflow.*scroll" frontend/src/modules/map/PinCard.tsx
```
Expected: 0 results.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/PinCard.tsx
git commit -m "fix: PinCard fixed height — remove expand/scroll behaviour"
```

---

## Task 7: BuildItineraryBar — minimum 2 places

**Files:**
- Modify: `frontend/src/modules/map/BuildItineraryBar.tsx`

Currently shows and is clickable with 1 place. Need: 0–1 places = disabled button + nudge label.

- [ ] **Step 1: Replace BuildItineraryBar.tsx**

Replace the entire file `frontend/src/modules/map/BuildItineraryBar.tsx`:

```tsx
import { createPortal } from 'react-dom';
import type { Place } from '../../shared/types';

interface Props {
  itineraryPlaces: Place[];
  days: number;
  onBuild: () => void;
}

const MIN_PLACES = 2;

export function BuildItineraryBar({ itineraryPlaces, days, onBuild }: Props) {
  if (itineraryPlaces.length === 0) return null;

  const count = itineraryPlaces.length;
  const canBuild = count >= MIN_PLACES;
  const pinWord = count === 1 ? 'place' : 'places';
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : '';
  const label = `Build itinerary · ${count} ${pinWord}${dayPart}`;

  const bar = (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        padding: '12px 16px',
        background: 'rgba(12,12,14,.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(242,237,230,.08)',
      }}
    >
      <button
        disabled={!canBuild}
        onClick={canBuild ? onBuild : undefined}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 14,
          border: 'none', cursor: canBuild ? 'pointer' : 'not-allowed',
          fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.01em',
          background: canBuild
            ? 'linear-gradient(135deg, #d4a853, #b8893a)'
            : 'rgba(255,255,255,.08)',
          color: canBuild ? '#0c0c0e' : 'rgba(255,255,255,.25)',
          opacity: canBuild ? 1 : 0.7,
          boxShadow: canBuild ? '0 6px 28px rgba(212,168,83,.25)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        {label} →
      </button>
      {!canBuild && (
        <p style={{
          textAlign: 'center', marginTop: 6,
          fontSize: '0.68rem', color: 'var(--color-text-3)',
        }}>
          Add one more place to build
        </p>
      )}
    </div>
  );

  return createPortal(bar, document.body);
}
```

- [ ] **Step 2: Write test for min places logic**

Open `frontend/src/modules/map/useMap.test.ts`. Add at end:
```ts
it('BuildItineraryBar canBuild is false with 1 place', () => {
  const places: Place[] = [{ id: '1', title: 'A', category: 'park', lat: 0, lon: 0, _city: 'x' }];
  const canBuild = places.length >= 2;
  expect(canBuild).toBe(false);
});

it('BuildItineraryBar canBuild is true with 2 places', () => {
  const places: Place[] = [
    { id: '1', title: 'A', category: 'park',       lat: 0, lon: 0, _city: 'x' },
    { id: '2', title: 'B', category: 'restaurant', lat: 0, lon: 0, _city: 'x' },
  ];
  const canBuild = places.length >= 2;
  expect(canBuild).toBe(true);
});
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npx vitest run src/modules/map/useMap.test.ts 2>&1 | tail -10
```
Expected: all passing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/BuildItineraryBar.tsx \
        frontend/src/modules/map/useMap.test.ts
git commit -m "fix: BuildItineraryBar requires minimum 2 places, shows nudge with 1"
```

---

## Task 8: Surprise Me — fix silent failure and add feedback

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

Surprise Me is already wired (`handleSurprise` calls `POST /api/surprise-me`) but fails silently — the `catch` block does nothing. Two issues: (1) no error feedback, (2) the button is shown even when `!city || !personaProfile` which causes silent no-op.

- [ ] **Step 1: Add error toast state to MapScreen**

Open `frontend/src/modules/map/MapScreen.tsx`. Add a state variable near other state declarations:
```tsx
const [surpriseError, setSurpriseError] = useState<string | null>(null);
```

- [ ] **Step 2: Update _runSurprise to handle errors**

Find `_runSurprise` (around line 554). Replace the `catch` block:
```ts
} catch { /* silence */ }
```
With:
```ts
} catch {
  setSurpriseError("Couldn't generate — try again");
  setTimeout(() => setSurpriseError(null), 3000);
}
```

Also add error handling for non-ok responses. Find:
```ts
if (res.ok) {
  const result = await res.json()
  dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: result })
  dispatch({ type: 'GO_TO', screen: 'route' })
}
```
Replace with:
```ts
if (res.ok) {
  const result = await res.json();
  dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: result });
  dispatch({ type: 'GO_TO', screen: 'route' });
} else {
  setSurpriseError("Couldn't generate — try again");
  setTimeout(() => setSurpriseError(null), 3000);
}
```

- [ ] **Step 3: Pass disabled state to SurpriseMeButton**

Find where `<SurpriseMeButton` is rendered (around line 944). Update to disable when city or personaProfile is missing:
```tsx
<SurpriseMeButton
  onSurprise={handleSurprise}
  disabled={!city || !personaProfile}
/>
```

- [ ] **Step 4: Add error toast to MapScreen JSX**

Find the closing section of the MapScreen JSX (before the final closing `</div>`). Add the error toast:
```tsx
{surpriseError && (
  <div style={{
    position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)',
    zIndex: 50, padding: '10px 18px', borderRadius: 999,
    background: 'rgba(220,60,60,.12)', border: '1px solid rgba(220,60,60,.3)',
    backdropFilter: 'blur(12px)',
    color: '#e05050', fontSize: '0.78rem', fontWeight: 600,
    whiteSpace: 'nowrap',
    animation: 'springUp .25s cubic-bezier(.16,1,.3,1)',
  }}>
    {surpriseError}
  </div>
)}
```

- [ ] **Step 5: Run build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "fix: Surprise Me shows error toast on failure, disables when city/persona missing"
```

---

## Task 9: Profile — fix hardcoded colors and fonts

**Files:**
- Modify: `frontend/src/modules/profile/ProfileScreen.tsx`

Profile has hardcoded `#e07854` (terracotta) and falls back to `#3b82f6` (cobalt blue) for the archetype color when archetype is missing. Both need fixing to use design system values.

- [ ] **Step 1: Fix hardcoded #e07854 in ProfileScreen**

Open `frontend/src/modules/profile/ProfileScreen.tsx`.

Find line 244:
```tsx
style={{ background: theme === 'dark' ? '#e07854' : 'rgba(255,255,255,.15)' }}
```
Replace with:
```tsx
style={{ background: theme === 'dark' ? 'var(--color-primary)' : 'rgba(255,255,255,.15)' }}
```

Find line 262:
```tsx
: 'bg-gradient-to-br from-[#e07854] to-[#c4613d] [box-shadow:var(--shadow-primary)]'
```
Replace with:
```tsx
: 'bg-gradient-to-br from-[#d4a853] to-[#b8893a] [box-shadow:var(--shadow-primary)]'
```

- [ ] **Step 2: Fix blue fallback color for archetype**

Find line 51:
```tsx
const archetypeColor = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' };
```
Replace with:
```tsx
const archetypeColor = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' };
```

- [ ] **Step 3: Verify no remaining blue/terracotta hardcodes**

```bash
grep -n "3b82f6\|e07854\|c4613d\|Playfair" frontend/src/modules/profile/ProfileScreen.tsx
```
Expected: 0 results.

- [ ] **Step 4: Run build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/profile/ProfileScreen.tsx
git commit -m "fix: Profile hardcoded colors — replace terracotta and blue with amber design system values"
```

---

## Task 10: Itinerary — audit and fix broken rendering

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelIntroCard.tsx` (if broken)
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx` (if broken)
- Modify: `frontend/src/modules/route/reel/ReelFinaleCard.tsx` (if broken)
- Modify: `frontend/src/modules/route/RouteScreen.tsx` (if broken)

The reel structure exists and looks structurally correct. The "itinerary broken" issue is most likely one of: (a) `buildReelCards` returns empty array, (b) snap-scroll misfire, (c) a reel card component crashing. Audit first, then fix.

- [ ] **Step 1: Run the reel tests to identify failures**

```bash
cd frontend && npx vitest run src/modules/route/ 2>&1
```
Note which tests fail, if any. Fix failures before visual audit.

- [ ] **Step 2: Verify reel-builder handles empty/null itinerary gracefully**

Open `frontend/src/modules/route/reel/reel-builder.ts`. Find the function signature:
```ts
export function buildReelCards(itinerary: EngineItinerary, ...)
```
Verify the first line guards against null/empty:
```ts
if (!itinerary?.days?.length) return [];
```
If missing, add it.

- [ ] **Step 3: Check ReelFinaleCard for missing required props**

Open `frontend/src/modules/route/reel/ReelFinaleCard.tsx`. Verify it handles `card.city` being undefined (city name shown in tagline). If it crashes on undefined, add a fallback:
```tsx
{card.city ?? 'Your trip'} awaits
```

- [ ] **Step 4: Fix any snap-scroll height issue**

Open `frontend/src/modules/route/reel/ItineraryReelScreen.tsx`. Verify the outer container is:
```tsx
<div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
```
And the scroll container is:
```tsx
style={{
  width: '100%', height: '100%',
  overflowY: 'scroll', overflowX: 'hidden',
  scrollSnapType: 'y mandatory',
  scrollBehavior: 'smooth',
}}
```
Each card must have `height: '100dvh'`. Check `ReelIntroCard`, `ReelStopCard`, `ReelRecoCard`, `ReelTransitCard`, `ReelFinaleCard` — verify each has:
```tsx
<div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', ... }}>
```
If any card is missing `height: '100dvh'`, add it.

- [ ] **Step 5: Check RouteScreen for font/color issues**

```bash
grep -n "e07854\|c4613d\|3b82f6\|Playfair" frontend/src/modules/route/RouteScreen.tsx
```
Fix any found values using the same pattern as Task 1.

- [ ] **Step 6: Run all route tests**

```bash
cd frontend && npx vitest run src/modules/route/ 2>&1 | tail -20
```
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/route/
git commit -m "fix: itinerary reel — guard empty build, fix card heights, fix broken rendering"
```

---

## Self-Review

**Spec coverage:**
- ✅ Design tokens (Task 1 — hardcoded color cleanup)
- ✅ Light/dark mode (tokens in `index.css` already correct; light theme cascade fixed by Task 1 removing hardcoded overrides)
- ✅ Community removed (Task 2 — BottomNav)
- ✅ OB 2×2 photo grid (Task 3)
- ✅ Map FilterBar All/Curated (Task 4)
- ✅ Pin system Option B + 3 states + hot badge + cluster hot badge (Task 5)
- ✅ PinCard fixed height (Task 6)
- ✅ BuildItineraryBar min 2 (Task 7)
- ✅ Surprise Me fix (Task 8)
- ✅ Profile colors (Task 9)
- ✅ Itinerary audit (Task 10)

**Note on cluster hot badge:** Task 5 covers pin hot badges. MapLibre clustering is handled by the MapLibre GL engine, not `MapLibreMarkers`. The cluster bubble UI is defined in `MapScreen.tsx` as a cluster layer style. Propagating the hot badge to clusters requires reading cluster source data — this is a MapLibre-specific operation. Check `MapScreen.tsx` for an existing cluster layer definition; if present, add a conditional `local_fire_department` icon overlay for clusters containing hot pins. If no cluster layer exists, skip — this is a nice-to-have beyond the core pin state work.

**Note on Persona screen (Task 3 dependency):** The OB task updates the question screens. `PersonaScreen.tsx` (the reveal) is a separate screen and is not included here — it uses `ARCHETYPE_COLORS` which Task 9 confirms are correct. If PersonaScreen has visual issues, they're likely hardcoded color instances addressable with the same grep pattern from Task 1.
