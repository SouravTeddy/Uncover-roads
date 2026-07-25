# Trend Velocity Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder math-based `velocity_ratio` in `place_dynamic_profiles` with real social trend signals fetched from YouTube, Wikimedia, Foursquare, and Reddit (stubbed until approved), making the "Trending Now" badge honest.

**Architecture:** A new `city/trend_fetcher.py` provides one fetcher function per source, each returning a normalized 0–1 float and failing silently. A new `city/trend_seeder.py` orchestrates all fetchers for every place in a city, normalises scores within the city set, computes a weighted composite, maps it to a `velocity_ratio` (1.0–5.0), and upserts to `place_dynamic_profiles`. A new `/api/places/seed-trends` POST endpoint in `main.py` exposes this and fires it as a background task after city on-demand seeding.

**Tech Stack:** Python 3.14, FastAPI BackgroundTasks, `requests`, YouTube Data API v3, Wikimedia REST API (no auth), Foursquare Places API v3, Reddit OAuth2 (stubbed).

## Global Constraints

- Every fetcher MUST return `0.0` on any error — no exceptions propagate out of fetchers
- Reddit fetcher returns `0.0` when `REDDIT_CLIENT_ID` or `REDDIT_CLIENT_SECRET` env vars are absent (pending API approval)
- Composite weights: YouTube 0.35, Wikimedia 0.30, Foursquare 0.20, Reddit 0.15
- `velocity_ratio` output range: `clamp(0.3, 5.0, 1.0 + composite * 4.0)`
- New env vars: `YOUTUBE_API_KEY`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` (all optional — pipeline degrades gracefully without them)
- Do NOT modify `signal_processor.py` or `on_demand_seeder.py`
- Existing `stage` field in `place_dynamic_profiles` is preserved — only `signals.velocity_ratio` is overwritten
- All tests use `unittest.mock.patch` — no real HTTP calls in tests
- Run tests with: `pytest tests/city/test_trend_fetcher.py tests/city/test_trend_seeder.py -v`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `city/trend_fetcher.py` | Create | One function per source; each returns float 0–1 |
| `city/trend_seeder.py` | Create | Orchestrates fetchers, normalises, upserts |
| `tests/city/test_trend_fetcher.py` | Create | Unit tests for all fetchers |
| `tests/city/test_trend_seeder.py` | Create | Unit tests for orchestrator |
| `main.py` | Modify | Add env vars + `/api/places/seed-trends` endpoint + background hook |
| `requirements.txt` | No change | pytrends deferred — no new deps needed |

---

## Task 1: Source Fetchers (`city/trend_fetcher.py`)

**Files:**
- Create: `city/trend_fetcher.py`
- Create: `tests/city/test_trend_fetcher.py`

**Interfaces:**
- Produces:
  - `fetch_youtube_score(place_name: str, city_name: str, api_key: str) -> float`
  - `fetch_wikimedia_score(place_name: str) -> float`
  - `fetch_foursquare_score(place_name: str, lat: float, lon: float, api_key: str) -> float`
  - `fetch_reddit_score(place_name: str, city_name: str, client_id: str, client_secret: str) -> float`

- [ ] **Step 1: Write failing tests**

Create `tests/city/test_trend_fetcher.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from unittest.mock import patch, MagicMock
from city.trend_fetcher import (
    fetch_youtube_score,
    fetch_wikimedia_score,
    fetch_foursquare_score,
    fetch_reddit_score,
)


# ── YouTube ──────────────────────────────────────────────────────────────────

def test_youtube_returns_zero_without_key():
    assert fetch_youtube_score("Eiffel Tower", "Paris", "") == 0.0


def test_youtube_returns_zero_on_http_error():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_get.return_value.raise_for_status.side_effect = Exception("HTTP 403")
        assert fetch_youtube_score("Eiffel Tower", "Paris", "fake_key") == 0.0


