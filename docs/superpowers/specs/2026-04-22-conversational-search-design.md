# Conversational Search & Count Bug Fix — Design Spec
**Date:** 2026-04-22
**Status:** Approved

---

## Overview

Two related improvements to the map screen:

1. **Bug fix** — filter counts and city label in the search bar do not update when the user scrolls to a new area.
2. **Feature** — expand the search bar to support conversational queries like "museum near Shinjuku Station" or "live events on April 23", with results displayed as numbered pins on the map and a swipeable floating card.

---

## Part 1: Bug Fix — Counts & City Label on Scroll

### Root Cause

`useMapMove.ts` fetches new places when the map scrolls past the 40% viewport displacement threshold but never updates the `city` string in the Redux store. The search bar placeholder (`Search places in {city}`) reads directly from `state.city`, so it stays stale.

The filter counts (`All`, `Events`, `Museums`, etc.) are computed from `places.length` filtered by category — they should update when `places` updates, but the likely secondary bug is that `handleAreaLoad` appends new places rather than replacing them, causing duplicates that inflate counts without reflecting the true new area.

### Fix

**City label:** After `handleAreaLoad` resolves new places for the new map center, reverse-geocode the center coordinates using the existing Nominatim `/geocode` endpoint to get the new locality name. Dispatch `SET_CITY` to update the store. Debounce to match the existing 700ms map move debounce.

**Counts:** Deduplicate the `places` array by `place.id` when merging newly fetched places into the store. Places that already exist (same ID) are updated in-place; genuinely new places are appended. When the displacement between the previous fetch center and the new fetch center exceeds the existing 40% viewport threshold (i.e. a second load is triggered), replace the array entirely rather than merging.

---

## Part 2: Conversational Search Feature

### Search Bar Behaviour

The existing search bar gets two modes sharing a single `<input>`:

- **Default mode** — placeholder: `Search places in {city}` — existing Nominatim jump-to-place behaviour, unchanged.
- **Conversational mode** — placeholder: `Try "museum near Shinjuku" or "events Apr 23"` — activates when the input is focused and the user begins typing.

Intent is inferred from what the user types. If the input matches a category keyword, conversational mode takes over and the grouped dropdown appears. If no category is detected, the existing Nominatim search runs as a fallback (the "Areas" group in the dropdown).

### Client-Side Parsing Pipeline

Runs on every keystroke, debounced 300ms. No backend call for parsing.

```
raw input
  → tokenize
  → extract { category, locationString, dateString }
  → if locationString: Nominatim autocomplete (bounded to city bbox)
  → if dateString: resolve to absolute date, validate against tripContext dates
  → build grouped dropdown suggestions
```

**Category keyword map** (checked case-insensitively against the full input):

| Keywords | Maps to |
|---|---|
| museum, gallery, art | `museum` |
| restaurant, food, eat, café, cafe | `restaurant` |
| park, garden, nature | `park` |
| temple, shrine, historic | `historic` |
| event, events, live, show, concert | `event` |
| bar, nightlife | `restaurant` |

**Location detection:** looks for `near`, `in`, `around`, `by` followed by the remainder of the input. That remainder is sent to Nominatim autocomplete, bounded to the current city's bounding box. Up to 3 location suggestions returned.

**Date detection:** regex matches common patterns (`april 23`, `23rd april`, `apr 23`, `this saturday`). Resolved to an absolute ISO date string. Validated against `tripContext.date` + `tripContext.days`:
- Inside trip window → shown normally in dropdown
- Outside trip window → suggestion still appears but with an inline nudge: *"May 10 is after your trip ends (Apr 26). Still search?"* — user can still select it

### Grouped Dropdown

Only groups with at least one result are shown. Order: Places → Events → Areas.

```
Places
  🏛 Museum near Shinjuku Station
  🏛 Museum near Shinjuku Gyoen

Events
  🎉 Events on Apr 23 near Shinjuku Station

Areas
  (Nominatim fallback if no category detected)
```

Selecting any row produces a structured query object — no free text is ever executed directly.

### Results Display

**Search state is local.** A `useSearchMode` hook inside `MapScreen` holds `searchResults: Place[]`, `activeResultIndex: number`, and `addedIds: Set<string>`. This is never written to the global Redux store, keeping the main `places` array clean. Clearing search resets local state only.

**On query selection:**

1. Map drops numbered pins (1, 2, 3…) for each result. Existing regular pins are dimmed.
2. Map flies to the bounding box of all results.
3. Floating card appears at the bottom showing result at `activeResultIndex`.

**Floating card fields** (only fields that are actually present on the `Place` object are rendered — nothing is shown if the field is absent):

- `title` — always
- Category icon + label — always
- `rating` — if present (e.g. ⭐ 4.8)
- `price_level` — if present, displayed as $, $$, $$$

No distance. No `open_now`. No AI-generated reasons.

**Card navigation:**

- Swipe card left/right → `activeResultIndex` increments/decrements, map flies to that pin, active pin highlights in amber
- Tap a numbered pin on the map → `activeResultIndex` jumps to that result, card updates
- "View all N →" pill on card → compact bottom sheet slides up listing all results with rating and price_level. Tapping a row dismisses the sheet and jumps the card to that result.

**Adding to itinerary:**

- Tap "+ Add" → dispatches existing `ADD_SELECTED_PLACE` action (same as regular pin add)
- Local state marks result as added → pin turns green ✓ → card bottom shows toast: *"✓ [Place name] added"*
- Card automatically advances to next result
- In "View all" sheet, added items show "Added" in green instead of "+ Add"

**Clearing search:**

- Tap ✕ on search bar → `searchResults` cleared → numbered pins removed → regular pins restore → map returns to default mode

### Data Sources

No new backend endpoints are needed.

| Query type | Endpoint used | Notes |
|---|---|---|
| Place category near location | `/nearby?lat=&lng=&type=&radius=1500` | Existing endpoint; confirm `type` filter param is supported |
| Events on date near location | `/events?lat=&lng=&date=` | Existing Ticketmaster endpoint |
| Location resolution | Nominatim autocomplete | Already used in map search, bounded to city bbox |

---

## Out of Scope

- Free-text AI query parsing (Claude intent parsing) — deferred, not needed for described use cases
- Distance display — removed; no clear reference point pre-itinerary
- `open_now` badge — removed from cards

---

## Files Affected (anticipated)

- `frontend/src/modules/map/useMapMove.ts` — add reverse-geocode + SET_CITY dispatch
- `frontend/src/shared/store.tsx` — deduplication logic in place reducer
- `frontend/src/modules/map/MapScreen.tsx` — conversational search input, floating card, numbered pins, view-all sheet
- `frontend/src/modules/map/useSearchMode.ts` — new hook (separate file) holding searchResults, activeResultIndex, addedIds
- `frontend/src/modules/map/FilterBar.tsx` — confirm counts recalculate correctly after dedup fix
