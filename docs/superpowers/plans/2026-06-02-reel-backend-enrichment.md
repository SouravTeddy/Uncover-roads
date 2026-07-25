# Reel Backend Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the backend so reel cards receive the data they need: correct Google Place type mappings for all reco triggers, populated `area` / `priceLevel` / `weekdayText` fields on engine stops, `stopId` anchoring on engine messages for reliable intel card placement, and stale-cache fallback on `/map-data` to survive cold starts.

**Architecture:** Five isolated changes to `main.py` and `engine/` — each is independently testable. No AI-driven data; all enrichment comes from Google Places cache or deterministic city-data lookups.

**Tech Stack:** Python / FastAPI on Railway, Supabase (`place_details_cache`, `city_data`), pytest

---

### Task 1: Fix `_TRIGGER_TYPES` and `_TRIGGER_RADIUS` for missing reco triggers

**Files:**
- Modify: `main.py:2461-2475`

**Context:** `_TRIGGER_TYPES` only maps 5 of the 9 triggers currently emitted by `buildReelCards`. `weather`, `closing_conflict`, `walking_gap`, and `crowd_peak` fall through to the default `["restaurant"]`, returning irrelevant results.

- [ ] **Step 1: Write the failing test**

Create `tests/test_reel_reco_triggers.py`:

```python
from main import _TRIGGER_TYPES, _TRIGGER_RADIUS

def test_weather_trigger_has_indoor_types():
    types = _TRIGGER_TYPES.get("weather", [])
    assert "museum" in types or "cafe" in types, "weather trigger should suggest indoor alternatives"

def test_closing_conflict_trigger_has_attraction_types():
    types = _TRIGGER_TYPES.get("closing_conflict", [])
    assert len(types) >= 2, "closing_conflict needs at least 2 place types"

def test_walking_gap_trigger_has_rest_types():
    types = _TRIGGER_TYPES.get("walking_gap", [])
    assert "cafe" in types or "restaurant" in types

def test_crowd_peak_trigger_exists():
    assert "crowd_peak" in _TRIGGER_TYPES

def test_all_triggers_have_radius():
    for trigger in _TRIGGER_TYPES:
        assert trigger in _TRIGGER_RADIUS, f"trigger '{trigger}' missing from _TRIGGER_RADIUS"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_reel_reco_triggers.py -v
```
Expected: FAIL — `weather`, `closing_conflict`, `walking_gap`, `crowd_peak` missing from dicts.

- [ ] **Step 3: Extend `_TRIGGER_TYPES` and `_TRIGGER_RADIUS` in `main.py`**

Replace the existing dict definitions at `main.py:2461-2475`:

```python
_TRIGGER_TYPES: dict[str, list[str]] = {
    "lunch":             ["restaurant", "food"],
    "dinner":            ["restaurant", "bar"],
    "evening":           ["bar", "night_club"],
    "culture":           ["museum", "art_gallery"],
    "rest":              ["cafe", "coffee_shop"],
    # ── triggers emitted by reel-builder.ts but previously unmapped ──
    "weather":           ["museum", "art_gallery", "shopping_mall", "cafe"],
    "closing_conflict":  ["tourist_attraction", "museum", "art_gallery", "park"],
    "walking_gap":       ["cafe", "restaurant"],
    "crowd_peak":        ["museum", "art_gallery", "cafe"],
}

_TRIGGER_RADIUS: dict[str, int] = {
    "lunch":             600,
    "dinner":            800,
    "evening":           1000,
    "culture":           1000,
    "rest":              400,
    "weather":           1200,
    "closing_conflict":  1000,
    "walking_gap":       400,
    "crowd_peak":        800,
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_reel_reco_triggers.py -v
```
Expected: 5 tests PASS.

