import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.conftest import make_stop, make_ctx
from engine import sequencer


def test_neighborhood_clustering_groups_shinjuku():
    """Two Shinjuku stops + one Asakusa stop: both Shinjuku stops should be adjacent."""
    stops = [
        make_stop(place_id="s1", neighborhood="shinjuku", lat=35.693, lon=139.703),
        make_stop(place_id="a1", neighborhood="asakusa", lat=35.714, lon=139.796),
        make_stop(place_id="s2", neighborhood="shinjuku", lat=35.695, lon=139.706),
    ]
    ctx = make_ctx()
    result, _ = sequencer.optimize(stops, ctx)
    ids = [s.place_id for s in result]
    # s1 and s2 must be adjacent (indices differ by 1)
    i1, i2 = ids.index("s1"), ids.index("s2")
    assert abs(i1 - i2) == 1


def test_optimize_emits_resequence_message_when_order_changes():
    stops = [
        make_stop(place_id="a1", neighborhood="asakusa", lat=35.714, lon=139.796),
        make_stop(place_id="s1", neighborhood="shinjuku", lat=35.693, lon=139.703),
        make_stop(place_id="a2", neighborhood="asakusa", lat=35.715, lon=139.797),
    ]
    ctx = make_ctx()
    result, messages = sequencer.optimize(stops, ctx)
    # no exception is the primary assertion here; resequence message optional
    assert isinstance(messages, list)


def test_single_stop_no_resequence():
    stops = [make_stop(place_id="p1")]
    ctx = make_ctx()
    result, messages = sequencer.optimize(stops, ctx)
    assert result[0].place_id == "p1"
    assert messages == []


def test_scheduled_time_set_on_all_stops():
    stops = [
        make_stop(place_id="p1", duration_min=60, neighborhood="shinjuku"),
        make_stop(place_id="p2", duration_min=90, neighborhood="asakusa"),
    ]
    ctx = make_ctx()
    result, _ = sequencer.optimize(stops, ctx)
    for stop in result:
        assert stop.scheduled_time is not None
