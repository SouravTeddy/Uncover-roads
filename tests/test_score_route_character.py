import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ---------------------------------------------------------------------------
# Helper — minimal overpass_character wrapper
# ---------------------------------------------------------------------------

def _overpass(scores: dict, named_features=None):
    return {"character_scores": scores, "named_features": named_features or [], "viewpoints": []}


def _all_zero():
    return {d: 0.0 for d in ("natural", "viewpoint", "historic", "vibrant", "photogenic", "waterfront", "local")}


def _base_snapshot():
    return {
        "w_scenic": 0.5, "w_walk_affinity": 0.5, "w_nightlife": 0.5,
        "w_culture_depth": 0.5, "w_food_density": 0.5, "w_efficiency": 0.5,
        "w_spontaneity": 0.5,
    }


# ---------------------------------------------------------------------------
# 1. Basic blending: known instruction/overpass scores → expected weighted output
# ---------------------------------------------------------------------------

def test_basic_blending_natural_dominant():
    """Natural signal high in both instruction and overpass → natural is top_character."""
    from main import _score_route_character
    instruction = {**_all_zero(), "natural": 0.8}
    overpass = {**_all_zero(), "natural": 0.7}
    result = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.5,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=_base_snapshot(),
        persona_attractions=[],
        persona_key="flaneur",
        distance_km=2.0,
    )
    assert result["top_character"] == "natural"
    assert result["character_scores"]["natural"] > result["character_scores"]["vibrant"]
    assert "passes_threshold" in result
    assert "condition_multiplier" in result


def test_basic_blending_all_zero_scores():
    """All zero inputs → character scores are non-negative, function does not raise."""
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores=_all_zero(),
        ors_surface_score=0.0,
        overpass_character=_overpass(_all_zero()),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=_base_snapshot(),
        persona_attractions=[],
        persona_key="flaneur",
        distance_km=1.0,
    )
    assert all(v >= 0.0 for v in result["character_scores"].values())
    assert all(v <= 1.0 for v in result["character_scores"].values())


def test_basic_blending_returns_required_keys():
    """Return dict always has all four required keys."""
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores=_all_zero(),
        ors_surface_score=0.5,
        overpass_character=_overpass(_all_zero()),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=_base_snapshot(),
        persona_attractions=[],
        persona_key="flaneur",
        distance_km=1.0,
    )
    for key in ("character_scores", "top_character", "passes_threshold", "condition_multiplier"):
        assert key in result, f"Missing key: {key}"


# ---------------------------------------------------------------------------
# 2. Efficiency penalty applies when distance > haversine * 2
# ---------------------------------------------------------------------------

def test_efficiency_penalty_reduces_scores():
    """When distance_km > haversine_km * 2 and w_efficiency > 0, scores are lower."""
    from main import _score_route_character
    instruction = {**_all_zero(), "natural": 0.8}
    overpass = {**_all_zero(), "natural": 0.9}
    snapshot_high_efficiency = {**_base_snapshot(), "w_efficiency": 1.0}
    snapshot_no_efficiency   = {**_base_snapshot(), "w_efficiency": 0.0}

    result_penalised = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.5,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=snapshot_high_efficiency,
        persona_attractions=[],
        persona_key="efficientExplorer",
        distance_km=10.0,  # >> haversine * 2
        haversine_km=3.0,
    )
    result_baseline = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.5,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=snapshot_no_efficiency,
        persona_attractions=[],
        persona_key="efficientExplorer",
        distance_km=10.0,
        haversine_km=3.0,
    )
    # High w_efficiency route is penalised compared to zero w_efficiency
    assert result_penalised["character_scores"]["natural"] < result_baseline["character_scores"]["natural"]


def test_efficiency_penalty_not_applied_when_within_ratio():
    """No penalty when distance <= haversine * 2."""
    from main import _score_route_character
    instruction = {**_all_zero(), "natural": 0.8}
    overpass = {**_all_zero(), "natural": 0.9}

    result_no_penalty = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.5,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_efficiency": 1.0},
        persona_attractions=[],
        persona_key="efficientExplorer",
        distance_km=5.0,   # exactly 2× haversine — not over
        haversine_km=3.0,  # 5.0 < 3.0 * 2 = 6.0
    )
    result_with_penalty = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.5,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_efficiency": 1.0},
        persona_attractions=[],
        persona_key="efficientExplorer",
        distance_km=7.0,   # 7.0 > 3.0 * 2 = 6.0
        haversine_km=3.0,
    )
    assert result_no_penalty["character_scores"]["natural"] > result_with_penalty["character_scores"]["natural"]


# ---------------------------------------------------------------------------
# 3. slowScholar historic boost adds 0.20
# ---------------------------------------------------------------------------

def test_slow_scholar_historic_boost():
    """slowScholar persona adds 0.20 to historic dimension score."""
    from main import _score_route_character
    instruction = {**_all_zero(), "historic": 0.3}
    overpass = {**_all_zero(), "historic": 0.3}

    result_scholar = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.3,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=_base_snapshot(),
        persona_attractions=[],
        persona_key="slowScholar",
        distance_km=2.0,
    )
    result_generic = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.3,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot=_base_snapshot(),
        persona_attractions=[],
        persona_key="flaneur",
        distance_km=2.0,
    )
    # slowScholar should have a higher historic score due to +0.20 boost
    assert result_scholar["character_scores"]["historic"] > result_generic["character_scores"]["historic"]
    # Difference should be approximately 0.20
    diff = result_scholar["character_scores"]["historic"] - result_generic["character_scores"]["historic"]
    assert 0.15 <= diff <= 0.25, f"Expected ~0.20 historic boost, got {diff:.3f}"


