from main import _TRIGGER_TYPES, _TRIGGER_RADIUS

def test_weather_trigger_has_indoor_types():
    types = _TRIGGER_TYPES.get("weather", [])
    assert "museum" in types or "cafe" in types, "weather trigger should suggest indoor alternatives"

def test_closing_conflict_trigger_has_attraction_types():
    types = _TRIGGER_TYPES.get("closing_conflict", [])
    assert len(types) >= 2, "closing_conflict needs at least 2 place types"

def test_walking_gap_trigger_has_rest_types():
    types = _TRIGGER_TYPES.get("walking_gap", [])
    assert "cafe" in types or "restaurant" in types

def test_crowd_peak_trigger_exists():
    assert "crowd_peak" in _TRIGGER_TYPES

def test_all_triggers_have_radius():
    for trigger in _TRIGGER_TYPES:
        assert trigger in _TRIGGER_RADIUS, f"trigger '{trigger}' missing from _TRIGGER_RADIUS"
