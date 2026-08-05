"""main.py's message dedup step keeps the first occurrence per (type, stop_id).
That's correct for insert/swap/resequence messages, which the pipeline can
genuinely emit twice for the same real stop. But weather messages are built
in a single pass over outdoor stops (engine/builder.py::_weather_advisories) —
never duplicated for a real stop — so applying the same key-based collapse to
them only causes harm: any two stops that happen to share a falsy/duplicate
place_id (e.g. stops without a resolved Google place_id both falling back to
stop_id=None) silently lose all but one stop's weather advisory.
"""
from engine.types import EngineMessage
from main import _dedupe_engine_messages


def _msg(type_, stop_id, what="x"):
    return EngineMessage(
        type=type_, what=what, why="y", consequence="z",
        dismissable=True, undo_key=None, stop_id=stop_id,
    )


def test_dedupes_insert_messages_sharing_a_stop_id():
    messages = [_msg("insert", "place_1", "first"), _msg("insert", "place_1", "second")]
    result = _dedupe_engine_messages(messages)
    assert len(result) == 1
    assert result[0].what == "first"


def test_keeps_all_weather_messages_even_with_colliding_stop_ids():
    messages = [
        _msg("weather", None, "stop A is hot"),
        _msg("weather", None, "stop B is hot"),
    ]
    result = _dedupe_engine_messages(messages)
    assert len(result) == 2


def test_keeps_all_weather_messages_with_distinct_stop_ids():
    messages = [_msg("weather", "place_1"), _msg("weather", "place_2")]
    result = _dedupe_engine_messages(messages)
    assert len(result) == 2


def test_keeps_all_alcohol_and_ramadan_messages_even_with_colliding_stop_ids():
    """Same reasoning as weather — alcohol/ramadan are emitted once per
    qualifying stop by construction, never duplicated for a real stop."""
    messages = [_msg("alcohol", None), _msg("alcohol", None), _msg("ramadan", None)]
    result = _dedupe_engine_messages(messages)
    assert len(result) == 3


def test_keeps_all_nightlife_and_walkability_messages_across_days():
    """Day-level messages (stop_id=None) fire once per eligible day — a
    multi-day trip can legitimately emit several with the same falsy
    stop_id, and none of them should be collapsed away."""
    messages = [
        _msg("nightlife", None, "day 1"), _msg("nightlife", None, "day 2"),
        _msg("walkability", None, "day 1"), _msg("walkability", None, "day 3"),
    ]
    result = _dedupe_engine_messages(messages)
    assert len(result) == 4
