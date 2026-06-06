import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import _parse_weekday_text

def test_parse_standard_hours():
    result = _parse_weekday_text(["Monday: 9:00 AM – 9:00 PM"])
    assert result == [{"day": 0, "open_min": 540, "close_min": 1260}]

def test_parse_closed():
    result = _parse_weekday_text(["Tuesday: Closed"])
    assert result == []

def test_parse_24_hours():
    result = _parse_weekday_text(["Wednesday: Open 24 hours"])
    assert result == [{"day": 2, "open_min": 0, "close_min": 1440}]

def test_parse_midnight_close():
    # 12:00 AM as close = end of day
    result = _parse_weekday_text(["Thursday: 9:00 AM – 12:00 AM"])
    assert result == [{"day": 3, "open_min": 540, "close_min": 1440}]

def test_parse_multiple_days():
    result = _parse_weekday_text([
        "Monday: 9:00 AM – 6:00 PM",
        "Sunday: Closed",
    ])
    assert len(result) == 1
    assert result[0]["day"] == 0
    assert result[0]["close_min"] == 1080

def test_engine_stop_opening_hours_populated():
    """EngineStop.opening_hours is populated when weekday_text is in place_details."""
    from engine.types import EngineStop
    parsed = _parse_weekday_text(["Monday: 9:00 AM – 6:00 PM"])
    stop = EngineStop(
        place_id="abc", name="Test", lat=0.0, lon=0.0,
        category="museum", duration_min=60, opening_hours=parsed,
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
    )
    assert len(stop.opening_hours) == 1
    assert stop.opening_hours[0]["open_min"] == 540

def test_enforce_opening_hours_reorders_early_stop():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import enforce_opening_hours
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.4, "w_nightlife": 0.4, "w_efficiency": 0.5}},
        city=city, travel_dates=["2026-06-08"],  # Monday
    )
    # Museum opens at 10:00 (600 min), but scheduled at 09:00
    museum = EngineStop(
        place_id="museum1", name="Museum", lat=0.0, lon=0.0,
        category="museum", duration_min=60,
        opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
        scheduled_time="09:00", city="Test",
    )
    # Park opens at 07:00 — fine at 09:00
    park = EngineStop(
        place_id="park1", name="Park", lat=0.1, lon=0.0,
        category="park", duration_min=45,
        opening_hours=[{"day": 0, "open_min": 420, "close_min": 1200}],
        price_level=1, rating=4.3, neighborhood=None, is_user_added=True,
        scheduled_time="10:30", city="Test",
    )
    day = EngineDay(date="2026-06-08", stops=[museum, park])
    days, msgs, conflicted = enforce_opening_hours([day], ctx)
    # Museum should have been moved after park
    assert days[0].stops[0].name == "Park"
    assert days[0].stops[1].name == "Museum"
    assert len(msgs) == 1
    assert "Museum" in msgs[0].what
    assert len(conflicted) == 0

def test_enforce_opening_hours_flags_unfixable():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import enforce_opening_hours
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.4, "w_nightlife": 0.4, "w_efficiency": 0.5}},
        city=city, travel_dates=["2026-06-08"],
    )
    # Both stops open only at 10:00, both scheduled at 09:00
    museum = EngineStop(
        place_id="m1", name="Museum", lat=0.0, lon=0.0, category="museum",
        duration_min=60, opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
        scheduled_time="09:00", city="Test",
    )
    gallery = EngineStop(
        place_id="g1", name="Gallery", lat=0.1, lon=0.0, category="gallery",
        duration_min=60, opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.3, neighborhood=None, is_user_added=True,
        scheduled_time="10:00", city="Test",
    )
    day = EngineDay(date="2026-06-08", stops=[museum, gallery])
    days, msgs, conflicted = enforce_opening_hours([day], ctx)
    # Museum can't be moved — gallery is also closed at 09:00
    assert "m1" in conflicted

def test_apply_swapper_replaces_conflicted_stop():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import apply_swapper
    from city.data_model import CityData, InsertCandidate

    candidate = InsertCandidate(
        place_id="cafe1", name="Corner Café", lat=0.05, lon=0.05,
        type="coffee", time_cost_min=30,
        persona_affinity={"explorer": 0.8},
        trigger=None, time_of_day_match=["morning"],
    )
    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[candidate],
        scenic_routes=[], transit_edges=[], engine_modifiers={},
        landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {}},
        city=city, travel_dates=["2026-06-08"],
    )
    conflict_stop = EngineStop(
        place_id="m1", name="Closed Museum", lat=0.0, lon=0.0, category="museum",
        duration_min=60, opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
        scheduled_time="09:00", city="Test",
    )
    day = EngineDay(date="2026-06-08", stops=[conflict_stop])
    days, msgs = apply_swapper([day], ctx, conflicted={"m1"})
    assert days[0].stops[0].name == "Corner Café"
    assert len(msgs) == 1
    assert msgs[0].type == "swap"
    assert "Corner Café" in msgs[0].what

