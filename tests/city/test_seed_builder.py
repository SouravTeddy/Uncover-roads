import pytest
from unittest.mock import patch, MagicMock
from city.data_model import CityData, Neighborhood, InsertCandidate
from city.seed_builder import (
    _fetch_wikidata_landmarks,
    _fetch_osm_neighborhoods,
    _fetch_google_pois,
    _fetch_foursquare_hidden_gems,
    _fetch_climate,
    _build_insert_candidates,
    build_city_seed,
)

PORTO = {
    "city_id": "porto", "name": "Porto", "lat": 41.1579, "lon": -8.6291,
    "country_code": "PT", "timezone": "Europe/Lisbon", "tier": 1,
}


def _mock_wikidata_response(names):
    rows = [{"item": {"value": f"http://www.wikidata.org/entity/Q{i}"},
             "itemLabel": {"value": n}} for i, n in enumerate(names)]
    return {"results": {"bindings": rows}}


def _mock_osm_response(neighborhood_names):
    elements = [
        {"type": "relation", "tags": {"name": n},
         "center": {"lat": 41.15 + i * 0.01, "lon": -8.62 + i * 0.01}}
        for i, n in enumerate(neighborhood_names)
    ]
    return {"elements": elements}


def _mock_google_response(places):
    return {
        "status": "OK",
        "results": [
            {"place_id": f"gp_{i}", "name": p["name"],
             "geometry": {"location": {"lat": 41.15 + i * 0.005, "lng": -8.62 + i * 0.005}},
             "types": [p["type"]], "rating": 4.2, "user_ratings_total": 200}
            for i, p in enumerate(places)
        ]
    }


def _mock_foursquare_response(venue_names):
    return {
        "results": [
            {"fsq_id": f"fsq_{i}", "name": n,
             "geocodes": {"main": {"latitude": 41.155 + i * 0.005, "longitude": -8.615 + i * 0.005}},
             "categories": [{"name": "Local Spot"}]}
            for i, n in enumerate(venue_names)
        ]
    }


def _mock_open_meteo_response():
    return {
        "monthly": {
            "temperature_2m_mean": [9, 10, 12, 14, 16, 19, 22, 22, 20, 16, 12, 9],
            "precipitation_sum": [130, 110, 90, 70, 60, 30, 10, 15, 45, 110, 130, 150],
        }
    }


# ── _fetch_wikidata_landmarks ─────────────────────────────────────────────────

def test_fetch_wikidata_landmarks_returns_slugs():
    with patch("city.seed_builder.requests.get") as mock_get:
        mock_get.return_value.json.return_value = _mock_wikidata_response(
            ["Clerigos Tower", "Ribeira District", "Dom Luis Bridge"]
        )
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_wikidata_landmarks(PORTO)
    assert isinstance(result, list)
    assert "clerigos_tower" in result
    assert "ribeira_district" in result


# ── _fetch_osm_neighborhoods ──────────────────────────────────────────────────

def test_fetch_osm_neighborhoods_returns_neighborhood_objects():
    with patch("city.seed_builder.requests.post") as mock_post:
        mock_post.return_value.json.return_value = _mock_osm_response(
            ["Ribeira", "Bonfim", "Cedofeita"]
        )
        mock_post.return_value.raise_for_status = MagicMock()
        result = _fetch_osm_neighborhoods(PORTO)
    assert len(result) >= 2
    assert all(isinstance(n, Neighborhood) for n in result)
    assert all(n.id for n in result)


# ── _fetch_google_pois ────────────────────────────────────────────────────────

def test_fetch_google_pois_returns_dicts():
    neighborhoods = [
        Neighborhood(id="ribeira", name="Ribeira", center=(41.140, -8.614),
                     polygon=[], best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                     crowd_index={"weekday": 0.5, "weekend": 0.7})
    ]
    with patch("city.seed_builder.requests.get") as mock_get, \
         patch.dict("os.environ", {"GOOGLE_PLACES_API_KEY": "test_key"}):
        mock_get.return_value.json.return_value = _mock_google_response([
            {"name": "Majestic Cafe", "type": "cafe"},
            {"name": "Casa Guedes", "type": "restaurant"},
        ])
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_google_pois(PORTO, neighborhoods)
    assert len(result) >= 1
    assert all("name" in p and "lat" in p and "type" in p for p in result)


# ── _fetch_foursquare_hidden_gems ─────────────────────────────────────────────

def test_fetch_foursquare_hidden_gems_returns_slugs():
    with patch("city.seed_builder.requests.get") as mock_get, \
         patch.dict("os.environ", {"FOURSQUARE_API_KEY": "test_key"}):
        mock_get.return_value.json.return_value = _mock_foursquare_response(
            ["Taberna dos Mercadores", "Cafe Candelabro",
             "A", "B", "C", "Taberna dos Mercadores 2", "Local Bar",
             "Hidden Spot", "Secret Cafe", "Local Gem"]
        )
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_foursquare_hidden_gems(PORTO)
    assert isinstance(result, list)


