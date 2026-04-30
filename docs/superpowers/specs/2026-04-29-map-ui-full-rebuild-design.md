# Uncover Roads — Full Map UI Rebuild Design Spec
**Date:** 2026-04-29
**Status:** Awaiting user approval
**Replaces:** All previous map/itinerary specs

---

## 1. Overview & Philosophy

The current map→itinerary flow is broken at every handoff. This spec discards the existing implementation and rebuilds from scratch with a clean architecture.

**Core philosophy:**
- The map is the single source of truth. The itinerary is always an output, never an editing surface.
- The engine decides everything. The LLM only narrates.
- Verified data (Google Places) for facts. AI text only for tone, feeling, and persona-matched narrative.
- Every engine action emits a WHAT + WHY + CONSEQUENCE message.

**The magic moment:** "I'm a [type of traveler] going to [city] → here's your map → here's your day."

---

## 2. Complete User Journey

### Phase 1 — Auth
- Login / OAuth (unchanged)
- Branch: `persona in localStorage` → skip to Destination. No persona → OB flow.

### Phase 2 — Onboarding (9 steps)
Collects the full 10-dimension engine weight vector. See Section 4.

### Phase 3 — Persona Reveal
Full-screen moment. Story-driven + visually rich. See Section 5.

### Phase 4 — Destination + Map (core loop)
City + date range selection → map with three pin layers → explore → build itinerary.
Multi-city supported. See Sections 6 & 7.

### Phase 5 — Itinerary
Read-only output. Engine decisions visible. Edit via map. See Section 8.

### Phase 6 — Persistence
Saved trips, saved places, profile. See Section 9.

---

## 3. What's Deleted

| File | Lines | Reason |
|---|---|---|
| `ItineraryView.tsx` | 1,325 | Architectural debt. Replaced by 3 focused components. |
| `ItineraryCards.tsx` | 1,016 | Same. |
| `FavoritesLayer.tsx` | 215 | Broken centroid marker. Replaced by proper per-pin state. |
| `AmbientVideo.tsx` | — | Video background removed. Weather animation on card instead. |
| `TravelDateBar.tsx` | 586 | Replaced by single calendar on destination screen. |

**MapScreen.tsx** (818 lines) is rebuilt from scratch — not modified.

---

## 4. Onboarding — Expanded Engine Weight Vector

### Current OB Structure (unchanged steps, expanded resolver)

| Step | Question | Primary Output |
|---|---|---|
| OB1 | Who's travelling? | `social_flags`, triggers OB8 |
| OB2 | Trip mood (multi, max 3) + crowd aversion | `venue_weights`, `w_crowd_aversion` |
| OB3 | Pace (multi, max 2, conflict-detected) | `stops_per_day`, `time_per_stop`, `flexibility` |
| OB4 | How do you move through a city? | `w_walk_affinity`, `transport_openness`, `mobility_level` |
| OB5 | Dietary | `dietary_flags` |
| OB6 | Budget | `price_min`, `price_max`, `w_budget_sensitivity` |
| OB7 | Evening style | `evening_end_time`, `w_nightlife` |
| OB8 | Kid focus (conditional: group=family) | `kid_focus` |
| OB9 | Spontaneity ("If we spot something great, tell you?") | `w_spontaneity` |

### OB4 — Movement Style (replaces morning ritual framing)

> *"How do you move through a city?"*
> - On foot, always — I'll walk anywhere → `w_walk: 0.95, transport: walk_first`
> - Mix of walking and transit → `w_walk: 0.6, transport: mixed`
> - Transit first, short walks only → `w_walk: 0.3, transport: transit_first`
> - Comfort first — taxi/rideshare when needed → `w_walk: 0.15, transport: comfort_first`

Morning ritual (coffee shop / breakfast / straight to it) folded into `day_buffer_min` derived from pace, not a separate question.

### OB2 — Crowd Aversion Added

After mood selection, a follow-up modifier:
> *"How do you feel about popular spots?"*
> - Love them → `w_crowd_aversion: 0.1`
> - Fine if worth it → `w_crowd_aversion: 0.4`
> - Prefer quieter → `w_crowd_aversion: 0.7`
> - Actively avoid crowds → `w_crowd_aversion: 0.95`

