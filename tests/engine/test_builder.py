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


# ── Alcohol advisories ──────────────────────────────────────────────────────

def test_alcohol_advisory_fires_for_bar_stop_in_dry_city():
    stop = make_stop(place_id="bar1", category="bar")
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["alcohol_restricted"] = True

    messages = builder._alcohol_advisories([day], ctx)

    alcohol_msgs = [m for m in messages if m.type == "alcohol"]
    assert len(alcohol_msgs) == 1
    assert alcohol_msgs[0].stop_id == "bar1"


def test_alcohol_advisory_silent_when_city_not_restricted():
    stop = make_stop(place_id="bar1", category="bar")
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["alcohol_restricted"] = False

    messages = builder._alcohol_advisories([day], ctx)

    assert not any(m.type == "alcohol" for m in messages)


def test_alcohol_advisory_silent_for_non_bar_category():
    stop = make_stop(place_id="museum1", category="museum")
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["alcohol_restricted"] = True

    messages = builder._alcohol_advisories([day], ctx)

    assert not any(m.type == "alcohol" for m in messages)


# ── Ramadan advisories ───────────────────────────────────────────────────────

def test_ramadan_advisory_fires_for_daytime_dining_stop_during_ramadan():
    stop = make_stop(place_id="rest1", category="restaurant", start_offset_min=12 * 60)  # 12:00
    day = EngineDay(date="2026-02-20", stops=[stop])  # within 2026 Ramadan window
    ctx = make_ctx()
    ctx.city.culture["ramadan_affected"] = True

    messages = builder._ramadan_advisories([day], ctx)

    ramadan_msgs = [m for m in messages if m.type == "ramadan"]
    assert len(ramadan_msgs) == 1
    assert ramadan_msgs[0].stop_id == "rest1"


def test_ramadan_advisory_silent_outside_ramadan_window():
    stop = make_stop(place_id="rest1", category="restaurant", start_offset_min=12 * 60)
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["ramadan_affected"] = True

    messages = builder._ramadan_advisories([day], ctx)

    assert not any(m.type == "ramadan" for m in messages)


def test_ramadan_advisory_silent_for_evening_dining():
    stop = make_stop(place_id="rest1", category="restaurant", start_offset_min=20 * 60)  # 20:00, after iftar
    day = EngineDay(date="2026-02-20", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["ramadan_affected"] = True

    messages = builder._ramadan_advisories([day], ctx)

    assert not any(m.type == "ramadan" for m in messages)


def test_ramadan_advisory_silent_when_city_not_ramadan_affected():
    stop = make_stop(place_id="rest1", category="restaurant", start_offset_min=12 * 60)
    day = EngineDay(date="2026-02-20", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["ramadan_affected"] = False

    messages = builder._ramadan_advisories([day], ctx)

    assert not any(m.type == "ramadan" for m in messages)


# ── Nightlife advisory (day-level) ──────────────────────────────────────────

def test_nightlife_advisory_fires_when_day_has_bar_stop_in_low_nightlife_city():
    stop = make_stop(place_id="bar1", category="bar")
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["nightlife_score"] = "low"

    messages = builder._nightlife_advisory([day], ctx)

    nightlife_msgs = [m for m in messages if m.type == "nightlife"]
    assert len(nightlife_msgs) == 1
    assert nightlife_msgs[0].stop_id is None
    assert nightlife_msgs[0].day_date == "2026-06-01"


def test_nightlife_advisory_silent_when_score_not_low():
    stop = make_stop(place_id="bar1", category="bar")
    day = EngineDay(date="2026-06-01", stops=[stop])
    ctx = make_ctx()
    ctx.city.culture["nightlife_score"] = "high"

    messages = builder._nightlife_advisory([day], ctx)

    assert not any(m.type == "nightlife" for m in messages)


def test_nightlife_advisory_fires_once_per_multiday_trip():
    """Each day is independently eligible — this is exactly the kind of
    day-level message that must not collide under a (type, stop_id) dedup,
    since stop_id is None for every occurrence."""
    day1 = EngineDay(date="2026-06-01", stops=[make_stop(place_id="bar1", category="bar")])
    day2 = EngineDay(date="2026-06-02", stops=[make_stop(place_id="bar2", category="nightlife")])
    ctx = make_ctx()
    ctx.city.culture["nightlife_score"] = "low"

    messages = builder._nightlife_advisory([day1, day2], ctx)

    assert len([m for m in messages if m.type == "nightlife"]) == 2


# ── Walkability advisory (day-level) ────────────────────────────────────────

def test_walkability_advisory_fires_for_busy_day_in_low_walkability_city():
    stops = [make_stop(place_id=f"p{i}", category="museum") for i in range(3)]
    day = EngineDay(date="2026-06-01", stops=stops)
    ctx = make_ctx()
    ctx.city.culture["walkability_score"] = "low"

    messages = builder._walkability_advisory([day], ctx)

    walk_msgs = [m for m in messages if m.type == "walkability"]
    assert len(walk_msgs) == 1
    assert walk_msgs[0].stop_id is None
    assert walk_msgs[0].day_date == "2026-06-01"


def test_walkability_advisory_silent_for_light_day():
    stops = [make_stop(place_id="p1", category="museum"), make_stop(place_id="p2", category="cafe")]
    day = EngineDay(date="2026-06-01", stops=stops)
    ctx = make_ctx()
    ctx.city.culture["walkability_score"] = "low"

    messages = builder._walkability_advisory([day], ctx)

    assert not any(m.type == "walkability" for m in messages)


# ── Day splitting — distinct dates ──────────────────────────────────────────

def test_split_into_days_assigns_a_distinct_date_per_day_even_when_light():
    """Regression: days used to silently share a date when the previous day's
    stops ended before 4pm — a decision made before dinner/reco stops are
    injected (which happens later, in main.py), so it systematically
    misjudged days that would later fill out as 'light'. A 3-day trip could
    collapse onto a single calendar date. Every day must always get its own
    date from ctx.travel_dates, regardless of how early its stops end."""
    stops = [
        make_stop(place_id="p1", category="museum", start_offset_min=9 * 60, duration_min=60),   # day 1, ends 10am
        make_stop(place_id="p2", category="cafe", start_offset_min=9 * 60, duration_min=30),      # day 2, ends 9:30am
        make_stop(place_id="p3", category="gallery", start_offset_min=9 * 60, duration_min=45),   # day 3, ends 9:45am
    ]
    ctx = make_ctx(travel_dates=["2026-06-01", "2026-06-02", "2026-06-03"])

    days = builder._split_into_days(stops, ctx)

    assert [d.date for d in days] == ["2026-06-01", "2026-06-02", "2026-06-03"]


def test_split_into_days_distributes_stops_one_per_day_for_equal_counts():
    stops = [
        make_stop(place_id="p1", category="museum"),
        make_stop(place_id="p2", category="cafe"),
        make_stop(place_id="p3", category="gallery"),
    ]
    ctx = make_ctx(travel_dates=["2026-06-01", "2026-06-02", "2026-06-03"])

    days = builder._split_into_days(stops, ctx)

    assert [len(d.stops) for d in days] == [1, 1, 1]


def test_walkability_advisory_silent_when_score_not_low():
    stops = [make_stop(place_id=f"p{i}", category="museum") for i in range(3)]
    day = EngineDay(date="2026-06-01", stops=stops)
    ctx = make_ctx()
    ctx.city.culture["walkability_score"] = "moderate"

    messages = builder._walkability_advisory([day], ctx)

    assert not any(m.type == "walkability" for m in messages)
