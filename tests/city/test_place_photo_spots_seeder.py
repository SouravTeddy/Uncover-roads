import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from city.place_photo_spots_seeder import (
    extract_photo_spot,
    seed_place_photo_spots,
    PHOTO_STALENESS_DAYS,
)


# ── extract_photo_spot ────────────────────────────────────────────────────────

def test_extract_returns_none_for_irrelevant_text():
    assert extract_photo_spot("Great food and friendly staff. Loved the pasta.") is None


def test_extract_finds_photo_keyword():
    text = "The best angle to photograph the tower is from the south side early in the morning."
    result = extract_photo_spot(text)
    assert result is not None
    assert "angle" in result["description"].lower() or "photograph" in result["description"].lower()


def test_extract_detects_golden_hour_timing():
    text = "The golden hour light here is absolutely magical for photography."
    result = extract_photo_spot(text)
    assert result is not None
    assert result["timing"] == "Golden hour"


def test_extract_detects_sunrise_timing():
    text = "Come at sunrise before the crowds arrive for the best view."
    result = extract_photo_spot(text)
    assert result is not None
    assert result["timing"] in ("Sunrise", "Morning")


def test_extract_detects_night_timing():
    text = "The building is illuminated at night — beautiful for photography."
    result = extract_photo_spot(text)
    assert result is not None
    assert result["timing"] == "Night"


def test_extract_no_timing_when_none_present():
    text = "Best angle is from across the river to get the full view."
    result = extract_photo_spot(text)
    assert result is not None
    assert result["timing"] is None


def test_extract_picks_longest_relevant_sentence():
    text = (
        "Good spot. "
        "The best viewpoint is from the rooftop terrace of the adjacent building, "
        "which gives an unobstructed angle of the entire facade. "
        "Nice."
    )
    result = extract_photo_spot(text)
    assert result is not None
    assert "rooftop" in result["description"].lower() or "viewpoint" in result["description"].lower()


# ── seed_place_photo_spots ────────────────────────────────────────────────────

def _make_supabase(fresh_ids=None, cache_reviews=None):
    sb = MagicMock()
    # place_photo_spots freshness check
    fresh_data = [{"place_id": pid} for pid in (fresh_ids or [])]
    sb.table.return_value.select.return_value.in_.return_value.gte.return_value.execute.return_value.data = fresh_data
    # place_details_cache review lookup
    cache_data = cache_reviews or []
    sb.table.return_value.select.return_value.in_.return_value.execute.return_value.data = cache_data
    # upsert
    sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    return sb


def test_seed_skips_places_without_place_id():
    sb = _make_supabase()
    places = [{"place_id": None, "name": "Ghost", "lat": 48.85, "lon": 2.35}]
    result = seed_place_photo_spots(places, "paris", "Paris", sb)
    assert result["inserted"] == 0
    assert result["skipped"] == 1


def test_seed_skips_fresh_places():
    sb = _make_supabase(fresh_ids=["p1"])
    places = [{"place_id": "p1", "name": "Eiffel Tower", "lat": 48.858, "lon": 2.294}]
    result = seed_place_photo_spots(places, "paris", "Paris", sb)
    assert result["skipped"] == 1
    assert result["inserted"] == 0


def test_seed_no_spot_when_review_has_no_photo_content():
    sb = _make_supabase(
        cache_reviews=[{"place_id": "p1", "data": {"top_review": "Great food and drinks. Very cosy."}}]
    )
    places = [{"place_id": "p1", "name": "Le Café", "lat": 48.85, "lon": 2.35}]
    result = seed_place_photo_spots(places, "paris", "Paris", sb)
    assert result["no_spot"] == 1
    assert result["inserted"] == 0