### OB9 — Spontaneity (universal, not just for budget users)

> *"If we spot something great along the way, should we tell you?"*
> - Always — I love detours → `w_spontaneity: 1.0`
> - Sometimes, if it fits → `w_spontaneity: 0.6`
> - Only if it adds no time → `w_spontaneity: 0.3`
> - Keep me on plan → `w_spontaneity: 0.0`

### Engine Weight Vector (10 dimensions)

```typescript
interface EngineWeights {
  w_walk_affinity: number       // 0–1: enjoyment of walking
  w_scenic: number              // 0–1: scenic routes vs efficient
  w_efficiency: number          // 0–1: tight schedule preference
  w_food_density: number        // 0–1: frequency of food/cafe inserts
  w_culture_depth: number       // 0–1: depth at cultural sites
  w_nightlife: number           // 0–1: evening/night weighting
  w_budget_sensitivity: number  // 0–1: penalise expensive inserts
  w_crowd_aversion: number      // 0–1: avoid high-crowd times
  w_spontaneity: number         // 0–1: openness to detours
  w_rest_need: number           // 0–1: frequency of rest breaks
}
```

### Archetype Resolved via Cosine Similarity

```typescript
// Reference vectors per archetype [walk, scenic, efficiency, food, culture, nightlife, budget, crowd, spontaneity, rest]
const ARCHETYPE_VECTORS: Record<ArchetypeId, number[]> = {
  wanderer:      [0.9, 0.95, 0.2, 0.6, 0.7, 0.4, 0.5, 0.8, 0.97, 0.6],
  historian:     [0.7, 0.6,  0.6, 0.4, 1.0, 0.2, 0.4, 0.7, 0.4,  0.5],
  epicurean:     [0.5, 0.4,  0.5, 1.0, 0.5, 0.6, 0.3, 0.4, 0.6,  0.4],
  pulse:         [0.3, 0.3,  0.8, 0.7, 0.3, 1.0, 0.5, 0.2, 0.5,  0.2],
  slowtraveller: [0.8, 0.8,  0.1, 0.7, 0.6, 0.3, 0.6, 0.9, 0.7,  0.9],
  voyager:       [0.4, 0.5,  0.9, 0.5, 0.6, 0.5, 0.7, 0.3, 0.4,  0.3],
  explorer:      [0.8, 0.7,  0.5, 0.5, 0.6, 0.4, 0.5, 0.5, 0.8,  0.5],
}

function resolveArchetype(w: EngineWeights): ArchetypeId {
  const userVec = Object.values(w)
  let best: ArchetypeId = 'wanderer', bestScore = -1
  for (const [id, vec] of Object.entries(ARCHETYPE_VECTORS)) {
    const dot = vec.reduce((s, v, i) => s + v * userVec[i], 0)
    const mag = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    const score = dot / (mag(vec) * mag(userVec))
    if (score > bestScore) { bestScore = score; best = id as ArchetypeId }
  }
  return best
}
```

---

## 5. Persona Reveal Screen

### Layout
- Full screen, dark background
- Top 55%: mood image (Unsplash, archetype-matched, brightness 0.55, gradient overlay to bottom)
- Archetype pill badge over image (bottom-left): e.g. `THE WANDERER`
- Bottom 45%: card body

### Card Body
1. **Headline** — serif font, 22px, 3 lines max. One word in archetype accent color.
   - Example: *"You don't follow itineraries. You follow curiosity."*
2. **Story paragraph** — 2-3 sentences, persona voice. Written by LLM from weight vector. Marked ✦.
3. **Trait chips** — 4-6 chips derived from top engine weight signals. Accent-colored for top 2.
4. **Primary CTA** — "See your map →" (full width, archetype accent color, strong glow)
5. **Secondary CTA** — "↺ Retake questions" (ghost, small, muted — below primary)

### Archetype Colors
```
wanderer:      #34d399 (green)
historian:     #fbbf24 (amber)
epicurean:     #f87171 (red)
pulse:         #f9a8d4 (pink)
slowtraveller: #c4b5fd (purple)
voyager:       #60a5fa (blue)
explorer:      #86efac (light green)
```

