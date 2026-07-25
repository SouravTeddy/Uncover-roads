# Scenic Route Cards — Design Spec

**Goal:** Surface scenic walking and driving corridors between itinerary stops as their own reel cards. The card highlights the journey, not a destination — what makes this particular path worth noticing, what the user will pass, and what the atmosphere is like.

**Distinct from reco/stop cards:** Reco cards add a place to visit. Scenic cards describe the act of moving between two places already in the plan. No CTA to add anything — the route is already how the user gets there.

---

## Two-Phase Pipeline

Route cards are a Phase 2 concern. Phase 2 never starts until Phase 1 (scheduling) is complete. This ensures `condition_multiplier` is always computed against authoritative visit times — never stale.

```
PHASE 1 — SCHEDULING (must complete first)
  All stops (user-added + engine-added)
    → stop ordering
    → visit_time assignment for every stop
    → locked schedule

PHASE 2 — ROUTE CARD COMPUTATION (uses Phase 1 output)

  Per corridor (stop pair with locked visit_times):

  ┌─ CACHED (time-independent, 30-day TTL in route_profile_cache) ─┐
  │  Google Directions walking polylines + instruction text          │
  │  ORS surface / waytype extras                                    │
  │  OSM Overpass 7-dimension feature query                          │
  │    → character_scores{}, top_character, path_names,              │
  │      landmark_peeks[], route_type                                │
  └───────────────────────────────────────────────────────────────── ┘
              +
  ┌─ ALWAYS FRESH (computed at render, never cached) ──────────────┐
  │  visit_time from Phase 1                                         │
  │  weather (OpenWeatherMap) at destination stop                    │
  │  UV index (Open-Meteo) at corridor midpoint                      │
  │  sun position (pysolar) from visit_time + lat/lon                │
  │  canopy cover % from character_scores cache                      │
  │    → condition_multiplier                                        │
  └───────────────────────────────────────────────────────────────── ┘

  Final decision: max(character_scores) × user_weight × condition_multiplier ≥ 0.55
  If yes → generate ReelScenicCard with LLM why/sensory text
```

### On itinerary update (stop added or removed)

```
Stop added between A and B:
  → Re-run Phase 1 for the affected day → new visit_times
  → Phase 2: corridors A→X and X→B are new (cache miss → full compute)
  → Phase 2: other corridors in the day whose visit_time crossed a
    time-of-day boundary (before noon / noon–5pm / after sunset)
    → reuse cached character_scores, recompute condition_multiplier only
  → Remove A→B route card from reel

Stop removed (C between B and D):
  → Re-run Phase 1 → new visit_times
  → Phase 2: corridor B→D (cache hit if previously computed, else miss)
  → Remove B→C and C→D route cards from reel
```

Time-of-day boundary check is intentional, not an arbitrary guard — morning, afternoon, and evening are genuinely different route experiences.

### On trip details added (hotel, check-in/check-out time)

```
Hotel added:
  → Hotel becomes terminal stop for the day
  → Phase 1 re-runs with check-in time as hard deadline
  → Backward scheduling from check-in time
  → Phase 2 re-runs for any corridor whose visit_time crossed a boundary
  → hotelAnchor populated on stops within 1 km of hotel

Check-in time added/changed:
  → Hard upper bound on Phase 1 for that day
  → Propagates timing adjustments backward through the day

Check-out time added/changed:
  → Hard lower bound on Phase 1 start time
  → Propagates timing forward through the day
```

Route card generation is always downstream of scheduling. `condition_multiplier` is never stored — always derived from the current Phase 1 output.

---

## Data Sources

### 1. Google Directions — walking step polylines (existing API, unused data)

We already call `mode=walking` between every stop pair to populate `TransitInfo`. The response contains `steps[].polyline.points` (encoded polyline per step) which we currently discard.

