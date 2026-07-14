import pytest
from engine.reco_engine import RecoSignal, _archetype_group, persona_google_types

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


def test_evening_pref_nightlife_elevates_bar_for_non_social():
    # Cultural archetype without nightlife evening_pref gets theater first
    s_no_nightlife = _base_signal(archetype="historian", archetype_group="cultural", evening_pref=None)
    types_no = persona_google_types("evening", s_no_nightlife)
    assert types_no[0] != "bar", "Without nightlife pref, bar should not be first for cultural archetype"

    # Same archetype WITH nightlife evening_pref gets bar first
    s_nightlife = _base_signal(archetype="historian", archetype_group="cultural", evening_pref="nightlife")
    types_yes = persona_google_types("evening", s_nightlife)
    assert types_yes[0] in ("bar", "night_club"), f"With evening_pref=nightlife, bar/night_club should be first, got: {types_yes}"