### Content Rules
- Story copy: LLM-generated from archetype + top 3 weight signals. No factual claims. Marked ✦.
- Trait chips: derived deterministically from engine weights, not LLM-generated.
- Retake: clears `rawOBAnswers` → restarts from OB1.

---

## 6. Destination Screen

### Layout
1. **City search** — autocomplete (Google Places city search)
2. **Travel date range** — single calendar, tap start date then end date. Shows trip duration: "5 days"
3. **Discovery mode toggle** (appears after city selected):
   - `[ Show me the essentials ]  [ Show me what locals know ]`
   - Maps to `discovery_mode: 'anchor' | 'deep'` per city
   - No "first timer" language — framed as intent, not experience
4. **"Go →"** CTA — disabled until city + at least one date selected

### Multi-City
Discovery mode is set **per city** — each city added gets its own toggle when it's first entered on the map.

---

## 7. Map Screen

### Pin Layers (three simultaneous layers)

**Layer 1 — Famous Pins** (gold/star)
- Source: Google Places top-rated landmarks + hand-curated for Tier 1 cities
- Visual: gold/amber color, star icon, medium size
- Always visible by default. Togglable via filter chip: `★ Famous`
- `discovery_mode: 'anchor'` → full famous layer shown
- `discovery_mode: 'deep'` → famous layer de-emphasised (50% opacity), hidden gem pins boosted

**Layer 2 — Reference Ghost Pins** (muted purple, 50% opacity)
- Source: engine-generated on destination select. LLM prompt: *"Give me 8–10 places a [persona] traveler should visit in [city] for [N] days."*
- Visual: muted purple, smaller, 50% opacity, no animation
- Toggleable via filter chip: `✦ For you`
- Context-chained in multi-city: prompt includes what user did in previous cities

**Layer 3 — User-Added Pins** (blue, most prominent)
- Pins the user has explicitly added to their itinerary
- Visual: blue ring, solid background, slightly larger

### Pin States (4 states, can combine)

| State | Visual | Meaning |
|---|---|---|
| Normal | Default map pin | Place exists on map |
| Saved | Pin + small ❤️ badge (red) | User bookmarked — NOT in itinerary |
| Added to itinerary | Blue ring + solid bg | In the trip |
| Saved + Added | Blue ring + ❤️ badge | Both — user bookmarked AND added |

### Pin Card (40% bottom sheet, expandable)

Slides up on pin tap. Swipe down or tap map to dismiss.

**Always visible (40% view):**
- Hero image (Google Photos → Wikipedia fallback)
- Place name (large, bold) + area label
- Rating + review count (Google Places — factual, not LLM)
- Archetype pill: "Why this for you" — one sentence, persona-matched (LLM ✦, no facts)
- Max 2 intel pills — travel-date open/close alert (from Google Places hours + `tripContext.date`), entry requirement if any
- **CTAs:** `❤️ Save`  `+ Add to itinerary`  `✦ Similar`

**Pull-up to expand (full sheet):**
- All above +
- Local tip — one insider line (LLM ✦, atmospheric only, no factual claims)
- Google Maps link pill + Website pill
- Cultural note if relevant (from city data model — verified, not LLM)
- Photo gallery (Google Places photos)

**Content rules:**
- "Why this for you": LLM-generated, marked ✦, persona tone only — no hours/prices/facts
- "Local tip": LLM-generated, marked ✦, atmosphere only
- All factual data sourced from Google Places API
- Intel pills: deterministic logic from `tripContext.date` vs Google Places `weekday_text`

### Similar Places CTA Flow
1. Card slides down
2. Map zooms to fit active pin + similar cluster
3. LLM query: *"4 places similar to [place] in [city] for [persona]"*
4. Existing matching pins glow teal (ripple pulse)
5. New results added as ghost reference pins
6. Dashed teal connectors draw from active pin to each similar
7. Banner: *"Similar [category] nearby · Tap to explore · Swipe to clear"*

### Map CTAs

**"Build itinerary" button** — appears when user has added ≥1 pin. Sticky bottom bar.
- Shows: `Build itinerary · 4 places · 3 days`

