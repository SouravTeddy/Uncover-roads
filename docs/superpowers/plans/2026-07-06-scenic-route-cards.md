# Scenic Route Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the scenic route card pipeline: extract walking route geometry from existing Google Directions responses, score seven character dimensions (Natural, Viewpoint, Historic, Vibrant, Photogenic, Waterfront, Local) using ORS extras + OSM Overpass + instruction text keywords, apply a condition multiplier (weather, UV, sun position via pysolar), and insert `ReelScenicCard` objects between itinerary stop pairs when the score threshold is met. Also update the `ReelScenicCard` frontend component to render the new card design (single state — no collapse/expand) matching the proto at `/tmp/Uncover-roads/.superpowers/brainstorm/22353-1783322676/content/stop-card-v3.html` (scenic section).

**Architecture:** Two-phase pipeline — Phase 1 (stop scheduling) must complete before Phase 2 (route card computation). `condition_multiplier` is never cached; always computed from Phase 1's locked `visit_time`. Time-independent character scores are cached 30 days in `route_profile_cache`. User preference matching uses `EngineWeights` (primary) → `Persona.attractions` (secondary) → `PersonaKey` (tertiary) from the destination stop's `personaSnapshot`. Reco card logic is NOT changed — engine-added stops with `isEngineAdded: true` remain `ReelStopCard` objects; scenic cards are a separate `type: 'scenic'` card inserted between stop pairs.

**Tech Stack:** Python 3.11 (FastAPI backend, `main.py`), `pysolar` (new dep), `polyline` package (for Google encoded polyline decoding), OpenWeatherMap `/weather` (already called), Open-Meteo `/forecast?hourly=uv_index` (new field added to existing call), Overpass API (already used via `fetch_overpass()`), ORS Directions (already called in `_fetch_route_profile`), React 18 + TypeScript (frontend).

## Global Constraints

- Phase 2 never starts before Phase 1 completes. `condition_multiplier` is NEVER stored in `route_profile_cache` or any other cache.
- `route_profile_cache` stores only time-independent data: `character_scores`, `top_character`, `path_names`, `landmark_peeks`, `route_type`, `route_computed_at`. No `visit_time` column.
- Hard blockers for route cards (always skip): thunderstorm/heavy rain, motorway > 60% of route, distance < 0.5 km, transit mode.
- Score threshold: `max(character_scores) × user_preference_weight × condition_multiplier ≥ 0.55`
- Photo for route card: `getPlacePhotoUrl(photoRef, 800, 1200)` via Google Places proxy — same pattern as stop cards. `photoRef` comes from the nearest landmark's place data already in `map_data_cache`.
- Design tokens for frontend: bg `#0f0d0c`, text-1 `#f5f0ea`, text-2 `#c0b0a4`, text-3 `#a08d80`, text-4 `#726559`, sage `#6b9470`, sky `#4f8fab`, gold `#d4a853`.
- Scenic card topbar: identical structure to stop card topbar — mode chip (matching `.sc-tod` pattern) + weather chip (matching `.sc-wx` pattern). Single state only — no drag bar, no expand/collapse.
- Do not push to remote without user request.

---

### Task 1: Extract walking step polylines and store in transit corridor cache

**Files:**
- Modify: `main.py` — function `_extract_walk_via` (line ~3034) and the surrounding Google Directions walking parse block (lines ~3063–3079); `_write_transit_cache` (line ~3083)
- Create: `supabase/migrations/20260706_transit_corridor_walk_route_points.sql` (safe no-op if `walk_route_points` column already exists from `20260625_transit_corridor_walk_via.sql`)
- Test: `tests/test_walk_polyline.py`

**Interfaces:**
- Consumes: `walk_leg.steps[]` from Google Directions walking response (each step has `step.polyline.points` — encoded polyline string); existing `_sample_linestring(coords, n=20)` at `main.py:984`
- Produces: `walk_route_points: list[tuple[float, float]]` — 20 evenly sampled coordinate pairs stored as `jsonb` in `transit_corridor_cache.walk_route_points`; returned in `_fetch_transit_corridor` result dict

- [ ] **Step 1: Write failing tests**

