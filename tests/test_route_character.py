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
