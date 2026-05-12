import pytest
from unittest.mock import patch, MagicMock
import main as m

@pytest.fixture(autouse=True)
def clear_events_cache():
    m._events_cache.clear()
    yield
    m._events_cache.clear()

def make_tm_response(event_name="Jazz Night", lat=35.67, lon=139.65):
    return {
        "_embedded": {
            "events": [{
                "id": "abc123",
                "name": event_name,
                "dates": {"start": {"localDate": "2026-06-01", "localTime": "20:00:00"}},
                "classifications": [{"segment": {"name": "Music"}}],
                "images": [{"url": "https://example.com/img.jpg", "width": 1024, "ratio": "16_9", "fallback": False}],
                "_embedded": {"venues": [{"name": "Blue Note", "location": {"latitude": str(lat), "longitude": str(lon)}}]}
            }]
        }
    }

def test_events_returns_ticketmaster_data(client):
    with patch("requests.get") as mock_get, \
         patch.object(m, "TICKETMASTER_KEY", "fake_key"), \
         patch.object(m, "YELP_API_KEY", ""):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = make_tm_response()
        mock_get.return_value = mock_resp

        r = client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        assert r.status_code == 200
        data = r.json()
        assert len(data["places"]) == 1
        assert data["places"][0]["title"] == "Jazz Night"

def test_events_second_call_uses_cache(client):
    with patch("requests.get") as mock_get, \
         patch.object(m, "TICKETMASTER_KEY", "fake_key"), \
         patch.object(m, "YELP_API_KEY", ""):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = make_tm_response()
        mock_get.return_value = mock_resp

        client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        assert mock_get.call_count == 1

def test_events_skips_venues_with_zero_coords(client):
    zero_coord_response = {
        "_embedded": {
            "events": [{
                "id": "bad1",
                "name": "Bad Event",
                "dates": {"start": {"localDate": "2026-06-01"}},
                "classifications": [],
                "images": [],
                "_embedded": {"venues": [{"name": "No Location", "location": {"latitude": "0", "longitude": "0"}}]}
            }]
        }
    }
    with patch("requests.get") as mock_get, \
         patch.object(m, "TICKETMASTER_KEY", "fake_key"), \
         patch.object(m, "YELP_API_KEY", ""):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = zero_coord_response
        mock_get.return_value = mock_resp

        r = client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        assert r.json()["places"] == []
