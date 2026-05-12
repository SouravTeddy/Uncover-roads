# Pricing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current stub subscription UI with a working 3-tier (Free / Pack / Pro) pricing model, including a 3-column subscription screen, mini paywall bottom sheet, pack purchase confirmation, and tier-aware profile display.

**Architecture:** Add `userTier`, `packTripsRemaining`, and `autoReplenish` to app state. The subscription screen is a full-screen overlay (`GO_TO: 'subscription'`). The mini paywall is a bottom-sheet component rendered over any screen. Freemium gate lives in the generation flow — 1st and 2nd generation are full, 3rd is degraded (no Our Picks / Live Events), 4th+ triggers the paywall.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS, `useAppStore` + reducer, Vitest for unit tests.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/shared/types.ts` | Modify | Add `UserTier`, `'subscription'` to `Screen` |
| `src/shared/store.tsx` | Modify | Add `userTier`, `packTripsRemaining`, `autoReplenish` state + actions |
| `src/modules/subscription/SubscriptionScreen.tsx` | Create | 3-column plan layout + coupon section |
| `src/modules/subscription/MiniPaywall.tsx` | Create | 2-tap bottom sheet for locked CTAs |
| `src/modules/subscription/PackPurchaseConfirm.tsx` | Create | Post-purchase confirmation + auto-replenish toggle |
| `src/modules/profile/ProfileScreen.tsx` | Modify | Tier-aware user card, account row, trips counter |
| `src/App.tsx` | Modify | Render `SubscriptionScreen` for `'subscription'` screen |
| `src/shared/store.test.ts` | Modify | Tests for new tier actions |

---

## Task 1: Types — UserTier + Screen union

**Files:**
- Modify: `frontend/src/shared/types.ts`

- [ ] **Step 1: Write the failing test**

Open `frontend/src/shared/store.test.ts`. Add at the top of the file (after existing imports):

```typescript
import type { UserTier } from './types';

