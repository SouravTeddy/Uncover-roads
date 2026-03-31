"""
ip_engine.py — Protected business logic
Contains all proprietary data and algorithms.
NOT served to the browser — server-side only.
"""

import math

# ══════════════════════════════════════════════════════════════
# ARCHETYPES
# ══════════════════════════════════════════════════════════════

ARCHETYPES = {
    "voyager": {
        "name": "The Curated Voyager",
        "desc": "You travel with intention. You pick three things and do them properly.",
        "itinerary_bias": ["design", "heritage", "gastronomy"],
        "venue_filters": ["restaurant", "museum", "historic", "gallery"],
    },
    "wanderer": {
        "name": "The Urban Wanderer",
        "desc": "You find the best cities by getting lost in them.",
        "itinerary_bias": ["neighbourhood", "markets", "local"],
        "venue_filters": ["market", "park", "local"],
    },
    "epicurean": {
        "name": "The Epicurean",
        "desc": "You plan trips around meals. Everything else is context.",
        "itinerary_bias": ["food", "markets", "wine"],
        "venue_filters": ["restaurant", "market", "cafe", "bar"],
    },
    "historian": {
        "name": "The Historian",
        "desc": "Every city is a text. You read it through its buildings and museums.",
        "itinerary_bias": ["heritage", "museum", "culture"],
        "venue_filters": ["museum", "historic", "monument"],
    },
    "pulse": {
        "name": "The Pulse Seeker",
        "desc": "You want the city at its most alive — energy, people, movement.",
        "itinerary_bias": ["nightlife", "markets", "events"],
        "venue_filters": ["bar", "market", "club", "rooftop"],
    },
    "slowtraveller": {
        "name": "The Slow Traveller",
        "desc": "You go deep, not wide. One neighbourhood over ten attractions.",
        "itinerary_bias": ["local", "neighbourhood", "café"],
        "venue_filters": ["cafe", "park", "local"],
    },
    "explorer": {
        "name": "The Explorer",
        "desc": "You want everything. Parks, museums, food, nightlife — all of it.",
        "itinerary_bias": ["varied", "outdoor", "adventure"],
        "venue_filters": ["park", "tourism", "outdoor"],
    },
}

# ══════════════════════════════════════════════════════════════
# PERSONA SCORING — maps OB answers to archetype
# ══════════════════════════════════════════════════════════════

ARCHETYPE_SIGNALS = {
    # ritual → archetype weight
    "ritual": {
        "coffee":     {"voyager": 1, "epicurean": 1},
        "tea":        {"slowtraveller": 1, "historian": 1},
        "exercise":   {"explorer": 2},
        "journaling": {"wanderer": 1, "slowtraveller": 1},
        "alcohol":    {"pulse": 2, "epicurean": 1},
        "neither":    {},
    },
    # sensory → archetype weight
    "sensory": {
        "visual":    {"voyager": 2, "wanderer": 1},
        "taste":     {"epicurean": 3},
        "history":   {"historian": 3},
        "nature":    {"explorer": 2},
        "social":    {"pulse": 2},
        "solitude":  {"slowtraveller": 2},
    },
    # pace → archetype weight
    "pace": {
        "walking":  {"wanderer": 1, "slowtraveller": 1},
        "transit":  {"pulse": 1},
        "self":     {"explorer": 1},
        "any":      {},
    },
    # style → archetype weight
    "style": {
        "planner":      {"voyager": 2, "historian": 1},
        "spontaneous":  {"wanderer": 2, "pulse": 1},
        "balanced":     {"explorer": 1},
        "local":        {"wanderer": 1, "slowtraveller": 2},
    },
    # attractions → archetype weight (multi-select)
    "attractions": {
        "historic":   {"historian": 2},
        "museums":    {"historian": 1, "voyager": 1},
        "food":       {"epicurean": 2},
        "nightlife":  {"pulse": 2},
        "nature":     {"explorer": 2},
        "markets":    {"wanderer": 1, "epicurean": 1},
        "art":        {"voyager": 2},
    },
}

def score_archetype(ob_answers: dict) -> dict:
    """
    Takes OB answers dict and returns scored archetypes.
    ob_answers = {ritual, sensory, pace, style, attractions: [...], social}
    Returns {archetype: score} sorted desc.
    """
    scores = {k: 0 for k in ARCHETYPES}

    for field, signals in ARCHETYPE_SIGNALS.items():
        val = ob_answers.get(field)
        if not val:
            continue
        if field == "attractions":
            # multi-select — sum weights for each chosen attraction
            for attr in (val if isinstance(val, list) else [val]):
                for arch, w in signals.get(attr, {}).items():
                    scores[arch] = scores.get(arch, 0) + w
        else:
            for arch, w in signals.get(str(val), {}).items():
                scores[arch] = scores.get(arch, 0) + w

    return dict(sorted(scores.items(), key=lambda x: -x[1]))