**Extract:**
- Decode all step polylines → concatenate into full route geometry
- Sample 20 evenly-spaced points along the path (same method as `_sample_linestring`)
- Store sampled points for Overpass queries

**Instruction text scan:**
- Scan `steps[].html_instructions` (full text, not just bold tokens) for per-dimension keywords
- Keywords and dimensions are defined in the Route Character Scoring section below
- Weight each keyword hit by step distance (`step.distance.value`) so longer steps carry more signal
- Also flag named routes: "Thames Path", "Yanaka shopping street", etc. → stored in `path_names`

**Cost:** Zero. Data already in the Directions response we pay for.

### 2. ORS Directions — surface and waytype extras (existing API, unused data)

ORS v2 Directions returns `extras` per segment when requested. We already call ORS for `_fetch_route_profile`. Adding `extras=surface,waytypes,suitability` to the existing request returns:

**Surface values relevant to scenic cards:**
- `0` = Unknown, `1` = Paved, `2` = Unpaved, `3` = Gravel, `4` = Dirt, `5` = Stone, `6` = Concrete
- Unpaved/gravel/dirt → outdoor/trail feel → scenic weight +0.3

**Waytype values:**
- `0` = State road, `1` = Road, `2` = Path, `3` = Street, `4` = Cycleway, `5` = Footway
- Footway/path → pedestrian-dedicated route → scenic weight +0.2

**Cost:** ORS free tier is 2,000 requests/day. We already use this quota. Adding `extras` to the existing call costs nothing extra — same request.

**Implementation:** Add `"extra_info": ["surface", "waytypes", "suitability"]` to the ORS JSON body in `_fetch_route_profile`. Parse `extras.surface.values` and `extras.waytypes.values` alongside existing fields.

### 3. OSM Overpass — natural features near route

Query OSM for features within 100m of sampled route points. We already use Overpass for `_fetch_footway_density` at city seed time.

**New per-route query:** `_fetch_route_character(points)` — single query covering all 7 character dimensions. Only runs after a preliminary gate check (see Task 4).

```
[out:json][timeout:25];
(
  /* Natural */
  way["natural"~"water|wood|beach|cliff|coastline"](around:120,{coords});
  way["leisure"~"park|garden|nature_reserve|common"](around:120,{coords});
  /* Waterfront */
  way["waterway"~"river|canal|stream"](around:80,{coords});
  /* Historic */
  way["historic"](around:100,{coords});
  relation["route"~"walking|hiking|historic"](around:100,{coords});
  /* Vibrant */
  node["amenity"~"bar|restaurant|cafe|fast_food|market_place"](around:80,{coords});
  node["shop"](around:80,{coords});
  /* Photogenic */
  node["tourism"="artwork"](around:100,{coords});
  way["tourism"="artwork"](around:100,{coords});
  /* Viewpoint */
  node["tourism"="viewpoint"](around:500,{coords});
);
out tags qt;
```

**Returns:** tagged OSM elements; parsed into per-dimension feature counts and named features.

**Timing:** Once per stop pair, cached in `route_profile_cache`. Never called on reel render.

**Cost:** Overpass is free (~10,000 req/day on public instance). Gate check (Task 4) prevents queries for low-value routes.

### 4. Open-Meteo / OpenTopoData — elevation (already used)

We already sample elevation at 20 points per route via `_fetch_elevations`. This is already in `route_profile_cache`. No change needed — existing `elevation_gain_m` and `sample_elevations` contribute to the scenic score for drives (hilly = more scenic).

---

## Route Character Scoring

"Scenic" is the wrong framing. A busy nightlife street, a photogenic market alley, or a gap between towers that reveals Mount Fuji are all routes worth a card. The pipeline scores seven independent character dimensions and picks the strongest match for the card.

### Seven character dimensions

