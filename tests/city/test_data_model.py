import json
from pathlib import Path
from city.data_model import CityData, Neighborhood, InsertCandidate, load_city_from_dict

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "cities"


def test_load_city_from_dict_tokyo():
    data = json.loads((FIXTURE_DIR / "tokyo.json").read_text())
    city = load_city_from_dict(data)
    assert city.id == "tokyo"
    assert city.name == "Tokyo"
    assert len(city.neighborhoods) >= 1
    assert city.timezone == "Asia/Tokyo"


def test_neighborhood_has_best_times():
    data = json.loads((FIXTURE_DIR / "tokyo.json").read_text())
    city = load_city_from_dict(data)
    nh = city.neighborhoods[0]
    assert isinstance(nh.best_times, dict)
    assert all(0.0 <= v <= 1.0 for v in nh.best_times.values())


def test_insert_candidates_have_required_fields():
    data = json.loads((FIXTURE_DIR / "tokyo.json").read_text())
    city = load_city_from_dict(data)
    for ic in city.insert_candidates:
        assert ic.type in ("coffee", "lunch", "scenic_walk", "rest", "micro")
        assert ic.time_cost_min > 0


def test_load_city_from_dict_nyc():
    data = json.loads((FIXTURE_DIR / "nyc.json").read_text())
    city = load_city_from_dict(data)
    assert city.id == "nyc"
    assert city.timezone == "America/New_York"