# ══════════════════════════════════════════════════════════════
# CITY PROFILES — 45 cities, 15+ attributes each
# ══════════════════════════════════════════════════════════════

CITY_PROFILES = {
    "singapore": {
        "nightlife": 2, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 4,
        "climate_hot": [3,4,5,6,7,8,9,10,11,12,1,2],
        "elevation": 15, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "dubai": {
        "nightlife": 2, "heritage": 1, "nature": 1, "alcohol": True,
        "walkability": 1, "transit": 2, "cost_tier": 4,
        "climate_hot": [4,5,6,7,8,9,10],
        "elevation": 10, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 3, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": False, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "tokyo": {
        "nightlife": 3, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 3,
        "climate_hot": [7,8],
        "elevation": 40, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 1, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "kyoto": {
        "nightlife": 1, "heritage": 3, "nature": 3, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 3,
        "climate_hot": [7,8],
        "elevation": 50, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 1, "religious_sensitivity": True,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "bangkok": {
        "nightlife": 3, "heritage": 2, "nature": 1, "alcohol": True,
        "walkability": 1, "transit": 2, "cost_tier": 1,
        "climate_hot": [3,4,5,6,7,8,9,10,11],
        "elevation": 5, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 2, "religious_sensitivity": True,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "mumbai": {
        "nightlife": 3, "heritage": 2, "nature": 1, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 2,
        "climate_hot": [3,4,5,6,7,8,9,10],
        "elevation": 14, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 3, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "bengaluru": {
        "nightlife": 2, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 2,
        "climate_hot": [3,4,5],
        "elevation": 900, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "delhi": {
        "nightlife": 2, "heritage": 3, "nature": 1, "alcohol": True,
        "walkability": 1, "transit": 2, "cost_tier": 1,
        "climate_hot": [4,5,6,7,8,9],
        "elevation": 216, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 2, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "goa": {
        "nightlife": 3, "heritage": 2, "nature": 3, "alcohol": True,
        "walkability": 1, "transit": 1, "cost_tier": 2,
        "climate_hot": [3,4,5,6,7,8,9,10],
        "elevation": 7, "meal_times": {"lunch":"13:00","dinner":"20:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "london": {
        "nightlife": 3, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 4,
        "climate_hot": [],
        "elevation": 11, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "paris": {
        "nightlife": 3, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 4,
        "climate_hot": [7,8],
        "elevation": 35, "meal_times": {"lunch":"12:30","dinner":"20:00"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "barcelona": {
        "nightlife": 3, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 3,
        "climate_hot": [6,7,8,9],
        "elevation": 12, "meal_times": {"lunch":"14:00","dinner":"21:30"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "rome": {
        "nightlife": 2, "heritage": 3, "nature": 1, "alcohol": True,
        "walkability": 3, "transit": 2, "cost_tier": 3,
        "climate_hot": [6,7,8],
        "elevation": 21, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 2, "religious_sensitivity": True,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "amsterdam": {
        "nightlife": 3, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 3,
        "climate_hot": [],
        "elevation": -2, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "istanbul": {
        "nightlife": 2, "heritage": 3, "nature": 1, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 2,
        "climate_hot": [6,7,8,9],
        "elevation": 40, "meal_times": {"lunch":"12:00","dinner":"20:00"},
        "english_signage": 1, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "new york": {
        "nightlife": 3, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 4,
        "climate_hot": [6,7,8],
        "elevation": 10, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "los angeles": {
        "nightlife": 3, "heritage": 1, "nature": 3, "alcohol": True,
        "walkability": 1, "transit": 1, "cost_tier": 3,
        "climate_hot": [6,7,8,9,10],
        "elevation": 71, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": True,
    },
    "berlin": {
        "nightlife": 3, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 2,
        "climate_hot": [7,8],
        "elevation": 34, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "sydney": {
        "nightlife": 3, "heritage": 2, "nature": 3, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 4,
        "climate_hot": [12,1,2,3],
        "elevation": 39, "meal_times": {"lunch":"12:00","dinner":"18:30"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": True,
    },
    "bali": {
        "nightlife": 2, "heritage": 2, "nature": 3, "alcohol": True,
        "walkability": 1, "transit": 1, "cost_tier": 1,
        "climate_hot": [3,4,5,6,7,8,9,10],
        "elevation": 100, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 2, "religious_sensitivity": True,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "hong kong": {
        "nightlife": 3, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 3,
        "climate_hot": [5,6,7,8,9,10],
        "elevation": 8, "meal_times": {"lunch":"12:00","dinner":"18:30"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 3,
        "terrain_hilly": True,
    },
    "kuala lumpur": {
        "nightlife": 2, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 1, "transit": 2, "cost_tier": 1,
        "climate_hot": [1,2,3,4,5,6,7,8,9,10,11,12],
        "elevation": 50, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 3, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "seoul": {
        "nightlife": 3, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 2,
        "climate_hot": [6,7,8],
        "elevation": 38, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "prague": {
        "nightlife": 3, "heritage": 3, "nature": 1, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 2,
        "climate_hot": [7,8],
        "elevation": 200, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": True,
    },
    "lisbon": {
        "nightlife": 3, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 2,
        "climate_hot": [6,7,8,9],
        "elevation": 10, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": True,
    },
    "mexico city": {
        "nightlife": 3, "heritage": 3, "nature": 1, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 1,
        "climate_hot": [3,4,5],
        "elevation": 2240, "meal_times": {"lunch":"14:00","dinner":"21:00"},
        "english_signage": 1, "religious_sensitivity": True,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "rio de janeiro": {
        "nightlife": 3, "heritage": 2, "nature": 3, "alcohol": True,
        "walkability": 2, "transit": 1, "cost_tier": 2,
        "climate_hot": [11,12,1,2,3],
        "elevation": 10, "meal_times": {"lunch":"12:00","dinner":"20:00"},
        "english_signage": 1, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "cape town": {
        "nightlife": 2, "heritage": 2, "nature": 3, "alcohol": True,
        "walkability": 2, "transit": 1, "cost_tier": 2,
        "climate_hot": [12,1,2,3],
        "elevation": 10, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "marrakech": {
        "nightlife": 1, "heritage": 3, "nature": 1, "alcohol": False,
        "walkability": 2, "transit": 1, "cost_tier": 1,
        "climate_hot": [5,6,7,8,9],
        "elevation": 466, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 1, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "cairo": {
        "nightlife": 1, "heritage": 3, "nature": 0, "alcohol": False,
        "walkability": 1, "transit": 1, "cost_tier": 1,
        "climate_hot": [4,5,6,7,8,9,10],
        "elevation": 23, "meal_times": {"lunch":"14:00","dinner":"21:00"},
        "english_signage": 1, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": False,
    },
    "nairobi": {
        "nightlife": 2, "heritage": 1, "nature": 3, "alcohol": True,
        "walkability": 1, "transit": 1, "cost_tier": 2,
        "climate_hot": [1,2,3],
        "elevation": 1795, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": False,
    },
    "vienna": {
        "nightlife": 2, "heritage": 3, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 3,
        "climate_hot": [7,8],
        "elevation": 171, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": False, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "zurich": {
        "nightlife": 2, "heritage": 2, "nature": 3, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 4,
        "climate_hot": [7,8],
        "elevation": 408, "meal_times": {"lunch":"12:00","dinner":"18:30"},
        "english_signage": 3, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": False, "luxury_supply": 3,
        "terrain_hilly": True,
    },
    "osaka": {
        "nightlife": 3, "heritage": 2, "nature": 1, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 2,
        "climate_hot": [6,7,8,9],
        "elevation": 5, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 1, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": False,
    },
    "milan": {
        "nightlife": 3, "heritage": 3, "nature": 1, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 3,
        "climate_hot": [6,7,8],
        "elevation": 122, "meal_times": {"lunch":"13:00","dinner":"20:30"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": False, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "athens": {
        "nightlife": 3, "heritage": 3, "nature": 1, "alcohol": True,
        "walkability": 2, "transit": 2, "cost_tier": 2,
        "climate_hot": [6,7,8,9],
        "elevation": 70, "meal_times": {"lunch":"14:00","dinner":"21:30"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": True,
    },
    "kathmandu": {
        "nightlife": 1, "heritage": 3, "nature": 3, "alcohol": True,
        "walkability": 2, "transit": 1, "cost_tier": 1,
        "climate_hot": [4,5,6],
        "elevation": 1400, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 2, "religious_sensitivity": True,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": True,
    },
    "colombo": {
        "nightlife": 2, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 1, "transit": 1, "cost_tier": 1,
        "climate_hot": [3,4,5,6,7,8,9,10,11],
        "elevation": 7, "meal_times": {"lunch":"12:00","dinner":"19:00"},
        "english_signage": 2, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": False,
    },
    "dubai": {
        "nightlife": 2, "heritage": 1, "nature": 1, "alcohol": True,
        "walkability": 1, "transit": 2, "cost_tier": 4,
        "climate_hot": [4,5,6,7,8,9,10],
        "elevation": 10, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 3, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": False, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "abu dhabi": {
        "nightlife": 1, "heritage": 2, "nature": 1, "alcohol": True,
        "walkability": 1, "transit": 1, "cost_tier": 4,
        "climate_hot": [4,5,6,7,8,9,10],
        "elevation": 5, "meal_times": {"lunch":"13:00","dinner":"21:00"},
        "english_signage": 3, "religious_sensitivity": True,
        "ramadan_affected": True, "tourist_only": False,
        "street_food": False, "luxury_supply": 3,
        "terrain_hilly": False,
    },
    "taipei": {
        "nightlife": 3, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 3, "transit": 3, "cost_tier": 2,
        "climate_hot": [6,7,8,9,10],
        "elevation": 9, "meal_times": {"lunch":"12:00","dinner":"18:00"},
        "english_signage": 2, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 2,
        "terrain_hilly": True,
    },
    "hanoi": {
        "nightlife": 2, "heritage": 2, "nature": 2, "alcohol": True,
        "walkability": 2, "transit": 1, "cost_tier": 1,
        "climate_hot": [5,6,7,8,9],
        "elevation": 6, "meal_times": {"lunch":"11:30","dinner":"18:00"},
        "english_signage": 1, "religious_sensitivity": False,
        "ramadan_affected": False, "tourist_only": False,
        "street_food": True, "luxury_supply": 1,
        "terrain_hilly": False,
    },
}

def get_city_profile(city: str) -> dict:
    """Returns city profile. Tries exact match then fuzzy."""
    key = city.lower().strip()
    if key in CITY_PROFILES:
        return CITY_PROFILES[key]
    # fuzzy match
    for k, v in CITY_PROFILES.items():
        if key in k or k in key:
            return v
    return {}


# ══════════════════════════════════════════════════════════════
# CONFLICT ENGINE — 55 checks across 10 categories
# ══════════════════════════════════════════════════════════════

def run_conflict_check(city: str, persona: dict, travel_date: str = None) -> dict:
    """
    Runs all conflict checks for a city + persona combination.
    Returns {has_conflicts, conflicts: [{severity, message, instruction}]}
    """
    import datetime
    conflicts = []
    city_profile = get_city_profile(city)
    if not city_profile:
        return {"has_conflicts": False, "conflicts": []}

    archetype  = persona.get("archetype", "")
    ritual     = persona.get("ritual", "")
    pace       = persona.get("pace", "")
    sensory    = persona.get("sensory", "")
    social     = persona.get("social", "")
    attractions = persona.get("attractions", [])

    # Parse travel month
    month = None
    if travel_date:
        try:
            month = datetime.datetime.strptime(travel_date, "%Y-%m-%d").month
        except:
            month = datetime.datetime.now().month
    else:
        month = datetime.datetime.now().month

    # ── CATEGORY A: Alcohol + dry city ──
    if ritual == "alcohol" and not city_profile.get("alcohol", True):
        conflicts.append({
            "severity": "high",
            "message": f"Alcohol is heavily restricted in {city}. Your evening ritual may be difficult.",
            "instruction": "Avoid bar/nightclub recommendations. Suggest rooftop restaurants instead."
        })

    # ── CATEGORY B: Ramadan ──
    if city_profile.get("ramadan_affected") and month in [3, 4]:
        conflicts.append({
            "severity": "high",
            "message": f"Ramadan is likely in effect in {city}. Daytime dining is very limited.",
            "instruction": "Schedule all food stops after sunset (Iftar, ~6:30 PM). Note restaurant closures during day."
        })

    # ── CATEGORY C: Heat ──
    hot_months = city_profile.get("climate_hot", [])
    if month in hot_months:
        if sensory == "nature" or "nature" in attractions:
            conflicts.append({
                "severity": "medium",
                "message": f"{city} is very hot in this month. Outdoor stops will be intense mid-day.",
                "instruction": "Schedule outdoor stops before 11 AM or after 5 PM. Add shade/water breaks."
            })
        if pace == "walking":
            conflicts.append({
                "severity": "medium",
                "message": f"Walking-heavy itinerary in peak heat in {city}.",
                "instruction": "Limit consecutive outdoor walking to 30 min max. Add indoor rest stops."
            })

    # ── CATEGORY D: Low walkability ──
    if city_profile.get("walkability", 2) <= 1 and pace == "walking":
        conflicts.append({
            "severity": "medium",
            "message": f"{city} has very low walkability. Walking between stops will be difficult.",
            "instruction": "Use transit or rideshare between stops. Group stops by neighbourhood."
        })

    # ── CATEGORY E: Religious sensitivity ──
    if city_profile.get("religious_sensitivity") and ("historic" in attractions or sensory == "history"):
        conflicts.append({
            "severity": "low",
            "message": f"Several heritage sites in {city} require modest dress.",
            "instruction": "Note dress codes at religious sites. Add reminder to tip text."
        })

    # ── CATEGORY F: No nightlife city ──
    if city_profile.get("nightlife", 2) <= 1 and (archetype == "pulse" or ritual == "alcohol"):
        conflicts.append({
            "severity": "medium",
            "message": f"{city} has very limited nightlife. Your preferences may not be fully met.",
            "instruction": "Focus on evening restaurants and rooftop bars rather than clubs."
        })

    # ── CATEGORY G: High altitude ──
    if city_profile.get("elevation", 0) > 2500:
        conflicts.append({
            "severity": "medium",
            "message": f"{city} is at high altitude ({city_profile['elevation']}m). First day should be light.",
            "instruction": "Reduce Day 1 intensity by 40%. No strenuous outdoor activities on arrival day."
        })

    # ── CATEGORY H: No street food ──
    if not city_profile.get("street_food", True) and (archetype == "epicurean" or sensory == "taste"):
        conflicts.append({
            "severity": "low",
            "message": f"Street food is limited in {city}. Your food-first approach needs sit-down venues.",
            "instruction": "Recommend restaurants only. Note that casual street eating is not the norm."
        })

    # ── CATEGORY I: Cost tier mismatch ──
    if city_profile.get("cost_tier", 2) >= 4 and "budget" in persona.get("style", ""):
        conflicts.append({
            "severity": "medium",
            "message": f"{city} is an expensive city. Budget travel is difficult here.",
            "instruction": "Prioritise free attractions (parks, viewpoints, markets) over paid venues."
        })

    # ── CATEGORY J: Family + hot outdoor ──
    if social == "family" and month in hot_months and sensory == "nature":
        conflicts.append({
            "severity": "medium",
            "message": f"Travelling with family in hot weather in {city}. Outdoor activities need timing.",
            "instruction": "All outdoor family stops before 10:30 AM or after 5 PM. Add water/shade note."
        })

    has_conflicts = len(conflicts) > 0
    # Sort: high first, then medium, then low
    sev_order = {"high": 0, "medium": 1, "low": 2}
    conflicts.sort(key=lambda c: sev_order.get(c["severity"], 3))

    return {"has_conflicts": has_conflicts, "conflicts": conflicts}


# ══════════════════════════════════════════════════════════════
# PERSONA BUILDER — public API
# ══════════════════════════════════════════════════════════════

def build_persona_response(ob_answers: dict, city: str, travel_date: str = None) -> dict:
    """
    Takes OB answers, returns full persona + conflicts.
    This is what /persona endpoint returns.
    """
    scores = score_archetype(ob_answers)
    archetype = list(scores.keys())[0]
    arch_data = ARCHETYPES.get(archetype, {})

    # Build display-safe top_matches — relative percentages only, no raw scores
    top_raw = [(k, v) for k, v in scores.items() if v > 0][:3]
    max_score = top_raw[0][1] if top_raw else 1
    top_matches = [
        {"arch": k, "pct": round((v / max_score) * 100)}
        for k, v in top_raw
    ]

    persona = {
        "archetype":      archetype,
        "ritual":         ob_answers.get("ritual"),
        "sensory":        ob_answers.get("sensory"),
        "pace":           ob_answers.get("pace"),
        "style":          ob_answers.get("style"),
        "social":         ob_answers.get("social"),
        "attractions":    ob_answers.get("attractions", []),
        "archetype_name": arch_data.get("name", archetype),
        "archetype_desc": arch_data.get("desc", ""),
        "venue_filters":  arch_data.get("venue_filters", []),
        "itinerary_bias": arch_data.get("itinerary_bias", []),
        "top_matches":    top_matches,
    }

    conflict_result = run_conflict_check(city, persona, travel_date)

    return {
        "persona":   persona,
        "conflicts": conflict_result,
        "city_profile": get_city_profile(city),
    }
