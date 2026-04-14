# Multi-City Journey Implementation Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to build a multi-city trip by pinning places across cities, with the app automatically detecting the multi-city nature, generating transit legs, and rendering a swipeable journey card deck with city-specific maps and persona-aware itineraries.

---

## Section 1: Architecture

### Detection

Multi-city mode activates when a place with a `_city` tag differing from the current active city is added to the map. At that point, `MapScreen` is replaced by `JourneyScreen`.

The active city is tracked in `TripContext` as `activeCity: string | null`. When a new place's `_city` !== `activeCity`, the app:
1. Groups all existing places under `activeCity` as City A
2. Creates a transit leg between A and the new city
3. Creates City B with the new place
4. Renders `JourneyScreen`

### State Shape Extension

`TripContext` gets a `journey: JourneyLeg[]` array alongside the existing `places` array (kept for single-city compatibility).

```typescript
type OriginType = 'home' | 'hotel' | 'airport' | 'custom';

type OriginPlace = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  originType: OriginType;
  departureTime?: string;   // home: user-entered, airport: landing time
  checkInTime?: string;     // hotel: from Google Places
  checkOutTime?: string;    // hotel: from Google Places
  isLongHaul?: boolean;     // airport: true if international
};

type TransitMode = 'flight' | 'drive' | 'train' | 'bus';

type JourneyLeg =
  | { type: 'origin'; place: OriginPlace }
  | { type: 'city'; city: string; countryCode: string; places: Place[]; arrivalDate?: string; estimatedDays: number }
  | { type: 'transit'; mode: TransitMode; from: string; to: string; fromCoords: [number, number]; toCoords: [number, number]; durationMinutes?: number; distanceKm?: number };
```

New reducer actions:
- `SET_JOURNEY_ORIGIN` — sets Card 0
- `ADD_CITY_LEG` — appends city + auto-generated transit leg
- `REMOVE_CITY_LEG` — removes city and its transit leg
- `REORDER_CITY_LEGS` — drag-to-reorder (future)

### Transit Mode Detection

When a new city is detected, the app calls OSRM `/route` between the last city's centroid and the new city's first place:
- No route returned → `flight`
- Route duration > 8 hours → `flight`
- Route duration 2–8 hours → `drive` or `train` (train if route passes through major rail corridor — heuristic: country pair lookup)
- Route duration < 2 hours → `drive`

This correctly handles difficult terrain (mountain passes, island crossings) without haversine shortcuts.

### Date Calculation

No manual date input. Dates cascade from the origin anchor:

```
origin.departureTime (or Day 1 default)
  + city_A.estimatedDays  (= ceil(places.length / persona.stops_per_day))
  + transit A→B (flight: 0 days added to calendar; drive: may span overnight if > 6h)
  + city_B.estimatedDays
  + ...
```

Each `city` leg gets an `arrivalDate` (ISO string). The itinerary screen renders these as calendar dates. If no origin is set, dates render as relative ("Day 1", "Day 2").

### Hotel Check-Out Squeeze

For the **last city** in the journey, if origin type is `hotel` and `checkOutTime` is set:
- Day count for that city is recalculated: hard cutoff = checkout time
- Last day's places are filtered to fit within the window — fewer stops, geographically closer to hotel, ending stop ≤ 20 min from hotel

---

## Section 2: JourneyScreen Card Deck UI

### Layout

```
┌─────────────────────────────────┐
│                                 │
│        MapLibre / Transit       │  60vh
│        Visual (active card)     │
│                                 │
├─────────────────────────────────┤
│  ← [Card 0] [Card 1] [Card 2] → │  40vh
│         progress strip          │
└─────────────────────────────────┘
```

- Map shows **only the active city card's places** (not all cities)
- When active card is a transit leg, map is replaced by a full-bleed transit visual
- Progress strip: city names as tappable chips, active one highlighted

### Card Types