**"Surprise Me" button** — always visible, separate from build.
- Pulls from broader Google Places (beyond visible map pins)
- Builds full N-day itinerary using engine + persona + city + dates
- Goes straight to itinerary view (counts as 1 generation)
- Single city only — multi-city needs intentional planning

### Filter Bar
Category chips: All · ★ Famous · ✦ For you · 🏛 Culture · 🍜 Food · 🌿 Parks · 🎭 Nightlife · ...

---

## 8. Multi-City Flow

### Trigger
User taps a pin geographically in a different city while exploring City A.

### Confirmation Snap (not a modal)
> *"Exploring [City B]?"*
> `[ Yes, add [City B] ]  [ Stay in [City A] ]`

Prevents accidental city switches. Dismisses in 5 seconds if no action.

### City-Hop Animation
1. Map zooms out showing both cities
2. Dashed arc draws City A → City B
3. ✈️ icon flies along arc
4. Story card loads over faded map (persona-matched, city-specific content)
5. Map zooms into City B
6. City B reference pins + famous pins load

### Story Cards During Load
- Heavy travel imagery + micro-animation
- Context-aware: Tokyo → Kyoto: *"Kyoto has 1,600 temples. Most visitors only see 3."*
- Persona-filtered content
- LLM-generated during same call as City B reference pins — no extra latency
- Content rules: atmospheric/factual-general only. No specific operational claims.

### Context-Chaining LLM Prompt
```
"What should a [persona] traveler do in [City B] arriving from [City A]
after [N] days doing [City A user picks]? [M]-day trip."
```

### City Footprint Chips
- Appears at top of map after second city added
- Format: `🗼 Tokyo · 4 pins → 🏯 Kyoto`
- Tapping chip pans map to that city's pin cluster — no screen change
- Shows pins explored, not itinerary stops

### Discovery Mode Per City
When City B loads, discovery mode prompt fires for that city specifically:
> *"How do you want to explore Kyoto?"*
> `[ Essentials ]  [ Local's pick ]`

### Multi-City Itinerary Structure
```
Day 1 — Tokyo     (engine-sequenced, persona-matched)
Day 2 — Tokyo
Day 3 — ✈️ Travel day — Tokyo → Kyoto
         (engine: airport time, arrival activity suggestion)
Day 4 — Kyoto     (context-chained from Tokyo)
Day 5 — Kyoto
```

Travel day is a first-class itinerary item. Engine knows not to schedule sightseeing during transit.

---

## 9. Intelligence Engine

### Architecture
```
User pin set + persona + city data + dates + weather
      ↓
Layer 1: Hard Constraint Resolution   (opening hours, weather, physical feasibility)
      ↓
Layer 2: Sequence Optimization        (geo clustering, time-of-day scoring, TSP)
      ↓
Layer 3: Transition Scoring           (walk vs transit per city context)
      ↓
Layer 4: Insert Detection             (coffee, scenic walks, lunch, micro-moments)
      ↓
Layer 5: Swap Engine                  (auto-swap conflicts, emit message)
      ↓
LLM: Narrates WHAT + WHY + CONSEQUENCE for each engine decision
      ↓
Itinerary output
```

### Layer 1 — Hard Constraints

**Opening hours conflict:**
```
if arrival_time > closing_time - 30min:
  find similar(place, city, persona)
    .filter(open at arrival_time)
    .sort_by(similarity_score)
  → auto_swap → emit message
```

**Physical feasibility:**
```
walk_feasible = (
  distance_km <= max_comfortable_walk_km[temp_band]
  AND city.walkability(A→B) >= 0.5
  AND weather.is_walkable
  AND temp BETWEEN city.cold_threshold AND city.heat_threshold
)
if NOT walk_feasible → recommended_mode = city.transit_edges[A→B].recommended_mode
```

**Weather hard blocks:**
```
if stop.type == 'outdoor' AND rain_intensity > 'light':
  → emit WEATHER_ALERT with umbrella/indoor alternative
if temp > heat_threshold AND walk_distance > max_walk_km[hot]:
  → force transit, inject weather reason into message
```

**City event calendar:**
```
if travel_date intersects city.events:
  if event.impact.engine_action == 'incorporate':
    → event becomes itinerary anchor
  if 'warn':
    → emit event advisory message
  if 'reroute':
    → avoid city center, reroute to peripheral neighborhoods
```

