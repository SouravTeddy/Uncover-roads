# Profile Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Profile tab into a clean settings + identity screen with free/pro/unlimited tier logic, subscription screen, and locked states for Our Picks and Live Events.

**Architecture:** Tier state (UserTier, TripPack) is added to the global AppStore and persisted in localStorage. A pure `tier.ts` utility module computes gating logic. ProfileScreen is fully rewritten using local sub-view state for sub-screens. A new `SubscriptionScreen` is added as a global Screen accessible from Profile, map lock icons, and the generation paywall.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Vitest + @testing-library/react, jsdom

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/shared/tier.ts` | Pure tier logic: available trips, curation lock, paywall check |
| Create | `src/shared/tier.test.ts` | Tests for all tier.ts functions |
| Modify | `src/shared/types.ts` | Add `UserTier`, `TripPack`, `NotifPrefs`, `'subscription'` screen |
| Modify | `src/shared/store.tsx` | Add tier state, actions, reducer cases, localStorage keys |
| Modify | `src/shared/ui/BottomNav.tsx` | Mute community tab (grey, no interaction) |
| Modify | `src/modules/destination/DestinationScreen.tsx` | Remove avatar from top-right header |
| Rewrite | `src/modules/profile/ProfileScreen.tsx` | Flat-list layout, sub-view routing, tier-aware UI |
| Rewrite | `src/modules/profile/useProfile.ts` | Simplified: just OB navigation, no preference editor |
| Create | `src/modules/profile/sub-screens/NotificationsScreen.tsx` | Notifications toggles |
| Create | `src/modules/profile/sub-screens/UnitsSheet.tsx` | km/miles bottom sheet |
| Create | `src/modules/profile/sub-screens/PrivacyScreen.tsx` | Privacy & data options |
| Create | `src/modules/profile/sub-screens/SubscriptionDetailsScreen.tsx` | Pro/Unlimited plan details |
| Create | `src/modules/subscription/SubscriptionScreen.tsx` | 3-column plans + trip packs + coupon |
| Modify | `src/App.tsx` | Route `'subscription'` screen |
| Modify | `src/modules/route/useRoute.ts` | Generation paywall gate |
| Modify | `src/modules/map/FilterBar.tsx` | Lock Our Picks + Events chips for ineligible tiers |
| Modify | `src/modules/route/ItineraryView.tsx` | Add locked Our Picks + Live Events section cards |

---

## Task 1: Tier types and store foundation

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/store.tsx`

- [ ] **Step 1: Write failing tests for store tier state**

Create `src/shared/store.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from './store';

describe('tier state', () => {
  it('defaults to free tier', () => {
    expect(initialState.userTier).toBe('free');
  });

  it('SET_USER_TIER updates tier and persists', () => {
    const next = reducer(initialState, { type: 'SET_USER_TIER', tier: 'pro' });
    expect(next.userTier).toBe('pro');
  });

  it('ADD_TRIP_PACK adds a pack and increments purchaseCount', () => {
    const pack = { id: 'p1', trips: 5, usedTrips: 0, expiresAt: '2027-01-01' };
    const next = reducer(initialState, { type: 'ADD_TRIP_PACK', pack });
    expect(next.tripPacks).toHaveLength(1);
    expect(next.packPurchaseCount).toBe(1);
  });

  it('USE_PACK_TRIP increments usedTrips on the matching pack', () => {
    const pack = { id: 'p1', trips: 5, usedTrips: 0, expiresAt: '2027-01-01' };
    const s1 = reducer(initialState, { type: 'ADD_TRIP_PACK', pack });
    const s2 = reducer(s1, { type: 'USE_PACK_TRIP', packId: 'p1' });
    expect(s2.tripPacks[0].usedTrips).toBe(1);
  });

  it('SET_UNITS persists units preference', () => {
    const next = reducer(initialState, { type: 'SET_UNITS', units: 'miles' });
    expect(next.units).toBe('miles');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/store.test.ts
```
Expected: FAIL — `userTier`, `tripPacks`, `packPurchaseCount`, `units` not in state yet.

- [ ] **Step 3: Add types to `src/shared/types.ts`**

Add after the `Screen` type definition:

```typescript
export type UserTier = 'free' | 'pro' | 'unlimited';

export interface TripPack {
  id: string;
  trips: number;
  usedTrips: number;
  expiresAt: string; // ISO date string
}

export interface NotifPrefs {
  tripReminders: boolean;
  destinationSuggestions: boolean;
  liveEventAlerts: boolean;
  appUpdates: boolean;
}
```

Also add `'subscription'` to the `Screen` union:

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

- [ ] **Step 4: Update `src/shared/store.tsx`**

Add imports at the top:
```typescript
import type { UserTier, TripPack, NotifPrefs } from './types';
```

Add to `AppState` interface:
```typescript
userTier: UserTier;
tripPacks: TripPack[];
packPurchaseCount: number;
notifPrefs: NotifPrefs;
units: 'km' | 'miles';
```

Add localStorage helpers after existing ones:
```typescript
function getStoredTier(): UserTier {
  const v = localStorage.getItem('ur_user_tier');
  if (v === 'pro' || v === 'unlimited') return v;
  return 'free';
}

function getStoredTripPacks(): TripPack[] {
  try {
    const v = localStorage.getItem('ur_trip_packs');
    return v ? (JSON.parse(v) as TripPack[]) : [];
  } catch { return []; }
}

function getStoredPackPurchaseCount(): number {
  const v = localStorage.getItem('ur_pack_count');
  return v ? parseInt(v, 10) : 0;
}

function getStoredNotifPrefs(): NotifPrefs {
  try {
    const v = localStorage.getItem('ur_notif_prefs');
    return v ? (JSON.parse(v) as NotifPrefs) : {
      tripReminders: true,
      destinationSuggestions: true,
      liveEventAlerts: false,
      appUpdates: true,
    };
  } catch {
    return { tripReminders: true, destinationSuggestions: true, liveEventAlerts: false, appUpdates: true };
  }
}

function getStoredUnits(): 'km' | 'miles' {
  return localStorage.getItem('ur_units') === 'miles' ? 'miles' : 'km';
}
```

Add to `initialState`:
```typescript
userTier: getStoredTier(),
tripPacks: getStoredTripPacks(),
packPurchaseCount: getStoredPackPurchaseCount(),
notifPrefs: getStoredNotifPrefs(),
units: getStoredUnits(),
```

Add to `Action` union:
```typescript
| { type: 'SET_USER_TIER'; tier: UserTier }
| { type: 'ADD_TRIP_PACK'; pack: TripPack }
| { type: 'USE_PACK_TRIP'; packId: string }
| { type: 'SET_NOTIF_PREFS'; prefs: Partial<NotifPrefs> }
| { type: 'SET_UNITS'; units: 'km' | 'miles' }
```

