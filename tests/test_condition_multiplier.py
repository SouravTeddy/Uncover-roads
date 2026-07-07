import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from datetime import datetime, timezone


def _weather(condition="Clear", temp=22):
    import time
    sunrise = int(datetime(2026, 7, 6, 5, 0, tzinfo=timezone.utc).timestamp())
    sunset  = int(datetime(2026, 7, 6, 19, 0, tzinfo=timezone.utc).timestamp())
    return {"condition": condition, "temp": temp, "sunrise": sunrise, "sunset": sunset}


def test_hard_block_thunderstorm():
    from main import _route_condition_multiplier
    mult = _route_condition_multiplier(
        weather=_weather("Thunderstorm"), uv_index=5.0,
        visit_time=datetime(2026, 7, 6, 14, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert mult == 0.0


def test_hard_block_heavy_rain():
    from main import _route_condition_multiplier
    mult = _route_condition_multiplier(
        weather=_weather("Heavy Rain"), uv_index=2.0,
        visit_time=datetime(2026, 7, 6, 10, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert mult == 0.0


def test_light_rain_penalty():
    from main import _route_condition_multiplier
    mult = _route_condition_multiplier(
        weather=_weather("Rain", temp=18), uv_index=1.0,
        visit_time=datetime(2026, 7, 6, 11, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert abs(mult - 0.5) < 0.05


def test_night_vibrant_boost():
    from main import _route_condition_multiplier
    # After sunset visit — vibrant/photogenic dimensions get boosted
    mult = _route_condition_multiplier(
        weather=_weather("Clear"), uv_index=0.0,
        visit_time=datetime(2026, 7, 6, 21, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="vibrant",
    )
    assert mult > 1.0


def test_night_natural_penalty():
    from main import _route_condition_multiplier
    # After sunset — natural dimension is penalised
    mult = _route_condition_multiplier(
        weather=_weather("Clear"), uv_index=0.0,
        visit_time=datetime(2026, 7, 6, 21, 0, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="natural",
    )
    assert mult < 1.0


def test_golden_hour_viewpoint_boost():
    from main import _route_condition_multiplier
    # Sunset is 19:00 UTC. Visit at 18:45 = within ±30 min → golden hour
    mult = _route_condition_multiplier(
        weather=_weather("Clear"), uv_index=3.0,
        visit_time=datetime(2026, 7, 6, 18, 45, tzinfo=timezone.utc),
        lat=35.7, lon=139.7, overpass_has_canopy=False, top_character="viewpoint",
    )
    assert mult > 1.0
