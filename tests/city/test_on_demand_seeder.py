import pytest
from unittest.mock import MagicMock, patch
from city.data_model import CityData
from city.on_demand_seeder import seed_city_on_demand

WHITELIST_ROW = {
    "city_id": "porto", "name": "Porto", "country_code": "PT",
    "tier": 1, "lat": 41.1579, "lon": -8.6291, "timezone": "Europe/Lisbon",
    "seeded": False,
}


def _mock_city():
    mock = MagicMock(spec=CityData)
    mock.id = "porto"
    mock.name = "Porto"
    mock.tier = 1
    mock.center = (41.1579, -8.6291)
    mock.timezone = "Europe/Lisbon"
    mock.climate = {}
    mock.movement = {}
    mock.culture = {}
    mock.neighborhoods = []
    mock.insert_candidates = []
    mock.scenic_routes = []
    mock.transit_edges = []
    mock.engine_modifiers = {}
    mock.landmark_anchors = []
    mock.hidden_gems = []
    return mock


def _mock_supabase():
    sb = MagicMock()
    sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    return sb


def test_seed_city_on_demand_returns_city_data():
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()):
        result = seed_city_on_demand(WHITELIST_ROW, _mock_supabase())
    assert result.id == "porto"


def test_seed_city_on_demand_calls_build_city_seed():
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()) as mock_builder:
        seed_city_on_demand(WHITELIST_ROW, _mock_supabase())
    mock_builder.assert_called_once_with(WHITELIST_ROW)


def test_seed_city_on_demand_upserts_to_city_data_table():
    sb = _mock_supabase()
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()):
        seed_city_on_demand(WHITELIST_ROW, sb)
    calls = [str(c) for c in sb.table.call_args_list]
    assert any("city_data" in c for c in calls)


def test_seed_city_on_demand_marks_whitelist_seeded():
    sb = _mock_supabase()
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()):
        seed_city_on_demand(WHITELIST_ROW, sb)
    calls = [str(c) for c in sb.table.call_args_list]
    assert any("city_whitelist" in c for c in calls)


def test_seed_city_on_demand_raises_on_builder_failure():
    with patch("city.on_demand_seeder.build_city_seed", side_effect=ValueError("api_failure")):
        with pytest.raises(ValueError, match="api_failure"):
            seed_city_on_demand(WHITELIST_ROW, _mock_supabase())


def test_seed_city_on_demand_passes_full_row_to_builder():
    with patch("city.on_demand_seeder.build_city_seed", return_value=_mock_city()) as mock_builder:
        seed_city_on_demand(WHITELIST_ROW, _mock_supabase())
    call_arg = mock_builder.call_args[0][0]
    assert call_arg["city_id"] == "porto"
    assert call_arg["country_code"] == "PT"