#### Origin Card (Card 0)
- Place name + address
- Origin type icon (home / hotel / airport / pin)
- Time display:
  - Home: "Leaving at HH:MM"
  - Hotel: "Check-in HH:MM · Check-out HH:MM" (read-only, from Google)
  - Airport: "Landing HH:MM · +45 min customs"
  - Custom: no time shown
- Tap to edit origin

#### City Card
- MapLibre mini-map showing OSRM road polyline through the city's places
- City name + country flag emoji
- "N places · ~X days" pill
- Swipe up gesture expands to a scrollable place list
- "Add more places" button links back to map zoom on this city

#### Transit Card — Flight
- Full card: sky gradient background (dawn/dusk depending on estimated departure hour)
- Animated plane SVG traversing the card
- Route: "[City A] ✈ [City B]"
- Duration: "~Xh flight"
- "Find flights →" — deep link to `https://www.google.com/travel/flights?q=flights+from+{cityA}+to+{cityB}`
- Typography: clean airline sans-serif, thin weights, high contrast on gradient

#### Transit Card — Drive
- Map background: OSRM polyline on MapLibre, desaturated
- Car icon, duration + distance
- "Open in Maps →" deep link

#### Transit Card — Train / Bus
- Rail/road line illustration background
- Mode icon, duration
- "Open in Maps →" deep link

### Adding Cities
- `+` button appended after last city card
- Tapping returns to map in "add city" mode — search or zoom to new city, pin a place
- On pin: new transit + city legs auto-appended, deck scrolls to new city card

---

## Section 3: Origin Input Flow

### Entry Point

The existing destination/trip setup screen gets a "Starting from" field above the city search input. Uses the same Google Places autocomplete component already in the app.

### Type Detection

Resolved from Google Places `types` array on the selected result:

| Condition | Origin type |
|---|---|
| `types` includes `lodging` | `hotel` |
| `types` includes `airport` | `airport` |
| `types` includes `street_address` or `premise` | ask "Is this your home?" |
| Anything else | `custom` |

No heuristics. The `types` array from the API is the authoritative signal.

### Home Confirmation

Single yes/no sheet: **"Is this your home?"**
- Yes → time picker: **"When are you heading out?"** (default 09:00, 15-min increments)
- No → treated as `custom`, no further questions

### Airport Flow

Mandatory time picker: **"What time do you land?"**
- Customs buffer auto-added: 45 min domestic, 90 min international (determined by whether origin country ≠ destination country)
- `isLongHaul` flag (from existing `TripContext`) drives first-day pace: long-haul → max 2 stops Day 1

### Hotel Flow

`/place-details` call already exists. Parse check-in/check-out from `weekday_text` or `current_opening_hours`. These are shown read-only on the origin card — no override. If Google doesn't return these times, fall back to industry defaults (check-in 15:00, check-out 11:00).

### No Origin Set

Valid state. Card 0 is skipped. Itinerary uses relative days. A soft prompt appears on the itinerary screen: "Add a starting point to get calendar dates."

### Origin Card Mutation

Tapping Card 0 re-opens the origin input. On change, the full date cascade recalculates. City leg `arrivalDate` values are recomputed and the itinerary screen re-renders.

---

## Section 4: Itinerary Screen Behaviour

The existing `ItineraryScreen` is extended to read from `journey` when in multi-city mode:

- Day blocks are grouped by city, with a visual separator between cities
- Transit legs render as non-day separators: flight icon + "fly to [City B]" or "drive to [City B]"
- Day numbering is global across cities (Day 1, Day 2 … Day N), not reset per city
- Hotel squeeze: last city's days are recalculated at render time based on `checkOutTime`

Single-city mode is unaffected — itinerary reads from `places` as before.

---

## Out of Scope

- Flight search / booking — deep link only, no in-app flight data
- Manual date overrides — fully auto-calculated
- Drag-to-reorder cities — future iteration
- Public transport routing within a city — existing OSRM single-city behaviour unchanged
- Offline support
