import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    from main import app
    from fastapi.testclient import TestClient
    return TestClient(app)


def _mock_osrm(distance_m=45000, duration_s=1800, steps=None, coords=None):
    if coords is None:
        coords = [[75.787, 26.912], [75.850, 26.940], [75.900, 26.960]]
    if steps is None:
        # Mix of slow residential (20 m/s = 72 km/h) and fast motorway steps
        steps = [
            {"distance": 20000, "duration": 1200, "name": "NH48"},   # 16.7 m/s = 60 km/h
            {"distance": 25000, "duration": 600, "name": "NH8"},     # 41.7 m/s = 150 km/h → motorway
        ]
    return MagicMock(
        status_code=200,
        json=lambda: {
            "code": "Ok",
            "routes": [{
                "distance": distance_m,
                "duration": duration_s,
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords,
                },
                "legs": [{"steps": steps}],
            }]
        }
    )


def _mock_elevation(points, base=200, step=50):
    results = [{"latitude": lat, "longitude": lon, "elevation": base + i * step}
               for i, (lat, lon) in enumerate(points)]
    return MagicMock(status_code=200, json=lambda: {"results": results})


def test_route_profile_returns_distance_and_duration(client):
    with patch("main._supabase", None):
        with patch("requests.get", return_value=_mock_osrm(distance_m=60000, duration_s=2400)):
            with patch("requests.post", return_value=_mock_elevation([])):
                resp = client.get("/route-profile", params={
                    "origin_lat": 26.912, "origin_lon": 75.787,
                    "dest_lat": 26.960, "dest_lon": 75.900,
                })
    assert resp.status_code == 200
    data = resp.json()
    assert data["distance_km"] == 60.0
    assert data["duration_min"] == 40


def test_route_profile_road_character_high_speed_is_low(client):
    """Steps averaging >80 km/h → low road_character (highway-grade)."""
    fast_steps = [{"distance": 50000, "duration": 1200}]  # 41.7 m/s ≈ 150 km/h
    with patch("main._supabase", None):
        with patch("requests.get", return_value=_mock_osrm(steps=fast_steps)):
            with patch("requests.post", return_value=_mock_elevation([])):
                resp = client.get("/route-profile", params={
                    "origin_lat": 26.912, "origin_lon": 75.787,
                    "dest_lat": 26.960, "dest_lon": 75.900,
                })
    assert resp.json()["road_character"] == 0.0


def test_route_profile_road_character_slow_is_high(client):
    """Steps averaging <80 km/h → high road_character (scenic/residential)."""
    slow_steps = [{"distance": 10000, "duration": 1200}]  # 8.3 m/s ≈ 30 km/h
    with patch("main._supabase", None):
        with patch("requests.get", return_value=_mock_osrm(steps=slow_steps)):
            with patch("requests.post", return_value=_mock_elevation([])):
                resp = client.get("/route-profile", params={
                    "origin_lat": 26.912, "origin_lon": 75.787,
                    "dest_lat": 26.960, "dest_lon": 75.900,
                })
    assert resp.json()["road_character"] == 1.0


def test_route_profile_elevation_gain_computed(client):
    """Elevation gain is the sum of positive sequential differences."""
    # We need to make Open-Elevation return ascending values
    def mock_post_ascending(*args, **kwargs):
        payload = kwargs.get("json", {})
        locations = payload.get("locations", [])
        results = [
            {"latitude": loc["latitude"], "longitude": loc["longitude"], "elevation": 100 + i * 20}
            for i, loc in enumerate(locations)
        ]
        return MagicMock(status_code=200, json=lambda: {"results": results})

    osrm = _mock_osrm(coords=[[75.787, 26.912], [75.850, 26.940], [75.900, 26.960]])
    with patch("main._supabase", None):
        with patch("requests.get", return_value=osrm):
            with patch("requests.post", side_effect=mock_post_ascending):
                resp = client.get("/route-profile", params={
                    "origin_lat": 26.912, "origin_lon": 75.787,
                    "dest_lat": 26.960, "dest_lon": 75.900,
                })
    data = resp.json()
    assert data["elevation_gain_m"] is not None
    assert data["elevation_gain_m"] > 0
    assert data["elevation_loss_m"] == 0


def test_route_profile_serves_from_cache(client):
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "corridor_key": "26.912_75.787_26.96_75.9",
            "distance_km": 55.0,
            "duration_min": 38,
            "elevation_gain_m": 320,
            "elevation_loss_m": 180,
            "peak_elevation_m": 1450,
            "road_character": 0.82,
            "sample_elevations": [200, 350, 500, 1200, 1450, 900],
            "fetched_at": "2026-06-25T00:00:00+00:00",
        }]
    )
    with patch("main._supabase", mock_supabase):
        with patch("requests.get") as mock_get:
            resp = client.get("/route-profile", params={
                "origin_lat": 26.912, "origin_lon": 75.787,
                "dest_lat": 26.960, "dest_lon": 75.900,
            })
            mock_get.assert_not_called()
    data = resp.json()
    assert data["distance_km"] == 55.0
    assert data["elevation_gain_m"] == 320
    assert data["road_character"] == 0.82
    assert data["sample_elevations"] == [200, 350, 500, 1200, 1450, 900]
