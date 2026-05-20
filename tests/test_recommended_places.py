import pytest
import main as m

PLACES = [
    {"id": "p1", "title": "Senso-ji Temple", "category": "historic", "lat": 35.71, "lon": 139.79, "rating": 4.8},
    {"id": "p2", "title": "Blue Bottle Coffee", "category": "cafe",    "lat": 35.67, "lon": 139.70, "rating": 4.5},
    {"id": "p3", "title": "Shinjuku Gyoen",    "category": "park",     "lat": 35.68, "lon": 139.71, "rating": 4.7},
    {"id": "p4", "title": "Some Event",         "category": "event",    "lat": 35.67, "lon": 139.65, "rating": None},
]

def test_historian_prefers_historic(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "historian",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": PLACES,
    })
    assert r.status_code == 200
    picks = r.json()["picks"]
    assert len(picks) > 0
    assert picks[0]["title"] == "Senso-ji Temple"

def test_events_excluded_from_picks(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "wanderer",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": PLACES,
    })
    picks = r.json()["picks"]
    assert all(p["category"] != "event" for p in picks)

def test_empty_places_returns_empty(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "epicurean",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": [],
    })
    assert r.json()["picks"] == []

def test_venue_filter_boosts_score(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "wanderer",
        "venue_filters": ["cafe"],
        "itinerary_bias": [],
        "places": PLACES,
    })
    picks = r.json()["picks"]
    titles = [p["title"] for p in picks]
    assert titles.index("Blue Bottle Coffee") < titles.index("Shinjuku Gyoen")

def test_reason_text_is_non_empty(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "historian",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": PLACES,
    })
    picks = r.json()["picks"]
    assert all(p.get("whyRec") for p in picks)
