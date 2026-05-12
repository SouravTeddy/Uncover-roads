# Explore Tab Redesign

**Date:** 2026-04-23
**Status:** Approved
**Scope:** Explore tab (destination screen) + session restore fix

---

## Overview

Two related problems:

1. **Session restore bug** — closing and reopening the app restores directly to the map screen. It should always land on the Explore tab, with in-progress work surfaced there.
2. **Explore tab redesign** — the existing destination screen (city picker) becomes a proper home hub: vibrant, image-driven, and grounded entirely in real user actions.

---

## Screen Architecture

### Approach: Explore absorbs Destination

The `destination` screen is redesigned as the new Explore hub. It is no longer a simple city picker — it is the default landing screen for all returning users.

The `map`, `route`, and `journey` screens remain unchanged. The Explore tab is the entry point back to all of them.

**BottomNav:** No changes. `EXPLORE_SCREENS = Set(['destination', 'map'])` stays as-is. Tapping Explore always navigates to `destination`.

---

## Session Restore Fix

**File:** `src/shared/store.tsx` — `getInitialScreen()`

**Current behaviour:** restores `ur_ss_screen` if it is one of `['map', 'route', 'destination', 'journey']`.

**New behaviour:** for onboarded users, always return `'destination'` regardless of `ur_ss_screen`. The last map/route state (city, selected places, filter, dates) remains intact in localStorage — it surfaces on the Explore tab via the In Progress section, not by restoring directly to the map.

```ts
if (localStorage.getItem('ur_persona')) {
  return 'destination'; // always land on Explore
}
```

`ur_ss_screen` continues to be written on navigation (for potential future use), but is no longer read on startup.

---

## Explore Screen Layout

### 1. Header

- App name ("uncover roads") with purple→blue gradient
- Current date in small muted text
- User avatar (initial) top-right

### 2. Search Bar

Full-width below the header, separated from the content below by a subtle `border-bottom`.

- Single unified search: accepts city names ("Paris"), place names ("Eiffel Tower"), or descriptive queries ("cafés in Rome")
- Tapping a city result dispatches `SET_CITY` + `GO_TO map`
- Tapping a place result dispatches `GO_TO map` and opens that place's PinCard
- **Current location button** — small pill inline on the right side of the search bar. Tapping it uses the browser Geolocation API to populate the search with the user's current city, then dispatches `SET_CITY` + `GO_TO map`
- Rotating placeholder suggestions (reuse the existing animation from `MapScreen`)

### 3. In Progress Section

Only rendered when `selectedPlaces.length > 0`.

A single tinted card container with `background: rgba(20,16,36,0.9)` and a purple border. Section label "IN PROGRESS" in purple at the top.

Contains three sub-layers separated by hairline inner dividers:

**a. City hero card**
- Full-width image card (city photo via Google Places → Wikipedia fallback, same pipeline as PinCard)
- Overlaid gradient: dark bottom-left to purple top-right
- City name (large) + "N places · [dates or 'no dates set']" subtitle
- **Resume → button** (top-right, frosted glass pill): dispatches `GO_TO map`. Map opens with `selectedPlaces` and `city` already in state — no reload needed.

**b. Place chips**
- Horizontal scrollable row of chips, one per selected place
- Each chip shows a green dot (selected indicator) + place name
- Tapping a chip dispatches `GO_TO map` and opens that place's PinCard

**c. Draft banner + place photo scroll**
- Compact banner: city thumbnail, "Paris draft", "N stops · [dates or 'no dates set']", progress dots (filled = places selected, empty = remaining capacity toward a suggested day count)
- Below the banner: horizontal photo card scroll — one card per selected place with a real photo, place name, and green checkmark. Final card is a dashed "Add place" card that dispatches `GO_TO map`.

### 4. Empty State

Rendered when `selectedPlaces.length === 0`, in place of the In Progress section.

Single purple-tinted card containing:
- Muted map emoji icon
- "No trips in progress" title
- "Search for a city or place above to start building your next adventure." subtitle
- No CTA button — the search bar is the only prompt

---

## Data Sources

All content on this screen is derived from real persisted user state. No AI inference, no persona-based suggestions, no generated content.

| Element | Source |
|---|---|
| City name | `state.city` / `ur_ss_city` |
| City photo | Google Places photo (existing pattern in PinCard) → Wikipedia fallback |
| Place list | `state.selectedPlaces` / `ur_ss_sel` |
| Place photos | Same photo pipeline as PinCard (Google → Wikipedia) |
| Dates | `state.travelStartDate`, `state.travelEndDate` / `ur_ss_start_date`, `ur_ss_end_date` |
| Progress dots | `selectedPlaces.length` vs a fixed max of 5 |

---

## Interactions

| Action | Behaviour |
|---|---|
| Tap Resume → | `dispatch GO_TO map` — resumes with city + places intact |
| Tap place chip | `dispatch GO_TO map` + open PinCard for that place |
| Tap place photo card | Same as chip |
| Tap "Add place" card | `dispatch GO_TO map` — user adds more places from map |
| Tap draft banner | `dispatch GO_TO map` — same as Resume |
| Type in search | Smart search: city → load map for that city; place → load map + open PinCard |
| Tap Near me | Geolocation → resolve city → `SET_CITY` + `GO_TO map` |

---

## Place Removal (Out of Scope)

Place removal is not part of this spec. It will be added to the map screen in a future feature. Until then, there is no way to deselect a place from the Explore tab.

---

## Animations (Planned, Non-Blocking)

- Entrance shimmer on place photo cards on first render
- Smooth slide-in for the In Progress section when `selectedPlaces` transitions from 0 → 1+
- Frosted glass blur on the Resume button (CSS `backdrop-filter`)

These are enhancements. The feature ships without them if they add complexity.

---

## Files Affected

| File | Change |
|---|---|
| `src/shared/store.tsx` | `getInitialScreen()` — always return `'destination'` for onboarded users. No state shape changes — reads existing `selectedPlaces`, `city`, `cityGeo`, dates. |
| `src/modules/destination/DestinationScreen.tsx` | Full rewrite as Explore hub |
| `src/modules/destination/` | New components: `CityHeroCard`, `InProgressSection`, `PlaceChips`, `DraftBanner`, `PlacePhotoScroll`, `ExploreEmptyState` |
| `src/shared/ui/BottomNav.tsx` | No changes |

---

## Out of Scope

- Discover / infographic carousel (deferred — no data source)
- Edit CTA / inline place removal (deferred — belongs on map screen)
- Multi-city / journey mode surface on Explore (future)
- Community tab (not started)
