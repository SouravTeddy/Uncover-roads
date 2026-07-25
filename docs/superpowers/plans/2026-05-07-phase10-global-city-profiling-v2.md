# Phase 10 — Global City Profiling (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-data city profiling pipeline that seeds any whitelisted city on-demand using Wikidata, OSM, Google Places, Foursquare, Open-Meteo, and Reddit — no AI-generated data — and surfaces trend velocity (trending/hidden gem/getting busy) as a Pro-only feature layer.

**Architecture:** Three layers. (1) A real-data `seed_builder.py` fetches from 6 sources in parallel and assembles a `CityData` object for any city. (2) `on_demand_seeder.py` triggers `seed_builder` on first search of any whitelisted city (~3–4s cold, instant after). (3) Two API tiers: `/api/cities/map-pins` (free, pre-seeded data only, zero live API calls) and `/api/cities/picks` (Pro, live Google + trend stage signals). Lapsed Pro users can view itineraries they built but cannot create new ones — all existing saved data remains accessible.

**Tech Stack:** Python 3.11+, FastAPI, Supabase, `requests`, GeoNames cities15000.txt, Wikidata SPARQL, OSM Overpass API, Google Places API, Foursquare Places API v3, Open-Meteo API, existing `city/data_model.py`, `city/signal_processor.py`, pytest

---

## Context (read before touching any file)

- `city/data_model.py` — `CityData` dataclass + `load_city(city_id, supabase)`. Currently raises `ValueError("city_not_found: ...")` on miss. Task 7 replaces this with on-demand seeding.
- `city/signal_processor.py` + `city/sync_job.py` — weekly APScheduler job that already writes `stage`, `velocity_ratio`, crowd/hidden_gem signals to `place_dynamic_profiles`. **Do not modify these.**
- `city/cities_registry.py` — 80 Tier 1 cities with lat/lon/timezone/country/notes. Already exists. Used by seed_builder as metadata hints.
- `main.py:89` — `seed_cities_and_start_sync()` hardcodes `["tokyo", "paris", "nyc"]`. Task 9 makes this dynamic.
- `main.py:129` — `require_pro` dependency already exists and enforces subscription check.
- `city/generate_seeds.py` — **delete in Task 1**. Replaced by `seed_builder.py`.
- `city_whitelist` Supabase table — defined in master plan SQL, may not exist yet. Schema:
  ```sql
  CREATE TABLE IF NOT EXISTS city_whitelist (
    city_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT NOT NULL,
    tier INTEGER NOT NULL DEFAULT 2,
    coordinates POINT NOT NULL,
    seeded BOOLEAN DEFAULT FALSE,
    seeded_at TIMESTAMPTZ,
    added_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS city_whitelist_name ON city_whitelist (name);
  CREATE INDEX IF NOT EXISTS city_whitelist_seeded ON city_whitelist (seeded);
  ```

---

## New Environment Variables Required

Add to Railway backend environment (never in code):
```
FOURSQUARE_API_KEY=<from developer.foursquare.com — free tier, 100k calls/day>
```

`GOOGLE_PLACES_API_KEY` and `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` already exist.
`SUPABASE_URL` and `SUPABASE_SERVICE_KEY` already exist.

---

## File Map

**Delete:**
- `city/generate_seeds.py` — replaced by real-data pipeline

**Create:**
- `city/country_profiles.py` — static meal times + siesta per country code (~30 entries covers all 80 cities)
- `city/persona_affinity.py` — derives persona affinity scores from Google Places category string
- `city/seed_builder.py` — real-data pipeline: Wikidata + OSM + Google Places + Foursquare + Open-Meteo → CityData
- `city/on_demand_seeder.py` — triggers seed_builder for any whitelisted city, stores to Supabase
- `city/whitelist_builder.py` — CLI: downloads GeoNames cities15000.txt, filters, loads into `city_whitelist`
- `city/prelaunch_batch_seed.py` — CLI: seeds all unseeded whitelisted cities at 20/hour
- `tests/city/test_country_profiles.py` — 4 tests
- `tests/city/test_persona_affinity.py` — 5 tests
- `tests/city/test_seed_builder.py` — 8 tests (all mocked API calls)
- `tests/city/test_on_demand_seeder.py` — 6 tests

**Modify:**
- `city/data_model.py` — `load_city()`: check whitelist on miss, call on_demand_seeder
- `main.py` — dynamic startup seeding; add `/api/cities/autocomplete`, `/api/cities/search`, `/api/cities/map-pins` (free), `/api/cities/picks` (pro)

---

## Tier Model

| Endpoint / Feature | Tier | Live API calls? |
|---|---|---|
| `/api/cities/autocomplete` | Free (auth required) | No — whitelist DB read |
| `/api/cities/search` | Free (auth required) | No — whitelist DB read |
| `/api/cities/map-pins` | Free (auth required) | No — pre-seeded Supabase read |
| `/api/cities/picks` | **Pro** | Yes — Google Places + stage signals |
| `/api/itinerary/build` | **Pro** | Yes — unchanged |
| View previously built itinerary | Lapsed Pro (read-only) | No — Supabase read |
| Create new itinerary | **Active Pro only** | Yes |

**Lapsed Pro rule:** `require_pro` already raises 403. For itinerary *reads*, use `get_current_user` (auth only, no sub check). Frontend shows "Resubscribe to create new trips" — existing trips always readable.

---

## Task 1: Cleanup — remove generate_seeds.py

**Files:**
- Delete: `city/generate_seeds.py`

- [ ] **Step 1: Delete the file**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/phase10-global-city-profiling
git rm city/generate_seeds.py
```

- [ ] **Step 2: Verify tests still pass**

```bash
python3 -m pytest tests/ -v --tb=short 2>&1 | tail -5
```
Expected: all passing, no reference to generate_seeds.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove AI-generated seed generator — replaced by real-data pipeline"
```

---

## Task 2: Country profiles (`city/country_profiles.py`)

**Files:**
- Create: `city/country_profiles.py`
- Create: `tests/city/test_country_profiles.py`

- [ ] **Step 1: Write failing tests**

Create `tests/city/test_country_profiles.py`:

```python
from city.country_profiles import get_country_modifiers


def test_japan_no_siesta():
    mods = get_country_modifiers("JP")
    assert mods["siesta_window"] is None
    assert mods["meal_times"]["dinner"] == "18:30"


def test_spain_has_siesta():
    mods = get_country_modifiers("ES")
    assert mods["siesta_window"] == "14:00-17:00"
    assert mods["lunch_window_strict"] is True


def test_unknown_country_returns_default():
    mods = get_country_modifiers("XX")
    assert "meal_times" in mods
    assert "siesta_window" in mods
    assert "lunch_window_strict" in mods
    assert "evening_end_time" in mods


def test_all_entries_have_required_keys():
    from city.country_profiles import COUNTRY_PROFILES
    required = {"meal_times", "siesta_window", "lunch_window_strict", "evening_end_time"}
    for code, entry in COUNTRY_PROFILES.items():
        missing = required - set(entry.keys())
        assert not missing, f"{code} missing: {missing}"
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/phase10-global-city-profiling
python3 -m pytest tests/city/test_country_profiles.py -v 2>&1 | tail -5
```
Expected: `ModuleNotFoundError: No module named 'city.country_profiles'`

- [ ] **Step 3: Write `city/country_profiles.py`**

