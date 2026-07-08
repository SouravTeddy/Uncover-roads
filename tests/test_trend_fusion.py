# tests/test_trend_fusion.py
import pytest
import datetime
from unittest.mock import patch


def _passing_score(vibrant: float = 0.5, local: float = 0.4) -> dict:
    """Return a mock _score_route_character result that passes the threshold."""
    return {
        "character_scores": {
            "natural": 0.3, "viewpoint": 0.3, "historic": 0.3,
            "vibrant": vibrant, "photogenic": 0.3, "waterfront": 0.3, "local": local,
        },
        "top_character": "vibrant",
        "condition_multiplier": 1.0,
        "landmark_peeks": [],
        "path_names": [],
        "route_type": "walk",
        "passes_threshold": True,
    }


def _route_profile() -> dict:
    return {
        "distance_km": 2.0,
        "road_character": 0.7,
        "duration_min": 25,
        "ors_response": {},
        "walk_steps": [],
        "route_points": [],
        "corridor_key": "k1",
    }


def test_generate_scenic_card_sets_is_trending():
    """velocity_ratio >= 0.7 → isTrending=True and vibrant/local scores boosted."""
    from main import _generate_scenic_card_for_corridor
    with patch("main._route_condition_multiplier", return_value=1.0), \
         patch("main._score_route_character", return_value=_passing_score(vibrant=0.5, local=0.4)), \
         patch("main._cache_route_character"):
        card = _generate_scenic_card_for_corridor(
            origin={"title": "A", "lat": 35.71, "lon": 139.79, "place_id": "p1"},
            dest={"title": "B", "lat": 35.72, "lon": 139.80, "place_id": "p2"},
            route_profile=_route_profile(),
            visit_time=datetime.datetime(2026, 7, 10, 10, 0, 0, tzinfo=datetime.timezone.utc),
            persona_snapshot={},
            persona_attractions=[],
            persona_key="explorer",
            weather={},
            city_landmarks=[],
            dest_velocity_ratio=0.85,
        )
    assert card is not None
    assert card["isTrending"] is True
    assert card["trendNote"] == "Trending spot — locals and travellers are buzzing about this right now"
    assert "Trending right now." in card["why"]
    assert card["characterDimensions"].get("vibrant", 0) <= 1.0
    # vibrant was 0.5, +0.15 → 0.65
    assert abs(card["characterDimensions"].get("vibrant", 0) - 0.65) < 0.01


def test_generate_scenic_card_not_trending_when_below_threshold():
    """velocity_ratio < 0.7 → isTrending=False, scores unchanged."""
    from main import _generate_scenic_card_for_corridor
    with patch("main._route_condition_multiplier", return_value=1.0), \
         patch("main._score_route_character", return_value=_passing_score(vibrant=0.5, local=0.4)), \
         patch("main._cache_route_character"):
        card = _generate_scenic_card_for_corridor(
            origin={"title": "A", "lat": 35.71, "lon": 139.79, "place_id": "p1"},
            dest={"title": "B", "lat": 35.72, "lon": 139.80, "place_id": "p2"},
            route_profile=_route_profile(),
            visit_time=datetime.datetime(2026, 7, 10, 10, 0, 0, tzinfo=datetime.timezone.utc),
            persona_snapshot={},
            persona_attractions=[],
            persona_key="explorer",
            weather={},
            city_landmarks=[],
            dest_velocity_ratio=0.5,
        )
    assert card is not None
    assert card["isTrending"] is False
    assert card["trendNote"] is None
    assert "Trending right now." not in card["why"]
    # vibrant unchanged at 0.5
    assert abs(card["characterDimensions"].get("vibrant", 0) - 0.5) < 0.01