- [ ] **Step 5: Verify no existing tests broken**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_reel_reco_triggers.py
git commit -m "fix: add weather/closing_conflict/walking_gap/crowd_peak trigger type mappings"
```

---

### Task 2: Populate `area` field from nearest neighborhood in engine stop output

**Files:**
- Modify: `main.py:2874-2898` (stop output dict inside `engine_itinerary` endpoint)

**Context:** Every stop currently has `"area": ""` hardcoded. `city_data.neighborhoods` is loaded at line ~2800 and contains `id`, `name`, `lat`, `lon` fields. We use haversine to find the nearest neighborhood.

- [ ] **Step 1: Write the failing test**

Create `tests/test_area_enrichment.py`:

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from main import _nearest_neighborhood_name
from city.data_model import CityData, Neighborhood

def _make_city(neighborhoods):
    return CityData(
        id="test", name="Test", tier=1,
        center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=neighborhoods,
        insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers=[],
        landmark_anchors=[], hidden_gems=[],
    )

def test_nearest_neighborhood_picks_closest():
    nh1 = Neighborhood(id="a", name="Alpha", lat=1.0, lon=1.0,
                        best_times={}, crowd_index=0.5, park=False, spot_count=5)
    nh2 = Neighborhood(id="b", name="Beta", lat=2.0, lon=2.0,
                        best_times={}, crowd_index=0.5, park=False, spot_count=5)
    city = _make_city([nh1, nh2])
    # Stop is closer to Alpha
    result = _nearest_neighborhood_name(city, lat=1.05, lon=1.05)
    assert result == "Alpha"

def test_nearest_neighborhood_empty_returns_empty():
    city = _make_city([])
    result = _nearest_neighborhood_name(city, lat=10.0, lon=10.0)
    assert result == ""
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_area_enrichment.py -v
```
Expected: FAIL — `_nearest_neighborhood_name` not defined.

- [ ] **Step 3: Add `_nearest_neighborhood_name` helper near the top of `main.py`** (after imports, before any endpoint)

Add after the existing helper functions (around line 380):

```python
def _nearest_neighborhood_name(city_data, lat: float, lon: float) -> str:
    """Return the name of the nearest neighborhood in city_data, or '' if none."""
    best_name = ""
    best_dist = float("inf")
    for nh in city_data.neighborhoods:
        dlat = math.radians(nh.lat - lat)
        dlon = math.radians(nh.lon - lon)
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(lat)) * math.cos(math.radians(nh.lat))
             * math.sin(dlon / 2) ** 2)
        dist_km = 6371 * 2 * math.asin(math.sqrt(a))
        if dist_km < best_dist:
            best_dist = dist_km
            best_name = nh.name
    return best_name
```

Verify `math` is already imported (it is — grep confirms).

- [ ] **Step 4: Use `_nearest_neighborhood_name` in the engine stop output**

In `main.py` inside `engine_itinerary`, replace the hardcoded `"area": ""` at line ~2878 with:

```python
"area": _nearest_neighborhood_name(city_data, s.lat, s.lon),
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_area_enrichment.py tests/engine/ -v
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_area_enrichment.py
git commit -m "feat: populate area field on engine stops from nearest neighborhood"
```

---

### Task 3: Populate `priceLevel` and `weekdayText` from `place_details_cache`

**Files:**
- Modify: `main.py:2835-2898` (`engine_itinerary` endpoint)

**Context:** `place_details_cache` stores Google Place Details by `place_id`. The fields we need are `data.price_level` and `data.weekday_text`. We do a single batch Supabase read for all stop place_ids — no Google API calls (never call Google per-stop at request time).

- [ ] **Step 1: Write the failing test**

Create `tests/test_place_details_lookup.py`:

```python
from main import _batch_place_details

def test_batch_returns_dict_keyed_by_place_id(mocker):
    mock_supabase = mocker.MagicMock()
    mock_resp = mocker.MagicMock()
    mock_resp.data = [
        {"place_id": "abc", "data": {"price_level": 2, "weekday_text": ["Mon: 9–5"]}},
        {"place_id": "xyz", "data": {"price_level": None, "weekday_text": []}},
    ]
    mock_supabase.table.return_value.select.return_value.in_.return_value.execute.return_value = mock_resp
    result = _batch_place_details(mock_supabase, ["abc", "xyz"])
    assert result["abc"]["price_level"] == 2
    assert result["abc"]["weekday_text"] == ["Mon: 9–5"]
    assert result["xyz"]["price_level"] is None

def test_batch_empty_place_ids_returns_empty(mocker):
    mock_supabase = mocker.MagicMock()
    result = _batch_place_details(mock_supabase, [])
    assert result == {}

def test_batch_no_supabase_returns_empty():
    result = _batch_place_details(None, ["abc"])
    assert result == {}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_place_details_lookup.py -v
```
Expected: FAIL — `_batch_place_details` not defined.