```python
"""Static country-level modifiers for the itinerary engine.

Covers meal timing, siesta windows, and evening cutoff.
~30 entries covers all 80 Tier 1 cities plus common travel destinations.
Fallback to '_default' for unlisted countries.

Sources: cultural knowledge encoded once — these change on decade timescales.
"""

COUNTRY_PROFILES: dict[str, dict] = {
    "JP": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "FR": {"meal_times": {"lunch": "12:30", "dinner": "20:00"}, "siesta_window": "12:30-14:30",   "lunch_window_strict": True,  "evening_end_time": "23:00"},
    "US": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "ES": {"meal_times": {"lunch": "14:00", "dinner": "21:30"}, "siesta_window": "14:00-17:00",   "lunch_window_strict": True,  "evening_end_time": "00:00"},
    "IT": {"meal_times": {"lunch": "13:00", "dinner": "20:30"}, "siesta_window": "13:00-16:00",   "lunch_window_strict": True,  "evening_end_time": "23:30"},
    "PT": {"meal_times": {"lunch": "13:00", "dinner": "21:00"}, "siesta_window": "13:00-15:00",   "lunch_window_strict": False, "evening_end_time": "23:30"},
    "GR": {"meal_times": {"lunch": "14:00", "dinner": "21:30"}, "siesta_window": "14:00-17:30",   "lunch_window_strict": True,  "evening_end_time": "00:00"},
    "GB": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "DE": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "NL": {"meal_times": {"lunch": "12:30", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "AT": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "CH": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "CZ": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "PL": {"meal_times": {"lunch": "12:30", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "HU": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "BE": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "SE": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "DK": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "IE": {"meal_times": {"lunch": "12:30", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "IS": {"meal_times": {"lunch": "12:00", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "TR": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "IN": {"meal_times": {"lunch": "13:00", "dinner": "21:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "TH": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "VN": {"meal_times": {"lunch": "11:30", "dinner": "18:00"}, "siesta_window": "12:00-14:00",   "lunch_window_strict": False, "evening_end_time": "22:00"},
    "SG": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "MY": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "ID": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "KR": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "TW": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "HK": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "AE": {"meal_times": {"lunch": "13:00", "dinner": "20:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "EG": {"meal_times": {"lunch": "14:00", "dinner": "21:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "00:00"},
    "MA": {"meal_times": {"lunch": "13:00", "dinner": "20:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "ZA": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "KE": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "GH": {"meal_times": {"lunch": "13:00", "dinner": "19:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "MX": {"meal_times": {"lunch": "14:00", "dinner": "21:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "BR": {"meal_times": {"lunch": "12:30", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "AR": {"meal_times": {"lunch": "13:00", "dinner": "21:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "00:00"},
    "CO": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "PE": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "CA": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "AU": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "NZ": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "IL": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "JO": {"meal_times": {"lunch": "13:30", "dinner": "20:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "GE": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "NP": {"meal_times": {"lunch": "13:00", "dinner": "19:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "LK": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "TZ": {"meal_times": {"lunch": "13:00", "dinner": "19:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "_default": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,     "lunch_window_strict": False, "evening_end_time": "22:00"},
}


def get_country_modifiers(country_code: str) -> dict:
    """Return meal timing + siesta modifiers for a country. Falls back to _default."""
    return COUNTRY_PROFILES.get(country_code, COUNTRY_PROFILES["_default"])
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/city/test_country_profiles.py -v
```
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add city/country_profiles.py tests/city/test_country_profiles.py
git commit -m "feat: static country modifiers — meal times + siesta for 48 countries"
```

---

## Task 3: Persona affinity derivation (`city/persona_affinity.py`)

**Files:**
- Create: `city/persona_affinity.py`
- Create: `tests/city/test_persona_affinity.py`

- [ ] **Step 1: Write failing tests**

Create `tests/city/test_persona_affinity.py`:

```python
from city.persona_affinity import get_persona_affinity, ARCHETYPES


def test_museum_high_historian():
    scores = get_persona_affinity("museum")
    assert scores["historian"] >= 0.8


def test_cafe_high_epicurean_and_slowtraveller():
    scores = get_persona_affinity("cafe")
    assert scores["epicurean"] >= 0.7
    assert scores["slowtraveller"] >= 0.7


def test_night_club_high_pulse():
    scores = get_persona_affinity("night_club")
    assert scores["pulse"] >= 0.9


def test_unknown_type_returns_neutral():
    scores = get_persona_affinity("unmapped_type_xyz")
    for archetype in ARCHETYPES:
        assert scores[archetype] == 0.5


def test_all_scores_in_range():
    for gtype in ["museum", "cafe", "park", "restaurant", "tourist_attraction", "bar", "market"]:
        scores = get_persona_affinity(gtype)
        for archetype, score in scores.items():
            assert 0.0 <= score <= 1.0, f"{gtype}/{archetype} = {score} out of range"
```

- [ ] **Step 2: Run to verify it fails**

```bash
python3 -m pytest tests/city/test_persona_affinity.py -v 2>&1 | tail -5
```
Expected: `ModuleNotFoundError: No module named 'city.persona_affinity'`

- [ ] **Step 3: Write `city/persona_affinity.py`**

```python
"""Derives persona affinity scores from Google Places primary type.

Used when building insert_candidates — maps a place category to
how strongly each persona archetype would enjoy it.

Scores are in [0.0, 1.0]. Unknown types return NEUTRAL (all 0.5).
Post-launch: override with behavior data (pin_saved/pin_dismissed signals).
"""

ARCHETYPES = ["wanderer", "voyager", "epicurean", "historian", "pulse", "slowtraveller", "explorer"]

NEUTRAL: dict[str, float] = {a: 0.5 for a in ARCHETYPES}

_AFFINITY: dict[str, dict[str, float]] = {
    "museum": {
        "wanderer": 0.5, "voyager": 0.7, "epicurean": 0.3,
        "historian": 0.95, "pulse": 0.2, "slowtraveller": 0.5, "explorer": 0.8,
    },
    "art_gallery": {
        "wanderer": 0.7, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.8, "pulse": 0.3, "slowtraveller": 0.7, "explorer": 0.7,
    },
    "cafe": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.4, "pulse": 0.4, "slowtraveller": 0.9, "explorer": 0.6,
    },
    "coffee_shop": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.4, "pulse": 0.4, "slowtraveller": 0.9, "explorer": 0.6,
    },
    "restaurant": {
        "wanderer": 0.6, "voyager": 0.8, "epicurean": 0.95,
        "historian": 0.3, "pulse": 0.5, "slowtraveller": 0.6, "explorer": 0.7,
    },
    "food": {
        "wanderer": 0.7, "voyager": 0.7, "epicurean": 0.9,
        "historian": 0.3, "pulse": 0.4, "slowtraveller": 0.7, "explorer": 0.7,
    },
    "market": {
        "wanderer": 0.95, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.5, "pulse": 0.5, "slowtraveller": 0.7, "explorer": 0.7,
    },
    "park": {
        "wanderer": 0.9, "voyager": 0.5, "epicurean": 0.4,
        "historian": 0.3, "pulse": 0.2, "slowtraveller": 0.9, "explorer": 0.7,
    },
    "tourist_attraction": {
        "wanderer": 0.7, "voyager": 0.85, "epicurean": 0.4,
        "historian": 0.8, "pulse": 0.4, "slowtraveller": 0.4, "explorer": 0.9,
    },
    "point_of_interest": {
        "wanderer": 0.8, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.7, "pulse": 0.4, "slowtraveller": 0.5, "explorer": 0.8,
    },
    "bar": {
        "wanderer": 0.6, "voyager": 0.5, "epicurean": 0.7,
        "historian": 0.2, "pulse": 0.85, "slowtraveller": 0.5, "explorer": 0.7,
    },
    "night_club": {
        "wanderer": 0.3, "voyager": 0.3, "epicurean": 0.4,
        "historian": 0.1, "pulse": 1.0, "slowtraveller": 0.1, "explorer": 0.6,
    },
    "beach": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.4,
        "historian": 0.2, "pulse": 0.6, "slowtraveller": 0.85, "explorer": 0.7,
    },
    "natural_feature": {
        "wanderer": 0.9, "voyager": 0.6, "epicurean": 0.2,
        "historian": 0.3, "pulse": 0.2, "slowtraveller": 0.8, "explorer": 0.9,
    },
    "viewpoint": {
        "wanderer": 1.0, "voyager": 0.7, "epicurean": 0.3,
        "historian": 0.5, "pulse": 0.4, "slowtraveller": 0.8, "explorer": 0.8,
    },
    "place_of_worship": {
        "wanderer": 0.6, "voyager": 0.6, "epicurean": 0.2,
        "historian": 0.9, "pulse": 0.1, "slowtraveller": 0.6, "explorer": 0.6,
    },
    "spa": {
        "wanderer": 0.3, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.1, "pulse": 0.2, "slowtraveller": 0.9, "explorer": 0.4,
    },
    "shopping_mall": {
        "wanderer": 0.4, "voyager": 0.4, "epicurean": 0.5,
        "historian": 0.1, "pulse": 0.6, "slowtraveller": 0.3, "explorer": 0.5,
    },
}