### Layer 2 — Sequence Optimization

```
clusters = group_by_neighborhood(user_stops)

for each cluster:
  internal_order = solve_TSP(cluster.stops)   // small N, exact solution

cluster_order = sort_by(
  neighborhood_best_time_score(time_of_day) DESC,
  inter_cluster_transit_cost ASC
)

ordering_score(sequence) =
  Σ(neighborhood_time_score(stop, arrival_time))
  - Σ(transit_cost(stop_i → stop_i+1))
  - Σ(backtrack_penalty(stop_i, stop_i+1))
  + Σ(persona_affinity(stop, persona) × time_of_day_weight)
```

**Time-of-day scoring:**
```
time_score(stop, arrival_time) =
  stop.neighborhood.best_times[time_bucket(arrival_time)]
  × city.time_windows[stop.type].in_window(arrival_time)
  × (1 - stop.neighborhood.crowd_index[day_type] × W.crowd_aversion)
```

**Day boundary rules:**
- `evening_end_time` from persona profile = hard day end
- `day_buffer_min` from OB4 = start of Day buffer before first stop
- Lunch window: 12:00–14:00 (city-adjusted for local dinner culture)
- Siesta: city-specific `engine_modifiers.siesta_window` if defined

### Layer 3 — Transition Scoring

```
transition_score(A, B, mode) =
  base_score(mode, A, B)
  + scenic_bonus(A, B, mode, W)
  - time_cost_penalty(mode, W)
  - weather_penalty(mode, weather)
  + insert_opportunity_score(A, B, mode, W)

scenic_bonus =
  best_scenic_route(A, B).quality_score
  × W.scenic
  × weather.walkable_bonus

time_cost_penalty =
  (transition_duration_min / 60) × W.efficiency × 2.0

recommended_mode = argmax(transition_score(A, B, mode))
  for mode in city.available_modes
```

### Layer 4 — Insert Detection

```
for each transition A → B:
  gap_min = scheduled_departure(B) - arrival(B_via_transit)

  if gap_min >= 15:
    candidates = city.insert_candidates
      .filter(route_proximity <= 400m)
      .filter(time_cost_min <= gap_min - 5)
      .filter(is_open(arrival_time))
      .score_by(insert_affinity_score(W, time_of_day))

    if best_candidate.score >= threshold(W.spontaneity):
      → inject between A and B
```

**Insert affinity score:**
```
score =
  insert.persona_affinity[archetype]
  × time_of_day_match(insert, time)
  × (1 - crowd_penalty × W.crowd_aversion)
  × weather_compatibility(insert, weather)
  × budget_compatibility(insert, W.budget_sensitivity)
  × trigger_condition_met(insert.trigger)
```

**Persona-specific triggers:**
```
W.walk_affinity > 0.7 AND gap >= 10min AND scenic_route exists → inject scenic walk
user.traits includes 'coffee' AND time_since_last_coffee > 180min → inject coffee insert
gap >= 60min AND 12:00–14:30 AND no lunch today → inject lunch (persona-filtered)
W.rest_need > 0.7 AND stops_since_break >= 3 → inject rest buffer (15min)
rain AND next_stop.outdoor AND no umbrella_alert_sent → emit weather advisory
```

### Layer 5 — Swap Engine

```
swap_score(stop) =
  hard_constraint_violations(stop)
  + soft_score_delta(stop, sequence)

if swap_score > SWAP_THRESHOLD:
  alternatives = find_alternatives(stop, city, persona).top(3)
  → auto_swap(stop → alternatives[0])
  → emit SWAP_MESSAGE
```

### Message Format

Every engine action emits:
```typescript
interface EngineMessage {
  type: 'swap' | 'insert' | 'resequence' | 'weather' | 'transit' | 'advisory' | 'event'
  what: string        // "Moved Senso-ji to 8am and added a walk through Yanaka"
  why: string         // "Senso-ji is best before crowds, and Yanaka is on your route"
  consequence: string // "You'll reach Ueno by noon with 3 hours before it closes"
  dismissable: boolean
  undo_action?: string // action key to reverse this decision
}
```