- [ ] **Step 3: Add `_batch_place_details` helper to `main.py`**

Add after `_nearest_neighborhood_name`:

```python
def _batch_place_details(supabase_client, place_ids: list[str]) -> dict[str, dict]:
    """Fetch price_level and weekday_text for a batch of place_ids from cache.

    Returns dict[place_id → {price_level, weekday_text}]. Never calls Google.
    """
    if not supabase_client or not place_ids:
        return {}
    try:
        resp = (
            supabase_client.table("place_details_cache")
            .select("place_id, data")
            .in_("place_id", place_ids)
            .execute()
        )
        rows = resp.data if hasattr(resp, "data") else (resp or [])
        return {
            row["place_id"]: {
                "price_level": (row.get("data") or {}).get("price_level"),
                "weekday_text": (row.get("data") or {}).get("weekday_text") or [],
            }
            for row in (rows or [])
            if row.get("place_id")
        }
    except Exception:
        return {}
```

- [ ] **Step 4: Use `_batch_place_details` in the `engine_itinerary` endpoint**

Inside the endpoint, after `result = await build_itinerary(engine_stops, ctx)` (line ~2835), add:

```python
# Batch-fetch price level and opening hours from cache — no Google API calls
all_place_ids = [s.place_id for s in engine_stops if s.place_id]
place_details_map = _batch_place_details(_supabase, all_place_ids)
```

Then in the stop output dict, replace:

```python
"priceLevel": None,
"weekdayText": None,
```

with:

```python
"priceLevel": place_details_map.get(s.place_id, {}).get("price_level"),
"weekdayText": place_details_map.get(s.place_id, {}).get("weekday_text") or None,
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_place_details_lookup.py tests/ -v
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_place_details_lookup.py
git commit -m "feat: populate priceLevel and weekdayText from place_details_cache in engine output"
```

---

### Task 4: Add `stopId` to engine messages for reliable intel card placement

**Files:**
- Modify: `engine/types.py:44-50`
- Modify: `engine/transitions.py:36-44`
- Modify: `engine/inserts.py:66-75`
- Modify: `main.py:2847-2858` (message serialization in `engine_itinerary`)
- Test: `tests/engine/test_types.py`

**Context:** Engine messages currently have no `stop_id` field, so `reel-builder.ts` matches intel cards to stops via headline string search (fragile). Adding `stop_id` lets the frontend match by place_id (reliable). `resequence` messages remain day-level (no anchor stop).

- [ ] **Step 1: Write the failing test**

Extend `tests/engine/test_types.py` — add at end of file:

```python
def test_engine_message_accepts_stop_id():
    msg = EngineMessage(
        type="insert", what="Added Cafe Azul",
        why="Rest break needed", consequence="Adds 30 min",
        dismissable=True, undo_key=None, stop_id="place_abc",
    )
    assert msg.stop_id == "place_abc"

def test_engine_message_stop_id_defaults_none():
    msg = EngineMessage(
        type="resequence", what="Reordered",
        why="Efficiency", consequence="Less walking",
        dismissable=True, undo_key=None,
    )
    assert msg.stop_id is None
```

Run:

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/engine/test_types.py -v
```
Expected: FAIL — `EngineMessage.__init__` doesn't accept `stop_id`.

- [ ] **Step 2: Add `stop_id` field to `EngineMessage` in `engine/types.py`**

Replace the existing `EngineMessage` dataclass:

```python
@dataclass
class EngineMessage:
    type: str          # 'swap'|'insert'|'resequence'|'weather'|'transit'|'advisory'|'event'
    what: str
    why: str
    consequence: str
    dismissable: bool
    undo_key: str | None = None
    stop_id: str | None = None   # place_id of the anchor stop; None for day-level messages
