import pytest
from engine.reco_engine import RecoSignal, _archetype_group

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
