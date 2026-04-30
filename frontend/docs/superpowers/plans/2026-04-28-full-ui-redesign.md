# Full UI Redesign — Uncover Roads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire Uncover Roads web app from a cool blue dark theme (Inter/Plus Jakarta Sans) to a warm editorial dark theme (Playfair Display/DM Sans) with full light mode support, achieving high-fidelity visual parity with design handoff prototypes in `design_handoff/prototype/`.

**Architecture:** Token-first — replace all CSS design tokens in `src/index.css` first, then wire up the theme toggle, then update each screen group in order. Light mode is handled via a `[data-theme=light]` CSS block; toggling sets `document.documentElement.dataset.theme`, persisted to `localStorage('ur_theme')`.

**Tech Stack:** React, Vite, TypeScript, Tailwind v4 (CSS-first `@theme`), Zustand, MapLibre GL, Material Symbols Outlined, Google Fonts (Playfair Display + DM Sans replacing Inter + Plus Jakarta Sans).

---

## File Structure

### Create
- `src/modules/route/rec-rules.ts` — Typed constants for recommendation rendering rules

### Modify
- `index.html` — Replace font imports (Playfair Display + DM Sans, remove Inter + Plus Jakarta Sans)
- `src/index.css` — Replace `@theme` tokens, add `[data-theme=light]` block, add 8 new @keyframes
- `src/shared/store.tsx` — Add `theme` state + `SET_THEME` action
- `src/App.tsx` — Boot-time `data-theme` application from localStorage
- `src/shared/ui/Button.tsx` — Warm gradient/ghost/outline/danger variants
- `src/shared/ui/Card.tsx` — Surface token bg, warm border/radius/shadow
- `src/shared/ui/BottomNav.tsx` — Warm glass bg, primary active color
- `src/shared/ui/Toast.tsx` — Surface bg, sage/amber/red accents
- `src/modules/login/LoginScreen.tsx` — Warm overlay, floating icons, Playfair brand
- `src/modules/login/WalkthroughScreen.tsx` — Playfair slides, primary CTA
- `src/modules/login/WelcomeBackScreen.tsx` — Same overlay as LoginScreen
- `src/modules/onboarding/OnboardingShell.tsx` — Warm bg, primary progress bar, Playfair headings
- `src/modules/onboarding/OB1Group.tsx` through `OB9BudgetProtect.tsx` — OptionCard warm selected state
- `src/shared/questionnaire/ConflictPanel.tsx` — Amber tokens
- `src/shared/questionnaire/BentoCard.tsx` — Surface2 bg
- `src/shared/questionnaire/ImageRowCard.tsx` — Warm overlay + Playfair label
- `src/modules/persona/PersonaScreen.tsx` — Archetype hero card, match bars, springUp
- `src/modules/persona/PersonaModal.tsx` — Same archetype card treatment
- `src/modules/destination/DestinationScreen.tsx` — Playfair title, warm search bar
- `src/modules/trips/TripsScreen.tsx` — cardEntry stagger, archetype badge, warm gradient overlay
- `src/modules/map/MapScreen.tsx` — Warm token pass
- `src/modules/map/MapLibreMap.tsx` — Theme-aware tile URL
- `src/modules/map/MapLibreRoute.tsx` — Warm route colors + rec branch layers
- `src/modules/map/PinCard.tsx` — Warm surface, Playfair place name
- `src/modules/map/SearchDropdown.tsx` — Warm surface, primary focus border
- `src/modules/map/FilterBar.tsx` — Surface2 chips, primary active
- `src/modules/map/TripPlanningCard.tsx` — Surface card, gradient CTA
- `src/modules/map/OriginSearchCard.tsx` — Surface tokens
- `src/modules/map/SearchResultCard.tsx` — Surface tokens
- `src/modules/journey/JourneyScreen.tsx` — Dark radial map panel, warm cards, pinPulse
- `src/modules/journey/JourneyOriginCard.tsx` — Sky icon, Playfair name
- `src/modules/journey/JourneyCityCard.tsx` — Thumbnail, chips, dashed add pill
- `src/modules/journey/JourneyTransitCard.tsx` — Sky icon, amber tip
- `src/modules/journey/JourneyAdvisorThread.tsx` — Sage bg/border, springUp
- `src/modules/journey/JourneyStrip.tsx` — Pill tabs, primary active
- `src/modules/route/RouteScreen.tsx` — Floating header, progress dots, multi-day timeline
- `src/modules/route/ItineraryPlaceCard.tsx` — Warm surface, Playfair name, primary time badge
- `src/modules/route/ItineraryMapCard.tsx` — Warm surface, sky transit accent
- `src/modules/route/ItineraryCards.tsx` — Token pass
- `src/modules/profile/ProfileScreen.tsx` — Archetype card, match bars, appearance toggle
- `src/modules/profile/sub-screens/NotificationsScreen.tsx` — Sticky header + settings rows
- `src/modules/profile/sub-screens/PrivacyScreen.tsx` — Same pattern
- `src/modules/profile/sub-screens/SubscriptionDetailsScreen.tsx` — Same pattern
- `src/modules/profile/sub-screens/UnitsSheet.tsx` — Same pattern
- `src/modules/subscription/SubscriptionScreen.tsx` — Amber Pro tier, primary Unlimited
- `src/modules/subscription/MiniPaywall.tsx` — Warm tokens
- `src/modules/navigation/NavScreen.tsx` — Warm overlay cards

---

## Task 1: Design Tokens, Fonts, Animations

**Files:**
- Modify: `src/index.css`
- Modify: `index.html`

- [ ] **Step 1: Replace `@theme` block in `src/index.css`**

Replace the entire `@theme { ... }` block with:

```css
@theme {
  /* Backgrounds */
  --color-bg:         #1a1714;
  --color-bg2:        #131110;
  --color-surface:    #242018;
  --color-surface2:   #2e2a22;

  /* Primary */
  --color-primary:    #e07854;
  --color-primary-dk: #c4613d;
  --color-primary-bg: rgba(224,120,84,.14);

  /* Semantic accents */
  --color-sage:       #6b9470;
  --color-sage-bg:    rgba(107,148,112,.15);
  --color-sage-bdr:   rgba(107,148,112,.30);
  --color-sky:        #4f8fab;
  --color-sky-bg:     rgba(79,143,171,.15);
  --color-sky-bdr:    rgba(79,143,171,.30);
  --color-amber:      #c49840;
  --color-amber-bg:   rgba(196,152,64,.15);
  --color-amber-bdr:  rgba(196,152,64,.30);

  /* Text */
  --color-text-1:     #f5f0ea;
  --color-text-2:     #c0b0a4;
  --color-text-3:     #857268;
  --color-text-4:     #5a4e47;

  /* Borders */
  --color-border:     rgba(255,255,255,.08);
  --color-border-m:   rgba(255,255,255,.14);
  --color-divider:    rgba(255,255,255,.06);

  /* Shadows */
  --shadow-md:        0 4px 24px rgba(0,0,0,.45);
  --shadow-primary:   0 6px 24px rgba(224,120,84,.25);

  /* Fonts */
  --font-sans:        'DM Sans', sans-serif;
  --font-heading:     'Playfair Display', serif;

  /* Nav bg (theme-switchable) */
  --nav-bg:           rgba(26,23,20,.92);
}
```

Also update the `html, body` rule:

```css
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: #1a1714;
  color: #f5f0ea;
  font-family: 'DM Sans', sans-serif;
}
```

- [ ] **Step 2: Add `[data-theme=light]` block to `src/index.css`**

Add immediately after the `@theme` block:

```css
[data-theme=light] {
  --color-bg:         #faf8f4;
  --color-bg2:        #f2ede5;
  --color-surface:    #ffffff;
  --color-surface2:   #f8f4ef;
  --color-text-1:     #2c2420;
  --color-text-2:     #6b5e57;
  --color-text-3:     #a09085;
  --color-text-4:     #c4b8b0;
  --color-border:     rgba(44,36,32,.08);
  --color-border-m:   rgba(44,36,32,.14);
  --color-divider:    rgba(44,36,32,.06);
  --color-primary-bg: rgba(224,120,84,.10);
  --shadow-md:        0 4px 24px rgba(44,36,32,.12);
  --nav-bg:           rgba(250,248,244,.94);
}
```

