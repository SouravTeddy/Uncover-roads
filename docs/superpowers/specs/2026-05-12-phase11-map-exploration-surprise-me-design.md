# Phase 11 — Map Exploration, City Profiling Surface Layer & Surprise Me

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface city profiling data on the map (trend badges, hidden gems, live events), complete half-built map search and itinerary features, and add "Surprise Me" — a Claude-powered itinerary generator that runs through our engine.

**Phase 12** is the design system refresh. Phase 11 uses existing visual patterns.

---

## Scope

Phase 11 finishes what was designed-but-unbuilt across prior specs, plus adds city profiling to the UI and Surprise Me. Conversational origin flow is explicitly excluded — deferred to a later phase to reduce friction.

### In Scope
1. Pin badge system (trending, hidden gem, getting busy, live events)
2. Our Picks pin visual distinction
3. Reference ghost pin layer (complete partial implementation)
4. Live events via Ticketmaster as map pins
5. Filter bar updates (new chips, remove Similar Places)
6. Map search with numbered pins + rotating placeholder
7. Surprise Me (Claude + engine)
8. Per-stop conflict tags on itinerary cards
9. Travel date bar UI (complete partial implementation)
10. Remove Similar Places entirely

### Out of Scope
- Conversational origin / starting point flow (deferred)
- New design system (Phase 12)
- Persona onboarding redesign

---

## Architecture

### Data Flow — City Profiling to UI

```
city_data (Supabase)
    → GET /api/cities/map-pins (free)
    → GET /api/cities/picks (Pro) — includes trend badges
    → Frontend pin layers + badge overlays
```

```
place_dynamic_profiles (Supabase, written by sync_job.py weekly)
    → badge logic: trending (velocity_ratio ≥ 2.0) / getting_busy (crowd_ratio ≥ 0.4) / hidden_gem
    → surfaced via /api/cities/picks
```

```
Ticketmaster API
    → GET /api/events?city_id=&start_date=&end_date=
    → Live event pins on map (Pro)
```

### Data Flow — Surprise Me

```
User taps Surprise Me
    → frontend reads: start city, map center city, dates, persona
    → POST /api/surprise-me
        → builds Claude prompt with CityData context
        → Claude returns structured day list
        → engine runs: sequencer + inserter + conflict detector
        → returns standard ItineraryDay[] response
    → store hydrates itinerary as normal
```

---

## Section 1 — Pin Badge System

### Badge Types

| Badge | Trigger | Colour | Source |
|---|---|---|---|
| Trending ↑ | velocity_ratio ≥ 2.0 | Amber | place_dynamic_profiles |
| Hidden gem ✦ | stage = hidden_gem | Teal | place_dynamic_profiles |
| Getting busy | crowd_ratio ≥ 0.4 | Orange | place_dynamic_profiles |
| Live event | Ticketmaster event within date range at this venue | Purple | Ticketmaster API |

- Max 2 badges per pin. Priority: live event > trending > hidden gem > getting busy.
- Badges are small pill overlays on the pin icon, not replacements.
- Free users see hidden gem + getting busy badges. Trending + live event badges are Pro only.

### Pin Layers (revised)

| Layer | Icon | Visibility | Data source |
|---|---|---|---|
| Famous | Gold star, 28px | Always | Google Places (existing) |
| Our Picks | Amber gradient pin | Pro only | /api/cities/picks |
| Reference ghost | Purple circle, 18px, 50% opacity | Toggle | /reference-pins (existing) |
| Live Events | Purple pin with calendar icon | Pro, Events chip | Ticketmaster |
| User-added | Blue circle, 24px | Always | Local store (existing) |

### Our Picks Pin Styling

Currently filter exists but all pins use the same icon. Our Picks pins get:
- Amber/orange gradient background
- Gold star badge top-right
- Slightly larger (26px) to stand out from reference ghost pins

---

## Section 2 — Filter Bar

### Updated Chips

`All` · `Trending` · `Hidden Gems` · `Events` · `Picks` (Pro lock icon if free)

- **Trending** — shows only pins with trending badge
- **Hidden Gems** — shows only pins with hidden_gem badge
- **Events** — shows live event pin layer, hides others
- **Picks** — shows Our Picks layer only

Remove: `Similar` chip (entire Similar Places feature removed).

### Similar Places Removal

- Delete `SimilarPins.tsx` component
- Remove "Similar" CTA from `ItineraryPlaceCard` and `PinCard`
- Remove `/similar-places` endpoint from `main.py`
- Reference ghost pin layer serves as the replacement — engine-wide suggestions rather than per-place similarity

---

## Section 3 — Live Events (Ticketmaster)

### Backend

New endpoint: `GET /api/events`

Parameters: `city_id`, `start_date`, `end_date`, `bbox` (optional)

Response:
```json
{
  "events": [
    {
      "id": "ticketmaster_abc123",
      "name": "Jazz Night at Blue Note",
      "venue_name": "Blue Note Tokyo",
      "lat": 35.6762,
      "lon": 139.6503,
      "date": "2026-05-15",
      "time": "20:00",
      "category": "music",
      "url": "https://ticketmaster.com/...",
      "image_url": "..."
    }
  ]
}
```

Uses existing `TICKETMASTER_KEY` env var. Filtered to events within the user's travel date range. Cached in memory for 1 hour per city+date combination.

### Frontend