def test_slow_scholar_threshold_delta():
    """slowScholar gets a -0.05 threshold delta making it easier to pass."""
    from main import _score_route_character
    # Use marginal scores that would be just below default threshold for generic persona
    instruction = {**_all_zero(), "historic": 0.2}
    overpass = {**_all_zero(), "historic": 0.15}

    result_scholar = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.2,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_spontaneity": 0.0},  # no spontaneity discount
        persona_attractions=["historic"],
        persona_key="slowScholar",
        distance_km=1.0,
    )
    assert "passes_threshold" in result_scholar

    # Control case: same route without slowScholar should have lower/equal score or fail threshold
    result_generic = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.2,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_spontaneity": 0.0},  # same snapshot
        persona_attractions=["historic"],
        persona_key=None,  # no persona key for generic comparison
        distance_km=1.0,
    )
    # Verify slowScholar threshold delta is doing something:
    # either generic fails threshold or has lower historic score
    assert (
        result_generic["passes_threshold"] is False or
        result_scholar["character_scores"]["historic"] > result_generic["character_scores"]["historic"]
    )


# ---------------------------------------------------------------------------
# 4. nightCreature vibrant multiplier applied after top_character determined
# ---------------------------------------------------------------------------

def test_night_creature_vibrant_multiplier():
    """nightCreature: vibrant score gets ×1.5 when it is the top character."""
    from main import _score_route_character
    # Use lower inputs to keep pre-multiplier vibrant score in ~0.4–0.65 range
    # so the ×1.5 multiplier is observable (not capped at 1.0)
    instruction = {**_all_zero(), "vibrant": 0.3}
    overpass = {**_all_zero(), "vibrant": 0.4}

    result_night = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.0,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_nightlife": 0.9, "w_food_density": 0.8},
        persona_attractions=[],
        persona_key="nightCreature",
        distance_km=2.0,
    )
    result_generic = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.0,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_nightlife": 0.9, "w_food_density": 0.8},
        persona_attractions=[],
        persona_key="flaneur",   # different persona, same weights
        distance_km=2.0,
    )
    assert result_night["top_character"] == "vibrant"
    # nightCreature vibrant score should be meaningfully higher (×1.5 multiplier observable)
    assert result_night["character_scores"]["vibrant"] > result_generic["character_scores"]["vibrant"]
    # Check for meaningful margin (at least 0.05 difference, allowing for ×1.5 multiplier effect)
    assert result_night["character_scores"]["vibrant"] - result_generic["character_scores"]["vibrant"] > 0.05


def test_night_creature_natural_penalty():
    """nightCreature: natural score gets ×0.3 when it is the top character."""
    from main import _score_route_character
    instruction = {**_all_zero(), "natural": 0.8}
    overpass = {**_all_zero(), "natural": 0.9}

    result_night = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.7,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_scenic": 0.9},
        persona_attractions=[],
        persona_key="nightCreature",
        distance_km=2.0,
    )
    result_generic = _score_route_character(
        mode="walk",
        instruction_scores=instruction,
        ors_surface_score=0.7,
        overpass_character=_overpass(overpass),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_scenic": 0.9},
        persona_attractions=[],
        persona_key="flaneur",
        distance_km=2.0,
    )
    assert result_night["top_character"] == "natural"
    # nightCreature natural multiplier 0.3 → lower than generic persona
    assert result_night["character_scores"]["natural"] < result_generic["character_scores"]["natural"]


# ---------------------------------------------------------------------------
# 5. Threshold check: score above / below 0.55
# ---------------------------------------------------------------------------

def test_threshold_passes_strong_signal():
    """High natural signal with condition_multiplier=1.0 should pass threshold."""
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores={**_all_zero(), "natural": 0.9},
        ors_surface_score=0.8,
        overpass_character=_overpass({**_all_zero(), "natural": 0.9}),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_scenic": 1.0, "w_walk_affinity": 1.0},
        persona_attractions=["nature"],
        persona_key="flaneur",
        distance_km=2.0,
    )
    assert result["passes_threshold"] is True


def test_threshold_fails_zero_condition_multiplier():
    """condition_multiplier=0.0 always causes threshold failure (hard block)."""
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores={**_all_zero(), "natural": 1.0},
        ors_surface_score=1.0,
        overpass_character=_overpass({**_all_zero(), "natural": 1.0}),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=0.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_scenic": 1.0, "w_walk_affinity": 1.0},
        persona_attractions=["nature"],
        persona_key="flaneur",
        distance_km=2.0,
    )
    assert result["passes_threshold"] is False


def test_threshold_fails_short_distance():
    """distance_km < 0.5 should fail threshold regardless of scores."""
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores={**_all_zero(), "natural": 1.0},
        ors_surface_score=1.0,
        overpass_character=_overpass({**_all_zero(), "natural": 1.0}),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=1.0,
        landmark_peeks=[],
        persona_snapshot={**_base_snapshot(), "w_scenic": 1.0},
        persona_attractions=[],
        persona_key="flaneur",
        distance_km=0.3,  # too short
    )
    assert result["passes_threshold"] is False


def test_condition_multiplier_stored_in_result():
    """condition_multiplier passed in is stored in the return dict unchanged."""
    from main import _score_route_character
    result = _score_route_character(
        mode="walk",
        instruction_scores=_all_zero(),
        ors_surface_score=0.5,
        overpass_character=_overpass(_all_zero()),
        road_character=0.0,
        elevation_gain_m=0,
        condition_multiplier=0.75,
        landmark_peeks=[],
        persona_snapshot=_base_snapshot(),
        persona_attractions=[],
        persona_key="flaneur",
        distance_km=1.0,
    )
    assert result["condition_multiplier"] == 0.75
