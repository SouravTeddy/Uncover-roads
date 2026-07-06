import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, call
from city.trend_seeder import seed_trend_scores, _normalize, _composite, TREND_STALENESS_DAYS, YOUTUBE_DAILY_BUDGET, YOUTUBE_UNITS_PER_PLACE


# ── Normalization ─────────────────────────────────────────────────────────────

def test_normalize_uniform_scores_returns_half():
    result = _normalize([1.0, 1.0, 1.0])
    assert result == [0.5, 0.5, 0.5]


def test_normalize_all_zeros_returns_zeros():
    result = _normalize([0.0, 0.0, 0.0])
    assert result == [0.0, 0.0, 0.0]


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

def _make_supabase(budget_count: int = 0):
    sb = MagicMock()
    # existing profiles query (uses .in_)
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = []
    # YouTube budget query (uses .gte with count="exact")
    sb.table.return_value.select.return_value.gte.return_value.execute.return_value.count = budget_count
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


# ── Staleness guard ───────────────────────────────────────────────────────────

def test_seed_skips_recently_seeded_places():
    sb = _make_supabase()
    recent = (datetime.utcnow() - timedelta(days=1)).isoformat()
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = [
        {"place_id": "p1", "stage": "rising",
         "signals": {"velocity_ratio": 2.5, "trend_seeded": True}, "updated_at": recent},
    ]
    places = [{"place_id": "p1", "name": "Eiffel Tower", "lat": 48.858, "lon": 2.294}]

    with patch("city.trend_seeder.fetch_youtube_score") as mock_yt:
        result = seed_trend_scores("paris", places, "Paris", "FR", sb)

    assert result["updated"] == 0
    assert result["fresh"] == 1
    mock_yt.assert_not_called()


def test_seed_reseeds_stale_places():
    sb = _make_supabase()
    old = (datetime.utcnow() - timedelta(days=TREND_STALENESS_DAYS + 1)).isoformat()
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = [
        {"place_id": "p1", "stage": "rising",
         "signals": {"velocity_ratio": 2.5, "trend_seeded": True}, "updated_at": old},
    ]
    places = [{"place_id": "p1", "name": "Eiffel Tower", "lat": 48.858, "lon": 2.294}]

    with patch("city.trend_seeder.fetch_youtube_score", return_value=0.8), \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=0.7), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=0.6), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=0.0):
        result = seed_trend_scores("paris", places, "Paris", "FR", sb)

    assert result["updated"] == 1
    assert result["fresh"] == 0


def test_seed_partial_fresh_partial_stale():
    sb = _make_supabase()
    recent = (datetime.utcnow() - timedelta(days=1)).isoformat()
    old = (datetime.utcnow() - timedelta(days=TREND_STALENESS_DAYS + 2)).isoformat()
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = [
        {"place_id": "p1", "stage": "mainstream",
         "signals": {"velocity_ratio": 2.0, "trend_seeded": True}, "updated_at": recent},
        {"place_id": "p2", "stage": "mainstream",
         "signals": {"velocity_ratio": 1.5, "trend_seeded": True}, "updated_at": old},
    ]
    places = [
        {"place_id": "p1", "name": "Place A", "lat": 48.85, "lon": 2.35},
        {"place_id": "p2", "name": "Place B", "lat": 48.86, "lon": 2.36},
    ]

    with patch("city.trend_seeder.fetch_youtube_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=0.0):
        result = seed_trend_scores("paris", places, "Paris", "FR", sb)

    assert result["updated"] == 1
    assert result["fresh"] == 1


# ── YouTube budget guard ──────────────────────────────────────────────────────

def test_seed_disables_youtube_when_over_budget():
    # budget_count=80 → 80 × 100 = 8000 units used; adding 1 more place would exceed YOUTUBE_DAILY_BUDGET
    sb = _make_supabase(budget_count=80)
    places = [{"place_id": "p1", "name": "Place A", "lat": 48.85, "lon": 2.35}]

    with patch("city.trend_seeder.fetch_youtube_score") as mock_yt, \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=0.0):
        result = seed_trend_scores("paris", places, "Paris", "FR", sb, youtube_key="real_key")

    # YouTube fetcher should be called with empty string (disabled), not real_key
    mock_yt.assert_called_once()
    assert mock_yt.call_args[0][2] == ""  # third positional arg is api_key
    assert result["updated"] == 1


def test_seed_uses_youtube_when_under_budget():
    # budget_count=40 → 4000 units used; 1 more place = 4100, safely under 8000
    sb = _make_supabase(budget_count=40)
    places = [{"place_id": "p1", "name": "Place A", "lat": 48.85, "lon": 2.35}]

    with patch("city.trend_seeder.fetch_youtube_score") as mock_yt, \
         patch("city.trend_seeder.fetch_wikimedia_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_foursquare_score", return_value=0.5), \
         patch("city.trend_seeder.fetch_reddit_score", return_value=0.0):
        seed_trend_scores("paris", places, "Paris", "FR", sb, youtube_key="real_key")

    mock_yt.assert_called_once()
    assert mock_yt.call_args[0][2] == "real_key"  # key passed through unchanged