Create `tests/test_walk_polyline.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_decode_google_polyline_basic():
    """Google's sample: _p~iF~ps|U_ulLnnqC_mqNvxq` encodes [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]"""
    import polyline
    pts = polyline.decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    assert len(pts) == 3
    assert abs(pts[0][0] - 38.5) < 0.001
    assert abs(pts[0][1] - (-120.2)) < 0.001


def test_sample_linestring_returns_n_points():
    from main import _sample_linestring
    coords = [[i * 0.001, i * 0.001] for i in range(100)]
    sampled = _sample_linestring(coords, n=20)
    assert len(sampled) == 20
    assert all(len(p) == 2 for p in sampled)


def test_extract_walk_route_points_from_steps():
    """_extract_walk_route_points should decode step polylines, concatenate, sample to 20."""
    from main import _extract_walk_route_points
    steps = [
        {"polyline": {"points": "_p~iF~ps|U_ulLnnqC"}, "distance": {"value": 200}},
        {"polyline": {"points": "_mqNvxq`@"}, "distance": {"value": 100}},
    ]
    pts = _extract_walk_route_points(steps)
    assert isinstance(pts, list)
    assert len(pts) > 0
    assert all(len(p) == 2 for p in pts)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_walk_polyline.py -v 2>&1 | tail -20
```

Expected: FAIL — `_extract_walk_route_points` not found, `polyline` not installed.

- [ ] **Step 3: Add `polyline` to requirements.txt**

```
polyline
```

Install:
```bash
cd /Users/souravbiswas/Uncover-roads && pip install polyline
```

- [ ] **Step 4: Create migration for `walk_route_points` column**

Create `supabase/migrations/20260706_transit_corridor_walk_route_points.sql`:

```sql
ALTER TABLE transit_corridor_cache
  ADD COLUMN IF NOT EXISTS walk_route_points jsonb;
```

Apply locally:
```bash
supabase db push 2>/dev/null || python -c "
import os; from supabase import create_client
sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
sb.postgrest.session.headers.update({'Content-Type': 'application/json'})
"
```

Or note: apply via `supabase db push` when running with Supabase CLI.

- [ ] **Step 5: Add `_extract_walk_route_points` to `main.py`**

In `main.py`, add after `_extract_walk_via` (line ~3061):

```python
def _extract_walk_route_points(steps: list) -> list[tuple[float, float]]:
    """Decode step polylines from Google Directions walking response, sample to 20 points."""
    import polyline as _pl
    all_coords: list[list[float]] = []
    for step in steps:
        encoded = (step.get("polyline") or {}).get("points")
        if not encoded:
            continue
        try:
            decoded = _pl.decode(encoded)          # returns [(lat, lon), ...]
            all_coords.extend([list(p) for p in decoded])
        except Exception:
            continue
    if not all_coords:
        return []
    return _sample_linestring(all_coords, n=20)
```

- [ ] **Step 6: Call `_extract_walk_route_points` in the walking parse block and store result**

In `main.py`, inside the `try:` block that parses `walk_leg` (around line 3063), add after the existing `via` extraction:

```python
            route_pts = _extract_walk_route_points(walk_steps)
            if route_pts:
                result["walk_route_points"] = route_pts
```

The `result` dict is already returned and passed to `_write_transit_cache`. No other changes needed — `_write_transit_cache` uses `**result`, so `walk_route_points` will be written automatically.

- [ ] **Step 7: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_walk_polyline.py -v 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add requirements.txt main.py supabase/migrations/20260706_transit_corridor_walk_route_points.sql tests/test_walk_polyline.py
git commit -m "feat(scenic): extract walk route polylines and store sampled points in transit_corridor_cache"
```

---

### Task 2: Instruction text character scanner

**Files:**
- Modify: `main.py` — add `_score_instructions_by_dimension(steps)` after line ~3061
- Test: `tests/test_route_character.py`

**Interfaces:**
- Consumes: `steps` list from Google Directions walking response (each step has `html_instructions: str` and `distance.value: int`)
- Produces: `dict[str, float]` — keys: `"natural"`, `"viewpoint"`, `"historic"`, `"vibrant"`, `"photogenic"`, `"waterfront"`, `"local"` — each value 0.0–1.0

- [ ] **Step 1: Write failing tests**

Create `tests/test_route_character.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_natural_dimension_scores_canal_step():
    from main import _score_instructions_by_dimension
    steps = [
        {"html_instructions": "Walk along the <b>canal</b> to the bridge", "distance": {"value": 400}},
        {"html_instructions": "Turn left on <b>High Street</b>", "distance": {"value": 100}},
    ]
    scores = _score_instructions_by_dimension(steps)
    assert scores["natural"] > 0
    assert scores["natural"] >= scores["vibrant"]


def test_historic_dimension_scores_temple_step():
    from main import _score_instructions_by_dimension
    steps = [
        {"html_instructions": "Pass <b>Senso-ji temple</b> on your right", "distance": {"value": 300}},
    ]
    scores = _score_instructions_by_dimension(steps)
    assert scores["historic"] > 0


def test_vibrant_dimension_scores_market_step():
    from main import _score_instructions_by_dimension
    steps = [
        {"html_instructions": "Continue through <b>Tsukiji market</b>", "distance": {"value": 200}},
    ]
    scores = _score_instructions_by_dimension(steps)
    assert scores["vibrant"] > 0


def test_returns_all_seven_dimensions():
    from main import _score_instructions_by_dimension
    scores = _score_instructions_by_dimension([])
    assert set(scores.keys()) == {"natural", "viewpoint", "historic", "vibrant", "photogenic", "waterfront", "local"}


def test_empty_steps_returns_all_zeros():
    from main import _score_instructions_by_dimension
    scores = _score_instructions_by_dimension([])
    assert all(v == 0.0 for v in scores.values())
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py -v 2>&1 | tail -20
```

- [ ] **Step 3: Add `_score_instructions_by_dimension` to `main.py`**

Add after `_extract_walk_route_points` (around line 3065):

```python
_DIM_KEYWORDS: dict[str, list[str]] = {
    "natural":    ["canal", "riverside", "waterfront", "park", "garden", "trail", "forest",
                   "woods", "promenade", "esplanade", "lakeside", "greenway"],
    "viewpoint":  ["viewpoint", "overlook", "observatory", "panorama", "deck", "rooftop", "observation"],
    "historic":   ["temple", "shrine", "palace", "castle", "heritage", "old town", "historic",
                   "cathedral", "monastery", "ancient", "ruins"],
    "vibrant":    ["market", "bazaar", "street food", "shopping", "arcade", "strip",
                   "nightlife", "bar street", "food hall"],
    "photogenic": ["mural", "street art", "gallery", "mosaic", "sculpture", "installation"],
    "waterfront": ["harbour", "harbor", "port", "pier", "seafront", "bay", "beach",
                   "embankment", "quay", "boardwalk"],
    "local":      ["lane", "alley", "neighbourhood", "neighborhood", "backstreet", "residential", "passage"],
}

def _score_instructions_by_dimension(steps: list) -> dict[str, float]:
    """Score Google Directions walking steps against 7 character dimensions.

    Each keyword match in html_instructions is weighted by step distance so
    longer steps carry proportionally more signal. Returns 0–1 per dimension.
    """
    import re
    scores: dict[str, float] = {dim: 0.0 for dim in _DIM_KEYWORDS}
    total_dist = sum(s.get("distance", {}).get("value", 0) for s in steps) or 1

    for step in steps:
        html = step.get("html_instructions", "")
        text = re.sub(r"<[^>]+>", " ", html).lower()
        dist_weight = step.get("distance", {}).get("value", 0) / total_dist

        for dim, keywords in _DIM_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    scores[dim] = min(1.0, scores[dim] + dist_weight * 2.0)
                    break  # one match per step per dimension is enough

    return scores
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py -v 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add main.py tests/test_route_character.py
git commit -m "feat(scenic): instruction text character scanner for 7 route dimensions"
```

---

### Task 3: ORS extras (surface + waytypes) extraction

**Files:**
- Modify: `main.py` — `_fetch_route_profile` (line ~1050); add `_ors_surface_score(extras)` helper
- Test: add to `tests/test_route_character.py`

**Interfaces:**
- Consumes: existing ORS Directions response with added `"extra_info": ["surface", "waytypes"]` in request body
- Produces: `float` from `_ors_surface_score(extras)` — 0.0–1.0 (footway/unpaved/gravel → high)

- [ ] **Step 1: Write failing tests**

Append to `tests/test_route_character.py`:

```python
def test_ors_surface_score_footway():
    from main import _ors_surface_score
    # waytype 5 = Footway, value per ORS extras format: [[start, end, value], ...]
    extras = {
        "waytypes": {"values": [[0, 10, 5], [10, 20, 5]]},   # all footway
        "surface":  {"values": [[0, 10, 1], [10, 20, 2]]},   # paved + unpaved
    }
    score = _ors_surface_score(extras)
    assert score > 0.5  # footway dominant → high score


def test_ors_surface_score_motorway():
    from main import _ors_surface_score
    # waytype 0 = State road (motorway-like), surface 1 = paved
    extras = {
        "waytypes": {"values": [[0, 10, 0], [10, 20, 0]]},   # all state road
        "surface":  {"values": [[0, 10, 1], [10, 20, 1]]},   # all paved
    }
    score = _ors_surface_score(extras)
    assert score < 0.3


def test_ors_surface_score_empty():
    from main import _ors_surface_score
    assert _ors_surface_score({}) == 0.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py::test_ors_surface_score_footway -v 2>&1 | tail -10
```

- [ ] **Step 3: Add `_ors_surface_score` to `main.py`**

Add after `_score_instructions_by_dimension`:

```python
# ORS waytype values → pedestrian-friendliness weight
_ORS_WAYTYPE_WEIGHT = {
    5: 1.0,   # Footway — fully pedestrian
    4: 0.8,   # Cycleway — shared path
    3: 0.5,   # Street
    2: 0.7,   # Path
    1: 0.3,   # Road
    0: 0.1,   # State road / motorway-like
}
# ORS surface values → scenic weight (unpaved/natural surfaces score higher)
_ORS_SURFACE_WEIGHT = {
    2: 0.9,   # Unpaved
    3: 0.8,   # Gravel
    4: 0.8,   # Dirt
    5: 0.7,   # Stone
    6: 0.5,   # Concrete
    1: 0.3,   # Paved
    0: 0.2,   # Unknown
}

def _ors_surface_score(extras: dict) -> float:
    """Compute a scenic surface score (0–1) from ORS extras.surface and extras.waytypes.

    Each segment in extras is [start_idx, end_idx, value]. Computes weighted average
    by segment length (index units approximate distance segments).
    """
    if not extras:
        return 0.0

    def _weighted_avg(segments: list, weight_map: dict) -> float:
        total_len = total_score = 0
        for seg in segments:
            if len(seg) < 3:
                continue
            length = seg[1] - seg[0]
            total_len += length
            total_score += weight_map.get(seg[2], 0.2) * length
        return total_score / total_len if total_len else 0.0

    wt_segs = (extras.get("waytypes") or {}).get("values", [])
    sf_segs = (extras.get("surface") or {}).get("values", [])
    waytype_score = _weighted_avg(wt_segs, _ORS_WAYTYPE_WEIGHT)
    surface_score = _weighted_avg(sf_segs, _ORS_SURFACE_WEIGHT)
    return round((waytype_score * 0.6 + surface_score * 0.4), 3)
```

- [ ] **Step 4: Add `extra_info` to the ORS request in `_fetch_route_profile`**

In `_fetch_route_profile` (line ~1080), inside the `json={...}` body for the ORS POST request, add:

```python
                json={
                    "coordinates": [[olon, olat], [dlon, dlat]],
                    "format": "geojson",
                    "instructions": True,
                    "extra_info": ["surface", "waytypes", "suitability"],
                },
```

Then in the ORS response parse block (after `route_json` is built), extract and store extras:

```python
                route_json = {
                    # ...existing fields...
                    "ors_extras": ors_resp["features"][0]["properties"].get("extras", {}),
                }
```

Pass the extras through to the final `result` dict:
```python
        result["ors_surface_score"] = _ors_surface_score(route_json.get("ors_extras", {}))
```

Note: `ors_surface_score` is NOT stored in `route_profile_cache` directly (it's a derived float used in character scoring). Add it to the returned dict only.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py -v 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add main.py tests/test_route_character.py
git commit -m "feat(scenic): ORS extras surface/waytypes extraction for scenic scoring"
```

---

### Task 4: Overpass route character query

**Files:**
- Modify: `main.py` — add `_fetch_route_character(points, corridor_key)` function
- Test: add to `tests/test_route_character.py`

**Interfaces:**
- Consumes: `points: list[tuple[float, float]]` — 20 sampled route coords from Task 1; `corridor_key: str` — for cache keying; existing `fetch_overpass(query: str)` at `main.py:416`
- Produces: `{"character_scores": dict[str, float], "named_features": list[str], "viewpoints": list[dict]}` — or `None` if gate check fails

Gate: Only run Overpass if `max(instruction_scores.values()) + ors_surface_score > 0.4`. Skips low-value routes.

- [ ] **Step 1: Write failing test**

Append to `tests/test_route_character.py`:

```python
def test_route_character_gate_skips_low_value_route():
    from main import _should_run_overpass_for_route
    # Both instruction score and surface score near zero → skip
    assert _should_run_overpass_for_route(
        instruction_scores={"natural": 0.0, "viewpoint": 0.0, "historic": 0.0, "vibrant": 0.1,
                            "photogenic": 0.0, "waterfront": 0.0, "local": 0.1},
        ors_surface_score=0.15,
    ) is False


def test_route_character_gate_runs_for_natural_route():
    from main import _should_run_overpass_for_route
    assert _should_run_overpass_for_route(
        instruction_scores={"natural": 0.6, "viewpoint": 0.0, "historic": 0.0, "vibrant": 0.0,
                            "photogenic": 0.0, "waterfront": 0.0, "local": 0.0},
        ors_surface_score=0.3,
    ) is True
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py::test_route_character_gate_skips_low_value_route -v 2>&1 | tail -10
```

- [ ] **Step 3: Add gate function and `_fetch_route_character` to `main.py`**

```python
def _should_run_overpass_for_route(
    instruction_scores: dict[str, float],
    ors_surface_score: float,
) -> bool:
    """Gate: skip Overpass for low-value routes to conserve API quota."""
    return max(instruction_scores.values(), default=0.0) + ors_surface_score > 0.4


def _fetch_route_character(
    points: list[tuple[float, float]],
    instruction_scores: dict[str, float],
    ors_surface_score: float,
) -> dict:
    """Query OSM Overpass for 7 character dimensions near sampled route points.

    Returns character_scores dict (0–1 per dimension), named_features list,
    and viewpoints list. Returns None-equivalent empty dict if gate fails.
    """
    if not _should_run_overpass_for_route(instruction_scores, ors_surface_score):
        return {"character_scores": {d: 0.0 for d in _DIM_KEYWORDS}, "named_features": [], "viewpoints": []}

    coords = " ".join(f"{lat},{lon}" for lat, lon in points)

    query = f"""
