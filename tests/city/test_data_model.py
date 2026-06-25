import json
from pathlib import Path
from city.data_model import CityData, Neighborhood, InsertCandidate, load_city_from_dict

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "cities"


def test_load_city_from_dict_tokyo():
    data = json.loads((FIXTURE_DIR / "tokyo.json").read_text())
    city = load_city_from_dict(data)
    assert city.id == "tokyo"
    assert city.name == "Tokyo"
    assert len(city.neighborhoods) >= 1
    assert city.timezone == "Asia/Tokyo"


def test_neighborhood_has_best_times():
    data = json.loads((FIXTURE_DIR / "tokyo.json").read_text())
    city = load_city_from_dict(data)
    nh = city.neighborhoods[0]
    assert isinstance(nh.best_times, dict)
    assert all(0.0 <= v <= 1.0 for v in nh.best_times.values())


def test_insert_candidates_have_required_fields():
    data = json.loads((FIXTURE_DIR / "tokyo.json").read_text())
    city = load_city_from_dict(data)
    for ic in city.insert_candidates:
        assert ic.type in ("coffee", "lunch", "scenic_walk", "rest", "micro")
        assert ic.time_cost_min > 0


def test_load_city_from_dict_nyc():
    data = json.loads((FIXTURE_DIR / "nyc.json").read_text())
    city = load_city_from_dict(data)
    assert city.id == "nyc"
    assert city.timezone == "America/New_York"


# ── On-demand seeding via whitelist ──────────────────────────────────────────

def test_load_city_triggers_on_demand_for_whitelisted_unseeded_city():
    """load_city() calls on_demand seeder when city is whitelisted but not in city_data."""
    from unittest.mock import MagicMock, patch
    from city.data_model import load_city

    whitelist_row = {
        "city_id": "porto", "name": "Porto", "country_code": "PT",
        "tier": 1, "lat": 41.1579, "lon": -8.6291, "timezone": "Europe/Lisbon", "seeded": False,
    }

    # Differentiate city_data (no row) and city_whitelist (row found) by table name
    city_data_mock = MagicMock()
    city_data_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)

    whitelist_mock = MagicMock()
    whitelist_mock.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=whitelist_row)

    mock_supabase = MagicMock()
    mock_supabase.table.side_effect = lambda name: city_data_mock if name == "city_data" else whitelist_mock

    mock_city = MagicMock()
    mock_city.id = "porto"

    with patch("city.on_demand_seeder.seed_city_on_demand", return_value=mock_city) as mock_seeder:
        result = load_city("porto", mock_supabase)

    mock_seeder.assert_called_once_with(whitelist_row, mock_supabase)
    assert result.id == "porto"


def test_load_city_raises_for_non_whitelisted_city():
    """load_city() raises ValueError when city is not in whitelist."""
    import pytest
    from unittest.mock import MagicMock
    from city.data_model import load_city

    mock_supabase = MagicMock()
    mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(data=None)
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)

    with pytest.raises(ValueError, match="city_not_found"):
        load_city("nonexistent_city_xyz", mock_supabase)
