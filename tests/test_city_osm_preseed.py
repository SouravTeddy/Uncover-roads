# tests/test_city_osm_preseed.py
import pytest
from unittest.mock import MagicMock, patch


def make_sb_with_city_cache(has_cache: bool, elements=None):
    """Supabase mock for city_osm_features table."""
    sb = MagicMock()
    cache_data = [{"elements": elements or [], "cached_at": "2026-07-08T00:00:00Z"}] if has_cache else []
    (sb.table.return_value.select.return_value
       .eq.return_value.execute.return_value.data) = cache_data
    sb.table.return_value.upsert.return_value.execute.return_value.data = [{}]
    return sb


def test_fetch_route_character_uses_cache_when_available():
    """_fetch_route_character must use city_osm_features cache and not call Overpass."""
    from main import _fetch_route_character
    cached_elements = [
        {"tags": {"natural": "park"}},
        {"tags": {"tourism": "viewpoint"}},
    ]
    sb = make_sb_with_city_cache(has_cache=True, elements=cached_elements)
    with patch("main._supabase", sb):
        with patch("main.fetch_overpass") as mock_overpass:
            result = _fetch_route_character(
                route_points=[(35.71, 139.79), (35.72, 139.80)],
                city_pop=500_000,
                city_id="tokyo",
            )
    mock_overpass.assert_not_called()
    assert isinstance(result, dict)
    assert all(k in result for k in ("natural", "viewpoint", "vibrant", "waterfront", "local"))


def test_fetch_route_character_falls_back_to_overpass_when_no_cache():
    """_fetch_route_character must call live Overpass when no city cache exists."""
    from main import _fetch_route_character
    sb = make_sb_with_city_cache(has_cache=False)
    with patch("main._supabase", sb):
        with patch("main.fetch_overpass", return_value={"elements": []}) as mock_overpass:
            _fetch_route_character(
                route_points=[(35.71, 139.79), (35.72, 139.80)],
                city_pop=500_000,
                city_id="tokyo",
            )
    mock_overpass.assert_called_once()


def test_seed_city_osm_features_upserts_to_db():
    """_seed_city_osm_features must call fetch_overpass and upsert to city_osm_features."""
    from city.seed_builder import _seed_city_osm_features
    sb = MagicMock()
    sb.table.return_value.upsert.return_value.execute.return_value.data = [{}]
    with patch("city.seed_builder.fetch_overpass", return_value={"elements": [{"tags": {"natural": "park"}}]}):
        _seed_city_osm_features("tokyo", 35.68, 139.69, radius_km=15, supabase=sb)
    sb.table.assert_called_with("city_osm_features")
    sb.table.return_value.upsert.assert_called_once()
    call_args = sb.table.return_value.upsert.call_args[0][0]
    assert call_args["city_id"] == "tokyo"
    assert len(call_args["elements"]) == 1
