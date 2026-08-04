import sys
import asyncio
import pytest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from unittest.mock import AsyncMock, patch, MagicMock
from tests.conftest import make_stop, make_ctx
from engine import builder
from engine.types import EngineResult, EngineDay


@pytest.mark.asyncio
async def test_build_itinerary_returns_engine_result():
    stops = [
        make_stop(place_id="p1", neighborhood="shinjuku", lat=35.693, lon=139.703, duration_min=90),
        make_stop(place_id="p2", neighborhood="asakusa", lat=35.714, lon=139.796, duration_min=60),
    ]
    ctx = make_ctx()

    with patch("engine.narrator.narrate", new_callable=AsyncMock) as mock_narrate:
        mock_narrate.return_value = []
        result = await builder.build_itinerary(stops, ctx)

    assert isinstance(result, EngineResult)
    assert result.generation_id  # non-empty UUID
    assert isinstance(result.days, list)
    assert isinstance(result.messages, list)


@pytest.mark.asyncio
async def test_build_itinerary_all_stops_assigned_scheduled_time():
    stops = [
        make_stop(place_id="p1", neighborhood="shinjuku", lat=35.693, lon=139.703),
        make_stop(place_id="p2", neighborhood="shinjuku", lat=35.695, lon=139.706),
    ]
    ctx = make_ctx()

    with patch("engine.narrator.narrate", new_callable=AsyncMock) as mock_narrate:
        mock_narrate.return_value = []
        result = await builder.build_itinerary(stops, ctx)

    for day in result.days:
        for stop in day.stops:
            assert stop.scheduled_time is not None


@pytest.mark.asyncio
async def test_build_itinerary_narrator_failure_does_not_raise():
    """If narrator throws, build_itinerary still returns a valid EngineResult."""
    stops = [make_stop(place_id="p1", neighborhood="shinjuku")]
    ctx = make_ctx()

    with patch("engine.narrator.narrate", new_callable=AsyncMock) as mock_narrate:
        mock_narrate.side_effect = Exception("LLM failure")
        result = await builder.build_itinerary(stops, ctx)

    assert isinstance(result, EngineResult)


def test_weather_advisories_emits_message_for_hot_outdoor_stop():
    """Outdoor stop on a day forecast hot gets a weather advisory message,
    stop_id set so it can render on that specific stop's card."""
    stop = make_stop(place_id="fushimi", category="park", outdoor=True)
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()

    hot_result = {"temp": 38.0, "rain_intensity": "none", "is_hot": True, "source": "forecast"}
    with patch("engine.weather.resolve_travel_weather", return_value=hot_result):
        messages = builder._weather_advisories([day], ctx)

    weather_msgs = [m for m in messages if m.type == "weather"]
    assert len(weather_msgs) == 1
    assert weather_msgs[0].stop_id == "fushimi"
    assert "hot" in weather_msgs[0].what.lower() or "heat" in weather_msgs[0].what.lower()


def test_weather_advisories_no_message_when_mild():
    stop = make_stop(place_id="fushimi", category="park", outdoor=True)
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()

    mild_result = {"temp": 22.0, "rain_intensity": "none", "is_hot": False, "source": "forecast"}
    with patch("engine.weather.resolve_travel_weather", return_value=mild_result):
        messages = builder._weather_advisories([day], ctx)

    assert not any(m.type == "weather" for m in messages)


def test_weather_advisories_indoor_stop_unaffected_by_heat():
    stop = make_stop(place_id="museum_1", category="museum", outdoor=False)
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()

    hot_result = {"temp": 38.0, "rain_intensity": "none", "is_hot": True, "source": "forecast"}
    with patch("engine.weather.resolve_travel_weather", return_value=hot_result):
        messages = builder._weather_advisories([day], ctx)

    assert not any(m.type == "weather" for m in messages)


def test_weather_advisories_merges_heat_and_rain_into_one_message():
    stop = make_stop(place_id="fushimi", category="park", outdoor=True)
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()

    both_result = {"temp": 38.0, "rain_intensity": "heavy", "is_hot": True, "source": "forecast"}
    with patch("engine.weather.resolve_travel_weather", return_value=both_result):
        messages = builder._weather_advisories([day], ctx)

    weather_msgs = [m for m in messages if m.type == "weather"]
    assert len(weather_msgs) == 1
    assert "hot" in weather_msgs[0].what.lower() or "heat" in weather_msgs[0].what.lower()
    assert "rain" in weather_msgs[0].what.lower()


def test_weather_advisories_fires_for_both_user_added_and_engine_added_stops():
    user_stop = make_stop(place_id="user1", category="park", outdoor=True, is_user_added=True)
    engine_stop = make_stop(place_id="pick1", category="beach", outdoor=True, is_user_added=False)
    day = EngineDay(date="2026-06-01", stops=[user_stop, engine_stop])
    ctx = make_ctx()

    hot_result = {"temp": 38.0, "rain_intensity": "none", "is_hot": True, "source": "forecast"}
    with patch("engine.weather.resolve_travel_weather", return_value=hot_result):
        messages = builder._weather_advisories([day], ctx)

    weather_msgs = [m for m in messages if m.type == "weather"]
    assert {m.stop_id for m in weather_msgs} == {"user1", "pick1"}


def test_weather_advisories_only_calls_weather_api_once_per_day_not_per_stop():
    """Multiple stops on the same day should share one weather lookup."""
    stops = [
        make_stop(place_id="p1", category="park", outdoor=True),
        make_stop(place_id="p2", category="beach", outdoor=True),
        make_stop(place_id="p3", category="museum", outdoor=False),
    ]
    day = EngineDay(date="2026-06-01", stops=stops)
    ctx = make_ctx()

    mild_result = {"temp": 22.0, "rain_intensity": "none", "is_hot": False, "source": "forecast"}
    with patch("engine.weather.resolve_travel_weather", return_value=mild_result) as mock_wx:
        builder._weather_advisories([day], ctx)

    assert mock_wx.call_count == 1


@pytest.mark.asyncio
async def test_build_itinerary_includes_weather_advisories_in_result():
    """End-to-end: a hot outdoor stop's advisory should reach the final EngineResult.messages."""
    stops = [
        make_stop(place_id="p1", category="park", outdoor=True, neighborhood="shinjuku", lat=35.693, lon=139.703),
    ]
    ctx = make_ctx()
    hot_result = {"temp": 38.0, "rain_intensity": "none", "is_hot": True, "source": "forecast"}

    with patch("engine.narrator.narrate", new_callable=AsyncMock) as mock_narrate, \
         patch("engine.weather.resolve_travel_weather", return_value=hot_result):
        mock_narrate.side_effect = lambda msgs, ctx: msgs
        result = await builder.build_itinerary(stops, ctx)

    assert any(m.type == "weather" and m.stop_id == "p1" for m in result.messages)
