"""Tests for _generate_scenic_card_for_corridor (Task SR-11).

Three cases:
1. Returns None when route_points is empty (distance_km = 0)
2. Returns None when _score_route_character returns passes_threshold=False
3. Returns a dict with the required keys when all signals pass
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from unittest.mock import patch, MagicMock
import datetime


def _make_stop(name: str, lat: float, lon: float, time: str = "10:00") -> dict:
    return {
        "placeId": f"place_{name.lower().replace(' ', '_')}",
        "title": name,
        "lat": lat,
        "lon": lon,
        "time": time,
        "durationMin": 60,
        "city": "Tokyo",
    }


def _default_route_profile(distance_km: float = 2.0) -> dict:
    return {
        "distance_km": distance_km,
        "duration_min": 25,
        "road_character": 0.8,
        "elevation_gain_m": 10,
        "character_scores": {"natural": 0.7, "waterfront": 0.3, "vibrant": 0.1,
                             "historic": 0.1, "viewpoint": 0.1, "photogenic": 0.1, "local": 0.1},
        "top_character": "natural",
        "path_names": ["Sumida Riverside Walk"],
        "landmark_peeks": [],
        "route_type": "walk",
    }


def test_returns_none_when_route_points_empty():
    """When distance_km is 0 (no route), None is returned immediately."""
    from main import _generate_scenic_card_for_corridor
    origin = _make_stop("Asakusa", 35.71, 139.79)
    dest = _make_stop("Ueno", 35.72, 139.77)
    route_profile = _default_route_profile(distance_km=0)  # empty route
    with patch("main._route_condition_multiplier", return_value=1.0):
        result = _generate_scenic_card_for_corridor(
            origin=origin,
            dest=dest,
            route_profile=route_profile,
            visit_time=None,
            persona_snapshot={},
            persona_attractions=[],
            persona_key="flaneur",
            weather={},
            city_landmarks=[],
        )
    assert result is None


def test_returns_none_when_score_does_not_pass_threshold():
    """When _score_route_character returns passes_threshold=False, None is returned."""
    from main import _generate_scenic_card_for_corridor
    origin = _make_stop("Shinjuku", 35.69, 139.70)
    dest = _make_stop("Shibuya", 35.65, 139.70)
    route_profile = _default_route_profile(distance_km=2.5)

    failing_score = {
        "character_scores": {d: 0.1 for d in
                             ("natural", "viewpoint", "historic", "vibrant",
                              "photogenic", "waterfront", "local")},
        "top_character": "natural",
        "condition_multiplier": 0.9,
        "landmark_peeks": [],
        "path_names": [],
        "route_type": "walk",
        "passes_threshold": False,
    }

    with patch("main._route_condition_multiplier", return_value=0.9), \
         patch("main._score_route_character", return_value=failing_score), \
         patch("main._fetch_uv_index", return_value=3.0):
        result = _generate_scenic_card_for_corridor(
            origin=origin,
            dest=dest,
            route_profile=route_profile,
            visit_time=None,
            persona_snapshot={},
            persona_attractions=[],
            persona_key="flaneur",
            weather={},
            city_landmarks=[],
        )
    assert result is None


def test_returns_card_dict_with_required_keys_when_signals_pass():
    """When all signals pass, a dict with the required keys is returned."""
    from main import _generate_scenic_card_for_corridor
    origin = _make_stop("Asakusa", 35.71, 139.79)
    dest = _make_stop("Ueno", 35.72, 139.77)
    route_profile = _default_route_profile(distance_km=2.0)

    passing_score = {
        "character_scores": {"natural": 0.75, "viewpoint": 0.1, "historic": 0.1,
                             "vibrant": 0.1, "photogenic": 0.1, "waterfront": 0.1, "local": 0.1},
        "top_character": "natural",
        "condition_multiplier": 1.1,
        "landmark_peeks": [],
        "path_names": ["Sumida Riverside Walk"],
        "route_type": "walk",
        "passes_threshold": True,
    }

    with patch("main._route_condition_multiplier", return_value=1.1), \
         patch("main._score_route_character", return_value=passing_score), \
         patch("main._fetch_uv_index", return_value=3.0):
        result = _generate_scenic_card_for_corridor(
            origin=origin,
            dest=dest,
            route_profile=route_profile,
            visit_time=datetime.datetime(2026, 7, 10, 10, 0, 0,
                                         tzinfo=datetime.timezone.utc),
            persona_snapshot={"w_scenic": 0.8},
            persona_attractions=["nature"],
            persona_key="flaneur",
            weather={"temp": 25},
            city_landmarks=[],
        )

    assert result is not None
    required_keys = {
        "type", "routeLabel", "characterDimensions", "landmarkPeek",
        "conditionNote", "topCharacter", "conditionMultiplier",
        "fromStop", "toStop", "distanceKm",
    }
    assert required_keys.issubset(result.keys()), (
        f"Missing keys: {required_keys - result.keys()}"
    )
    assert result["type"] == "scenic"
    assert result["topCharacter"] == "natural"
    assert result["distanceKm"] == 2.0
    assert result["fromStop"] == "Asakusa"
    assert result["toStop"] == "Ueno"
