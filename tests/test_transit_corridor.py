import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def _mock_transit_response(vehicle_type="SUBWAY", line_name="Blue Line",
                            dep_stop="MI Road", arr_stop="Civil Lines",
                            total_duration_sec=720, walk_sec=180):
    return {
        "status": "OK",
        "routes": [{
            "legs": [{
                "duration": {"value": total_duration_sec},
                "steps": [
                    {"travel_mode": "WALKING", "duration": {"value": walk_sec}},
                    {
                        "travel_mode": "TRANSIT",
                        "duration": {"value": total_duration_sec - walk_sec},
                        "transit_details": {
                            "line": {
                                "vehicle": {"type": vehicle_type},
                                "short_name": line_name,
                                "name": line_name,
                            },
                            "departure_stop": {"name": dep_stop},
                            "arrival_stop": {"name": arr_stop},
                            "num_stops": 3,
                        },
                    },
                ],
            }]
        }]
    }


def _mock_walk_response(distance_m=850, duration_sec=612, streets=None):
    steps = []
    if streets:
        for street in streets:
            steps.append({
                "travel_mode": "WALKING",
                "duration": {"value": duration_sec // max(1, len(streets))},
                "html_instructions": f"Head <b>north</b> on <b>{street}</b>",
            })
    else:
        steps.append({"travel_mode": "WALKING", "duration": {"value": duration_sec}})
    return {
        "status": "OK",
        "routes": [{
            "legs": [{
                "distance": {"value": distance_m, "text": f"{distance_m} m"},
                "duration": {"value": duration_sec, "text": "10 mins"},
                "steps": steps,
            }]
        }]
    }


def _make_mode_aware_mock(transit_resp, walk_resp):
    """Returns a side_effect function that routes by mode param — safe under parallel execution."""
    def side_effect(*args, **kwargs):
        mode = (kwargs.get("params") or {}).get("mode", "transit")
        payload = walk_resp if mode == "walking" else transit_resp
        return MagicMock(status_code=200, json=lambda p=payload: p)
    return side_effect


FAKE_KEY = {"GOOGLE_PLACES_API_KEY": "test-key"}


def test_transit_corridor_returns_transit_when_available(client, mocker):
    mocker.patch("main._supabase", None)
    mocker.patch.dict("os.environ", FAKE_KEY)
    transit_resp = _mock_transit_response()
    walk_resp = _mock_walk_response(distance_m=850, duration_sec=612)
    with patch("requests.get", side_effect=_make_mode_aware_mock(transit_resp, walk_resp)):
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_transit"] is True
    assert data["transit_type"] == "SUBWAY"
    assert data["line_name"] == "Blue Line"
    assert data["departure_stop"] == "MI Road"
    assert data["arrival_stop"] == "Civil Lines"
    assert data["transfers"] == 0
    assert data["duration_min"] == 12
    assert data["walk_to_stop_min"] == 3
    assert data["walk_distance_m"] == 850
    assert data["walk_duration_min"] == 10


def test_transit_corridor_returns_walk_data_even_with_no_transit(client, mocker):
    mocker.patch("main._supabase", None)
    mocker.patch.dict("os.environ", FAKE_KEY)
    no_transit = {"status": "ZERO_RESULTS", "routes": []}
    walk_resp = _mock_walk_response(distance_m=1200, duration_sec=900)
    with patch("requests.get", side_effect=_make_mode_aware_mock(no_transit, walk_resp)):
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_transit"] is False
    assert data["walk_distance_m"] == 1200
    assert data["walk_duration_min"] == 15


def test_transit_corridor_returns_no_transit_when_google_returns_empty(client, mocker):
    mocker.patch("main._supabase", None)
    mocker.patch.dict("os.environ", FAKE_KEY)
    empty = {"status": "ZERO_RESULTS", "routes": []}
    with patch("requests.get", side_effect=_make_mode_aware_mock(empty, empty)):
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_transit"] is False
    assert data["transit_type"] is None
    assert data["walk_distance_m"] is None
    assert data["walk_duration_min"] is None


def test_transit_corridor_serves_from_cache(client, mocker):
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "corridor_key": "26.9124_75.7873_26.92_75.8",
            "has_transit": True,
            "transit_type": "BUS",
            "duration_min": 15,
            "line_name": "Route 7",
            "departure_stop": "Stop A",
            "arrival_stop": "Stop B",
            "transfers": 0,
            "walk_to_stop_min": 5,
            "walk_distance_m": 720,
            "walk_duration_min": 9,
            "walk_via": ["MI Road", "Sardar Patel Marg"],
            "fetched_at": "2026-06-25T00:00:00+00:00",
        }]
    )
    mocker.patch("main._supabase", mock_supabase)
    with patch("requests.get") as mock_get:
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
        mock_get.assert_not_called()  # Google not called when cache hits
    assert resp.status_code == 200
    data = resp.json()
    assert data["transit_type"] == "BUS"
    assert data["walk_distance_m"] == 720
    assert data["walk_duration_min"] == 9
    assert data["walk_via"] == ["MI Road", "Sardar Patel Marg"]


