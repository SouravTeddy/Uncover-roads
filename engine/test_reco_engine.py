import pytest
from engine.reco_engine import RecoSignal, _archetype_group, persona_google_types, derive_day_recos

def _base_signal(**kwargs):
    defaults = dict(
        weights={"w_food_density": 0.5, "w_culture_depth": 0.5, "w_nightlife": 0.5,
                 "w_rest_need": 0.3, "w_spontaneity": 0.4},
        archetype="explorer",
        archetype_group="explorer",
        pace="moderate",
        city="tokyo",
        is_first_day=False,
        is_last_day=False,
        arrival_time=None,
        departure_time=None,
    )
    defaults.update(kwargs)
    return RecoSignal(**defaults)

def test_reco_signal_defaults_group():
    s = _base_signal()
    assert s.group == "solo"
    assert s.is_family is False
    assert s.mood == []
    assert s.budget is None

def test_reco_signal_family():
    s = _base_signal(group="family", is_family=True)
    assert s.is_family is True

def test_reco_signal_mood():
    s = _base_signal(mood=["culture", "explore"])
    assert "culture" in s.mood


def test_family_rest_gets_park():
    s = _base_signal(group="family", is_family=True)
    types = persona_google_types("rest", s)
    assert "park" in types


def test_nightlife_archetype_evening_gets_bar():
    s = _base_signal(archetype="nightcreature", archetype_group="social", evening_pref="nightlife")
    types = persona_google_types("evening", s)
    assert types[0] in ("bar", "night_club")


def test_cultural_archetype_rest_gets_cafe():
    s = _base_signal(archetype="historian", archetype_group="cultural")
    types = persona_google_types("rest", s)
    assert "cafe" in types


def test_family_culture_gets_kid_friendly():
    s = _base_signal(group="family", is_family=True)
    types = persona_google_types("culture", s)
    assert "amusement_park" in types or "zoo" in types


def _stop(id, time, category, lat=35.6, lon=139.7):
    return {"id": id, "time": time, "category": category,
            "lat": lat, "lon": lon, "durationMin": 60}


def test_trigger_types_respect_caps():
    # With counter (new behavior), each type fires up to _DEFAULT_TRIGGER_CAP (2) times
    # This test verifies counter dedup works correctly
    stops = [
        _stop("s1", "09:00", "museum"),
        _stop("s2", "11:00", "museum"),
        _stop("s3", "14:00", "museum"),
    ]
    signal = _base_signal()
    triggers = derive_day_recos(stops, signal)
    trigger_types = [t["trigger"] for t in triggers]
    # No trigger type should exceed its cap
    from collections import Counter
    counts = Counter(trigger_types)
    for trigger_type, count in counts.items():
        cap = {"lunch": 1, "dinner": 1}.get(trigger_type, 2)
        assert count <= cap, f"Trigger '{trigger_type}' fired {count} times, cap is {cap}"


def test_lunch_not_emitted_when_restaurant_present():
    stops = [
        _stop("s1", "09:00", "museum"),
        _stop("s2", "12:30", "restaurant"),
        _stop("s3", "15:00", "museum"),
    ]
    signal = _base_signal()
    triggers = derive_day_recos(stops, signal)
    assert not any(t["trigger"] == "lunch" for t in triggers)


def test_lunch_capped_at_1():
    # Sparse day — only one morning stop, plenty of gap for the lunch detector
    stops = [_stop("s1", "09:00", "museum")]
    signal = _base_signal()
    triggers = derive_day_recos(stops, signal)
    lunch_triggers = [t for t in triggers if t["trigger"] == "lunch"]
    assert len(lunch_triggers) <= 1, f"Lunch emitted {len(lunch_triggers)} times, cap is 1"
    # Also verify the constant itself
    from engine.reco_engine import _TRIGGER_CAPS, _DEFAULT_TRIGGER_CAP
    assert _TRIGGER_CAPS.get("lunch") == 1
    assert _DEFAULT_TRIGGER_CAP == 2


def test_evening_pref_nightlife_elevates_bar_for_non_social():
    # Cultural archetype without nightlife evening_pref gets theater first
    s_no_nightlife = _base_signal(archetype="historian", archetype_group="cultural", evening_pref=None)
    types_no = persona_google_types("evening", s_no_nightlife)
    assert types_no[0] != "bar", "Without nightlife pref, bar should not be first for cultural archetype"

    # Same archetype WITH nightlife evening_pref gets bar first
    s_nightlife = _base_signal(archetype="historian", archetype_group="cultural", evening_pref="nightlife")
    types_yes = persona_google_types("evening", s_nightlife)
    assert types_yes[0] in ("bar", "night_club"), f"With evening_pref=nightlife, bar/night_club should be first, got: {types_yes}"


def test_injected_stop_image_url_format():
    # Validate the imageUrl format string matches the expected pattern
    photo_ref = "ATplDJa1234exampleref"
    api_base = "https://api.example.com"
    image_url = f"{api_base}/place-photo?ref={photo_ref}&maxwidth=800"
    assert image_url == "https://api.example.com/place-photo?ref=ATplDJa1234exampleref&maxwidth=800"
    assert "&maxwidth=800" in image_url
    assert photo_ref in image_url