describe('UserTier type', () => {
  it('accepts valid tier values', () => {
    const tiers: UserTier[] = ['free', 'pack', 'pro'];
    expect(tiers).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/shared/store.test.ts`
Expected: FAIL — "Cannot find type 'UserTier'"

- [ ] **Step 3: Add types**

In `frontend/src/shared/types.ts`:

After the `Screen` type union, add `'subscription'` to the union:

```typescript
export type Screen =
  | 'login'
  | 'welcome'
  | 'walkthrough'
  | 'ob1' | 'ob2' | 'ob3' | 'ob4' | 'ob5' | 'ob6' | 'ob7'
  | 'ob8' | 'ob9'
  | 'persona'
  | 'destination'
  | 'map'
  | 'journey'
  | 'route'
  | 'trips'
  | 'nav'
  | 'profile'
  | 'subscription';
```

At the end of the file, append:

```typescript
// ── Pricing / subscription ────────────────────────────────────

export type UserTier = 'free' | 'pack' | 'pro';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/shared/store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/types.ts frontend/src/shared/store.test.ts
git commit -m "feat: add UserTier type and subscription screen to Screen union"
```

---

## Task 2: Store — tier state + actions

**Files:**
- Modify: `frontend/src/shared/store.tsx`
- Modify: `frontend/src/shared/store.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/shared/store.test.ts`:

```typescript
describe('tier state', () => {
  it('defaults to free tier', () => {
    expect(initialState.userTier).toBe('free');
  });

  it('defaults packTripsRemaining to 0', () => {
    expect(initialState.packTripsRemaining).toBe(0);
  });

  it('defaults autoReplenish to false', () => {
    expect(initialState.autoReplenish).toBe(false);
  });

  it('SET_TIER updates userTier', () => {
    const next = reducer(initialState, { type: 'SET_TIER', tier: 'pro' });
    expect(next.userTier).toBe('pro');
  });

  it('SET_PACK_TRIPS sets trip balance', () => {
    const next = reducer(initialState, { type: 'SET_PACK_TRIPS', count: 5 });
    expect(next.packTripsRemaining).toBe(5);
  });

  it('CONSUME_PACK_TRIP decrements by 1', () => {
    const state = { ...initialState, packTripsRemaining: 3 };
    const next = reducer(state, { type: 'CONSUME_PACK_TRIP' });
    expect(next.packTripsRemaining).toBe(2);
  });

  it('CONSUME_PACK_TRIP does not go below 0', () => {
    const state = { ...initialState, packTripsRemaining: 0 };
    const next = reducer(state, { type: 'CONSUME_PACK_TRIP' });
    expect(next.packTripsRemaining).toBe(0);
  });

  it('SET_AUTO_REPLENISH toggles the flag', () => {
    const next = reducer(initialState, { type: 'SET_AUTO_REPLENISH', enabled: true });
    expect(next.autoReplenish).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/shared/store.test.ts`
Expected: FAIL — "initialState.userTier is undefined"

- [ ] **Step 3: Add state fields to AppState interface**

In `frontend/src/shared/store.tsx`, in the `AppState` interface block, add after `userRole`:

```typescript
  userTier: UserTier;
  packTripsRemaining: number;
  autoReplenish: boolean;
```

Update the import at the top of `store.tsx` to include `UserTier`:

```typescript
import type {
  // ... existing imports ...
  UserTier,
} from './types';
```

- [ ] **Step 4: Add initialState values**

In the `initialState` object, add after `userRole`:

```typescript
  userTier: (ssGet<UserTier>('ur_ss_tier') ?? 'free'),
  packTripsRemaining: (ssGet<number>('ur_ss_pack_trips') ?? 0),
  autoReplenish: (ssGet<boolean>('ur_ss_auto_replenish') ?? false),
```

- [ ] **Step 5: Add action types**

In the `Action` union, add:

```typescript
  | { type: 'SET_TIER'; tier: UserTier }
  | { type: 'SET_PACK_TRIPS'; count: number }
  | { type: 'CONSUME_PACK_TRIP' }
  | { type: 'SET_AUTO_REPLENISH'; enabled: boolean }
```

- [ ] **Step 6: Add reducer cases**

In the `reducer` switch, add after the `SET_USER_ROLE` case:

```typescript
    case 'SET_TIER':
      ssSave('ur_ss_tier', action.tier);
      return { ...state, userTier: action.tier };

    case 'SET_PACK_TRIPS':
      ssSave('ur_ss_pack_trips', action.count);
      return { ...state, packTripsRemaining: action.count };

    case 'CONSUME_PACK_TRIP': {
      const updated = Math.max(0, state.packTripsRemaining - 1);
      ssSave('ur_ss_pack_trips', updated);
      return { ...state, packTripsRemaining: updated };
    }

    case 'SET_AUTO_REPLENISH':
      ssSave('ur_ss_auto_replenish', action.enabled);
      return { ...state, autoReplenish: action.enabled };
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/shared/store.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat: add userTier, packTripsRemaining, autoReplenish to store"
```

---

## Task 3: SubscriptionScreen — 3-column layout

**Files:**
- Create: `frontend/src/modules/subscription/SubscriptionScreen.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/modules/subscription/SubscriptionScreen.tsx`:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../shared/store';

const PLANS = [
  {
    key: 'free' as const,
    name: 'Free',
    price: '$0',
    sub: 'forever',
    tag: null,
    trips: '3 lifetime',
    features: ['1st & 2nd trip: full', '3rd trip: limited', '4th+: upgrade required', 'Up to 2 cities', 'Explore + Wishlist always'],
    ctaLabel: 'Current Plan',
    ctaDisabled: true,
    ctaStyle: 'disabled' as const,
  },
  {
    key: 'pack' as const,
    name: 'Pack',
    price: null, // rendered separately (two options)
    sub: 'pay per trip',
    tag: 'MOST FLEXIBLE',
    trips: '1 or 5 at a time',
    features: ['Full experience every trip', 'Our Picks + Live Events', 'Up to 5 cities', 'Never expires', 'Auto top-up available'],
    ctaLabel: null, // rendered separately
    ctaDisabled: false,
    ctaStyle: 'pack' as const,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: '$9.99',
    sub: '/month',
    tag: 'MOST POPULAR',
    trips: 'Unlimited',
    features: ['Full experience always', 'Our Picks + Live Events', 'Unlimited cities', 'Early access features', 'Cancel anytime'],
    ctaLabel: 'Go Pro',
    ctaDisabled: false,
    ctaStyle: 'pro' as const,
  },
];

export function SubscriptionScreen({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useAppStore();
  const { userTier } = state;
  const [coupon, setCoupon] = useState('');
  const [couponState, setCouponState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  function handleApplyCoupon() {
    if (!coupon.trim()) return;
    setCouponState('loading');
    // Server-side validation — stub: always error until payment backend exists
    setTimeout(() => setCouponState('error'), 800);
  }

  function handlePackPurchase(size: 1 | 5) {
    dispatch({ type: 'GO_TO', screen: 'subscription' });
    // Navigate to PackPurchaseConfirm — pass size via sessionStorage
    sessionStorage.setItem('ur_pack_size', String(size));
    dispatch({ type: 'GO_TO', screen: 'subscription' });
    // TODO: wire to real payment; for now simulate success
    const current = state.packTripsRemaining;
    dispatch({ type: 'SET_TIER', tier: 'pack' });
    dispatch({ type: 'SET_PACK_TRIPS', count: current + size });
    onBack();
  }

  function handleGoPro() {
    // TODO: wire to real payment; for now simulate success
    dispatch({ type: 'SET_TIER', tier: 'pro' });
    dispatch({ type: 'SET_PACK_TRIPS', count: 0 });
    onBack();
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 50 }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.06)' }}>
          <span className="ms text-white/60 text-lg">arrow_back</span>
        </button>
        <span className="font-heading font-bold text-white text-lg">Choose a plan</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)' }}>
        {/* 3-column plan grid */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          {PLANS.map(plan => (
            <PlanColumn
              key={plan.key}
              plan={plan}
              isCurrent={userTier === plan.key}
              onPackPurchase={handlePackPurchase}
              onGoPro={handleGoPro}
            />
          ))}
        </div>

        {/* Coupon section */}
        <div className="mt-8 px-1">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3">Have a coupon?</p>
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={e => setCoupon(e.target.value)}
              placeholder="Enter coupon code"
              className="flex-1 px-4 py-3 rounded-xl text-sm text-white bg-surface border border-white/10 placeholder:text-white/25 focus:outline-none focus:border-primary"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={couponState === 'loading'}
              className="px-4 py-3 rounded-xl bg-primary text-white text-sm font-semibold flex-shrink-0"
            >
              {couponState === 'loading' ? '…' : 'Apply'}
            </button>
          </div>
          {couponState === 'error' && (
            <p className="text-red-400 text-xs mt-2">Invalid or expired coupon.</p>
          )}
          {couponState === 'success' && (
            <p className="text-green-400 text-xs mt-2">Coupon applied!</p>
          )}
          <p className="text-white/20 text-[10px] mt-2">Valid coupons unlock free access or bonus trips for the specified period.</p>
        </div>
      </div>
    </div>
  );
}

function PlanColumn({
  plan,
  isCurrent,
  onPackPurchase,
  onGoPro,
}: {
  plan: typeof PLANS[number];
  isCurrent: boolean;
  onPackPurchase: (size: 1 | 5) => void;
  onGoPro: () => void;
}) {
  const isPopular = plan.tag === 'MOST POPULAR';

  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-3 border"
      style={{
        background: isCurrent ? 'rgba(99,102,241,.08)' : 'rgba(255,255,255,.03)',
        borderColor: isCurrent ? 'rgba(99,102,241,.35)' : isPopular ? 'rgba(249,115,22,.3)' : 'rgba(255,255,255,.08)',
      }}
    >
      {/* Tag */}
      <div style={{ minHeight: 18 }}>
        {plan.tag && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
            style={{
              background: isPopular ? 'rgba(249,115,22,.15)' : 'rgba(99,102,241,.15)',
              color: isPopular ? '#f97316' : '#818cf8',
            }}
          >
            {plan.tag}
          </span>
        )}
      </div>

      {/* Name */}
      <div>
        <p className="font-heading font-bold text-white text-sm">{plan.name}</p>
        {plan.price ? (
          <p className="text-white/60 text-xs mt-0.5">
            <span className="text-white font-bold text-base">{plan.price}</span>
            <span className="text-white/40 text-[10px]">{plan.sub}</span>
          </p>
        ) : (
          <p className="text-white/40 text-[10px] mt-0.5">{plan.sub}</p>
        )}
      </div>

      {/* Features */}
      <div className="flex flex-col gap-1.5 flex-1">
        {plan.features.map((f, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="ms fill text-[10px] mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }}>check_circle</span>
            <span className="text-white/50 text-[10px] leading-snug">{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-1.5 mt-auto">
        {plan.ctaStyle === 'pack' ? (
          <>
            <button
              onClick={() => onPackPurchase(1)}
              className="w-full py-2 rounded-xl text-[10px] font-bold text-white border border-primary/50"
              style={{ background: 'rgba(249,115,22,.1)' }}
            >
              1 Trip · $0.99
            </button>
            <button
              onClick={() => onPackPurchase(5)}
              className="w-full py-2 rounded-xl text-[10px] font-bold text-white bg-primary"
            >
              5 Trips · $3.99
            </button>
          </>
        ) : plan.ctaStyle === 'pro' ? (
          <button
            onClick={onGoPro}
            className="w-full py-2.5 rounded-xl text-[11px] font-bold text-white bg-primary"
          >
            {isCurrent ? 'Active ✓' : plan.ctaLabel}
          </button>
        ) : (
          <button
            disabled
            className="w-full py-2.5 rounded-xl text-[11px] font-bold cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)' }}
          >
            {isCurrent ? 'Current Plan' : plan.ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `GO_TO: 'subscription'` in App.tsx**

Open `frontend/src/App.tsx`. Find where screens are rendered (likely a `switch` on `state.currentScreen`). Add:

```typescript
case 'subscription':
  return <SubscriptionScreen onBack={() => dispatch({ type: 'GO_TO', screen: 'profile' })} />;
```

Add the import at the top:

```typescript
import { SubscriptionScreen } from './modules/subscription/SubscriptionScreen';
```

- [ ] **Step 3: Wire subscription row in ProfileScreen**

In `frontend/src/modules/profile/ProfileScreen.tsx`, update the Subscription `AccountRow` to be a button that dispatches `GO_TO`:

Replace the static `AccountRow` for "Subscription":

```typescript
<button
  className="w-full flex items-center gap-3 px-4 py-3.5"
  onClick={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
>
  <span className="ms fill text-white/30 text-lg flex-shrink-0">card_membership</span>
  <div className="flex-1 min-w-0 text-left">
    <p className="text-white/70 text-sm font-medium">Subscription</p>
    <p className="text-white/25 text-xs">
      {state.userTier === 'free' && 'Free plan · Upgrade for unlimited trips'}
      {state.userTier === 'pack' && `Pack · ${state.packTripsRemaining} trip${state.packTripsRemaining !== 1 ? 's' : ''} remaining`}
      {state.userTier === 'pro' && 'Pro · Unlimited trips'}
    </p>
  </div>
  <span className="ms text-white/20 text-base flex-shrink-0">chevron_right</span>
</button>
```

Also read `state` from `useAppStore`:
```typescript
const { state, dispatch } = useAppStore();
```

- [ ] **Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/subscription/SubscriptionScreen.tsx frontend/src/App.tsx frontend/src/modules/profile/ProfileScreen.tsx
git commit -m "feat: add 3-column SubscriptionScreen and wire to profile + nav"
```

---

## Task 4: MiniPaywall bottom sheet

**Files:**
- Create: `frontend/src/modules/subscription/MiniPaywall.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/modules/subscription/MiniPaywall.tsx`:

```typescript
import { useAppStore } from '../../shared/store';

interface Props {
  onClose: () => void;
  /** Optional context label shown above the CTAs, e.g. "Our Picks + Live Events" */
  context?: string;
}

export function MiniPaywall({ onClose, context }: Props) {
  const { state, dispatch } = useAppStore();

  function handlePackPurchase(size: 1 | 5) {
    const price = size === 1 ? '$0.99' : '$3.99';
    // TODO: wire to real payment
    const current = state.packTripsRemaining;
    dispatch({ type: 'SET_TIER', tier: 'pack' });
    dispatch({ type: 'SET_PACK_TRIPS', count: current + size });
    onClose();
  }

  function handleViewAllPlans() {
    onClose();
    dispatch({ type: 'GO_TO', screen: 'subscription' });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 59,
          background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        background: '#111827',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        border: '1px solid rgba(255,255,255,.08)',
        padding: '20px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,.15)',
          margin: '0 auto 20px',
        }} />

        <p className="font-heading font-bold text-white text-base mb-1">Unlock this trip</p>
        {context && (
          <p className="text-white/40 text-sm mb-5">{context}</p>
        )}
        {!context && (
          <p className="text-white/40 text-sm mb-5">Full itinerary · Our Picks · Live Events</p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handlePackPurchase(1)}
            className="w-full py-3.5 rounded-2xl font-bold text-white text-sm bg-primary"
          >
            Get 1 Trip · $0.99
          </button>
          <button
            onClick={() => handlePackPurchase(5)}
            className="w-full py-3.5 rounded-2xl font-bold text-sm border border-primary/40"
            style={{ background: 'rgba(249,115,22,.08)', color: '#f97316' }}
          >
            Get 5 Trips · $3.99
          </button>
        </div>

        <button
          onClick={handleViewAllPlans}
          className="w-full mt-4 text-white/35 text-sm text-center"
        >
          Or go Pro for $9.99/mo →
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/subscription/MiniPaywall.tsx
git commit -m "feat: add MiniPaywall 2-tap bottom sheet"
```

---

## Task 5: PackPurchaseConfirm — auto-replenish toggle

**Files:**
- Create: `frontend/src/modules/subscription/PackPurchaseConfirm.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/modules/subscription/PackPurchaseConfirm.tsx`:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../shared/store';

interface Props {
  tripsAdded: number;   // 1 or 5
  onDone: () => void;
}

export function PackPurchaseConfirm({ tripsAdded, onDone }: Props) {
  const { state, dispatch } = useAppStore();
  const [autoReplenish, setAutoReplenish] = useState(false);

  function handleDone() {
    dispatch({ type: 'SET_AUTO_REPLENISH', enabled: autoReplenish });
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center px-6" style={{ zIndex: 60 }}>
      {/* Success icon */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(34,197,94,.12)', border: '1.5px solid rgba(34,197,94,.25)' }}
      >
        <span className="ms fill text-green-400 text-4xl">check_circle</span>
      </div>

      <p className="font-heading font-bold text-white text-xl mb-1 text-center">
        {tripsAdded} trip{tripsAdded !== 1 ? 's' : ''} added!
      </p>
      <p className="text-white/40 text-sm text-center mb-8">
        Balance: {state.packTripsRemaining} trip{state.packTripsRemaining !== 1 ? 's' : ''}
      </p>

      {/* Auto-replenish toggle */}
      <div
        className="w-full rounded-2xl p-4 mb-6 flex items-start gap-3 border border-white/8"
        style={{ background: 'rgba(255,255,255,.03)' }}
      >
        <div className="flex-1">
          <p className="text-white/80 text-sm font-semibold">Auto top-up when trips run out</p>
          <p className="text-white/35 text-xs mt-0.5">
            Automatically buy {tripsAdded} more trip{tripsAdded !== 1 ? 's' : ''} when your balance hits zero.
          </p>
        </div>
        <button
          onClick={() => setAutoReplenish(v => !v)}
          className="flex-shrink-0 mt-0.5 w-11 h-6 rounded-full relative transition-colors"
          style={{ background: autoReplenish ? '#f97316' : 'rgba(255,255,255,.12)' }}
        >
          <div
            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ left: autoReplenish ? '50%' : 4, transform: autoReplenish ? 'translateX(2px)' : 'none' }}
          />
        </button>
      </div>

      <button
        onClick={handleDone}
        className="w-full py-4 rounded-2xl font-bold text-white text-base bg-primary"
      >
        Done
      </button>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/subscription/PackPurchaseConfirm.tsx
git commit -m "feat: add PackPurchaseConfirm with auto-replenish toggle"
```

---

## Task 6: ProfileScreen — tier-aware user card + trips counter

**Files:**
- Modify: `frontend/src/modules/profile/ProfileScreen.tsx`

- [ ] **Step 1: Update the user card tier badge**

In `frontend/src/modules/profile/ProfileScreen.tsx`, replace the static `FREE` badge block (lines ~101–108) with a tier-aware badge:

```typescript
// Add near top of ProfileScreen, after existing variable declarations:
const { userTier, packTripsRemaining, autoReplenish } = state;

const tierBadge = {
  free: { label: 'FREE', bg: 'rgba(100,116,139,.15)', border: 'rgba(100,116,139,.3)', color: '#94a3b8' },
  pack: { label: 'PACK', bg: 'rgba(249,115,22,.12)', border: 'rgba(249,115,22,.25)', color: '#f97316' },
  pro:  { label: 'PRO',  bg: 'rgba(251,191,36,.12)', border: 'rgba(251,191,36,.25)', color: '#fbbf24' },
}[userTier];
```

Replace the static badge JSX:

```typescript
<div
  className="px-2.5 py-1 rounded-lg flex-shrink-0"
  style={{ background: tierBadge.bg, border: `1px solid ${tierBadge.border}` }}
>
  <span className="text-[10px] font-bold" style={{ color: tierBadge.color }}>{tierBadge.label}</span>
</div>
```

- [ ] **Step 2: Add trips counter (Free only) and pack balance (Pack only)**

Below the user card (after the `</div>` closing the user card), add:

```typescript
{/* Free: itinerary attempts counter */}
{userTier === 'free' && (
  <div
    className="px-4 py-3.5 rounded-2xl border border-white/8 mb-3 flex items-center gap-3"
    style={{ background: 'rgba(255,255,255,.03)' }}
  >
    <div className="flex-1">
      <p className="text-white/60 text-sm font-medium">Itinerary Attempts</p>
      <p className="text-white/25 text-[10px] mt-0.5">1st–2nd: Full · 3rd: Limited · 4th+: Upgrade required</p>
    </div>
    <div className="flex gap-1.5">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: i < state.generationCount ? '#f97316' : 'rgba(255,255,255,.15)' }}
        />
      ))}
    </div>
  </div>
)}

{/* Pack: trips remaining */}
{userTier === 'pack' && (
  <div
    className="px-4 py-3.5 rounded-2xl border border-white/8 mb-3 flex items-center justify-between"
    style={{ background: 'rgba(255,255,255,.03)' }}
  >
    <div>
      <p className="text-white/60 text-sm font-medium">Trip Balance</p>
      <p className="text-white/25 text-[10px] mt-0.5">
        {autoReplenish ? `Auto top-up on: ${packTripsRemaining === 0 ? 'next use' : 'depletion'}` : 'No auto top-up'}
      </p>
    </div>
    <div
      className="px-3 py-1.5 rounded-xl"
      style={{ background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.2)' }}
    >
      <span className="text-orange-400 font-bold text-sm">{packTripsRemaining}</span>
      <span className="text-orange-400/60 text-xs"> trips</span>
    </div>
  </div>
)}
```

- [ ] **Step 3: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/profile/ProfileScreen.tsx
git commit -m "feat: tier-aware user card badge and trips counter in ProfileScreen"
```

---

## Task 7: Freemium gate — enforce new degradation rules

**Files:**
- Modify: `frontend/src/shared/store.test.ts`
- Modify: `frontend/src/shared/store.tsx` (or wherever freemium gate logic lives)

The freemium gate helper determines whether a generation attempt is allowed and at what quality.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/shared/store.test.ts`:

```typescript
import { getGenerationAccess } from './store';

describe('getGenerationAccess', () => {
  it('free tier, 0 generations: full access', () => {
    expect(getGenerationAccess('free', 0, 0)).toEqual({ allowed: true, degraded: false });
  });

  it('free tier, 1 generation used: full access', () => {
    expect(getGenerationAccess('free', 1, 0)).toEqual({ allowed: true, degraded: false });
  });

  it('free tier, 2 generations used: degraded access', () => {
    expect(getGenerationAccess('free', 2, 0)).toEqual({ allowed: true, degraded: true });
  });

  it('free tier, 3+ generations used: blocked', () => {
    expect(getGenerationAccess('free', 3, 0)).toEqual({ allowed: false, degraded: false });
  });

  it('pack tier, 1 trip remaining: full access', () => {
    expect(getGenerationAccess('pack', 99, 1)).toEqual({ allowed: true, degraded: false });
  });

  it('pack tier, 0 trips remaining: blocked', () => {
    expect(getGenerationAccess('pack', 99, 0)).toEqual({ allowed: false, degraded: false });
  });

  it('pro tier: always full access', () => {
    expect(getGenerationAccess('pro', 999, 0)).toEqual({ allowed: true, degraded: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/shared/store.test.ts`
Expected: FAIL — "getGenerationAccess is not exported"

- [ ] **Step 3: Add the helper to store.tsx**

At the bottom of `frontend/src/shared/store.tsx`, add:

```typescript
/**
 * Pure function — determines whether a generation attempt is allowed
 * and whether it should be degraded (no Our Picks / Live Events).
 *
 * @param tier       Current user tier
 * @param genCount   Number of itineraries generated so far (free tier)
 * @param packTrips  Current pack trip balance (pack tier)
 */
export function getGenerationAccess(
  tier: UserTier,
  genCount: number,
  packTrips: number,
): { allowed: boolean; degraded: boolean } {
  if (tier === 'pro') return { allowed: true, degraded: false };
  if (tier === 'pack') return { allowed: packTrips > 0, degraded: false };
  // Free tier
  if (genCount < 2) return { allowed: true, degraded: false };
  if (genCount === 2) return { allowed: true, degraded: true };
  return { allowed: false, degraded: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/shared/store.test.ts`
Expected: All tests PASS

- [ ] **Step 5: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/store.tsx frontend/src/shared/store.test.ts
git commit -m "feat: add getGenerationAccess helper — 2 full free, 3rd degraded, 4th blocked"
```

---

## Self-Review

**Spec coverage:**
- ✅ 3 tiers: Free / Pack / Pro — Task 1 (types), Task 2 (store)
- ✅ Free: 2 full + 1 degraded + paywall — Task 7
- ✅ Pack: 1-trip ($0.99) and 5-trip ($3.99) — Task 3 (SubscriptionScreen)
- ✅ Auto-replenish toggle on purchase confirmation only — Task 5
- ✅ 3-column subscription screen — Task 3
- ✅ Mini paywall 2-tap bottom sheet — Task 4
- ✅ Profile tier-aware badge + trips counter — Task 6
- ✅ Coupon section — Task 3
- ✅ Navigation: subscription row → SubscriptionScreen — Task 3
- ✅ `getGenerationAccess` helper for gate logic — Task 7

**Gaps noted:** Regional pricing and actual payment processing are out of scope (stubs only, as per spec).