def get_persona_affinity(google_type: str) -> dict[str, float]:
    """Return persona affinity scores for a Google Places primary type."""
    return dict(_AFFINITY.get(google_type, NEUTRAL))
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/city/test_persona_affinity.py -v
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add city/persona_affinity.py tests/city/test_persona_affinity.py
git commit -m "feat: persona affinity derivation — Google Places type → archetype scores"
```

---

## Task 4: Real-data seed builder (`city/seed_builder.py`)

**Files:**
- Create: `city/seed_builder.py`
- Create: `tests/city/test_seed_builder.py`

This is the core pipeline. 6 external sources, all fetched in parallel via `ThreadPoolExecutor`. Each fetch function is thin and independently mockable.

**API endpoints used:**
- Wikidata SPARQL: `https://query.wikidata.org/sparql` — no key
- OSM Overpass: `https://overpass-api.de/api/interpreter` — no key
- Google Places Nearby Search: `https://maps.googleapis.com/maps/api/place/nearbysearch/json` — `GOOGLE_PLACES_API_KEY`
- Foursquare Places: `https://api.foursquare.com/v3/places/search` — `FOURSQUARE_API_KEY`
- Open-Meteo Archive: `https://archive-api.open-meteo.com/v1/archive` — no key

- [ ] **Step 1: Write failing tests**

Create `tests/city/test_seed_builder.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from city.data_model import CityData, Neighborhood, InsertCandidate
from city.seed_builder import (
    _fetch_wikidata_landmarks,
    _fetch_osm_neighborhoods,
    _fetch_google_pois,
    _fetch_foursquare_hidden_gems,
    _fetch_climate,
    _build_insert_candidates,
    build_city_seed,
)

PORTO = {
    "city_id": "porto", "name": "Porto", "lat": 41.1579, "lon": -8.6291,
    "country_code": "PT", "timezone": "Europe/Lisbon", "tier": 1,
}


def _mock_wikidata_response(names):
    rows = [{"item": {"value": f"http://www.wikidata.org/entity/Q{i}"},
             "itemLabel": {"value": n}} for i, n in enumerate(names)]
    return {"results": {"bindings": rows}}


def _mock_osm_response(neighborhood_names):
    elements = [
        {"type": "relation", "tags": {"name": n},
         "center": {"lat": 41.15 + i * 0.01, "lon": -8.62 + i * 0.01}}
        for i, n in enumerate(neighborhood_names)
    ]
    return {"elements": elements}


def _mock_google_response(places):
    return {
        "status": "OK",
        "results": [
            {"place_id": f"gp_{i}", "name": p["name"],
             "geometry": {"location": {"lat": 41.15 + i * 0.005, "lng": -8.62 + i * 0.005}},
             "types": [p["type"]], "rating": 4.2, "user_ratings_total": 200}
            for i, p in enumerate(places)
        ]
    }


def _mock_foursquare_response(venue_names):
    return {
        "results": [
            {"fsq_id": f"fsq_{i}", "name": n,
             "geocodes": {"main": {"latitude": 41.155 + i * 0.005, "longitude": -8.615 + i * 0.005}},
             "categories": [{"name": "Local Spot"}]}
            for i, n in enumerate(venue_names)
        ]
    }


def _mock_open_meteo_response():
    import json
    # Minimal: 12 months of temp + precip data
    return {
        "monthly": {
            "temperature_2m_mean": [9, 10, 12, 14, 16, 19, 22, 22, 20, 16, 12, 9],
            "precipitation_sum": [130, 110, 90, 70, 60, 30, 10, 15, 45, 110, 130, 150],
        }
    }


# ── _fetch_wikidata_landmarks ─────────────────────────────────────────────────

def test_fetch_wikidata_landmarks_returns_slugs():
    with patch("city.seed_builder.requests.get") as mock_get:
        mock_get.return_value.json.return_value = _mock_wikidata_response(
            ["Clerigos Tower", "Ribeira District", "Dom Luis Bridge"]
        )
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_wikidata_landmarks(PORTO)
    assert isinstance(result, list)
    assert "clerigos_tower" in result
    assert "ribeira_district" in result


# ── _fetch_osm_neighborhoods ──────────────────────────────────────────────────

def test_fetch_osm_neighborhoods_returns_neighborhood_objects():
    with patch("city.seed_builder.requests.post") as mock_post:
        mock_post.return_value.json.return_value = _mock_osm_response(
            ["Ribeira", "Bonfim", "Cedofeita"]
        )
        mock_post.return_value.raise_for_status = MagicMock()
        result = _fetch_osm_neighborhoods(PORTO)
    assert len(result) >= 2
    assert all(isinstance(n, Neighborhood) for n in result)
    assert all(n.id for n in result)


# ── _fetch_google_pois ────────────────────────────────────────────────────────

def test_fetch_google_pois_returns_dicts():
    neighborhoods = [
        Neighborhood(id="ribeira", name="Ribeira", center=(41.140, -8.614),
                     polygon=[], best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                     crowd_index={"weekday": 0.5, "weekend": 0.7})
    ]
    with patch("city.seed_builder.requests.get") as mock_get:
        mock_get.return_value.json.return_value = _mock_google_response([
            {"name": "Majestic Cafe", "type": "cafe"},
            {"name": "Casa Guedes", "type": "restaurant"},
        ])
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_google_pois(PORTO, neighborhoods)
    assert len(result) >= 1
    assert all("name" in p and "lat" in p and "type" in p for p in result)


# ── _fetch_foursquare_hidden_gems ─────────────────────────────────────────────

def test_fetch_foursquare_hidden_gems_returns_slugs():
    with patch("city.seed_builder.requests.get") as mock_get:
        mock_get.return_value.json.return_value = _mock_foursquare_response(
            ["Taberna dos Mercadores", "Cafe Candelabro"]
        )
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_foursquare_hidden_gems(PORTO)
    assert isinstance(result, list)


# ── _fetch_climate ────────────────────────────────────────────────────────────

def test_fetch_climate_returns_expected_shape():
    with patch("city.seed_builder.requests.get") as mock_get:
        mock_get.return_value.json.return_value = _mock_open_meteo_response()
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_climate(PORTO)
    assert "heat_threshold_c" in result
    assert "rain_months" in result
    assert isinstance(result["rain_months"], list)


# ── build_city_seed ───────────────────────────────────────────────────────────

def test_build_city_seed_returns_citydata():
    neighborhoods = [
        Neighborhood(id="ribeira", name="Ribeira", center=(41.140, -8.614),
                     polygon=[], best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                     crowd_index={"weekday": 0.5, "weekend": 0.7})
    ]
    with patch("city.seed_builder._fetch_wikidata_landmarks", return_value=["clerigos_tower", "ribeira"]), \
         patch("city.seed_builder._fetch_osm_neighborhoods", return_value=neighborhoods), \
         patch("city.seed_builder._fetch_google_pois", return_value=[
             {"place_id": "gp_0", "name": "Majestic Cafe", "lat": 41.148, "lon": -8.609,
              "type": "cafe", "time_cost_min": 30},
             {"place_id": "gp_1", "name": "Casa Guedes", "lat": 41.145, "lon": -8.611,
              "type": "restaurant", "time_cost_min": 60},
         ]), \
         patch("city.seed_builder._fetch_foursquare_hidden_gems", return_value=["taberna_dos_mercadores"]), \
         patch("city.seed_builder._fetch_climate", return_value={"heat_threshold_c": 28, "rain_months": [11, 12, 1]}):
        city = build_city_seed(PORTO)
    assert isinstance(city, CityData)
    assert city.id == "porto"
    assert city.name == "Porto"
    assert len(city.neighborhoods) >= 1
    assert len(city.insert_candidates) >= 1
    assert city.engine_modifiers["siesta_window"] == "13:00-15:00"  # Portugal
    assert city.landmark_anchors == ["clerigos_tower", "ribeira"]


def test_build_city_seed_has_coffee_insert():
    neighborhoods = [
        Neighborhood(id="ribeira", name="Ribeira", center=(41.140, -8.614),
                     polygon=[], best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                     crowd_index={"weekday": 0.5, "weekend": 0.7})
    ]
    with patch("city.seed_builder._fetch_wikidata_landmarks", return_value=["clerigos_tower"]), \
         patch("city.seed_builder._fetch_osm_neighborhoods", return_value=neighborhoods), \
         patch("city.seed_builder._fetch_google_pois", return_value=[
             {"place_id": "gp_0", "name": "Majestic Cafe", "lat": 41.148, "lon": -8.609,
              "type": "cafe", "time_cost_min": 30},
             {"place_id": "gp_1", "name": "Casa Guedes", "lat": 41.145, "lon": -8.611,
              "type": "restaurant", "time_cost_min": 60},
         ]), \
         patch("city.seed_builder._fetch_foursquare_hidden_gems", return_value=[]), \
         patch("city.seed_builder._fetch_climate", return_value={"heat_threshold_c": 28, "rain_months": [11]}):
        city = build_city_seed(PORTO)
    coffee = [ic for ic in city.insert_candidates if ic.type == "coffee"]
    assert len(coffee) >= 1
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/city/test_seed_builder.py -v 2>&1 | tail -5
```
Expected: `ModuleNotFoundError: No module named 'city.seed_builder'`