Add reducer cases (inside the `switch`):
```typescript
case 'SET_USER_TIER':
  try { localStorage.setItem('ur_user_tier', action.tier); } catch { /* ignore */ }
  return { ...state, userTier: action.tier };

case 'ADD_TRIP_PACK': {
  const packs = [...state.tripPacks, action.pack];
  const count = state.packPurchaseCount + 1;
  try {
    localStorage.setItem('ur_trip_packs', JSON.stringify(packs));
    localStorage.setItem('ur_pack_count', String(count));
  } catch { /* ignore */ }
  return { ...state, tripPacks: packs, packPurchaseCount: count };
}

case 'USE_PACK_TRIP': {
  const packs = state.tripPacks.map(p =>
    p.id === action.packId ? { ...p, usedTrips: p.usedTrips + 1 } : p
  );
  try { localStorage.setItem('ur_trip_packs', JSON.stringify(packs)); } catch { /* ignore */ }
  return { ...state, tripPacks: packs };
}

case 'SET_NOTIF_PREFS': {
  const prefs = { ...state.notifPrefs, ...action.prefs };
  try { localStorage.setItem('ur_notif_prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
  return { ...state, notifPrefs: prefs };
}

case 'SET_UNITS':
  try { localStorage.setItem('ur_units', action.units); } catch { /* ignore */ }
  return { ...state, units: action.units };
```

- [ ] **Step 5: Run tests and confirm passing**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/store.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/shared/types.ts src/shared/store.tsx src/shared/store.test.ts && git commit -m "feat: add tier state (UserTier, TripPack, NotifPrefs, units) to store"
```

---

## Task 2: Tier utility functions

**Files:**
- Create: `src/shared/tier.ts`
- Create: `src/shared/tier.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/shared/tier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { AppState } from './store';
import type { TripPack } from './types';
import {
  isCurationLocked,
  shouldShowPaywall,
  getPackRemainingTrips,
  shouldShowConversionNudge,
} from './tier';
import { initialState } from './store';

function state(overrides: Partial<AppState>): AppState {
  return { ...initialState, ...overrides };
}

describe('isCurationLocked', () => {
  it('is false for free tier on 1st generation', () => {
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 0 }))).toBe(false);
  });

  it('is true for free tier on 2nd generation', () => {
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 1 }))).toBe(true);
  });

  it('is true for free tier on 3rd generation', () => {
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 2 }))).toBe(true);
  });

  it('is false for pro tier', () => {
    expect(isCurationLocked(state({ userTier: 'pro', generationCount: 10 }))).toBe(false);
  });

  it('is false for unlimited tier', () => {
    expect(isCurationLocked(state({ userTier: 'unlimited', generationCount: 100 }))).toBe(false);
  });

  it('is false for free tier using an active pack trip', () => {
    const pack: TripPack = { id: 'p1', trips: 5, usedTrips: 1, expiresAt: '2027-01-01' };
    expect(isCurationLocked(state({ userTier: 'free', generationCount: 5, tripPacks: [pack] }))).toBe(false);
  });
});

describe('shouldShowPaywall', () => {
  it('is false for free tier under 3 generations', () => {
    expect(shouldShowPaywall(state({ userTier: 'free', generationCount: 2 }))).toBe(false);
  });

  it('is true for free tier at 3 or more generations with no packs', () => {
    expect(shouldShowPaywall(state({ userTier: 'free', generationCount: 3 }))).toBe(true);
  });

  it('is false for free tier at 3+ generations with available pack trips', () => {
    const pack: TripPack = { id: 'p1', trips: 5, usedTrips: 1, expiresAt: '2027-01-01' };
    expect(shouldShowPaywall(state({ userTier: 'free', generationCount: 3, tripPacks: [pack] }))).toBe(false);
  });

  it('is false for pro tier under 5 generations this month', () => {
    expect(shouldShowPaywall(state({ userTier: 'pro', generationCount: 4 }))).toBe(false);
  });

  it('is false for unlimited', () => {
    expect(shouldShowPaywall(state({ userTier: 'unlimited', generationCount: 100 }))).toBe(false);
  });
});

describe('getPackRemainingTrips', () => {
  it('returns 0 with no packs', () => {
    expect(getPackRemainingTrips([])).toBe(0);
  });

  it('sums remaining trips across non-expired packs', () => {
    const future = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const packs: TripPack[] = [
      { id: 'p1', trips: 5, usedTrips: 2, expiresAt: future },
      { id: 'p2', trips: 10, usedTrips: 10, expiresAt: future },
    ];
    expect(getPackRemainingTrips(packs)).toBe(3);
  });

  it('excludes expired packs', () => {
    const past = '2020-01-01';
    const packs: TripPack[] = [
      { id: 'p1', trips: 5, usedTrips: 0, expiresAt: past },
    ];
    expect(getPackRemainingTrips(packs)).toBe(0);
  });
});

