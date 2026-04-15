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

## Section 5: Trip Tenure & Duration Intelligence

### Journey Strip

A persistent strip sits above the card deck on the Explore tab at all times:

```
Apr 20 – Apr 27  ·  8 days  ·  2 travel  ·  3 cities
```

If no start date is set: `~8 days · 2 travel · 3 cities`. Updates live as places are added or removed. This is the single source of truth for trip duration — always visible, never buried.

### Duration-First Flow

User declares total trip length upfront (e.g. "4 days") when setting up a journey. This becomes the **budget**.

As places are added, the app calculates required days and compares against the budget:
- **Over budget**: notify with a recommendation to either add days or trim places
- **Under budget**: soft prompt that there's room left
- **Exact fit**: no message

The budget is always editable — tapping the journey strip opens a duration picker.

### Travel Days vs City Days

When origin is home or airport, the app identifies **travel days** — days where the user is in transit rather than exploring. These are surfaced explicitly:

```
4 days total  ·  2 travel  ·  2 in Tokyo
```

Travel day logic:
- Home → long flight (>4h): Day 1 is a travel day (arrives evening local time)
- Return flight on last day: last day is a travel day (departs morning)
- Short flight (<2h): no travel day deducted — can still do afternoon/evening spots
- Drive >6h: counts as a half travel day

These are shown on the origin card and factored into the per-city day allocation.

### Smart Day Recalculation

`estimatedDays` per city is calculated as:

```
base = ceil(places.length / persona.stops_per_day)
+ overtime if total OSRM time between places > base × 6h
+ 1 if long-haul arrival (first city only)
- last day squeeze if hotel check-out before 13:00
```

Whenever this changes, an inline reasoning message appears on the affected card (see Section 6).

---

## Section 6: Conversational Reasoning System

### Principles

Every automated change or recommendation surfaces a short plain-English message. The voice always:
- Acknowledges the **human reality** behind the constraint, not just the rule
- Uses contractions and informal language ("you've got", "we kept it light")
- Follows the pattern: **what changed → why it matters to you → what you can do**
- Never uses system language ("detected", "computed", "allocated", "constraint")
- Stays to one or two sentences

### Message Catalogue

| Trigger | Message |
|---|---|
| Long-haul arrival | "After 12 hours in a plane, we've kept your first day in Tokyo light. You can always add more once you're there." |
| Hotel check-out squeeze | "Ending your last morning by 10:30 — gives you half an hour to pack before check-out at 11." |
| Home departure | "Leaving at 9 — we'll make sure you're not rushing to your first spot before it even opens." |
| Place count tips city over budget | "That's now 6 spots in Barcelona — one more than a relaxed 2-day city. Added a day so you're not rushing." |
| Duration budget exceeded | "You've picked 9 spots across 3 cities — that needs about 6 days, you've got 4. Want to add time, or should we help you choose the best ones?" |
| Duration budget under-used | "Plenty of room left in your 4 days — you could add another city or slow down and go deeper." |
| Travel days eating into total | "Flights take a day each way, so you've really got 2 days in Tokyo. Tight but doable — want to add time, or make the most of it?" |
| Transit mode auto-set to flight | "There's no road between these two — looks like you're flying." |
| Place removed, day freed | "Dropped a spot in Kyoto — you've got a bit of breathing room now. Good for wandering." |
| Short flight, no day deducted | "It's only an hour to Osaka — you'll still have the afternoon when you land." |

New triggers can be added; all follow the same tone pattern.

### Delivery: Two-Layer System

**Layer 1 — Inline card message**: Appears directly on the card that changed, below the "N places · ~X days" pill. One sentence. Stays until dismissed or the card changes again. Catches the user in the moment.

**Layer 2 — Advisor thread**: A collapsible panel anchored to the bottom of the journey screen, accessible via a small "Why is my trip shaped this way?" handle. Contains a chronological log of every reasoning message in conversational form:

```
We kept your first Tokyo day light — long flight.
Added a day in Kyoto — 6 spots is a lot at your pace.
Ending your last morning early — time to pack for check-out.
```

The thread is read-only. It helps users review the full shape of their trip and understand every decision at a glance. No actions live in the thread — actions are on the cards.

---

## Out of Scope

- Flight search / booking — deep link only, no in-app flight data
- Manual date overrides — fully auto-calculated
- Drag-to-reorder cities — future iteration
- Public transport routing within a city — existing OSRM single-city behaviour unchanged
- Offline support