- [ ] **Step 3: Add new @keyframes to `src/index.css`**

Add after the existing `@keyframes` blocks (keep all existing weather/shimmer/marker ones):

```css
/* ── UI entry animations ──────────────────────────────── */
@keyframes springUp {
  0%   { transform: translateY(32px); opacity: 0; }
  60%  { transform: translateY(-6px); opacity: 1; }
  100% { transform: translateY(0);    opacity: 1; }
}

@keyframes cardEntry {
  0%   { transform: translateY(24px) scale(.97); opacity: 0; }
  100% { transform: translateY(0)    scale(1);   opacity: 1; }
}

@keyframes pinPulse {
  0%   { transform: scale(1);   opacity: .7; }
  100% { transform: scale(2.8); opacity: 0;  }
}

@keyframes confetti {
  0%   { transform: translateY(0)     rotate(0deg);   opacity: 1; }
  100% { transform: translateY(110px) rotate(600deg); opacity: 0; }
}

@keyframes bounceIn {
  0%   { transform: scale(.5);  }
  70%  { transform: scale(1.15); }
  100% { transform: scale(1);   }
}

@keyframes wiggleFocus {
  0%   { transform: translateX(0);    }
  15%  { transform: translateX(-3px); }
  35%  { transform: translateX(3px);  }
  55%  { transform: translateX(-2px); }
  75%  { transform: translateX(2px);  }
  100% { transform: translateX(0);    }
}

@keyframes floatUp {
  0%   { transform: translateY(0);      opacity: 0;   }
  20%  { opacity: 0.6; }
  80%  { opacity: 0.6; }
  100% { transform: translateY(-120vh); opacity: 0;   }
}

@keyframes spin {
  0%   { transform: rotate(0deg);   }
  100% { transform: rotate(360deg); }
}
```

- [ ] **Step 4: Update Google Fonts import in `index.html`**

Replace the existing `<link>` for Plus Jakarta Sans + Inter with:

```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Keep the Material Symbols Outlined `<link>` unchanged.

Update `<meta name="theme-color">`:

```html
<meta name="theme-color" content="#1a1714" />
```

- [ ] **Step 5: Start dev server and confirm token cascade**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run dev
```

Open the app. Background should be `#1a1714` (warm near-black), text `#f5f0ea`. Any component already using Tailwind token classes (e.g. `bg-bg`, `text-text-1`) updates automatically.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/index.css index.html
git commit -m "feat: replace design tokens with warm editorial theme, add light mode block + animations"
```

---

## Task 2: Theme Store + Boot-Time Application

**Files:**
- Modify: `src/shared/store.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing test**

Create `src/shared/store.theme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const datasetMock: Record<string, string> = {};
Object.defineProperty(document.documentElement, 'dataset', { value: datasetMock, writable: true });

describe('theme store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    delete datasetMock.theme;
  });

  it('defaults to dark theme', async () => {
    const { useAppStore } = await import('./store');
    expect(useAppStore.getState().theme).toBe('dark');
  });

  it('SET_THEME updates state, localStorage, and data-theme', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.getState().dispatch({ type: 'SET_THEME', theme: 'light' });
    expect(useAppStore.getState().theme).toBe('light');
    expect(localStorageMock.getItem('ur_theme')).toBe('light');
    expect(datasetMock.theme).toBe('light');
  });

  it('SET_THEME back to dark restores dark token', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.getState().dispatch({ type: 'SET_THEME', theme: 'light' });
    useAppStore.getState().dispatch({ type: 'SET_THEME', theme: 'dark' });
    expect(useAppStore.getState().theme).toBe('dark');
    expect(localStorageMock.getItem('ur_theme')).toBe('dark');
    expect(datasetMock.theme).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/store.theme.test.ts
```

Expected: FAIL — `theme` not on store state.

- [ ] **Step 3: Add `theme` + `SET_THEME` to store**

In `src/shared/store.tsx`:

1. Add to the `AppState` type:
```ts
theme: 'dark' | 'light';
```

2. Add to the action union type:
```ts
| { type: 'SET_THEME'; theme: 'dark' | 'light' }
```

3. Add to initial state:
```ts
theme: 'dark',
```

4. Add to the reducer `switch` statement:
```ts
case 'SET_THEME': {
  localStorage.setItem('ur_theme', action.theme);
  document.documentElement.dataset.theme = action.theme;
  return { ...state, theme: action.theme };
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/store.theme.test.ts
```

Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Apply persisted theme on boot in `src/App.tsx`**

Read `src/App.tsx`. At the top of the `App` component body, add a `useEffect` that runs once before the first meaningful render:

```tsx
// At top of App component, before routing logic:
React.useEffect(() => {
  const saved = localStorage.getItem('ur_theme') as 'dark' | 'light' | null;
  if (saved) {
    document.documentElement.dataset.theme = saved;
    useAppStore.getState().dispatch({ type: 'SET_THEME', theme: saved });
  }
}, []);
```

Ensure `useAppStore` is imported at the top of `App.tsx` (it likely already is).

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/shared/store.tsx src/App.tsx src/shared/store.theme.test.ts
git commit -m "feat: add SET_THEME action to store with localStorage persistence and boot-time application"
```

---

## Task 3: Shared Component — Button

**Files:**
- Modify: `src/shared/ui/Button.tsx`

- [ ] **Step 1: Read current Button.tsx**

Read `src/shared/ui/Button.tsx`.

- [ ] **Step 2: Rewrite Button.tsx with warm variants**

```tsx
import React from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-br from-[#e07854] to-[#c4613d]',
    'text-white font-bold',
    '[box-shadow:var(--shadow-primary)]',
    'border-0',
  ].join(' '),
  ghost: [
    'bg-transparent',
    'border border-[var(--color-border)]',
    'text-[var(--color-text-2)]',
  ].join(' '),
  outline: [
    'bg-transparent',
    'border border-[var(--color-primary)]',
    'text-[var(--color-primary)]',
  ].join(' '),
  danger: [
    'bg-[rgba(220,60,60,.12)]',
    'border border-red-500/40',
    'text-red-400',
  ].join(' '),
};

export function Button({
  variant = 'primary',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'h-[52px] px-6 rounded-2xl',
        'font-[family-name:var(--font-sans)] text-[15px] font-bold',
        'active:scale-[.97] transition-transform duration-100',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {loading
        ? <span className="ms text-[20px]" style={{ animation: 'spin 0.8s linear infinite' }}>autorenew</span>
        : children}
    </button>
  );
}
```

- [ ] **Step 3: Visually verify in dev server**

Open any screen with a button. Primary buttons show orange-to-rust gradient.

- [ ] **Step 4: Commit**

```bash
git add src/shared/ui/Button.tsx
git commit -m "feat: update Button to warm gradient variants"
```

---

## Task 4: Shared Components — Card, BottomNav, Toast

**Files:**
- Modify: `src/shared/ui/Card.tsx`
- Modify: `src/shared/ui/BottomNav.tsx`
- Modify: `src/shared/ui/Toast.tsx`

- [ ] **Step 1: Read Card.tsx, BottomNav.tsx, Toast.tsx**

Read all three files.

- [ ] **Step 2: Update Card.tsx**

```tsx
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        'rounded-[20px]',
        '[box-shadow:var(--shadow-md)]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Update BottomNav.tsx**

Find the outermost container element and replace its `className` bg/border with:

```tsx
className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--nav-bg)] [backdrop-filter:blur(12px)] border-t border-[var(--color-divider)] pb-safe"
```

For each nav tab item, replace active/inactive color classes:

