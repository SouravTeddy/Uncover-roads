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