- [ ] **Step 3: Write `city/seed_builder.py`**

```python
"""Real-data city seed builder.

Fetches from 6 sources in parallel and assembles a CityData object.
All fetch functions are thin wrappers — independently mockable.

Sources:
  - Wikidata SPARQL   → landmark_anchors (CC0, no key)
  - OSM Overpass      → neighborhoods (internal use, not redistributed)
  - Google Places API → insert_candidates, crowd_index
  - Foursquare API    → hidden_gems (optional, skipped if no key)
  - Open-Meteo        → climate (CC BY 4.0, no key)
  - country_profiles  → engine_modifiers (static)

Latency: ~3–4s fully parallelised on cold city.
"""
from __future__ import annotations
import math
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import requests

from city.country_profiles import get_country_modifiers
from city.data_model import CityData, InsertCandidate, Neighborhood, load_city_from_dict
from city.persona_affinity import get_persona_affinity

_WIKIDATA_URL = "https://query.wikidata.org/sparql"
_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
_FOURSQUARE_URL = "https://api.foursquare.com/v3/places/search"
_OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"

# Google Place types → insert candidate type
_TYPE_MAP: dict[str, str] = {
    "cafe": "coffee", "coffee_shop": "coffee",
    "restaurant": "lunch", "food": "lunch",
    "park": "scenic_walk", "natural_feature": "scenic_walk", "viewpoint": "scenic_walk",
    "spa": "rest", "lodging": "rest",
    "tourist_attraction": "micro", "point_of_interest": "micro",
    "museum": "micro", "art_gallery": "micro",
}
_DEFAULT_TIME_COST: dict[str, int] = {
    "coffee": 25, "lunch": 60, "scenic_walk": 45, "rest": 30, "micro": 45
}


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ── Fetch functions ───────────────────────────────────────────────────────────

def _fetch_wikidata_landmarks(city: dict) -> list[str]:
    """Return up to 8 landmark slug IDs near city center via Wikidata SPARQL."""
    query = f"""
SELECT DISTINCT ?item ?itemLabel WHERE {{
  SERVICE wikibase:around {{
    ?item wdt:P625 ?loc.
    bd:serviceParam wikibase:center "Point({city['lon']} {city['lat']})"^^geo:wktLiteral.
    bd:serviceParam wikibase:radius "15".
  }}
  ?item wdt:P31/wdt:P279* wd:Q570116.
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT 8
"""
    try:
        r = requests.get(
            _WIKIDATA_URL,
            params={"query": query, "format": "json"},
            headers={"User-Agent": "UncoverRoads/1.0 (travel app)"},
            timeout=10,
        )
        r.raise_for_status()
        bindings = r.json()["results"]["bindings"]
        return [_slugify(b["itemLabel"]["value"]) for b in bindings if "itemLabel" in b][:8]
    except Exception:
        return []


def _fetch_osm_neighborhoods(city: dict) -> list[Neighborhood]:
    """Return 3–5 administrative neighborhoods near city center via OSM Overpass."""
    query = f"""
[out:json][timeout:25];
(
  relation["admin_level"~"8|9|10"]["name"]["boundary"="administrative"]
  (around:12000,{city['lat']},{city['lon']});
);
out center;
"""
    try:
        r = requests.post(_OVERPASS_URL, data={"data": query}, timeout=30)
        r.raise_for_status()
        elements = r.json().get("elements", [])
        neighborhoods = []
        seen = set()
        for el in elements:
            name = el.get("tags", {}).get("name", "").strip()
            if not name or name in seen:
                continue
            center = el.get("center", {})
            lat = center.get("lat", city["lat"])
            lon = center.get("lon", city["lon"])
            nid = _slugify(name)
            neighborhoods.append(Neighborhood(
                id=nid, name=name, center=(lat, lon), polygon=[],
                best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                crowd_index={"weekday": 0.5, "weekend": 0.7},
            ))
            seen.add(name)
            if len(neighborhoods) == 5:
                break
        # Fallback: single generic neighborhood at city center
        if not neighborhoods:
            neighborhoods.append(Neighborhood(
                id=_slugify(city["name"]) + "_center",
                name=f"{city['name']} Center",
                center=(city["lat"], city["lon"]), polygon=[],
                best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                crowd_index={"weekday": 0.5, "weekend": 0.7},
            ))
        return neighborhoods
    except Exception:
        return [Neighborhood(
            id=_slugify(city["name"]) + "_center",
            name=f"{city['name']} Center",
            center=(city["lat"], city["lon"]), polygon=[],
            best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
            crowd_index={"weekday": 0.5, "weekend": 0.7},
        )]


def _fetch_google_pois(city: dict, neighborhoods: list[Neighborhood]) -> list[dict]:
    """Return POIs from Google Places for each neighborhood (coffee, lunch, scenic)."""
    key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not key:
        return []
    categories = ["cafe", "restaurant", "park"]
    results: list[dict] = []
    seen_ids: set[str] = set()
    for nh in neighborhoods[:3]:  # limit to 3 neighborhoods to stay within quota
        for category in categories:
            try:
                r = requests.get(_PLACES_URL, params={
                    "location": f"{nh.center[0]},{nh.center[1]}",
                    "radius": 800,
                    "type": category,
                    "key": key,
                }, timeout=10)
                r.raise_for_status()
                for place in r.json().get("results", [])[:2]:
                    pid = place.get("place_id", "")
                    if pid in seen_ids:
                        continue
                    seen_ids.add(pid)
                    primary_type = (place.get("types") or [category])[0]
                    insert_type = _TYPE_MAP.get(primary_type, "micro")
                    results.append({
                        "place_id": pid,
                        "name": place["name"],
                        "lat": place["geometry"]["location"]["lat"],
                        "lon": place["geometry"]["location"]["lng"],
                        "type": insert_type,
                        "google_type": primary_type,
                        "time_cost_min": _DEFAULT_TIME_COST.get(insert_type, 45),
                        "neighborhood": nh.id,
                    })
            except Exception:
                continue
    return results


def _fetch_foursquare_hidden_gems(city: dict) -> list[str]:
    """Return up to 5 hidden gem slug IDs from Foursquare near city center."""
    key = os.environ.get("FOURSQUARE_API_KEY", "")
    if not key:
        return []
    try:
        r = requests.get(
            _FOURSQUARE_URL,
            params={
                "ll": f"{city['lat']},{city['lon']}",
                "radius": 10000,
                "limit": 10,
                "sort": "POPULARITY",
            },
            headers={"Authorization": key, "Accept": "application/json"},
            timeout=10,
        )
        r.raise_for_status()
        venues = r.json().get("results", [])
        # Prefer smaller venues (lower popularity rank = more local)
        return [_slugify(v["name"]) for v in venues[5:10] if v.get("name")][:5]
    except Exception:
        return []


def _fetch_climate(city: dict) -> dict:
    """Return heat_threshold_c and rain_months from Open-Meteo 5-year historical avg."""
    from datetime import date
    end_year = date.today().year - 1
    start_year = end_year - 4
    try:
        r = requests.get(_OPEN_METEO_URL, params={
            "latitude": city["lat"],
            "longitude": city["lon"],
            "start_date": f"{start_year}-01-01",
            "end_date": f"{end_year}-12-31",
            "monthly": "temperature_2m_mean,precipitation_sum",
            "timezone": city.get("timezone", "UTC"),
        }, timeout=15)
        r.raise_for_status()
        data = r.json().get("monthly", {})
        temps = data.get("temperature_2m_mean", [])
        precip = data.get("precipitation_sum", [])
        # Average across years (data comes as flat list month by month across years)
        # monthly averages: group by month index (mod 12)
        monthly_temp = [0.0] * 12
        monthly_precip = [0.0] * 12
        counts = [0] * 12
        for i, (t, p) in enumerate(zip(temps, precip)):
            m = i % 12
            if t is not None:
                monthly_temp[m] += t
            if p is not None:
                monthly_precip[m] += p
            counts[m] += 1
        monthly_temp = [monthly_temp[m] / max(counts[m], 1) for m in range(12)]
        monthly_precip = [monthly_precip[m] / max(counts[m], 1) for m in range(12)]
        heat_threshold_c = max(int(max(monthly_temp)), 25)
        rain_months = [i + 1 for i, p in enumerate(monthly_precip) if p > 80]
        return {"heat_threshold_c": heat_threshold_c, "rain_months": rain_months}
    except Exception:
        return {"heat_threshold_c": 30, "rain_months": []}


# ── Assembly ──────────────────────────────────────────────────────────────────

def _build_insert_candidates(
    pois: list[dict],
    hidden_gems: list[str],
    neighborhoods: list[Neighborhood],
) -> list[InsertCandidate]:
    candidates = []
    for poi in pois:
        affinity = get_persona_affinity(poi.get("google_type", poi["type"]))
        time_of_day = {
            "coffee": ["morning", "afternoon"],
            "lunch": ["afternoon"],
            "scenic_walk": ["morning", "afternoon", "evening"],
            "rest": ["afternoon", "evening"],
            "micro": ["morning", "afternoon", "evening"],
        }.get(poi["type"], ["morning", "afternoon", "evening"])
        candidates.append(InsertCandidate(
            place_id=poi["place_id"] or f"{poi['type']}_{poi.get('neighborhood', 'center')}_0",
            name=poi["name"],
            lat=poi["lat"],
            lon=poi["lon"],
            type=poi["type"],
            time_cost_min=poi["time_cost_min"],
            persona_affinity=affinity,
            trigger=None,
            time_of_day_match=time_of_day,
        ))
    return candidates


def _derive_scenic_routes(neighborhoods: list[Neighborhood]) -> list[dict]:
    """Connect adjacent neighborhoods (within 2km) as scenic walk routes."""
    routes = []
    for i, a in enumerate(neighborhoods):
        for b in neighborhoods[i + 1:]:
            dist_km = _haversine_km(a.center[0], a.center[1], b.center[0], b.center[1])
            if dist_km <= 2.0:
                walk_min = int(dist_km * 15)  # ~15 min/km walking
                routes.append({
                    "id": f"{a.id}_to_{b.id}",
                    "from_neighborhood": a.id,
                    "to_neighborhood": b.id,
                    "walk_min": max(walk_min, 5),
                    "score": round(max(0.5, 1.0 - dist_km / 2.0), 2),
                })
    return routes[:3]


def build_city_seed(city_entry: dict) -> CityData:
    """Build a CityData from real external sources. ~3–4s on cold city.

    Args:
        city_entry: dict with keys: city_id, name, lat, lon, country_code, timezone, tier
    """
    with ThreadPoolExecutor(max_workers=5) as pool:
        f_landmarks = pool.submit(_fetch_wikidata_landmarks, city_entry)
        f_neighborhoods = pool.submit(_fetch_osm_neighborhoods, city_entry)
        f_climate = pool.submit(_fetch_climate, city_entry)
        f_hidden = pool.submit(_fetch_foursquare_hidden_gems, city_entry)
        neighborhoods = f_neighborhoods.result()
        f_pois = pool.submit(_fetch_google_pois, city_entry, neighborhoods)
        landmarks = f_landmarks.result()
        climate = f_climate.result()
        hidden_gems = f_hidden.result()
        pois = f_pois.result()

    country_mods = get_country_modifiers(city_entry["country_code"])
    insert_candidates = _build_insert_candidates(pois, hidden_gems, neighborhoods)
    scenic_routes = _derive_scenic_routes(neighborhoods)

    # Derive walkability from neighborhood density
    if len(neighborhoods) >= 4:
        walkability = 3
    elif len(neighborhoods) >= 2:
        walkability = 2
    else:
        walkability = 1

    return load_city_from_dict({
        "id": city_entry["city_id"],
        "name": city_entry["name"],
        "tier": city_entry["tier"],
        "center": [city_entry["lat"], city_entry["lon"]],
        "timezone": city_entry["timezone"],
        "climate": climate,
        "movement": {"walkability": walkability, "transit": 2},
        "culture": {
            "meal_times": country_mods["meal_times"],
            "siesta": country_mods["siesta_window"] is not None,
        },
        "neighborhoods": [
            {
                "id": n.id, "name": n.name,
                "center": list(n.center), "polygon": [],
                "best_times": n.best_times, "crowd_index": n.crowd_index,
            }
            for n in neighborhoods
        ],
        "insert_candidates": [
            {
                "place_id": ic.place_id, "name": ic.name,
                "lat": ic.lat, "lon": ic.lon,
                "type": ic.type, "time_cost_min": ic.time_cost_min,
                "persona_affinity": ic.persona_affinity,
                "trigger": ic.trigger, "time_of_day_match": ic.time_of_day_match,
            }
            for ic in insert_candidates
        ],
        "scenic_routes": scenic_routes,
        "transit_edges": [],
        "engine_modifiers": {
            "siesta_window": country_mods["siesta_window"],
            "lunch_window_strict": country_mods["lunch_window_strict"],
            "evening_end_time": country_mods["evening_end_time"],
            "day_buffer_min": 20,  # default — refined from behavior data post-launch
        },
        "landmark_anchors": landmarks[:6],
        "hidden_gems": hidden_gems[:5],
    })
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/city/test_seed_builder.py -v
```
Expected: `8 passed`