| Dimension | OSM signals | Good for |
|---|---|---|
| **Natural** | `natural=*`, `leisure=park/garden`, `waterway=*` | Broad appeal |
| **Viewpoint** | `tourism=viewpoint` within 500m + bearing toward a known landmark | Photo travelers, sightseers |
| **Historic** | `historic=*`, named heritage trails via `route=walking/historic` | Culture travelers |
| **Vibrant** | High density `amenity=bar/restaurant/shop/market` | Nightlife, food, city lovers |
| **Photogenic** | `tourism=artwork`, `mural=yes`, street art tags | Social media travelers |
| **Waterfront** | `waterway=river/canal`, `natural=coastline/beach` | Broad appeal |
| **Local** | Residential highway types, low amenity density, no chain tags | Slow travel, anti-tourist |

Each dimension scores 0–1 independently from the Overpass query. A single route can score high on multiple dimensions (vibrant + historic, waterfront + photogenic). The engine picks the top-scoring dimension to drive card content, but all dimensions with score > 0.4 are stored for card detail text.

### Instruction text keywords by dimension

Scan `html_instructions` full text per walking step. Keywords contribute to the relevant dimension score:

| Dimension | Keywords |
|---|---|
| Natural | canal, riverside, waterfront, park, garden, trail, forest, woods, promenade, esplanade, lakeside |
| Viewpoint | viewpoint, overlook, observatory, panorama, deck, rooftop |
| Historic | temple, shrine, palace, castle, heritage, old town, historic, cathedral, monastery |
| Vibrant | market, bazaar, street food, shopping, arcade, strip, nightlife, bar street |
| Photogenic | mural, street art, gallery, mosaic, sculpture |
| Waterfront | harbour, port, pier, seafront, bay, beach, embankment |
| Local | lane, alley, neighbourhood, backstreet, residential |

### Walk and drive scoring

**Walk routes:**
```
character_score[dim] = (
    overpass_density[dim]   * 0.45 +   # 0–1: matching feature count / normalised
    instruction_score[dim]  * 0.35 +
    ors_surface_score       * 0.20     # footway/path surface boosts all dimensions
)
```

**Drive routes:**
```
character_score[dim] = (
    overpass_density[dim]   * 0.40 +
    road_character          * 0.35 +   # existing field: 0=motorway, 1=rural
    elevation_score         * 0.25     # 0–1: gain_m / 500 clamped to 1
)
```

**Threshold:** `max(character_scores) × user_preference_weight × condition_multiplier ≥ 0.55`
**Minimum distance:** 0.5 km. No upper limit — city walkability varies; Tokyo residents walk 10+ km daily, that's a valid scenic card.

---

## Landmark Peek Check

Some routes pass close enough to a major landmark that, at a specific point, the traveler gets an unexpected view — a gap between buildings revealing Mount Fuji, a break in the treeline showing a cathedral spire.

**Algorithm:**
1. Pull `city_data.landmark_anchors` — currently `list[str]` (place names). Coordinates are resolved by looking up each name in `map_data_cache` or `place_id_cache` (Google Places already fetched these). If a landmark has no cached coordinates, skip it for the peek check.
2. For each sampled route point, compute bearing toward each resolved landmark using the haversine bearing formula.
3. The main Overpass query (Data Source 3 above) already fetches `tourism=viewpoint` within 500m. Reuse those results — no second Overpass call.
4. If a viewpoint's OSM `direction=*` tag is within ±45° of the bearing to the landmark → flag. If no `direction=` tag, flag anyway if the viewpoint is within 500m and any sampled route point has a clear bearing line toward the landmark.
5. Store: `{"landmark": "Mount Fuji", "at_coords": [lat, lon], "bearing_deg": 262, "viewpoint_name": "Shinjuku Gyoen viewpoint"}`

If no `direction=` tag exists on the viewpoint, proximity alone (within 500m) is sufficient signal.

Landmark peek adds a `+0.25` bonus to the Viewpoint dimension score and generates a specific card line naming the landmark and the point to look from.

---

## Condition Multiplier

