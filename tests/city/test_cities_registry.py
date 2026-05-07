from city.cities_registry import CITIES


def test_has_80_cities():
    assert len(CITIES) == 80


def test_all_cities_have_required_fields():
    required = {"id", "name", "lat", "lon", "timezone", "tier", "notes"}
    for city in CITIES:
        missing = required - set(city.keys())
        assert not missing, f"City {city.get('id')} missing: {missing}"


def test_ids_are_unique():
    ids = [c["id"] for c in CITIES]
    assert len(ids) == len(set(ids)), "Duplicate city IDs found"


def test_tiers_are_valid():
    for city in CITIES:
        assert city["tier"] in (1, 2, 3), f"{city['id']} has invalid tier {city['tier']}"
