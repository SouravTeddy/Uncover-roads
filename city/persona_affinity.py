"""Derives persona affinity scores from Google Places primary type.

Used when building insert_candidates — maps a place category to
how strongly each persona archetype would enjoy it.

Scores are in [0.0, 1.0]. Unknown types return NEUTRAL (all 0.5).
Post-launch: override with behavior data (pin_saved/pin_dismissed signals).
"""

ARCHETYPES = ["wanderer", "voyager", "epicurean", "historian", "pulse", "slowtraveller", "explorer"]

NEUTRAL: dict[str, float] = {a: 0.5 for a in ARCHETYPES}

_AFFINITY: dict[str, dict[str, float]] = {
    "museum": {
        "wanderer": 0.5, "voyager": 0.7, "epicurean": 0.3,
        "historian": 0.95, "pulse": 0.2, "slowtraveller": 0.5, "explorer": 0.8,
    },
    "art_gallery": {
        "wanderer": 0.7, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.8, "pulse": 0.3, "slowtraveller": 0.7, "explorer": 0.7,
    },
    "cafe": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.4, "pulse": 0.4, "slowtraveller": 0.9, "explorer": 0.6,
    },
    "coffee_shop": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.4, "pulse": 0.4, "slowtraveller": 0.9, "explorer": 0.6,
    },
    "restaurant": {
        "wanderer": 0.6, "voyager": 0.8, "epicurean": 0.95,
        "historian": 0.3, "pulse": 0.5, "slowtraveller": 0.6, "explorer": 0.7,
    },
    "food": {
        "wanderer": 0.7, "voyager": 0.7, "epicurean": 0.9,
        "historian": 0.3, "pulse": 0.4, "slowtraveller": 0.7, "explorer": 0.7,
    },
    "market": {
        "wanderer": 0.95, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.5, "pulse": 0.5, "slowtraveller": 0.7, "explorer": 0.7,
    },
    "park": {
        "wanderer": 0.9, "voyager": 0.5, "epicurean": 0.4,
        "historian": 0.3, "pulse": 0.2, "slowtraveller": 0.9, "explorer": 0.7,
    },
    "tourist_attraction": {
        "wanderer": 0.7, "voyager": 0.85, "epicurean": 0.4,
        "historian": 0.8, "pulse": 0.4, "slowtraveller": 0.4, "explorer": 0.9,
    },
    "point_of_interest": {
        "wanderer": 0.8, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.7, "pulse": 0.4, "slowtraveller": 0.5, "explorer": 0.8,
    },
    "bar": {
        "wanderer": 0.6, "voyager": 0.5, "epicurean": 0.7,
        "historian": 0.2, "pulse": 0.85, "slowtraveller": 0.5, "explorer": 0.7,
    },
    "night_club": {
        "wanderer": 0.3, "voyager": 0.3, "epicurean": 0.4,
        "historian": 0.1, "pulse": 1.0, "slowtraveller": 0.1, "explorer": 0.6,
    },
    "beach": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.4,
        "historian": 0.2, "pulse": 0.6, "slowtraveller": 0.85, "explorer": 0.7,
    },
    "natural_feature": {
        "wanderer": 0.9, "voyager": 0.6, "epicurean": 0.2,
        "historian": 0.3, "pulse": 0.2, "slowtraveller": 0.8, "explorer": 0.9,
    },
    "viewpoint": {
        "wanderer": 1.0, "voyager": 0.7, "epicurean": 0.3,
        "historian": 0.5, "pulse": 0.4, "slowtraveller": 0.8, "explorer": 0.8,
    },
    "place_of_worship": {
        "wanderer": 0.6, "voyager": 0.6, "epicurean": 0.2,
        "historian": 0.9, "pulse": 0.1, "slowtraveller": 0.6, "explorer": 0.6,
    },
    "spa": {
        "wanderer": 0.3, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.1, "pulse": 0.2, "slowtraveller": 0.9, "explorer": 0.4,
    },
    "shopping_mall": {
        "wanderer": 0.4, "voyager": 0.4, "epicurean": 0.5,
        "historian": 0.1, "pulse": 0.6, "slowtraveller": 0.3, "explorer": 0.5,
    },
}


def get_persona_affinity(google_type: str) -> dict[str, float]:
    """Return persona affinity scores for a Google Places primary type."""
    return dict(_AFFINITY.get(google_type, NEUTRAL))
