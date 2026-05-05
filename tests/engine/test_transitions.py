import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.conftest import make_stop, make_ctx
from engine import transitions


def test_close_stops_get_walk_mode():
    """200m apart → walk."""
    a = make_stop(place_id="a", lat=35.6762, lon=139.6503)
    b = make_stop(place_id="b", lat=35.6780, lon=139.6503)  # ~200m north
    ctx = make_ctx()
    result, _ = transitions.score([a, b], ctx)
    assert result[0].transition_to_next == "walk"


def test_far_stops_get_transit_mode():
    """10km apart → transit."""
    a = make_stop(place_id="a", lat=35.6762, lon=139.6503)
    b = make_stop(place_id="b", lat=35.7762, lon=139.6503)  # ~11km north
    ctx = make_ctx()
    result, _ = transitions.score([a, b], ctx)
    assert result[0].transition_to_next in ("transit", "rideshare")


def test_high_walk_affinity_non_walk_emits_message():
    """Persona loves walking (w_walk_affinity=0.9) but mode is transit → emit message."""
    a = make_stop(place_id="a", lat=35.6762, lon=139.6503)
    b = make_stop(place_id="b", lat=35.7762, lon=139.6503)  # far → transit
    ctx = make_ctx(persona_weights={"w_walk_affinity": 0.9})
    result, messages = transitions.score([a, b], ctx)
    assert any(m.type == "transit" for m in messages)


def test_last_stop_has_no_transition():
    """Last stop transition_to_next stays None."""
    stops = [make_stop(place_id="p1"), make_stop(place_id="p2")]
    ctx = make_ctx()
    result, _ = transitions.score(stops, ctx)
    assert result[-1].transition_to_next is None
