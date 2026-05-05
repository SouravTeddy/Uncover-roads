"""Signal processor: deterministic keyword clustering for city intelligence sync.

No LLM — keyword matching only. classify_stage() uses hard thresholds from spec.
"""
from __future__ import annotations

CROWD_SIGNALS = {"crowded", "packed", "tourist trap", "queues", "overrated", "busy", "jam-packed"}
HIDDEN_GEM_SIGNALS = {"hidden gem", "locals only", "off the beaten path", "underrated", "secret spot"}
QUALITY_DECLINE_SIGNALS = {"used to be better", "gone downhill", "disappointed", "not what it was"}
VIRAL_SIGNALS = {"tiktok", "instagram", "went viral", "influencer", "trending", "social media"}


def extract_signals(reviews: list[str], base_review_count: int = 0) -> dict:
    """Extract signal ratios from a list of review text strings."""
    total = max(len(reviews), 1)
    crowd_count = sum(
        1 for r in reviews
        if any(kw in r.lower() for kw in CROWD_SIGNALS)
    )
    decline_count = sum(
        1 for r in reviews
        if any(kw in r.lower() for kw in QUALITY_DECLINE_SIGNALS)
    )
    viral_count = sum(
        1 for r in reviews
        if any(kw in r.lower() for kw in VIRAL_SIGNALS)
    )
    return {
        "review_count": base_review_count or total,
        "crowd_mention_ratio": crowd_count / total,
        "rating_trend": 0.0,    # computed externally from rating history
        "velocity_ratio": 1.0,  # computed externally from review velocity
        "viral_detected": viral_count > 0,
        "quality_decline_detected": decline_count / total > 0.1,
    }


def classify_stage(signals: dict) -> str:
    rc = signals["review_count"]
    crowd = signals["crowd_mention_ratio"]
    trend = signals["rating_trend"]
    vel = signals["velocity_ratio"]

    if rc < 20:
        return "unknown"
    if rc < 200 and crowd < 0.05:
        return "hidden_gem"
    if rc < 1000 and crowd < 0.20:
        return "rising"
    if crowd >= 0.50 or trend < -0.3:
        if trend < -0.5 and vel < 0.5:
            return "declining"
        return "oversaturated"
    if rc >= 1000 and crowd < 0.50:
        return "mainstream"
    return "mainstream"


def needs_human_review(signals: dict, stage: str) -> bool:
    return (
        stage in ("declining", "oversaturated")
        or bool(signals.get("viral_detected"))
        or bool(signals.get("quality_decline_detected"))
    )
