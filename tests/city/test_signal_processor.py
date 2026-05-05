import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from city.signal_processor import classify_stage, extract_signals, needs_human_review


def test_classify_hidden_gem():
    signals = {"review_count": 85, "crowd_mention_ratio": 0.02,
               "rating_trend": 0.1, "velocity_ratio": 1.2,
               "viral_detected": False, "quality_decline_detected": False}
    assert classify_stage(signals) == "hidden_gem"


def test_classify_rising():
    signals = {"review_count": 400, "crowd_mention_ratio": 0.10,
               "rating_trend": 0.05, "velocity_ratio": 1.1,
               "viral_detected": False, "quality_decline_detected": False}
    assert classify_stage(signals) == "rising"


def test_classify_mainstream():
    signals = {"review_count": 1500, "crowd_mention_ratio": 0.30,
               "rating_trend": 0.0, "velocity_ratio": 1.0,
               "viral_detected": False, "quality_decline_detected": False}
    assert classify_stage(signals) == "mainstream"


def test_classify_oversaturated():
    signals = {"review_count": 2000, "crowd_mention_ratio": 0.65,
               "rating_trend": -0.4, "velocity_ratio": 0.8,
               "viral_detected": False, "quality_decline_detected": False}
    assert classify_stage(signals) == "oversaturated"


def test_classify_declining():
    signals = {"review_count": 1200, "crowd_mention_ratio": 0.25,
               "rating_trend": -0.6, "velocity_ratio": 0.4,
               "viral_detected": False, "quality_decline_detected": False}
    assert classify_stage(signals) == "declining"


def test_classify_unknown_low_review_count():
    signals = {"review_count": 5, "crowd_mention_ratio": 0.0,
               "rating_trend": 0.0, "velocity_ratio": 1.0,
               "viral_detected": False, "quality_decline_detected": False}
    assert classify_stage(signals) == "unknown"


def test_needs_human_review_declining():
    signals = {"review_count": 1200, "crowd_mention_ratio": 0.25,
               "rating_trend": -0.6, "velocity_ratio": 0.4,
               "viral_detected": False, "quality_decline_detected": False}
    assert needs_human_review(signals, "declining") is True


def test_needs_human_review_viral():
    signals = {"review_count": 500, "crowd_mention_ratio": 0.1,
               "rating_trend": 0.2, "velocity_ratio": 5.0,
               "viral_detected": True, "quality_decline_detected": False}
    assert needs_human_review(signals, "rising") is True


def test_needs_human_review_normal():
    signals = {"review_count": 600, "crowd_mention_ratio": 0.1,
               "rating_trend": 0.0, "velocity_ratio": 1.0,
               "viral_detected": False, "quality_decline_detected": False}
    assert needs_human_review(signals, "mainstream") is False


def test_extract_signals_counts_crowd_keywords():
    reviews = ["Very crowded on weekends", "Packed with tourists", "Lovely place", "Tourist trap"]
    signals = extract_signals(reviews, base_review_count=4)
    assert signals["crowd_mention_ratio"] > 0.0
    assert signals["review_count"] == 4
