# Profile, Monetization & AI Disclaimer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the profile screen, fix the subscription screen, standardise AI content markers to ✦, and add a one-time AI disclaimer bottom sheet before itinerary generation.

**Architecture:** Five independent task groups shipped in order. Each group is a focused set of changes to one module. Tasks 1–2 are bug/polish fixes on existing files. Task 3 adds a new component wired into the existing `handleBuild` flow. Tasks 4–5 are UI rewrites with no new dependencies.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Tailwind CSS utility classes, CSS custom properties from `index.css` (`--color-*`, `--font-*`).

---

## File Map

| File | Change |
|---|---|
| `frontend/src/modules/route/reel/ReelStopCard.tsx` | Replace `schedule` + `check_circle` icons with ✦ on `orderReason` / `orderConsequence` |
| `frontend/src/shared/tier.ts` | Fix `packSpend` helper + `nudgeSavings` clamp |
| `frontend/src/shared/tier.test.ts` | Add tests for pack spend and nudge helpers |
| `frontend/src/modules/subscription/SubscriptionScreen.tsx` | Fix 5 bugs: free copy, nudge math, 10-trip pack, hide free column |
| `frontend/src/modules/map/AiDisclaimerSheet.tsx` | New: one-time bottom sheet component |
| `frontend/src/modules/map/AiDisclaimerSheet.test.tsx` | New: unit tests for disclaimer logic |
| `frontend/src/modules/map/MapScreen.tsx` | Wire disclaimer into `handleBuild` |
| `frontend/src/modules/profile/ProfileScreen.tsx` | Full redesign: trip dots, inline retune, sign-out at bottom, no Save button |

---

## Task 1: Standardise AI icon in ReelStopCard

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx:210-232`

- [ ] **Step 1: Replace `schedule` icon on `orderReason` with ✦**

In `ReelStopCard.tsx`, find the `orderReason` block (lines ~210–215) and change from:
```tsx
{card.orderReason && (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
    <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, marginTop: 1 }}>schedule</span>
    <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{card.orderReason}</p>
  </div>
)}
```
to:
```tsx
{card.orderReason && (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
    <span style={{ fontSize: 13, color: 'var(--color-primary)', flexShrink: 0, lineHeight: 1.55 }}>✦</span>
    <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55, fontStyle: 'italic' }}>{card.orderReason}</p>
  </div>
)}
```

- [ ] **Step 2: Replace `check_circle` icon on `orderConsequence` with ✦**

Find the `orderConsequence` block (lines ~217–222) and change from:
```tsx
{card.orderConsequence && (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
    <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)', flexShrink: 0, marginTop: 1 }}>check_circle</span>
    <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{card.orderConsequence}</p>
  </div>
)}
```
to:
```tsx
{card.orderConsequence && (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
    <span style={{ fontSize: 13, color: 'var(--color-primary)', flexShrink: 0, lineHeight: 1.55 }}>✦</span>
    <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55, fontStyle: 'italic' }}>{card.orderConsequence}</p>
  </div>
)}
```

- [ ] **Step 3: Verify build passes**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "feat: standardise AI text marker to ✦ across all reel stop card lines"
```

---

## Task 2: Fix subscription screen bugs

**Files:**
- Modify: `frontend/src/shared/tier.ts`
- Modify: `frontend/src/shared/tier.test.ts`
- Modify: `frontend/src/modules/subscription/SubscriptionScreen.tsx`

### 2a — Fix pack spend and nudge math in tier.ts

- [ ] **Step 1: Write failing tests**

Add to the bottom of `frontend/src/shared/tier.test.ts`:

```ts
import { computePackSpend, clampedNudgeSavings } from './tier';

describe('computePackSpend', () => {
  it('returns 0 with no packs', () => {
    expect(computePackSpend([])).toBe(0);
  });
  it('prices 5-trip pack at 2.99', () => {
    const pack: TripPack = { id: '1', trips: 5, usedTrips: 0, expiresAt: '2099-01-01' };
    expect(computePackSpend([pack])).toBeCloseTo(2.99);
  });
  it('prices 10-trip pack at 4.99', () => {
    const pack: TripPack = { id: '1', trips: 10, usedTrips: 0, expiresAt: '2099-01-01' };
    expect(computePackSpend([pack])).toBeCloseTo(4.99);
  });
  it('sums multiple packs', () => {
    const packs: TripPack[] = [
      { id: '1', trips: 5, usedTrips: 0, expiresAt: '2099-01-01' },
      { id: '2', trips: 10, usedTrips: 0, expiresAt: '2099-01-01' },
    ];
    expect(computePackSpend(packs)).toBeCloseTo(7.98);
  });
});

describe('clampedNudgeSavings', () => {
  it('returns 0 when pro would cost more', () => {
    expect(clampedNudgeSavings(1, 9.99)).toBe(0);
  });
  it('returns positive savings when packs exceed monthly cost', () => {
    // 4 packs of 5 trips = $11.96 spent; pro at $9.99 would have cost less
    expect(clampedNudgeSavings(11.96, 9.99)).toBeCloseTo(1.97);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx vitest run src/shared/tier.test.ts 2>&1 | tail -15
```
Expected: `computePackSpend is not a function` errors.

- [ ] **Step 3: Add helpers to tier.ts**

At the bottom of `frontend/src/shared/tier.ts`, add:

```ts
const PACK_PRICES: Record<number, number> = { 5: 2.99, 10: 4.99 };

/** Returns total amount spent across all trip packs. */
export function computePackSpend(packs: TripPack[]): number {
  return packs.reduce((sum, p) => sum + (PACK_PRICES[p.trips] ?? 0), 0);
}

/**
 * Returns how much more the user would spend continuing with packs vs switching
 * to a monthly subscription. Clamped to 0 — never negative.
 */
export function clampedNudgeSavings(packSpend: number, monthlyPrice: number): number {
  return Math.max(0, packSpend - monthlyPrice);
}
```

Also add `TripPack` to the import at the top of `tier.ts` if not already imported:
```ts
import type { TripPack } from './types';
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd frontend && npx vitest run src/shared/tier.test.ts 2>&1 | tail -15
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/tier.ts frontend/src/shared/tier.test.ts
git commit -m "feat: add computePackSpend and clampedNudgeSavings helpers to tier"
```

### 2b — Fix SubscriptionScreen

- [ ] **Step 6: Update imports and fix bugs in SubscriptionScreen.tsx**

Replace the top of `SubscriptionScreen.tsx` (lines 1–55) with:

```tsx
import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { shouldShowConversionNudge, computePackSpend, clampedNudgeSavings } from '../../shared/tier';
import { Button } from '../../shared/ui/Button';

function oneYearFromNow(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

export function SubscriptionScreen() {
  const { state, dispatch } = useAppStore();
  const { userTier, tripPacks, packPurchaseCount } = state;

  const [coupon, setCoupon] = useState('');
  const [couponFeedback, setCouponFeedback] = useState('');

  const isPaywalled = userTier === 'free';

  function back() {
    dispatch({ type: 'GO_BACK' });
  }

  function buyPack(trips: number) {
    dispatch({
      type: 'ADD_TRIP_PACK',
      pack: { id: crypto.randomUUID(), trips, usedTrips: 0, expiresAt: oneYearFromNow() },
    });
  }

  function applyCoupon() {
    setCouponFeedback('Coupon validation coming soon.');
  }

  const packSpend = computePackSpend(tripPacks);
  const nudgeSavings = clampedNudgeSavings(packSpend, 9.99);
```

- [ ] **Step 7: Fix free plan features copy**

Find the `features` array for the `free` plan (around line 63–72) and replace:
```tsx
features: [
  '3 lifetime itinerary attempts',
  '1st & 2nd trip: full experience',
  '3rd: itinerary only, curation locked',
  'Up to 2 cities per trip',
  'Full persona experience',
  'Share itinerary',
  'Explore + Wishlist',
],
```
with:
```tsx
features: [
  '3 full trips — no restrictions',
  'Full persona experience',
  'Up to 2 cities per trip',
  'Explore + Wishlist',
  'Share itinerary',
],
```

- [ ] **Step 8: Add 10-trip pack and hide free column from paywalled users**

Find where the pack rows are rendered (search for `buyPack(5)` or `5 Trips`) and replace the entire pack rows block with:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
  <PackRow
    name="5 Trips"
    meta="Full experience · $0.60/trip"
    price="$2.99"
    priceLocal="₹249"
    onBuy={() => buyPack(5)}
  />
  <PackRow
    name="10 Trips"
    meta="Full experience · $0.50/trip · saves 17%"
    price="$4.99"
    priceLocal="₹399"
    badge="BEST VALUE"
    onBuy={() => buyPack(10)}
  />
