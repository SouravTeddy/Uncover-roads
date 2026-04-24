# Profile Tab Redesign — Design Spec
**Date:** 2026-04-24
**App:** Uncover Roads
**Scope:** Profile tab (bottom nav), subscription screen, freemium logic, locked states in itinerary and map

---

## 1. Overview

The Profile tab is redesigned to be a clean, purposeful settings + identity screen. All trip data moves to the Itinerary tab. The Travel Persona display and preference editor are removed and replaced by a single condensed OB redo card. The profile icon moves from the top-right corner of the Explore screen to the bottom nav (already in place).

Community tab remains in bottom nav but is muted (greyed icon, no interaction, no modal).

---

## 2. Profile Screen Layout — Layout A (Flat List)

### 2.1 User Card (top, non-tappable)
- Circular avatar (OAuth image, fallback to first initial)
- Name, email
- Tier badge:
  - Free: grey outline, `FREE` label, no fill
  - Pro: gold gradient fill (`#f59e0b → #fbbf24`), `PRO` label, dark text
  - Unlimited: same gold gradient, `UNLIMITED` label
- Pro/Unlimited only: thin gold gradient ring around avatar

### 2.2 OB Persona Card (tappable)
- Shows current persona emoji + archetype name as teaser
- Subtitle: "Your Travel Persona" (label) + "Retune your persona →" (CTA)
- Border colour:
  - Free: orange (`#f97316`)
  - Pro/Unlimited: gold (`#f59e0b`)
- Tapping launches the full OB flow from step 1
- On completion: new persona saved, card updates
- On abandon mid-flow: previous persona preserved

### 2.3 Itinerary Attempts Counter (Free only)
- Label: "Itinerary Attempts"
- Subtitle: "X of 3 used"
- 3 dot indicators: filled orange = used, grey = remaining
- Legend below: "1st: Full experience · 2nd–3rd: No Our Picks or Live Events · 4th+: Upgrade required"
- Hidden entirely for Pro and Unlimited users

### 2.4 Account Section
**Free users:**
- Row 1: "Upgrade to Pro" — bold, orange "Unlock all →" on right, highlighted background — taps to Subscription screen
- Row 2: "Notifications" — taps to Notifications sub-screen

**Pro/Unlimited users:**
- Row 1: "Pro Plan" / "Unlimited Plan" — shows renewal date as subtitle, "Active" in gold on right with `›` — taps to Subscription Details sub-screen
- Row 2: "Notifications" — taps to Notifications sub-screen

### 2.5 App Section
- **Units** — taps to bottom sheet: km / miles toggle
- **Privacy & Data** — taps to Privacy sub-screen
- **Sign Out** — red text, taps to confirmation dialog → clears session → Login screen

### 2.6 Send Feedback (bottom)
- `✉️ Send Feedback` text link
- Action: `mailto:sourav@uncoverroads.com?subject=Feedback on Uncover Roads`
- Visible for all tiers

---

## 3. Sub-Screens

### 3.1 Notifications
Toggles:
- Trip reminders (day before a saved trip)
- New destination suggestions
- Live event alerts — locked with `🔒` for Free users, tapping opens Subscription screen
- App updates & announcements

### 3.2 Units
Bottom sheet with two options: **km** / **miles**. Persisted to localStorage.

### 3.3 Privacy & Data
- What data we collect (read-only text)
- Export my data — sends export link to registered email
- Delete my account — destructive, requires typed confirmation, clears all data and session

### 3.4 Subscription Details (Pro/Unlimited only)
Full sub-screen reached by tapping the plan row in Account:
- Back nav: `‹ Profile`
- Plan badge (gold gradient)
- Details card: billing cycle, next billing date, amount, status (Active ✓)
- Downgrade to Free — muted text at bottom, requires confirmation dialog

---

## 4. Subscription Screen

Triggered from:
- Free user tapping "Upgrade to Pro" in Profile
- Tapping `🔒` on map layer buttons (Our Picks / Live Events)
- Tapping `🔒` locked cards in itinerary view
- After 3rd itinerary attempt when user tries to generate a 4th

### 4.1 Three-Column Plan Layout

| | Free | Pro | Unlimited |
|---|---|---|---|
| Price | $0 forever | $6.99/mo | $13.99/mo |
| Itinerary attempts | 3 lifetime | 5 saves/month | Endless |
| Our Picks + Live Events | 1st trip only | All trips | Always |
| Cities per trip | 2 max | 5 max | Unlimited |
| After limit | Paywall | Hard stop (no bonus) | N/A |
| Persona | Full | Full | Full |
| Share itinerary | Yes | Yes | Yes |
| Explore + Wishlist | Yes | Yes | Yes |
| Early access | No | No | Yes |

**Note on Pro after 5 saves:** Hard stop — no bonus generations. User must wait for monthly reset or upgrade.

Free column CTA: "Current Plan" (disabled button)
Pro column CTA: "Get Pro" (orange fill)
Unlimited column CTA: "Go Unlimited" (gold gradient fill)
Pro column tagged: "MOST POPULAR" pill

### 4.2 Trip Packs (under Free column only)
Positioned below the Free plan card, not a peer column.

