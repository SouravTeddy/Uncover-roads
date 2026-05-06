# Phase 7 — Destination Screen + Multi-city Flow
**Date:** 2026-05-06
**Status:** Approved for implementation

---

## 1. Overview

Phase 7 rebuilds the destination screen's date picker (stripped in Phase 4) and adds organic multi-city detection — the user never explicitly declares a multi-city trip. They just add pins. The app detects when pins belong to a new city, transforms the map UI, and accounts for travel days automatically.

---

## 2. Destination Screen — Date Picker

### Flow
1. User opens destination screen — only the city search bar is shown
2. User selects a city — calendar animates in below the search bar (slide down, 300ms ease)
3. User taps a date or range to set travel dates
4. User taps outside the calendar — calendar collapses. A 📅 icon appears on the right side of the search bar as a re-open trigger
5. If dates are set, the 📅 icon shows a compact label e.g. `May 14–18` — tapping reopens the calendar
6. "Near me" path skips calendar entirely — uses today's date, goes straight to map

### Date prompt copy rule
Whenever travel dates are requested anywhere in the app, the reason must always be visible:
> *"We use this to check events, weather and opening days."*

Never just "set your travel dates" with no explanation.

---

## 3. Multi-city Detection

### Principle
The user never declares a multi-city trip. They add pins freely. The app detects when a new pin belongs to a different city and responds accordingly.

### Detection algorithm — runs on every pin add

**Step 1 — Fast path (sync, no API):**
- Compute haversine distance from new pin to centroid of each known city
- If within 30km of any known city centroid → assign that `_city`, done
- 30km covers all city outskirts without false positives

**Step 2 — Slow path: > 30km from all known centroids (async):**
- Reverse geocode new pin's lat/lon via Nominatim to get city name
- If city name matches an existing city → assign it (user is in outskirts)
- If new city name → proceed to Step 3

**Step 3 — New city confirmed → OSRM ground truth:**
- Call `detectTransitMode()` (already exists in `journey-legs.ts`) between nearest existing city centroid and new pin
- OSRM is the ground truth — it encodes the physical world (roads, bridges, water)
- Decision tree:
  - Road exists, < 2h → drive
  - Road exists, 2–8h → train
  - Road exists, > 8h → flight (road impractical)
  - No road, haversine < 200km → ferry
  - No road, haversine > 200km → flight

**Step 4 — Stamp + dispatch:**
- Stamp `_city` on the pin
- Dispatch `ADD_CITY_FOOTPRINT`
- Trigger `CityHopOverlay` + map mode transition

### What's already built
- `haversineKm()` — distance calc
- `detectTransitMode()` — OSRM + flight/train/drive classification
- `routeInterCity()` — returns `null` on water/no road (ocean detection)
- `FootprintChips` — city chip bar on map
- `CityHopOverlay` — plane arc animation + story card
- `JourneyBreadcrumb` — city sequence strip

### New code required
- `usePinCityDetector` hook — runs detection on each pin add, stamps `_city`

---

## 4. CityHopOverlay — transition moment

Fires once when a new city is first detected. Full screen, auto-dismisses after story card or user taps "Got it".

**Copy:**
> **"Sydney after Tokyo — nice."**
> *"We've added a travel day between them. Keep pinning places in both cities."*

**Copy rules:**
- ✓ "We added a travel day"
- ✓ "We built in transit time"
- ✗ Never: "plan / handle / book / sort / arrange" flights or transport
- The app accounts for travel time. It never books or plans travel.

---

## 5. Map UI — Single city vs Multi-city mode

Both modes live on the same map screen. A single `isMultiCity` boolean (derived from `isJourneyMode(selectedPlaces)`) drives which header and chrome are shown.

### Single city mode (default)
- Header: search bar showing city name + date range + 📅 re-open icon
- Filter bar below header: All · Famous · For you · Food · etc.
- Footer: standard bottom nav

### Multi-city mode (activates after CityHopOverlay)

**Header — city tab strip replaces search bar:**
- One tab per detected city: `🗼 Tokyo · 4` `🦘 Sydney · 2`
- Active tab: orange background + orange border
- Inactive tabs: surface background
- `+ city` dashed chip at end (opens city search)
- Tapping a tab: map flies to that city's cluster, filter bar filters to that city's pins

**Breadcrumb row below tabs:**
- `Tokyo → Sydney · ✈️ ~9h flight` (one line, non-interactive)
- Shows trip sequence and detected transit mode
- Transit label is informational only — never implies booking

**Map canvas:**
- Cluster labels appear above each city's pin group: `🗼 Tokyo` / `🦘 Sydney`
- Dashed arc line draws between city centroids, amber colour, with transit mode icon on arc
- Filter bar shifts down to accommodate taller header

**Bottom nav:** unchanged (no accent colour change)

---

## 6. Date conflict — when trip needs more days than budget

When the engine calculates that the full multi-city plan (city days + travel days) exceeds the user's set date range:

- Engine **automatically extends** the plan — no user action required
- A soft info bar appears at the top of the itinerary screen:

```
📅  Travel dates: 2 May – 7 May  +2 days
    Added a travel day for Tokyo → Sydney. Remove places to shorten the trip.
```

- `+2 days` shown in sky blue (`--color-sky`)
- No modal, no forced choice
- User can remove places from itinerary (already built in Phase 6) to trim the plan automatically

### Itinerary travel day card
```
Day 3 · Tokyo → Sydney — travel day
```
Styled in `--color-sky-bg` / `--color-sky-bdr`. Never "flight day."

---

## 7. Travel dates — copy rule (global)

This rule applies to every date prompt in the app, not just Phase 7.

| Context | Copy |
|---|---|
| Destination screen | *"When are you going? We use this to check events, weather and opening days."* |
| Saved places — past date | *"When are you going to [city]? We'll check events, weather and opening days."* |
| Journey screen nudge | *"Add dates for smarter planning — we check events, weather and opening days."* |
| Never | *"Set your travel dates"* with no explanation |

---

## 8. Components

| Component | Status | Notes |
|---|---|---|
| `usePinCityDetector` | New | Hook — runs on each pin add, stamps `_city` |
| `CityHopOverlay` | Exists | Update copy + fromCity/toCity wiring |
| `FootprintChips` | Exists | Repurposed as city tab strip in multi-city header |
| `JourneyBreadcrumb` | Exists | Wire to multi-city header breadcrumb row |
| `detectTransitMode()` | Exists | Already handles water/road/flight |
| `routeInterCity()` | Exists | OSRM ground truth |
| `DateRangeCalendar` | New | Inline calendar for destination screen |
| Multi-city header | New | Replaces search bar in `isMultiCity` mode |
| Arc line overlay | New | SVG arc between city centroids on map canvas |
| `MapScreen.tsx` | Update | Switch header based on `isMultiCity`; remove `JourneyStrip` from map (date conflict info moves to itinerary screen only) |
| `DestinationScreen.tsx` | Update | Add `DateRangeCalendar` reveal after city select; 📅 icon recovery |
