from datetime import datetime, timezone
import pytest


def test_sun_mult_golden_hour(monkeypatch):
    """Sun alt ~10° → sun_mult = 1.2, UV neutral → overall ≈ 1.2."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 4.0)

    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 10.0)

    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 12, 0, tzinfo=timezone.utc))
    assert abs(result - 1.2) < 0.01


def test_sun_mult_twilight(monkeypatch):
    """Sun alt ~3° → sun_mult = 1.3."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 4.0)
    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 3.0)
    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 4, 0, tzinfo=timezone.utc))
    assert abs(result - 1.3) < 0.01


def test_sun_mult_night(monkeypatch):
    """Sun alt -5° → sun_mult = 0.7."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 4.0)
    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: -5.0)
    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 21, 0, tzinfo=timezone.utc))
    assert abs(result - 0.7) < 0.01


def test_uv_low_pleasant(monkeypatch):
    """uv=1 → uv_mult=1.1."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 1.0)
    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 30.0)  # golden hour
    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 7, 0, tzinfo=timezone.utc))
    assert abs(result - 1.2 * 1.1) < 0.02


def test_uv_high_harsh(monkeypatch):
    """uv=9 → uv_mult=0.85."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 9.0)
    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 50.0)  # peak day
    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 12, 0, tzinfo=timezone.utc))
    assert abs(result - 1.0 * 0.85) < 0.02


def test_uv_none_neutral(monkeypatch):
    """uv=None → uv_mult=1.0 (neutral)."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: None)
    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 10.0)  # golden hour
    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 8, 0, tzinfo=timezone.utc))
    assert abs(result - 1.2) < 0.02


def test_clamp_lower_bound(monkeypatch):
    """Result never goes below 0.5."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 99.0)
    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: -30.0)  # deep night
    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 2, 0, tzinfo=timezone.utc))
    assert result >= 0.5  # 0.7 * 0.85 = 0.595 > 0.5


def test_clamp_upper_bound(monkeypatch):
    """Result never exceeds 1.5."""
    from main import _route_condition_multiplier
    import main as m
    monkeypatch.setattr(m, "_fetch_uv_index", lambda lat, lon: 0.0)
    import pysolar.solar as sol
    monkeypatch.setattr(sol, "get_altitude", lambda lat, lon, dt: 3.0)   # twilight
    result = _route_condition_multiplier(35.6, 139.7, datetime(2024, 6, 21, 5, 0, tzinfo=timezone.utc))
    assert result <= 1.5  # 1.3 * 1.1 = 1.43 ≤ 1.5


def test_fetch_uv_index_returns_none_on_failure(monkeypatch):
    """_fetch_uv_index returns None (not 0.0) when the request fails."""
    import requests
    from main import _fetch_uv_index
    monkeypatch.setattr(requests, "get", lambda *a, **kw: (_ for _ in ()).throw(Exception("fail")))
    result = _fetch_uv_index(35.6, 139.7)
    assert result is None