def test_youtube_normalises_video_count():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"items": [{}] * 20}  # 20 videos
        mock_get.return_value = mock_resp
        score = fetch_youtube_score("Eiffel Tower", "Paris", "fake_key")
        assert score == 1.0  # 20/20 = 1.0 (clamped)


def test_youtube_partial_count():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"items": [{}] * 10}  # 10 videos
        mock_get.return_value = mock_resp
        score = fetch_youtube_score("Some Café", "Paris", "fake_key")
        assert score == 0.5  # 10/20 = 0.5


# ── Wikimedia ────────────────────────────────────────────────────────────────

def test_wikimedia_returns_zero_on_no_results():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"query": {"search": []}}
        mock_get.return_value = mock_resp
        assert fetch_wikimedia_score("Unknown Place XYZ") == 0.0


def test_wikimedia_returns_zero_on_http_error():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_get.side_effect = Exception("timeout")
        assert fetch_wikimedia_score("Eiffel Tower") == 0.0


def test_wikimedia_normalises_pageviews():
    responses = [
        MagicMock(
            raise_for_status=MagicMock(return_value=None),
            json=MagicMock(return_value={"query": {"search": [{"title": "Eiffel Tower"}]}}),
        ),
        MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "items": [{"views": 5000}] * 90  # 5000 views/day avg
            }),
        ),
    ]
    with patch("city.trend_fetcher.requests.get", side_effect=responses):
        score = fetch_wikimedia_score("Eiffel Tower")
        assert score == 1.0  # 5000/5000 = 1.0 (clamped)


# ── Foursquare ───────────────────────────────────────────────────────────────

def test_foursquare_returns_zero_without_key():
    assert fetch_foursquare_score("Café de Flore", 48.854, 2.332, "") == 0.0


def test_foursquare_returns_zero_on_no_results():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"results": []}
        mock_get.return_value = mock_resp
        assert fetch_foursquare_score("Ghost Place", 48.854, 2.332, "fake_key") == 0.0


def test_foursquare_returns_popularity():
    with patch("city.trend_fetcher.requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"results": [{"popularity": 0.82}]}
        mock_get.return_value = mock_resp
        score = fetch_foursquare_score("Café de Flore", 48.854, 2.332, "fake_key")
        assert score == 0.82


# ── Reddit ───────────────────────────────────────────────────────────────────

def test_reddit_returns_zero_without_credentials():
    assert fetch_reddit_score("Eiffel Tower", "Paris", "", "") == 0.0
    assert fetch_reddit_score("Eiffel Tower", "Paris", "id", "") == 0.0
    assert fetch_reddit_score("Eiffel Tower", "Paris", "", "secret") == 0.0


def test_reddit_returns_zero_on_auth_error():
    with patch("city.trend_fetcher.requests.post") as mock_post:
        mock_post.return_value.raise_for_status.side_effect = Exception("401")
        score = fetch_reddit_score("Eiffel Tower", "Paris", "id", "secret")
        assert score == 0.0


def test_reddit_normalises_post_count():
    with patch("city.trend_fetcher.requests.post") as mock_post, \
         patch("city.trend_fetcher.requests.get") as mock_get:
        mock_post.return_value.raise_for_status.return_value = None
        mock_post.return_value.json.return_value = {"access_token": "tok123"}
        mock_get.return_value.raise_for_status.return_value = None
        mock_get.return_value.json.return_value = {
            "data": {"children": [{}] * 30}  # 30 posts
        }
        score = fetch_reddit_score("Eiffel Tower", "Paris", "id", "secret")
        assert score == 1.0  # 30/30 = 1.0 (clamped)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/Uncover-roads
pytest tests/city/test_trend_fetcher.py -v
```

Expected: `ModuleNotFoundError: No module named 'city.trend_fetcher'`

- [ ] **Step 3: Create `city/trend_fetcher.py`**

```python
"""Trend signal fetchers — one per source, each returns float 0.0–1.0.

All functions catch every exception and return 0.0. Missing credentials
also return 0.0 so the pipeline degrades gracefully.
"""
from __future__ import annotations

import requests
import requests.auth
from datetime import datetime, timedelta


def fetch_youtube_score(place_name: str, city_name: str, api_key: str) -> float:
    """Count YouTube videos mentioning place+city in last 90 days. Max 20 videos → 1.0."""
    if not api_key:
        return 0.0
    published_after = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        resp = requests.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": f"{place_name} {city_name}",
                "type": "video",
                "publishedAfter": published_after,
                "maxResults": 50,
                "key": api_key,
            },
            timeout=10,
        )
        resp.raise_for_status()
        video_count = len(resp.json().get("items", []))
        return min(1.0, video_count / 20.0)
    except Exception:
        return 0.0