LLM writes the three sentences from a structured `{type, data}` payload. LLM never sees raw stop list and decides — it only narrates.

---

## 10. City Data Model

### Tier Structure

| Tier | Cities | Data source | Engine capability |
|---|---|---|---|
| Tier 1 | 80 (45 existing + 35 new) | Google seeded + LLM-assisted + human-curated | Full engine, all 5 layers |
| Tier 2 | 300+ | Google Places auto-seeded | Layers 1–3, no scenic inserts |
| Tier 3 | Unlimited | Google Places on-demand | Layers 1–2, base sequencing |

### Tier 1 Additional Cities (35)

**Europe:** Lisbon, Porto, Amsterdam, Prague, Vienna, Budapest, Dubrovnik, Santorini, Reykjavik, Edinburgh

**Asia:** Bangkok, Bali, Chiang Mai, Ho Chi Minh City, Hanoi, Mumbai, Delhi, Colombo, Kathmandu, Bali

**Americas:** Buenos Aires, Medellín, Lima, Mexico City, Cartagena, Havana, Montreal, Vancouver, New Orleans

**Middle East/Africa:** Marrakech, Cairo, Amman, Muscat, Cape Town, Nairobi

**Oceania:** Melbourne, Sydney, Auckland

### City Data Structure

```typescript
interface CityData {
  id: string
  name: string
  country: string
  timezone: string
  center: [number, number]
  bounds: GeoJSON.BBox
  tier: 1 | 2 | 3

  climate: {
    heat_threshold_c: number
    cold_threshold_c: number
    humidity_modifier: number
    rain_walk_penalty: number
    shoulder_months: number[]
    peak_months: number[]
    monsoon_months: number[]
  }

  movement: {
    avg_walk_speed_kmh: number
    avg_transit_wait_min: number
    available_modes: TransitMode[]
    walkability_global: number
    max_comfortable_walk_km: Record<'hot'|'warm'|'cool'|'cold', number>
    cycling_available: boolean
  }

  culture: {
    tipping_norm: 'none'|'optional'|'expected'|'mandatory'
    dress_codes: Record<string, string>
    shoe_removal_norms: string[]
    photography_restrictions: Record<string, string>
    religious_calendar: CityEvent[]
    language_barrier: number
    english_signage: number
  }

  temporal: {
    monthly: Record<Month, MonthProfile>
    weekly: Record<DayOfWeek, DayProfile>
    daily: Record<TimeBucket, DayCharacter>
  }

  neighborhoods: Neighborhood[]
  micro_districts: MicroDistrict[]
  scenic_routes: ScenicRoute[]
  transit_edges: TransitEdge[]
  insert_candidates: InsertCandidate[]
  time_windows: PlaceTimeWindow[]

  personality: {
    archetypes: string[]
    pace: 'frenetic'|'moderate'|'slow'
    food_philosophy: string
    time_culture: string
    weather_personality: string
  }

  engine_modifiers: {
    walk_score_multiplier: number
    lunch_window_strict: boolean
    siesta_window: [string, string] | null
    dinner_hour_local: string
    sunday_closures: string[]
    monday_closures: string[]
  }

  landmark_anchors: string[]    // placeIds — famous pins, discovery_mode: anchor
  hidden_gems: string[]         // placeIds — discovery_mode: deep
  local_insider: string[]       // placeIds — return/local users only

  persona_city_affinity: Partial<Record<ArchetypeId, number>>
}
```

### Curation Pipeline (Tier 1)
1. Auto-seed from Google Places API (hours, not days per city)
2. LLM-assisted enrichment — structured JSON candidates, not live content
3. Human review + approval — 4–6 hours per city
4. Weekly automated re-fetch for hours/rating changes → human review queue for flagged items

---

## 11. Itinerary Screen

### Layout
- **Header:** `[ ← ]  Tokyo · 5 days  [ Edit trip ]`
- **Day tabs:** horizontal scroll — `Day 1  Day 2  Day 3 ···`
- **Stop cards:** vertical list per day
- **Engine message banners:** between stops where engine made a decision