- Live event pins rendered as a separate layer (purple, calendar icon)
- Tapping opens a PinCard variant showing: event name, venue, date/time, ticket link
- "Add to itinerary" adds as a fixed-time stop (time locked, engine works around it)
- Only loaded when user has travel dates set

---

## Section 4 — Map Search

### Flow

1. User types in search bar
2. Rotating placeholder cycles every 1.5s: "temples in the area..." / "best dinner spots..." / "hidden gems nearby..." / "live events this weekend..." / "things to do tomorrow..."
3. On submit:
   - Map zooms out 1 level
   - Numbered pins (1–10) appear for results
   - Slim results strip slides up from bottom (~120px tall), showing numbered rows
4. User taps pin or row → PinCard opens normally
5. User dismisses (X or swipe down on strip) → all search pins removed, map returns to previous zoom + center

### Search Routing

| Query type | Example | Handler |
|---|---|---|
| Category | "temples", "coffee shops" | /map-data with type filter (existing) |
| Intent | "best dinner", "hidden gems" | parseSearchQuery → Google Places types (existing) |
| Events | "live music tonight", "events this weekend" | /api/events with date filter |
| Place name | "Senso-ji" | Nominatim / Google Places (existing) |

### Numbered Pins

Results rendered as numbered circle pins (white number on blue background, 24px). Separate layer from all other pins, cleared on search dismiss. Already-existing places that appear in results get their number badge overlaid on their existing pin.

---

## Section 5 — Surprise Me

### UI

Floating pill button on map: `✦ Surprise Me`

- Always visible on map when travel dates are set
- Position: bottom-center, above the filter bar
- Tapping it: brief loading state "Building your adventure..." (3–4s) then itinerary populates
- If itinerary already exists: confirmation bottom sheet — "This will replace your current itinerary. Continue?" → Yes / Cancel

### Backend

New endpoint: `POST /api/surprise-me`

Request:
```json
{
  "start_city_id": "tokyo",
  "end_city_id": "sydney",
  "start_date": "2026-06-01",
  "end_date": "2026-06-08",
  "persona": "explorer"
}
```

**Step 1 — Build Claude prompt**

System prompt includes:
- CityData for start and end cities (landmark_anchors, hidden_gems, neighborhoods, insert_candidates)
- Persona description
- Date range + total days
- Instruction to return structured JSON: `{ days: [{ city, date, places: [{ name, category, duration_min, lat, lon }] }] }`

**Step 2 — Claude generates raw itinerary**

Model: Claude Haiku (fast, cheap). Max 1000 tokens. Structured JSON output enforced via system prompt.

**Step 3 — Engine runs on top**

Claude's place list per day passes through existing pipeline:
- `run_sequencer()` — neighborhood clustering + reordering
- `run_inserter()` — coffee/scenic walk/rest injection
- `run_swapper()` — low-rated place replacement
- Conflict detection — tags applied

**Step 4 — Response**

Returns standard `ItineraryDay[]` — identical shape to existing `/ai-itinerary` response. Frontend hydrates itinerary store as normal. No special handling needed.

### Multi-City Handling

If `start_city_id ≠ end_city_id`: Claude builds days for each city, transit leg auto-inserted between cities using existing multi-city logic. Engine runs per-city independently.

If same city: single-city itinerary, standard flow.

---

## Section 6 — Per-Stop Conflict Tags

Small pill tags on each `ItineraryStopCard`. Generated by engine, not AI.

| Tag | Condition | Source |
|---|---|---|
| ☀️ Beat the heat | Stop scheduled 12pm–3pm + city climate.hot_season includes current month | city climate data |
| ✈️ Light — jet lag day | First day of trip + flight origin timezone diff > 5h | trip metadata |
| 🌅 Sunset timing | Stop lat/lon + scheduled time within 30min of sunset | computed from date + location |
| ⚠️ Getting crowded | Place has getting_busy badge + scheduled during crowd peak | place_dynamic_profiles |

Max 2 tags per stop. Tags are purely informational — engine does not change the schedule based on them, just flags them.

### Implementation

- Add `tags?: string[]` to `ItineraryStop` type in `types.ts`
- Engine populates tags during conflict detection pass (existing `run_conflicts()` or new pass)
- `ItineraryStopCard` renders tag pills below the place title, small text, coloured by type

---

## Section 7 — Travel Date Bar

Completes the half-built component. Persistent strip shown below map header when dates are set.

Format: `Jun 1 – Jun 8 · 8 days · 1 travel · 2 cities`

- Tappable → opens date picker sheet
- Utility functions already exist (`computeTotalDays`, `getTripCapacityStatus`)
- Just needs `TravelDateBar.tsx` component wired to existing store state

---

## API Changes Summary

| Endpoint | Change |
|---|---|
| `GET /api/cities/picks` | Already built (Phase 10) — wire to frontend |
| `GET /api/cities/map-pins` | Already built (Phase 10) — wire to frontend |
| `GET /api/events` | New — Ticketmaster integration |
| `POST /api/surprise-me` | New — Claude + engine itinerary generator |
| `DELETE /similar-places` | Remove endpoint |

---

## Testing

- Badge logic: unit tests for velocity_ratio/crowd_ratio thresholds
- Surprise Me: mock Claude response → verify engine runs sequencer/inserter on output
- Events endpoint: mock Ticketmaster response → verify date filtering + caching
- Search: existing search tests + numbered pin rendering
- Conflict tags: unit tests for each tag condition (heat, jet lag, sunset, crowded)
- Travel date bar: renders correctly with various date ranges including multi-city
