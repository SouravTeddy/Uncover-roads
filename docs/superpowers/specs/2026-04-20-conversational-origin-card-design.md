# Conversational Origin Card — Design Spec

**Date:** 2026-04-20
**Scope:** Trip plan card origin selection (applies to both single-city and multi-city journey flows)

---

## Problem

The current trip plan card asks users to pick a starting point via three chips (Hotel / Airport / Drop pin) before building an itinerary. This assumes users have already decided where they're staying — many haven't. The flow feels like a form, not a travel companion.

---

## Goal

Replace the chip-based origin selection with a conversational experience that:
- Accepts any kind of starting place through a single unified search
- Makes time details (check-in, landing) optional with no friction
- Handles the "haven't decided yet" case gracefully — building a useful itinerary without an origin

---

## Card States

### 1. Opening
- Heading: *"Where are you starting your trip from?"*
- Search bar with placeholder: *"Hotel, airport, anywhere..."*
- Secondary option below: *"Haven't decided yet"* (dashed border, distinct but not deprioritized)
- No chips. No type selection upfront.

### 2. Searching
- As user types, a dropdown appears with matching places from Google Places autocomplete
- Each result shows the place name + a small type badge on the right: `Hotel` · `Airport` · `Street` · `Home`
- Badge is inferred from Google Places `types` array — no manual selection required
- If the type cannot be determined from the `types` array, defaults to `'custom'`
- Existing `placesAutocomplete()` API is used with no type filter (accepts all)

### 3. Place Selected
- Confirms selection: ✓ [Place Name] · [Type]
- Contextual follow-up question adapts by type:
  - Hotel → *"When do you check in?"*
  - Airport → *"When do you land?"*
  - Street / Home / Other → no follow-up (skip)
- Time field is **optional** — CTA is active immediately
- Nudge text below time field: *"You can always come back to fine-tune your plan."*
- CTA: *"Build my itinerary →"*

### 4. Not Decided
- Heading: *"No starting point? No problem."*
- Sub-copy: *"We'll build your plan around the places — just get to the first stop on time."*
- Shows a preview of the first stop with its optimal arrival time
- CTA: *"Build my itinerary →"* — active immediately, no input required

---

## Data Model

No new fields. The existing `OriginPlace` type is unchanged:

```typescript
export interface OriginPlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  originType: OriginType; // 'home' | 'hotel' | 'airport' | 'custom'
  departureTime?: string;
  checkInTime?: string;
  checkOutTime?: string;
  isLongHaul?: boolean;
}
```

**"Not decided" = absence of origin.** No `'none'` variant needed on `OriginType`. When the journey has no origin leg, the narration layer switches to destination-first mode. `buildJourneyLegs()` already handles the no-origin case.

---

## Check-in Logic Constants

The following must be defined as named constants with explanatory comments — not magic numbers:

```typescript
// Threshold after which a hotel check-in is considered "late"
// — used to decide whether to start the itinerary on day 1 or day 2
const LATE_CHECKIN_THRESHOLD_HOUR = 18; // 6:00 PM

// Rest buffer after check-in before the itinerary can begin
// — accounts for settling in, freshening up
const POST_CHECKIN_REST_MINUTES = 45;
```

> **Note:** A simple late-check-in threshold is the baseline. A smarter version of this logic will consider full trip context — e.g. if a night-friendly place exists in the trip and a lighter day is available, the app should schedule the night experience on the light day regardless of check-in time. This scheduling intelligence will be designed separately.

---

## Itinerary Narration Modes

### With Origin
Current behavior applies. Time labels read:
- *"Leave [Place] at [time]"*
- *"Arrive at [Place] by [time]"* (with travel estimate)

### Without Origin ("not decided" mode)
- Itinerary anchors to the first place's optimal arrival time (opening time or before peak crowds)
- Time labels flip to destination-first:
  - *"Be at [Place] by [time]"*
- No travel-time estimates (no starting point to route from)
- A persistent soft nudge appears on the itinerary: *"Add where you're staying to see travel times"* — tappable, reopens the origin card

---

## Copy & Microcopy

All user-facing strings must live in a single constants/strings file — not scattered across components.

| Context | Copy |
|---|---|
| Card heading | "Where are you starting your trip from?" |
| Search placeholder | "Hotel, airport, anywhere..." |
| Hotel follow-up | "When do you check in?" |
| Airport follow-up | "When do you land?" |
| Optional nudge | "You can always come back to fine-tune your plan." |
| Not decided heading | "No starting point? No problem." |
| Not decided sub | "We'll build your plan around the places — just get to the first stop on time." |
| Itinerary nudge | "Add where you're staying to see travel times" |
| CTA | "Build my itinerary →" |

---

## Files Affected

| File | Change |
|---|---|
| `TripPlanningCard.tsx` | Full redesign — replace chips with conversational card states |
| `OriginInputSheet.tsx` | Replaced — renders the same `TripPlanningCard` component (no separate implementation) |
| `journey-legs.ts` | Add named constants for late check-in threshold and rest buffer |
| `types.ts` | No changes |
| `api.ts` | No changes — use existing `placesAutocomplete()` without type filter |
| New: `strings.ts` (or equivalent) | Centralised copy constants |

---

## Out of Scope

- Neighborhood/area suggestions for "not decided" users (future, when data available)
- Smart night-place scheduling based on day density and energy curve (next design cycle)
- Google Hotels / Booking.com shortcut links (dropped)