| Pack | Price | Per-trip cost |
|---|---|---|
| 5 Trips 🗺️ | $9.99 | $2.00/trip |
| 10 Trips 🧳 | $17.99 | $1.80/trip |

- 10-trip pack tagged "BEST VALUE"
- 1-year validity from purchase date
- Full experience: Our Picks, Live Events, up to 5 cities
- Hard stop when trips run out — no extensions, no bonus generations
- Stacks with any plan (Pro user can buy a pack if monthly quota is exhausted)
- Per-trip cost shown on each pack to make Pro comparison visible

**Regional pricing:**

| Region | Pro/mo | Unlimited/mo | 5-trip pack | 10-trip pack |
|---|---|---|---|---|
| India / South Asia | ₹149 | ₹349 | ₹299 | ₹549 |
| SE Asia | $2.49 | $4.99 | $3.99 | $6.99 |
| Middle East | $4.99 | $9.99 | $7.99 | $13.99 |
| Europe / Australia | $5.99 | $11.99 | $10.99 | $19.99 |
| USA | $6.99 | $13.99 | $9.99 | $17.99 |

**Conversion nudge:**
After a user's 2nd trip pack purchase, show an inline nudge card:
- "You've spent $X on packs. Pro plan for the same period would've cost $Y — saving you $Z."
- CTA: "Switch to Pro →"
- Nudge is calculated dynamically based on actual spend vs equivalent Pro months

### 4.3 Coupon Section (bottom of subscription screen)
- Text input: "Enter coupon code"
- "Apply" button (orange)
- Coupons can unlock: free tier upgrade for N days, or bonus N trips
- Server-side validation only — client shows success/error state
- Subtitle: "Valid coupons unlock free access or bonus trips for the specified period."

---

## 5. Freemium Logic

### 5.1 Free Tier Itinerary Rules
| Attempt | Experience |
|---|---|
| 1st generation | Full: Our Picks, Live Events, up to 2 cities, shareable |
| 2nd generation | Itinerary only. Our Picks and Live Events locked. Up to 2 cities. Shareable. |
| 3rd generation | Same as 2nd |
| 4th attempt | Paywall — subscription screen shown before generation begins |

### 5.2 Pro Tier Rules
- 5 trip saves per month, resets on billing date
- Full experience on all 5 trips
- After 5 saves: hard stop. No bonus generations.
- Trip pack purchases stack — can use pack trips in the same month

### 5.3 Unlimited Tier Rules
- No cap on trips or cities
- Full experience always
- No trip packs needed (not shown in subscription screen)

### 5.4 Trip Pack Rules
- One-time purchase, 1-year validity from purchase date
- Full experience per trip (Our Picks, Live Events, up to 5 cities)
- Hard stop when trips run out — no grace period
- Available to all tiers including Unlimited (though not shown to Unlimited in subscription screen)

### 5.5 Share Itinerary
- Available to all tiers, all trips, no restriction
- Shareable as a card (image) or link — implementation detail for Itinerary tab spec

### 5.6 Explore + Wishlist (Browse Mode)
- Always available to all users regardless of trip quota
- Destination browsing, city guides, map exploration — no AI generation
- Wishlist pinning — user saves destinations, becomes starting point on next trip generation
- Trip countdown — if trip has dates, home screen shows day-by-day countdown (no AI cost)

---

## 6. Locked State UI

### 6.1 In Itinerary View
When Our Picks or Live Events are locked (free user on 2nd/3rd trip, or Pro after 5 saves):
- Section renders as a locked card — visible but clearly restricted
- Shows: `🔒` icon + section name (greyed)
- Short description of what they're missing
- CTA: "Upgrade to unlock" — taps to subscription screen
- Not hidden — user sees what they're missing

### 6.2 On Map
- Our Picks and Live Events layer buttons are greyed with `🔒` overlay
- Tapping them opens subscription screen directly (no intermediate interstitial)

---

## 7. Bottom Navigation Changes

| Tab | Icon | State |
|---|---|---|
| Explore | explore | Active |
| Itinerary | route | Active |
| Community | diversity_3 | Muted — grey icon, no interaction, no coming soon modal |
| Profile | person | Active — uses existing person icon, top-right icon removed from Explore header |

**Remove:** user profile icon from top-right of Explore/Destination screen header.

---

## 8. Visual Design Tokens

| Element | Free | Pro | Unlimited |
|---|---|---|---|
| Tier badge | Grey outline, no fill | Gold gradient fill | Gold gradient fill |
| Avatar ring | None | Thin gold gradient ring | Thin gold gradient ring |
| OB card border | `#f97316` orange | `#f59e0b` gold | `#f59e0b` gold |
| Subscription row | Orange "Upgrade" CTA | Gold "Active ✓" | Gold "Active ✓" |
| Trip counter | Visible, orange dots | Hidden | Hidden |
| Plan CTA button | Disabled grey | Orange fill | Gold gradient fill |

Background: `#0f172a` · Primary: `#f97316` · Gold: `#f59e0b → #fbbf24` · Card bg: `#1e293b`

---

## 9. Out of Scope (separate specs)

- Itinerary tab redesign (Saved Places, Wishlist, trip history, share card)
- Community tab (muted for now, no implementation)
- Payment provider integration (Stripe, Play Store billing, App Store billing)
- Coupon generation and admin tooling
- Notification delivery infrastructure
