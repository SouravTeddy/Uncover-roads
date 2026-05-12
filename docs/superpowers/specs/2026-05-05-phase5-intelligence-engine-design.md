# Phase 5 — Backend Intelligence Engine Design Spec
**Date:** 2026-05-05
**Status:** Approved
**Depends on:** Phase 1 (security infra, Supabase tables), Phase 3 (types/state)
**Blocks:** Phase 6 (itinerary screen rebuild)

---

## 1. Overview

Phase 5 builds the backend intelligence engine — the deterministic 5-layer system that turns a set of user-added pins + persona weights + city data into an optimized, narrated itinerary. It also builds the City Intelligence Sync, a weekly background job that tracks how places change over time.

**Two parts:**

| Part | What it builds |
|---|---|
| A — Itinerary Engine | 5-layer Python engine + `/api/itinerary/build` endpoint |
| B — City Intelligence Sync | APScheduler weekly job, signal processor, stage classification |

**Core principles:**
- The engine is deterministic. The LLM only narrates decisions — it never makes them.
- Every engine action emits a structured `EngineMessage` (WHAT + WHY + CONSEQUENCE).
- Narration is a single batched LLM call at the end — not one call per decision.
- City data lives in Supabase. Engine and Sync read/write the same table.

---

## 2. Module Structure

The backend is reorganized from a monolith into a proper package layout. `main.py` stays as a thin router.

```
uncover-roads/
├── main.py                          # thin router — imports from packages below
├── ip_engine.py                     # kept as-is (OB resolver, persona, archetype)
├── engine/
│   ├── __init__.py
│   ├── constraints.py               # Layer 1: hard constraint resolution
│   ├── sequencer.py                 # Layer 2: sequence optimization (TSP + time-of-day)
│   ├── transitions.py               # Layer 3: transition scoring (walk/transit/scenic)
│   ├── inserts.py                   # Layer 4: insert detection (coffee, lunch, scenic walks)
│   ├── swapper.py                   # Layer 5: auto-swap conflicts, emit messages
│   ├── narrator.py                  # LLM narration: WHAT + WHY + CONSEQUENCE per decision
│   └── builder.py                   # orchestrator — wires all 5 layers + narrator
├── city/
│   ├── __init__.py
│   ├── data_model.py                # CityData dataclass, load from Supabase
│   ├── seed/
│   │   ├── tokyo.json
│   │   ├── paris.json
│   │   └── nyc.json
│   ├── signal_processor.py          # NLP keyword clustering on review text
│   └── sync_job.py                  # APScheduler weekly sync
└── tests/
    ├── fixtures/
    │   ├── cities/                  # tokyo.json, paris.json, nyc.json subsets
    │   └── personas/                # one JSON per archetype
    ├── engine/
    │   ├── test_constraints.py
    │   ├── test_sequencer.py
    │   ├── test_transitions.py
    │   ├── test_inserts.py
    │   └── test_swapper.py
    └── city/
        ├── test_data_model.py
        └── test_signal_processor.py
```

---

## 3. Engine Layer Contracts

Layers chain sequentially. Each layer receives the current stop list + context and returns a modified stop list + messages emitted.

### Shared Types

```python
@dataclass
class EngineStop:
    place_id: str
    name: str
    lat: float
    lon: float
    category: str                    # 'museum' | 'restaurant' | 'park' | etc.
    duration_min: int
    opening_hours: list[dict]        # Google Places weekday_text
    price_level: int                 # 0–4
    rating: float
    neighborhood: str | None
    outdoor: bool                    # derived from category on deserialization (park/beach/viewpoint → True)
    is_user_added: bool              # False = engine-inserted
    scheduled_time: str | None       # ISO time, set by sequencer
    transition_to_next: str | None   # 'walk'|'transit'|'rideshare', set by transitions layer
    type: str | None                 # 'coffee'|'lunch'|'scenic_walk'|'rest' for inserts

@dataclass
class EngineContext:
    persona: dict                    # archetype + full weight vector
    city: CityData
    travel_dates: list[str]          # ISO date strings, one per day
    weather: dict | None
    generation_count: int

@dataclass
class EngineMessage:
    type: str        # 'swap'|'insert'|'resequence'|'weather'|'transit'|'advisory'|'event'
    what: str        # structured text — narrator rewrites to natural language
    why: str
    consequence: str
    dismissable: bool
    undo_key: str | None

@dataclass
class EngineDay:
    date: str
    stops: list[EngineStop]
    is_travel_day: bool

@dataclass
class EngineResult:
    days: list[EngineDay]
    messages: list[EngineMessage]
    generation_id: str
    recommendations: list[dict] | None   # populated when stop count < day count
```

### Layer Chain (`builder.py`)