def test_seed_inserts_google_review_spot():
    review = "The best angle to photograph the tower is from the south bank of the river."
    sb = _make_supabase(
        cache_reviews=[{"place_id": "p1", "data": {"top_review": review}}]
    )
    places = [{"place_id": "p1", "name": "Eiffel Tower", "lat": 48.858, "lon": 2.294}]
    result = seed_place_photo_spots(places, "paris", "Paris", sb)
    assert result["inserted"] == 1
    upsert_call = sb.table.return_value.upsert.call_args
    rows = upsert_call[0][0]
    assert len(rows) == 1
    assert rows[0]["source"] == "google_review"
    assert rows[0]["confidence"] == 0.5
    assert rows[0]["place_id"] == "p1"


def test_seed_inserts_reddit_spot_with_upvote_boost():
    sb = _make_supabase()  # no cached reviews
    places = [{"place_id": "p1", "name": "Louvre", "lat": 48.861, "lon": 2.336}]

    snippets = [
        {
            "text": "Best angle for photos of the pyramid is from the east garden at golden hour.",
            "url":  "https://reddit.com/r/travel/comments/abc123",
            "upvotes": 500,
        }
    ]
    with patch("city.place_photo_spots_seeder.fetch_reddit_photo_snippets", return_value=snippets):
        result = seed_place_photo_spots(
            places, "paris", "Paris", sb,
            reddit_client_id="id", reddit_client_secret="secret"
        )

    assert result["inserted"] == 1
    rows = sb.table.return_value.upsert.call_args[0][0]
    assert rows[0]["source"] == "reddit"
    assert rows[0]["confidence"] > 0.5  # upvote boost applied
    assert rows[0]["timing"] == "Golden hour"


def test_seed_skips_reddit_when_no_credentials():
    sb = _make_supabase()
    places = [{"place_id": "p1", "name": "Louvre", "lat": 48.861, "lon": 2.336}]
    with patch("city.place_photo_spots_seeder.fetch_reddit_photo_snippets") as mock_reddit:
        seed_place_photo_spots(places, "paris", "Paris", sb)
    mock_reddit.assert_not_called()


def test_seed_picks_highest_upvoted_reddit_snippet():
    sb = _make_supabase()
    places = [{"place_id": "p1", "name": "Notre Dame", "lat": 48.853, "lon": 2.349}]

    snippets = [
        {"text": "Best view of the cathedral from the quay across the river.",
         "url": "https://reddit.com/r/a", "upvotes": 10},
        {"text": "The best angle is from the rooftop of the building facing the facade.",
         "url": "https://reddit.com/r/b", "upvotes": 300},
    ]
    with patch("city.place_photo_spots_seeder.fetch_reddit_photo_snippets", return_value=snippets):
        result = seed_place_photo_spots(
            places, "paris", "Paris", sb,
            reddit_client_id="id", reddit_client_secret="secret"
        )

    rows = sb.table.return_value.upsert.call_args[0][0]
    assert len(rows) == 1  # only one Reddit spot per place
    assert rows[0]["source_url"] == "https://reddit.com/r/b"  # highest upvotes


def test_seed_returns_correct_counts_for_mixed_batch():
    fresh_review = "The best spot for photos is from across the river at golden hour."
    no_review = "Lovely café with great coffee."
    sb = _make_supabase(
        fresh_ids=["p3"],
        cache_reviews=[
            {"place_id": "p1", "data": {"top_review": fresh_review}},
            {"place_id": "p2", "data": {"top_review": no_review}},
        ],
    )
    places = [
        {"place_id": "p1", "name": "Eiffel Tower", "lat": 48.858, "lon": 2.294},
        {"place_id": "p2", "name": "Le Café",       "lat": 48.85,  "lon": 2.35},
        {"place_id": "p3", "name": "Fresh Place",   "lat": 48.86,  "lon": 2.36},
    ]
    result = seed_place_photo_spots(places, "paris", "Paris", sb)
    assert result["skipped"] == 1   # p3 was fresh
    assert result["inserted"] == 1  # p1 had photo content
    assert result["no_spot"] == 1   # p2 had no photo content
