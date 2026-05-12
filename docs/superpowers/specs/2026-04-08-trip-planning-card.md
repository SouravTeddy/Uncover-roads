# Trip Planning Card Design Spec

**Date:** 2026-04-08
**Status:** Approved

---

## Goal

Replace the existing TripSheet bottom sheet with a cinematic floating modal that appears after the user has selected places on the map. Collects only what's needed: starting point and travel date. App auto-calculates the recommended start time.

---

## Trigger

User taps "Plan my trip" after selecting places on the map. The existing TripSheet is removed entirely — this modal is its replacement.

**Precondition:** At least one place must be selected. The "Plan my trip" button should be disabled (or hidden) when no places are selected.

---

## Visual Structure

### Modal Container
- Floats over the map; map stays visible behind it, dimmed with a dark overlay
- `background: linear-gradient(160deg, rgba(30,20,60,.95), rgba(10,18,30,.98))`
- `border: 1px solid rgba(255,255,255,.07)`
- `border-radius: 24px`
- `box-shadow: 0 24px 80px rgba(0,0,0,.8)`
- Centered vertically/horizontally or bottom-anchored with safe area insets

### Cinematic Header
- Height: ~90px
- Background: city/destination image, `opacity: 0.35`, cropped center/cover
- Gradient overlay: `linear-gradient(to bottom, transparent, rgba(20,14,50,.95))`
- Bottom-left: label "Your day in" (small, muted) + destination city name (large, bold, white)
- Top-right: place count badge (e.g., "5 places", small muted text)
- Top-right corner: close (✕) button — pill with blur backdrop

### Fields (inside modal body, padded)

#### 1. Starting Point
- Label: "Starting point" (uppercase, muted, 8px)
- Input: search field — `background: rgba(255,255,255,.05)`, `border-radius: 11px`
- Placeholder: "Search your hotel or address…" with 🏨 icon
- Quick-chip row below input: `🏨 Hotel`, `✈ Airport`, `📍 Pin` — tapping a chip pre-fills the label
- Selecting a result calls the existing Google Places autocomplete + geocode flow (same as city search) to resolve lat/lon for route calculation

#### 2. Travel Date
- Label: "Travel date" (uppercase, muted, 8px)
- Horizontal scrollable strip showing 7 days starting from today
- Each day tile: day-of-week abbreviation (small, muted) + date number (larger, bold)
- Selected tile: `background: rgba(99,102,241,.2)`, `border: 1px solid rgba(99,102,241,.5)`, text in indigo/white
- Unselected tile: `background: rgba(255,255,255,.04)`, muted text
- Default selection: today

#### 3. Recommended Start Time (read-only)
- `background: rgba(99,102,241,.10)`, `border: 1px solid rgba(99,102,241,.25)`, `border-radius: 11px`
- Left: label "⚡ Recommended start" (small, indigo) + time value (large, bold, light indigo e.g., "9:30 AM")
- Right: "Based on N places\n+ opening hours" (small, muted, right-aligned)
- Not tappable / not editable

### CTA
- `background: linear-gradient(135deg, #4f46e5, #7c3aed)`
- `border-radius: 14px`, full-width, `padding: 12px`
- Text: "Build my itinerary ✦", bold, white

---

## Start Time Calculation

Computed on the frontend from the `weekday_text[]` of selected places (already fetched via Google Places and cached).

**Algorithm:**
1. For each selected place that has `weekday_text[]`, parse the opening hour for the selected day-of-week
2. Find the earliest opening hour across all selected places
3. Recommend that time (or 9:00 AM if no opening hour data is available)
4. If the earliest opening hour is before 8:00 AM, floor to 8:00 AM (unreasonably early)
5. Round to the nearest 30 minutes

**Display:** "9:30 AM" — recalculates when the user changes the selected date.

---

## Data Required

| Field | Source |
|---|---|
| City name | Current destination in app state |
| City image | Existing destination photo (already in app state or fetched earlier) |
| Place count | `selectedPlaces.length` from app state |
| Opening hours per place | `details.weekday_text[]` from `usePlaceDetails` cache |
| Hotel/address lat/lon | Google Places geocode (same flow as city search) |
| Selected date | Local state within the modal |

---

## State Shape (passed to itinerary builder)

```ts
interface TripPlanInput {
  startingPoint: {
    name: string;
    lat: number;
    lon: number;
  };
  date: string;         // ISO date string "YYYY-MM-DD"
  recommendedStartTime: string;  // "HH:MM" 24-hour
}
```

---

## Files to Change

| File | Change |
|---|---|
| `frontend/src/modules/trip/TripSheet.tsx` | Remove entirely (or gut and replace with TripPlanningCard) |
| `frontend/src/modules/trip/TripPlanningCard.tsx` | New component per this spec |
| `frontend/src/modules/trip/useTripPlanInput.ts` | New hook: manages hotel search state, date selection, start time calculation |
| `frontend/src/modules/map/MapScreen.tsx` | Replace TripSheet usage with TripPlanningCard |

---

## What Does NOT Change

- Google Places autocomplete flow (reused for hotel search inside the modal)
- `usePlaceDetails` hook and its cache (opening hours already fetched)
- Itinerary builder / route calculation logic (receives `TripPlanInput` instead of old TripSheet output)
- Place selection flow on the map