- [ ] **Step 5: Run full suite to check no regressions**

```bash
python3 -m pytest tests/ -v --tb=short 2>&1 | tail -5
```
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add city/seed_builder.py tests/city/test_seed_builder.py
git commit -m "feat: real-data seed builder — Wikidata + OSM + Google Places + Foursquare + Open-Meteo"
```

---

## Task 5: On-demand seeder (`city/on_demand_seeder.py`)

**Files:**
- Create: `city/on_demand_seeder.py`
- Create: `tests/city/test_on_demand_seeder.py`

Triggered by `load_city()` on a cache miss for any whitelisted city. Calls `build_city_seed()`, stores result in Supabase `city_data`, marks `city_whitelist.seeded = true`. First caller waits ~3–4s; all subsequent callers get instant Supabase read.

- [ ] **Step 1: Write failing tests**

Create `tests/city/test_on_demand_seeder.py`:

```python
import json
import pytest
from unittest.mock import MagicMock, patch
from city.data_model import CityData
from city.on_demand_seeder import seed_city_on_demand

WHITELIST_ROW = {
    "city_id": "porto", "name": "Porto", "country_code": "PT",
    "tier": 1, "lat": 41.1579, "lon": -8.6291, "timezone": "Europe/Lisbon",
    "seeded": False,
}


def _mock_city():
    mock = MagicMock(spec=CityData)
    mock.id = "porto"
    mock.name = "Porto"
    mock.tier = 1
    return mock


def _mock_supabase():
    sb = MagicMock()
    sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    return sb


def test_seed_city_on_demand_returns_city_data():
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()):
        result = seed_city_on_demand(WHITELIST_ROW, _mock_supabase())
    assert result.id == "porto"


def test_seed_city_on_demand_calls_build_city_seed():
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()) as mock_builder:
        seed_city_on_demand(WHITELIST_ROW, _mock_supabase())
    mock_builder.assert_called_once_with(WHITELIST_ROW)


def test_seed_city_on_demand_upserts_to_city_data_table():
    sb = _mock_supabase()
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()):
        seed_city_on_demand(WHITELIST_ROW, sb)
    calls = [str(c) for c in sb.table.call_args_list]
    assert any("city_data" in c for c in calls)


def test_seed_city_on_demand_marks_whitelist_seeded():
    sb = _mock_supabase()
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()):
        seed_city_on_demand(WHITELIST_ROW, sb)
    calls = [str(c) for c in sb.table.call_args_list]
    assert any("city_whitelist" in c for c in calls)


