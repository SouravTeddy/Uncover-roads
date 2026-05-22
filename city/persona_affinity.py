"""Derives persona affinity scores from Google Places primary type.

Used when building insert_candidates — maps a place category to
how strongly each persona archetype would enjoy it.

Scores are in [0.0, 1.0]. Unknown types return NEUTRAL (all 0.5).
Post-launch: override with behavior data (pin_saved/pin_dismissed signals).
"""

ARCHETYPES = [
    # Legacy
    "wanderer", "voyager", "epicurean", "historian", "pulse", "slowtraveller", "explorer",
    # New frontend archetypes (lowercased, no spaces)
    "flaneur", "gastronaut", "slowscholar", "neighbourhoodlocal",
    "efficientexplorer", "aesthete", "nightcreature", "ritualseeker",
]

NEUTRAL: dict[str, float] = {a: 0.5 for a in ARCHETYPES}

_AFFINITY: dict[str, dict[str, float]] = {
    "museum": {
        "wanderer": 0.5, "voyager": 0.7, "epicurean": 0.3,
        "historian": 0.95, "pulse": 0.2, "slowtraveller": 0.5, "explorer": 0.8,
        "flaneur": 0.6, "gastronaut": 0.3, "slowscholar": 0.95, "neighbourhoodlocal": 0.5,
        "efficientexplorer": 0.75, "aesthete": 0.85, "nightcreature": 0.15, "ritualseeker": 0.7,
    },
    "art_gallery": {
        "wanderer": 0.7, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.8, "pulse": 0.3, "slowtraveller": 0.7, "explorer": 0.7,
        "flaneur": 0.8, "gastronaut": 0.35, "slowscholar": 0.85, "neighbourhoodlocal": 0.65,
        "efficientexplorer": 0.6, "aesthete": 0.95, "nightcreature": 0.25, "ritualseeker": 0.7,
    },
    "cafe": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.4, "pulse": 0.4, "slowtraveller": 0.9, "explorer": 0.6,
        "flaneur": 0.9, "gastronaut": 0.8, "slowscholar": 0.85, "neighbourhoodlocal": 0.9,
        "efficientexplorer": 0.5, "aesthete": 0.75, "nightcreature": 0.4, "ritualseeker": 0.95,
    },
    "coffee_shop": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.4, "pulse": 0.4, "slowtraveller": 0.9, "explorer": 0.6,
        "flaneur": 0.9, "gastronaut": 0.8, "slowscholar": 0.85, "neighbourhoodlocal": 0.9,
        "efficientexplorer": 0.5, "aesthete": 0.75, "nightcreature": 0.4, "ritualseeker": 0.95,
    },
    "restaurant": {
        "wanderer": 0.6, "voyager": 0.8, "epicurean": 0.95,
        "historian": 0.3, "pulse": 0.5, "slowtraveller": 0.6, "explorer": 0.7,
        "flaneur": 0.7, "gastronaut": 1.0, "slowscholar": 0.5, "neighbourhoodlocal": 0.85,
        "efficientexplorer": 0.65, "aesthete": 0.6, "nightcreature": 0.7, "ritualseeker": 0.6,
    },
    "food": {
        "wanderer": 0.7, "voyager": 0.7, "epicurean": 0.9,
        "historian": 0.3, "pulse": 0.4, "slowtraveller": 0.7, "explorer": 0.7,
        "flaneur": 0.75, "gastronaut": 0.95, "slowscholar": 0.5, "neighbourhoodlocal": 0.8,
        "efficientexplorer": 0.6, "aesthete": 0.55, "nightcreature": 0.65, "ritualseeker": 0.65,
    },
    "market": {
        "wanderer": 0.95, "voyager": 0.6, "epicurean": 0.85,
        "historian": 0.5, "pulse": 0.5, "slowtraveller": 0.7, "explorer": 0.7,
        "flaneur": 1.0, "gastronaut": 0.9, "slowscholar": 0.55, "neighbourhoodlocal": 0.95,
        "efficientexplorer": 0.5, "aesthete": 0.7, "nightcreature": 0.45, "ritualseeker": 0.6,
    },
    "park": {
        "wanderer": 0.9, "voyager": 0.5, "epicurean": 0.4,
        "historian": 0.3, "pulse": 0.2, "slowtraveller": 0.9, "explorer": 0.7,
        "flaneur": 1.0, "gastronaut": 0.35, "slowscholar": 0.7, "neighbourhoodlocal": 0.9,
        "efficientexplorer": 0.45, "aesthete": 0.85, "nightcreature": 0.2, "ritualseeker": 0.8,
    },
    "tourist_attraction": {
        "wanderer": 0.7, "voyager": 0.85, "epicurean": 0.4,
        "historian": 0.8, "pulse": 0.4, "slowtraveller": 0.4, "explorer": 0.9,
        "flaneur": 0.6, "gastronaut": 0.4, "slowscholar": 0.75, "neighbourhoodlocal": 0.3,
        "efficientexplorer": 0.85, "aesthete": 0.75, "nightcreature": 0.35, "ritualseeker": 0.5,
    },
    "point_of_interest": {
        "wanderer": 0.8, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.7, "pulse": 0.4, "slowtraveller": 0.5, "explorer": 0.8,
        "flaneur": 0.85, "gastronaut": 0.4, "slowscholar": 0.7, "neighbourhoodlocal": 0.65,
        "efficientexplorer": 0.75, "aesthete": 0.8, "nightcreature": 0.3, "ritualseeker": 0.6,
    },
    "bar": {
        "wanderer": 0.6, "voyager": 0.5, "epicurean": 0.7,
        "historian": 0.2, "pulse": 0.85, "slowtraveller": 0.5, "explorer": 0.7,
        "flaneur": 0.65, "gastronaut": 0.75, "slowscholar": 0.2, "neighbourhoodlocal": 0.8,
        "efficientexplorer": 0.45, "aesthete": 0.5, "nightcreature": 0.95, "ritualseeker": 0.3,
    },
    "night_club": {
        "wanderer": 0.3, "voyager": 0.3, "epicurean": 0.4,
        "historian": 0.1, "pulse": 1.0, "slowtraveller": 0.1, "explorer": 0.6,
        "flaneur": 0.3, "gastronaut": 0.35, "slowscholar": 0.1, "neighbourhoodlocal": 0.4,
        "efficientexplorer": 0.3, "aesthete": 0.25, "nightcreature": 1.0, "ritualseeker": 0.1,
    },
    "beach": {
        "wanderer": 0.7, "voyager": 0.6, "epicurean": 0.4,
        "historian": 0.2, "pulse": 0.6, "slowtraveller": 0.85, "explorer": 0.7,
        "flaneur": 0.8, "gastronaut": 0.3, "slowscholar": 0.5, "neighbourhoodlocal": 0.75,
        "efficientexplorer": 0.5, "aesthete": 0.8, "nightcreature": 0.55, "ritualseeker": 0.7,
    },
    "natural_feature": {
        "wanderer": 0.9, "voyager": 0.6, "epicurean": 0.2,
        "historian": 0.3, "pulse": 0.2, "slowtraveller": 0.8, "explorer": 0.9,
        "flaneur": 0.95, "gastronaut": 0.2, "slowscholar": 0.6, "neighbourhoodlocal": 0.7,
        "efficientexplorer": 0.6, "aesthete": 0.9, "nightcreature": 0.2, "ritualseeker": 0.75,
    },
    "viewpoint": {
        "wanderer": 1.0, "voyager": 0.7, "epicurean": 0.3,
        "historian": 0.5, "pulse": 0.4, "slowtraveller": 0.8, "explorer": 0.8,
        "flaneur": 0.95, "gastronaut": 0.3, "slowscholar": 0.65, "neighbourhoodlocal": 0.75,
        "efficientexplorer": 0.65, "aesthete": 1.0, "nightcreature": 0.5, "ritualseeker": 0.7,
    },
    "place_of_worship": {
        "wanderer": 0.6, "voyager": 0.6, "epicurean": 0.2,
        "historian": 0.9, "pulse": 0.1, "slowtraveller": 0.6, "explorer": 0.6,
        "flaneur": 0.6, "gastronaut": 0.15, "slowscholar": 0.9, "neighbourhoodlocal": 0.55,
        "efficientexplorer": 0.5, "aesthete": 0.8, "nightcreature": 0.1, "ritualseeker": 0.95,
    },
    "spa": {
        "wanderer": 0.3, "voyager": 0.7, "epicurean": 0.4,
        "historian": 0.1, "pulse": 0.2, "slowtraveller": 0.9, "explorer": 0.4,
        "flaneur": 0.35, "gastronaut": 0.3, "slowscholar": 0.65, "neighbourhoodlocal": 0.5,
        "efficientexplorer": 0.3, "aesthete": 0.6, "nightcreature": 0.25, "ritualseeker": 0.9,
    },
    "shopping_mall": {
        "wanderer": 0.4, "voyager": 0.4, "epicurean": 0.5,
        "historian": 0.1, "pulse": 0.6, "slowtraveller": 0.3, "explorer": 0.5,
        "flaneur": 0.5, "gastronaut": 0.5, "slowscholar": 0.15, "neighbourhoodlocal": 0.55,
        "efficientexplorer": 0.45, "aesthete": 0.4, "nightcreature": 0.6, "ritualseeker": 0.2,
    },
}


def get_persona_affinity(google_type: str) -> dict[str, float]:
    """Return persona affinity scores for a Google Places primary type."""
    return dict(_AFFINITY.get(google_type, NEUTRAL))