Applied after character scoring. Reduces or blocks the card based on real-time conditions at the time of the walk.

### Hard blockers — card never shown

- Route is motorway/trunk for > 60% of its length (ORS waytype confirms no pedestrian value)
- Route < 0.5 km
- Active thunderstorm or heavy rain at walk time (weather data)
- Mode is transit — no route experience to highlight

### Soft multipliers

| Condition | Signal | Multiplier |
|---|---|---|
| Temperature > 32°C + UV index > 7 + exposed route (no `natural=wood` or `leisure=park` adjacent) | Weather API | × 0.4 |
| Temperature > 32°C + shaded route (park/canopy cover along ≥ 40% of route) | Weather + Overpass | × 0.9 |
| Light rain (< 3mm/hr) | Weather API | × 0.5 |
| Night (after sunset) + Natural/Local/Waterfront dimensions | Sun position calc | × 0.4 |
| Night + Vibrant/Photogenic dimensions | Sun position calc | × 1.2 |
| Golden hour (±30 min of sunset) + Viewpoint dimension | Sun position calc | × 1.3 |

**Weather data fields available:**

| Field | Source | Used for |
|---|---|---|
| `temp` (°C, int) | OpenWeatherMap `/weather` | Heat check |
| `condition` (string: "Rain", "Thunderstorm", "Clear", etc.) | OpenWeatherMap `/weather` | Hard block conditions |
| `sunrise` / `sunset` (Unix timestamp) | OpenWeatherMap `/weather` | Night check, golden hour window |
| `uv_index` (float 0–11+) | Open-Meteo `/forecast?hourly=uv_index` at route lat/lon | UV multiplier |

OpenWeatherMap does not return UV index. Fetch it from Open-Meteo hourly forecast — already used for elevation. Add `uv_index` to the existing Open-Meteo call in `_fetch_elevations` or make a separate lightweight call at the stop's lat/lon.

Weather is fetched per stop; use the weather of the stop the user is walking *toward* (the destination stop of the corridor).

**Sun position computation:**

Use the `pysolar` library (`pip install pysolar`) — already available in Python standard scientific stack. Call `pysolar.solar.get_altitude(lat, lon, datetime)` and `pysolar.solar.get_azimuth(lat, lon, datetime)` to get sun elevation (degrees above horizon) and azimuth (compass bearing). Golden hour = sun elevation between −4° and +6°.

### LLM content guardrails

The `why` and `sensory` text on a route card is LLM-generated. The LLM must only make claims grounded in fields we actually have:

**Allowed claims (data-backed):**
- Route proximity: "passes X m from it" — from route geometry
- Schedule logic: "you have Y minutes between these stops" — from itinerary timing
- Temperature/heat: "it'll be 34°C at this time" — from weather data
- Rain: "light drizzle expected" — from weather data
- UV / shade advice: "high UV, the route has shade cover" — from weather + Overpass canopy
- Sun angle: "light hits the west face at 4:30 PM" — from sun position computation
- Landmark peek: "Mount Fuji visible from the second intersection" — from landmark peek check
- Named features: "you'll walk past Yanaka Cemetery" — from Overpass named features
- Instruction text: street names from Google Directions response

**Prohibited (LLM hallucination risk):**
- Crowd claims not backed by `signals.crowd_ratio`
- Lighting direction claims without sun position data
- Historical facts about streets not in our place data
- Viewpoint quality claims ("the best view in Tokyo") without a `tourism=viewpoint` tag backing it

---

## User Preference Matching

Character scores are multiplied by how well the dimension matches the traveler. We have rich stored profile data — no inference needed.

### Primary source: `EngineWeights`

`EngineWeights` is stored in `personaSnapshot` on each `EngineItineraryStop`. For a route card between two stops, use the **destination stop's** `personaSnapshot` (the stop you are walking toward). Map its fields directly to character dimension multipliers:

| `EngineWeights` field | Character dimensions boosted | Multiplier |
|---|---|---|
| `w_scenic` | Natural, Viewpoint, Waterfront | `1 + w_scenic * 0.6` |
| `w_nightlife` | Vibrant (night), Photogenic | `1 + w_nightlife * 0.8` |
| `w_culture_depth` | Historic | `1 + w_culture_depth * 0.6` |
| `w_food_density` | Vibrant (market/food streets) | `1 + w_food_density * 0.5` |
| `w_walk_affinity` | All walking route cards | `1 + w_walk_affinity * 0.4` |
| `w_spontaneity` | Reduces threshold: `threshold = 0.55 - w_spontaneity * 0.10` | n/a |
| `w_efficiency` | Penalises routes that significantly deviate: score × `(1 - w_efficiency * 0.3)` when `route_distance_km > haversine_distance_km * 2.0` (haversine = straight-line between the two stops) | n/a |

### Secondary source: `Persona.attractions` (onboarding answers)

`attractions: Attraction[]` is `'historic' | 'culture' | 'markets' | 'nature'`. Additive on top of `EngineWeights`:

| `attractions` value | Additional boost |
|---|---|
| `'nature'` | Natural +0.15, Waterfront +0.10 |
| `'historic'` | Historic +0.15 |
| `'culture'` | Historic +0.10, Photogenic +0.10 |
| `'markets'` | Vibrant +0.15 |

### Tertiary source: `PersonaKey`

`Persona.archetype` maps to `PersonaKey`. Per-persona adjustments for dimensions not already covered by `EngineWeights`:

| `PersonaKey` | Route card adjustments |
|---|---|
| `flaneur` | Local +0.20, all walking routes threshold −0.05 |
| `gastronaut` | Vibrant (food-tagged routes) +0.20 |
| `slowScholar` | Historic +0.20, route card shown even at lower score if `historic > 0.4` |
| `neighbourhoodLocal` | Local +0.25, Vibrant −0.10 (prefers quiet streets over busy ones) |
| `efficientExplorer` | All weights neutral; penalise any route that adds > 15% to stop-to-stop distance |
| `aesthete` | Photogenic +0.20, Viewpoint +0.15 |
| `nightCreature` | Vibrant × 1.5 after sunset; Natural × 0.3 after sunset |
| `ritualSeeker` | Local +0.15, Vibrant (market-tagged) +0.15 |

### Route cards between user-added stops

Generate route cards between user-added stops too. The user knows *where* they want to go — they don't know *which route* to take to get there. A scenic walk card between two user-chosen stops is high-value, not intrusive.

---

## Route Character Labels

Top dimension drives the card label and content framing:

| Top dimension | Card label | `sceneType` |
|---|---|---|
| Natural | Riverside walk / Forest trail / Through the park | `walk` |
| Viewpoint | Catch [Landmark] from here | `walk` or `drive` |
| Historic | [Street name] heritage walk | `walk` |
| Vibrant | [Street name] strip | `walk` |
| Photogenic | Street art corridor | `walk` |
| Waterfront | Along the [waterway name] | `walk` or `coastal` |
| Local | Through [neighbourhood name] | `walk` |
| Drive + elevation | Ridge road / Hill drive | `drive` |
| Drive + rural | Country road | `drive` |

---

## `route_profile_cache` Schema Changes

```sql
ALTER TABLE route_profile_cache
  ADD COLUMN character_scores     jsonb,        -- {"natural":0.8,"vibrant":0.1,...}
  ADD COLUMN top_character        text,         -- "natural" | "vibrant" | "historic" etc.
  ADD COLUMN path_names           jsonb,        -- ["Thames Path", "Embankment"]
  ADD COLUMN landmark_peeks       jsonb,        -- [{"landmark":"Mt Fuji","at_coords":[...],"bearing_deg":262}]
  ADD COLUMN route_type           text,         -- 'walk' | 'drive' | 'coastal' | 'ridge'
  ADD COLUMN route_computed_at    timestamptz;
```

