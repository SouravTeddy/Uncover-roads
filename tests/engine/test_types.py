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


def test_engine_stop_landmark_category_is_outdoor():
    """'landmark' covers monuments/plazas — genuinely weather-exposed, unlike
    the broader 'tourism' catch-all which also includes indoor museums."""
    stop = EngineStop(
        place_id="p3", name="Gateway Arch", lat=38.62, lon=-90.18,
        category="landmark", duration_min=45, opening_hours=[],
        price_level=0, rating=4.7, neighborhood="downtown",
        is_user_added=True,
    )
    assert stop.outdoor is True


def test_engine_stop_tourism_category_is_not_outdoor():
    """'tourism' is left alone — it mixes indoor (museums) and outdoor
    (mosque courtyards, viewpoints) places, so category alone can't tell."""
    stop = EngineStop(
        place_id="p4", name="Jumeirah Mosque", lat=25.23, lon=55.26,
        category="tourism", duration_min=45, opening_hours=[],
        price_level=0, rating=4.6, neighborhood="jumeirah",
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


def test_engine_message_accepts_stop_id():
    msg = EngineMessage(
        type="insert", what="Added Cafe Azul",
        why="Rest break needed", consequence="Adds 30 min",
        dismissable=True, undo_key=None, stop_id="place_abc",
    )
    assert msg.stop_id == "place_abc"

def test_engine_message_stop_id_defaults_none():
    msg = EngineMessage(
        type="resequence", what="Reordered",
        why="Efficiency", consequence="Less walking",
        dismissable=True, undo_key=None,
    )
    assert msg.stop_id is None