def test_apply_swapper_emits_advisory_when_no_alternative():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import apply_swapper
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[],  # no candidates
        scenic_routes=[], transit_edges=[], engine_modifiers={},
        landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {}},
        city=city, travel_dates=["2026-06-08"],
    )
    conflict_stop = EngineStop(
        place_id="m1", name="Lonely Museum", lat=0.0, lon=0.0, category="museum",
        duration_min=60, opening_hours=[], price_level=1, rating=4.5,
        neighborhood=None, is_user_added=True, scheduled_time="09:00", city="Test",
    )
    day = EngineDay(date="2026-06-08", stops=[conflict_stop])
    days, msgs = apply_swapper([day], ctx, conflicted={"m1"})
    assert days[0].stops[0].name == "Lonely Museum"  # kept in place
    assert len(msgs) == 1
    assert msgs[0].type == "advisory"

def test_opening_hours_backfill_for_inserted_stops():
    """_backfill_opening_hours fills opening_hours for stops not fetched pre-engine."""
    from main import _backfill_opening_hours
    from engine.types import EngineStop

    stop = EngineStop(
        place_id="ins1", name="Inserted Café", lat=0.0, lon=0.0,
        category="coffee", duration_min=30, opening_hours=[],
        price_level=1, rating=4.0, neighborhood=None, is_user_added=False,
        scheduled_time="09:30", city="Test",
    )
    place_details_map = {
        "ins1": {"opening_hours_parsed": [{"day": 0, "open_min": 480, "close_min": 1200}]}
    }
    _backfill_opening_hours([stop], place_details_map)
    assert len(stop.opening_hours) == 1
    assert stop.opening_hours[0]["open_min"] == 480

    # Negative case: stop with no entry in map retains empty hours
    stop2 = EngineStop(
        place_id="ins2", name="Unknown Spot", lat=0.0, lon=0.0,
        category="cafe", duration_min=30, opening_hours=[],
        price_level=1, rating=4.0, neighborhood=None, is_user_added=False,
        scheduled_time="10:00", city="Test",
    )
    _backfill_opening_hours([stop2], place_details_map)
    assert stop2.opening_hours == []


def test_split_into_days_uses_user_arrival_time_for_day1():
    from engine.types import EngineStop, EngineContext
    from engine.builder import _split_into_days
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "wanderer", "arrival_time": "10:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.5, "w_nightlife": 0.4, "w_efficiency": 0.3}},
        city=city,
        travel_dates=["2026-06-08", "2026-06-09"],
        user_arrival_time="14:00",  # afternoon arrival → 14:30 start
    )
    stops = [
        EngineStop(
            place_id=f"p{i}", name=f"Place{i}", lat=float(i)*0.01, lon=0.0,
            category="museum", duration_min=60, opening_hours=[],
            price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
            city="Test",
        )
        for i in range(4)
    ]
    days = _split_into_days(stops, ctx)
    # Day 1: should start at 14:30 (14:00 + 30 min)
    assert days[0].stops[0].scheduled_time == "14:30"
    # Day 2: should start at persona's 10:00
    assert days[1].stops[0].scheduled_time == "10:00"

def test_split_into_days_late_arrival_resets_to_0900():
    from engine.types import EngineStop, EngineContext
    from engine.builder import _split_into_days
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "wanderer", "arrival_time": "10:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.5, "w_nightlife": 0.4, "w_efficiency": 0.3}},
        city=city,
        travel_dates=["2026-06-08", "2026-06-09"],
        user_arrival_time="21:00",  # very late → reset to 09:00
    )
    stops = [
        EngineStop(
            place_id=f"p{i}", name=f"P{i}", lat=float(i)*0.01, lon=0.0,
            category="museum", duration_min=60, opening_hours=[],
            price_level=1, rating=4.5, neighborhood=None, is_user_added=True, city="Test",
        )
        for i in range(4)
    ]
    days = _split_into_days(stops, ctx)
    assert days[0].stops[0].scheduled_time == "09:00"
