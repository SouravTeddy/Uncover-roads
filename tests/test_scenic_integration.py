"""Integration tests for the full scenic route card pipeline.

These tests verify cross-function behaviour rather than individual units.
All external I/O (Overpass, pysolar, UV index) is monkeypatched so no real
network calls are made.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from datetime import datetime, timezone


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_stop(name: str, lat: float, lon: float) -> dict:
    return {"title": name, "lat": lat, "lon": lon}


def _all_dims(val: float = 0.0) -> dict:
    return {
        "natural": val, "viewpoint": val, "historic": val,
        "vibrant": val, "photogenic": val, "waterfront": val, "local": val,
    }


def _overpass_wrap(scores: dict, named_features=None) -> dict:
    return {"character_scores": scores, "named_features": named_features or [], "viewpoints": []}


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — Full pipeline happy path
# ─────────────────────────────────────────────────────────────────────────────

def test_full_pipeline_happy_path(monkeypatch):
    """Mock all external calls. _generate_scenic_card_for_corridor returns a dict
    with all required keys when given a realistic Sumida River corridor."""
    from main import _generate_scenic_card_for_corridor
    import main as m

    # Avoid real pysolar / UV / Overpass calls
    monkeypatch.setattr(m, "_route_condition_multiplier", lambda lat, lon, vt: 1.1)

    origin = _make_stop("Asakusa", 35.7116, 139.7965)
    dest = _make_stop("Ueno", 35.7141, 139.7774)

    route_profile = {
        "distance_km": 1.8,
        "duration_min": 22,
        "road_character": 0.75,
        "elevation_gain_m": 10,
        # Pre-cached character scores (from SR-8 route_profile_cache)
        "character_scores": {
            "natural": 0.80, "viewpoint": 0.40, "historic": 0.30,
            "vibrant": 0.20, "photogenic": 0.30, "waterfront": 0.70, "local": 0.30,
        },
        "landmark_peeks": ["Sumida River View"],
        "path_names": ["Sumida Riverside Promenade"],
    }
    persona_snapshot = {
        "w_scenic": 0.8, "w_walk_affinity": 0.7, "w_nightlife": 0.2,
        "w_culture_depth": 0.3, "w_food_density": 0.2, "w_efficiency": 0.3,
        "w_spontaneity": 0.5,
    }

    result = _generate_scenic_card_for_corridor(
        origin=origin,
        dest=dest,
        route_profile=route_profile,
        visit_time=datetime(2026, 7, 6, 9, 0, tzinfo=timezone.utc),
        persona_snapshot=persona_snapshot,
        persona_attractions=["nature"],
        persona_key="flaneur",
        weather={"temp": 22},
        city_landmarks=[],
    )

    assert result is not None, "Expected a scenic card, got None"
    required_keys = {
        "type", "sceneType", "accent", "cardType", "routeLabel",
        "conditionNote", "characterDimensions", "landmarkPeek",
        "topCharacter", "conditionMultiplier", "fromStop", "toStop",
        "distanceKm", "why",
    }
    for key in required_keys:
        assert key in result, f"Missing required key: {key}"
    assert result["type"] == "scenic"
    assert result["distanceKm"] == pytest.approx(1.8, abs=0.01)


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — Character scoring with user preferences
# ─────────────────────────────────────────────────────────────────────────────

def test_character_scoring_user_preferences():
    """High w_scenic + heavy natural instruction/overpass signals → top_character == 'natural'
    and weighted score > 0.7."""
    from main import _score_route_character

    instruction_scores = {**_all_dims(), "natural": 0.8, "waterfront": 0.3}
    overpass_character = _overpass_wrap(
        {**_all_dims(), "natural": 0.85, "waterfront": 0.60},
        named_features=["Sumida Riverside"],
    )
    persona_snapshot = {
        "w_scenic": 0.9, "w_walk_affinity": 0.8, "w_nightlife": 0.1,
        "w_culture_depth": 0.2, "w_food_density": 0.1, "w_efficiency": 0.3,
        "w_spontaneity": 0.5,
    }

    result = _score_route_character(
        mode="walk",
        instruction_scores=instruction_scores,
        ors_surface_score=0.7,
        overpass_character=overpass_character,
        road_character=0.0,
        elevation_gain_m=8,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=persona_snapshot,
        persona_attractions=["nature"],
        persona_key="flaneur",
        distance_km=1.5,
    )

    assert result["top_character"] == "natural", (
        f"Expected 'natural', got '{result['top_character']}'. "
        f"Scores: {result['character_scores']}"
    )
    assert result["character_scores"]["natural"] > 0.7, (
        f"Expected natural score > 0.7, got {result['character_scores']['natural']}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — UV index failure degrades gracefully
# ─────────────────────────────────────────────────────────────────────────────

def test_uv_failure_degrades_gracefully(monkeypatch):
    """When _fetch_uv_index raises an exception, _route_condition_multiplier must
    still return a valid float in [0.5, 1.5] rather than propagating the exception."""
    from main import _route_condition_multiplier
    import main as m
    import pysolar.solar as sol

    def _raise_uv(lat, lon):
        raise RuntimeError("UV network error — simulated failure")

    monkeypatch.setattr(m, "_fetch_uv_index", _raise_uv)
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 20.0)  # golden-hour sun alt

    result = _route_condition_multiplier(
        35.71, 139.79, datetime(2026, 7, 6, 7, 0, tzinfo=timezone.utc)
    )

    assert isinstance(result, float), f"Expected float, got {type(result)}"
    assert 0.5 <= result <= 1.5, f"Result {result} outside [0.5, 1.5]"


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — Landmark bearing detection
# ─────────────────────────────────────────────────────────────────────────────

def test_landmark_bearing_detection():
    """Route going due north with a landmark placed directly ahead (same longitude,
    higher latitude) should appear in _check_landmark_peeks result."""
    from main import _check_landmark_peeks

    # Two points on the same meridian — travel bearing ≈ 0° (due north)
    route_points = [(35.700, 139.790), (35.720, 139.790)]

    # Landmark further north on the same meridian — bearing from midpoint ≈ 0°
    landmarks = [
        {"name": "Senso-ji Temple", "lat": 35.740, "lon": 139.790},
    ]

    result = _check_landmark_peeks(route_points, landmarks)

    assert "Senso-ji Temple" in result, (
        f"Expected 'Senso-ji Temple' in landmark peeks, got {result}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Test 5 — Condition multiplier golden hour
# ─────────────────────────────────────────────────────────────────────────────

def test_condition_multiplier_golden_hour(monkeypatch):
    """get_altitude returning 10° (6–45 band → sun_mult = 1.2) combined with
    UV index 2.0 (≤3 → uv_mult = 1.1) should produce result ≈ 1.2 × 1.1 = 1.32."""
    from main import _route_condition_multiplier
    import main as m
    import pysolar.solar as sol

    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 10.0)
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 2.0)

    result = _route_condition_multiplier(
        35.71, 139.79, datetime(2026, 7, 6, 6, 30, tzinfo=timezone.utc)
    )

    expected = 1.2 * 1.1  # 1.32
    assert abs(result - expected) < 0.02, (
        f"Expected ≈{expected} (golden hour × pleasant UV), got {result}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Test 6 — Threshold gate: below-threshold returns None
# ─────────────────────────────────────────────────────────────────────────────

def test_threshold_gate_returns_none(monkeypatch):
    """When _score_route_character returns passes_threshold=False,
    _generate_scenic_card_for_corridor must return None."""
    from main import _generate_scenic_card_for_corridor
    import main as m

    monkeypatch.setattr(m, "_route_condition_multiplier", lambda lat, lon, vt: 1.0)
    monkeypatch.setattr(
        m,
        "_score_route_character",
        lambda *args, **kwargs: {
            "passes_threshold": False,
            "character_scores": _all_dims(0.1),
            "top_character": "natural",
            "condition_multiplier": 1.0,
            "landmark_peeks": [],
            "path_names": [],
            "route_type": "walk",
        },
    )

    origin = _make_stop("Asakusa", 35.711, 139.796)
    dest = _make_stop("Ueno", 35.714, 139.777)
    route_profile = {
        "distance_km": 1.8,
        "duration_min": 22,
        "road_character": 0.75,
        "elevation_gain_m": 10,
        "character_scores": None,
        "landmark_peeks": [],
        "path_names": [],
    }

    result = _generate_scenic_card_for_corridor(
        origin=origin,
        dest=dest,
        route_profile=route_profile,
        visit_time=datetime(2026, 7, 6, 9, 0, tzinfo=timezone.utc),
        persona_snapshot={},
        persona_attractions=[],
        persona_key="flaneur",
        weather={},
        city_landmarks=[],
    )

    assert result is None, f"Expected None when threshold not met, got {result}"
