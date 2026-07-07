import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_natural_dimension_scores_canal_step():
    from main import _score_instructions_by_dimension
    steps = [
        {"html_instructions": "Walk along the <b>canal</b> to the bridge", "distance": {"value": 400}},
        {"html_instructions": "Turn left on <b>High Street</b>", "distance": {"value": 100}},
    ]
    scores = _score_instructions_by_dimension(steps)
    assert scores["natural"] > 0
    assert scores["natural"] >= scores["vibrant"]


def test_historic_dimension_scores_temple_step():
    from main import _score_instructions_by_dimension
    steps = [
        {"html_instructions": "Pass <b>Senso-ji temple</b> on your right", "distance": {"value": 300}},
    ]
    scores = _score_instructions_by_dimension(steps)
    assert scores["historic"] > 0


def test_vibrant_dimension_scores_market_step():
    from main import _score_instructions_by_dimension
    steps = [
        {"html_instructions": "Continue through <b>Tsukiji market</b>", "distance": {"value": 200}},
    ]
    scores = _score_instructions_by_dimension(steps)
    assert scores["vibrant"] > 0


def test_returns_all_seven_dimensions():
    from main import _score_instructions_by_dimension
    scores = _score_instructions_by_dimension([])
    assert set(scores.keys()) == {"natural", "viewpoint", "historic", "vibrant", "photogenic", "waterfront", "local"}


def test_empty_steps_returns_all_zeros():
    from main import _score_instructions_by_dimension
    scores = _score_instructions_by_dimension([])
    assert all(v == 0.0 for v in scores.values())


def test_score_caps_at_one():
    from main import _score_instructions_by_dimension
    # Many matching steps should still cap at 1.0
    steps = [
        {"html_instructions": f"Walk past river bank canal park", "distance": {"value": 1000}}
        for _ in range(10)
    ]
    scores = _score_instructions_by_dimension(steps)
    assert all(v <= 1.0 for v in scores.values()), "All dimension scores must be capped at 1.0"
    assert scores["natural"] == 1.0, "Heavy natural content should hit 1.0 cap"


def test_ors_surface_score_missing_extras_returns_neutral():
    from main import _ors_surface_score
    assert _ors_surface_score({}) == 0.5
    assert _ors_surface_score({"routes": []}) == 0.5


def test_ors_surface_score_all_grass():
    from main import _ors_surface_score
    response = {"routes": [{"extras": {"surface": {"values": [[0, 10, 17]]}}}]}
    score = _ors_surface_score(response)
    assert abs(score - 1.0) < 0.01  # grass = 1.0


def test_ors_surface_score_all_asphalt():
    from main import _ors_surface_score
    response = {"routes": [{"extras": {"surface": {"values": [[0, 10, 3]]}}}]}
    score = _ors_surface_score(response)
    assert abs(score - 0.2) < 0.01  # asphalt = 0.2


def test_ors_surface_score_weighted_mix():
    from main import _ors_surface_score
    # 5 units asphalt (0.2) + 5 units grass (1.0) = 0.6 average
    response = {"routes": [{"extras": {"surface": {"values": [[0, 5, 3], [5, 10, 17]]}}}]}
    score = _ors_surface_score(response)
    assert abs(score - 0.6) < 0.01


def test_ors_surface_score_unknown_is_neutral():
    from main import _ors_surface_score
    response = {"routes": [{"extras": {"surface": {"values": [[0, 10, 0]]}}}]}
    score = _ors_surface_score(response)
    assert abs(score - 0.5) < 0.01  # unknown = 0.5


def test_route_character_gate_skips_low_value_route():
    from main import _should_run_overpass_for_route
    # Both instruction score and surface score near zero → skip
    assert _should_run_overpass_for_route(
        instruction_scores={"natural": 0.0, "viewpoint": 0.0, "historic": 0.0, "vibrant": 0.1,
                            "photogenic": 0.0, "waterfront": 0.0, "local": 0.1},
        ors_surface_score=0.15,
    ) is False


def test_route_character_gate_runs_for_natural_route():
    from main import _should_run_overpass_for_route
    assert _should_run_overpass_for_route(
        instruction_scores={"natural": 0.6, "viewpoint": 0.0, "historic": 0.0, "vibrant": 0.0,
                            "photogenic": 0.0, "waterfront": 0.0, "local": 0.0},
        ors_surface_score=0.3,
    ) is True