### Stop Card
- Stop number + time (e.g. "Stop 2 · 10:30am")
- Place name (large) + area + duration + price level (from Google Places)
- "Why this for you" — LLM ✦, persona tone only
- Max 2 intel pills (factual — from Google Places + city data)
- Detour banner if applicable (amber) — WHAT + WHY + CONSEQUENCE + `[ Add ]  [ Skip ]`
- Local tip — LLM ✦
- Google Maps link + Website (from Google Places)

### Engine Message Banners
Between stop cards, dismissable:
```
"We moved Senso-ji to 8am"  ←  WHAT
"It closes at 5pm and you'd arrive at 4:30"  ←  WHY
"You now reach Ueno with 3 hours to spare"  ←  CONSEQUENCE
[ Undo ]  [ ✕ ]
```

### Swipe-to-Remove (only inline edit)
- Swipe left on any stop card → remove handle appears
- Tap: confirmation snap: *"Remove [place]? This will rebuild your itinerary."*
- `[ Remove & rebuild ]  [ Cancel ]`
- Rebuild counts as 1 generation
- If generation limit reached → paywall prompt

### Edit Trip Flow
- Tap "Edit trip" in header
- Map opens with `itinerary_pin_set` snapshot loaded — exact pins from last build
- User removes/adds pins freely
- Tap "Rebuild itinerary" → full engine re-run → counts as 1 generation
- New itinerary saved as new entry. Previous preserved in trips history.

### Multi-Day / Multi-City Itinerary
- Day tabs show travel day explicitly: `Day 1  Day 2  ✈️ Day 3  Day 4  Day 5`
- Travel day card: departure time, flight/transit info, arrival activity suggestion
- Engine does not schedule stops on travel days

### Generation Counter
- Every "Build itinerary", "Rebuild itinerary", "Surprise Me" = +1 to `generationCount`
- Counter shown subtly: *"3 of 5 free itineraries used"*
- At threshold → paywall prompt (non-blocking, can dismiss once)

### AI Content Labelling
- All LLM-generated text marked with ✦ indicator (tappable — explains what it means)
- Factual data (hours, ratings, prices, addresses) has no AI marker
- Itinerary footer: *"Uncover Roads helps you discover places — always check local conditions and official travel advisories before visiting."*

---

## 12. Saved Places Screen

Separate from itinerary. Accessed via bottom nav.

- List of all ❤️ saved places across all cities
- Grouped by city
- Tap → opens place detail (same 40% card)
- "Add to next trip" CTA → opens destination screen with place pre-loaded
- Places persist indefinitely — not tied to any single itinerary

---

## 13. Bottom Navigation

| Tab | Icon | Screen |
|---|---|---|
| Explore | 🗺 | Destination + Map |
| Itinerary | 📋 | Current itinerary / Trips list |
| Saved | ❤️ | Saved places screen |
| Profile | 👤 | Profile + persona retake |

---

## 14. Content Safety Rules

### What the LLM Can Generate
- "Why this for you" (tone, persona match, atmosphere — no facts)
- Local tip (feeling, atmosphere — no operational claims)
- WHAT + WHY + CONSEQUENCE messages (structured input, narrative output)
- Persona reveal story copy
- City-hop story card content
- Archetype headline copy on persona reveal

### What the LLM Cannot Generate
- Opening hours, prices, admission costs
- Dietary certifications (halal/kosher) — always show: *"Listed as halal-friendly — verify with restaurant"*
- Safety verdicts — use descriptive framing: *"Most visitors explore this area during daylight"*
- Health advice — link to official travel advisories
- Queue tips or booking claims
- Transport costs or pass validity

### LLM Prompt Structure Rule
```
BAD:  "Write a tip about Senso-ji"  → LLM invents facts
GOOD: "Write one sentence for a [archetype] explaining why [place] at [time]
       matches their travel style. Do not include hours, prices, or facts.
       Only describe the atmosphere and persona fit."
```

### Data Source Tagging
Every content field in city data model has:
```typescript
{
  text: string
  source: 'curated' | 'llm_generated' | 'google_places'
  verified_date: string
  verified_by: string | null
}
```

### Privacy
- Persona weight vector stored locally (localStorage) by default
- Only synced to server if user creates account
- Dietary flags treated as sensitive data — used only for filtering, never shared
- No selling persona data to third parties