```python
async def build_itinerary(stops: list[EngineStop], ctx: EngineContext) -> EngineResult:
    stops, msgs1 = constraints.resolve(stops, ctx)      # Layer 1
    stops, msgs2 = sequencer.optimize(stops, ctx)       # Layer 2
    stops, msgs3 = transitions.score(stops, ctx)        # Layer 3
    stops, msgs4 = inserts.detect(stops, ctx)           # Layer 4
    stops, msgs5 = swapper.check(stops, ctx)            # Layer 5
    all_messages = msgs1 + msgs2 + msgs3 + msgs4 + msgs5
    narrated = await narrator.narrate(all_messages, ctx)  # single batched LLM call
    days = _split_into_days(stops, ctx)
    recs = await _get_recommendations(ctx) if _needs_recommendations(stops, ctx) else None
    return EngineResult(
        days=days,
        messages=narrated,
        generation_id=str(uuid.uuid4()),
        recommendations=recs
    )
```

### Layer 1 — Hard Constraints (`constraints.py`)

Resolves: opening hours conflicts, physical feasibility (walk distance vs weather/temp), weather hard blocks, city event calendar.

```python
def resolve(stops: list[EngineStop], ctx: EngineContext) -> tuple[list[EngineStop], list[EngineMessage]]:
    # closing time conflict → find similar open place, auto-swap, emit 'swap' message
    # outdoor stop + heavy rain → emit 'weather' message with indoor alternative
    # temp > heat_threshold + long walk → force transit, emit 'transit' message
    # travel date intersects city event → incorporate/warn/reroute, emit 'event' message
```

### Layer 2 — Sequence Optimization (`sequencer.py`)

Groups stops by neighborhood, solves TSP within each cluster (small N, exact), orders clusters by time-of-day score, applies day boundaries from persona (evening_end_time, day_buffer_min, lunch window, siesta).

```python
def optimize(stops: list[EngineStop], ctx: EngineContext) -> tuple[list[EngineStop], list[EngineMessage]]:
    clusters = _group_by_neighborhood(stops, ctx.city)
    for cluster in clusters:
        cluster.stops = _solve_tsp(cluster.stops)
    ordered_clusters = _order_clusters_by_time_score(clusters, ctx)
    flat = _flatten_with_day_boundaries(ordered_clusters, ctx)
    messages = _emit_resequence_messages(stops, flat)
    return flat, messages
```

**Scoring:**
```
ordering_score(sequence) =
  Σ(neighborhood_time_score(stop, arrival_time))
  - Σ(transit_cost(stop_i → stop_i+1))
  - Σ(backtrack_penalty(stop_i, stop_i+1))
  + Σ(persona_affinity(stop, persona) × time_of_day_weight)
```

### Layer 3 — Transition Scoring (`transitions.py`)

Scores walk vs transit vs rideshare for each A→B pair. Applies scenic bonus, time-cost penalty, weather penalty, insert opportunity score.

```python
def score(stops: list[EngineStop], ctx: EngineContext) -> tuple[list[EngineStop], list[EngineMessage]]:
    for i, (a, b) in enumerate(zip(stops, stops[1:])):
        mode = _best_mode(a, b, ctx)
        stops[i].transition_to_next = mode
        if mode != 'walk' and ctx.persona['weights']['w_walk_affinity'] > 0.7:
            messages.append(_emit_transit_message(a, b, mode, ctx))
```

### Layer 4 — Insert Detection (`inserts.py`)

For each A→B transition, checks gap duration. If gap ≥ 15min and an insert candidate scores above threshold (driven by w_spontaneity), injects between A and B.

**Persona-specific triggers:**
```
w_walk_affinity > 0.7 AND gap >= 10min AND scenic_route exists → inject scenic walk
gap since last coffee > 180min AND w_food_density > 0.5       → inject coffee
gap >= 60min AND 12:00–14:30 AND no lunch today                → inject lunch
w_rest_need > 0.7 AND stops_since_break >= 3                   → inject rest buffer
```

### Layer 5 — Swap Engine (`swapper.py`)

Final pass. Any stop still violating hard constraints after Layer 1 (e.g. cascading conflicts introduced by sequencing) is auto-swapped. Emits structured swap message.

```python
def check(stops: list[EngineStop], ctx: EngineContext) -> tuple[list[EngineStop], list[EngineMessage]]:
    for i, stop in enumerate(stops):
        score = _swap_score(stop, stops, ctx)
        if score > SWAP_THRESHOLD:
            alternatives = _find_alternatives(stop, ctx.city, ctx.persona)
            stops[i] = alternatives[0]
            messages.append(_emit_swap(stop, alternatives[0], ctx))
```

### Narrator (`narrator.py`)