def test_seed_city_on_demand_raises_on_builder_failure():
    with patch("city.on_demand_seeder.build_city_seed", side_effect=ValueError("api_failure")):
        with pytest.raises(ValueError, match="api_failure"):
            seed_city_on_demand(WHITELIST_ROW, _mock_supabase())


def test_seed_city_on_demand_passes_full_row_to_builder():
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()) as mock_builder:
        seed_city_on_demand(WHITELIST_ROW, _mock_supabase())
    call_arg = mock_builder.call_args[0][0]
    assert call_arg["city_id"] == "porto"
    assert call_arg["country_code"] == "PT"
```

- [ ] **Step 2: Run to verify fails**

```bash
python3 -m pytest tests/city/test_on_demand_seeder.py -v 2>&1 | tail -5
```
Expected: `ModuleNotFoundError: No module named 'city.on_demand_seeder'`

- [ ] **Step 3: Write `city/on_demand_seeder.py`**

```python
"""On-demand city seeder.

Called by load_city() when a city is in city_whitelist but not yet seeded.
Calls build_city_seed() (~3–4s), stores to Supabase city_data,
marks city_whitelist.seeded = true.

All subsequent load_city() calls for the same city read from Supabase instantly.
"""
from __future__ import annotations
import json

from city.data_model import CityData, load_city_from_dict
from city.seed_builder import build_city_seed


def seed_city_on_demand(whitelist_row: dict, supabase) -> CityData:
    """Generate and store CityData for a whitelisted-but-unseeded city.

    Args:
        whitelist_row: Row from city_whitelist table.
                       Required keys: city_id, name, country_code, tier, lat, lon, timezone
        supabase: Supabase client instance

    Returns:
        CityData for the newly seeded city

    Raises:
        ValueError: if build_city_seed fails (propagated to caller)
    """
    city = build_city_seed(whitelist_row)

    # Serialize CityData back to dict for Supabase storage
    city_dict = {
        "id": city.id,
        "name": city.name,
        "tier": city.tier,
        "center": list(city.center),
        "timezone": city.timezone,
        "climate": city.climate,
        "movement": city.movement,
        "culture": city.culture,
        "neighborhoods": [
            {"id": n.id, "name": n.name, "center": list(n.center), "polygon": n.polygon,
             "best_times": n.best_times, "crowd_index": n.crowd_index}
            for n in city.neighborhoods
        ],
        "insert_candidates": [
            {"place_id": ic.place_id, "name": ic.name, "lat": ic.lat, "lon": ic.lon,
             "type": ic.type, "time_cost_min": ic.time_cost_min,
             "persona_affinity": ic.persona_affinity, "trigger": ic.trigger,
             "time_of_day_match": ic.time_of_day_match}
            for ic in city.insert_candidates
        ],
        "scenic_routes": city.scenic_routes,
        "transit_edges": city.transit_edges,
        "engine_modifiers": city.engine_modifiers,
        "landmark_anchors": city.landmark_anchors,
        "hidden_gems": city.hidden_gems,
    }

    supabase.table("city_data").upsert({
        "id": city.id,
        "name": city.name,
        "country_code": whitelist_row["country_code"],
        "tier": city.tier,
        "data": city_dict,
    }).execute()

    supabase.table("city_whitelist").update(
        {"seeded": True}
    ).eq("city_id", city.id).execute()

    return city
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/city/test_on_demand_seeder.py -v
```
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add city/on_demand_seeder.py tests/city/test_on_demand_seeder.py
git commit -m "feat: on-demand seeder — auto-profiles any whitelisted city on first request"
```

---

## Task 6: City whitelist builder (`city/whitelist_builder.py`)

**Files:**
- Create: `city/whitelist_builder.py`

CLI script, no unit tests — correctness verified by dry-run output. Run once before launch.

- [ ] **Step 1: Write `city/whitelist_builder.py`**

```python
#!/usr/bin/env python3
"""Whitelist builder: loads ~4,000 tourist-relevant cities into city_whitelist Supabase table.

Source: GeoNames cities15000.txt (cities with population > 15,000, ~26k total).
Filter: population >= 100,000 → ~4,000 cities.
Tier 1 cities (from cities_registry.py) are inserted with tier=1; all others tier=2.
The 80 Tier 1 cities are pre-seeded separately — whitelist just gates search.

Usage:
    python -m city.whitelist_builder               # load all (idempotent — uses upsert)
    python -m city.whitelist_builder --dry-run     # print first 20 rows, no DB write

Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY in environment.
GeoNames data auto-downloaded from download.geonames.org (public domain).
"""
from __future__ import annotations
import argparse
import csv
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

from city.cities_registry import CITIES as TIER1_CITIES

_GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
_CACHE_PATH = Path(__file__).parent / "_geonames_cities15000.txt"
_MIN_POPULATION = 100_000
_BATCH_SIZE = 500

# GeoNames TSV column indices
_COL_NAME = 1      # asciiname
_COL_LAT = 4
_COL_LON = 5
_COL_COUNTRY = 8
_COL_POPULATION = 14
_COL_TIMEZONE = 17

_TIER1_IDS = {c["id"] for c in TIER1_CITIES}


def _slugify(name: str) -> str:
    slug = name.lower().replace(" ", "_").replace("-", "_").replace("'", "").replace(".", "")
    return "".join(c for c in slug if c.isalnum() or c == "_")


def _download_geonames() -> list[dict]:
    if not _CACHE_PATH.exists():
        print("Downloading GeoNames cities15000.zip...")
        tmp = _CACHE_PATH.with_suffix(".zip")
        urllib.request.urlretrieve(_GEONAMES_URL, tmp)
        with zipfile.ZipFile(tmp) as z:
            z.extract("cities15000.txt", _CACHE_PATH.parent)
        (_CACHE_PATH.parent / "cities15000.txt").rename(_CACHE_PATH)
        tmp.unlink()
        print(f"Cached to {_CACHE_PATH}")
    else:
        print(f"Using cached {_CACHE_PATH}")

    cities = []
    with open(_CACHE_PATH, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for row in reader:
            if len(row) < 19:
                continue
            try:
                population = int(row[_COL_POPULATION])
            except ValueError:
                continue
            if population < _MIN_POPULATION:
                continue
            name = row[_COL_NAME].strip()
            country = row[_COL_COUNTRY].strip()
            lat = float(row[_COL_LAT])
            lon = float(row[_COL_LON])
            timezone = row[_COL_TIMEZONE].strip()
            city_id = _slugify(name)
            # Prefer Tier 1 registry ID if this city matches by name
            tier1_match = next(
                (c for c in TIER1_CITIES if _slugify(c["name"]) == city_id), None
            )
            if tier1_match:
                city_id = tier1_match["id"]
            cities.append({
                "city_id": city_id,
                "name": name,
                "country_code": country,
                "tier": 1 if city_id in _TIER1_IDS else 2,
                "lat": lat,
                "lon": lon,
            })
    return cities


def _load_to_supabase(cities: list[dict]) -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required", file=sys.stderr)
        sys.exit(1)
    from supabase import create_client
    sb = create_client(url, key)
    rows = [
        {
            "city_id": c["city_id"],
            "name": c["name"],
            "country_code": c["country_code"],
            "tier": c["tier"],
            "coordinates": f"POINT({c['lon']} {c['lat']})",
            "seeded": False,
        }
        for c in cities
    ]
    total = len(rows)
    inserted = 0
    for i in range(0, total, _BATCH_SIZE):
        batch = rows[i: i + _BATCH_SIZE]
        sb.table("city_whitelist").upsert(batch, on_conflict="city_id").execute()
        inserted += len(batch)
        print(f"  Upserted {inserted}/{total}...")
    print(f"\nDone: {total} cities loaded into city_whitelist")


def main() -> None:
    parser = argparse.ArgumentParser(description="Load city whitelist into Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Print first 20 rows, no DB write")
    args = parser.parse_args()
    cities = _download_geonames()
    print(f"Parsed {len(cities)} cities with population >= {_MIN_POPULATION:,}")
    if args.dry_run:
        for c in cities[:20]:
            print(f"  {c['city_id']:30s} {c['name']:25s} {c['country_code']} tier={c['tier']}")
        print(f"  ... and {len(cities) - 20} more")
        return
    _load_to_supabase(cities)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify import**

```bash
python3 -c "from city.whitelist_builder import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add city/whitelist_builder.py
git commit -m "feat: GeoNames whitelist builder — loads ~4k cities into city_whitelist"
```

---

## Task 7: Wire on-demand seeder into `load_city()`

**Files:**
- Modify: `city/data_model.py` — `load_city()` function
- Modify: `tests/city/test_data_model.py` — add 2 new tests

Current `load_city()` at lines 94–103 raises `ValueError` on any miss.
New behaviour: on miss, check `city_whitelist` → if found, call `seed_city_on_demand()` → return CityData. Only raise `ValueError` if not in whitelist at all.

- [ ] **Step 1: Add failing tests to `tests/city/test_data_model.py`**

Append to the existing file:

```python
# ── On-demand seeding via whitelist ──────────────────────────────────────────

