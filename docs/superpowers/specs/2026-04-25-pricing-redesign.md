# Pricing Redesign — Design Spec
**Date:** 2026-04-25
**Status:** Approved for implementation
**Supersedes:** Sections 4, 5, 6, 8 (partial) of `2026-04-24-profile-tab-redesign.md`

---

## Overview

Collapse the current 5-option pricing model (Free, Pro, Unlimited + two trip pack sizes listed separately) into 3 clean tiers: **Free**, **Pack**, and **Pro**. Remove the Unlimited tier. Simplify the locked-state logic — partial features exist only for Free tier.

---

## 1. Tier Definitions

### Free
- 3 lifetime itinerary generations
- **1st and 2nd:** Full experience — Our Picks, Live Events, up to 2 cities, shareable
- **3rd:** Degraded — itinerary only, Our Picks and Live Events locked
- **4th+ attempt:** Paywall — subscription screen shown before generation begins
- Explore, Wishlist, Favourites: always available
- No partial features for Pack or Pro — the degradation model is Free-only

### Pack
- Pay per use. Two sizes: **1-trip** and **5-trip**
- No expiry — trips never expire
- Full experience on every trip: Our Picks, Live Events, up to 5 cities, shareable
- Hard stop when trips reach 0 — repurchase prompt immediately
- **Auto-replenish (opt-in):** when trips hit 0, automatically charge the same pack size again. Opted in at purchase. Manageable from Profile → Account row only after purchase (not re-surfaced in subscription screen once active)
- Stacks across time — buying another pack adds to the existing balance

### Pro
- $9.99/mo (regional variants below)
- Unlimited trips, unlimited cities, full experience always
- Monthly subscription, cancellable anytime

---

## 2. Pricing by Region

| Region | 1-Trip | 5-Trip | Pro/mo |
|---|---|---|---|
| USA | $0.99 | $3.99 | $9.99 |
| India / South Asia | ₹39 | ₹189 | ₹499 |
| SE Asia | $0.49 | $1.99 | $4.99 |
| Middle East | $0.79 | $2.99 | $7.99 |
| Europe / Australia | $0.89 | $3.49 | $8.99 |

5-trip pack is always cheaper than 5 × 1-trip. No other pricing tiers or bundles.

---

## 3. Subscription Screen

### 3.1 Layout — Three Columns

| | Free | Pack | Pro |
|---|---|---|---|
| Price | $0 forever | Pay per trip | $9.99/mo |
| Trips | 3 lifetime | 1 or 5 at a time | Unlimited |
| Features | Degraded after 2nd | Full always | Full always |
| Cities per trip | 2 max | 5 max | Unlimited |
| Our Picks + Live Events | 1st & 2nd only | All trips | Always |
| After limit | Paywall | Repurchase prompt | N/A |
| Share itinerary | Yes | Yes | Yes |
| Explore + Wishlist | Yes | Yes | Yes |
| Early access | No | No | Yes |

**Column tags:**
- Free: no tag (current plan if applicable)
- Pack: "MOST FLEXIBLE" pill
- Pro: "MOST POPULAR" pill (orange border)

**CTAs:**
- Free: "Current Plan" (disabled grey) or "Downgrade" (if currently Pack/Pro)
- Pack: two stacked buttons — "Get 1 Trip · $0.99" (outlined) and "Get 5 Trips · $3.99" (filled orange)
- Pro: "Go Pro · $9.99/mo" (filled orange)

### 3.2 Pack Purchase Flow
1. User taps "Get 1 Trip" or "Get 5 Trips"
2. Payment sheet (native IAP or Stripe)
3. On success: confirmation screen showing:
   - "X trip(s) added to your account"
   - Toggle: "Auto top-up when trips run out" (off by default)
   - "Done" CTA
4. Confirmation screen is the **only** place the auto-replenish toggle appears

**1-trip must be purchasable in 2 taps from any paywall.** Do not route through the full subscription screen for a $0.99 purchase — show a mini paywall bottom sheet with both pack options + "Or go Pro" link.

### 3.3 Coupon Section (bottom of subscription screen)
- Text input: "Enter coupon code"
- "Apply" button (orange)
- Can unlock: N free trip credits, N days Pro access
- Server-side validation only — client shows success/error state

---

## 4. Profile Screen Changes

### Free users
- Itinerary attempts counter: "X of 3 used" (3 dot indicators, orange = used)
- Legend: "1st–2nd: Full experience · 3rd: Limited · 4th+: Upgrade required"
- Account row: "Upgrade" → taps to subscription screen

### Pack users
- Replaces attempts counter with: "X trips remaining"
- If auto-replenish on: subtitle "Auto top-up on: [last pack size]" with small toggle to turn off
- Account row: "Pack · X trips left" with `›` → taps to subscription screen (shows repurchase options)

### Pro users
- No counter shown
- Account row: "Pro Plan · Renews [date]" with "Active ✓" in gold and `›` → taps to Subscription Details sub-screen

---

## 5. Locked State UI

### In itinerary view (Free, 3rd trip)
- Our Picks section: locked card visible — `🔒` icon, greyed name, short description of what's missing
- CTA: "Upgrade to unlock" → subscription screen
- Not hidden — user sees what they're missing

### On map (Free, 3rd trip)
- Our Picks and Live Events layer buttons: greyed with `🔒`
- Tapping opens mini paywall bottom sheet (2-tap purchase flow)

### Pack and Pro users
- No locked states anywhere — all layers and sections always visible

---

## 6. Mini Paywall Bottom Sheet

Triggered from any locked CTA for Free users, and from the "Upgrade" prompt after 3rd itinerary.

```
┌────────────────────────────────┐
│  Unlock this trip               │
│  Full itinerary · Our Picks ·  │
│  Live Events                   │
│                                │
│  [Get 1 Trip  ·  $0.99]        │  ← primary
│  [Get 5 Trips ·  $3.99]        │  ← secondary outlined
│                                │
│  Or go Pro for $9.99/mo  →     │  ← text link
└────────────────────────────────┘
```

- Bottom sheet, ~35% screen height
- Dismiss: swipe down or tap outside
- Tapping either pack option goes directly to payment (no intermediate screen)

---

## 7. Freemium Logic Summary

| Attempt | Free | Pack | Pro |
|---|---|---|---|
| Has trips | N/A | Full experience | Full experience |
| 1st | Full | — | — |
| 2nd | Full | — | — |
| 3rd | Degraded | — | — |
| 4th+ | Paywall | — | — |
| After 0 trips | — | Repurchase prompt | — |

---

## 8. Files Affected

**Modified:**
- `src/modules/profile/ProfileScreen.tsx` — updated tier display (Pack trips counter, auto-replenish toggle status)
- `src/shared/types.ts` — update `UserTier` type to `'free' | 'pack' | 'pro'`
- `src/shared/store.tsx` — update tier state, add `packTripsRemaining: number`, `autoReplenish: boolean`

**New:**
- `src/modules/subscription/SubscriptionScreen.tsx` — 3-column layout replacing old screen
- `src/modules/subscription/MiniPaywall.tsx` — 2-tap bottom sheet for locked state CTAs
- `src/modules/subscription/PackPurchaseConfirm.tsx` — post-purchase confirmation with auto-replenish toggle

**Unchanged:**
- `src/modules/profile/ProfileScreen.tsx` structural layout (only content changes)
- Coupon validation logic (server-side unchanged)

---

## 9. Out of Scope

- Payment provider integration (Stripe, App Store, Play Store billing)
- Coupon generation and admin tooling
- Notification delivery for auto-replenish confirmation