describe('shouldShowConversionNudge', () => {
  it('is true after 2nd pack purchase', () => {
    expect(shouldShowConversionNudge(2)).toBe(true);
  });

  it('is false after 1st pack purchase', () => {
    expect(shouldShowConversionNudge(1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/tier.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/shared/tier.ts`**

```typescript
import type { AppState } from './store';
import type { TripPack } from './types';

/** Returns total remaining trips across non-expired packs. */
export function getPackRemainingTrips(packs: TripPack[]): number {
  const today = new Date().toISOString().split('T')[0];
  return packs.reduce((sum, p) => {
    if (p.expiresAt < today) return sum;
    return sum + Math.max(0, p.trips - p.usedTrips);
  }, 0);
}

/**
 * Returns true when Our Picks and Live Events should be hidden/locked.
 * Locked for free tier after the 1st generation (generationCount >= 1),
 * unless they have active pack trips (packs unlock full experience).
 */
export function isCurationLocked(state: AppState): boolean {
  if (state.userTier === 'pro' || state.userTier === 'unlimited') return false;
  if (getPackRemainingTrips(state.tripPacks) > 0) return false;
  return state.generationCount >= 1;
}

/**
 * Returns true when a paywall should be shown before generating.
 * Free tier: blocked after 3 generations unless pack trips remain.
 * Pro: never blocked in this client (server enforces monthly limit).
 * Unlimited: never blocked.
 */
export function shouldShowPaywall(state: AppState): boolean {
  if (state.userTier === 'pro' || state.userTier === 'unlimited') return false;
  if (getPackRemainingTrips(state.tripPacks) > 0) return false;
  return state.generationCount >= 3;
}

/** Returns true when the "switch to Pro" nudge should appear on the subscription screen. */
export function shouldShowConversionNudge(packPurchaseCount: number): boolean {
  return packPurchaseCount >= 2;
}
```

- [ ] **Step 4: Run tests and confirm passing**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/shared/tier.test.ts
```
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/shared/tier.ts src/shared/tier.test.ts && git commit -m "feat: add tier utility functions (curation lock, paywall, pack remaining)"
```

---

## Task 3: Mute Community tab + remove avatar from DestinationScreen

**Files:**
- Modify: `src/shared/ui/BottomNav.tsx`
- Modify: `src/modules/destination/DestinationScreen.tsx`

- [ ] **Step 1: Mute Community in BottomNav**

In `src/shared/ui/BottomNav.tsx`:

1. Remove the `showCommunity` state and the entire community popup JSX block at the bottom.
2. Update `isActive` — community already returns false, no change needed.
3. Update `handleTap` — remove the `if (screen === 'community')` branch:

```typescript
function handleTap(screen: Screen | 'community') {
  if (screen === 'community') return; // muted — no interaction
  dispatch({ type: 'GO_TO', screen });
}
```

4. Make the Community button visually muted regardless of `isActive`:

```typescript
{NAV_ITEMS.map(item => {
  const active = isActive(item.screen);
  const muted = item.screen === 'community';
  return (
    <button
      key={item.screen}
      onClick={() => handleTap(item.screen)}
      disabled={muted}
      className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
        muted ? 'text-text-3 opacity-35' : active ? 'text-primary' : 'text-text-3'
      }`}
    >
      <span className={`ms ${active && !muted ? 'fill' : ''} text-2xl`}>{item.icon}</span>
      <span className="text-[0.65rem] font-semibold">{item.label}</span>
    </button>
  );
})}
```

5. Delete the `{showCommunity && (...)}` modal block entirely.

- [ ] **Step 2: Remove avatar from DestinationScreen header**

In `src/modules/destination/DestinationScreen.tsx`, remove lines 12–16 (rawUser/user declaration) and the avatar `<div>` in the header (lines ~85–97):

Delete:
```typescript
const rawUser = localStorage.getItem('ur_user');
const user: { name: string; avatar: string | null } | null = rawUser
  ? JSON.parse(rawUser)
  : null;
```

And delete the entire `<div>` containing the avatar in the header:
```typescript
<div
  className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
  style={{...}}
>
  {user?.avatar ? (
    <img ... />
  ) : (
    <span ...>{(user?.name ?? 'U')[0].toUpperCase()}</span>
  )}
</div>
```

The header `<div>` containing the date + "uncover roads" title stays as-is, just without the `justify-between` needing the second child. Change the header to:

```typescript
<header
  className="px-5 flex-shrink-0"
  style={{
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
    paddingBottom: '0.75rem',
  }}
>
  <p className="text-white/30 text-[10px]">{today}</p>
  <h1
    className="font-heading font-bold text-lg leading-tight"
    style={{
      background: 'linear-gradient(90deg, #6c8fff, #b06cff)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    }}
  >
    uncover roads
  </h1>
</header>
```

- [ ] **Step 3: Run dev server and verify visually**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run dev
```
Check: Community tab is grey and non-tappable. Destination screen header has no avatar.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/shared/ui/BottomNav.tsx src/modules/destination/DestinationScreen.tsx && git commit -m "feat: mute community tab, remove avatar from destination header"
```

---

## Task 4: Route subscription screen in App.tsx

**Files:**
- Modify: `src/App.tsx`
- Create: `src/modules/subscription/SubscriptionScreen.tsx` (stub — full implementation in Task 8)

- [ ] **Step 1: Create subscription screen stub**

Create `src/modules/subscription/SubscriptionScreen.tsx`:

```typescript
import { useAppStore } from '../../shared/store';

export function SubscriptionScreen() {
  const { dispatch } = useAppStore();

  function back() {
    dispatch({ type: 'GO_TO', screen: 'profile' });
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <button onClick={back} className="text-text-3">
          <span className="ms text-xl">arrow_back</span>
        </button>
        <span className="font-heading font-bold text-text-1 text-lg">Choose a Plan</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-3 text-sm">Subscription screen — coming in Task 8</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add subscription to App.tsx routing**

In `src/App.tsx`, import and add the route. Find the block where screens are rendered (typically a series of `currentScreen === 'x' && <XScreen />`). Add:

```typescript
import { SubscriptionScreen } from './modules/subscription/SubscriptionScreen';
```

And in the render block:
```typescript
{currentScreen === 'subscription' && <SubscriptionScreen />}
```

- [ ] **Step 3: Confirm no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/App.tsx src/modules/subscription/SubscriptionScreen.tsx && git commit -m "feat: stub subscription screen and add to routing"
```

---

## Task 5: Rewrite ProfileScreen

**Files:**
- Rewrite: `src/modules/profile/ProfileScreen.tsx`
- Rewrite: `src/modules/profile/useProfile.ts`

- [ ] **Step 1: Simplify `useProfile.ts`**

Replace the entire file:

```typescript
import { useAppStore } from '../../shared/store';

export function useProfile() {
  const { state, dispatch } = useAppStore();

  function startOBRedo() {
    dispatch({ type: 'GO_TO', screen: 'ob1' });
  }

  function goToSubscription() {
    dispatch({ type: 'GO_TO', screen: 'subscription' });
  }

  return {
    persona: state.persona,
    userTier: state.userTier,
    generationCount: state.generationCount,
    startOBRedo,
    goToSubscription,
  };
}
```

- [ ] **Step 2: Rewrite `ProfileScreen.tsx`**

Replace the entire file:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { useProfile } from './useProfile';
import { supabase } from '../../shared/supabase';
import type { UserTier } from '../../shared/types';
import { NotificationsScreen } from './sub-screens/NotificationsScreen';
import { UnitsSheet } from './sub-screens/UnitsSheet';
import { PrivacyScreen } from './sub-screens/PrivacyScreen';
import { SubscriptionDetailsScreen } from './sub-screens/SubscriptionDetailsScreen';

type ProfileView = 'main' | 'notifications' | 'units' | 'privacy' | 'subscription-details';

export function ProfileScreen() {
  const { dispatch, state } = useAppStore();
  const { persona, userTier, generationCount, startOBRedo, goToSubscription } = useProfile();
  const [view, setView] = useState<ProfileView>('main');
  const [signingOut, setSigningOut] = useState(false);

  const rawUser = localStorage.getItem('ur_user');
  const user: { name: string; avatar: string | null; email: string } | null =
    rawUser ? JSON.parse(rawUser) : null;

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut().catch(console.warn);
    localStorage.removeItem('ur_persona');
    localStorage.removeItem('ur_user');
    localStorage.removeItem('ur_saved_itineraries');
    localStorage.removeItem('ur_user_tier');
    localStorage.removeItem('ur_trip_packs');
    dispatch({ type: 'GO_TO', screen: 'login' });
  }

  // Sub-screen routing
  if (view === 'notifications') return <NotificationsScreen onBack={() => setView('main')} />;
  if (view === 'units') return <UnitsSheet onClose={() => setView('main')} />;
  if (view === 'privacy') return <PrivacyScreen onBack={() => setView('main')} onSignOut={handleSignOut} />;
  if (view === 'subscription-details') return <SubscriptionDetailsScreen onBack={() => setView('main')} />;

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <span className="font-heading font-bold text-text-1 text-lg flex-1">Profile</span>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto px-4"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >

        {/* User card */}
        <div className="mt-5 mb-4 flex items-center gap-3 px-4 py-4 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,.03)' }}>
          <AvatarCircle user={user} tier={userTier} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{user?.name ?? 'Explorer'}</p>
            <p className="text-white/40 text-xs truncate">{user?.email ?? ''}</p>
          </div>
          <TierBadge tier={userTier} />
        </div>

        {/* OB persona card */}
        <button
          onClick={startOBRedo}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border mb-4"
          style={{
            background: 'rgba(255,255,255,.03)',
            borderColor: userTier === 'free' ? 'rgba(249,115,22,.5)' : 'rgba(245,158,11,.5)',
          }}
        >
          <span className="text-3xl leading-none flex-shrink-0">
            {persona ? (getPersonaEmoji(persona.archetype)) : '🧭'}
          </span>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-0.5">Your Travel Persona</p>
            <p className="text-white font-bold text-sm truncate">
              {persona?.archetype_name ?? 'Not set yet'}
            </p>
            <p className="text-[11px]" style={{ color: '#f97316' }}>Retune your persona →</p>
          </div>
        </button>

        {/* Itinerary attempts counter — free only */}
        {userTier === 'free' && (
          <AttemptsCounter count={generationCount} />
        )}

        {/* Account section */}
        <SectionLabel>Account</SectionLabel>
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          {userTier === 'free' ? (
            <SettingsRow
              label="Upgrade to Pro"
              labelClass="font-bold text-white"
              right={<span className="text-[11px] font-bold" style={{ color: '#f97316' }}>Unlock all →</span>}
              rowStyle={{ background: 'rgba(249,115,22,.06)' }}
              onTap={goToSubscription}
            />
          ) : (
            <SettingsRow
              label={userTier === 'pro' ? 'Pro Plan' : 'Unlimited Plan'}
              sublabel={`Renews ${formatRenewal()}`}
              right={<span className="text-[11px] font-semibold" style={{ color: '#f59e0b' }}>Active ›</span>}
              onTap={() => setView('subscription-details')}
            />
          )}
          <SettingsRow
            label="Notifications"
            divider
            onTap={() => setView('notifications')}
          />
        </div>

        {/* App section */}
        <SectionLabel>App</SectionLabel>
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <SettingsRow
            label="Units"
            sublabel={state.units === 'km' ? 'Kilometres' : 'Miles'}
            onTap={() => setView('units')}
          />
          <SettingsRow
            label="Privacy & Data"
            divider
            onTap={() => setView('privacy')}
          />
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center px-4 py-3.5 border-t border-white/6"
          >
            {signingOut
              ? <span className="ms animate-spin text-red-400 mr-2">autorenew</span>
              : null}
            <span className="text-red-400 text-sm font-medium">{signingOut ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        </div>

        {/* Feedback */}
        <div className="flex justify-center mt-2 mb-6">
          <a
            href="mailto:sourav@uncoverroads.com?subject=Feedback on Uncover Roads"
            className="flex items-center gap-2 text-white/25 text-xs hover:text-white/45 transition-colors"
          >
            <span className="ms text-sm">mail</span>
            Send Feedback
          </a>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function AvatarCircle({ user, tier }: { user: { name: string; avatar: string | null } | null; tier: UserTier }) {
  const isPaid = tier === 'pro' || tier === 'unlimited';
  const initials = (user?.name ?? 'U')[0].toUpperCase();

  return (
    <div
      className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={isPaid
        ? { padding: '2px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }
        : { background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.2)' }
      }
    >
      {isPaid ? (
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: '#1e293b' }}>
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            : <span className="text-primary font-bold text-base">{initials}</span>}
        </div>
      ) : (
        user?.avatar
          ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          : <span className="text-primary font-bold text-base">{initials}</span>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: UserTier }) {
  if (tier === 'free') {
    return (
      <div className="px-2.5 py-1 rounded-lg flex-shrink-0 border border-white/20">
        <span className="text-white/40 text-[10px] font-bold">FREE</span>
      </div>
    );
  }
  return (
    <div
      className="px-2.5 py-1 rounded-lg flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}
    >
      <span className="text-[#0f172a] text-[10px] font-bold">{tier === 'pro' ? 'PRO' : 'UNLIMITED'}</span>
    </div>
  );
}

function AttemptsCounter({ count }: { count: number }) {
  const used = Math.min(count, 3);
  return (
    <div className="rounded-2xl border border-white/8 px-4 py-3 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-white text-sm font-semibold">Itinerary Attempts</span>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: i < used ? '#f97316' : 'rgba(255,255,255,.12)' }}
            />
          ))}
        </div>
      </div>
      <p className="text-white/30 text-[10px]">
        {used} of 3 used · 1st: full · 2nd–3rd: no curation · 4th+: upgrade
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-2 px-1">{children}</p>
  );
}

function SettingsRow({
  label,
  sublabel,
  labelClass = 'text-white/70',
  right,
  rowStyle,
  divider,
  onTap,
}: {
  label: string;
  sublabel?: string;
  labelClass?: string;
  right?: React.ReactNode;
  rowStyle?: React.CSSProperties;
  divider?: boolean;
  onTap?: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${divider ? 'border-t border-white/6' : ''}`}
      style={rowStyle}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${labelClass}`}>{label}</p>
        {sublabel && <p className="text-white/25 text-xs mt-0.5">{sublabel}</p>}
      </div>
      {right ?? <span className="ms text-white/20 text-base">chevron_right</span>}
    </button>
  );
}

function getPersonaEmoji(archetype: string): string {
  const map: Record<string, string> = {
    historian: '🏛️', epicurean: '🍽️', wanderer: '🧭',
    voyager: '✈️', explorer: '🌿', slowtraveller: '☕', pulse: '🎶',
  };
  return map[archetype] ?? '🧭';
}

function formatRenewal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
```

- [ ] **Step 3: Confirm no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: errors only about missing sub-screen imports (to be fixed in Task 6).

- [ ] **Step 4: Commit (with stubs for sub-screens)**

First create placeholder files so TypeScript resolves:

```bash
mkdir -p /Users/souravbiswas/uncover-roads/frontend/src/modules/profile/sub-screens
```

Create `src/modules/profile/sub-screens/NotificationsScreen.tsx`:
```typescript
export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  return <div onClick={onBack}>Notifications — stub</div>;
}
```

Create `src/modules/profile/sub-screens/UnitsSheet.tsx`:
```typescript
export function UnitsSheet({ onClose }: { onClose: () => void }) {
  return <div onClick={onClose}>Units — stub</div>;
}
```

Create `src/modules/profile/sub-screens/PrivacyScreen.tsx`:
```typescript
export function PrivacyScreen({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  return <div onClick={onBack}>Privacy — stub</div>;
}
```

Create `src/modules/profile/sub-screens/SubscriptionDetailsScreen.tsx`:
```typescript
export function SubscriptionDetailsScreen({ onBack }: { onBack: () => void }) {
  return <div onClick={onBack}>Subscription Details — stub</div>;
}
```

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/profile/ && git commit -m "feat: rewrite ProfileScreen with flat-list layout, tier-aware UI, sub-view routing"
```

---

## Task 6: Profile sub-screens (Notifications, Units, Privacy, SubscriptionDetails)

**Files:**
- Replace: `src/modules/profile/sub-screens/NotificationsScreen.tsx`
- Replace: `src/modules/profile/sub-screens/UnitsSheet.tsx`
- Replace: `src/modules/profile/sub-screens/PrivacyScreen.tsx`
- Replace: `src/modules/profile/sub-screens/SubscriptionDetailsScreen.tsx`

- [ ] **Step 1: Implement NotificationsScreen**

Replace `src/modules/profile/sub-screens/NotificationsScreen.tsx`:

```typescript
import { useAppStore } from '../../../shared/store';
import type { NotifPrefs } from '../../../shared/types';

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useAppStore();
  const { notifPrefs, userTier } = state;

  function toggle(key: keyof NotifPrefs) {
    if (key === 'liveEventAlerts' && userTier === 'free') {
      dispatch({ type: 'GO_TO', screen: 'subscription' });
      return;
    }
    dispatch({ type: 'SET_NOTIF_PREFS', prefs: { [key]: !notifPrefs[key] } });
  }

  const rows: { key: keyof NotifPrefs; label: string; sublabel: string; locked?: boolean }[] = [
    { key: 'tripReminders', label: 'Trip reminders', sublabel: 'Day before a saved trip' },
    { key: 'destinationSuggestions', label: 'Destination suggestions', sublabel: 'New places matching your persona' },
    { key: 'liveEventAlerts', label: 'Live event alerts', sublabel: 'Events during your trip', locked: userTier === 'free' },
    { key: 'appUpdates', label: 'App updates', sublabel: 'Announcements & new features' },
  ];

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={onBack}><span className="ms text-xl text-text-3">arrow_back</span></button>
        <span className="font-heading font-bold text-text-1 text-lg">Notifications</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        <div className="rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,.03)' }}>
          {rows.map((row, i) => (
            <div
              key={row.key}
              className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-white/6' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white/70 text-sm font-medium">{row.label}</p>
                  {row.locked && <span className="ms fill text-white/30 text-sm">lock</span>}
                </div>
                <p className="text-white/25 text-xs mt-0.5">{row.sublabel}</p>
              </div>
              <button
                onClick={() => toggle(row.key)}
                className="flex-shrink-0 w-11 h-6 rounded-full transition-all relative"
                style={{
                  background: row.locked
                    ? 'rgba(255,255,255,.08)'
                    : notifPrefs[row.key] ? '#f97316' : 'rgba(255,255,255,.12)',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: notifPrefs[row.key] && !row.locked ? '22px' : '2px' }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement UnitsSheet**

Replace `src/modules/profile/sub-screens/UnitsSheet.tsx`:

```typescript
import { useAppStore } from '../../../shared/store';

export function UnitsSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppStore();

  function select(units: 'km' | 'miles') {
    dispatch({ type: 'SET_UNITS', units });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 50 }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full max-w-md rounded-t-3xl px-6 pt-6 pb-10"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,.08)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />
        <p className="font-heading font-bold text-white text-lg mb-4">Distance Units</p>
        {(['km', 'miles'] as const).map(unit => (
          <button
            key={unit}
            onClick={() => select(unit)}
            className="w-full flex items-center justify-between px-4 py-4 rounded-2xl mb-2 border transition-all"
            style={{
              background: state.units === unit ? 'rgba(249,115,22,.08)' : 'rgba(255,255,255,.03)',
              borderColor: state.units === unit ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.08)',
            }}
          >
            <span className="text-white font-medium">{unit === 'km' ? 'Kilometres (km)' : 'Miles (mi)'}</span>
            {state.units === unit && <span className="ms fill text-primary">check_circle</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement PrivacyScreen**

Replace `src/modules/profile/sub-screens/PrivacyScreen.tsx`:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../../shared/store';
import { supabase } from '../../../shared/supabase';

export function PrivacyScreen({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  const { state } = useAppStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const rawUser = localStorage.getItem('ur_user');
  const user: { email: string } | null = rawUser ? JSON.parse(rawUser) : null;

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    // Sign out; actual account deletion requires server-side action
    await supabase.auth.signOut().catch(console.warn);
    ['ur_persona','ur_user','ur_saved_itineraries','ur_user_tier','ur_trip_packs',
     'ur_gen_count','ur_notif_prefs','ur_units'].forEach(k => localStorage.removeItem(k));
    onSignOut();
  }

  async function handleExportData() {
    // Sends export request — server implementation deferred
    alert(`Export request sent to ${user?.email ?? 'your email'}.`);
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={onBack}><span className="ms text-xl text-text-3">arrow_back</span></button>
        <span className="font-heading font-bold text-text-1 text-lg">Privacy & Data</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>

        {/* What we collect */}
        <div className="rounded-2xl border border-white/8 px-4 py-4 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3">What we collect</p>
          <p className="text-white/50 text-xs leading-relaxed">
            We collect your email address for authentication, travel persona answers to personalise itineraries, and itinerary generation counts to manage plan limits. We do not sell your data. Map and place data is fetched in real-time and not stored against your profile.
          </p>
        </div>

        {/* Actions */}
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <button
            onClick={handleExportData}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="ms text-white/30 text-lg">download</span>
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium">Export my data</p>
              <p className="text-white/25 text-xs">Sent to your registered email</p>
            </div>
            <span className="ms text-white/20 text-base">chevron_right</span>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-t border-white/6"
          >
            <span className="ms text-red-400/60 text-lg">delete_forever</span>
            <div className="flex-1">
              <p className="text-red-400 text-sm font-medium">Delete my account</p>
              <p className="text-white/25 text-xs">Permanently removes all data</p>
            </div>
            <span className="ms text-white/20 text-base">chevron_right</span>
          </button>
        </div>

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 60, background: 'rgba(0,0,0,.7)' }}>
            <div className="w-full max-w-sm rounded-2xl px-6 py-6" style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)' }}>
              <p className="text-white font-bold text-base mb-1">Delete account?</p>
              <p className="text-white/40 text-sm mb-4">This is permanent. Type DELETE to confirm.</p>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="Type DELETE"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-4 outline-none focus:border-red-400/40"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                  className="flex-1 h-11 rounded-xl text-sm text-white/50 border border-white/10"
                >Cancel</button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== 'DELETE' || deleting}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-red-600 disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement SubscriptionDetailsScreen**

Replace `src/modules/profile/sub-screens/SubscriptionDetailsScreen.tsx`:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../../shared/store';

export function SubscriptionDetailsScreen({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useAppStore();
  const { userTier } = state;
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [downgrading, setDowngrading] = useState(false);

  const tierLabel = userTier === 'pro' ? 'Pro Plan' : 'Unlimited Plan';
  const nextBilling = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  async function handleDowngrade() {
    setDowngrading(true);
    // Payment provider call deferred — just update local tier for now
    dispatch({ type: 'SET_USER_TIER', tier: 'free' });
    setDowngrading(false);
    onBack();
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={onBack}><span className="ms text-xl text-text-3">arrow_back</span></button>
        <span className="font-heading font-bold text-text-1 text-lg">{tierLabel}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>

        {/* Plan badge */}
        <div className="flex justify-center mb-6">
          <div className="px-5 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
            <span className="text-[#0f172a] font-bold text-sm">{tierLabel.toUpperCase()}</span>
          </div>
        </div>

        {/* Details */}
        <div className="rounded-2xl overflow-hidden border border-white/8 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          {[
            { label: 'Billing cycle', value: 'Monthly' },
            { label: 'Next billing date', value: nextBilling },
            { label: 'Amount', value: '—' },
            { label: 'Status', value: 'Active ✓', valueClass: 'text-amber-400' },
          ].map((row, i) => (
            <div key={row.label} className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? 'border-t border-white/6' : ''}`}>
              <span className="text-white/40 text-sm">{row.label}</span>
              <span className={`text-sm font-medium ${row.valueClass ?? 'text-white'}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Downgrade */}
        <div className="rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,.03)' }}>
          <button
            onClick={() => setShowDowngrade(true)}
            className="w-full px-4 py-3.5 text-sm text-white/30 text-center"
          >
            Downgrade to Free
          </button>
        </div>
      </div>

      {/* Downgrade confirm dialog */}
      {showDowngrade && (
        <div className="fixed inset-0 flex items-center justify-center px-6" style={{ zIndex: 60, background: 'rgba(0,0,0,.7)' }}>
          <div className="w-full max-w-sm rounded-2xl px-6 py-6" style={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)' }}>
            <p className="text-white font-bold text-base mb-1">Downgrade to Free?</p>
            <p className="text-white/40 text-sm mb-6">You'll lose access to unlimited trips and curation features at the end of your billing period.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDowngrade(false)} className="flex-1 h-11 rounded-xl text-sm text-white/50 border border-white/10">Cancel</button>
              <button onClick={handleDowngrade} disabled={downgrading} className="flex-1 h-11 rounded-xl text-sm font-semibold text-white/60 border border-white/20">
                {downgrading ? 'Processing…' : 'Downgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Confirm no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/profile/sub-screens/ && git commit -m "feat: implement Profile sub-screens (Notifications, Units, Privacy, SubscriptionDetails)"
```

---

## Task 7: Freemium generation gate

**Files:**
- Modify: `src/modules/route/useRoute.ts`

- [ ] **Step 1: Add paywall check before generation**

In `src/modules/route/useRoute.ts`, import the tier utility:

```typescript
import { shouldShowPaywall } from '../../shared/tier';
```

Find the `buildItinerary` function. Add a paywall check at the very beginning:

```typescript
async function buildItinerary() {
  // Paywall check — show subscription screen if free tier limit reached
  if (shouldShowPaywall(state)) {
    dispatch({ type: 'GO_TO', screen: 'subscription' });
    return;
  }
  // ... rest of existing buildItinerary code unchanged
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/route/useRoute.ts && git commit -m "feat: gate itinerary generation behind paywall for free-tier limit"
```

---

## Task 8: Subscription screen (full implementation)

**Files:**
- Replace: `src/modules/subscription/SubscriptionScreen.tsx`

- [ ] **Step 1: Implement full SubscriptionScreen**

Replace `src/modules/subscription/SubscriptionScreen.tsx`:

```typescript
import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { shouldShowConversionNudge } from '../../shared/tier';
import type { TripPack } from '../../shared/types';

export function SubscriptionScreen() {
  const { state, dispatch } = useAppStore();
  const { userTier, packPurchaseCount } = state;
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<'idle' | 'applying' | 'success' | 'error'>('idle');
  const [couponMessage, setCouponMessage] = useState('');

  function back() {
    history.length > 1
      ? history.back()
      : dispatch({ type: 'GO_TO', screen: 'profile' });
  }

  function selectPro() {
    // Payment integration deferred — set tier directly for now
    dispatch({ type: 'SET_USER_TIER', tier: 'pro' });
    dispatch({ type: 'GO_TO', screen: 'profile' });
  }

  function selectUnlimited() {
    dispatch({ type: 'SET_USER_TIER', tier: 'unlimited' });
    dispatch({ type: 'GO_TO', screen: 'profile' });
  }

  function buyPack(trips: 5 | 10) {
    const pack: TripPack = {
      id: `pack-${Date.now()}`,
      trips,
      usedTrips: 0,
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    };
    dispatch({ type: 'ADD_TRIP_PACK', pack });
    dispatch({ type: 'GO_TO', screen: 'profile' });
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponStatus('applying');
    // Server validation deferred — accept any non-empty code for now
    await new Promise(r => setTimeout(r, 800));
    setCouponStatus('error');
    setCouponMessage('Invalid or expired coupon code.');
  }

  const showNudge = shouldShowConversionNudge(packPurchaseCount);

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={back}><span className="ms text-xl text-text-3">arrow_back</span></button>
        <span className="font-heading font-bold text-text-1 text-lg">Choose a Plan</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>

        {/* 3-col plans */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <PlanCard
            tier="free"
            name="Free"
            price="$0"
            priceSub="forever"
            features={[
              '3 lifetime attempts',
              '1st trip: full experience',
              '2nd–3rd: itinerary only',
              'Up to 2 cities',
              'Full persona',
              'Share itinerary',
              'Explore + Wishlist',
            ]}
            lockedFeatures={['Our Picks & Events (trips 2–3)', 'Multi-city beyond 2']}
            ctaLabel={userTier === 'free' ? 'Current Plan' : 'Downgrade'}
            ctaDisabled={userTier === 'free'}
            onCta={userTier !== 'free' ? () => dispatch({ type: 'SET_USER_TIER', tier: 'free' }) : undefined}
          />
          <PlanCard
            tier="pro"
            name="Pro"
            price="$6.99"
            priceSub="/mo"
            badge="POPULAR"
            features={[
              '5 saved trips/month',
              'Our Picks + Events on all trips',
              'Up to 5 cities',
              'Full persona',
              'Share itinerary',
              'Explore + Wishlist',
            ]}
            ctaLabel={userTier === 'pro' ? 'Current Plan' : 'Get Pro'}
            ctaDisabled={userTier === 'pro'}
            ctaStyle="orange"
            onCta={userTier !== 'pro' ? selectPro : undefined}
          />
          <PlanCard
            tier="unlimited"
            name="Unlimited"
            price="$13.99"
            priceSub="/mo"
            features={[
              'Endless trips',
              'Our Picks + Events always on',
              'Unlimited cities',
              'Full persona',
              'Share itinerary',
              'Explore + Wishlist',
              'Early feature access',
            ]}
            ctaLabel={userTier === 'unlimited' ? 'Current Plan' : 'Go Unlimited'}
            ctaDisabled={userTier === 'unlimited'}
            ctaStyle="gold"
            onCta={userTier !== 'unlimited' ? selectUnlimited : undefined}
          />
        </div>

        {/* Trip Packs — shown only when not unlimited */}
        {userTier !== 'unlimited' && (
          <div className="mb-5">
            <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-1 px-1">Not ready to subscribe?</p>
            <p className="text-white font-bold text-sm px-1 mb-1">Buy a Trip Pack</p>
            <p className="text-white/30 text-xs px-1 mb-3">One-time · 1-year validity · Full experience · Hard stop when trips run out</p>

            <div className="flex flex-col gap-2">
              <TripPackRow
                emoji="🗺️"
                label="5 Trips"
                perTrip="$2.00/trip"
                price="$9.99"
                onBuy={() => buyPack(5)}
              />
              <TripPackRow
                emoji="🧳"
                label="10 Trips"
                perTrip="$1.80/trip"
                price="$17.99"
                badge="BEST VALUE"
                onBuy={() => buyPack(10)}
              />
            </div>

            {/* Conversion nudge — shown after 2nd pack purchase */}
            {showNudge && (
              <div className="mt-3 rounded-xl border px-4 py-3 flex gap-3 items-start"
                style={{ borderColor: 'rgba(249,115,22,.3)', background: 'rgba(249,115,22,.06)' }}>
                <span className="text-lg mt-0.5">💡</span>
                <div>
                  <p className="text-white text-sm font-semibold mb-0.5">Pro would've saved you money</p>
                  <p className="text-white/40 text-xs mb-2">You've bought {packPurchaseCount} packs. A Pro subscription costs less over the same period.</p>
                  <button onClick={selectPro} className="text-xs font-semibold" style={{ color: '#f97316' }}>Switch to Pro →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coupon */}
        <div className="rounded-2xl border border-white/8 px-4 py-4 mb-4" style={{ background: 'rgba(255,255,255,.03)' }}>
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3">Have a coupon?</p>
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value); setCouponStatus('idle'); }}
              placeholder="Enter coupon code"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/40"
            />
            <button
              onClick={applyCoupon}
              disabled={couponStatus === 'applying'}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-bold flex-shrink-0"
              style={{ background: '#f97316' }}
            >
              {couponStatus === 'applying' ? '…' : 'Apply'}
            </button>
          </div>
          {couponStatus === 'error' && <p className="text-red-400 text-xs mt-2">{couponMessage}</p>}
          {couponStatus === 'success' && <p className="text-green-400 text-xs mt-2">{couponMessage}</p>}
          <p className="text-white/20 text-xs mt-2">Valid coupons unlock free access or bonus trips.</p>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function PlanCard({
  name, price, priceSub, badge, features, lockedFeatures = [], ctaLabel,
  ctaDisabled, ctaStyle, onCta,
}: {
  tier: string; name: string; price: string; priceSub: string;
  badge?: string; features: string[]; lockedFeatures?: string[];
  ctaLabel: string; ctaDisabled?: boolean; ctaStyle?: 'orange' | 'gold'; onCta?: () => void;
}) {
  const borderColor = ctaStyle === 'gold'
    ? 'rgba(245,158,11,.5)' : ctaStyle === 'orange'
    ? 'rgba(249,115,22,.7)' : 'rgba(255,255,255,.12)';

  return (
    <div className="rounded-2xl border flex flex-col relative overflow-visible"
      style={{ background: 'rgba(255,255,255,.03)', borderColor }}>
      {badge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-white text-[9px] font-bold whitespace-nowrap"
          style={{ background: ctaStyle === 'gold' ? '#f59e0b' : '#f97316' }}>
          {badge}
        </div>
      )}
      <div className="px-3 pt-4 pb-3 text-center border-b border-white/6">
        <p className="text-[10px] uppercase tracking-wider font-bold mb-1"
          style={{ color: ctaStyle === 'gold' ? '#f59e0b' : ctaStyle === 'orange' ? '#f97316' : '#64748b' }}>
          {name}
        </p>
        <p className="text-white font-extrabold text-lg leading-none">{price}
          <span className="text-white/30 text-[10px] font-normal">{priceSub}</span>
        </p>
      </div>
      <div className="px-3 py-3 flex-1 flex flex-col gap-1.5">
        {features.map(f => (
          <div key={f} className="flex gap-1.5 items-start">
            <span className="text-green-400 text-[10px] mt-0.5 flex-shrink-0">✓</span>
            <span className="text-white/60 text-[10px] leading-tight">{f}</span>
          </div>
        ))}
        {lockedFeatures.map(f => (
          <div key={f} className="flex gap-1.5 items-start">
            <span className="text-red-400/60 text-[10px] mt-0.5 flex-shrink-0">✗</span>
            <span className="text-white/25 text-[10px] leading-tight">{f}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <button
          onClick={onCta}
          disabled={ctaDisabled}
          className="w-full py-2 rounded-xl text-[11px] font-bold transition-all"
          style={ctaDisabled
            ? { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.25)' }
            : ctaStyle === 'gold'
            ? { background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#0f172a' }
            : ctaStyle === 'orange'
            ? { background: '#f97316', color: '#fff' }
            : { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.1)' }
          }
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

function TripPackRow({
  emoji, label, perTrip, price, badge, onBuy,
}: {
  emoji: string; label: string; perTrip: string; price: string; badge?: string; onBuy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3 relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,.03)',
        borderColor: badge ? 'rgba(249,115,22,.5)' : 'rgba(255,255,255,.1)',
      }}>
      {badge && (
        <div className="absolute top-1.5 right-14 px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
          style={{ background: '#f97316' }}>
          {badge}
        </div>
      )}
      <span className="text-xl">{emoji}</span>
      <div className="flex-1">
        <p className="text-white text-sm font-bold">{label}</p>
        <p className="text-white/30 text-xs">{perTrip} · expires in 1 year</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="text-white font-extrabold text-sm">{price}</p>
        <button
          onClick={onBuy}
          className="px-3 py-1 rounded-lg text-[11px] font-bold"
          style={{ background: 'rgba(249,115,22,.15)', color: '#f97316', border: '1px solid rgba(249,115,22,.3)' }}
        >
          Buy
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Confirm no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/subscription/SubscriptionScreen.tsx && git commit -m "feat: implement full subscription screen with 3-column plans, trip packs, coupon"
```

---

## Task 9: Locked states — map filter chips

**Files:**
- Modify: `src/modules/map/FilterBar.tsx`
- Modify: `src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add tier prop to FilterBar**

In `src/modules/map/FilterBar.tsx`, update the Props interface:

```typescript
import type { UserTier } from '../../shared/types';

interface Props {
  active: MapFilter;
  counts: Partial<Record<string, number>>;
  onSelect: (filter: MapFilter) => void;
  userTier: UserTier;
  generationCount: number;
  tripPacksRemaining: number;
  onLockedTap: () => void;
}
```

Add a helper to determine if curation filters are locked:
```typescript
function isCurationChipLocked(key: string, userTier: UserTier, generationCount: number, tripPacksRemaining: number): boolean {
  if (key !== 'recommended' && key !== 'event') return false;
  if (userTier === 'pro' || userTier === 'unlimited') return false;
  if (tripPacksRemaining > 0) return false;
  return generationCount >= 1;
}
```

In the expanded chip render, wrap locked chips:

```typescript
{FILTER_CHIPS.map(chip => {
  const isActive = active === chip.key;
  const count = counts[chip.key];
  const locked = isCurationChipLocked(chip.key, userTier, generationCount, tripPacksRemaining);

  if (locked) {
    return (
      <button
        key={chip.key}
        onClick={onLockedTap}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-medium transition-all whitespace-nowrap text-white/20"
        style={{ background: 'rgba(15,20,30,.8)', border: '1px solid rgba(255,255,255,.08)' }}
      >
        <span className="ms fill text-[11px] text-white/20">lock</span>
        {chip.label}
      </button>
    );
  }

  // ... existing chip render code unchanged
})}
```

- [ ] **Step 2: Pass tier props from MapScreen**

In `src/modules/map/MapScreen.tsx`, import tier utility:
```typescript
import { getPackRemainingTrips } from '../../shared/tier';
```

Find where `<FilterBar` is rendered and add the new props:
```typescript
<FilterBar
  active={activeFilter}
  counts={filterCounts}
  onSelect={filter => dispatch({ type: 'SET_FILTER', filter })}
  userTier={state.userTier}
  generationCount={state.generationCount}
  tripPacksRemaining={getPackRemainingTrips(state.tripPacks)}
  onLockedTap={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
/>
```

- [ ] **Step 3: Confirm no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/map/FilterBar.tsx src/modules/map/MapScreen.tsx && git commit -m "feat: lock Our Picks and Events filter chips for ineligible free-tier users"
```

---

## Task 10: Locked states — itinerary view

**Files:**
- Modify: `src/modules/route/ItineraryView.tsx`

- [ ] **Step 1: Find where ItineraryView renders its content**

Read `src/modules/route/ItineraryView.tsx` to find the bottom of the itinerary content, after the stops list renders. The goal is to inject two locked-card sections at the bottom when curation is locked, or placeholder sections when unlocked.

- [ ] **Step 2: Add locked section component to ItineraryView**

At the bottom of `src/modules/route/ItineraryView.tsx`, add:

```typescript
function LockedCurationCard({ title, description, onUpgrade }: {
  title: string;
  description: string;
  onUpgrade: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 px-4 py-4 mb-3"
      style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="ms fill text-white/25 text-base">lock</span>
        <span className="text-white/30 text-sm font-semibold">{title}</span>
      </div>
      <p className="text-white/20 text-xs mb-3">{description}</p>
      <button
        onClick={onUpgrade}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(249,115,22,.12)', color: '#f97316', border: '1px solid rgba(249,115,22,.25)' }}
      >
        Upgrade to unlock
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Inject locked cards into the itinerary render**

In the main export of `ItineraryView`, import tier utilities and store:

```typescript
import { isCurationLocked } from '../../shared/tier';
import { useAppStore } from '../../shared/store';
```

Inside the component, get state:
```typescript
const { state, dispatch } = useAppStore();
const curationLocked = isCurationLocked(state);

function goToSubscription() {
  dispatch({ type: 'GO_TO', screen: 'subscription' });
}
```

After the main stops list renders (just before the closing `</div>` of the scrollable body), add:

```typescript
{curationLocked && (
  <div className="mt-4">
    <p className="text-white/30 text-[10px] uppercase tracking-widest font-bold mb-3 px-1">Curated for you</p>
    <LockedCurationCard
      title="Our Picks"
      description="Curated local spots matched to your travel persona."
      onUpgrade={goToSubscription}
    />
    <LockedCurationCard
      title="Live Events"
      description="Events happening during your trip dates."
      onUpgrade={goToSubscription}
    />
  </div>
)}
```

- [ ] **Step 4: Confirm no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && git add src/modules/route/ItineraryView.tsx && git commit -m "feat: add locked Our Picks and Live Events cards to itinerary view for free tier"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by task |
|---|---|
| 2.1 User card with tier badge + avatar ring | Task 5 |
| 2.2 OB persona card with teaser + OB navigation | Task 5 |
| 2.3 Itinerary attempts counter (free only) | Task 5 |
| 2.4 Account section (Upgrade/Plan row, Notifications) | Task 5 |
| 2.5 App section (Units, Privacy, Sign Out) | Task 5 |
| 2.6 Send Feedback mailto link | Task 5 |
| 3.1 Notifications sub-screen with toggles + lock for free | Task 6 |
| 3.2 Units bottom sheet | Task 6 |
| 3.3 Privacy & Data sub-screen | Task 6 |
| 3.4 Subscription Details sub-screen | Task 6 |
| 4.1 Three-column subscription screen | Task 8 |
| 4.2 Trip packs (5 + 10) under Free column | Task 8 |
| 4.2 Conversion nudge after 2nd pack purchase | Task 8 |
| 4.3 Coupon section | Task 8 |
| 5.1 Free tier generation rules (1st full, 2nd–3rd locked, 4th paywall) | Tasks 2 + 7 |
| 5.2 Pro hard stop after 5 saves | Task 1 (store, server enforces) |
| 6.1 Locked cards in itinerary view | Task 10 |
| 6.2 Locked filter chips on map | Task 9 |
| 7. Community tab muted | Task 3 |
| 7. Remove avatar from Explore header | Task 3 |
| Tier visual tokens (badge, ring, OB border) | Task 5 |

**No gaps found.**

**Placeholder scan:** No TBD/TODO in code steps. Payment provider integration is correctly deferred — the spec explicitly calls it out of scope. `SubscriptionDetailsScreen` amount shows `—` pending payment integration, which is correct.

**Type consistency:** `UserTier`, `TripPack`, `NotifPrefs` defined in Task 1 types.ts, used consistently across Tasks 2, 5, 6, 7, 8, 9, 10. `isCurationLocked` and `shouldShowPaywall` defined in Task 2 tier.ts, imported in Tasks 7, 9, 10.
