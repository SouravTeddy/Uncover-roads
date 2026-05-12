from city.country_profiles import get_country_modifiers


def test_japan_no_siesta():
    mods = get_country_modifiers("JP")
    assert mods["siesta_window"] is None
    assert mods["meal_times"]["dinner"] == "18:30"


def test_spain_has_siesta():
    mods = get_country_modifiers("ES")
    assert mods["siesta_window"] == "14:00-17:00"
    assert mods["lunch_window_strict"] is True


def test_unknown_country_returns_default():
    mods = get_country_modifiers("XX")
    assert "meal_times" in mods
    assert "siesta_window" in mods
    assert "lunch_window_strict" in mods
    assert "evening_end_time" in mods


def test_all_entries_have_required_keys():
    from city.country_profiles import COUNTRY_PROFILES
    required = {"meal_times", "siesta_window", "lunch_window_strict", "evening_end_time"}
    for code, entry in COUNTRY_PROFILES.items():
        missing = required - set(entry.keys())
        assert not missing, f"{code} missing: {missing}"