</div>
```

Then add the `PackRow` sub-component near the bottom of the file (before the final export):

```tsx
function PackRow({
  name, meta, price, priceLocal, badge, onBuy,
}: {
  name: string; meta: string; price: string; priceLocal: string;
  badge?: string; onBuy: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl border"
      style={{
        background: badge ? 'rgba(212,168,83,.05)' : 'var(--color-surface)',
        borderColor: badge ? 'rgba(212,168,83,.3)' : 'var(--color-border)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--color-text-1)]">{name}</span>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-[#0f0d0c]">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-text-3)] mt-0.5">{meta}</div>
      </div>
      <div className="text-right mr-2 flex-shrink-0">
        <div className="text-[13px] font-bold text-[var(--color-text-1)]">{price}</div>
        <div className="text-[10px] text-[var(--color-text-3)]">{priceLocal}</div>
      </div>
      <button
        onClick={onBuy}
        className="h-8 px-3 rounded-xl font-bold text-[12px] text-[#0f0d0c] flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dk))' }}
      >
        Buy
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Hide the Free plan column from paywalled users**

Find where the `plans` array is mapped into columns and wrap the Free plan render in a conditional:

```tsx
{plans.filter(p => !(isPaywalled && p.id === 'free')).map(plan => (
  // ...existing plan card render
))}
```

- [ ] **Step 10: Fix nudge savings display**

Find the nudge savings block (around `nudgeSavings.toFixed(2)`) and replace:
```tsx
you ${nudgeSavings.toFixed(2)}.
```
with:
```tsx
{nudgeSavings > 0
  ? `switching to Pro would save you $${nudgeSavings.toFixed(2)} from here.`
  : 'a monthly subscription gives you unlimited trips for $9.99/mo.'
}
```

- [ ] **Step 11: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: clean build.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/modules/subscription/SubscriptionScreen.tsx
git commit -m "fix: subscription screen — add 10-trip pack, fix nudge math, update free copy, hide free column from paywall"
```

---

## Task 3: AI disclaimer bottom sheet

**Files:**
- Create: `frontend/src/modules/map/AiDisclaimerSheet.tsx`
- Create: `frontend/src/modules/map/AiDisclaimerSheet.test.tsx`
- Modify: `frontend/src/modules/map/MapScreen.tsx`

### 3a — Build the component

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/AiDisclaimerSheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiDisclaimerSheet } from './AiDisclaimerSheet';

const LS_KEY = 'ur_ai_disclaimer_shown';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AiDisclaimerSheet', () => {
  it('renders when disclaimer has not been shown', () => {
    render(<AiDisclaimerSheet onContinue={() => {}} />);
    expect(screen.getByText('A heads up')).toBeDefined();
  });

  it('does not render when disclaimer was already shown', () => {
    localStorage.setItem(LS_KEY, '1');
    const onContinue = vi.fn();
    render(<AiDisclaimerSheet onContinue={onContinue} />);
    // Should auto-call onContinue without rendering sheet
    expect(onContinue).toHaveBeenCalledOnce();
    expect(screen.queryByText('A heads up')).toBeNull();
  });

  it('Continue button is disabled until checkbox is ticked', () => {
    render(<AiDisclaimerSheet onContinue={() => {}} />);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toHaveProperty('disabled', true);
  });

  it('Continue button enables after ticking checkbox', () => {
    render(<AiDisclaimerSheet onContinue={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).toHaveProperty('disabled', false);
  });

  it('persists to localStorage and calls onContinue when submitted', () => {
    const onContinue = vi.fn();
    render(<AiDisclaimerSheet onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(localStorage.getItem(LS_KEY)).toBe('1');
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && npx vitest run src/modules/map/AiDisclaimerSheet.test.tsx 2>&1 | tail -10
```
Expected: `Cannot find module './AiDisclaimerSheet'`.

- [ ] **Step 3: Create the component**

Create `frontend/src/modules/map/AiDisclaimerSheet.tsx`:

```tsx
import { useEffect, useState } from 'react';

const LS_KEY = 'ur_ai_disclaimer_shown';

interface Props {
  onContinue: () => void;
}

export function AiDisclaimerSheet({ onContinue }: Props) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(LS_KEY)) {
      onContinue();
    }
  }, [onContinue]);

  if (localStorage.getItem(LS_KEY)) return null;

  function handleContinue() {
    localStorage.setItem(LS_KEY, '1');
    onContinue();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          width: '100%', background: 'var(--color-surface)',
          borderRadius: '24px 24px 0 0',
          borderTop: '1px solid rgba(212,168,83,.2)',
          padding: '20px 20px 32px',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.12)', margin: '0 auto 20px' }} />

        {/* Title */}
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
          A heads up
        </h2>

        {/* Body */}
        <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.65, marginBottom: 14 }}>
          Some suggestions in your trip are AI-generated.{' '}
          Verify times and prices before heading out.
        </p>

        {/* AI pattern example */}
        <div style={{
          background: 'rgba(212,168,83,.06)', border: '1px solid rgba(212,168,83,.15)',
          borderRadius: 10, padding: '10px 12px', marginBottom: 16,
        }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 8 }}>
            AI content is marked like this
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--color-primary)', flexShrink: 0, lineHeight: 1.6 }}>✦</span>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
              Picked for your love of slow mornings and local markets.
            </p>
          </div>
        </div>

        {/* Checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ display: 'none' }}
          />
          <div style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            border: checked ? 'none' : '1.5px solid rgba(255,255,255,.2)',
            background: checked ? 'var(--color-primary)' : 'rgba(255,255,255,.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
          }}>
            {checked && (
              <span className="ms fill" style={{ fontSize: 14, color: '#0f0d0c', fontVariationSettings: "'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24" }}>
                check
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', lineHeight: 1.5 }}>
            I understand some content is AI-generated and may need verification
          </span>
        </label>

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={!checked}
          style={{
            width: '100%', height: 48, borderRadius: 14,
            background: checked ? 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dk))' : 'rgba(255,255,255,.08)',
            border: 'none',
            fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700,
            color: checked ? '#0f0d0c' : 'rgba(255,255,255,.25)',
            cursor: checked ? 'pointer' : 'not-allowed',
            transition: 'all .2s',
          }}
        >
          Continue
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 10 }}>
          Won't show again after this
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd frontend && npx vitest run src/modules/map/AiDisclaimerSheet.test.tsx 2>&1 | tail -10
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/AiDisclaimerSheet.tsx frontend/src/modules/map/AiDisclaimerSheet.test.tsx
git commit -m "feat: add AiDisclaimerSheet — one-time bottom sheet with checkbox before itinerary build"
```

### 3b — Wire into MapScreen

- [ ] **Step 6: Add disclaimer state and gate handleBuild**

In `frontend/src/modules/map/MapScreen.tsx`:

1. Add import near the top:
```tsx
import { AiDisclaimerSheet } from './AiDisclaimerSheet';
```

2. Add state near the top of the `MapScreen` component function (alongside other `useState` calls):
```tsx
const [showDisclaimer, setShowDisclaimer] = useState(false);
const [pendingBuild, setPendingBuild] = useState(false);
```

3. Replace the existing `handleBuild` function:
```tsx
const handleBuild = useCallback(async () => {
  if (buildLoading || selectedPlaces.length === 0) return;
  if (!localStorage.getItem('ur_ai_disclaimer_shown')) {
    setPendingBuild(true);
    setShowDisclaimer(true);
    return;
  }
  await executeBuild();
}, [buildLoading, selectedPlaces, executeBuild]);
```

4. Extract the existing build logic into a new `executeBuild` callback directly above `handleBuild`:
```tsx
const executeBuild = useCallback(async () => {
  setBuildLoading(true);
  setBuildError(null);
  try {
    const startDate = state.travelStartDate ?? new Date().toISOString().split('T')[0];
    const days = (state.tripContext?.days ?? 0) > 0 ? state.tripContext.days : 1;
    const result = await api.engineItinerary({
      city: city ?? '',
      lat: cityGeo?.lat ?? 0,
      lon: cityGeo?.lon ?? 0,
      days,
      startDate,
      selectedPlaces: selectedPlaces.map(p => ({
        id: p.id,
        place_id: p.place_id,
        title: p.title,
        lat: p.lat,
        lon: p.lon,
        category: p.category,
        rating: p.rating,
        photo_ref: p.photo_ref,
      })),
      personaArchetype: personaProfile?.archetype ?? 'explorer',
      engineWeights: null,
    });
    dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: result });
    dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
  } catch (err) {
    console.error('[MapScreen] handleBuild failed:', err);
    setBuildError('Could not build itinerary — try again');
    setTimeout(() => setBuildError(null), 4000);
  } finally {
    setBuildLoading(false);
  }
}, [buildLoading, selectedPlaces, state, city, cityGeo, personaProfile, dispatch]);
```

5. In the JSX return, add the disclaimer sheet just before the closing `</div>` of the outermost container:
```tsx
{showDisclaimer && (
  <AiDisclaimerSheet
    onContinue={() => {
      setShowDisclaimer(false);
      if (pendingBuild) {
        setPendingBuild(false);
        executeBuild();
      }
    }}
  />
)}
```

- [ ] **Step 7: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: gate itinerary build behind one-time AI disclaimer sheet"
```

---

## Task 4: Profile page redesign

**Files:**
- Modify: `frontend/src/modules/profile/ProfileScreen.tsx`

- [ ] **Step 1: Remove Save button and sign-out from header**

In `ProfileScreen.tsx`:

1. Delete the `saved` state and `handleSave` function entirely.
2. In the header JSX, replace the sign-out button with nothing — the header now only shows "Profile":
```tsx
<div className="px-4 pt-6 pb-4 flex items-center">
  <h1 className="font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--color-text-1)]">
    Profile
  </h1>
</div>
```
3. Delete the entire "Save changes" button block (the `<div className="px-4 mb-4">` containing the `<button>` that calls `handleSave`).

- [ ] **Step 2: Replace AttemptsCounter with inline trip dots on plan row**

Delete the `AttemptsCounter` component entirely.

Delete the block that renders it:
```tsx
{userTier === 'free' && (
  <div className="mx-4 mt-4">
    <AttemptsCounter count={generationCount} />
  </div>
)}
```

Replace the Account section's `SettingsRow` for free users with a new `PlanRow` component. Add this component at the bottom of the file (alongside the other sub-components):

```tsx
function PlanRow({
  userTier,
  generationCount,
  onUpgrade,
  onManage,
}: {
  userTier: string;
  generationCount: number;
  onUpgrade: () => void;
  onManage: () => void;
}) {
  const usedDots = Math.min(generationCount, 3);
  const isPaywalled = userTier === 'free' && generationCount >= 3;

  if (userTier === 'pro') {
    return (
      <button
        onClick={onManage}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'rgba(212,168,83,.25)' }}
      >
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary-bg)' }}>
          <span className="ms" style={{ fontSize: 18, color: 'var(--color-primary)' }}>star</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--color-text-4)] mb-0.5">Your Plan</p>
          <p className="text-[13px] font-semibold text-[var(--color-text-1)]">Pro · Unlimited trips</p>
          <p className="text-[11px] text-[var(--color-text-3)] mt-0.5">{`Renews ${formatRenewal()}`}</p>
        </div>
        <span className="text-[11px] font-bold text-[var(--color-primary)]">Manage →</span>
      </button>
    );
  }

  if (userTier === 'pack') {
    return (
      <button
        onClick={onManage}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary-bg)' }}>
          <span className="ms" style={{ fontSize: 18, color: 'var(--color-primary)' }}>confirmation_number</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--color-text-4)] mb-0.5">Your Plan</p>
          <p className="text-[13px] font-semibold text-[var(--color-text-1)]">Trip Pack</p>
        </div>
        <span className="text-[11px] font-bold text-[var(--color-primary)]">Manage →</span>
      </button>
    );
  }

  // Free tier
  return (
    <button
      onClick={onUpgrade}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border"
      style={{
        background: isPaywalled ? 'rgba(212,168,83,.06)' : 'var(--color-surface)',
        borderColor: isPaywalled ? 'rgba(212,168,83,.35)' : 'var(--color-border)',
      }}
    >
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary-bg)' }}>
        <span className="ms" style={{ fontSize: 18, color: 'var(--color-primary)' }}>auto_awesome</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[var(--color-text-4)] mb-0.5">Your Plan</p>
        <p className="text-[13px] font-semibold text-[var(--color-text-1)]">
          {`Free · ${usedDots} of 3 trips used`}
        </p>
        <div className="flex gap-1 mt-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: i < usedDots ? 'var(--color-primary)' : 'rgba(255,255,255,.12)' }}
            />
          ))}
        </div>
      </div>
      <span className="text-[11px] font-bold text-[var(--color-primary)] flex-shrink-0">Upgrade →</span>
    </button>
  );
}
```

- [ ] **Step 3: Replace Account section with PlanRow**

In the profile body JSX, find the Account section and replace it entirely:

```tsx
{/* Plan row */}
<div className="mx-4 mt-4">
  <PlanRow
    userTier={userTier}
    generationCount={generationCount}
    onUpgrade={goToSubscription}
    onManage={() => setView('subscription-details')}
  />
