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

def make_eventbrite_response(event_name="Art Fair", lat=35.69, lon=139.70):
    return {
        "events": [{
            "id": "eb-999",
            "name": {"text": event_name},
            "start": {"local": "2026-06-02T10:00:00"},
            "url": "https://eventbrite.com/e/999",
            "logo": {"url": "https://example.com/art.jpg"},
            "venue": {
                "name": "Tokyo Forum",
                "address": {"localized_address_display": "3-5-1 Marunouchi, Tokyo"},
                "latitude": str(lat),
                "longitude": str(lon),
            },
            "category_id": "105",
        }]
    }

def test_events_merges_eventbrite(client):
    """Eventbrite events appear in results when EVENTBRITE_API_KEY is set."""
    from unittest.mock import patch, MagicMock
    def fake_get(url, **kwargs):
        mock = MagicMock()
        mock.status_code = 200
        if "ticketmaster" in url:
            mock.json.return_value = {"_embedded": {"events": []}}
        elif "eventbriteapi" in url:
            mock.json.return_value = make_eventbrite_response()
        return mock

    with patch("requests.get", side_effect=fake_get), \
         patch.object(m, "TICKETMASTER_KEY", "fake_key"), \
         patch.object(m, "EVENTBRITE_API_KEY", "fake_eb"), \
         patch.object(m, "YELP_API_KEY", ""):
        r = client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        assert r.status_code == 200
        places = r.json()["places"]
        assert any("Art Fair" in p["title"] for p in places)

def test_events_deduplicates_across_sources(client):
    """Same event title from Ticketmaster and Eventbrite appears only once."""
    from unittest.mock import patch, MagicMock
    def fake_get(url, **kwargs):
        mock = MagicMock()
        mock.status_code = 200
        if "ticketmaster" in url:
            mock.json.return_value = make_tm_response("Jazz Night")
        elif "eventbriteapi" in url:
            mock.json.return_value = make_eventbrite_response("Jazz Night")
        return mock

    with patch("requests.get", side_effect=fake_get), \
         patch.object(m, "TICKETMASTER_KEY", "fake_key"), \
         patch.object(m, "EVENTBRITE_API_KEY", "fake_eb"), \
         patch.object(m, "YELP_API_KEY", ""):
        r = client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        places = r.json()["places"]
        jazz_nights = [p for p in places if p["title"] == "Jazz Night"]
        assert len(jazz_nights) == 1
