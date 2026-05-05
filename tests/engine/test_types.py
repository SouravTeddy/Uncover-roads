from engine.types import EngineStop, EngineContext, EngineMessage, EngineDay, EngineResult


def test_engine_stop_outdoor_derived_from_category():
    stop = EngineStop(
        place_id="p1", name="Yoyogi Park", lat=35.67, lon=139.69,
        category="park", duration_min=60, opening_hours=[],
        price_level=0, rating=4.5, neighborhood="shibuya",
        is_user_added=True,
    )
    assert stop.outdoor is True


def test_engine_stop_non_outdoor_category():
    stop = EngineStop(
        place_id="p2", name="Shinjuku Museum", lat=35.68, lon=139.70,
        category="museum", duration_min=90, opening_hours=[],
        price_level=2, rating=4.2, neighborhood="shinjuku",
        is_user_added=True,
    )
    assert stop.outdoor is False


def test_engine_message_fields():
    msg = EngineMessage(
        type="swap", what="Swapped X for Y", why="X closes at 17:00",
        consequence="You'll visit Y at 17:15 instead.", dismissable=True, undo_key="swap_p1"
    )
    assert msg.type == "swap"
    assert msg.undo_key == "swap_p1"


def test_engine_result_fields():
    result = EngineResult(days=[], messages=[], generation_id="abc123", recommendations=None)
    assert result.generation_id == "abc123"
    assert result.recommendations is None
