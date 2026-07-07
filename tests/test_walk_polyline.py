import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


def test_decode_google_polyline_basic():
    """Google's sample: _p~iF~ps|U_ulLnnqC_mqNvxq` encodes [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]"""
    import polyline
    pts = polyline.decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    assert len(pts) == 3
    assert abs(pts[0][0] - 38.5) < 0.001
    assert abs(pts[0][1] - (-120.2)) < 0.001


def test_sample_linestring_returns_n_points():
    from main import _sample_linestring
    coords = [[i * 0.001, i * 0.001] for i in range(100)]
    sampled = _sample_linestring(coords, n=20)
    assert len(sampled) == 20
    assert all(len(p) == 2 for p in sampled)


def test_extract_walk_route_points_from_steps():
    """_extract_walk_route_points should decode step polylines, concatenate, sample to 20."""
    from main import _extract_walk_route_points
    steps = [
        {"polyline": {"points": "_p~iF~ps|U_ulLnnqC"}, "distance": {"value": 200}},
        {"polyline": {"points": "_mqNvxq`@"}, "distance": {"value": 100}},
    ]
    pts = _extract_walk_route_points(steps)
    assert isinstance(pts, list)
    assert len(pts) > 0
    assert all(len(p) == 2 for p in pts)


def test_extract_walk_route_points_coordinate_order():
    """Verify output is (lat, lon) not (lon, lat)."""
    from main import _extract_walk_route_points
    steps = [{"polyline": {"points": "_p~iF~ps|U_ulLnnqC"}, "distance": {"value": 200}}]
    pts = _extract_walk_route_points(steps)
    assert len(pts) > 0
    # polyline.decode gives first point near (38.5, -120.2)
    # lat ~38.5 (positive), lon ~-120.2 (negative)
    first = pts[0]
    assert first[0] > 0, f"First coord should be lat (positive ~38.5), got {first[0]}"
    assert first[1] < 0, f"Second coord should be lon (negative ~-120.2), got {first[1]}"