</div>
```

- [ ] **Step 4: Move archetype retune inline onto the archetype card**

Find the standalone retune button block (the `<button onClick={startOBRedo}>`) and delete it.

Inside the archetype card JSX, add the retune chip directly after `archetypeData.tagline`:
```tsx
<button
  onClick={startOBRedo}
  style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    marginTop: 10, fontSize: 11, fontWeight: 600,
    color: 'var(--color-primary)',
    background: 'var(--color-primary-bg)',
    border: '1px solid rgba(212,168,83,.22)',
    padding: '4px 10px', borderRadius: 99,
  }}
>
  <span className="ms" style={{ fontSize: 13, color: 'var(--color-primary)' }}>tune</span>
  Retune persona
</button>
```

- [ ] **Step 5: Move sign out to bottom of Legal section**

Find the Legal section and add sign out as the last row:
```tsx
<SettingsRow
  label="Send Feedback"
  divider
  onTap={() => window.open('mailto:sourav@uncoverroads.com?subject=Feedback on Uncover Roads', '_blank')}
/>
<SettingsRow
  label="Sign Out"
  labelClass="text-[#f87171]"
  right={signingOut
    ? <span className="text-[11px] text-[var(--color-text-4)]">Signing out…</span>
    : <span className="ms" style={{ fontSize: 18, color: '#f87171' }}>logout</span>
  }
  onTap={handleSignOut}