```

- [ ] **Step 3: Set `stop_id` on transit messages in `engine/transitions.py`**

In `_emit_transit_msg`, add `stop_id=a.place_id`:

```python
def _emit_transit_msg(a: EngineStop, b: EngineStop, mode: str) -> EngineMessage:
    return EngineMessage(
        type="transit",
        what=f"Taking {mode} from {a.name} to {b.name}.",
        why=f"The distance ({_haversine_km(a, b):.1f}km) exceeds comfortable walking range.",
        consequence=f"Added ~{int(_haversine_km(a, b) / 0.08)}min travel time.",
        dismissable=True,
        undo_key=None,
        stop_id=a.place_id,
    )
```

- [ ] **Step 4: Set `stop_id` on insert messages in `engine/inserts.py`**

In `_make_insert_message`, add `stop_id=candidate.place_id`:

```python
def _make_insert_message(candidate: InsertCandidate, reason: str) -> EngineMessage:
    return EngineMessage(
        type="insert",
        what=f"Added {candidate.name} ({candidate.type}) to your itinerary.",
        why=reason,
        consequence=f"This adds ~{candidate.time_cost_min} minutes to your day.",
        dismissable=True,
        undo_key=f"insert_{candidate.place_id}",
        stop_id=candidate.place_id,
    )
```

- [ ] **Step 5: Include `stopId` in message serialization in `main.py`**

In `engine_itinerary`, update the `all_messages` list comprehension (around line 2847):

```python
all_messages = [
    {
        "id": str(uuid.uuid4()),
        "type": m.type,
        "what": m.what,
        "why": m.why,
        "consequence": m.consequence,
        "dismissable": m.dismissable,
        "undo_action": m.undo_key,
        "stopId": m.stop_id,          # None for day-level messages; place_id otherwise
    }
    for m in result.messages
]
```

- [ ] **Step 6: Run all engine tests**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/engine/ tests/ -v
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add engine/types.py engine/transitions.py engine/inserts.py main.py tests/engine/test_types.py
git commit -m "feat: add stopId to engine messages for reliable intel card placement"
```

---

### Task 5: Fix `/map-data` cold-start — return stale cache while refreshing in background

**Files:**
- Modify: `main.py:481-633` (`map_data` endpoint)

**Context:** When a tile's cache is expired, the endpoint makes multiple sequential Google Nearby Search calls (timeout=8s each × N types ≈ 40–80s total). Users hit this on first city visit. Fix: return stale cache immediately if it exists; refresh in background via `BackgroundTasks`. First-visit (no cache at all) still waits, but subsequent visits are always instant.

- [ ] **Step 1: Write the failing test**

Create `tests/test_map_data_stale_cache.py`:

```python
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta

def _make_stale_row():
    """Cache row with fetched_at 48 hours ago (past MAP_DATA_CACHE_TTL_HOURS)."""
    old_ts = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    return {"places": [{"id": "p1", "title": "Old Place"}], "fetched_at": old_ts}

def test_stale_cache_is_returned_immediately(client):
    """map_data returns stale cache without waiting for Google."""
    stale = _make_stale_row()
    with patch("main._supabase") as mock_sb, patch("main.requests.get") as mock_get:
        mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = stale
        # Google should NOT be called when stale cache exists
        resp = client.get("/map-data?lat=12.97&lon=77.59")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        mock_get.assert_not_called()
```

Add a `client` fixture to `tests/conftest.py` if not present:

```python
# In tests/conftest.py — add if missing:
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    return TestClient(app)
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_map_data_stale_cache.py -v
```
Expected: FAIL — currently stale cache falls through to Google call.

- [ ] **Step 3: Refactor `map_data` to accept `BackgroundTasks` and return stale cache immediately**

Change the function signature (around line 482):

```python
from fastapi import BackgroundTasks   # add this import near top of file

@app.get("/map-data")
def map_data(
    background_tasks: BackgroundTasks,
    city:       str   = Query(""),
    lat:        float = Query(None),
    lon:        float = Query(None),
    center_lat: float = Query(None),
    center_lon: float = Query(None),
    radius_m:   int   = Query(3000),
    south: float = Query(None),
    west:  float = Query(None),
    north: float = Query(None),
    east:  float = Query(None),
):
```

In the Supabase cache-check block (around line 520), replace the current logic with:

```python
    stale_places: list | None = None
    if _supabase:
        try:
            cached = (
                _supabase.table("map_data_cache")
                .select("places, fetched_at")
                .eq("tile_key", tile_key)
                .maybe_single()
                .execute()
            )
            cached_row = _maybe_single_data(cached)
            if cached_row:
                fetched_at = datetime.fromisoformat(cached_row["fetched_at"])
                age = datetime.now(timezone.utc) - fetched_at
                if age < timedelta(hours=MAP_DATA_CACHE_TTL_HOURS):
                    print(f"MAP DATA: cache hit for tile {tile_key}")
                    return cached_row["places"]
                else:
                    # Stale cache exists — return it now, refresh in background
                    stale_places = cached_row["places"]
                    print(f"MAP DATA: stale cache for tile {tile_key}, scheduling background refresh")
                    background_tasks.add_task(
                        _refresh_map_data_tile, tile_key, clat, clon, radius_m, city
                    )
                    return stale_places
        except Exception:
            pass
```

- [ ] **Step 4: Extract the Google fetch + cache write into `_refresh_map_data_tile`**

Add this function before `map_data` (around line 480):

```python
def _refresh_map_data_tile(tile_key: str, clat: float, clon: float, radius_m: int, city: str) -> None:
    """Background task: fetch fresh map data from Google and write to cache."""
    from main import GOOGLE_PLACES_API_KEY, GOOGLE_PLACES_BASE, _NEARBY_TYPE_TO_CATEGORY, _supabase, _overpass_map_data
    import requests as _requests

    places: list = []
    if GOOGLE_PLACES_API_KEY:
        seen_place_ids: set = set()
        for gtype, category in _NEARBY_TYPE_TO_CATEGORY.items():
            try:
                resp = _requests.get(
                    f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                    params={
                        "location": f"{clat},{clon}",
                        "radius":   radius_m,
                        "type":     gtype,
                        "key":      GOOGLE_PLACES_API_KEY,
                    },
                    timeout=8,
                )
                data = resp.json()
                if data.get("status") not in ("OK", "ZERO_RESULTS"):
                    continue
                for r in data.get("results", []):
                    pid = r.get("place_id")
                    if not pid or pid in seen_place_ids:
                        continue
                    seen_place_ids.add(pid)
                    photo_ref = r["photos"][0]["photo_reference"] if r.get("photos") else None
                    loc = r.get("geometry", {}).get("location", {})
                    places.append({
                        "id":          pid,
                        "title":       r.get("name", ""),
                        "lat":         loc.get("lat"),
                        "lon":         loc.get("lng"),
                        "category":    category,
                        "place_id":    pid,
                        "rating":      r.get("rating"),
                        "open_now":    r.get("opening_hours", {}).get("open_now"),
                        "photo_ref":   photo_ref,
                        "price_level": r.get("price_level"),
                        "tags":        {"types": ",".join(r.get("types", []))},
                    })
            except Exception as e:
                print(f"MAP DATA BG: nearbysearch failed for {gtype}: {e}")
                continue

    if not places:
        try:
            places = _overpass_map_data(clat, clon, radius_m)
        except Exception as e:
            print(f"MAP DATA BG: Overpass fallback failed: {e}")

    if _supabase and places:
        try:
            _supabase.table("map_data_cache").upsert({
                "tile_key":   tile_key,
                "places":     places,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            print(f"MAP DATA BG: refreshed tile {tile_key} with {len(places)} places")
        except Exception as e:
            print(f"MAP DATA BG: cache write failed: {e}")
```

Then in `map_data`, remove the Google-fetch loop (it now lives in `_refresh_map_data_tile`). The first-visit path (no cache at all) should call `_refresh_map_data_tile` synchronously:

```python
    # No cache at all — first visit, must wait
    _refresh_map_data_tile(tile_key, clat, clon, radius_m, city)
    # Re-read from cache
    try:
        cached = (
            _supabase.table("map_data_cache")
            .select("places")
            .eq("tile_key", tile_key)
            .maybe_single()
            .execute()
        )
        row = _maybe_single_data(cached)
        return row["places"] if row else []
    except Exception:
        return []
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_map_data_stale_cache.py tests/conftest.py
git commit -m "perf: return stale map-data cache immediately and refresh in background"
```

---

### Final verification

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v --tb=short
```

All tests should pass. No regressions.
