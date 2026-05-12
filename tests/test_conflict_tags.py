import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from engine.tags import compute_tags
from engine.types import EngineStop, EngineContext
from city.data_model import CityData, Neighborhood

def make_stop(lat=35.67, lon=139.65, scheduled_time="13:00", category="park", neighborhood="Shibuya"):
    return EngineStop(
        place_id="p1", name="Test Place", lat=lat, lon=lon,
        category=category, duration_min=60,
        opening_hours=[], price_level=None, rating=4.0,
        neighborhood=neighborhood, is_user_added=True,
        scheduled_time=scheduled_time,
    )

def make_ctx(hot_months=None, timezone_diff=0, travel_dates=None, start_date="2026-06-01"):
    city = CityData(
        id="tokyo", name="Tokyo", tier=1, center=(35.67, 139.65), timezone="Asia/Tokyo",
        climate={"hot_months": hot_months or []},
        movement={}, culture={},
        neighborhoods=[Neighborhood(id="shibuya", name="Shibuya", center=(35.67, 139.65), polygon=[], best_times={}, crowd_index={})],
        landmark_anchors=[], insert_candidates=[], scenic_routes=[], transit_edges=[],
        engine_modifiers={}, hidden_gems=[],
    )
    return EngineContext(
        persona={"archetype": "wanderer", "arrival_time": "09:00", "day_buffer_min": 30, "timezone_offset": timezone_diff},
        city=city,
        travel_dates=travel_dates or [start_date],
        weather=None,
    )

def test_beat_the_heat_tag_applied_at_noon():
    stop = make_stop(scheduled_time="13:00", category="park")
    ctx = make_ctx(hot_months=[6], start_date="2026-06-01")
    tags = compute_tags(stop, ctx, is_first_day=False)
    assert "☀️ Beat the heat" in tags

def test_no_heat_tag_outside_hot_season():
    stop = make_stop(scheduled_time="13:00", category="park")
    ctx = make_ctx(hot_months=[12], start_date="2026-06-01")
    tags = compute_tags(stop, ctx, is_first_day=False)
    assert "☀️ Beat the heat" not in tags

def test_no_heat_tag_for_morning_stop():
    stop = make_stop(scheduled_time="09:00", category="park")
    ctx = make_ctx(hot_months=[6], start_date="2026-06-01")
    tags = compute_tags(stop, ctx, is_first_day=False)
    assert "☀️ Beat the heat" not in tags

def test_jet_lag_tag_on_first_day_large_diff():
    stop = make_stop(scheduled_time="10:00")
    ctx = make_ctx(timezone_diff=6, start_date="2026-06-01")
    tags = compute_tags(stop, ctx, is_first_day=True)
    assert "✈️ Light — jet lag day" in tags

def test_no_jet_lag_tag_on_subsequent_days():
    stop = make_stop(scheduled_time="10:00")
    ctx = make_ctx(timezone_diff=6, start_date="2026-06-01")
    tags = compute_tags(stop, ctx, is_first_day=False)
    assert "✈️ Light — jet lag day" not in tags

def test_no_jet_lag_tag_small_diff():
    stop = make_stop(scheduled_time="10:00")
    ctx = make_ctx(timezone_diff=3, start_date="2026-06-01")
    tags = compute_tags(stop, ctx, is_first_day=True)
    assert "✈️ Light — jet lag day" not in tags

def test_max_two_tags():
    stop = make_stop(scheduled_time="13:00", category="park")
    ctx = make_ctx(hot_months=[6], timezone_diff=6, start_date="2026-06-01")
    tags = compute_tags(stop, ctx, is_first_day=True)
    assert len(tags) <= 2