def fetch_wikimedia_score(place_name: str) -> float:
    """Average daily Wikipedia page views over last 90 days. 5000 views/day → 1.0."""
    try:
        search_resp = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": place_name,
                "format": "json",
                "srlimit": 1,
            },
            timeout=10,
        )
        search_resp.raise_for_status()
        results = search_resp.json().get("query", {}).get("search", [])
        if not results:
            return 0.0
        title = results[0]["title"].replace(" ", "_")
    except Exception:
        return 0.0

    try:
        end = datetime.utcnow()
        start = end - timedelta(days=90)
        pv_resp = requests.get(
            f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
            f"/en.wikipedia/all-access/all-agents/{title}/daily"
            f"/{start.strftime('%Y%m%d')}/{end.strftime('%Y%m%d')}",
            timeout=10,
        )
        if pv_resp.status_code != 200:
            return 0.0
        items = pv_resp.json().get("items", [])
        if not items:
            return 0.0
        avg_views = sum(i["views"] for i in items) / len(items)
        return min(1.0, avg_views / 5000.0)
    except Exception:
        return 0.0


def fetch_foursquare_score(place_name: str, lat: float, lon: float, api_key: str) -> float:
    """Foursquare popularity score (0.0–1.0) for nearest matching place."""
    if not api_key:
        return 0.0
    try:
        resp = requests.get(
            "https://api.foursquare.com/v3/places/nearby",
            headers={"Authorization": api_key},
            params={
                "ll": f"{lat},{lon}",
                "query": place_name,
                "limit": 1,
                "fields": "fsq_id,popularity",
            },
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return 0.0
        return float(results[0].get("popularity", 0.0))
    except Exception:
        return 0.0


def fetch_reddit_score(
    place_name: str, city_name: str, client_id: str, client_secret: str
) -> float:
    """Reddit post mention count in last month. 30 posts → 1.0. Returns 0.0 if no credentials."""
    if not client_id or not client_secret:
        return 0.0
    try:
        auth = requests.auth.HTTPBasicAuth(client_id, client_secret)
        token_resp = requests.post(
            "https://www.reddit.com/api/v1/access_token",
            auth=auth,
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": "uncover-roads-trends/1.0"},
            timeout=10,
        )
        token_resp.raise_for_status()
        token = token_resp.json()["access_token"]
    except Exception:
        return 0.0

    try:
        search_resp = requests.get(
            "https://oauth.reddit.com/search",
            headers={
                "Authorization": f"bearer {token}",
                "User-Agent": "uncover-roads-trends/1.0",
            },
            params={
                "q": f"{place_name} {city_name}",
                "sort": "new",
                "t": "month",
                "limit": 100,
                "restrict_sr": "false",
            },
            timeout=10,
        )
        search_resp.raise_for_status()
        posts = search_resp.json().get("data", {}).get("children", [])
        return min(1.0, len(posts) / 30.0)
    except Exception:
        return 0.0
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/city/test_trend_fetcher.py -v
```

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add city/trend_fetcher.py tests/city/test_trend_fetcher.py
git commit -m "feat(trends): add per-source trend fetchers (YouTube, Wikimedia, Foursquare, Reddit)"
```

---

## Task 2: Trend Orchestrator (`city/trend_seeder.py`)

**Files:**
- Create: `city/trend_seeder.py`
- Create: `tests/city/test_trend_seeder.py`

**Interfaces:**
- Consumes (from Task 1):
  - `fetch_youtube_score(place_name, city_name, api_key) -> float`
  - `fetch_wikimedia_score(place_name) -> float`
  - `fetch_foursquare_score(place_name, lat, lon, api_key) -> float`
  - `fetch_reddit_score(place_name, city_name, client_id, client_secret) -> float`
- Produces:
  - `seed_trend_scores(city_id, places, city_name, country_code, supabase, youtube_key, foursquare_key, reddit_client_id, reddit_client_secret) -> dict`
    - Returns `{"updated": int, "skipped": int}`
  - `_normalize(scores: list[float]) -> list[float]` (exported for testing)
  - `_composite(youtube, wikimedia, foursquare, reddit) -> float` (exported for testing)

- [ ] **Step 1: Write failing tests**

Create `tests/city/test_trend_seeder.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from unittest.mock import patch, MagicMock, call
from city.trend_seeder import seed_trend_scores, _normalize, _composite


# ── Normalization ─────────────────────────────────────────────────────────────

def test_normalize_uniform_scores_returns_half():
    result = _normalize([1.0, 1.0, 1.0])
    assert result == [0.5, 0.5, 0.5]


def test_normalize_spreads_min_max():
    result = _normalize([0.0, 0.5, 1.0])
    assert result == [0.0, 0.5, 1.0]


def test_normalize_single_element():
    result = _normalize([0.8])
    assert result == [0.5]


# ── Composite ────────────────────────────────────────────────────────────────

def test_composite_weights_sum_to_one():
    # 0.35 + 0.30 + 0.20 + 0.15 = 1.0
    score = _composite(1.0, 1.0, 1.0, 1.0)
    assert abs(score - 1.0) < 0.001


def test_composite_zero_reddit_still_works():
    score = _composite(1.0, 1.0, 1.0, 0.0)
    # 0.35 + 0.30 + 0.20 = 0.85
    assert abs(score - 0.85) < 0.001


def test_composite_all_zero():
    assert _composite(0.0, 0.0, 0.0, 0.0) == 0.0


# ── seed_trend_scores ────────────────────────────────────────────────────────

def _make_supabase():
    sb = MagicMock()
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = []
    sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    return sb


def test_seed_skips_places_without_place_id():
    sb = _make_supabase()
    places = [{"place_id": None, "name": "Ghost Place", "lat": 48.85, "lon": 2.35}]
    with patch("city.trend_seeder.fetch_youtube_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=0.0):
        result = seed_trend_scores("paris", places, "Paris", "FR", sb)
    assert result["skipped"] == 1
    assert result["updated"] == 0


def test_seed_upserts_velocity_ratio():
    sb = _make_supabase()
    # Existing profile with stage=rising
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = [
        {"place_id": "place_abc", "stage": "rising", "signals": {"velocity_ratio": 1.2, "crowd_ratio": 0.3}}
    ]
    places = [{"place_id": "place_abc", "name": "Eiffel Tower", "lat": 48.858, "lon": 2.294}]

    with patch("city.trend_seeder.fetch_youtube_score", return_value=1.0), \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=1.0), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=1.0), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=0.0):
        result = seed_trend_scores("paris", places, "Paris", "FR", sb, youtube_key="yt_key")

    assert result["updated"] == 1
    upsert_call = sb.table.return_value.upsert.call_args
    rows = upsert_call[0][0]
    assert len(rows) == 1
    row = rows[0]
    assert row["place_id"] == "place_abc"
    assert row["stage"] == "rising"  # stage preserved
    assert row["signals"]["crowd_ratio"] == 0.3  # crowd_ratio preserved
    assert row["signals"]["velocity_ratio"] > 1.0  # trend-derived velocity


def test_seed_velocity_ratio_clamped():
    sb = _make_supabase()
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = []
    places = [{"place_id": "p1", "name": "Place A", "lat": 48.85, "lon": 2.35}]

    with patch("city.trend_seeder.fetch_youtube_score", return_value=1.0), \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=1.0), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=1.0), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=1.0):
        seed_trend_scores("paris", places, "Paris", "FR", sb)

    rows = sb.table.return_value.upsert.call_args[0][0]
    vr = rows[0]["signals"]["velocity_ratio"]
    assert 0.3 <= vr <= 5.0


def test_seed_returns_updated_count():
    sb = _make_supabase()
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = []
    places = [
        {"place_id": "p1", "name": "Place A", "lat": 48.85, "lon": 2.35},
        {"place_id": "p2", "name": "Place B", "lat": 48.86, "lon": 2.36},
        {"place_id": None, "name": "Place C", "lat": 48.87, "lon": 2.37},
    ]
    with patch("city.trend_seeder.fetch_youtube_score", return_value=0.3), \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=0.4), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=0.0):
        result = seed_trend_scores("paris", places, "Paris", "FR", sb)

    assert result["updated"] == 2
    assert result["skipped"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/city/test_trend_seeder.py -v
```

Expected: `ModuleNotFoundError: No module named 'city.trend_seeder'`

- [ ] **Step 3: Create `city/trend_seeder.py`**

```python
"""Trend score orchestrator.

Fetches signals from all sources for every place in a city,
normalises within the city set, computes weighted composite,
maps to velocity_ratio, and upserts to place_dynamic_profiles.
"""
from __future__ import annotations

from datetime import datetime

from city.trend_fetcher import (
    fetch_youtube_score,
    fetch_foursquare_score,
    fetch_reddit_score,
    fetch_wikimedia_score,
)

# Weights must sum to 1.0
_W_YOUTUBE     = 0.35
_W_WIKIMEDIA   = 0.30
_W_FOURSQUARE  = 0.20
_W_REDDIT      = 0.15


def _normalize(scores: list[float]) -> list[float]:
    """Min-max normalise a list of floats to [0, 1]. Uniform input → 0.5."""
    if len(scores) == 1:
        return [0.5]
    mn, mx = min(scores), max(scores)
    if mx == mn:
        return [0.5] * len(scores)
    return [(s - mn) / (mx - mn) for s in scores]


def _composite(youtube: float, wikimedia: float, foursquare: float, reddit: float) -> float:
    return (
        youtube    * _W_YOUTUBE +
        wikimedia  * _W_WIKIMEDIA +
        foursquare * _W_FOURSQUARE +
        reddit     * _W_REDDIT
    )


def seed_trend_scores(
    city_id: str,
    places: list[dict],
    city_name: str,
    country_code: str,
    supabase,
    youtube_key: str = "",
    foursquare_key: str = "",
    reddit_client_id: str = "",
    reddit_client_secret: str = "",
) -> dict:
    """Fetch trend signals for all places, normalise, upsert velocity_ratio.

    Args:
        city_id: City identifier (e.g. "paris")
        places: List of dicts with keys: place_id, name, lat, lon
        city_name: Human-readable city name for search queries
        country_code: ISO 3166-1 alpha-2 (e.g. "FR") for Pytrends geo filter
        supabase: Supabase client
        youtube_key: YOUTUBE_API_KEY env var value
        foursquare_key: FOURSQUARE_API_KEY env var value
        reddit_client_id: REDDIT_CLIENT_ID env var value
        reddit_client_secret: REDDIT_CLIENT_SECRET env var value

    Returns:
        {"updated": int, "skipped": int}
    """
    valid = [p for p in places if p.get("place_id")]
    skipped = len(places) - len(valid)

    if not valid:
        return {"updated": 0, "skipped": skipped}

    # Fetch existing profiles to preserve stage + crowd_ratio
    place_ids = [p["place_id"] for p in valid]
    profiles_resp = (
        supabase.table("place_dynamic_profiles")
        .select("place_id, stage, signals")
        .in_("place_id", place_ids)
        .execute()
    )
    existing: dict[str, dict] = {
        r["place_id"]: r for r in (profiles_resp.data or [])
    }

    # Fetch raw scores per source for each place
    raw_yt  = [fetch_youtube_score(p["name"], city_name, youtube_key)     for p in valid]
    raw_wiki = [fetch_wikimedia_score(p["name"])                           for p in valid]
    raw_fsq  = [fetch_foursquare_score(p["name"], p["lat"], p["lon"], foursquare_key) for p in valid]
    raw_red  = [fetch_reddit_score(p["name"], city_name, reddit_client_id, reddit_client_secret) for p in valid]

    # Normalise each source within the city set
    norm_yt   = _normalize(raw_yt)
    norm_wiki = _normalize(raw_wiki)
    norm_fsq  = _normalize(raw_fsq)
    norm_red  = _normalize(raw_red)

    rows = []
    for i, place in enumerate(valid):
        composite = _composite(norm_yt[i], norm_wiki[i], norm_fsq[i], norm_red[i])
        velocity_ratio = round(max(0.3, min(5.0, 1.0 + composite * 4.0)), 3)

        prev = existing.get(place["place_id"], {})
        prev_signals = prev.get("signals") or {}

        rows.append({
            "place_id":   place["place_id"],
            "city_id":    city_id,
            "stage":      prev.get("stage", "mainstream"),
            "signals": {
                **prev_signals,
                "velocity_ratio": velocity_ratio,
            },
            "updated_at": datetime.utcnow().isoformat(),
        })

    supabase.table("place_dynamic_profiles").upsert(rows, on_conflict="place_id").execute()
    return {"updated": len(rows), "skipped": skipped}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/city/test_trend_seeder.py -v
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add city/trend_seeder.py tests/city/test_trend_seeder.py
git commit -m "feat(trends): add trend score orchestrator with city-level normalisation"
```

---

## Task 3: API Endpoint + env vars + background hook (`main.py`)

**Files:**
- Modify: `main.py` (lines ~87–104 for env vars; line ~5047 for seed_place_profiles fix; add new endpoint after line ~5091)

**Interfaces:**
- Consumes (from Task 2): `seed_trend_scores(city_id, places, city_name, country_code, supabase, youtube_key, foursquare_key, reddit_client_id, reddit_client_secret) -> dict`
- Produces: `POST /api/places/seed-trends?city_id=paris` → `{"updated": int, "skipped": int}`

Note: `BackgroundTasks` is already imported on line 1 of `main.py` — no import change needed.

- [ ] **Step 1: Add new env vars to main.py**

Find the env var block (around line 87–100). After the existing `YELP_API_KEY` line, add:

```python
YOUTUBE_API_KEY        = os.environ.get("YOUTUBE_API_KEY", "")
REDDIT_CLIENT_ID       = os.environ.get("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET   = os.environ.get("REDDIT_CLIENT_SECRET", "")
FOURSQUARE_API_KEY     = os.environ.get("FOURSQUARE_API_KEY", "")
```

Note: `FOURSQUARE_API_KEY` is already read in `city/seed_builder.py` via `os.environ.get`. Adding it here makes it available module-level for the trend endpoint.

- [ ] **Step 2: Fix `seed_place_profiles` to preserve trend-derived velocity_ratio**

The existing `seed_place_profiles` endpoint (around line 5047) completely replaces `signals` with a fresh dict from `_stage_and_signals()`. Calling it after `seed_trend_scores` would wipe the real velocity. Fix: fetch existing signals first and preserve `velocity_ratio` if trend data already exists.

Find this block inside `seed_place_profiles` (around line 5062):

```python
    place_ids = [ic.place_id for ic in city.insert_candidates if ic.place_id]
    if not place_ids:
        return {"seeded": 0}

    details = _batch_place_details(_supabase, place_ids)

    rows = []
    for ic in city.insert_candidates:
        if not ic.place_id:
            continue
        d = details.get(ic.place_id, {})
        rating       = d.get("rating_count") and ic.rating  # use IC's rating (from Places seed)
        rating_count = d.get("rating_count")
        # Fall back to IC rating if batch details didn't return one
        _rating = float(ic.rating or 0.0) if hasattr(ic, "rating") else 0.0
        stage, signals = _stage_and_signals(_rating, rating_count)
        rows.append({
            "place_id":   ic.place_id,
            "city_id":    city_id,
            "stage":      stage,
            "signals":    signals,
            "updated_at": datetime.utcnow().isoformat(),
        })
```

Replace it with:

```python
    place_ids = [ic.place_id for ic in city.insert_candidates if ic.place_id]
    if not place_ids:
        return {"seeded": 0}

    details = _batch_place_details(_supabase, place_ids)

    # Fetch existing profiles to preserve trend-derived velocity_ratio
    existing_resp = (
        _supabase.table("place_dynamic_profiles")
        .select("place_id, signals")
        .in_("place_id", place_ids)
        .execute()
    )
    existing_signals: dict[str, dict] = {
        r["place_id"]: (r.get("signals") or {}) for r in (existing_resp.data or [])
    }

    rows = []
    for ic in city.insert_candidates:
        if not ic.place_id:
            continue
        d = details.get(ic.place_id, {})
        rating       = d.get("rating_count") and ic.rating  # use IC's rating (from Places seed)
        rating_count = d.get("rating_count")
        # Fall back to IC rating if batch details didn't return one
        _rating = float(ic.rating or 0.0) if hasattr(ic, "rating") else 0.0
        stage, signals = _stage_and_signals(_rating, rating_count)
        # Preserve trend-derived velocity_ratio if already computed (marked by trend_seeder)
        prev = existing_signals.get(ic.place_id, {})
        if prev.get("trend_seeded"):
            signals["velocity_ratio"] = prev["velocity_ratio"]
            signals["trend_seeded"] = True
        rows.append({
            "place_id":   ic.place_id,
            "city_id":    city_id,
            "stage":      stage,
            "signals":    signals,
            "updated_at": datetime.utcnow().isoformat(),
        })
```

Also update `city/trend_seeder.py` `seed_trend_scores` to mark trend-seeded signals. In the `rows.append` block, change:

```python
        rows.append({
            "place_id":   place["place_id"],
            "city_id":    city_id,
            "stage":      prev.get("stage", "mainstream"),
            "signals": {
                **prev_signals,
                "velocity_ratio": velocity_ratio,
            },
            "updated_at": datetime.utcnow().isoformat(),
        })
```

to:

```python
        rows.append({
            "place_id":   place["place_id"],
            "city_id":    city_id,
            "stage":      prev.get("stage", "mainstream"),
            "signals": {
                **prev_signals,
                "velocity_ratio": velocity_ratio,
                "trend_seeded": True,
            },
            "updated_at": datetime.utcnow().isoformat(),
        })
```

- [ ] **Step 3: Add the seed-trends endpoint to main.py**

After the existing `seed_place_profiles` endpoint (around line 5091), add:

```python
@app.post("/api/places/seed-trends")
async def seed_place_trends(city_id: str = Query(...)):
    """Seed real trend velocity scores for all places in a city.

    Fetches signals from YouTube, Wikimedia, Foursquare, and Reddit (if credentials
    are set). Overwrites velocity_ratio in place_dynamic_profiles while preserving
    stage and crowd_ratio. Safe to call repeatedly — idempotent.
    """
    if _supabase is None:
        raise HTTPException(status_code=503, detail="database_unavailable")
    try:
        city = load_city(city_id, _supabase)
    except ValueError:
        raise HTTPException(status_code=404, detail="city_not_found")

    places = [
        {"place_id": ic.place_id, "name": ic.name, "lat": ic.lat, "lon": ic.lon}
        for ic in city.insert_candidates
        if ic.place_id
    ]
    if not places:
        return {"updated": 0, "skipped": 0}

    from city.trend_seeder import seed_trend_scores
    result = seed_trend_scores(
        city_id=city_id,
        places=places,
        city_name=city.name,
        country_code="",
        supabase=_supabase,
        youtube_key=YOUTUBE_API_KEY,
        foursquare_key=FOURSQUARE_API_KEY,
        reddit_client_id=REDDIT_CLIENT_ID,
        reddit_client_secret=REDDIT_CLIENT_SECRET,
    )
    return result
```

- [ ] **Step 4: Add background trend seeding to the on-demand city seed flow**

Find the `cities_picks` endpoint in `main.py` (around line 4872). `BackgroundTasks` is already imported — just add it to the endpoint signature.

Change:
```python
async def cities_picks(city_id: str, lat: float = None, lon: float = None):
```
to:
```python
async def cities_picks(city_id: str, lat: float = None, lon: float = None, background_tasks: BackgroundTasks = None):
```

Then after the `_supabase.table("city_data").upsert(...).execute()` call (inside the on-demand seed block, after line ~4934), add:

```python
                    # Fire trend seeding in background — does not block picks response
                    if background_tasks and YOUTUBE_API_KEY:
                        from city.trend_seeder import seed_trend_scores as _seed_trends
                        _trend_places = [
                            {"place_id": ic.place_id, "name": ic.name,
                             "lat": ic.lat, "lon": ic.lon}
                            for ic in _seeded.insert_candidates if ic.place_id
                        ]
                        background_tasks.add_task(
                            _seed_trends,
                            city_id=city_slug,
                            places=_trend_places,
                            city_name=_seeded.name,
                            country_code="",
                            supabase=_supabase,
                            youtube_key=YOUTUBE_API_KEY,
                            foursquare_key=FOURSQUARE_API_KEY,
                            reddit_client_id=REDDIT_CLIENT_ID,
                            reddit_client_secret=REDDIT_CLIENT_SECRET,
                        )
```

Note: `city_name=_seeded.name` (the proper name like "Paris") not `city_name=city_id` (the slug "paris") — this matters for YouTube and Reddit search quality.

- [ ] **Step 5: Verify all existing tests still pass**

```bash
cd /Users/souravbiswas/Uncover-roads
pytest tests/city/ -v
```

Expected: all city tests pass (no regressions).

- [ ] **Step 6: Test the endpoint locally**

```bash
# Start the server
uvicorn main:app --reload --port 8000

# In another terminal, test with a seeded city
curl -X POST "http://localhost:8000/api/places/seed-trends?city_id=paris"
```

Expected response: `{"updated": <n>, "skipped": <m>}` (no 500 errors, graceful degradation if API keys are missing).

- [ ] **Step 7: Commit**

```bash
git add main.py city/trend_seeder.py
git commit -m "feat(trends): add /api/places/seed-trends endpoint + preserve trend velocity in seed-profiles"
```

---

## What is NOT in this plan

- Pytrends signal fetcher — deferred. Requires geo-specific tuning and has rate-limit risk. Add as a 5th source once the 4 primary sources are stable in production.
- Weekly background refresh cron — deferred. Use APScheduler to call `seed_trend_scores` for all seeded cities weekly. Implement once the pipeline is proven in production.
- Reddit activation — Reddit credentials stub to `0.0`. Wire in `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` to Railway once API access is approved.