`character_scores = NULL` means not yet computed. Engine checks for NULL and triggers lazy computation.

**Not stored:** `condition_multiplier` — always computed fresh at render time from Phase 1's `visit_time`. Storing it would require cache invalidation on every scheduling change. The computation is cheap (weather lookup + sun position math) so there is no benefit to caching it.

---

## `ReelScenicCard` Content Mapping

| Card field | Source |
|---|---|
| `sceneType` | `route_type` |
| `why` | LLM-generated from top character features + landmark peek if present; constrained to allowed data fields only |
| `sensory` | LLM-generated from top dimension: vibrant → sounds/smells of the street; natural → water sounds, birdsong |
| `from`, `to` | Stop titles |
| `detourKm`, `detourMin` | `distance_km`, `duration_min` from route profile |
| `modeIcon` | `walk` or `car` |
| `tag` | Route character label from table above |
| `transitInfo` | Existing `TransitInfo` (walk distance, via names) |
| `conditionNote` | Optional: "High UV today — there's shade along most of this route" |

---

## What This Does Not Include

- **Google Street View** — $7/1000, requires LLM to interpret images. Not worth it.
- **Google Roads API** — speed limits only, no route quality data.
- **Mapbox Directions** — duplicates ORS.
- **OSM `scenic=yes` tag** — sparse globally, unreliable. Overpass feature proximity is more consistent.

---

## Implementation Tasks

### Task 1 — Extract walking step polylines + transit cache migration
- File: `main.py`, function `_extract_walk_via` (line ~3034)
- `_sample_linestring()` already exists at `main.py:984` — reuse it directly
- Decode `steps[].polyline.points` using the standard Google polyline algorithm (each step has its own encoded polyline; concatenate all step coordinates into one list, then call `_sample_linestring(coords, n=20)`)
- Return sampled points alongside existing street names
- Store sampled points in new field `walk_route_points jsonb` on the `transit_corridor_cache` table
- Migration: `ALTER TABLE transit_corridor_cache ADD COLUMN walk_route_points jsonb;`

### Task 2 — Instruction text character scanner
- File: `main.py`, new function `_score_instructions_by_dimension(steps) -> dict[str, float]`
- Scan full `html_instructions` per step against per-dimension keyword lists
- Weight by step distance (longer steps carry more weight)
- Return `{"natural": 0.4, "vibrant": 0.1, "historic": 0.7, ...}` (0–1 per dimension)

### Task 3 — ORS extras extraction
- File: `main.py`, function `_fetch_route_profile`
- Add `"extra_info": ["surface", "waytypes"]` to ORS request body
- New function `_ors_surface_score(extras) -> float`
- Parse `extras.surface.values` and `extras.waytypes.values`
- Return surface score (0–1): footway + unpaved/gravel → high score

### Task 4 — Overpass route character query
- File: `main.py`, new function `_fetch_route_character(points: list[tuple]) -> dict`
- Single Overpass query covering all seven character dimensions (natural, historic, vibrant, photogenic, waterfront, local, viewpoint)
- Gate: only run if `max(instruction_scores) + road_character > 0.4` — skip Overpass for obviously low-value routes
- Return `{"character_scores": {...}, "named_features": [...], "viewpoints": [...]}`
- Cache result in `route_profile_cache`

### Task 5 — Landmark peek check
- File: `main.py`, new function `_check_landmark_peeks(points, city_landmarks) -> list`
- For each sampled route point, compute bearing toward each city landmark
- Query Overpass for `tourism=viewpoint` within 500m of those points
- Match viewpoints to landmark bearings (±45°)
- Return list of `{"landmark": str, "at_coords": tuple, "bearing_deg": int, "viewpoint_name": str}`

