# Map & Itinerary Enhancements — Design Spec
_Date: 2026-03-30_

## Overview

Three parallel enhancements to the React frontend:

1. **"Our Picks" recommended places** — backend AI curation per persona
2. **Trip context bottom sheet** — collect travel details before itinerary generation
3. **Smart itinerary display + weather animation** — enriched stops, meal-gap detection, animated weather

---

## Issue 1 — "Our Picks" Recommended Places

### Problem
Tapping "Our Picks" on the map filter bar currently shows all places (same as "All"). No persona-aware filtering is applied.

### Solution
Call a backend endpoint to return a persona-curated shortlist with a reason per place.

### API
```
GET /recommended-places?city=<city>&persona=<JSON-encoded persona>
```
Returns `Place[]` where each place has an additional `reason: string` field (e.g. "Matches your love of history").

### Data model change
```ts
// types.ts — Place gets optional reason
interface Place {
  id: string;
  title: string;
  category: Category;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  imageUrl?: string | null;
  reason?: string;          // ← new, only present on recommended places
}
```

### Frontend flow
1. `useMap` hook exposes a new `loadRecommended()` function.
2. When `activeFilter === 'recommended'` and `recommendedPlaces.length === 0`, call `api.recommended(city, persona)`.
3. Cache results in local state (`recommendedPlaces: Place[]`). Do not dispatch to global store (ephemeral).
4. `filteredPlaces` returns `recommendedPlaces` when filter is `'recommended'`.
5. `PinCard` renders `place.reason` below the title when present — styled as a small teal insight line.
6. Loading state: the existing "Exploring / Loading" live indicator handles it.

### Error handling
If the endpoint fails or returns `[]`, fall back to filtering by `persona.venue_filters` categories client-side and show places without a `reason`.

---

## Issue 2 — Trip Context Bottom Sheet

### Problem
`TripContext` fields (travel date, starting point, arrival time, days) are never collected — all values are defaults. The AI itinerary endpoint receives this stub context and cannot make time-aware or jet-lag-aware recommendations.

### Solution
A `TripSheet` bottom-sheet component slides up after the user taps "Create Itinerary" on the map. It collects the four key fields, dispatches `SET_TRIP_CONTEXT`, then navigates to `'route'`.

### Screen flow change
```
Map → [tap Create Itinerary] → TripSheet (bottom sheet overlay on map) → Route
```
No new `Screen` value needed — `TripSheet` is rendered as an overlay within `MapScreen` controlled by local state (`showTripSheet: boolean`).

### Fields collected

| Field | UI | Condition |
|---|---|---|
| Travel date | Native `<input type="date">` styled as a chip row | Always shown |
| Starting point | 4 icon chips: Hotel / Airport / Station / Airbnb | Always shown |
| Arrival time | `<input type="time">` | Only if Airport or Station selected |
| Number of days | Stepper (1–14) | Always shown |
| Day number | Stepper (1–N, max = days) | Always shown |

### Dispatch
On "Generate →":
```ts
dispatch({ type: 'SET_TRIP_CONTEXT', ctx: { date, startType, arrivalTime, days, dayNumber } });
dispatch({ type: 'GO_TO', screen: 'route' });
```

### UX
- Sheet slides up with a drag handle. Tapping the backdrop dismisses without navigating.
- "Generate →" is disabled until date and startType are set.
- Default values pre-fill from existing `tripContext` state so returning users don't re-enter everything.

---

## Issue 3 — Smart Itinerary Display + Weather Animation

### 3a — Enriched Stop Display

#### Problem
`tip` field from the AI is rendered as a small grey clamped string. The reasoning behind each stop is not prominent enough. Meal gaps are not detected or surfaced.

#### Solution

**Stop tip styling:** Render `stop.tip` as a styled "insight block" — a left-bordered teal/blue callout box below the stop title, not line-clamped. If tip is absent, show nothing.

**Meal gap detection:** After rendering all stops, run a pass. `ItineraryStop` has no `category` field, so food stops are identified by matching `stop.place` against the `selectedPlaces` array (which has `category`), with a keyword fallback (place name contains "restaurant", "café", "lunch", "dinner", "eat", "food", "bistro", "pub", "bar"):

```ts
function detectMealGaps(
  stops: ItineraryStop[],
  selectedPlaces: Place[],
  startMins: number
): MealGap[] {
  // Build timeline of (startMin, endMin, isFoodStop) for each stop
  // isFoodStop = matched selectedPlace.category is 'restaurant'|'cafe'
  //              OR stop.place name matches food keywords
  // Check windows:
  //   Lunch:  12:00–14:00 (720–840 mins from midnight)
  //   Dinner: 18:30–20:30 (1110–1230 mins from midnight)
  // Return gap label for each window with no food stop
}
```

Each detected gap renders a `MealGapCard` inline at the appropriate timeslot:
```
┌─────────────────────────────────────┐
│ 🍽  No lunch stop planned           │
│  Add a restaurant to your route?    │
│  [← Back to map]                    │
└─────────────────────────────────────┘
```

Tapping "Back to map" dispatches `GO_TO: 'map'` with `activeFilter` set to `'restaurant'`.

### 3b — Weather Animation

#### Problem
The weather gradient in `RouteScreen` is a static placeholder with no animation.

#### Solution
Replace the gradient div with a `WeatherCanvas` component that reads `weather.condition` and renders a CSS keyframe animation.

**Condition mapping:**

| Condition keywords | Animation |
|---|---|
| sunny, clear, fair | Warm amber radial pulse — slow-expanding ring, 4s loop |
| rain, drizzle, shower | 12 falling blue `::before` pseudo-elements, staggered delays, top→bottom, 1.5s loop |
| cloud, overcast, fog, mist | Slow horizontal grey gradient drift, 8s loop |
| snow | White falling dots, 3s loop |
| thunder, storm | Fast blue flicker + rain |
| (fallback) | Existing static blue gradient — no animation |

The component is purely decorative (`pointer-events: none`, `aria-hidden`). It covers the top 140px of `RouteScreen` and fades to transparent at the bottom.

---

## Component Map

| New / Changed | File | Change |
|---|---|---|
| `useMap.ts` | `src/modules/map/useMap.ts` | Add `loadRecommended`, `recommendedPlaces`, local cache |
| `api.ts` | `src/shared/api.ts` | Add `api.recommended(city, persona)` |
| `types.ts` | `src/shared/types.ts` | Add `reason?: string` to `Place` |
| `PinCard.tsx` | `src/modules/map/PinCard.tsx` | Render `place.reason` when present |
| `MapScreen.tsx` | `src/modules/map/MapScreen.tsx` | Add `showTripSheet` state, render `TripSheet` |
| `TripSheet.tsx` | `src/modules/map/TripSheet.tsx` | New component — bottom sheet with trip context form |
| `ItineraryView.tsx` | `src/modules/route/ItineraryView.tsx` | Styled tips, `detectMealGaps`, `MealGapCard` |
| `WeatherCanvas.tsx` | `src/modules/route/WeatherCanvas.tsx` | New component — CSS weather animation |
| `RouteScreen.tsx` | `src/modules/route/RouteScreen.tsx` | Replace gradient div with `WeatherCanvas` |

---

## Out of Scope
- Backend prompt engineering changes
- Multi-day itinerary splitting UI
- Navigation (NavScreen) enhancements
- Saving/restoring recommended places across sessions
