# Map Bugs — Design Spec
**Date:** 2026-04-26
**Scope:** Issues 1, 2, 3, 4, 6 (issue 5 deferred to next batch)

---

## Issues Covered

| # | Title | Complexity |
|---|-------|------------|
| 1 | Live event pins show nothing with no feedback | Low |
| 2 | Google Maps CTA opens wrong location | Low |
| 3 | Similar CTA in MapScreen is a no-op | Low |
| 4 | Favorites: no way to see saved places | Medium |
| 6 | Our Picks shows only events; no persona reasoning | Medium |

---

## Issue 1 — Events Empty State

### Problem
`loadEvents()` calls Ticketmaster. If the API key is missing or no events are found, the response is either `{"error": "..."}` or an empty array. The frontend sets `eventsLoaded = true` regardless and shows nothing — no user feedback.

### Fix
In `MapScreen.tsx`:
- Add local state `eventsError: string | null` (init `null`).
- After the `api.events()` call:
  - If response is `{"error": ...}` → set `eventsError = 'Events unavailable right now'`
  - If response is a valid empty array → set `eventsError = 'No events found in [city] for your dates'`
  - On success with results → clear `eventsError`
- Render `eventsError` in the same amber pill component as `eventsNoDate` (reuse existing style). Auto-dismiss after 4 seconds.

### Files Changed
- `frontend/src/modules/map/MapScreen.tsx`

---

## Issue 2 — Google Maps CTA Wrong Location

### Problem
`PinCard.tsx` builds the Google Maps URL using:
```
/maps/search/?query=Place+Name+City
```
when `details.place_id` is absent (all OSM places, all events). Text search is ambiguous and returns wrong results.

### Fix
Replace the text-search fallback with a coordinate-based URL. Every `Place` always has `lat` and `lon`:

```
https://www.google.com/maps/search/?api=1&query={lat},{lon}
```

This opens exactly the right map location regardless of place name ambiguity.

### Files Changed
- `frontend/src/modules/map/PinCard.tsx` — one line

---

## Issue 3 — Similar CTA No-op in MapScreen

### Problem
In `MapScreen.tsx` line 651, `onSimilar` is hard-coded as `() => {}`. The `useSimilarPins` hook and `SimilarPinsBanner` component are only used in `RouteScreen`.

### Fix
In `MapScreen.tsx`:
- Import and call `useSimilarPins()` hook to get `{ triggerSimilar, clearSimilar, similarPinsState }`.
- In `onSimilar` handler: call `triggerSimilar({ id, title, lat, lon, category })` from `activePlace`.
- Render `<SimilarPinsBanner>` in the top overlay (between filter bar and journey breadcrumb) when `similarPinsState !== null`.

No new components. `SimilarPinsBanner` and `useSimilarPins` already exist in `SimilarPins.tsx`.

### Files Changed
- `frontend/src/modules/map/MapScreen.tsx`

---

## Issue 4 — Favorites Layer

### Problem
Favorites are persisted to localStorage correctly but there is no way to see them. The heart badge appears on pins in RouteScreen only, and there is no panel or screen to browse saved places.

### Approach
A dedicated ❤️ cluster marker on the map at the centroid of all favorited locations. Tapping opens a bottom sheet. Tapping a row in the sheet closes it, flies the map to that place, and opens its PinCard.

### New Component: `FavoritesLayer.tsx`
Location: `frontend/src/modules/map/FavoritesLayer.tsx`

Exports two components:

**`FavoritesMarker`**
- Props: `{ pins: FavouritedPin[]; onClick: () => void }`
- Renders only when `pins.length > 0`
- Position: centroid of all pins' lat/lon
- Visual: circular dark pill — `❤️ {count}` — same dark glass style as other UI elements
- Implemented using `Marker` from `react-map-gl/maplibre` (same pattern as `ExploreMapMarkers`)
- Passed as a child of `<MapLibreMap>` — `MapLibreMap` already renders `{children}` inside `<Map>`, so no changes to `MapLibreMap` needed
- Hidden when a PinCard is open