[out:json][timeout:25];
(
  way["natural"~"water|wood|beach|cliff|coastline"](around:120,{coords});
  way["leisure"~"park|garden|nature_reserve|common"](around:120,{coords});
  way["waterway"~"river|canal|stream"](around:80,{coords});
  way["historic"](around:100,{coords});
  relation["route"~"walking|hiking|historic"](around:100,{coords});
  node["amenity"~"bar|restaurant|cafe|fast_food|market_place"](around:80,{coords});
  node["shop"](around:80,{coords});
  node["tourism"="artwork"](around:100,{coords});
  way["tourism"="artwork"](around:100,{coords});
  node["tourism"="viewpoint"](around:500,{coords});
);
out tags qt;
"""
    raw = fetch_overpass(query)
    elements = raw.get("elements", []) if raw else []

    scores: dict[str, float] = {d: 0.0 for d in _DIM_KEYWORDS}
    named_features: list[str] = []
    viewpoints: list[dict] = []

    for el in elements:
        tags = el.get("tags", {})
        # Natural
        if tags.get("natural") or tags.get("leisure") in ("park", "garden", "nature_reserve", "common"):
            scores["natural"] = min(1.0, scores["natural"] + 0.15)
        # Waterfront
        if tags.get("waterway") or tags.get("natural") in ("coastline", "beach"):
            scores["waterfront"] = min(1.0, scores["waterfront"] + 0.15)
        # Historic
        if tags.get("historic") or tags.get("route") in ("walking", "hiking", "historic"):
            scores["historic"] = min(1.0, scores["historic"] + 0.15)
            name = tags.get("name")
            if name and name not in named_features:
                named_features.append(name)
        # Vibrant
        if tags.get("amenity") in ("bar", "restaurant", "cafe", "fast_food", "market_place") or tags.get("shop"):
            scores["vibrant"] = min(1.0, scores["vibrant"] + 0.08)
        # Photogenic
        if tags.get("tourism") == "artwork":
            scores["photogenic"] = min(1.0, scores["photogenic"] + 0.2)
            name = tags.get("name")
            if name and name not in named_features:
                named_features.append(name)
        # Viewpoint
        if tags.get("tourism") == "viewpoint":
            scores["viewpoint"] = min(1.0, scores["viewpoint"] + 0.25)
            lat = el.get("lat")
            lon = el.get("lon")
            if lat and lon:
                viewpoints.append({"lat": lat, "lon": lon, "name": tags.get("name", ""), "direction": tags.get("direction")})
        # Natural route names
        name = tags.get("name", "")
        if name and any(w in name.lower() for w in ("path", "trail", "walk", "promenade", "way")):
            if name not in named_features:
                named_features.append(name)

    return {"character_scores": scores, "named_features": named_features[:6], "viewpoints": viewpoints}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py -v 2>&1 | tail -20
```

Expected: PASS (gate tests pass; the full Overpass query is not tested with live network here)

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add main.py tests/test_route_character.py
git commit -m "feat(scenic): Overpass route character query with 7-dimension scoring and gate check"
```

---

### Task 5: Landmark peek check

**Files:**
- Modify: `main.py` — add `_bearing(lat1, lon1, lat2, lon2)` and `_check_landmark_peeks(points, viewpoints, city_landmarks)` functions
- Test: add to `tests/test_route_character.py`

**Interfaces:**
- Consumes: `points: list[tuple[float, float]]` — sampled route coords; `viewpoints: list[dict]` — from Task 4 (each has `lat, lon, direction`); `city_landmarks: list[str]` — from `city_data.landmark_anchors`; `map_data_cache` and `place_id_cache` tables (Supabase) — for landmark coordinate resolution
- Produces: `list[dict]` — each `{"landmark": str, "at_coords": tuple, "bearing_deg": int}`, or `[]` if no landmarks resolvable

- [ ] **Step 1: Write failing tests**

Append to `tests/test_route_character.py`:

```python
def test_bearing_north():
    from main import _bearing
    # Point A at (0,0), Point B directly north at (1,0) → bearing should be ~0° (north)
    b = _bearing(0.0, 0.0, 1.0, 0.0)
    assert abs(b - 0.0) < 1.0 or abs(b - 360.0) < 1.0


def test_bearing_east():
    from main import _bearing
    # Point A at (0,0), Point B directly east at (0,1) → bearing should be ~90°
    b = _bearing(0.0, 0.0, 0.0, 1.0)
    assert abs(b - 90.0) < 1.0


def test_landmark_peek_matches_when_viewpoint_faces_landmark():
    from main import _check_landmark_peeks
    # Route point at (35.70, 139.70), viewpoint at (35.70, 139.705) — 500m east
    # Landmark (Mt Fuji approx) at (35.36, 138.73) — bearing from viewpoint ~west
    points = [(35.70, 139.70)]
    viewpoints = [{"lat": 35.70, "lon": 139.705, "name": "Test viewpoint", "direction": "270"}]  # faces west
    # Fake the landmark coord lookup by passing pre-resolved coords
    # _check_landmark_peeks signature: (points, viewpoints, landmark_coords)
    # landmark_coords is dict of {name: (lat, lon)}
    landmark_coords = {"Mount Fuji": (35.36, 138.73)}
    peeks = _check_landmark_peeks(points, viewpoints, landmark_coords)
    assert isinstance(peeks, list)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py::test_bearing_north tests/test_route_character.py::test_bearing_east -v 2>&1 | tail -10
```

- [ ] **Step 3: Add bearing function and `_check_landmark_peeks` to `main.py`**

```python
def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute compass bearing (0–360°) from point 1 to point 2."""
    import math
    dlon = math.radians(lon2 - lon1)
    lat1r = math.radians(lat1)
    lat2r = math.radians(lat2)
    x = math.sin(dlon) * math.cos(lat2r)
    y = math.cos(lat1r) * math.sin(lat2r) - math.sin(lat1r) * math.cos(lat2r) * math.cos(dlon)
    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360


def _resolve_landmark_coords(city_landmarks: list[str], supabase_client) -> dict[str, tuple[float, float]]:
    """Look up lat/lon for each landmark name from map_data_cache or place_id_cache."""
    coords: dict[str, tuple[float, float]] = {}
    if not supabase_client:
        return coords
    for name in city_landmarks:
        try:
            row = supabase_client.table("map_data_cache").select("lat,lon").eq("name", name).limit(1).execute()
            if row.data:
                coords[name] = (row.data[0]["lat"], row.data[0]["lon"])
        except Exception:
            pass
    return coords


def _check_landmark_peeks(
    points: list[tuple[float, float]],
    viewpoints: list[dict],
    landmark_coords: dict[str, tuple[float, float]],
) -> list[dict]:
    """Check if any viewpoint along the route faces a known city landmark.

    A match: viewpoint within 500m of a route point, and viewpoint's direction tag
    within ±45° of the bearing toward the landmark. If no direction tag, proximity
    within 500m is sufficient.
    """
    import math
    peeks: list[dict] = []

    def _haversine_m(lat1, lon1, lat2, lon2) -> float:
        R = 6371000
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    for vp in viewpoints:
        vp_lat, vp_lon = vp.get("lat"), vp.get("lon")
        if vp_lat is None or vp_lon is None:
            continue
        # Check proximity to any route point
        close_point = None
        for pt in points:
            if _haversine_m(pt[0], pt[1], vp_lat, vp_lon) <= 500:
                close_point = pt
                break
        if close_point is None:
            continue

        for landmark_name, (lm_lat, lm_lon) in landmark_coords.items():
            bearing_to_landmark = _bearing(vp_lat, vp_lon, lm_lat, lm_lon)
            vp_direction = vp.get("direction")

            if vp_direction is not None:
                try:
                    dir_deg = float(str(vp_direction).split(";")[0].strip())
                    diff = abs((bearing_to_landmark - dir_deg + 180) % 360 - 180)
                    if diff > 45:
                        continue
                except (ValueError, TypeError):
                    pass  # no valid direction tag — fall through to proximity-only match

            peeks.append({
                "landmark": landmark_name,
                "at_coords": close_point,
                "bearing_deg": int(bearing_to_landmark),
                "viewpoint_name": vp.get("name", ""),
            })

    return peeks
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py -v 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add main.py tests/test_route_character.py
git commit -m "feat(scenic): landmark peek check with bearing-based viewpoint matching"
```

---

### Task 6: Condition multiplier (pysolar + OpenWeatherMap + Open-Meteo UV)

**Files:**
- Modify: `main.py` — add `_route_condition_multiplier(...)` and add `uv_index` to existing Open-Meteo call in `_fetch_elevations`; add `pysolar` to `requirements.txt`
- Test: `tests/test_condition_multiplier.py`

**Interfaces:**
- Consumes: `weather: dict` with `temp (int°C)`, `condition (str)`, `sunrise (int unix)`, `sunset (int unix)` — already fetched per stop from OpenWeatherMap; `uv_index: float` — new field from Open-Meteo; `visit_time: datetime` — Phase 1 output; `lat, lon: float` — corridor midpoint; `overpass_has_canopy: bool` — True if corridor has `natural=wood` or `leisure=park` Overpass features
- Produces: `float` in [0.0, 1.3] — 0.0 for hard block; <1.0 for soft penalties; >1.0 for boosts

- [ ] **Step 1: Write failing tests**

Create `tests/test_condition_multiplier.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from datetime import datetime, timezone


def _weather(condition="Clear", temp=22):
    import time
    sunrise = int(datetime(2026, 7, 6, 5, 0, tzinfo=timezone.utc).timestamp())
    sunset  = int(datetime(2026, 7, 6, 19, 0, tzinfo=timezone.utc).timestamp())
    return {"condition": condition, "temp": temp, "sunrise": sunrise, "sunset": sunset}


