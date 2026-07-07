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


def test_fetch_route_character_small_city_returns_neutral():
    from main import _fetch_route_character
    pts = [(1.0, 1.0), (1.1, 1.1)]
    result = _fetch_route_character(pts, city_pop=40_000)
    assert result == {d: 0.5 for d in ("natural","viewpoint","historic","vibrant","photogenic","waterfront","local")}

def test_fetch_route_character_empty_points_returns_neutral():
    from main import _fetch_route_character
    result = _fetch_route_character([], city_pop=500_000)
    assert all(v == 0.5 for v in result.values())

def test_fetch_route_character_overpass_failure_returns_neutral(monkeypatch):
    import requests
    from main import _fetch_route_character
    def mock_post(*a, **kw): raise requests.exceptions.Timeout()
    monkeypatch.setattr(requests, "post", mock_post)
    pts = [(1.0, 1.0), (1.1, 1.1)]
    result = _fetch_route_character(pts, city_pop=500_000)
    assert all(v == 0.5 for v in result.values())

def test_fetch_route_character_returns_all_7_dimensions():
    from main import _fetch_route_character
    pts = [(1.0, 1.0)]
    result = _fetch_route_character(pts, city_pop=40_000)
    assert set(result.keys()) == {"natural","viewpoint","historic","vibrant","photogenic","waterfront","local"}

def test_fetch_route_character_scores_capped_at_one(monkeypatch):
    import requests, json
    from main import _fetch_route_character
    # Return 1000 viewpoint nodes
    elements = [{"tags": {"tourism": "viewpoint"}} for _ in range(1000)]
    class FakeResp:
        def raise_for_status(self): pass
        def json(self): return {"elements": elements}
    monkeypatch.setattr(requests, "post", lambda *a, **kw: FakeResp())
    pts = [(1.0, 1.0), (1.1, 1.1)]
    result = _fetch_route_character(pts, city_pop=500_000)
    assert result["viewpoint"] == 1.0
    assert all(v <= 1.0 for v in result.values())


def test_bearing_north():
    from main import _bearing
    b = _bearing(0.0, 0.0, 1.0, 0.0)  # due north
    assert abs(b - 0.0) < 1.0 or abs(b - 360.0) < 1.0

def test_bearing_east():
    from main import _bearing
    b = _bearing(0.0, 0.0, 0.0, 1.0)  # due east
    assert abs(b - 90.0) < 1.0

def test_resolve_landmark_coords_valid():
    from main import _resolve_landmark_coords
    assert _resolve_landmark_coords({"lat": 1.0, "lon": 2.0}) == (1.0, 2.0)

def test_resolve_landmark_coords_missing():
    from main import _resolve_landmark_coords
    assert _resolve_landmark_coords({"lat": 1.0}) is None
    assert _resolve_landmark_coords({}) is None

def test_landmark_peek_directly_ahead():
    from main import _check_landmark_peeks
    # Route goes north (0, 0) → (1, 0); landmark also at (2, 0) — directly ahead
    route = [(0.0, 0.0), (1.0, 0.0)]
    landmarks = [{"name": "Tower", "lat": 2.0, "lon": 0.0}]
    result = _check_landmark_peeks(route, landmarks)
    assert "Tower" in result

def test_landmark_peek_to_the_side_not_detected():
    from main import _check_landmark_peeks
    # Route goes north (0,0)→(1,0); landmark is due east at (0.5, 10.0) — ~90° off
    route = [(0.0, 0.0), (1.0, 0.0)]
    landmarks = [{"name": "SideBuilding", "lat": 0.5, "lon": 10.0}]
    result = _check_landmark_peeks(route, landmarks)
    assert "SideBuilding" not in result

def test_landmark_peek_empty_inputs():
    from main import _check_landmark_peeks
    assert _check_landmark_peeks([], [{"name": "X", "lat": 1.0, "lon": 1.0}]) == []
    assert _check_landmark_peeks([(0.0, 0.0), (1.0, 0.0)], []) == []

def test_landmark_peek_max_3():
    from main import _check_landmark_peeks
    # 5 landmarks all directly ahead — should return at most 3
    route = [(0.0, 0.0), (1.0, 0.0)]
    landmarks = [{"name": f"L{i}", "lat": float(i+2), "lon": 0.0} for i in range(5)]
    result = _check_landmark_peeks(route, landmarks)
    assert len(result) <= 3
