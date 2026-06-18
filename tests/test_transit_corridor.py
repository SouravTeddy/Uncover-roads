import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def _mock_directions_response(vehicle_type="SUBWAY", line_name="Blue Line",
                               dep_stop="MI Road", arr_stop="Civil Lines",
                               total_duration_sec=720, walk_sec=180):
    return {
        "status": "OK",
        "routes": [{
            "legs": [{
                "duration": {"value": total_duration_sec},
                "steps": [
                    {
                        "travel_mode": "WALKING",
                        "duration": {"value": walk_sec},
                    },
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


def test_transit_corridor_returns_transit_when_available(client, mocker):
    mocker.patch("main._supabase", None)  # skip cache read/write
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: _mock_directions_response()
        )
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


def test_transit_corridor_returns_no_transit_when_google_returns_empty(client, mocker):
    mocker.patch("main._supabase", None)
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"status": "ZERO_RESULTS", "routes": []}
        )
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_transit"] is False
    assert data["transit_type"] is None


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
            "fetched_at": "2026-06-18T00:00:00+00:00",
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
    assert resp.json()["transit_type"] == "BUS"


def test_transit_corridor_multiple_transit_steps_counts_transfers(client, mocker):
    mocker.patch("main._supabase", None)
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
    with patch("requests.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: two_transit_response)
        resp = client.get("/transit-corridor", params={
            "origin_lat": 26.9124, "origin_lon": 75.7873,
            "dest_lat": 26.9200, "dest_lon": 75.8000,
        })
    assert resp.json()["transfers"] == 1
