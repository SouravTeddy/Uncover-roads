import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _badge(stage: str, velocity_ratio: float, crowd_ratio: float):
    """Replicate the _badge() logic from main.py for unit testing."""
    if stage == "rising" and velocity_ratio >= 2.0:
        return "trending", f"Reviews up {int(velocity_ratio)}x this month"
    if stage == "rising" and crowd_ratio >= 0.4:
        return "getting_busy", "Getting busy — locals say go early"
    if stage == "hidden_gem":
        return "hidden_gem", "Still off the tourist trail"
    return None, None


def test_trending_badge_requires_rising_and_velocity_2x():
    badge, reason = _badge("rising", 2.0, 0.0)
    assert badge == "trending"
    assert "2x" in reason


def test_trending_badge_not_applied_when_velocity_below_2():
    badge, _ = _badge("rising", 1.9, 0.0)
    assert badge != "trending"


def test_getting_busy_badge_requires_rising_and_crowd_04():
    badge, _ = _badge("rising", 1.0, 0.4)
    assert badge == "getting_busy"


def test_getting_busy_not_applied_when_crowd_below_04():
    badge, _ = _badge("rising", 1.0, 0.39)
    assert badge != "getting_busy"


def test_trending_takes_priority_over_getting_busy():
    badge, _ = _badge("rising", 2.5, 0.5)
    assert badge == "trending"


def test_hidden_gem_badge():
    badge, reason = _badge("hidden_gem", 1.0, 0.0)
    assert badge == "hidden_gem"
    assert "tourist" in reason.lower()


def test_mainstream_returns_none():
    badge, reason = _badge("mainstream", 1.0, 0.0)
    assert badge is None
    assert reason is None