/>
```

Also delete the old separate Feedback link block at the bottom.

- [ ] **Step 6: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/profile/ProfileScreen.tsx
git commit -m "feat: redesign profile screen — trip dots, inline retune, plan row, sign-out at bottom, no save button"
```

---

## Task 5: Paywall redirect on Build Now

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add paywall check at start of handleBuild**

In `MapScreen.tsx`, import the paywall check at the top:
```tsx
import { shouldShowPaywall } from '../../shared/tier';
```

At the very start of `handleBuild` (before the disclaimer check), add:
```tsx
if (shouldShowPaywall(state)) {
  dispatch({ type: 'GO_TO', screen: 'subscription' });
  return;
}
```

The complete updated `handleBuild` looks like:
```tsx
const handleBuild = useCallback(async () => {
  if (buildLoading || selectedPlaces.length === 0) return;
  if (shouldShowPaywall(state)) {
    dispatch({ type: 'GO_TO', screen: 'subscription' });
    return;
  }
  if (!localStorage.getItem('ur_ai_disclaimer_shown')) {
    setPendingBuild(true);
    setShowDisclaimer(true);
    return;
  }
  await executeBuild();
}, [buildLoading, selectedPlaces, state, dispatch, executeBuild]);
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```
Expected: clean build.

- [ ] **Step 3: Run all tests**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: redirect to subscription screen when free tier paywall triggers on Build Now"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| ✦ for all AI markers in ReelStopCard | Task 1 |
| Fix free plan copy on subscription screen | Task 2b step 7 |
| Fix nudgeSavings math | Task 2a + 2b step 10 |
| Fix pack spend calculation | Task 2a |
| Add 10-trip pack | Task 2b step 8 |
| Hide free column from paywalled users | Task 2b step 9 |
| AI disclaimer one-time bottom sheet | Task 3a |
| Wire disclaimer into Build Now | Task 3b |
| Profile redesign — trip dots, inline retune | Task 4 steps 2–4 |
| Profile — sign out at bottom | Task 4 step 5 |
| Profile — no Save button | Task 4 step 1 |
| Paywall redirect to subscription screen | Task 5 |

All requirements covered. No placeholders. Types are consistent: `UserTier`, `TripPack`, `AppState` are used from their canonical definitions in `types.ts` and `store.tsx` throughout.