### Task 6 — Condition multiplier
- File: `main.py`, new function `_route_condition_multiplier(weather, uv_index, visit_time, lat, lon, overpass_features) -> float`
- `weather` dict: `{temp, condition, sunrise, sunset}` from OpenWeatherMap (already fetched for the destination stop)
- `uv_index`: float from Open-Meteo hourly `uv_index` field — add this to the existing `_fetch_elevations` Open-Meteo call or make a dedicated call at the corridor midpoint lat/lon
- `visit_time`: datetime of the walk (from itinerary)
- `lat, lon`: corridor midpoint (average of origin and destination stop coords)
- Sun position: use `pysolar.solar.get_altitude(lat, lon, visit_time)` and `get_azimuth(...)`. `pysolar` must be added to `requirements.txt`.
- `overpass_features`: reuse Task 4 output to check canopy cover (% of route with `natural=wood` or `leisure=park` adjacent)
- Apply multiplier table from Condition Multiplier section; return float in [0.0, 1.3]
- Hard block returns 0.0 for: `condition` in ("Thunderstorm", "Heavy Rain"), or motorway > 60% of route

### Task 7 — Character score computation
- File: `main.py`, new function `_score_route_character(...) -> dict`
- Combine Tasks 2–6 outputs with existing `road_character` and elevation from `route_profile_cache`
- Apply user preference weights from destination stop's `personaSnapshot.EngineWeights`, `Persona.attractions`, and `PersonaKey` per the User Preference Matching section
- Return `{"character_scores": dict, "top_character": str, "condition_multiplier": float, "landmark_peeks": list, "path_names": list, "route_type": str}`

### Task 8 — `route_profile_cache` migration + `pysolar` dependency
- File: `supabase/migrations/` + `requirements.txt`
- Add columns: `character_scores jsonb`, `top_character text`, `path_names jsonb`, `landmark_peeks jsonb`, `route_type text`, `route_computed_at timestamptz`
- Drop old `scenic_score float` column if it exists
- Add `pysolar` to `requirements.txt`

### Task 9 — `ReelScenicCard` TypeScript type update
- File: `frontend/src/modules/route/reel/types.ts`
- Add fields to `ReelScenicCard` interface: `conditionNote?: string`, `characterDimensions?: string[]` (secondary dimensions with score > 0.4, for detail text), `landmarkPeek?: { landmark: string; atCoords: [number, number]; bearingDeg: number }`
- `vizType` existing values (`corridor`, `route`, `sunset`, `elevation`, `quiet`, `canopy`) are kept — they are presentation choices made at card-generation time, not replacements for character dimensions. Map top character dimension to a `vizType` default: natural/waterfront → `corridor`, elevation → `elevation`, viewpoint → `sunset`, vibrant/historic/photogenic/local → `corridor`

### Task 10 — Engine route card generation
- File: `engine/` (route card generator)
- Check `max(character_scores) × user_weight × condition_multiplier ≥ 0.55` and `distance_km ≥ 0.5`
- No upper distance limit
- LLM generates `why` and `sensory` text using allowed-claims list only (character features, path names, landmark peek, weather fields, sun position, schedule timing — see LLM Content Guardrails)
- Set `vizType` based on top character: natural/waterfront → `corridor`, elevation drive → `elevation`, viewpoint → `sunset`, all others → `corridor`
- Insert between stop pairs in reel sequence

### Task 11 — Tests
- Unit test `_score_instructions_by_dimension` with sample Google Directions responses (one natural walk, one vibrant street, one mixed)
- Unit test `_ors_surface_score` with sample ORS extras
- Unit test `_route_condition_multiplier`: hard block cases (thunderstorm, motorway), golden hour bonus, night × vibrant boost
- Unit test `_check_landmark_peeks`: bearing calculation correctness, 500m radius boundary
- Unit test UV fetch from Open-Meteo: confirm `uv_index` field present in hourly response
- Integration test: full route character profile on a known scenic route (e.g., Thames Path segment between two London stops)