### Legal Disclaimer (shown once per session, itinerary footer)
> *"Uncover Roads helps you discover places — always check local conditions, official travel advisories, and your own comfort before visiting any location."*

---

## 15. New Components Required

### Map Module
| Component | Replaces | Purpose |
|---|---|---|
| `MapScreen.tsx` (rebuild) | `MapScreen.tsx` (818 lines) | Clean map container |
| `FamousPinsLayer.tsx` | `FavoritesLayer.tsx` | Gold star famous pins |
| `ReferencePinsLayer.tsx` | Part of MapScreen | Ghost reference pins |
| `UserPinsLayer.tsx` | `MapLibreMarkers.tsx` | User-added pins with states |
| `PinCard.tsx` (rebuild) | `PinCard.tsx` (437 lines) | 40%/full card with new design |
| `SurpriseMeButton.tsx` | — | Surprise Me CTA |
| `CityHopOverlay.tsx` | Existing (update) | City-hop animation + story |
| `FootprintChips.tsx` | Existing (update) | City footprint chip bar |
| `BuildItineraryBar.tsx` | — | Sticky bottom bar with pin count |
| `DiscoveryModeToggle.tsx` | — | Essentials / Local's pick |

### Route Module
| Component | Replaces | Purpose |
|---|---|---|
| `RouteScreen.tsx` (rebuild) | `RouteScreen.tsx` (408 lines) | Itinerary view container |
| `ItineraryDayView.tsx` | `ItineraryView.tsx` (1325 lines) | Day-level stop list |
| `ItineraryStopCard.tsx` | `ItineraryCards.tsx` (1016 lines) | Individual stop card |
| `EngineMessageBanner.tsx` | — | WHAT+WHY+CONSEQUENCE banner |
| `TravelDayCard.tsx` | — | Multi-city travel day |

### Onboarding Module
| Component | Change | Purpose |
|---|---|---|
| `OB4DayOpen.tsx` | Replace | Movement style question |
| `OB9BudgetProtect.tsx` | Replace | Spontaneity question |
| `ob-resolver.ts` | Expand | Output full engine weight vector |
| `ob-conflict-map.ts` | Expand | New weight mappings |

### Shared
| Component | Purpose |
|---|---|
| `SavedPlacesScreen.tsx` | New saved places tab |
| `PersonaScreen.tsx` (rebuild) | Story + mood image reveal |
| `DestinationScreen.tsx` (update) | Single calendar + discovery mode |

---

## 16. Files to Delete

```
src/modules/route/ItineraryView.tsx
src/modules/route/ItineraryCards.tsx
src/modules/map/FavoritesLayer.tsx
src/modules/route/AmbientVideo.tsx
src/modules/map/TravelDateBar.tsx       (replaced by single calendar on destination)
src/modules/map/TripPlanningCard.tsx    (replaced by BuildItineraryBar)
```

---

## 17. State Changes Required

### New State Fields
```typescript
interface AppState {
  // Existing fields preserved...

  // NEW
  engineWeights: EngineWeights | null
  discoveryMode: Record<string, 'anchor' | 'deep'>   // per city
  itineraryPinSet: Place[]                            // snapshot for edit-trip
  generationCount: number
  cityFootprints: CityFootprint[]
  savedPlaces: FavouritedPin[]                        // renamed from favouritedPins
  multiCityJourney: CityJourneyLeg[]                  // ordered city list
}
```

### New Actions
```
SET_ENGINE_WEIGHTS
SET_DISCOVERY_MODE (cityId, mode)
SAVE_ITINERARY_PIN_SNAPSHOT
INCREMENT_GENERATION_COUNT
ADD_CITY_FOOTPRINT
TOGGLE_SAVED_PLACE          (replaces TOGGLE_FAVOURITE)
SET_MULTI_CITY_JOURNEY
```

---

## 18. Out of Scope (this spec)

- Navigation/turn-by-turn (NavScreen unchanged)
- Subscription/paywall UI (SubscriptionScreen unchanged — just wire generation counter)
- Community tab (remains disabled)
- Backend Python changes (separate spec)
- City data population (implementation task, not frontend)
- Real-time collaboration / trip sharing