**`FavoritesSheet`**
- Props: `{ pins: FavouritedPin[]; onClose: () => void; onSelect: (pin: FavouritedPin) => void }`
- Bottom sheet — same visual treatment as cluster picker sheet (`rgba(15,20,30,.96)`, `backdropFilter: blur(16px)`, `border-white/10`, drag-to-dismiss)
- Header row: "Your saved places" + count badge + close button
- Scrollable list: each row — category icon, title, city tag, `chevron_right`
- Tapping row: calls `onSelect(pin)` → parent closes sheet, flies map, opens PinCard
- Empty state: "Tap ❤️ on any place to save it here" (shown only if pins is empty, which shouldn't happen in practice since marker only shows when count > 0)
- Swipe-down to dismiss (same touch gesture logic as cluster picker)

### Integration: `MapScreen.tsx`
- Import `FavoritesMarker`, `FavoritesSheet`
- State: `showFavoritesSheet: boolean`
- `FavoritesMarker` rendered inside the map area, hidden when `activePlace !== null`
- `FavoritesSheet` rendered at same z-level as cluster picker, gated on `showFavoritesSheet && !activePlace`
- `onSelect(pin)`: constructs a minimal `Place` from `FavouritedPin` fields → calls `handlePinClick(place)` (which already calls `setActivePlace` + `fetchDetails`)

### Integration: `RouteScreen.tsx`
- Same `FavoritesMarker` + `FavoritesSheet` added to the explore mode view
- `onSelect(pin)`: construct `Place` → `setActiveMarker({ kind: 'place', place, state: 'added', isFavourited: true })`

### Persistence
Already handled — `TOGGLE_FAVOURITE` reducer writes to `ur_ss_favs` localStorage. `favouritedPins` is rehydrated from localStorage on app init (existing behavior, no changes needed).

### Files Changed
- `frontend/src/modules/map/FavoritesLayer.tsx` — new file
- `frontend/src/modules/map/MapScreen.tsx`
- `frontend/src/modules/route/RouteScreen.tsx`

---

## Issue 6 — Our Picks (LLM-generated, Transparent)

### Problem
- `api.recommended()` calls `/recommended-places` which does not exist in `main.py` → 404 on every call
- Falls back to `clientSideFallback()` which may return `category === 'event'` places and has no "why" messaging
- User has no visibility into why a place was recommended

### Approach
New `POST /recommended-places` backend endpoint. Frontend wires up `viewed_categories` behavior signal and displays transparent `whyRec` + signal badge in PinCard.

### Backend: `POST /recommended-places`

**Request body:**
```json
{
  "city": "Tokyo",
  "persona_archetype": "Slow Traveller",
  "persona_desc": "Prefers quiet, unhurried exploration...",
  "venue_filters": ["cafe", "museum", "park"],
  "itinerary_bias": ["culture", "local"],
  "viewed_categories": ["museum", "park"]
}
```

**Claude prompt:**
```
You are a travel recommendation engine for the app Uncover Roads.

A "{persona_archetype}" traveler ({persona_desc}) is visiting {city}.
Their interests: {venue_filters + itinerary_bias}.
They have been browsing: {viewed_categories} on the map.

Recommend exactly 6-8 real, specific places in {city} that exist and are worth visiting.
For each place return:
- title: exact place name
- category: one of [restaurant, cafe, park, museum, historic, tourism, place]
- lat: latitude (float)
- lon: longitude (float)
- whyRec: one sentence explaining why this specific place suits this traveler. Be transparent: if driven by their persona, say so. If driven by their browsing behavior, say so.
- signal: "persona" if the pick is based on their travel profile, "behaviour" if based on what they have been exploring

Return only a JSON array of 6-8 objects. No markdown. No explanation.
```

**Response parsing:**
- Parse JSON array
- If lat/lon are missing or 0.0, attempt Google Places Text Search geocode for the title + city
- Filter out any with `category === 'event'`
- Return `{ picks: [...] }`

**Error handling:** Return `{ picks: [] }` on any failure so frontend falls back gracefully.

### Types

Add to `frontend/src/shared/types.ts`:
```typescript
// On existing Place interface, add optional fields:
reasonSignal?: 'persona' | 'behaviour';
```
(`reason` field already exists on `Place`)

### API Client: `frontend/src/shared/api.ts`

Add:
```typescript
recommendedPlaces: (params: {
  city: string;
  personaArchetype: string;
  personaDesc: string;
  venueFilters: string[];
  itineraryBias: string[];
  viewedCategories: string[];
}) => post<{ picks: Place[] }>('/recommended-places', { ... })
```

Remove (or keep as dead code with a comment): the old `recommended` function pointing at the non-existent GET endpoint.

### `useMap.ts` Changes

**Track viewed categories:**
- Add `viewedCategoriesRef = useRef<Set<string>>(new Set())` — session-only, not persisted
- Expose `trackViewedCategory(cat: string)` — called by `MapScreen` in `handlePinClick`

**`loadRecommended()` updated:**
- Call `api.recommendedPlaces({ city, personaArchetype, personaDesc, venueFilters, itineraryBias, viewedCategories: [...viewedCategoriesRef.current] })`
- Map picks to `Place[]` with `reason = pick.whyRec`, `reasonSignal = pick.signal`
- On failure: fall back to `clientSideFallback()` (which now filters events and sets `reasonSignal: 'persona'`)

**`clientSideFallback()` fix:**
- Add `.filter(p => p.category !== 'event')` before the category match
- Set `reasonSignal: 'persona'` on all fallback results

**Re-trigger on behavior:** `loadRecommended` is called once (existing behavior). Behavior signal is passed at call time using whatever categories have been viewed up to that point. No re-triggering (keeps it simple, avoids flicker).

### PinCard — Signal Badge

In `PinCard.tsx`, below the existing `whyRec` block, add a signal badge when `place.reasonSignal` is present:

- `'persona'` → indigo pill: "Matched to your travel style"
- `'behaviour'` → teal pill: "Based on what you've been exploring"

Badge style: same as `intelPills` — small, inline, subtle background.

Only shown when `whyRec` is also present (they come together from the LLM).

### Files Changed
- `main.py` — new `POST /recommended-places` endpoint
- `frontend/src/shared/types.ts` — `reasonSignal` on `Place`
- `frontend/src/shared/api.ts` — `recommendedPlaces()` function
- `frontend/src/modules/map/useMap.ts` — updated `loadRecommended`, `clientSideFallback`, `viewedCategoriesRef`
- `frontend/src/modules/map/MapScreen.tsx` — call `trackViewedCategory` in `handlePinClick`
- `frontend/src/modules/map/PinCard.tsx` — signal badge

---

## Summary of All File Changes

| File | Changes |
|------|---------|
| `main.py` | New `POST /recommended-places` endpoint |
| `frontend/src/shared/types.ts` | Add `reasonSignal?: 'persona' \| 'behaviour'` to `Place` |
| `frontend/src/shared/api.ts` | Add `recommendedPlaces()`, remove dead `recommended()` call |
| `frontend/src/modules/map/useMap.ts` | Updated `loadRecommended`, fixed `clientSideFallback`, `viewedCategoriesRef` |
| `frontend/src/modules/map/MapScreen.tsx` | Events error state, Similar wiring, Favorites integration, `trackViewedCategory` |
| `frontend/src/modules/map/PinCard.tsx` | Maps URL fix (1 line), signal badge |
| `frontend/src/modules/map/SimilarPins.tsx` | No changes |
| `frontend/src/modules/map/FavoritesLayer.tsx` | New file — `FavoritesMarker` + `FavoritesSheet` |
| `frontend/src/modules/route/RouteScreen.tsx` | Favorites integration |

---

## Out of Scope
- Issue 5 (persona recommendation messages on all places) — deferred to next batch
- Backend API key management (Ticketmaster) — operational, not a code fix
