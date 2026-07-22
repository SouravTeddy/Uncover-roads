"""
Python port of the TypeScript reco-engine gap detection logic.
Only handles dimensions that produce place-fetching triggers.
Structural triggers (walking_gap, density_excess, etc.) are excluded.
"""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Optional


FOOD_CATS  = {"restaurant", "cafe", "bakery", "street_food", "market",
              "lunch", "dinner", "breakfast"}          # inserts.py vocabulary
CULTURE_CATS = {"museum", "gallery", "historic", "heritage", "library", "spiritual"}
OUTDOOR_CATS = {"park", "viewpoint", "beach", "zoo", "aquarium", "amusement_park"}
SOCIAL_CATS  = {"bar", "nightlife", "market", "restaurant"}
REST_CATS    = {"cafe", "park", "coffee", "coffee_shop", "rest", "scenic_walk"}  # inserts.py vocabulary
LANDMARK_CATS = {"museum", "historic", "tourism", "gallery", "amusement_park", "zoo", "aquarium"}

# City character — matches profile.ts CITY_CHARACTER
_CITY_CHARACTER: dict[str, dict] = {
    "singapore": {"heritage": 0.5, "nightlife": 0.5},
    "dubai": {"heritage": 0.0, "nightlife": 0.5},
    "tokyo": {"heritage": 1.0, "nightlife": 1.0},
    "kyoto": {"heritage": 1.0, "nightlife": 0.0},
    "bangkok": {"heritage": 0.5, "nightlife": 1.0},
    "mumbai": {"heritage": 0.5, "nightlife": 1.0},
    "bengaluru": {"heritage": 0.5, "nightlife": 0.5},
    "delhi": {"heritage": 1.0, "nightlife": 0.5},
    "goa": {"heritage": 0.5, "nightlife": 1.0},
    "london": {"heritage": 1.0, "nightlife": 1.0},
    "paris": {"heritage": 1.0, "nightlife": 1.0},
    "barcelona": {"heritage": 1.0, "nightlife": 1.0},
    "rome": {"heritage": 1.0, "nightlife": 0.5},
    "amsterdam": {"heritage": 1.0, "nightlife": 1.0},
    "istanbul": {"heritage": 1.0, "nightlife": 0.5},
    "new york": {"heritage": 0.5, "nightlife": 1.0},
    "los angeles": {"heritage": 0.0, "nightlife": 1.0},
    "berlin": {"heritage": 1.0, "nightlife": 1.0},
    "sydney": {"heritage": 0.5, "nightlife": 1.0},
    "bali": {"heritage": 0.5, "nightlife": 0.5},
    "hong kong": {"heritage": 0.5, "nightlife": 1.0},
    "kuala lumpur": {"heritage": 0.5, "nightlife": 0.5},
    "seoul": {"heritage": 0.5, "nightlife": 1.0},
    "prague": {"heritage": 1.0, "nightlife": 1.0},
    "lisbon": {"heritage": 1.0, "nightlife": 1.0},
    "mexico city": {"heritage": 1.0, "nightlife": 1.0},
    "rio de janeiro": {"heritage": 0.5, "nightlife": 1.0},
    "cape town": {"heritage": 0.5, "nightlife": 0.5},
    "marrakech": {"heritage": 1.0, "nightlife": 0.0},
    "cairo": {"heritage": 1.0, "nightlife": 0.0},
    "nairobi": {"heritage": 0.0, "nightlife": 0.5},
    "vienna": {"heritage": 1.0, "nightlife": 0.5},
    "zurich": {"heritage": 0.5, "nightlife": 0.5},
    "osaka": {"heritage": 0.5, "nightlife": 1.0},
    "milan": {"heritage": 1.0, "nightlife": 1.0},
    "athens": {"heritage": 1.0, "nightlife": 1.0},
    "kathmandu": {"heritage": 1.0, "nightlife": 0.0},
    "colombo": {"heritage": 0.5, "nightlife": 0.5},
    "abu dhabi": {"heritage": 0.5, "nightlife": 0.0},
    "taipei": {"heritage": 0.5, "nightlife": 1.0},
    "hanoi": {"heritage": 0.5, "nightlife": 0.5},
}