Single batched LLM call. Receives all structured messages, returns the same messages with `what/why/consequence` rewritten in persona-matched prose.

```python
async def narrate(messages: list[EngineMessage], ctx: EngineContext) -> list[EngineMessage]:
    if not messages:
        return messages
    prompt = _build_batch_prompt(messages, ctx.persona)
    response = await anthropic_client.messages.create(
        model='claude-haiku-4-5-20251001',   # fast + cheap for narration
        max_tokens=2000,
        messages=[{'role': 'user', 'content': prompt}]
    )
    return _parse_narrated_messages(response, messages)
```

**Prompt rule:** LLM receives structured `{type, what_raw, why_raw, consequence_raw, persona}`. It rewrites to persona tone. It does not make routing decisions or add facts.

**Fallback:** If narration fails, return messages with raw structured text. Itinerary still renders — no 500.

---

## 4. City Data Model

### `city/data_model.py`

```python
@dataclass
class Neighborhood:
    id: str
    name: str
    center: tuple[float, float]
    polygon: list[tuple[float, float]]
    best_times: dict[str, float]         # time bucket → 0–1 score
    crowd_index: dict[str, float]        # 'weekday'|'weekend' → 0–1

@dataclass
class InsertCandidate:
    place_id: str
    name: str
    lat: float
    lon: float
    type: str                            # 'coffee'|'scenic_walk'|'lunch'|'rest'|'micro'
    time_cost_min: int
    persona_affinity: dict[str, float]   # archetype → 0–1
    trigger: str | None
    time_of_day_match: list[str]

@dataclass
class CityData:
    id: str
    name: str
    tier: int
    center: tuple[float, float]
    timezone: str
    climate: dict
    movement: dict
    culture: dict
    neighborhoods: list[Neighborhood]
    insert_candidates: list[InsertCandidate]
    scenic_routes: list[dict]
    transit_edges: list[dict]
    engine_modifiers: dict               # siesta_window, lunch_window_strict, etc.
    landmark_anchors: list[str]          # place_ids
    hidden_gems: list[str]               # place_ids

def load_city(city_id: str, supabase) -> CityData:
    """Load from Supabase. Falls back to seed JSON (dev only)."""
    row = supabase.table('city_data').select('data').eq('id', city_id).single().execute()
    if row.data:
        return _from_dict(row.data['data'])
    seed_path = Path(__file__).parent / f'seed/{city_id}.json'
    if seed_path.exists():
        return _from_dict(json.loads(seed_path.read_text()))
    raise HTTPException(404, 'city_not_found')
```

### Seeding (startup check)

At FastAPI startup, seed files for Tokyo, Paris, NYC are inserted into `city_data` if not already present:

```python
@app.on_event("startup")
async def seed_cities():
    for city_id in ['tokyo', 'paris', 'nyc']:
        existing = supabase.table('city_data').select('id').eq('id', city_id).execute()
        if not existing.data:
            seed = json.loads((Path('city/seed') / f'{city_id}.json').read_text())
            supabase.table('city_data').insert({'id': city_id, 'data': seed}).execute()
```

---

## 5. City Intelligence Sync

### Architecture (`city/sync_job.py`)

Embedded in FastAPI via APScheduler. Runs every Sunday at 2am UTC. Processes one city every 3 minutes to respect Google Places quota (~20 cities/hour).

```python
scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(sync_all_cities, 'cron', day_of_week='sun', hour=2)
    scheduler.start()

async def sync_all_cities():
    cities = supabase.table('city_data').select('id').execute().data
    for city in cities:
        await sync_city(city['id'])
        await asyncio.sleep(180)
```

### Signal Sources

| Source | Signal | How |
|---|---|---|
| Google Places | Review count, rating, velocity, photo recency | Places API (already integrated) |
| YouTube Data API v3 | Video titles, tags mentioning place | Keyword match on title/description |
| Reddit API | Post/comment sentiment | Subreddit keyword NLP |

### Signal Processing (`city/signal_processor.py`)

Deterministic keyword clustering — not LLM:

```python
CROWD_SIGNALS = ['crowded', 'packed', 'tourist trap', 'queues', 'overrated', ...]
HIDDEN_GEM_SIGNALS = ['hidden gem', 'locals only', 'off the beaten path', 'underrated', ...]
QUALITY_DECLINE_SIGNALS = ['used to be better', 'gone downhill', 'disappointed', ...]
VIRAL_SIGNALS = ['tiktok', 'instagram', 'went viral', 'influencer', ...]
```

### Stage Classification