def test_transit_corridor_refetches_when_cache_missing_walk_data(client, mocker):
    """Pre-migration cache rows (walk_distance_m=None) trigger a fresh Google fetch."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{
            "corridor_key": "26.9124_75.7873_26.92_75.8",
            "has_transit": True,
            "transit_type": "BUS",
            "duration_min": 15,
            "line_name": "Route 7",
            "departure_stop": "Stop A",
            "arrival_stop": "Stop B",
            "transfers": 0,
            "walk_to_stop_min": 5,
            "walk_distance_m": None,   # pre-migration row — triggers refetch
            "walk_duration_min": None,
            "fetched_at": "2026-06-25T00:00:00+00:00",
        }]
    )
    mocker.patch("main._supabase", mock_supabase)
    mocker.patch.dict("os.environ", FAKE_KEY)
    transit_resp = _mock_transit_response()
    walk_resp = _mock_walk_response(distance_m=600, duration_sec=480)
    with patch("requests.get", side_effect=_make_mode_aware_mock(transit_resp, walk_resp)) as mock_get:
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
        assert mock_get.call_count == 2  # refetched both calls
    data = resp.json()
    assert data["walk_distance_m"] == 600
    assert data["walk_duration_min"] == 8


def test_transit_corridor_multiple_transit_steps_counts_transfers(client, mocker):
    mocker.patch("main._supabase", None)
    mocker.patch.dict("os.environ", FAKE_KEY)
    two_transit_response = {
        "status": "OK",
        "routes": [{
            "legs": [{
                "duration": {"value": 1800},
                "steps": [
                    {"travel_mode": "WALKING", "duration": {"value": 120}},
                    {"travel_mode": "TRANSIT", "duration": {"value": 600},
                     "transit_details": {"line": {"vehicle": {"type": "BUS"}, "short_name": "A", "name": "A"},
                                         "departure_stop": {"name": "S1"}, "arrival_stop": {"name": "S2"}}},
                    {"travel_mode": "WALKING", "duration": {"value": 180}},
                    {"travel_mode": "TRANSIT", "duration": {"value": 900},
                     "transit_details": {"line": {"vehicle": {"type": "SUBWAY"}, "short_name": "B", "name": "B"},
                                         "departure_stop": {"name": "S3"}, "arrival_stop": {"name": "S4"}}},
                ],
            }]
        }]
    }
    empty = {"status": "ZERO_RESULTS", "routes": []}
    with patch("requests.get", side_effect=_make_mode_aware_mock(two_transit_response, empty)):
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.json()["transfers"] == 1


def test_transit_corridor_extracts_walk_via_street_names(client, mocker):
    """walk_via contains real street names extracted from html_instructions bold tags."""
    mocker.patch("main._supabase", None)
    mocker.patch.dict("os.environ", FAKE_KEY)
    transit_resp = _mock_transit_response()
    walk_resp = _mock_walk_response(
        distance_m=920,
        duration_sec=660,
        streets=["Omotesando Ave", "Meiji Dori"],
    )
    with patch("requests.get", side_effect=_make_mode_aware_mock(transit_resp, walk_resp)):
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["walk_via"] == ["Omotesando Ave", "Meiji Dori"]


def test_transit_corridor_filters_direction_words_from_walk_via(client, mocker):
    """Cardinal directions and turn words are stripped from walk_via."""
    mocker.patch("main._supabase", None)
    mocker.patch.dict("os.environ", FAKE_KEY)
    transit_resp = _mock_transit_response()
    # Steps with only direction words — no street names
    direction_only_walk = {
        "status": "OK",
        "routes": [{
            "legs": [{
                "distance": {"value": 500, "text": "500 m"},
                "duration": {"value": 360, "text": "6 mins"},
                "steps": [
                    {"travel_mode": "WALKING", "duration": {"value": 180},
                     "html_instructions": "Head <b>north</b> toward the intersection"},
                    {"travel_mode": "WALKING", "duration": {"value": 180},
                     "html_instructions": "Turn <b>left</b> and continue <b>straight</b>"},
                ],
            }]
        }]
    }
    with patch("requests.get", side_effect=_make_mode_aware_mock(transit_resp, direction_only_walk)):
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["walk_via"] is None