# ── _fetch_climate ────────────────────────────────────────────────────────────

def test_fetch_climate_returns_expected_shape():
    with patch("city.seed_builder.requests.get") as mock_get:
        mock_get.return_value.json.return_value = _mock_open_meteo_response()
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_climate(PORTO)
    assert "heat_threshold_c" in result
    assert "rain_months" in result
    assert "hot_months" in result
    assert isinstance(result["rain_months"], list)
    assert isinstance(result["hot_months"], list)


def test_fetch_climate_hot_months_flags_months_at_or_above_threshold():
    """A destination with a real hot season (e.g. Marrakesh) needs hot_months
    populated so climatology fallback (trips booked >16 days out) can still
    flag heat — heat_threshold_c alone has no month attached to it."""
    hot_city_response = {
        "monthly": {
            "temperature_2m_mean": [18, 19, 22, 25, 29, 33, 37, 37, 32, 27, 21, 18],
            "precipitation_sum": [20, 15, 10, 5, 0, 0, 0, 0, 0, 5, 15, 25],
        }
    }
    with patch("city.seed_builder.requests.get") as mock_get:
        mock_get.return_value.json.return_value = hot_city_response
        mock_get.return_value.raise_for_status = MagicMock()
        result = _fetch_climate(PORTO)
    # heat_threshold_c = max(int(max(monthly_temp)), 25) = 37
    assert result["heat_threshold_c"] == 37
    assert result["hot_months"] == [7, 8]


# ── build_city_seed ───────────────────────────────────────────────────────────

def test_build_city_seed_returns_citydata():
    neighborhoods = [
        Neighborhood(id="ribeira", name="Ribeira", center=(41.140, -8.614),
                     polygon=[], best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                     crowd_index={"weekday": 0.5, "weekend": 0.7})
    ]
    with patch("city.seed_builder._fetch_wikidata_landmarks", return_value=["clerigos_tower", "ribeira"]), \
         patch("city.seed_builder._fetch_osm_neighborhoods", return_value=neighborhoods), \
         patch("city.seed_builder._fetch_google_pois", return_value=[
             {"place_id": "gp_0", "name": "Majestic Cafe", "lat": 41.148, "lon": -8.609,
              "type": "coffee", "google_type": "cafe", "time_cost_min": 30, "neighborhood": "ribeira"},
             {"place_id": "gp_1", "name": "Casa Guedes", "lat": 41.145, "lon": -8.611,
              "type": "lunch", "google_type": "restaurant", "time_cost_min": 60, "neighborhood": "ribeira"},
         ]), \
         patch("city.seed_builder._fetch_foursquare_hidden_gems", return_value=["taberna_dos_mercadores"]), \
         patch("city.seed_builder._fetch_climate", return_value={"heat_threshold_c": 28, "rain_months": [11, 12, 1]}):
        city = build_city_seed(PORTO)
    assert isinstance(city, CityData)
    assert city.id == "porto"
    assert city.name == "Porto"
    assert len(city.neighborhoods) >= 1
    assert len(city.insert_candidates) >= 1
    assert city.engine_modifiers["siesta_window"] == "13:00-15:00"  # Portugal
    assert city.landmark_anchors == ["clerigos_tower", "ribeira"]


def test_build_city_seed_has_coffee_insert():
    neighborhoods = [
        Neighborhood(id="ribeira", name="Ribeira", center=(41.140, -8.614),
                     polygon=[], best_times={"morning": 0.7, "afternoon": 0.8, "evening": 0.6},
                     crowd_index={"weekday": 0.5, "weekend": 0.7})
    ]
    with patch("city.seed_builder._fetch_wikidata_landmarks", return_value=["clerigos_tower"]), \
         patch("city.seed_builder._fetch_osm_neighborhoods", return_value=neighborhoods), \
         patch("city.seed_builder._fetch_google_pois", return_value=[
             {"place_id": "gp_0", "name": "Majestic Cafe", "lat": 41.148, "lon": -8.609,
              "type": "coffee", "google_type": "cafe", "time_cost_min": 30, "neighborhood": "ribeira"},
             {"place_id": "gp_1", "name": "Casa Guedes", "lat": 41.145, "lon": -8.611,
              "type": "lunch", "google_type": "restaurant", "time_cost_min": 60, "neighborhood": "ribeira"},
         ]), \
         patch("city.seed_builder._fetch_foursquare_hidden_gems", return_value=[]), \
         patch("city.seed_builder._fetch_climate", return_value={"heat_threshold_c": 28, "rain_months": [11]}):
        city = build_city_seed(PORTO)
    coffee = [ic for ic in city.insert_candidates if ic.type == "coffee"]
    assert len(coffee) >= 1