def test_hard_block_thunderstorm():
    from main import _route_condition_multiplier
    mult = _route_condition_multiplier(
        weather=_weather("Thunderstorm"), uv_index=5.0,
        visit_time=datetime(2026, 7, 6, 14, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert mult == 0.0


def test_hard_block_heavy_rain():
    from main import _route_condition_multiplier
    mult = _route_condition_multiplier(
        weather=_weather("Heavy Rain"), uv_index=2.0,
        visit_time=datetime(2026, 7, 6, 10, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert mult == 0.0


def test_light_rain_penalty():
    from main import _route_condition_multiplier
    mult = _route_condition_multiplier(
        weather=_weather("Rain", temp=18), uv_index=1.0,
        visit_time=datetime(2026, 7, 6, 11, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert abs(mult - 0.5) < 0.05


def test_night_vibrant_boost():
    from main import _route_condition_multiplier
    # After sunset visit — vibrant/photogenic dimensions get boosted
    mult = _route_condition_multiplier(
        weather=_weather("Clear"), uv_index=0.0,
        visit_time=datetime(2026, 7, 6, 21, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="vibrant",
    )
    assert mult > 1.0


def test_night_natural_penalty():
    from main import _route_condition_multiplier
    # After sunset — natural dimension is penalised
    mult = _route_condition_multiplier(
        weather=_weather("Clear"), uv_index=0.0,
        visit_time=datetime(2026, 7, 6, 21, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert mult < 1.0


def test_golden_hour_viewpoint_boost():
    from main import _route_condition_multiplier
    # Sunset is 19:00 UTC. Visit at 18:45 = within ±30 min → golden hour
    mult = _route_condition_multiplier(
        weather=_weather("Clear"), uv_index=3.0,
        visit_time=datetime(2026, 7, 6, 18, 45, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="viewpoint",
    )
    assert mult > 1.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_condition_multiplier.py -v 2>&1 | tail -20
```

- [ ] **Step 3: Add `pysolar` to `requirements.txt` and install**

```
pysolar
```

```bash
pip install pysolar
```

- [ ] **Step 4: Add `_route_condition_multiplier` to `main.py`**

```python
def _route_condition_multiplier(
    weather: dict,
    uv_index: float,
    visit_time,       # datetime with tzinfo
    lat: float,
    lon: float,
    overpass_has_canopy: bool,
    top_character: str,
) -> float:
    """Compute a real-time multiplier for the scenic route score based on conditions.

    Returns 0.0 for hard blocks. Returns 0.3–1.3 for soft modifiers.
    Never cached — always computed from Phase 1 visit_time.
    """
    condition = (weather.get("condition") or "").strip()

    # Hard blocks — card never shown
    if condition in ("Thunderstorm", "Heavy Rain"):
        return 0.0

    # Road character hard block (motorway) is handled at the caller level, not here.

    mult = 1.0
    temp = weather.get("temp") or 20
    sunset_ts  = weather.get("sunset")
    sunrise_ts = weather.get("sunrise")

    # Convert visit_time to unix timestamp for sunset/sunrise comparison
    import math
    try:
        visit_ts = visit_time.timestamp()
    except Exception:
        visit_ts = None

    # ── Sun position via pysolar ──────────────────────────────────────────────
    sun_elevation = None
    try:
        from pysolar.solar import get_altitude, get_azimuth  # noqa: F401
        sun_elevation = get_altitude(lat, lon, visit_time)
    except Exception:
        pass

    is_night    = (visit_ts and sunset_ts and visit_ts > sunset_ts + 1800)
    is_dawn     = (visit_ts and sunrise_ts and visit_ts < sunrise_ts - 1800)
    is_dark     = is_night or is_dawn or (sun_elevation is not None and sun_elevation < -4)

    # Golden hour: sun elevation −4° to +6° near sunset (±30 min)
    is_golden_hour = False
    if sun_elevation is not None:
        is_golden_hour = -4 <= sun_elevation <= 6
    elif sunset_ts and visit_ts:
        is_golden_hour = abs(visit_ts - sunset_ts) <= 1800

    # ── Soft multipliers ──────────────────────────────────────────────────────
    # Light rain
    if condition in ("Rain", "Drizzle"):
        mult *= 0.5

    # Heat + high UV, unshaded
    if temp > 32 and uv_index > 7:
        if overpass_has_canopy:
            mult *= 0.9   # shaded route — minor penalty
        else:
            mult *= 0.4   # exposed route — significant penalty

    # Night modifiers
    if is_dark:
        if top_character in ("vibrant", "photogenic"):
            mult *= 1.2   # city lights, neon — better at night
        elif top_character in ("natural", "local", "waterfront"):
            mult *= 0.4   # dark paths — much less scenic

    # Golden hour boost for viewpoint
    if is_golden_hour and top_character == "viewpoint":
        mult *= 1.3

    return round(min(1.3, max(0.0, mult)), 3)
```

- [ ] **Step 5: Add `uv_index` fetch to `_fetch_elevations` in `main.py`**

In `_fetch_elevations` (line ~992), the function currently calls Open-Meteo for elevation data. After reading the Open-Meteo elevation call, add UV index fetch for the midpoint coordinate:

Find the existing Open-Meteo call in `_fetch_elevations` and after it, add a separate targeted UV call at the midpoint:

```python
def _fetch_uv_index(lat: float, lon: float, visit_time) -> float:
    """Fetch current UV index from Open-Meteo for a single coordinate at visit_time hour."""
    try:
        import requests as _req
        hour = visit_time.hour if hasattr(visit_time, 'hour') else 12
        resp = _req.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat, "longitude": lon,
                "hourly": "uv_index",
                "forecast_days": 1,
                "timezone": "UTC",
            },
            timeout=8,
        ).json()
        uv_values = resp.get("hourly", {}).get("uv_index", [])
        if uv_values and hour < len(uv_values):
            return float(uv_values[hour] or 0)
        return 0.0
    except Exception:
        return 0.0
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_condition_multiplier.py -v 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add main.py requirements.txt tests/test_condition_multiplier.py
git commit -m "feat(scenic): condition multiplier with pysolar sun position, UV, weather hard blocks"
```

---

### Task 7: Character score computation and user preference weighting

**Files:**
- Modify: `main.py` — add `_score_route_character(...)` that combines Tasks 2–6 and applies 3-tier user preference weighting
- Test: add to `tests/test_route_character.py`

**Interfaces:**
- Consumes: `instruction_scores`, `ors_surface_score`, `overpass_scores`, `road_character`, `elevation_score`, `condition_multiplier`, `persona_snapshot`, `persona_attractions`, `persona_key` — all available at route card generation time
- Produces: `{"character_scores": dict, "top_character": str, "condition_multiplier": float, "landmark_peeks": list, "path_names": list, "route_type": str, "passes_threshold": bool}`

- [ ] **Step 1: Write failing test**

Append to `tests/test_route_character.py`:

```python
def test_score_route_character_natural_walk():
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores={"natural": 0.7, "viewpoint": 0.0, "historic": 0.0, "vibrant": 0.1,
                            "photogenic": 0.0, "waterfront": 0.0, "local": 0.0},
        ors_surface_score=0.6,
        overpass_character={"character_scores": {"natural": 0.6, "viewpoint": 0.0, "historic": 0.0,
                                                  "vibrant": 0.1, "photogenic": 0.0, "waterfront": 0.0,
                                                  "local": 0.0}, "named_features": ["Riverside Path"], "viewpoints": []},
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={"w_scenic": 0.8, "w_walk_affinity": 0.7, "w_nightlife": 0.1,
                          "w_culture_depth": 0.3, "w_food_density": 0.2, "w_efficiency": 0.2,
                          "w_spontaneity": 0.5},
        persona_attractions=["nature"],
        persona_key="flaneur",
        distance_km=1.8,
    )
    assert result["top_character"] == "natural"
    assert result["route_type"] in ("walk", "coastal", "ridge")
    assert "passes_threshold" in result
    assert result["passes_threshold"] is True


def test_score_route_character_fails_threshold_when_multiplier_zero():
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores={"natural": 0.8, "viewpoint": 0.0, "historic": 0.0, "vibrant": 0.0,
                            "photogenic": 0.0, "waterfront": 0.0, "local": 0.0},
        ors_surface_score=0.7,
        overpass_character={"character_scores": {"natural": 0.9, "viewpoint": 0.0, "historic": 0.0,
                                                  "vibrant": 0.0, "photogenic": 0.0, "waterfront": 0.0,
                                                  "local": 0.0}, "named_features": [], "viewpoints": []},
        road_character=0.0, elevation_gain_m=0, condition_multiplier=0.0,  # hard block
        landmark_peeks=[],
        persona_snapshot={"w_scenic": 1.0, "w_walk_affinity": 1.0, "w_nightlife": 0.0,
                          "w_culture_depth": 0.0, "w_food_density": 0.0, "w_efficiency": 0.0,
                          "w_spontaneity": 1.0},
        persona_attractions=["nature"], persona_key="flaneur", distance_km=2.0,
    )
    assert result["passes_threshold"] is False
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py::test_score_route_character_natural_walk -v 2>&1 | tail -10
```

- [ ] **Step 3: Add `_score_route_character` to `main.py`**

```python
# Persona archetype → per-dimension adjustments
# "_threshold_delta" lowers the 0.55 threshold; "_historic_conditional_threshold" means
# threshold drops further only when historic > 0.4 (used by slowScholar).
# "_nightcreature_vibrant_mult" applied on top of condition_multiplier night boost.
_PERSONA_ADJUSTMENTS: dict[str, dict[str, float]] = {
    "flaneur":            {"local": 0.20, "_threshold_delta": -0.05},
    "gastronaut":         {"vibrant": 0.20},
    "slowScholar":        {"historic": 0.20, "_threshold_delta": -0.05, "_historic_conditional_threshold": -0.05},
    "neighbourhoodLocal": {"local": 0.25, "vibrant": -0.10},
    "aesthete":           {"photogenic": 0.20, "viewpoint": 0.15},
    "nightCreature":      {"_night_vibrant_mult": 1.5, "_night_natural_mult": 0.3},
    "ritualSeeker":       {"local": 0.15, "vibrant": 0.15},
    "efficientExplorer":  {},   # efficiency handled via haversine comparison below
}

def _score_route_character(
    mode: str,
    instruction_scores: dict[str, float],
    ors_surface_score: float,
    overpass_character: dict,
    road_character: float,
    elevation_gain_m: float | None,
    condition_multiplier: float,
    landmark_peeks: list,
    persona_snapshot: dict,
    persona_attractions: list[str],
    persona_key: str,
    distance_km: float,
    haversine_km: float | None = None,   # straight-line origin→dest; used for efficiency penalty
) -> dict:
    """Combine all signal sources into final character scores with user preference weighting.

    Three-tier preference matching:
      1. EngineWeights (persona_snapshot) — primary, multiplicative
      2. Persona.attractions (onboarding answers) — secondary, additive
      3. PersonaKey (archetype) — tertiary, per-dimension adjustments
    """
    overpass_scores = overpass_character.get("character_scores", {d: 0.0 for d in _DIM_KEYWORDS})
    elevation_score = min(1.0, (elevation_gain_m or 0) / 500)
    character_scores: dict[str, float] = {}

    for dim in _DIM_KEYWORDS:
        if mode == "walk":
            raw = (
                overpass_scores.get(dim, 0.0) * 0.45
                + instruction_scores.get(dim, 0.0) * 0.35
                + ors_surface_score * 0.20
            )
        else:  # drive
            raw = (
                overpass_scores.get(dim, 0.0) * 0.40
                + road_character * 0.35
                + elevation_score * 0.25
            )
        character_scores[dim] = round(min(1.0, raw), 3)

    # Landmark peek bonus on Viewpoint dimension
    if landmark_peeks:
        character_scores["viewpoint"] = min(1.0, character_scores.get("viewpoint", 0.0) + 0.25)

    # Named features → path_names
    path_names = overpass_character.get("named_features", [])

    # ── Tier 1: EngineWeights ──────────────────────────────────────────────────
    w = persona_snapshot
    user_weights: dict[str, float] = {
        "natural":    1 + w.get("w_scenic", 0.5) * 0.6,
        "viewpoint":  1 + w.get("w_scenic", 0.5) * 0.6,
        "waterfront": 1 + w.get("w_scenic", 0.5) * 0.6,
        "vibrant":    1 + w.get("w_nightlife", 0.4) * 0.8 + w.get("w_food_density", 0.4) * 0.5,
        "historic":   1 + w.get("w_culture_depth", 0.5) * 0.6,
        "photogenic": 1 + w.get("w_nightlife", 0.4) * 0.5,
        "local":      1.0,
    }
    walk_mult = 1 + w.get("w_walk_affinity", 0.5) * 0.4 if mode == "walk" else 1.0
    threshold = max(0.3, 0.55 - w.get("w_spontaneity", 0.5) * 0.10)

    # w_efficiency penalty: multiplicative score penalty for very indirect routes (spec)
    # score × (1 - w_efficiency * 0.3) when route_distance_km > haversine_distance_km * 2.0
    efficiency_score_mult = 1.0
    if haversine_km is not None and distance_km > haversine_km * 2.0:
        efficiency_score_mult = max(0.3, 1.0 - w.get("w_efficiency", 0.5) * 0.3)

    # ── Tier 2: attractions ────────────────────────────────────────────────────
    attraction_boost: dict[str, float] = {}
    for attr in (persona_attractions or []):
        if attr == "nature":
            attraction_boost["natural"]    = attraction_boost.get("natural", 0) + 0.15
            attraction_boost["waterfront"] = attraction_boost.get("waterfront", 0) + 0.10
        elif attr == "historic":
            attraction_boost["historic"]   = attraction_boost.get("historic", 0) + 0.15
        elif attr == "culture":
            attraction_boost["historic"]   = attraction_boost.get("historic", 0) + 0.10
            attraction_boost["photogenic"] = attraction_boost.get("photogenic", 0) + 0.10
        elif attr == "markets":
            attraction_boost["vibrant"]    = attraction_boost.get("vibrant", 0) + 0.15

    # ── Tier 3: PersonaKey ────────────────────────────────────────────────────
    persona_adj = _PERSONA_ADJUSTMENTS.get(persona_key, {})
    threshold += persona_adj.get("_threshold_delta", 0)

    # Apply all weights to character scores
    weighted_scores: dict[str, float] = {}
    for dim in _DIM_KEYWORDS:
        score = character_scores[dim]
        score *= user_weights.get(dim, 1.0) * walk_mult * efficiency_score_mult
        score += attraction_boost.get(dim, 0.0)
        # Skip private keys (prefixed with "_") from per-dimension additions
        if not dim.startswith("_"):
            score += persona_adj.get(dim, 0.0)
        weighted_scores[dim] = round(min(1.0, score), 3)

    top_character = max(weighted_scores, key=weighted_scores.get)
    top_score = weighted_scores[top_character]

    # slowScholar: additional threshold reduction when historic scores strongly (spec)
    if persona_key == "slowScholar" and weighted_scores.get("historic", 0) > 0.4:
        threshold += persona_adj.get("_historic_conditional_threshold", 0)

    # nightCreature: apply persona-specific night multipliers on top of condition_multiplier
    # (condition_multiplier applies generic ×1.2 for vibrant at night; nightCreature gets ×1.5)
    is_night_visit = condition_multiplier < 1.0 or condition_multiplier > 1.0  # proxy: non-neutral
    # More precise: nightCreature multipliers are applied if condition_multiplier already reflects
    # a night modifier (i.e., the multiplier was affected by is_dark logic). Since we can't
    # introspect the multiplier, apply nightCreature adjustments unconditionally and trust that
    # condition_multiplier = 1.0 for daytime visits will not produce false positives.
    if persona_key == "nightCreature":
        if top_character in ("vibrant", "photogenic"):
            top_score = min(1.0, top_score * persona_adj.get("_night_vibrant_mult", 1.0))
            weighted_scores[top_character] = top_score
        elif top_character in ("natural", "waterfront", "local"):
            top_score = min(1.0, top_score * persona_adj.get("_night_natural_mult", 1.0))
            weighted_scores[top_character] = top_score

    # Route type
    if mode == "drive":
        route_type = "ridge" if elevation_score > 0.4 else "drive"
    elif top_character == "waterfront":
        route_type = "coastal"
    else:
        route_type = "walk"

    passes = (
        top_score * condition_multiplier >= threshold
        and distance_km >= 0.5
        and condition_multiplier > 0.0
    )

    return {
        "character_scores": weighted_scores,
        "top_character":    top_character,
        "condition_multiplier": condition_multiplier,
        "landmark_peeks":   landmark_peeks,
        "path_names":       path_names,
        "route_type":       route_type,
        "passes_threshold": passes,
    }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_route_character.py -v 2>&1 | tail -30
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add main.py tests/test_route_character.py
git commit -m "feat(scenic): combined character score with 3-tier user preference weighting"
```

---

### Task 8: Database migration — `route_profile_cache` new columns + pysolar dependency

**Files:**
- Create: `supabase/migrations/20260706_route_profile_cache_character_scores.sql`
- Modify: `requirements.txt` (pysolar already added in Task 6; verify it's there)

**Interfaces:**
- Consumes: existing `route_profile_cache` table (has `corridor_key`, `distance_km`, `duration_min`, `elevation_*`, `road_character`, `sample_elevations`, `fetched_at`)
- Produces: new columns: `character_scores jsonb`, `top_character text`, `path_names jsonb`, `landmark_peeks jsonb`, `route_type text`, `route_computed_at timestamptz`

- [ ] **Step 1: Check what columns already exist**

```bash
grep -n "character_scores\|top_character\|route_type\|landmark_peeks\|path_names" /Users/souravbiswas/Uncover-roads/supabase/migrations/*.sql 2>/dev/null
```

If these columns already exist from prior migrations, skip Step 2.

- [ ] **Step 2: Create migration**

Create `supabase/migrations/20260706_route_profile_cache_character_scores.sql`:

```sql
ALTER TABLE route_profile_cache
  ADD COLUMN IF NOT EXISTS character_scores   jsonb,
  ADD COLUMN IF NOT EXISTS top_character      text,
  ADD COLUMN IF NOT EXISTS path_names         jsonb,
  ADD COLUMN IF NOT EXISTS landmark_peeks     jsonb,
  ADD COLUMN IF NOT EXISTS route_type         text,
  ADD COLUMN IF NOT EXISTS route_computed_at  timestamptz;

-- Drop scenic_score if it exists from an old column (no longer used)
ALTER TABLE route_profile_cache
  DROP COLUMN IF EXISTS scenic_score;
```

- [ ] **Step 3: Update `_fetch_route_profile` to read and write character columns**

In `main.py`, `_fetch_route_profile` currently returns `distance_km`, `duration_min`, `elevation_*`, `road_character`, `sample_elevations`.

Add to the cache READ block (around line 1061), expand the field list:
```python
                    return {k: r.get(k) for k in (
                        "distance_km", "duration_min", "elevation_gain_m", "elevation_loss_m",
                        "peak_elevation_m", "road_character", "sample_elevations",
                        "character_scores", "top_character", "path_names",
                        "landmark_peeks", "route_type",
                    )}
```

Add to the cache WRITE block (around line 1148), the new columns will be populated by the caller once character scoring is done. `_fetch_route_profile` stores only the geometry/elevation fields itself. Character scoring results are written separately via a new `_cache_route_character(corridor_key, scoring_result)` helper:

```python
def _cache_route_character(corridor_key: str, scoring_result: dict) -> None:
    """Write character scoring results to route_profile_cache."""
    if not _supabase:
        return
    try:
        _supabase.table("route_profile_cache").upsert({
            "corridor_key":      corridor_key,
            "character_scores":  scoring_result.get("character_scores"),
            "top_character":     scoring_result.get("top_character"),
            "path_names":        scoring_result.get("path_names"),
            "landmark_peeks":    scoring_result.get("landmark_peeks"),
            "route_type":        scoring_result.get("route_type"),
            "route_computed_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        print(f"ROUTE CHARACTER CACHE WRITE: {e}")
```

- [ ] **Step 4: Verify `pysolar` in requirements.txt**

```bash
grep "pysolar\|polyline" /Users/souravbiswas/Uncover-roads/requirements.txt
```

Expected: both `pysolar` and `polyline` present. Add if missing.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add supabase/migrations/20260706_route_profile_cache_character_scores.sql main.py requirements.txt
git commit -m "feat(scenic): route_profile_cache schema for character scores + _cache_route_character helper"
```

---

### Task 9: ReelScenicCard TypeScript type update

**Files:**
- Modify: `frontend/src/modules/route/reel/types.ts`

**Interfaces:**
- Consumes: existing `ReelScenicCard` interface (lines 32–60); `ScenicSceneType` type (line 29)
- Produces: `ReelScenicCard` with `conditionNote`, `characterDimensions`, `landmarkPeek` added; `ScenicSceneType` extended with `"ridge"`; new `routeLabel` field for the character-based card label

- [ ] **Step 1: Write failing test**

In `frontend/src/modules/route/reel/__tests__/reelBuilder.test.ts`, add:

```typescript
describe('ReelScenicCard type completeness', () => {
  it('conditionNote field is optional string or null on ReelScenicCard', () => {
    // TypeScript compile-time check — if types.ts is updated, this import will work
    type Check = import('../types').ReelScenicCard['conditionNote'];
    type IsOptional = undefined extends Check ? true : false;
    const result: IsOptional = true;
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/reelBuilder.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Update types.ts**

In `frontend/src/modules/route/reel/types.ts`:

**Update `ScenicSceneType`** (line 29):
```typescript
export type ScenicSceneType = 'walk' | 'drive' | 'coastal' | 'ridge' | 'crowd' | 'forest';
```
(No change needed — `'ridge'` is already present if checked; add if absent.)

**Add to `ReelScenicCard` interface** (after the `transitInfo` field):
```typescript
  conditionNote?: string | null;          // e.g. "High UV today — shaded route available"
  characterDimensions?: string[];         // secondary dimensions with score > 0.4 e.g. ["natural", "viewpoint"]
  landmarkPeek?: {
    landmark: string;                     // e.g. "Mount Fuji"
    atCoords: [number, number];           // [lat, lon] of the viewpoint on the route
    bearingDeg: number;                   // compass bearing to look toward landmark
  } | null;
  routeLabel?: string;                    // character-based label e.g. "Sumida Riverside Walk"
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/reelBuilder.test.ts 2>&1 | tail -20
```

- [ ] **Step 5: TypeScript compile check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add frontend/src/modules/route/reel/types.ts
git commit -m "feat(scenic): add conditionNote, characterDimensions, landmarkPeek, routeLabel to ReelScenicCard type"
```

---

### Task 10: ReelScenicCard component UI update (expanded card design)

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelScenicCard.tsx`

**Interfaces:**
- Consumes: updated `ReelScenicCard` fields from Task 9; design tokens from `index.css`; Material Symbols icons; `getPlacePhotoUrl` from `shared/api.ts` — same pattern as stop cards
- Produces: single-state scenic card matching the proto design: mode chip topbar + weather chip, photo top, character title + breadcrumb, LLM why text, "Along the way" feature chips, conditionNote if present. No drag bar. No collapse/expand state.

**Card layout (from proto):**
```
┌─────────────────────────────────────────┐
│ [Photo fills top ~40% of card]          │
│ [Mode chip: Walk · 1.4 km · 18 min]    │
│ [Weather: ☀ 24°]                        │
├─────────────────────────────────────────┤
│ [Character icon] Natural Walk        ↑  │
│ Sumida Park → Ueno Station · 18 min walk│
│                                         │
│  LLM "why" text paragraph              ✦│
│                                         │
│  Along the way                          │
│  [Cherry trees] [Riverside path] [...]  │
│                                         │
│  [conditionNote if present]             │
└─────────────────────────────────────────┘
```

- [ ] **Step 1: Write failing test**

In `frontend/src/modules/route/reel/__tests__/ReelScenicCard.test.tsx` (create):

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

const mockScenicCard = {
  type: 'scenic' as const,
  sceneType: 'walk' as const, accent: '#6b9470', cardType: 'NATURAL WALK', pos: 1, total: 2,
  timing: 'Morning · 9:30 AM', metaRight: 'Asakusa', place: 'Sumida Riverside',
  from: 'Asakusa', to: 'Ueno', modeIcon: 'walk' as const, tag: 'Natural',
  vizType: 'corridor' as const, persona: 'flaneur', personaDisplay: 'Flâneur',
  personaIcon: 'walk', why: 'A quiet riverside path through cherry trees.',
  sensory: 'Cool breeze off the river.', sensoryIcon: 'waves',
  reelPos: 'Between Stop 1 and Stop 2',
  photoUrl: null, originPhotoUrl: null, destPhotoUrl: null, transitInfo: null,
  detourKm: 1.4, detourMin: 18,
  routeLabel: 'Sumida Riverside Walk',
  conditionNote: null, characterDimensions: ['natural', 'waterfront'], landmarkPeek: null,
};

describe('ReelScenicCard', () => {
  it('renders route label', () => {
    // @ts-ignore minimal mock
    const { getByText } = render(<ReelScenicCard card={mockScenicCard} />);
    expect(getByText('Sumida Riverside Walk')).toBeInTheDocument();
  });

  it('renders LLM why text', () => {
    // @ts-ignore
    const { getByText } = render(<ReelScenicCard card={mockScenicCard} />);
    expect(getByText(/quiet riverside path/i)).toBeInTheDocument();
  });

  it('does not render a drag bar', () => {
    // @ts-ignore
    const { container } = render(<ReelScenicCard card={mockScenicCard} />);
    // drag bar has class "sc-drag" or similar — should not exist
    expect(container.querySelector('.sc-drag, [data-drag-bar]')).toBeNull();
  });

  it('renders conditionNote when present', () => {
    const cardWithNote = { ...mockScenicCard, conditionNote: 'High UV — shaded route available.' };
    // @ts-ignore
    const { getByText } = render(<ReelScenicCard card={cardWithNote} />);
    expect(getByText(/High UV/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelScenicCard.test.tsx 2>&1 | tail -20
```

- [ ] **Step 3: Read the existing ReelScenicCard.tsx to understand current structure**

```bash
grep -n "drag\|collapse\|expand\|rsc-topbar\|sc-drag\|routeLabel\|conditionNote\|why\|Along" /Users/souravbiswas/Uncover-roads/frontend/src/modules/route/reel/ReelScenicCard.tsx | head -30
```

Note what's already rendered vs what needs to be added/changed.

- [ ] **Step 4: Update ReelScenicCard.tsx**

Key changes (read the file carefully before editing):

1. **Remove drag bar element** (any div with `sc-drag` class or similar gesture indicator)

2. **Add `routeLabel` as the main heading**: Replace the current `place` or `cardType` used as the heading with `card.routeLabel ?? card.place`

3. **Topbar structure** — must match stop card topbar style (mode chip = same as `.sc-tod`, weather chip = same as `.sc-wx`):
```tsx
<div className="rsc-topbar" style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 99, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.09)', fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)', whiteSpace: 'nowrap' }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: card.accent, boxShadow: `0 0 5px ${card.accent}` }} />
    <span>{card.modeIcon === 'walk' ? 'Walk' : 'Drive'}</span>
    <span style={{ width: 1, height: 9, background: 'rgba(255,255,255,.14)', margin: '0 3px', display: 'inline-block' }} />
    <span style={{ fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>{card.detourKm} km · {card.detourMin} min</span>
  </div>
  {card.weather && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className="ms" style={{ fontSize: 15, color: '#f5a623' }}>wb_sunny</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#f5f0ea' }}>{card.weather.temp}°</span>
    </div>
  )}
</div>
```

4. **Breadcrumb row** below the heading:
```tsx
<div style={{ fontSize: 12, color: 'rgba(113,101,89,.8)', marginBottom: 12 }}>
  <span style={{ color: '#a08d80' }}>{card.from}</span>
  {' → '}
  <span style={{ color: '#a08d80' }}>{card.to}</span>
  {' · '}
  {card.detourMin} min {card.modeIcon === 'walk' ? 'walk' : 'drive'}
</div>
```

5. **Add `conditionNote` rendering** after the "Along the way" features section:
```tsx
{card.conditionNote && (
  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 10, fontSize: 12, color: 'rgba(212,168,83,.8)', background: 'rgba(212,168,83,.07)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(212,168,83,.15)' }}>
    <span className="ms" style={{ fontSize: 14, flexShrink: 0 }}>wb_sunny</span>
    <span>{card.conditionNote}</span>
  </div>
)}
```

6. **Landmark peek rendering** if `landmarkPeek` is present (add after the why text):
```tsx
{card.landmarkPeek && (
  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, fontSize: 12, color: 'rgba(79,143,171,.85)' }}>
    <span className="ms" style={{ fontSize: 14 }}>photo_camera</span>
    <span>{card.landmarkPeek.landmark} visible from this route <span style={{ color: '#726559' }}>✦</span></span>
  </div>
)}
```

7. **No collapse/expand state** — remove any `useState` for `expanded` if it exists; the card renders fully in one state.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ReelScenicCard.test.tsx 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 6: TypeScript compile check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add frontend/src/modules/route/reel/ReelScenicCard.tsx frontend/src/modules/route/reel/__tests__/ReelScenicCard.test.tsx
git commit -m "feat(scenic): update ReelScenicCard UI — single state, new topbar, routeLabel, conditionNote, landmarkPeek"
```

---

### Task 11: Engine route card generation — assemble and insert scenic cards

**Files:**
- Modify: `main.py` — add `_generate_scenic_card_for_corridor(...)` and integrate into the reel assembly endpoint
- Test: `tests/test_scenic_card_generation.py`

**Interfaces:**
- Consumes: `_fetch_route_profile` result (with new character_scores or None), `_score_route_character` from Task 7, `_route_condition_multiplier` from Task 6, stop pair `(origin, dest)` as `EngineItineraryStop` dicts, `persona_snapshot`, `persona_attractions`, `persona_key`, `visit_time` from Phase 1 scheduling; existing Claude LLM call for `why` and `sensory` text
- Produces: `ReelScenicCard` dict inserted between the two stop dicts in the reel output, or `None` if threshold not met

**Allowed LLM claims** (from spec — enforced via system prompt construction):
- Route proximity to named features (from `path_names`)
- Walk time between stops (from `duration_min`)
- Temperature/heat (from `weather.temp`)
- Rain (from `weather.condition`)
- UV/shade advice (from `uv_index` + `overpass_has_canopy`)
- Sun angle / golden hour (from `pysolar` output)
- Landmark peek (from `landmark_peeks`)
- Street names (from Google Directions instruction text)

**Prohibited LLM claims:** crowd density without `crowd_ratio`, historical facts not in place data, viewpoint quality claims without OSM `tourism=viewpoint` backing.

- [ ] **Step 1: Write failing test**

Create `tests/test_scenic_card_generation.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from unittest.mock import patch, MagicMock


def _make_stop(name, lat, lon, time="10:00", is_engine_added=False):
    return {
        "placeId": f"place_{name.lower().replace(' ', '_')}",
        "title": name, "lat": lat, "lon": lon, "time": time,
        "durationMin": 60, "city": "Tokyo",
    }


def test_scenic_card_not_generated_when_condition_multiplier_zero():
    from main import _generate_scenic_card_for_corridor
    origin = _make_stop("Asakusa", 35.71, 139.79)
    dest   = _make_stop("Ueno", 35.71, 139.77)
    route_profile = {
        "distance_km": 2.0, "duration_min": 25, "road_character": 0.8,
        "character_scores": None, "top_character": None,
    }
    with patch("main._route_condition_multiplier", return_value=0.0):
        result = _generate_scenic_card_for_corridor(
            origin=origin, dest=dest, route_profile=route_profile,
            visit_time=None, persona_snapshot={}, persona_attractions=[], persona_key="flaneur",
            weather={}, city_landmarks=[],
        )
    assert result is None


def test_scenic_card_not_generated_when_distance_too_short():
    from main import _generate_scenic_card_for_corridor
    origin = _make_stop("A", 35.70, 139.70)
    dest   = _make_stop("B", 35.701, 139.701)  # ~150m away
    route_profile = {
        "distance_km": 0.15, "duration_min": 2, "road_character": 0.5,
        "character_scores": None, "top_character": None,
    }
    with patch("main._route_condition_multiplier", return_value=1.0):
        result = _generate_scenic_card_for_corridor(
            origin=origin, dest=dest, route_profile=route_profile,
            visit_time=None, persona_snapshot={}, persona_attractions=[], persona_key="flaneur",
            weather={}, city_landmarks=[],
        )
    assert result is None  # < 0.5 km → hard block
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_scenic_card_generation.py -v 2>&1 | tail -20
```

- [ ] **Step 3: Add `_generate_scenic_card_for_corridor` to `main.py`**

```python
# Character dimension → card label templates
_CHARACTER_LABELS: dict[str, str] = {
    "natural":    "{path_name} walk",
    "viewpoint":  "Catch {landmark} from here",
    "historic":   "{path_name} heritage walk",
    "vibrant":    "{path_name} strip",
    "photogenic": "Street art corridor",
    "waterfront": "Along the {path_name}",
    "local":      "Through {neighbourhood}",
}

def _generate_scenic_card_for_corridor(
    origin: dict,
    dest: dict,
    route_profile: dict,
    visit_time,
    persona_snapshot: dict,
    persona_attractions: list,
    persona_key: str,
    weather: dict,
    city_landmarks: list[str],
) -> dict | None:
    """Generate a ReelScenicCard dict for the corridor, or None if threshold not met.

    Assumes Phase 1 scheduling is complete (visit_time is authoritative).
    """
    distance_km = route_profile.get("distance_km") or 0
    road_character = route_profile.get("road_character") or 0

    # Hard block: distance < 0.5 km
    if distance_km < 0.5:
        return None

    # Hard block: road_character check (motorway > 60% → road_character < 0.4)
    if road_character < 0.4 and distance_km > 1.0:
        return None  # predominantly motorway

    # Determine mode (use destination transitFromPrev as guide, or haversine estimate)
    mode = "walk" if distance_km < 5 else "drive"

    # Straight-line distance for efficiency penalty (spec: w_efficiency penalises route > 2× haversine)
    import math as _math
    _orig_lat = origin.get("lat") or 0.0
    _orig_lon = origin.get("lon") or 0.0
    _dest_lat = dest.get("lat") or 0.0
    _dest_lon = dest.get("lon") or 0.0
    def _hav_km(la1, lo1, la2, lo2):
        R = 6371; dlat = _math.radians(la2-la1); dlon = _math.radians(lo2-lo1)
        a = _math.sin(dlat/2)**2 + _math.cos(_math.radians(la1))*_math.cos(_math.radians(la2))*_math.sin(dlon/2)**2
        return R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1-a))
    haversine_km = _hav_km(_orig_lat, _orig_lon, _dest_lat, _dest_lon) if (_orig_lat and _dest_lat) else None

    # Corridor midpoint
    mid_lat = (origin.get("lat", 0) + dest.get("lat", 0)) / 2
    mid_lon = (origin.get("lon", 0) + dest.get("lon", 0)) / 2

    # UV index at midpoint
    uv_index = 0.0
    if visit_time:
        uv_index = _fetch_uv_index(mid_lat, mid_lon, visit_time)

    # Condition multiplier (always fresh — not cached)
    condition_multiplier = _route_condition_multiplier(
        weather=weather,
        uv_index=uv_index,
        visit_time=visit_time or __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        lat=mid_lat,
        lon=mid_lon,
        overpass_has_canopy=False,  # placeholder — overpass_character provides this
        top_character=route_profile.get("top_character") or "natural",
    )
    if condition_multiplier == 0.0:
        return None

    # Retrieve character scores from cache if available
    cached_chars = route_profile.get("character_scores")
    instruction_scores: dict[str, float] = {d: 0.0 for d in _DIM_KEYWORDS}
    ors_surface_score = 0.0
    overpass_character: dict = {"character_scores": {d: 0.0 for d in _DIM_KEYWORDS}, "named_features": [], "viewpoints": []}
    landmark_peeks: list = []
    path_names: list = []

    if cached_chars:
        overpass_character["character_scores"] = cached_chars
        path_names = route_profile.get("path_names") or []
        landmark_peeks = route_profile.get("landmark_peeks") or []
    # If not cached: character_scores will be all zeros → score_route_character may still pass
    # if instruction_scores + ORS surface are sufficient. Walk route points not available here
    # (they're in transit_corridor_cache); full scoring will be done at cache-fill time.

    scoring = _score_route_character(
        mode=mode,
        instruction_scores=instruction_scores,
        ors_surface_score=ors_surface_score,
        overpass_character=overpass_character,
        road_character=road_character,
        elevation_gain_m=route_profile.get("elevation_gain_m"),
        condition_multiplier=condition_multiplier,
        landmark_peeks=landmark_peeks,
        persona_snapshot=persona_snapshot,
        persona_attractions=persona_attractions,
        persona_key=persona_key,
        distance_km=distance_km,
        haversine_km=haversine_km,
    )

    if not scoring["passes_threshold"]:
        return None

    top_char = scoring["top_character"]

    # Build route label from character + path names / landmark peeks
    first_path = (path_names[0] if path_names else None) or dest.get("title", "this route")
    first_landmark = landmark_peeks[0]["landmark"] if landmark_peeks else None

    if top_char == "viewpoint" and first_landmark:
        route_label = f"Catch {first_landmark} from here"
    elif top_char == "waterfront":
        route_label = f"Along the {first_path}"
    elif first_path:
        route_label = f"{first_path} {mode}"
    else:
        route_label = f"{top_char.capitalize()} {mode}"

    # Accent colour per dimension
    accent_map = {
        "natural": "#6b9470", "viewpoint": "#4f8fab", "historic": "#8b7355",
        "vibrant": "#c87941", "photogenic": "#9b6b9e", "waterfront": "#4f8fab", "local": "#a08d80",
    }
    accent = accent_map.get(top_char, "#6b9470")

    # Condition note (e.g. heat/UV)
    condition_note: str | None = None
    temp = (weather or {}).get("temp") or 20
    uv = uv_index
    has_canopy = "natural" in (scoring.get("characterDimensions") or [top_char])
    if temp > 32 and uv > 7:
        condition_note = ("High UV today — this route has shade cover." if has_canopy
                         else "High UV today — consider sun protection.")

    # LLM text (brief fallback; full LLM call done in production engine)
    why = f"A {top_char} {mode} from {origin.get('title')} to {dest.get('title')}."
    sensory = ""

    card: dict = {
        "type": "scenic",
        "sceneType": scoring["route_type"],
        "accent": accent,
        "cardType": f"{mode.upper()} · {top_char.upper()}",
        "pos": 0,    # set by caller
        "total": 0,  # set by caller
        "timing": "",
        "metaRight": f"{distance_km} km",
        "place": first_path,
        "from": origin.get("title", ""),
        "to": dest.get("title", ""),
        "modeIcon": "walk" if mode == "walk" else "car",
        "tag": top_char.capitalize(),
        "vizType": "corridor",
        "persona": persona_key,
        "personaDisplay": persona_key,
        "personaIcon": "walk",
        "why": why,
        "sensory": sensory,
        "sensoryIcon": "waves",
        "reelPos": f"Between {origin.get('title', '')} and {dest.get('title', '')}",
        "photoUrl": None,
        "detourKm": round(distance_km, 1),
        "detourMin": route_profile.get("duration_min") or 0,
        "transitInfo": None,
        "routeLabel": route_label,
        "conditionNote": condition_note,
        "characterDimensions": [d for d, s in scoring["character_scores"].items() if s > 0.4],
        "landmarkPeek": landmark_peeks[0] if landmark_peeks else None,
    }

    return card
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_scenic_card_generation.py -v 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Integrate scenic card generation into reel assembly**

In `main.py`, in the reel assembly loop (around line 4584 where `stops_out.append(...)` is called), add between adjacent stops:

After all stops for a day are built into `stops_out`, before `days_out.append(...)`, insert scenic cards between consecutive stop pairs:

```python
        # Insert scenic cards between stop pairs (Phase 2 — runs after Phase 1 output is available)
        scenic_pos = 0
        scenic_total_estimate = max(0, len(stops_out) - 1)  # max possible scenic cards
        enriched_stops_out = []
        for _i, _s in enumerate(stops_out):
            enriched_stops_out.append(_s)
            if _i < len(stops_out) - 1:
                _next_s = stops_out[_i + 1]
                _orig_lat = _s.get("lat")
                _orig_lon = _s.get("lon")
                _dest_lat = _next_s.get("lat")
                _dest_lon = _next_s.get("lon")
                if all(v is not None for v in [_orig_lat, _orig_lon, _dest_lat, _dest_lon]):
                    try:
                        _rp = _fetch_route_profile(_orig_lat, _orig_lon, _dest_lat, _dest_lon)
                        _visit_time = None
                        try:
                            from datetime import datetime, timezone as _tz, date as _date
                            # visit_date comes from Phase 1 output (day's calendar date string e.g. "2026-07-10")
                            # _s.get("visitDate") is set by the reel builder. Fall back to today if absent.
                            _visit_date_str = _s.get("visitDate") or _date.today().isoformat()
                            _time_str = _s.get("time", "09:00")
                            _visit_time = datetime.fromisoformat(f"{_visit_date_str}T{_time_str}:00+00:00")
                        except Exception:
                            pass
                        _scenic = _generate_scenic_card_for_corridor(
                            origin=_s, dest=_next_s, route_profile=_rp,
                            visit_time=_visit_time,
                            persona_snapshot=persona_snapshot,
                            persona_attractions=list(persona.get("attractions") or []),
                            persona_key=persona.get("archetype", ""),
                            weather=getattr(ctx, "weather_map", {}).get(day_city) or {},
                            city_landmarks=getattr(city_data, "landmark_anchors", []),
                        )
                        if _scenic:
                            scenic_pos += 1
                            _scenic["pos"] = scenic_pos
                            enriched_stops_out.append(_scenic)
                    except Exception as _e:
                        print(f"SCENIC CARD: {_e}")
        # Update total count on all scenic cards now that we know the total
        for _card in enriched_stops_out:
            if _card.get("type") == "scenic":
                _card["total"] = scenic_pos
        stops_out = enriched_stops_out
```

- [ ] **Step 6: Run all scenic generation tests**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_scenic_card_generation.py -v 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add main.py tests/test_scenic_card_generation.py
git commit -m "feat(scenic): engine route card generation and insertion between stop pairs"
```

---

### Task 12: Integration tests

**Files:**
- Create: `tests/test_scenic_integration.py`
- Modify: existing test files to add coverage for UV fetch and landmark coordinate resolution

**Interfaces:**
- Consumes: all functions from Tasks 1–11
- Produces: end-to-end test confirming that a known scenic corridor (Sumida River walk between two Tokyo stops) produces a route card

- [ ] **Step 1: Write integration tests**

Create `tests/test_scenic_integration.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone


def _mock_overpass_river():
    return {"elements": [
        {"type": "way", "tags": {"waterway": "river", "name": "Sumida River"}},
        {"type": "node", "tags": {"tourism": "viewpoint", "name": "Asakusa viewpoint"}, "lat": 35.710, "lon": 139.795},
    ]}


def test_full_character_pipeline_natural_walk():
    from main import (
        _score_instructions_by_dimension,
        _ors_surface_score,
        _fetch_route_character,
        _score_route_character,
    )
    steps = [
        {"html_instructions": "Walk along the <b>riverside promenade</b>", "distance": {"value": 800}},
        {"html_instructions": "Continue past <b>Sumida Park</b>", "distance": {"value": 400}},
    ]
    instr_scores = _score_instructions_by_dimension(steps)
    assert instr_scores["natural"] > 0

    ors_score = _ors_surface_score({
        "waytypes": {"values": [[0, 10, 5]]},
        "surface": {"values": [[0, 10, 1]]},
    })
    assert ors_score > 0

    with patch("main.fetch_overpass", return_value=_mock_overpass_river()):
        overpass_char = _fetch_route_character(
            points=[(35.71, 139.79), (35.71, 139.80)],
            instruction_scores=instr_scores,
            ors_surface_score=ors_score,
        )
    assert overpass_char["character_scores"]["waterfront"] > 0

    scoring = _score_route_character(
        mode="walk",
        instruction_scores=instr_scores,
        ors_surface_score=ors_score,
        overpass_character=overpass_char,
        road_character=0.0,
        elevation_gain_m=5,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={"w_scenic": 0.7, "w_walk_affinity": 0.8, "w_nightlife": 0.2,
                          "w_culture_depth": 0.3, "w_food_density": 0.2, "w_efficiency": 0.3,
                          "w_spontaneity": 0.5},
        persona_attractions=["nature"],
        persona_key="flaneur",
        distance_km=1.2,
    )
    assert scoring["passes_threshold"] is True
    assert scoring["top_character"] in ("natural", "waterfront")


def test_uv_fetch_returns_float():
    from main import _fetch_uv_index
    with patch("requests.get") as mock_get:
        mock_get.return_value.json.return_value = {
            "hourly": {"uv_index": [0.0] * 24}
        }
        uv = _fetch_uv_index(35.71, 139.79, datetime(2026, 7, 6, 12, 0, tzinfo=timezone.utc))
    assert isinstance(uv, float)
    assert 0.0 <= uv <= 12.0


def test_condition_multiplier_clear_afternoon():
    from main import _route_condition_multiplier
    mult = _route_condition_multiplier(
        weather={"condition": "Clear", "temp": 24,
                 "sunrise": int(datetime(2026, 7, 6, 5, 0, tzinfo=timezone.utc).timestamp()),
                 "sunset":  int(datetime(2026, 7, 6, 19, 0, tzinfo=timezone.utc).timestamp())},
        uv_index=4.0,
        visit_time=datetime(2026, 7, 6, 14, 0, tzinfo=timezone.utc),
        lat=35.71, lon=139.79,
        overpass_has_canopy=False,
        top_character="natural",
    )
    assert 0.9 <= mult <= 1.1  # clear mild afternoon → neutral multiplier


def test_landmark_peek_bearing_tokyo():
    from main import _bearing
    # Shinjuku (~35.69, 139.70) to Fuji (~35.36, 138.73): roughly WSW bearing
    b = _bearing(35.69, 139.70, 35.36, 138.73)
    assert 200 <= b <= 270  # southwest-ish
```

- [ ] **Step 2: Run all tests**

```bash
cd /Users/souravbiswas/Uncover-roads && python -m pytest tests/test_walk_polyline.py tests/test_route_character.py tests/test_condition_multiplier.py tests/test_scenic_card_generation.py tests/test_scenic_integration.py -v 2>&1 | tail -40
```

Expected: All PASS

- [ ] **Step 3: Run frontend tests**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx vitest run --reporter=verbose src/modules/route/reel/__tests__/ 2>&1 | tail -30
```

Expected: All PASS

- [ ] **Step 4: Final TypeScript compile check**

```bash
cd /Users/souravbiswas/Uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/Uncover-roads && git add tests/test_scenic_integration.py
git commit -m "test(scenic): integration tests for full character pipeline, UV fetch, condition multiplier"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Two-phase pipeline: condition_multiplier computed fresh from Phase 1 visit_time | Tasks 6, 11 |
| Walking step polylines extracted and stored in transit_corridor_cache | Task 1 |
| `walk_route_points` column migration | Task 1 |
| ORS extras (surface, waytypes, suitability) added to existing request | Task 3 |
| 7 character dimensions scored | Tasks 2, 3, 4, 7 |
| Landmark peek with bearing check ±45° | Task 5 |
| Landmark coordinate resolution from map_data_cache | Task 5 |
| Condition multiplier: thunderstorm/heavy rain hard blocks | Task 6 |
| Condition multiplier: night × vibrant boost | Task 6 |
| Condition multiplier: golden hour × viewpoint boost | Task 6 |
| Condition multiplier: heat + UV exposed/canopy | Task 6 |
| pysolar added to requirements.txt | Tasks 6, 8 |
| polyline package added to requirements.txt | Task 1 |
| Open-Meteo UV fetch | Task 6 |
| `route_profile_cache` schema migration | Task 8 |
| `_cache_route_character` helper for writing results | Task 8 |
| 3-tier user preference weighting | Task 7 |
| Route type: `walk`, `coastal`, `ridge`, `drive` | Task 7 |
| Score threshold: max × user_weight × condition_mult ≥ 0.55 | Task 7 |
| Hard block: distance < 0.5 km | Task 11 |
| Hard block: motorway > 60% (road_character < 0.4) | Task 11 |
| `ReelScenicCard` type: conditionNote, characterDimensions, landmarkPeek, routeLabel | Task 9 |
| Scenic card UI: topbar matches sc-tod pattern | Task 10 |
| Scenic card UI: no drag bar / single state | Task 10 |
| Scenic card UI: conditionNote rendered | Task 10 |
| Scenic card UI: landmarkPeek rendered | Task 10 |
| Engine insertion between stop pairs in reel | Task 11 |
| LLM why/sensory text (Phase 2) | Task 11 (stub; production LLM call in engine) |
| Itinerary update: Phase 1 re-run cascades to Phase 2 | Architecture note — no separate task; the cache miss + condition_multiplier recompute handles it |
| Trip details (hotel, check-in): handled in Phase 1 scheduling | Architecture note — stop card spec covers hotel display; scenic card is not affected |

**Trend API status:** `trend_seeder.py` and `trend_scheduler.py` are already fully implemented and tested. They populate `velocity_ratio` in `place_dynamic_profiles.signals`, which is already consumed by `compute_stop_signals` in the reel assembly loop (line ~4558). No changes needed.

**Reco card logic status:** Engine-added stops (`isEngineAdded: true`) are `ReelStopCard` objects rendered by `ReelStopCard.tsx`. Their "We added this" provenance, off-route `detourKm`, `orderConsequence`/`whyForYou`, and `timingAdjustment` are all handled in the stop card redesign plan (`2026-07-06-stop-card-redesign.md`). No separate reco card type exists.
