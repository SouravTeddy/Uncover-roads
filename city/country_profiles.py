"""Static country-level modifiers for the itinerary engine.

Covers meal timing, siesta windows, and evening cutoff.
~50 entries covers all 80 Tier 1 cities plus common travel destinations.
Fallback to '_default' for unlisted countries.

Sources: cultural knowledge encoded once — these change on decade timescales.
"""

COUNTRY_PROFILES: dict[str, dict] = {
    "JP": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "FR": {"meal_times": {"lunch": "12:30", "dinner": "20:00"}, "siesta_window": "12:30-14:30",   "lunch_window_strict": True,  "evening_end_time": "23:00"},
    "US": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "ES": {"meal_times": {"lunch": "14:00", "dinner": "21:30"}, "siesta_window": "14:00-17:00",   "lunch_window_strict": True,  "evening_end_time": "00:00"},
    "IT": {"meal_times": {"lunch": "13:00", "dinner": "20:30"}, "siesta_window": "13:00-16:00",   "lunch_window_strict": True,  "evening_end_time": "23:30"},
    "PT": {"meal_times": {"lunch": "13:00", "dinner": "21:00"}, "siesta_window": "13:00-15:00",   "lunch_window_strict": False, "evening_end_time": "23:30"},
    "GR": {"meal_times": {"lunch": "14:00", "dinner": "21:30"}, "siesta_window": "14:00-17:30",   "lunch_window_strict": True,  "evening_end_time": "00:00"},
    "GB": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "DE": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "NL": {"meal_times": {"lunch": "12:30", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "AT": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "CH": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "CZ": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "PL": {"meal_times": {"lunch": "12:30", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "HU": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "BE": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "SE": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "DK": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "IE": {"meal_times": {"lunch": "12:30", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "IS": {"meal_times": {"lunch": "12:00", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "TR": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "IN": {"meal_times": {"lunch": "13:00", "dinner": "21:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "TH": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "VN": {"meal_times": {"lunch": "11:30", "dinner": "18:00"}, "siesta_window": "12:00-14:00",   "lunch_window_strict": False, "evening_end_time": "22:00"},
    "SG": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "MY": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "ID": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "KR": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "TW": {"meal_times": {"lunch": "12:00", "dinner": "18:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "HK": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "AE": {"meal_times": {"lunch": "13:00", "dinner": "20:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "EG": {"meal_times": {"lunch": "14:00", "dinner": "21:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "00:00"},
    "MA": {"meal_times": {"lunch": "13:00", "dinner": "20:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "ZA": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "KE": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "GH": {"meal_times": {"lunch": "13:00", "dinner": "19:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "MX": {"meal_times": {"lunch": "14:00", "dinner": "21:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "BR": {"meal_times": {"lunch": "12:30", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "AR": {"meal_times": {"lunch": "13:00", "dinner": "21:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "00:00"},
    "CO": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "PE": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "CA": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "AU": {"meal_times": {"lunch": "12:00", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "NZ": {"meal_times": {"lunch": "12:30", "dinner": "18:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "IL": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "JO": {"meal_times": {"lunch": "13:30", "dinner": "20:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "GE": {"meal_times": {"lunch": "13:00", "dinner": "20:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "23:00"},
    "NP": {"meal_times": {"lunch": "13:00", "dinner": "19:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "LK": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "TZ": {"meal_times": {"lunch": "13:00", "dinner": "19:30"}, "siesta_window": None,           "lunch_window_strict": False, "evening_end_time": "22:00"},
    "_default": {"meal_times": {"lunch": "12:30", "dinner": "19:00"}, "siesta_window": None,     "lunch_window_strict": False, "evening_end_time": "22:00"},
}


def get_country_modifiers(country_code: str) -> dict:
    """Return meal timing + siesta modifiers for a country. Falls back to _default."""
    return COUNTRY_PROFILES.get(country_code, COUNTRY_PROFILES["_default"])
