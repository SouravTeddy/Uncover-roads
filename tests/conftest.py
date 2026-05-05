import json
from pathlib import Path
from engine.types import EngineStop, EngineContext, EngineMessage
from city.data_model import CityData, load_city_from_dict

_FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _load_city_fixture(city_id: str) -> CityData:
    data = json.loads((_FIXTURE_DIR / "cities" / f"{city_id}.json").read_text())
    return load_city_from_dict(data)


def _load_persona_fixture(archetype: str) -> dict:
    return json.loads((_FIXTURE_DIR / "personas" / f"{archetype}.json").read_text())


def make_stop(
    place_id: str = "p1",
    name: str = "Test Place",
    lat: float = 35.6762,
    lon: float = 139.6503,
    category: str = "museum",
    duration_min: int = 90,
    opening_hours: list | None = None,
    price_level: int = 1,
    rating: float = 4.0,
    neighborhood: str = "shinjuku",
    is_user_added: bool = True,
    closing_hour: int | None = None,
    outdoor: bool | None = None,
    start_offset_min: int = 0,
) -> EngineStop:
    oh = opening_hours or []
    if closing_hour is not None:
        oh = [{"close": {"hour": closing_hour, "minute": 0}}]
    cat = category
    if outdoor is True and category == "museum":
        cat = "park"
    stop = EngineStop(
        place_id=place_id,
        name=name,
        lat=lat,
        lon=lon,
        category=cat,
        duration_min=duration_min,
        opening_hours=oh,
        price_level=price_level,
        rating=rating,
        neighborhood=neighborhood,
        is_user_added=is_user_added,
    )
    # store start_offset_min as scheduled_time for sequencer tests
    if start_offset_min:
        h, m = divmod(start_offset_min, 60)
        stop.scheduled_time = f"{h:02d}:{m:02d}"
    return stop


def make_ctx(
    archetype: str = "wanderer",
    persona_weights: dict | None = None,
    city_id: str = "tokyo",
    travel_dates: list[str] | None = None,
    weather: dict | None = None,
    arrival_time: str | None = None,
) -> EngineContext:
    persona = _load_persona_fixture(archetype)
    if persona_weights:
        persona["weights"].update(persona_weights)
    if arrival_time:
        persona["arrival_time"] = arrival_time
    city = _load_city_fixture(city_id)
    return EngineContext(
        persona=persona,
        city=city,
        travel_dates=travel_dates or ["2026-06-01"],
        weather=weather,
    )
