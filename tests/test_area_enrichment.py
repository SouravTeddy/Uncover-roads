import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import _nearest_neighborhood_name
from city.data_model import CityData, Neighborhood


def _make_city(neighborhoods):
    return CityData(
        id="test_city",
        name="Test City",
        tier=1,
        center=(0.0, 0.0),
        timezone="UTC",
        climate={},
        movement={},
        culture={},
        neighborhoods=neighborhoods,
        insert_candidates=[],
        scenic_routes=[],
        transit_edges=[],
        engine_modifiers={},
        landmark_anchors=[],
        hidden_gems=[],
    )


def _make_neighborhood(id_, name, lat, lon):
    return Neighborhood(
        id=id_,
        name=name,
        center=(lat, lon),
        polygon=[],
        best_times={},
        crowd_index={},
    )


def test_nearest_neighborhood_picks_closest():
    """Should return the name of the geographically closest neighborhood."""
    near = _make_neighborhood("nh_near", "Near District", 48.8566, 2.3522)
    far = _make_neighborhood("nh_far", "Far District", 48.9000, 2.4000)
    city = _make_city([near, far])

    # Query point is very close to near (48.8566, 2.3522)
    result = _nearest_neighborhood_name(city, 48.8570, 2.3530)
    assert result == "Near District", f"Expected 'Near District', got '{result}'"


def test_nearest_neighborhood_empty_returns_empty():
    """Should return empty string when city has no neighborhoods."""
    city = _make_city([])
    result = _nearest_neighborhood_name(city, 48.8566, 2.3522)
    assert result == "", f"Expected '', got '{result}'"