```python
def classify_stage(signals: dict) -> str:
    rc    = signals['review_count']
    crowd = signals['crowd_mention_ratio']
    trend = signals['rating_trend']
    vel   = signals['velocity_ratio']

    if rc < 20:                           return 'unknown'
    if rc < 200 and crowd < 0.05:         return 'hidden_gem'
    if rc < 1000 and crowd < 0.20:        return 'rising'
    if rc >= 1000 and crowd < 0.50:       return 'mainstream'
    if crowd >= 0.50 or trend < -0.3:     return 'oversaturated'
    if trend < -0.5 and vel < 0.5:        return 'declining'
    return 'mainstream'
```

### Human Review Queue

Places flagged as `declining`, `oversaturated`, viral spikes, or quality decline → inserted into `human_review_queue` Supabase table. Reviewed via Supabase Studio. No custom admin UI needed at launch.

```python
def needs_human_review(signals: dict, stage: str) -> bool:
    return (
        stage in ('declining', 'oversaturated')
        or signals.get('viral_detected')
        or signals.get('quality_decline_detected')
    )
```

---

## 6. API Endpoint

### `POST /api/itinerary/build`

**Request:**
```json
{
  "stops": [
    { "place_id": "...", "name": "Senso-ji", "lat": 35.71, "lon": 139.79,
      "category": "temple", "opening_hours": [...], "price_level": 0, "rating": 4.6 }
  ],
  "city_id": "tokyo",
  "travel_dates": ["2026-06-01", "2026-06-02", "2026-06-03"],
  "persona": { "archetype": "wanderer", "weights": { "w_walk_affinity": 0.9, ... } },
  "discovery_mode": "deep"
}
```

**Response:** serialized `EngineResult` — days, messages, generation_id, optional recommendations.

**Auth:** `require_auth_or_pack` (existing dependency).

### Error States (frontend interprets — never shown raw to users)

| Code | Condition | What user sees |
|---|---|---|
| `city_not_found` | Unknown city_id | Blocked upstream — autocomplete only shows whitelisted cities |
| `generation_limit_reached` | Free tier limit hit | Paywall prompt (SubscriptionScreen) |
| `places_quota_exceeded` | Google Places quota | Button stays in loading state, silent retry |
| — | Fewer stops than days | Engine builds partial itinerary + appends persona-matched recommendations: *"Your trip has room for more — here are some places you might like"* |

---

## 7. Testing Strategy

All tests use fixture data. No live API calls — external services patched with `pytest-mock`.

**Fixtures:** `tests/fixtures/cities/` (subset of seed JSON per city), `tests/fixtures/personas/` (one JSON per archetype).

**Example tests:**

```python
# test_constraints.py
def test_closing_time_conflict_triggers_swap():
    stop = make_stop(place_id='senso_ji', closing_hour=17)
    ctx = make_ctx(arrival_time='16:45', persona='wanderer')
    result, messages = constraints.resolve([stop], ctx)
    assert result[0].place_id != 'senso_ji'
    assert any(m.type == 'swap' for m in messages)

def test_weather_hard_block_outdoor_stop():
    stop = make_stop(category='park', outdoor=True)
    ctx = make_ctx(weather={'rain_intensity': 'heavy'})
    result, messages = constraints.resolve([stop], ctx)
    assert any(m.type == 'weather' for m in messages)

# test_sequencer.py
def test_neighborhood_clustering():
    stops = [make_stop(neighborhood='shinjuku'), make_stop(neighborhood='shinjuku'),
             make_stop(neighborhood='asakusa')]
    result, _ = sequencer.optimize(stops, make_ctx())
    neighborhoods = [s.neighborhood for s in result]
    assert neighborhoods.index('asakusa') not in [0, 1]

# test_inserts.py
def test_coffee_insert_after_180min_gap():
    stops = [make_stop(duration_min=120), make_stop(start_offset_min=200)]
    ctx = make_ctx(persona_weights={'w_food_density': 0.8})
    result, messages = inserts.detect(stops, ctx)
    assert any(s.type == 'coffee' for s in result)

# test_signal_processor.py
def test_classify_hidden_gem():
    signals = {'review_count': 85, 'crowd_mention_ratio': 0.02,
               'rating_trend': 0.1, 'velocity_ratio': 1.2}
    assert classify_stage(signals) == 'hidden_gem'

def test_classify_oversaturated():
    signals = {'review_count': 2000, 'crowd_mention_ratio': 0.65,
               'rating_trend': -0.4, 'velocity_ratio': 0.8}
    assert classify_stage(signals) == 'oversaturated'
```

**Definition of done:** `pytest tests/` passes with 0 failures before any commit.

---

## 8. Out of Scope (this phase)

- Frontend itinerary screen (Phase 6)
- Destination screen + multi-city flow (Phase 7)
- City data population beyond Tokyo, Paris, NYC (ongoing curation task)
- Persona drift batch job (post-launch)
- Real-time collaboration / trip sharing