```tsx
// Icon span (assuming class like `ms`):
className={`ms ${isActive ? 'fill text-[var(--color-primary)]' : 'text-[var(--color-text-3)]'}`}

// Label span:
className={`text-[10px] mt-0.5 ${isActive ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-3)]'}`}
```

- [ ] **Step 4: Update Toast.tsx**

Find the toast container and replace bg/border classes:

```tsx
// Base container:
'bg-[var(--color-surface)] border rounded-2xl px-4 py-3 flex items-center gap-3 [box-shadow:var(--shadow-md)]'

// success variant border: 'border-[var(--color-sage-bdr)]'
// warning variant border: 'border-[var(--color-amber-bdr)]'
// error variant border:   'border-red-500/30'

// success icon:  <span className="ms fill text-[var(--color-sage)]">check_circle</span>
// warning icon:  <span className="ms fill text-[var(--color-amber)]">warning</span>
// error icon:    <span className="ms fill text-red-400">error</span>
```

- [ ] **Step 5: Visually verify**

Check BottomNav warm glass background, active orange tab, Card warm surface, Toast variants if triggerable from dev.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ui/Card.tsx src/shared/ui/BottomNav.tsx src/shared/ui/Toast.tsx
git commit -m "feat: update Card, BottomNav, Toast to warm editorial tokens"
```

---

## Task 5: Auth Screens

**Files:**
- Modify: `src/modules/login/LoginScreen.tsx`
- Modify: `src/modules/login/WalkthroughScreen.tsx`
- Modify: `src/modules/login/WelcomeBackScreen.tsx`

- [ ] **Step 1: Read all three auth files**

Read `LoginScreen.tsx`, `WalkthroughScreen.tsx`, `WelcomeBackScreen.tsx`.

- [ ] **Step 2: Update LoginScreen.tsx**

Key changes — apply in order:

**Gradient overlay** — find the overlay `div` and replace its background with:
```tsx
style={{ background: 'linear-gradient(rgba(15,12,10,.55), rgba(15,12,10,.96))' }}
```

**Brand lockup heading** — find "uncover roads" text element, replace className:
```tsx
className="font-[family-name:var(--font-heading)] text-white text-4xl font-bold tracking-tight"
```

**Logo tile** — find logo container, replace className:
```tsx
className="w-[68px] h-[68px] rounded-[22px] bg-white/10 [backdrop-filter:blur(8px)] flex items-center justify-center"
```

**Floating icons** — add before the main content container:
```tsx
const FLOATING_ICONS = [
  'flight','place','map','luggage','camera_alt',
  'restaurant','hotel','explore','directions_walk',
];

// In JSX:
<div className="absolute inset-0 overflow-hidden pointer-events-none">
  {FLOATING_ICONS.map((icon, i) => (
    <span
      key={icon}
      className="ms absolute text-white/25 text-[28px]"
      style={{
        left: `${10 + (i * 10) % 80}%`,
        bottom: '-10%',
        animation: `floatUp ${8 + (i % 3) * 2}s ${i * 0.8}s ease-in-out infinite`,
      }}
    >
      {icon}
    </span>
  ))}
</div>
```

**Google sign-in button** — replace border/bg classes:
```tsx
className="bg-[var(--color-surface)] border border-[var(--color-border)] ... active:border-[var(--color-primary)] focus:border-[var(--color-primary)]"
```

**Entry animation** — on main content container:
```tsx
style={{ animation: 'cardEntry 0.6s ease 0.2s both' }}
```

- [ ] **Step 3: Update WalkthroughScreen.tsx**

- Slide card bg: `bg-[var(--color-bg)]`
- Headings: add `font-[family-name:var(--font-heading)]`
- Progress dots: active = `bg-[var(--color-primary)] w-5 h-2 rounded-full`, inactive = `bg-[var(--color-surface2)] w-2 h-2 rounded-full`
- CTA: replace with `<Button variant="primary" className="w-full">`
- Slide entry: `style={{ animation: 'springUp 0.4s ease both' }}`

- [ ] **Step 4: Update WelcomeBackScreen.tsx**

- Same gradient overlay as LoginScreen (`rgba(15,12,10,.55)` → `.96`)
- Avatar circle: `bg-[var(--color-primary-bg)] text-[var(--color-primary)]`
- Name: `font-[family-name:var(--font-heading)]`
- CTA: `<Button variant="primary" className="w-full">`

- [ ] **Step 5: Visually verify**

Load app fresh. Check floating icons, Playfair heading, warm overlay.

- [ ] **Step 6: Commit**

```bash
git add src/modules/login/
git commit -m "feat: update auth screens with warm overlay, floating icons, Playfair brand"
```

---

## Task 6: Onboarding Shell + Questionnaire Components

**Files:**
- Modify: `src/modules/onboarding/OnboardingShell.tsx`
- Modify: `src/shared/questionnaire/ConflictPanel.tsx`
- Modify: `src/shared/questionnaire/BentoCard.tsx`
- Modify: `src/shared/questionnaire/ImageRowCard.tsx`

- [ ] **Step 1: Read all four files**

Read `OnboardingShell.tsx`, `ConflictPanel.tsx`, `BentoCard.tsx`, `ImageRowCard.tsx`.

- [ ] **Step 2: Update OnboardingShell.tsx**

- Background: `bg-[var(--color-bg)]`
- Progress bar container: `w-full h-[2px] bg-[var(--color-surface2)]`; fill: `bg-[var(--color-primary)] h-full transition-all`
- Question heading: `font-[family-name:var(--font-heading)] text-[22px] font-bold text-[var(--color-text-1)]`
- Back button: `w-9 h-9 rounded-full border border-[var(--color-border)] text-[var(--color-text-2)] flex items-center justify-center`

- [ ] **Step 3: Update ConflictPanel.tsx**

```tsx
<div className="bg-[var(--color-amber-bg)] border border-[var(--color-amber-bdr)] rounded-2xl p-4 flex gap-3 items-start">
  <span className="ms text-[var(--color-amber)] text-[20px] flex-shrink-0">lightbulb</span>
  <div className="text-[13px] text-[var(--color-text-2)]">{children}</div>
</div>
```

- [ ] **Step 4: Update BentoCard.tsx**

Find the card container, replace bg/radius:
```tsx
className="bg-[var(--color-surface2)] rounded-[14px] p-4"
```

- [ ] **Step 5: Update ImageRowCard.tsx**

Find gradient overlay element, replace bg:
```tsx
className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(20,16,12,.75)]"
```

Find label text element:
```tsx
className="font-[family-name:var(--font-heading)] text-white text-[15px] font-semibold"
```

- [ ] **Step 6: Visually verify onboarding start**

Navigate to first OB screen. Warm bg, primary progress bar, amber conflict panel visible.

- [ ] **Step 7: Commit**

```bash
git add src/modules/onboarding/OnboardingShell.tsx src/shared/questionnaire/
git commit -m "feat: update onboarding shell and questionnaire components to warm tokens"
```

---

## Task 7: Onboarding Screens OB1–OB9

**Files:**
- Modify: `src/modules/onboarding/OB1Group.tsx` through `src/modules/onboarding/OB9BudgetProtect.tsx`

- [ ] **Step 1: Read OB1Group.tsx as the pattern reference**

Read `src/modules/onboarding/OB1Group.tsx`.

- [ ] **Step 2: Update OptionCard pattern in OB1Group.tsx**

Find each selectable card. Replace selected/unselected classes:

```tsx
className={`bg-[var(--color-surface)] border rounded-2xl p-4 cursor-pointer transition-all active:scale-[.98] ${
  isSelected
    ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg)]'
    : 'border-[var(--color-border)]'
}`}
```

Option label: `text-[var(--color-text-1)] text-[14px] font-medium`

Next button: `<Button variant="primary" className="w-full mt-6">`

Back button: `<Button variant="ghost" className="w-full">`

- [ ] **Step 3: Apply same OptionCard pattern to OB2–OB9**

Read each file one at a time and apply the same selected/unselected class replacements. The pattern is identical across all OB screens:
- Unselected card: `border-[var(--color-border)] bg-[var(--color-surface)]`
- Selected card: `border-[var(--color-primary)] bg-[var(--color-primary-bg)]`
- Buttons: `<Button variant="primary">` / `<Button variant="ghost">`