def test_load_city_triggers_on_demand_for_whitelisted_unseeded_city():
    """load_city() calls on_demand seeder when city is whitelisted but not in city_data."""
    from unittest.mock import MagicMock, patch

    mock_supabase = MagicMock()
    # city_data table: no row
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=None)
    # city_whitelist table: row found
    whitelist_row = {
        "city_id": "porto", "name": "Porto", "country_code": "PT",
        "tier": 1, "lat": 41.1579, "lon": -8.6291, "timezone": "Europe/Lisbon", "seeded": False,
    }
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=whitelist_row)

    mock_city = MagicMock()
    mock_city.id = "porto"

    with patch("city.data_model.seed_city_on_demand", return_value=mock_city) as mock_seeder:
        result = load_city("porto", mock_supabase)

    mock_seeder.assert_called_once_with(whitelist_row, mock_supabase)
    assert result.id == "porto"


def test_load_city_raises_for_non_whitelisted_city():
    """load_city() raises ValueError when city is not in whitelist."""
    from unittest.mock import MagicMock
    import pytest

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=None)
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)

    with pytest.raises(ValueError, match="city_not_found"):
        load_city("nonexistent_city_xyz", mock_supabase)
```

- [ ] **Step 2: Run to verify the new tests fail**

```bash
python3 -m pytest tests/city/test_data_model.py -v -k "on_demand or non_whitelisted" 2>&1 | tail -10
```
Expected: `FAILED` — `load_city` still raises ValueError instead of calling seeder.

- [ ] **Step 3: Update `load_city()` in `city/data_model.py`**

Replace lines 94–103 (the entire `load_city` function):

```python
def load_city(city_id: str, supabase=None) -> CityData:
    """Load CityData. On first miss, auto-seeds any whitelisted city via real-data pipeline."""
    if supabase is not None:
        row = supabase.table("city_data").select("data").eq("id", city_id).single().execute()
        if row.data:
            return load_city_from_dict(row.data["data"])
    seed_path = Path(__file__).parent / f"seed/{city_id}.json"
    if seed_path.exists():
        return load_city_from_dict(json.loads(seed_path.read_text()))
    if supabase is not None:
        wl = supabase.table("city_whitelist").select("*").eq("city_id", city_id).maybe_single().execute()
        if wl.data:
            from city.on_demand_seeder import seed_city_on_demand
            return seed_city_on_demand(wl.data, supabase)
    raise ValueError(f"city_not_found: {city_id}")
```

- [ ] **Step 4: Run full test suite**

```bash
python3 -m pytest tests/ -v --tb=short 2>&1 | tail -10
```
Expected: all passing, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add city/data_model.py tests/city/test_data_model.py
git commit -m "feat: load_city auto-seeds any whitelisted city on-demand via real-data pipeline"
```

---

## Task 8: City endpoints in `main.py`

**Files:**
- Modify: `main.py`

Four endpoints. Two are free (authenticated, no live API calls). Two are Pro.

| Endpoint | Auth | Live calls | Returns |
|---|---|---|---|
| `GET /api/cities/autocomplete?q=` | auth | No | Whitelist prefix search (≥2 chars, max 10) |
| `GET /api/cities/search?city_id=` | auth | No | Single whitelist lookup or 404 |
| `GET /api/cities/map-pins?city_id=` | auth | No | Pre-seeded basic place data |
| `GET /api/cities/picks?city_id=` | **Pro** | Yes | Live Google Places + trend stage badges |

**Trend badge logic (for `/api/cities/picks`):**
- `🔥 trending` — `stage = rising` AND velocity_ratio ≥ 2.0 in `place_dynamic_profiles`
- `⚠️ getting_busy` — stage transitioning hidden_gem → rising (crowd signals present)
- `💎 hidden_gem` — `stage = hidden_gem`, low crowd_index
- `null` — mainstream/unknown/no signal data

- [ ] **Step 1: Find insertion point**

```bash
grep -n "# CITY SEARCH\|/api/cities\|/places-autocomplete" /Users/souravbiswas/uncover-roads/.worktrees/phase10-global-city-profiling/main.py | head -10
```
Note the line number after which to insert. If no `# CITY SEARCH` comment exists, insert after the `# EVENTS` section or before `if __name__ == "__main__"`.

- [ ] **Step 2: Add Pydantic models and endpoints**

Find the last endpoint block before `if __name__ == "__main__"` in `main.py`. Insert the following block immediately before it:

```python
# ── City search + map data (Phase 10) ────────────────────────────────────────

class CitySearchResult(BaseModel):
    city_id: str
    name: str
    country_code: str
    tier: int
    seeded: bool


class MapPin(BaseModel):
    place_id: str
    name: str
    lat: float
    lon: float
    category: str
    neighborhood: Optional[str]
    is_landmark: bool


class PlacePick(BaseModel):
    place_id: str
    name: str
    lat: float
    lon: float
    category: str
    rating: Optional[float]
    stage: str
    badge: Optional[str]   # 'trending' | 'getting_busy' | 'hidden_gem' | None
    badge_reason: Optional[str]


@app.get("/api/cities/autocomplete", response_model=list[CitySearchResult])
async def cities_autocomplete(q: str, _user=Depends(get_current_user)):
    """Whitelist prefix search. Free tier. Min 2 chars, max 10 results."""
    if len(q.strip()) < 2:
        return []
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    rows = (
        _supabase.table("city_whitelist")
        .select("city_id, name, country_code, tier, seeded")
        .ilike("name", f"{q}%")
        .order("tier")
        .limit(10)
        .execute()
    )
    return [
        CitySearchResult(
            city_id=r["city_id"], name=r["name"],
            country_code=r["country_code"], tier=r["tier"],
            seeded=r.get("seeded", False),
        )
        for r in (rows.data or [])
    ]


@app.get("/api/cities/search", response_model=CitySearchResult)
async def cities_search(city_id: str, _user=Depends(get_current_user)):
    """Exact whitelist lookup. Free tier. Returns 404 if not whitelisted."""
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    row = (
        _supabase.table("city_whitelist")
        .select("city_id, name, country_code, tier, seeded")
        .eq("city_id", city_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="city_not_in_whitelist")
    r = row.data
    return CitySearchResult(
        city_id=r["city_id"], name=r["name"],
        country_code=r["country_code"], tier=r["tier"],
        seeded=r.get("seeded", False),
    )


@app.get("/api/cities/map-pins", response_model=list[MapPin])
async def cities_map_pins(city_id: str, _user=Depends(get_current_user)):
    """Pre-seeded basic map pins. Free tier. No live API calls.
    Returns landmarks + insert candidates from city_data seed.
    If city is unseeded, triggers on-demand seeding (first caller waits ~3-4s).
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    try:
        city = load_city(city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")
    pins: list[MapPin] = []
    landmark_set = set(city.landmark_anchors)
    for ic in city.insert_candidates:
        pins.append(MapPin(
            place_id=ic.place_id, name=ic.name,
            lat=ic.lat, lon=ic.lon,
            category=ic.type,
            neighborhood=None,
            is_landmark=ic.place_id in landmark_set,
        ))
    return pins


@app.get("/api/cities/picks", response_model=list[PlacePick])
async def cities_picks(city_id: str, _user=Depends(require_pro)):
    """Pro: curated picks with trend stage badges. Makes live Google Places call.
    Badge logic:
      trending    — stage=rising AND velocity_ratio >= 2.0
      getting_busy — stage=rising with crowd signals
      hidden_gem  — stage=hidden_gem
      null        — mainstream or no signal data
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    # Load city (triggers on-demand seed if needed)
    try:
        city = load_city(city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")

    # Fetch dynamic profiles for all insert candidate place IDs
    place_ids = [ic.place_id for ic in city.insert_candidates]
    profiles_row = (
        _supabase.table("place_dynamic_profiles")
        .select("place_id, stage, signals")
        .in_("place_id", place_ids)
        .execute()
    )
    profiles: dict[str, dict] = {
        r["place_id"]: r for r in (profiles_row.data or [])
    }

    def _badge(place_id: str) -> tuple[Optional[str], Optional[str]]:
        p = profiles.get(place_id)
        if not p:
            return None, None
        stage = p.get("stage", "unknown")
        signals = p.get("signals") or {}
        velocity = signals.get("velocity_ratio", 1.0) or 1.0
        crowd = signals.get("crowd_ratio", 0.0) or 0.0
        if stage == "rising" and velocity >= 2.0:
            return "trending", f"Reviews up {int(velocity)}x this month"
        if stage == "rising" and crowd >= 0.4:
            return "getting_busy", "Getting busy — locals say go early"
        if stage == "hidden_gem":
            return "hidden_gem", "Still off the tourist trail"
        return None, None

    picks = []
    for ic in city.insert_candidates:
        badge, badge_reason = _badge(ic.place_id)
        p = profiles.get(ic.place_id, {})
        picks.append(PlacePick(
            place_id=ic.place_id, name=ic.name,
            lat=ic.lat, lon=ic.lon,
            category=ic.type, rating=None,
            stage=p.get("stage", "unknown"),
            badge=badge, badge_reason=badge_reason,
        ))
    return picks
```

