import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.conftest import make_stop, make_ctx
from engine import constraints


def test_closing_time_conflict_triggers_swap():
    """Stop closing at 17:00, arrival at 16:45 — engine should swap it out."""
    stop = make_stop(place_id="senso_ji", name="Senso-ji", closing_hour=17)
    ctx = make_ctx(arrival_time="16:45")
    result, messages = constraints.resolve([stop], ctx)
    # The conflicting stop is swapped out (place_id changes) or a swap message is emitted
    assert result[0].place_id != "senso_ji" or any(m.type == "swap" for m in messages)


def test_closing_time_no_conflict_passes_through():
    """Stop closing at 21:00, arrival at 10:00 — no swap needed."""
    stop = make_stop(place_id="museum_1", closing_hour=21)
    ctx = make_ctx(arrival_time="10:00")
    result, messages = constraints.resolve([stop], ctx)
    assert result[0].place_id == "museum_1"
    assert not any(m.type == "swap" for m in messages)


def test_outdoor_heavy_rain_emits_weather_message():
    stop = make_stop(category="park", outdoor=True)
    ctx = make_ctx(weather={"rain_intensity": "heavy"})
    result, messages = constraints.resolve([stop], ctx)
    assert any(m.type == "weather" for m in messages)


def test_outdoor_no_rain_no_weather_message():
    stop = make_stop(category="park", outdoor=True)
    ctx = make_ctx(weather={"rain_intensity": "none"})
    result, messages = constraints.resolve([stop], ctx)
    assert not any(m.type == "weather" for m in messages)


def test_no_conflicts_returns_stops_unchanged():
    stops = [make_stop(place_id="p1"), make_stop(place_id="p2", lat=35.68, lon=139.71)]
    ctx = make_ctx()
    result, messages = constraints.resolve(stops, ctx)
    assert [s.place_id for s in result] == ["p1", "p2"]
    assert messages == []