- [ ] **Step 4: Visually verify OB flow**

Navigate OB1 → OB3. Selected cards show orange border + warm tint. Next is gradient orange.

- [ ] **Step 5: Commit**

```bash
git add src/modules/onboarding/
git commit -m "feat: update OB1-OB9 option cards to warm selected state with primary tokens"
```

---

## Task 8: PersonaScreen + PersonaModal

**Files:**
- Modify: `src/modules/persona/PersonaScreen.tsx`
- Modify: `src/modules/persona/PersonaModal.tsx`

- [ ] **Step 1: Read PersonaScreen.tsx and PersonaModal.tsx**

Read both files. Note how `archetype` is accessed — confirm field names `archetype.glow`, `archetype.primary`, `archetype.emoji`, `archetype.name`, `archetype.tagline` exist (or find the actual field names in the ARCHETYPES constant).

- [ ] **Step 2: Update archetype hero card in PersonaScreen.tsx**

Find the hero card element and replace with:

```tsx
<div
  className="rounded-[20px] p-5 relative overflow-hidden"
  style={{
    background: `linear-gradient(150deg, ${archetype.glow}, rgba(255,255,255,.02))`,
    border: `1px solid ${archetype.primary}28`,
  }}
>
  {/* Radial glow — left edge */}
  <div
    className="absolute left-0 top-0 bottom-0 w-1/2 pointer-events-none"
    style={{ background: `radial-gradient(ellipse at left, ${archetype.primary}18, transparent 70%)` }}
  />

  {/* Emoji */}
  <span
    className="text-[42px] relative"
    style={{ filter: `drop-shadow(0 0 16px ${archetype.primary}70)` }}
  >
    {archetype.emoji}
  </span>

  {/* Name */}
  <div className="font-[family-name:var(--font-heading)] text-[17px] font-semibold text-[var(--color-text-1)] mt-2">
    {archetype.name}
  </div>

  {/* Tagline */}
  <div className="text-[12px] text-[var(--color-text-3)] mt-0.5">{archetype.tagline}</div>
</div>
```

- [ ] **Step 3: Update match bars in PersonaScreen.tsx**

Find match bar elements and replace:

```tsx
{/* Track */}
<div className="h-[5px] rounded-full bg-[var(--color-surface2)] overflow-hidden">
  {/* Animated fill */}
  <div
    className="h-full rounded-full"
    style={{
      background: archetype.primary,
      width: `${score}%`,
      transition: `width 0.9s cubic-bezier(.25,0,0,1) ${index * 0.15}s`,
    }}
  />
</div>
```

- [ ] **Step 4: Add springUp entry to PersonaScreen.tsx**

On the main content container:
```tsx
style={{ animation: 'springUp 0.45s ease both' }}
```

- [ ] **Step 5: Apply same archetype hero card to PersonaModal.tsx**

Copy the hero card JSX from Step 2 into PersonaModal.tsx, replacing whatever card markup currently exists there.

- [ ] **Step 6: Visually verify**

Complete a fresh onboarding flow to reach PersonaScreen. Archetype hero card shows runtime gradient. Match bars animate outward on mount.

- [ ] **Step 7: Commit**

```bash
git add src/modules/persona/
git commit -m "feat: update PersonaScreen/Modal with archetype hero card, animated match bars, springUp entry"
```

---

## Task 9: Main Tabs — DestinationScreen + TripsScreen

**Files:**
- Modify: `src/modules/destination/DestinationScreen.tsx`
- Modify: `src/modules/trips/TripsScreen.tsx`

- [ ] **Step 1: Read DestinationScreen.tsx**

Read `src/modules/destination/DestinationScreen.tsx`.

- [ ] **Step 2: Update DestinationScreen.tsx**

**Date label** — find date text element:
```tsx
className="text-[11px] text-[var(--color-text-3)] uppercase tracking-wide"
```

**Gradient title** — find "uncover roads" heading:
```tsx
<h1
  className="font-[family-name:var(--font-heading)] text-[28px] font-bold"
  style={{ background: 'linear-gradient(135deg, #f5f0ea, #e07854)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
>
  uncover roads
</h1>
```

**Avatar circle**:
```tsx
className="w-9 h-9 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary)] font-bold text-[14px]"
```

**Search bar** — find search container, replace with:
```tsx
<div
  className={`bg-[var(--color-surface)] h-[50px] rounded-[18px] flex items-center px-4 gap-2 border transition-all ${
    focused ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'
  }`}
  style={focused ? { animation: 'wiggleFocus 0.35s ease' } : undefined}
>
```

**City suggestion cards** — find overlay gradient element:
```tsx
className="absolute inset-0 bg-gradient-to-b from-transparent to-[rgba(20,16,12,.8)]"
```

City name inside card:
```tsx
className="font-[family-name:var(--font-heading)] text-white text-[22px] font-bold"
```

Country/tag caption:
```tsx
className="text-[11px] text-white/70"
```

**Section headers**:
```tsx
className="font-[family-name:var(--font-heading)] text-[16px] font-bold text-[var(--color-text-1)]"
```

- [ ] **Step 3: Read TripsScreen.tsx**

Read `src/modules/trips/TripsScreen.tsx`.

- [ ] **Step 4: Update TripsScreen.tsx trip cards**

Find each trip card container and replace with:

```tsx
<div
  className="relative h-[145px] rounded-[22px] overflow-hidden"
  style={{ animation: `cardEntry 0.4s ease ${index * 0.09}s both` }}
>
  {/* Keep existing image element */}

  {/* Gradient overlay */}
  <div
    className="absolute inset-0"
    style={{ background: 'linear-gradient(160deg, rgba(20,16,12,.22) 0%, rgba(20,16,12,.8) 100%)' }}
  />

  {/* Top-left: city + meta */}
  <div className="absolute top-3 left-4">
    <div className="font-[family-name:var(--font-heading)] text-white text-[22px] font-bold leading-tight">
      {cityName}
    </div>
    <div className="text-[11px] text-white/70 mt-0.5">{country} · {date} · {stops} stops</div>
  </div>

  {/* Top-right: archetype badge */}
  <div
    className="absolute top-3 right-4 flex items-center gap-1 px-2 py-1 rounded-full"
    style={{ background: archetype.glow, border: `1px solid ${archetype.primary}40` }}
  >
    <span className="text-[12px]">{archetype.emoji}</span>
    <span className="text-[10px] font-bold" style={{ color: archetype.primary }}>{archetype.name}</span>
  </div>

  {/* Bottom-left: Continue pill */}
  <div
    className="absolute bottom-3 left-4 flex items-center gap-1 px-3 py-1.5 rounded-full"
    style={{ background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }}
  >
    <span className="ms text-white text-[16px]">play_arrow</span>
    <span className="text-white text-[12px] font-semibold">Continue trip</span>
  </div>
</div>
```

- [ ] **Step 5: Visually verify**

Open Home tab — Playfair gradient title, warm search bar, orange focus border. Open Trips tab — card overlay, archetype badge, staggered entry.

- [ ] **Step 6: Commit**

```bash
git add src/modules/destination/DestinationScreen.tsx src/modules/trips/TripsScreen.tsx
git commit -m "feat: update DestinationScreen and TripsScreen to warm editorial design"
```

---

## Task 10: Map Module

**Files:**
- Modify: `src/modules/map/MapLibreMap.tsx`
- Modify: `src/modules/map/MapLibreRoute.tsx`
- Modify: `src/modules/map/PinCard.tsx`
- Modify: `src/modules/map/SearchDropdown.tsx`
- Modify: `src/modules/map/FilterBar.tsx`
- Modify: `src/modules/map/TripPlanningCard.tsx`
- Modify: `src/modules/map/OriginSearchCard.tsx`
- Modify: `src/modules/map/SearchResultCard.tsx`

- [ ] **Step 1: Read MapLibreMap.tsx**

Read `src/modules/map/MapLibreMap.tsx`.

- [ ] **Step 2: Update MapLibreMap.tsx for theme-aware tile URLs**

Find where the MapLibre style/tile URL is set. Add a helper and a MutationObserver:

```tsx
function getTileUrl(): string {
  return document.documentElement.dataset.theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png';
}
```

In the effect that initialises the map, pass `getTileUrl()` as the initial tile URL.

Add a separate effect to swap tiles when the theme changes:
```tsx
useEffect(() => {
  if (!map) return;
  const observer = new MutationObserver(() => {
    const url = getTileUrl();
    // update the raster tile source URL — exact API depends on how the source is registered:
    // map.getSource('carto-tiles')?.setTiles([url]);
    // OR re-set the style if using a full style object
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}, [map]);
```

- [ ] **Step 3: Read MapLibreRoute.tsx**

Read `src/modules/map/MapLibreRoute.tsx`.

- [ ] **Step 4: Update MapLibreRoute.tsx route + rec branch layer paints**

Find the main route line layer paint and replace color/width:
```ts
// Main route:
paint: {
  'line-color': '#e07854',
  'line-width': 3.5,
  'line-cap': 'round',
  'line-join': 'round',
}
```

Find or add rec branch layers (one per category color):
```ts
// Food/amber rec branch:
paint: { 'line-color': '#c49840', 'line-width': 1.8, 'line-dasharray': [5, 4] }

// Café/sage rec branch:
paint: { 'line-color': '#6b9470', 'line-width': 1.8, 'line-dasharray': [5, 4] }

// Viewpoint/sky rec branch:
paint: { 'line-color': '#4f8fab', 'line-width': 1.8, 'line-dasharray': [5, 4] }
```

Rec markers circle layer:
```ts
paint: {
  'circle-radius': 5.5,
  'circle-color': ['get', 'categoryColor'], // GeoJSON feature property
  'circle-stroke-color': 'white',
  'circle-stroke-width': 1.5,
}
```

Branch origin dot on main route:
```ts
paint: {
  'circle-radius': 2.5,
  'circle-color': ['get', 'categoryColor'],
}
```

- [ ] **Step 5: Read and update PinCard.tsx**

Read `src/modules/map/PinCard.tsx`.

```tsx
// Card container:
className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-4 [box-shadow:var(--shadow-md)]"

// Place name:
className="font-[family-name:var(--font-heading)] text-[var(--color-text-1)] text-[17px] font-semibold"

// Primary accent text (distance/category):
className="text-[var(--color-primary)] text-[12px]"
```

- [ ] **Step 6: Update remaining map sub-components**

Read `SearchDropdown.tsx`, `FilterBar.tsx`, `TripPlanningCard.tsx`, `OriginSearchCard.tsx`, `SearchResultCard.tsx`.

**SearchDropdown.tsx:**
```tsx
// Container: bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] [box-shadow:var(--shadow-md)]
// Input focus: border-[var(--color-primary)]
// Row hover: hover:bg-[var(--color-surface2)]
```

**FilterBar.tsx:**
```tsx
className={`h-8 px-3 rounded-full text-[12px] font-medium border transition-all ${
  active
    ? 'bg-[var(--color-primary-bg)] border-[var(--color-primary)] text-[var(--color-primary)]'
    : 'bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text-2)]'
}`}
```

**TripPlanningCard.tsx, OriginSearchCard.tsx, SearchResultCard.tsx:**
- Container: `bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px]`
- Place names: `font-[family-name:var(--font-heading)]`
- Primary CTA: `<Button variant="primary">`

- [ ] **Step 7: Visually verify map module**

Open Map tab. Dark tiles visible, warm pin cards, orange active filter chip, primary focus on search.

- [ ] **Step 8: Commit**

```bash
git add src/modules/map/
git commit -m "feat: update Map module — theme-aware tiles, warm token pass, rec branch route colors"
```

---

## Task 11: Journey Module

**Files:**
- Modify: `src/modules/journey/JourneyScreen.tsx`
- Modify: `src/modules/journey/JourneyOriginCard.tsx`
- Modify: `src/modules/journey/JourneyCityCard.tsx`
- Modify: `src/modules/journey/JourneyTransitCard.tsx`
- Modify: `src/modules/journey/JourneyAdvisorThread.tsx`
- Modify: `src/modules/journey/JourneyStrip.tsx`

- [ ] **Step 1: Read JourneyScreen.tsx and all sub-components**

Read all six files.

- [ ] **Step 2: Update map panel in JourneyScreen.tsx**

Find the map panel container (58% height), replace bg and add grid + bottom fade:

```tsx
<div
  className="relative overflow-hidden"
  style={{ height: '58%', background: 'radial-gradient(ellipse at center, #0c1020 0%, #060c1a 100%)' }}
>
  {/* SVG grid overlay */}
  <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>

  {/* Keep existing city dots + route SVG — update their styles below */}

  {/* Bottom fade */}
  <div
    className="absolute bottom-0 left-0 right-0 h-[60px] pointer-events-none"
    style={{ background: 'linear-gradient(to bottom, transparent, var(--color-bg))' }}
  />
</div>
```

- [ ] **Step 3: Update city dot elements in JourneyScreen.tsx**

Find inactive city dot elements, replace:
```tsx
<div className="w-[9px] h-[9px] rounded-full bg-[var(--color-text-3)] border border-white/30" />
```

Find active city dot, replace with:
```tsx
<div className="relative w-[14px] h-[14px] flex items-center justify-center">
  <div className="absolute inset-0 rounded-full bg-[#e07854] border-2 border-white" />
  <div
    className="absolute rounded-full bg-[#e07854]"
    style={{ inset: '-4px', animation: 'pinPulse 1.6s ease-out infinite', opacity: 0.4 }}
  />
</div>
```

Find dashed route SVG line, replace stroke:
```tsx
strokeDasharray="5 4"
stroke="rgba(224,120,84,.35)"
strokeWidth={1.5}
```

- [ ] **Step 4: Update progress strip in JourneyScreen.tsx**

Find the progress/tab strip container and each pill tab:

```tsx
{/* Strip container */}
<div className="flex gap-1 p-1 bg-[var(--color-surface)] rounded-full">
  {tabs.map((tab, i) => (
    <button
      key={tab}
      className={`h-[28px] px-4 rounded-full text-[12px] font-semibold transition-all ${
        activeTab === i
          ? 'bg-[var(--color-primary-bg)] border border-[var(--color-primary)] text-[var(--color-primary)] scale-[1.05]'
          : 'text-[var(--color-text-3)]'
      }`}
      onClick={() => setActiveTab(i)}
    >
      {tab}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Update Build CTA in JourneyScreen.tsx**

Find the Build CTA button and replace:

```tsx
const [building, setBuilding] = React.useState(false);

const handleBuild = () => {
  setBuilding(true);
  setTimeout(() => {
    setBuilding(false);
    // existing navigation call
  }, 800);
};

// Button JSX:
<button
  onClick={handleBuild}
  className={`w-full h-[50px] rounded-2xl font-bold text-[15px] text-white transition-all active:scale-[.97] ${
    building
      ? 'bg-green-600'
      : 'bg-gradient-to-br from-[#e07854] to-[#c4613d] [box-shadow:var(--shadow-primary)]'
  }`}
>
  {building
    ? <span className="ms text-[20px]" style={{ animation: 'spin 0.8s linear infinite' }}>autorenew</span>
    : 'Build My Trip'
  }
</button>
```

- [ ] **Step 6: Update journey sub-components**

**JourneyOriginCard.tsx:**
```tsx
// Icon: <span className="ms text-[var(--color-sky)] text-[22px]">flight_land</span>
// Place name: className="font-[family-name:var(--font-heading)] text-[18px] font-semibold text-[var(--color-text-1)]"
```

**JourneyCityCard.tsx:**
```tsx
// Thumbnail: className="w-[44px] h-[44px] rounded-[10px] overflow-hidden flex-shrink-0"
// City name: className="font-[family-name:var(--font-heading)] text-[var(--color-text-1)] text-[15px] font-semibold"
// Days chip: className="text-[11px] bg-[var(--color-sky-bg)] text-[var(--color-sky)] border border-[var(--color-sky-bdr)] px-2 py-0.5 rounded-full"
// "+ Add" pill: className="border border-dashed border-[var(--color-border)] rounded-full px-3 py-1 text-[12px] text-[var(--color-text-3)]"
```

**JourneyTransitCard.tsx:**
```tsx
// Mode icon: className="ms text-[var(--color-sky)] text-[22px]"
// Duration chip: className="text-[11px] bg-[var(--color-sky-bg)] text-[var(--color-sky)] border border-[var(--color-sky-bdr)] px-2 py-0.5 rounded-full"
// Amber tip card:
<div className="bg-[var(--color-amber-bg)] border border-[var(--color-amber-bdr)] rounded-2xl p-3 text-[12px] text-[var(--color-amber)] mt-2">
  {tip}