# Trigger → (time_default, duration_min, api_category)
TRIGGER_DEFAULTS: dict[str, tuple[str, int, str]] = {
    "lunch":     ("13:00", 60,  "restaurant"),
    "dinner":    ("19:30", 90,  "restaurant"),
    "evening":   ("20:00", 90,  "nightlife"),
    "rest":      ("15:30", 30,  "cafe"),
    "culture":   ("10:30", 90,  "museum"),
    "social_gap":("17:00", 60,  "bar"),
    "hidden_gem":("11:00", 45,  "point_of_interest"),
    "local_food":("12:30", 60,  "restaurant"),
    "famous_spots":("10:00",60, "tourism"),
}

GAP_FLOOR = 0.20

_TRIGGER_CAPS: dict[str, int] = {
    "lunch": 1,
    "dinner": 1,
}
_DEFAULT_TRIGGER_CAP = 2


def _time_to_min(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def _city_character(city: str) -> dict:
    return _CITY_CHARACTER.get(city.lower().strip(), {"heritage": 0.5, "nightlife": 0.5})


@dataclass
class RecoSignal:
    weights: dict          # EngineWeights as dict
    archetype: str
    archetype_group: str   # 'cultural' | 'sensory' | 'social' | 'explorer'
    pace: str              # 'slow' | 'moderate' | 'fast'
    city: str
    is_first_day: bool
    is_last_day: bool
    arrival_time: Optional[str]
    departure_time: Optional[str]
    # OB fields — all optional (default to neutral when not sent by old clients)
    group: str = "solo"          # 'solo' | 'couple' | 'family' | 'friends'
    is_family: bool = False
    mood: list = None            # ['culture', 'eat_drink', 'explore', 'relax']
    budget: Optional[str] = None # 'budget' | 'mid' | 'splurge'
    evening_pref: Optional[str] = None  # 'nightlife' | 'dinner' | 'early_night'
    dietary: list = None         # ['halal', 'plant_based', 'kosher', 'allergy']

    def __post_init__(self):
        if self.mood is None:
            self.mood = []
        if self.dietary is None:
            self.dietary = []


_ARCHETYPE_GROUPS: dict[str, str] = {
    "historian": "cultural", "slowscholar": "cultural",
    "epicurean": "sensory", "aesthete": "sensory",
    "slowtraveller": "sensory", "ritualseeker": "sensory",
    "pulse": "social", "nightcreature": "social",
    "wanderer": "explorer", "voyager": "explorer",
    "explorer": "explorer", "flaneur": "explorer", "drifter": "explorer",
}


def _archetype_group(archetype: str) -> str:
    key = archetype.lower().replace(" ", "").replace("-", "").replace("_", "")
    return _ARCHETYPE_GROUPS.get(key, "explorer")


def _anchor_stop(stops: list[dict], prefer_last: bool = False, prefer_noon: bool = False) -> Optional[dict]:
    if not stops:
        return None
    if prefer_last:
        return stops[-1]
    if prefer_noon:
        def noon_dist(s):
            end = _time_to_min(s.get("time", "09:00")) + s.get("durationMin", 60)
            return abs(end - 720)
        return min(stops, key=noon_dist)
    return stops[len(stops) // 2]


_PERSONA_TYPE_MAP: dict = {
    "rest": {
        "family":   ["park", "amusement_park", "cafe"],
        "social":   ["bar", "cafe"],
        "cultural": ["cafe", "museum"],
        "sensory":  ["cafe", "park"],
        "explorer": ["park", "viewpoint", "cafe"],
    },
    "lunch": {
        "family":   ["restaurant", "cafe"],
        "social":   ["restaurant", "bar"],
        "cultural": ["restaurant", "cafe"],
        "sensory":  ["restaurant"],
        "explorer": ["restaurant", "cafe"],
    },
    "dinner": {
        "family":   ["restaurant"],
        "social":   ["restaurant", "bar"],
        "cultural": ["restaurant"],
        "sensory":  ["restaurant"],
        "explorer": ["restaurant", "bar"],
    },
    "evening": {
        "family":   ["restaurant"],
        "social":   ["bar", "night_club"],
        "cultural": ["theater", "bar"],
        "sensory":  ["restaurant", "bar"],
        "explorer": ["bar", "viewpoint"],
    },
    "culture": {
        "family":   ["amusement_park", "zoo", "museum"],
        "social":   ["museum", "art_gallery"],
        "cultural": ["museum", "art_gallery", "church"],
        "sensory":  ["art_gallery", "museum"],
        "explorer": ["museum", "art_gallery"],
    },
    "social_gap": {
        "family":   ["park", "cafe"],
        "social":   ["bar", "night_club"],
        "cultural": ["cafe", "bar"],
        "sensory":  ["cafe", "bar"],
        "explorer": ["bar", "cafe"],
    },
    "hidden_gem": {
        "family":   ["point_of_interest", "park"],
        "social":   ["bar", "point_of_interest"],
        "cultural": ["point_of_interest", "historic_site"],
        "sensory":  ["point_of_interest", "cafe"],
        "explorer": ["point_of_interest", "establishment"],
    },
    "local_food": {
        "_all": ["restaurant", "grocery_or_supermarket", "cafe"],
    },
    "famous_spots": {
        "family":   ["amusement_park", "tourist_attraction", "landmark"],
        "_all":     ["tourist_attraction", "landmark"],
    },
}


def persona_google_types(trigger: str, signal: "RecoSignal") -> list[str]:
    """
    Returns ordered list of Google Place API types to try for a trigger,
    personalised by archetype group, group type (family), and mood.
    First entry is the primary type; subsequent entries are fallbacks.
    """
    g = signal.archetype_group
    is_family = signal.is_family

    group_key = "family" if is_family else g
    trigger_map = _PERSONA_TYPE_MAP.get(trigger, {})
    types = list(trigger_map.get(group_key) or trigger_map.get("_all") or trigger_map.get(g) or ["restaurant"])

    # evening_pref="nightlife" elevates bar/night_club regardless of archetype
    if trigger == "evening" and getattr(signal, "evening_pref", None) == "nightlife":
        bar_types = [t for t in types if t in ("bar", "night_club")]
        other_types = [t for t in types if t not in ("bar", "night_club")]
        types = (bar_types or ["bar", "night_club"]) + other_types

    return types


def derive_day_recos(
    stops: list[dict],   # stops_out dicts for this day (already serialised)
    signal: RecoSignal,
) -> list[dict]:
    """
    Returns list of trigger dicts:
    {trigger, after_stop_id, lat, lon, city, time, duration_min, category}

    One trigger per gap dimension. Deduped by trigger type.
    """
    if not stops:
        return []

    w = signal.weights
    city_char = _city_character(signal.city)
    heritage  = city_char["heritage"]
    nightlife = city_char["nightlife"]

    arrival_min   = _time_to_min(signal.arrival_time)   if signal.is_first_day and signal.arrival_time   else None
    departure_min = _time_to_min(signal.departure_time) if signal.is_last_day  and signal.departure_time else None

    meal_evening_blocked = (
        (departure_min is not None and departure_min < 1020) or
        (arrival_min   is not None and arrival_min   > 1020)
    )
    lunch_blocked = arrival_min is not None and arrival_min > 900

    # ── Compute actual profile from stops ──────────────────────────────
    sorted_stops = sorted(stops, key=lambda s: _time_to_min(s.get("time", "09:00")))

    has_lunch = any(
        540 <= _time_to_min(s.get("time", "00:00")) <= 1020 and s.get("category", "") in FOOD_CATS
        for s in sorted_stops
    )
    has_dinner = any(
        _time_to_min(s.get("time", "00:00")) >= 900 and s.get("category", "") in FOOD_CATS
        for s in sorted_stops
    )
    has_evening = any(_time_to_min(s.get("time", "00:00")) >= 1200 for s in sorted_stops)
    has_culture = any(s.get("category", "") in CULTURE_CATS for s in sorted_stops)
    has_rest    = any(s.get("category", "") in REST_CATS    for s in sorted_stops)
    has_social  = any(s.get("category", "") in SOCIAL_CATS  for s in sorted_stops)
    has_landmark = any(s.get("category", "") in LANDMARK_CATS for s in sorted_stops)
    has_hidden_gem = any(
        (s.get("stage") == "hidden_gem") or
        (s.get("stage") is None and s.get("category", "") not in {"museum", "historic", "viewpoint", "beach"} and (s.get("rating") or 0) >= 4.3)
        for s in sorted_stops
    )

    # ── Targets ────────────────────────────────────────────────────────
    lunch_target   = 0 if lunch_blocked else 0.9
    dinner_target  = 0 if meal_evening_blocked else max(w.get("w_food_density", 0.5) * 0.8 + 0.2, 0.5)
    evening_target = 0 if meal_evening_blocked else max(w.get("w_nightlife", 0.3), nightlife * 0.4)
    culture_target = max(w.get("w_culture_depth", 0.3), heritage * 0.5)
    rest_target    = min(1.0, w.get("w_rest_need", 0.3) * 0.7 + (0.3 if signal.pace == "slow" else 0))
    social_target  = 0.6 if signal.archetype_group == "social" else 0.2
    hidden_gem_target = w.get("w_spontaneity", 0.4) * 0.6

    # Mood amplification — trip-level OB preference boosts relevant targets
    _mood = signal.mood or []
    if "eat_drink" in _mood:
        dinner_target = min(1.0, dinner_target + 0.3)
        lunch_target  = min(1.0, lunch_target  + 0.1)
    if "culture" in _mood:
        culture_target = min(1.0, culture_target + 0.25)
    if "relax" in _mood:
        rest_target = min(1.0, rest_target + 0.25)
    if "explore" in _mood:
        hidden_gem_target = min(1.0, hidden_gem_target + 0.20)

    print(f"[reco_engine] day flags: has_lunch={has_lunch} has_dinner={has_dinner} has_evening={has_evening} has_culture={has_culture} has_rest={has_rest} has_social={has_social} has_landmark={has_landmark} has_hidden_gem={has_hidden_gem}")
    print(f"[reco_engine] targets: lunch={lunch_target:.2f} dinner={dinner_target:.2f} evening={evening_target:.2f} culture={culture_target:.2f} rest={rest_target:.2f} social={social_target:.2f}")
    print(f"[reco_engine] stops={len(stops)} cats={[s.get('category','?') for s in sorted_stops]} times={[s.get('time','?') for s in sorted_stops]}")

    # ── Gap → trigger ──────────────────────────────────────────────────
    triggers: list[dict] = []
    counts: dict[str, int] = {}

    def _emit(trigger: str, anchor: Optional[dict]) -> None:
        if counts.get(trigger, 0) >= _TRIGGER_CAPS.get(trigger, _DEFAULT_TRIGGER_CAP):
            return
        if anchor is None:
            return
        counts[trigger] = counts.get(trigger, 0) + 1
        defaults = TRIGGER_DEFAULTS.get(trigger)
        if not defaults:
            return
        time_default, dur, cat = defaults
        anchor_end_min = _time_to_min(anchor.get("time", "09:00")) + anchor.get("durationMin", 60)
        triggers.append({
            "trigger":        trigger,
            "after_stop_id":  anchor.get("id"),
            "lat":            anchor.get("lat"),
            "lon":            anchor.get("lon"),
            "city":           signal.city,
            "time":           time_default,
            "anchor_end_min": anchor_end_min,
            "duration_min":   dur,
            "category":       cat,
        })

    if not has_lunch   and (lunch_target - 0) >= GAP_FLOOR:
        _emit("lunch",      _anchor_stop(sorted_stops, prefer_noon=True))
    if not has_dinner  and (dinner_target - 0) >= GAP_FLOOR:
        _emit("dinner",     _anchor_stop(sorted_stops, prefer_last=True))
    if not has_evening and (evening_target - 0) >= GAP_FLOOR:
        _emit("evening",    _anchor_stop(sorted_stops, prefer_last=True))
    if not has_culture and (culture_target - 0) >= GAP_FLOOR:
        _emit("culture",    _anchor_stop(sorted_stops))
    if not has_rest    and (rest_target - 0) >= GAP_FLOOR:
        _emit("rest",       _anchor_stop(sorted_stops))
    if not has_social  and (social_target - 0) >= GAP_FLOOR:
        _emit("social_gap", _anchor_stop(sorted_stops))
    if not has_hidden_gem and (hidden_gem_target - 0) >= GAP_FLOOR:
        _emit("hidden_gem", _anchor_stop(sorted_stops))

    # Famous spots: inject if no landmark stop and fewer than 4 triggers already
    if not has_landmark and len(triggers) < 4:
        _emit("famous_spots", _anchor_stop(sorted_stops))

    return triggers
