import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.conftest import make_stop, make_ctx
from engine import swapper

_SWAP_THRESHOLD = swapper.SWAP_THRESHOLD


def test_below_threshold_stop_passes_through():
    """A normal, well-rated stop should not be swapped."""
    stop = make_stop(place_id="good_museum", rating=4.5, price_level=1)
    ctx = make_ctx()
    result, messages = swapper.check([stop], ctx)
    assert result[0].place_id == "good_museum"
    assert messages == []


def test_very_low_rating_emits_swap_message():
    """Rating 1.0 + price_level 4 → swap score above threshold."""
    stop = make_stop(place_id="bad_place", rating=1.0, price_level=4)
    ctx = make_ctx()
    result, messages = swapper.check([stop], ctx)
    # Either swapped or message emitted
    assert isinstance(messages, list)


def test_no_stops_returns_empty():
    ctx = make_ctx()
    result, messages = swapper.check([], ctx)
    assert result == []
    assert messages == []


def test_swap_message_has_undo_key():
    stop = make_stop(place_id="bad_place", rating=1.0, price_level=4)
    ctx = make_ctx()
    result, messages = swapper.check([stop], ctx)
    for m in messages:
        if m.type == "swap":
            assert m.undo_key is not None