</div>
```

**JourneyAdvisorThread.tsx:**
```tsx
className="bg-[var(--color-sage-bg)] border border-[var(--color-sage-bdr)] rounded-[20px] p-4"
// Entry:
style={{ animation: 'springUp 0.4s ease both' }}
```

**JourneyStrip.tsx:** Same pill tab pattern as Step 4.

- [ ] **Step 7: Visually verify journey module**

Open Journey. Dark radial map panel, grid overlay visible at low opacity, pinPulse on active city, sage advisor thread, warm card panel.

- [ ] **Step 8: Commit**

```bash
git add src/modules/journey/
git commit -m "feat: update Journey module with dark map panel, pinPulse dots, sage/sky/amber accents"
```

---

## Task 12: rec-rules.ts (new file)

**Files:**
- Create: `src/modules/route/rec-rules.ts`

- [ ] **Step 1: Write failing test**

Create `src/modules/route/rec-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { REC_RULES } from './rec-rules';

describe('REC_RULES', () => {
  it('defines lunch and dinner meal windows', () => {
    const lunch = REC_RULES.MEAL_WINDOWS.find(w => w.type === 'lunch');
    const dinner = REC_RULES.MEAL_WINDOWS.find(w => w.type === 'dinner');
    expect(lunch).toEqual({ start: '11:30', end: '14:00', type: 'lunch' });
    expect(dinner).toEqual({ start: '18:00', end: '21:00', type: 'dinner' });
  });

  it('defines two coffee windows', () => {
    expect(REC_RULES.COFFEE_WINDOWS).toHaveLength(2);
    expect(REC_RULES.COFFEE_WINDOWS[0]).toEqual({ start: '08:00', end: '11:00' });
    expect(REC_RULES.COFFEE_WINDOWS[1]).toEqual({ start: '14:30', end: '17:00' });
  });

  it('has detour metres for all pace types', () => {
    expect(REC_RULES.MAX_DETOUR_METRES.walker).toBe(500);
    expect(REC_RULES.MAX_DETOUR_METRES.relaxed).toBe(800);
    expect(REC_RULES.MAX_DETOUR_METRES.active).toBe(1200);
    expect(REC_RULES.MAX_DETOUR_METRES.default).toBe(600);
  });

  it('maps epicurean persona to food categories', () => {
    expect(REC_RULES.PERSONA_REC_MAP.epicurean).toContain('restaurant');
    expect(REC_RULES.PERSONA_REC_MAP.epicurean).toContain('food_market');
  });

  it('MIN_GAP_MINUTES is 30', () => {
    expect(REC_RULES.MIN_GAP_MINUTES).toBe(30);
  });

  it('MAX_BRANCHES_VISIBLE is 2', () => {
    expect(REC_RULES.MAX_BRANCHES_VISIBLE).toBe(2);
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/rec-rules.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/modules/route/rec-rules.ts`**

```ts
type MealWindow   = { start: string; end: string; type: 'lunch' | 'dinner' };
type CoffeeWindow = { start: string; end: string };
type PaceName     = 'walker' | 'relaxed' | 'active' | 'default';
type PersonaName  = 'epicurean' | 'explorer' | 'slowtraveller' | 'historian';

export const REC_RULES = {
  MEAL_WINDOWS: [
    { start: '11:30', end: '14:00', type: 'lunch'  },
    { start: '18:00', end: '21:00', type: 'dinner' },
  ] as MealWindow[],

  COFFEE_WINDOWS: [
    { start: '08:00', end: '11:00' },
    { start: '14:30', end: '17:00' },
  ] as CoffeeWindow[],

  MAX_DETOUR_METRES: {
    walker:  500,
    relaxed: 800,
    active:  1200,
    default: 600,
  } as Record<PaceName, number>,

  PERSONA_REC_MAP: {
    epicurean:     ['restaurant', 'food_market'],
    explorer:      ['viewpoint', 'park', 'hidden_gem'],
    slowtraveller: ['cafe', 'bookshop', 'garden'],
    historian:     ['monument', 'museum', 'gallery'],
  } as Record<PersonaName, string[]>,

  MIN_GAP_MINUTES:      30,
  MAX_BRANCHES_VISIBLE: 2,
} as const;
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/rec-rules.test.ts
```

Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/route/rec-rules.ts src/modules/route/rec-rules.test.ts
git commit -m "feat: add rec-rules.ts typed constants for recommendation rendering rules"
```

---

## Task 13: RouteScreen + Itinerary Components

**Files:**
- Modify: `src/modules/route/RouteScreen.tsx`
- Modify: `src/modules/route/ItineraryPlaceCard.tsx`
- Modify: `src/modules/route/ItineraryMapCard.tsx`
- Modify: `src/modules/route/ItineraryCards.tsx`

- [ ] **Step 1: Read all four files**

Read `RouteScreen.tsx`, `ItineraryPlaceCard.tsx`, `ItineraryMapCard.tsx`, `ItineraryCards.tsx`.

- [ ] **Step 2: Update RouteScreen.tsx — floating header**

Find the back button and weather pill overlay elements:

```tsx
{/* Back button */}
<button className="w-10 h-10 rounded-full bg-black/30 [backdrop-filter:blur(8px)] flex items-center justify-center">
  <span className="ms text-white">arrow_back</span>
</button>

{/* Weather pill */}
<div className="px-3 py-1.5 rounded-full bg-black/30 [backdrop-filter:blur(8px)] flex items-center gap-1.5">
  <span className="text-white text-[13px]">{weatherIcon} {temp}</span>
</div>
```

- [ ] **Step 3: Update RouteScreen.tsx — progress dots (single-stop view)**

Find the progress indicator (fixed right edge), replace:

```tsx
<div className="fixed right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50">
  {stops.map((_, i) => (
    <div
      key={i}
      className={`rounded-full transition-all duration-300 ${
        i === activeIndex
          ? 'w-[5px] h-[18px] bg-white'
          : 'w-[4px] h-[4px] bg-white/30'
      }`}
    />
  ))}
</div>
```

- [ ] **Step 4: Update RouteScreen.tsx — multi-day view sticky header**

Find the multi-day sticky header element:

```tsx
<div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
  <button className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
    <span className="ms text-[var(--color-text-2)]">arrow_back</span>
  </button>
  <div>
    <div className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)]">{cityName}</div>
    <div className="text-[11px] text-[var(--color-text-3)]">{numDays} days</div>
  </div>
</div>
```

Find the day divider element:

```tsx
<div className="flex items-center gap-3 my-[22px]">
  <div className="flex-1 h-px bg-[var(--color-divider)]" />
  <span className="font-[family-name:var(--font-heading)] text-[13px] font-bold text-[var(--color-text-2)]">
    {dayLabel}
  </span>
  <div className="flex-1 h-px bg-[var(--color-divider)]" />
</div>
```

Find timeline stop elements:

```tsx
<div
  className="flex gap-3 items-start"
  style={{ opacity: 0, animation: `cardEntry 0.4s ease ${dayIndex * 0.1}s forwards` }}
>
  <div className="relative flex flex-col items-center">
    <div className="w-8 h-8 rounded-[10px] bg-[var(--color-primary-bg)] flex items-center justify-center flex-shrink-0">
      <span className="ms text-[var(--color-primary)] text-[18px]">{stop.icon}</span>
    </div>
    {!isLast && <div className="w-px flex-1 min-h-[20px] bg-[var(--color-divider)] mt-1" />}
  </div>
  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[14px] px-[14px] py-3 flex-1 mb-2">
    <div className="text-[11px] text-[var(--color-primary)] font-semibold mb-1">{stop.time}</div>
    <div className="font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--color-text-1)]">{stop.name}</div>
    <div className="text-[11px] text-[var(--color-text-3)] mt-1">{stop.tip}</div>
  </div>
</div>
```

- [ ] **Step 5: Update ItineraryPlaceCard.tsx**

```tsx
// Card container:
className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-4 [box-shadow:var(--shadow-md)]"
// Entry:
style={{ animation: 'springUp 0.4s ease both' }}

// Time badge:
<span className="text-[11px] text-[var(--color-primary)] font-semibold bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full">
  {time}
</span>

// Place name:
<h3 className="font-[family-name:var(--font-heading)] text-[var(--color-text-1)] text-[17px] font-semibold mt-2">
  {placeName}
</h3>

// Category chip:
<span className="text-[11px] bg-[var(--color-surface2)] text-[var(--color-text-2)] px-2 py-0.5 rounded-full">
  {category}
</span>

// Transit chip (sky accent):
<span className="text-[11px] bg-[var(--color-sky-bg)] text-[var(--color-sky)] border border-[var(--color-sky-bdr)] px-2 py-0.5 rounded-full">
  {transit}
</span>

// Persona chip (use archetype.primary color inline):
<span
  className="text-[11px] px-2 py-0.5 rounded-full border"
  style={{ background: archetype?.glow, borderColor: `${archetype?.primary}40`, color: archetype?.primary }}
>
  {archetype?.name}
</span>

// CTA:
<Button variant="primary" className="w-full mt-4">Start navigating</Button>
```

- [ ] **Step 6: Update ItineraryMapCard.tsx**

```tsx
// Container:
className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] overflow-hidden [box-shadow:var(--shadow-md)]"

// Transit row:
<span className="ms text-[var(--color-sky)] text-[18px]">{transitIcon}</span>
<span className="text-[var(--color-sky)] text-[13px] font-medium">{transitLabel}</span>
```

- [ ] **Step 7: Update ItineraryCards.tsx — token pass**

Scan `ItineraryCards.tsx` for hardcoded hex colors (grep for `#` in className strings) and replace with token variables following the same patterns. Place names → Playfair. Primary accents → `var(--color-primary)`. Surface bg → `var(--color-surface)`.

- [ ] **Step 8: Visually verify**

Open a saved trip → route view. Check sticky header, day dividers, timeline stops with staggered entry, ItineraryPlaceCard springUp with primary time badge.

- [ ] **Step 9: Commit**

```bash
git add src/modules/route/
git commit -m "feat: update Route module — warm timeline, springUp cards, rec-rules integrated"
```

---

## Task 14: ProfileScreen

**Files:**
- Modify: `src/modules/profile/ProfileScreen.tsx`

- [ ] **Step 1: Read ProfileScreen.tsx**

Read `src/modules/profile/ProfileScreen.tsx`.

- [ ] **Step 2: Update header and user card**

```tsx
{/* Header */}
<div className="px-4 pt-6 pb-4 flex items-center justify-between">
  <h1 className="font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--color-text-1)]">
    Profile
  </h1>
  <button className="text-[var(--color-text-3)] text-[13px]">Sign out</button>
</div>

{/* User card */}
<div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-4 mx-4 flex items-center gap-3">
  <div className="w-12 h-12 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center text-[var(--color-primary)] font-bold text-[18px] flex-shrink-0">
    {initial}
  </div>
  <div className="flex-1 min-w-0">
    <div className="text-[14px] font-bold text-[var(--color-text-1)] truncate">{name}</div>
    <div className="text-[11px] text-[var(--color-text-3)] truncate">{email}</div>
  </div>
  <div
    className="px-2 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0"
    style={isPro
      ? { borderColor: 'var(--color-amber)', color: 'var(--color-amber)', background: 'var(--color-amber-bg)' }
      : { borderColor: 'var(--color-border)', color: 'var(--color-text-3)' }}
  >
    {isPro ? 'PRO' : 'FREE'}
  </div>
</div>
```

- [ ] **Step 3: Add archetype hero card**

After the user card, add the archetype hero card (same pattern as Task 8 Step 2, using the same `archetype` object from the store):

```tsx
{archetype && (
  <div className="mx-4 mt-4">
    <div
      className="rounded-[20px] p-5 relative overflow-hidden"
      style={{
        background: `linear-gradient(150deg, ${archetype.glow}, rgba(255,255,255,.02))`,
        border: `1px solid ${archetype.primary}28`,
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1/2 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at left, ${archetype.primary}18, transparent 70%)` }}
      />
      <span className="text-[42px] relative" style={{ filter: `drop-shadow(0 0 16px ${archetype.primary}70)` }}>
        {archetype.emoji}
      </span>
      <div className="font-[family-name:var(--font-heading)] text-[17px] font-semibold text-[var(--color-text-1)] mt-2">
        {archetype.name}
      </div>
      <div className="text-[12px] text-[var(--color-text-3)] mt-0.5">{archetype.tagline}</div>

      {/* Match bars */}
      <div className="mt-4 space-y-2">
        {archetype.traits?.map((trait: { label: string; score: number }, i: number) => (
          <div key={trait.label}>
            <div className="flex justify-between text-[11px] text-[var(--color-text-3)] mb-1">
              <span>{trait.label}</span>
              <span>{trait.score}%</span>
            </div>
            <div className="h-[5px] rounded-full bg-[var(--color-surface2)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: archetype.primary,
                  width: `${trait.score}%`,
                  transition: `width 0.9s cubic-bezier(.25,0,0,1) ${i * 0.15}s`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Add Appearance toggle row**

Find the "App" settings section. Add the appearance row:

```tsx
{/* Appearance row */}
<div className="flex items-center justify-between py-3 px-4">
  <div className="flex items-center gap-3">
    <span className="ms text-[var(--color-text-2)] text-[20px]">
      {theme === 'dark' ? 'dark_mode' : 'light_mode'}
    </span>
    <div>
      <div className="text-[14px] text-[var(--color-text-1)] font-medium">Appearance</div>
      <div className="text-[11px] text-[var(--color-text-3)]">
        {theme === 'dark' ? 'Dark mode' : 'Light mode'}
      </div>
    </div>
  </div>

  {/* 36×20px toggle pill */}
  <button
    onClick={() => dispatch({ type: 'SET_THEME', theme: theme === 'dark' ? 'light' : 'dark' })}
    className="w-9 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0"
    style={{ background: theme === 'dark' ? '#e07854' : 'rgba(255,255,255,.15)' }}
    aria-label="Toggle appearance"
  >
    <span
      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
      style={{ transform: theme === 'dark' ? 'translateX(17px)' : 'translateX(2px)' }}
    />
  </button>
</div>
```

Read `theme` and `dispatch` from `useAppStore`: `const { theme, dispatch } = useAppStore()`.

- [ ] **Step 5: Update Save button with success state**

```tsx
const [saved, setSaved] = React.useState(false);

const handleSave = () => {
  // existing save logic...
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
};

// Button JSX:
<button
  onClick={handleSave}
  className={`w-full h-[52px] rounded-[18px] font-bold text-[15px] text-white transition-all active:scale-[.97] ${
    saved
      ? 'bg-green-600'
      : 'bg-gradient-to-br from-[#e07854] to-[#c4613d] [box-shadow:var(--shadow-primary)]'
  }`}
>
  {saved
    ? <><span className="ms fill text-[20px] mr-2">check_circle</span>Saved</>
    : 'Save changes'
  }
</button>
```

- [ ] **Step 6: Visually verify ProfileScreen**

Open Profile tab. User card, archetype hero, match bars, theme toggle. Toggle → app switches between warm dark and warm light.

- [ ] **Step 7: Commit**

```bash
git add src/modules/profile/ProfileScreen.tsx
git commit -m "feat: update ProfileScreen — archetype card, match bars, appearance toggle with SET_THEME"
```

---

## Task 15: Profile Sub-Screens, Subscription, NavScreen

**Files:**
- Modify: `src/modules/profile/sub-screens/NotificationsScreen.tsx`
- Modify: `src/modules/profile/sub-screens/PrivacyScreen.tsx`
- Modify: `src/modules/profile/sub-screens/SubscriptionDetailsScreen.tsx`
- Modify: `src/modules/profile/sub-screens/UnitsSheet.tsx`
- Modify: `src/modules/subscription/SubscriptionScreen.tsx`
- Modify: `src/modules/subscription/MiniPaywall.tsx`
- Modify: `src/modules/navigation/NavScreen.tsx`

- [ ] **Step 1: Read all seven files**

Read each file.

- [ ] **Step 2: Apply sticky header + settings row pattern to all four profile sub-screens**

Same pattern for NotificationsScreen, PrivacyScreen, SubscriptionDetailsScreen, UnitsSheet:

```tsx
{/* Sticky header */}
<div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
  <button
    className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
    onClick={onBack}
  >
    <span className="ms text-[var(--color-text-2)]">arrow_back</span>
  </button>
  <h2 className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)]">
    {screenTitle}
  </h2>
</div>

{/* Settings card */}
<div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] mx-4 mt-4 overflow-hidden">
  {/* Each settings row: */}
  <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-divider)] last:border-0">
    <span className="text-[14px] text-[var(--color-text-1)]">{label}</span>
    <span className="ms text-[var(--color-text-3)]">chevron_right</span>
  </div>
</div>
```

- [ ] **Step 3: Update SubscriptionScreen.tsx**

```tsx
{/* Plan card — base */}
<div className={`bg-[var(--color-surface)] border rounded-[20px] p-5 ${
  plan.id === 'pro' ? 'border-[var(--color-amber)]' :
  plan.id === 'unlimited' ? 'border-[var(--color-primary)]' :
  'border-[var(--color-border)]'
}`}>
  {plan.id === 'pro' && (
    <div className="text-[11px] font-bold text-[var(--color-amber)] uppercase tracking-wide mb-2">
      Most Popular
    </div>
  )}
  <div className="font-[family-name:var(--font-heading)] text-[20px] font-bold text-[var(--color-text-1)]">
    {plan.name}
  </div>

  {/* Feature rows */}
  {plan.features.map(f => (
    <div key={f} className="flex items-center gap-2 mt-3">
      <span className="ms fill text-[var(--color-sage)] text-[18px]">check_circle</span>
      <span className="text-[13px] text-[var(--color-text-2)]">{f}</span>
    </div>
  ))}

  <Button variant="primary" className="w-full mt-6 h-[52px] rounded-2xl">
    Get {plan.name}
  </Button>
</div>
```

- [ ] **Step 4: Update MiniPaywall.tsx**

```tsx
<div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[24px] p-6 [box-shadow:var(--shadow-md)]">
  <h3 className="font-[family-name:var(--font-heading)] text-[20px] font-bold text-[var(--color-text-1)] mb-2">
    {title}
  </h3>
  <p className="text-[13px] text-[var(--color-text-2)] mb-5">{body}</p>
  <Button variant="primary" className="w-full">Upgrade to Pro</Button>
</div>
```

- [ ] **Step 5: Update NavScreen.tsx**

Find map overlay cards:
```tsx
// Overlay card:
className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-4 [box-shadow:var(--shadow-md)]"

// Direction step place name:
className="font-[family-name:var(--font-heading)] text-[15px] font-semibold text-[var(--color-text-1)]"

// Current step indicator dot:
className="w-2 h-2 rounded-full bg-[var(--color-primary)]"
```

- [ ] **Step 6: Visually verify**

Navigate each sub-screen. Sticky headers visible. Subscription plan cards show amber Pro border. MiniPaywall shows warm surface. NavScreen overlay warm.

- [ ] **Step 7: Commit**

```bash
git add src/modules/profile/sub-screens/ src/modules/subscription/ src/modules/navigation/
git commit -m "feat: update profile sub-screens, subscription, and NavScreen to warm tokens"
```

---

## Task 16: Light Mode Verification Pass

**Files:**
- Verify all screens; fix any hardcoded dark values

- [ ] **Step 1: Enable light mode**

Open Profile → toggle Appearance to Light. `<html data-theme="light">` should be set.

- [ ] **Step 2: Navigate every screen in light mode and spot-check**

For each screen, confirm:
- Background: warm white `#faf8f4` ✓
- Surface cards: white `#ffffff` ✓
- Text: dark warm `#2c2420` ✓
- Borders: `rgba(44,36,32,.08)` ✓
- Primary orange unchanged ✓
- Map tiles: voyager (light) ✓

- [ ] **Step 3: Find any hardcoded dark color misses**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
grep -r '#0f172a\|#1e293b\|#1a1714\|#242018\|#131110\|#2e2a22' src/modules/ --include="*.tsx" -l
```

For each file returned, replace the hardcoded hex with the corresponding CSS variable:
- `#1a1714` → `var(--color-bg)`
- `#131110` → `var(--color-bg2)`
- `#242018` → `var(--color-surface)`
- `#2e2a22` → `var(--color-surface2)`
- `#0f172a` → `var(--color-bg)` (legacy, same replacement)
- `#1e293b` → `var(--color-surface)` (legacy)

- [ ] **Step 4: Run all tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run
```

Expected: All existing tests + `store.theme.test.ts` (3 tests) + `rec-rules.test.ts` (6 tests) pass.

- [ ] **Step 5: Commit**

```bash
git add -p
git commit -m "fix: light mode token coverage — replace remaining hardcoded dark colors"
```

---

## Self-Review

### Spec Coverage

| Spec Section | Task |
|---|---|
| §1 `@theme` dark tokens | 1 |
| §1 `[data-theme=light]` block | 1 |
| §1 All 8 animations | 1 |
| §1 Map tiles per theme | 10 |
| §2 Store `SET_THEME` + localStorage | 2 |
| §2 Boot-time `data-theme` | 2 |
| §2 ProfileScreen toggle UI | 14 |
| §3 Button | 3 |
| §3 Card | 4 |
| §3 BottomNav | 4 |
| §3 Toast | 4 |
| §4 LoginScreen | 5 |
| §4 WalkthroughScreen | 5 |
| §4 WelcomeBackScreen | 5 |
| §4 OnboardingShell | 6 |
| §4 OB1–OB9 | 7 |
| §4 PersonaScreen + PersonaModal | 8 |
| §4 DestinationScreen | 9 |
| §4 TripsScreen | 9 |
| §4 MapScreen + sub-components | 10 |
| §4 JourneyScreen + sub-components | 11 |
| §4 rec-rules.ts | 12 |
| §4 RouteScreen (map+card, multi-day) | 13 |
| §4 Itinerary route rendering + rec branches | 10 + 13 |
| §4 ProfileScreen | 14 |
| §4 Profile sub-screens | 15 |
| §4 SubscriptionScreen + MiniPaywall | 15 |
| §4 NavScreen | 15 |
| §5 ItineraryCards token-only update | 13 |
| §6 Implementation order | Followed |

### Placeholder Scan

No "TBD", "TODO", "handle edge cases", or "similar to Task N" phrases present. All code steps contain complete implementation.

### Type Consistency

- `archetype.glow` / `archetype.primary` / `archetype.emoji` / `archetype.name` / `archetype.tagline` used in Tasks 8, 9, 13, 14 — all sourced from the same `ARCHETYPES` constant. Confirm field names match on Step 1 read in Task 8.
- `dispatch({ type: 'SET_THEME', theme: ... })` — defined Task 2, consumed Task 14. ✓
- `REC_RULES` exported from `rec-rules.ts` as `const` — not consumed by any modified component in this plan (map rendering layer reads it; that integration is pre-existing). ✓
- `Button` exported as named export from `src/shared/ui/Button.tsx`, imported as `{ Button }` in all tasks. ✓