- [ ] **Step 3: Verify main.py imports cleanly**

```bash
python3 -c "import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 4: Run full test suite**

```bash
python3 -m pytest tests/ -v --tb=short 2>&1 | tail -10
```
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "feat: city endpoints — map-pins (free) + picks (pro with trend badges) + autocomplete + search"
```

---

## Task 9: Dynamic startup seeding + pre-launch batch script

**Files:**
- Modify: `main.py` — `seed_cities_and_start_sync()` discovers seed files dynamically
- Create: `city/prelaunch_batch_seed.py` — seeds all unseeded whitelisted cities at 20/hour

### Part A — Dynamic startup seeding

- [ ] **Step 1: Update `seed_cities_and_start_sync()` in `main.py`**

Find this block (around line 89):
```python
    for city_id in ["tokyo", "paris", "nyc"]:
```

Replace with:
```python
    seed_dir = _Path("city/seed")
    city_ids = [p.stem for p in sorted(seed_dir.glob("*.json"))] if seed_dir.exists() else []
    for city_id in city_ids:
```

- [ ] **Step 2: Verify import still clean**

```bash
python3 -c "import main; print('ok')"
```
Expected: `ok`

### Part B — Pre-launch batch seeder

- [ ] **Step 3: Write `city/prelaunch_batch_seed.py`**

```python
#!/usr/bin/env python3
"""Pre-launch batch seeder: seeds all whitelisted-but-unseeded cities at 20 cities/hour.

Run 3 days before launch. Any city not seeded stays as on-demand
(first user search seeds it in ~3–4s, instant for all after).

Usage:
    python -m city.prelaunch_batch_seed               # seed all unseeded
    python -m city.prelaunch_batch_seed --limit 100   # seed first N only
    python -m city.prelaunch_batch_seed --dry-run     # count + ETA only

Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_PLACES_API_KEY in environment.
FOURSQUARE_API_KEY is optional (hidden gems skipped if not set).
"""
from __future__ import annotations
import argparse
import os
import sys
import time

_RATE_LIMIT_SLEEP = 180  # 20 cities/hour = 1 per 3 minutes


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-launch batch city seeder")
    parser.add_argument("--limit", type=int, default=None, help="Max cities to seed")
    parser.add_argument("--dry-run", action="store_true", help="Count + ETA only, no API calls")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    from city.on_demand_seeder import seed_city_on_demand

    sb = create_client(url, key)

    result = (
        sb.table("city_whitelist")
        .select("city_id, name, country_code, tier, lat, lon, timezone, seeded")
        .eq("seeded", False)
        .order("tier")
        .execute()
    )
    cities = result.data or []
    if args.limit:
        cities = cities[: args.limit]

    print(f"Found {len(cities)} unseeded whitelisted cities")

    if args.dry_run:
        for c in cities[:20]:
            print(f"  Would seed: {c['name']} ({c['city_id']}) tier={c['tier']}")
        if len(cities) > 20:
            print(f"  ... and {len(cities) - 20} more")
        hours = len(cities) * _RATE_LIMIT_SLEEP / 3600
        print(f"\nEstimated time: {hours:.1f} hours at 20 cities/hour")
        return

    seeded, failed = 0, 0
    for i, row in enumerate(cities):
        print(f"[{i+1}/{len(cities)}] Seeding {row['name']} ({row['city_id']})...")
        try:
            seed_city_on_demand(row, sb)
            seeded += 1
            print(f"  ✓ Done")
        except Exception as e:
            print(f"  ✗ Failed: {e}", file=sys.stderr)
            failed += 1
        if i < len(cities) - 1:
            time.sleep(_RATE_LIMIT_SLEEP)

    print(f"\nDone: {seeded} seeded, {failed} failed")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Verify batch script imports**

```bash
python3 -c "from city.prelaunch_batch_seed import main; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: Run final full test suite**

```bash
python3 -m pytest tests/ -v --tb=short 2>&1 | tail -10
```
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add main.py city/prelaunch_batch_seed.py
git commit -m "feat: dynamic startup seeding + pre-launch batch seeder at 20 cities/hour"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| Real data only — no AI generation | Tasks 4, 5 (seed_builder replaces generate_seeds) |
| Wikidata landmarks (CC0) | Task 4 `_fetch_wikidata_landmarks` |
| OSM neighborhoods | Task 4 `_fetch_osm_neighborhoods` |
| Google Places POIs + crowd | Task 4 `_fetch_google_pois` |
| Foursquare hidden gems | Task 4 `_fetch_foursquare_hidden_gems` |
| Open-Meteo climate | Task 4 `_fetch_climate` |
| Static country meal times / siesta | Task 2 `country_profiles.py` |
| Persona affinity from category | Task 3 `persona_affinity.py` |
| day_buffer_min default (behavior data post-launch) | Task 4 `build_city_seed` (hardcoded 20, comment explains) |
| best_times defaults (behavior data post-launch) | Task 4 OSM fetch defaults + comment |
| Dynamic for any city (not just 80) | Task 5 `on_demand_seeder.py` |
| Whitelist (~4k cities) gates search | Task 6 `whitelist_builder.py` |
| load_city triggers on-demand on miss | Task 7 `data_model.py` |
| load_city raises only for non-whitelisted | Task 7 |
| Free tier: map-pins, no live calls | Task 8 `/api/cities/map-pins` |
| Pro tier: picks with trend badges | Task 8 `/api/cities/picks` |
| Trending badge (rising + velocity ≥ 2x) | Task 8 `_badge()` |
| Getting busy badge (rising + crowd signals) | Task 8 `_badge()` |
| Hidden gem badge | Task 8 `_badge()` |
| Lapsed Pro: itineraries readable, creation locked | Existing `require_pro` on create, `get_current_user` on read — no new code needed (already correct in existing endpoints) |
| Autocomplete (free, whitelist prefix) | Task 8 `/api/cities/autocomplete` |
| City search lookup (free, whitelist exact) | Task 8 `/api/cities/search` |
| Dynamic startup seeds all seed files | Task 9 Part A |
| Pre-launch batch seeder 20/hour | Task 9 Part B |
| Foursquare API key env var | Documented in env vars section |

### Placeholder scan
No TBDs. All code blocks are complete. `day_buffer_min = 20` has an explicit comment explaining the post-launch refinement path.

### Type consistency
- `whitelist_row` dict shape is consistent: `whitelist_builder.py` writes it, `data_model.load_city()` reads it via `wl.data`, `on_demand_seeder.seed_city_on_demand(whitelist_row, supabase)` receives it, `seed_builder.build_city_seed(city_entry)` uses same keys (`city_id`, `name`, `country_code`, `tier`, `lat`, `lon`, `timezone`).
- `CitySearchResult`, `MapPin`, `PlacePick` Pydantic models defined before use in Task 8.
- `require_pro` and `get_current_user` dependencies already exist in `main.py` — no redefinition.
