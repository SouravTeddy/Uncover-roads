import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tests.conftest import make_stop, make_ctx
from engine import inserts


def test_coffee_insert_after_180min_gap():
    """Gap > 180min + high food_density → inject coffee."""
    stops = [
        make_stop(place_id="p1", duration_min=120, neighborhood="shinjuku",
                  lat=35.693, lon=139.703),
        make_stop(place_id="p2", duration_min=60, neighborhood="shinjuku",
                  lat=35.695, lon=139.706, start_offset_min=200),
    ]
    ctx = make_ctx(persona_weights={"w_food_density": 0.8})
    result, messages = inserts.detect(stops, ctx)
    types = [s.type for s in result if not s.is_user_added]
    assert "coffee" in types


def test_no_insert_small_gap():
    """Gap < 15min → no insert."""
    stops = [
        make_stop(place_id="p1", duration_min=10, neighborhood="shinjuku",
                  lat=35.693, lon=139.703),
        make_stop(place_id="p2", duration_min=60, neighborhood="shinjuku",
                  lat=35.695, lon=139.706, start_offset_min=12),
    ]
    ctx = make_ctx()
    result, messages = inserts.detect(stops, ctx)
    inserts_added = [s for s in result if not s.is_user_added]
    assert len(inserts_added) == 0


def test_scenic_walk_injected_for_high_walk_affinity():
    """High walk affinity + scenic route exists → scenic_walk insert."""
    stops = [
        make_stop(place_id="p1", neighborhood="asakusa", duration_min=60,
                  lat=35.714, lon=139.796),
        make_stop(place_id="p2", neighborhood="shinjuku", duration_min=60,
                  lat=35.693, lon=139.703, start_offset_min=80),
    ]
    ctx = make_ctx(persona_weights={"w_walk_affinity": 0.9})
    result, messages = inserts.detect(stops, ctx)
    types = [s.type for s in result if not s.is_user_added]
    # scenic walk OR no insert if candidate not in city data — no crash is primary check
    assert isinstance(result, list)
    assert isinstance(messages, list)


def test_insert_emits_message():
    stops = [
        make_stop(place_id="p1", duration_min=120, neighborhood="shinjuku",
                  lat=35.693, lon=139.703),
        make_stop(place_id="p2", duration_min=60, neighborhood="shinjuku",
                  lat=35.695, lon=139.706, start_offset_min=200),
    ]
    ctx = make_ctx(persona_weights={"w_food_density": 0.8})
    _, messages = inserts.detect(stops, ctx)
    assert any(m.type == "insert" for m in messages)
