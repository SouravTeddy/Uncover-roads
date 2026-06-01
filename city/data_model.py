from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Neighborhood:
    id: str
    name: str
    center: tuple[float, float]
    polygon: list[tuple[float, float]]
    best_times: dict[str, float]     # time bucket → 0–1 score
    crowd_index: dict[str, float]    # 'weekday'|'weekend' → 0–1


@dataclass
class InsertCandidate:
    place_id: str
    name: str
    lat: float
    lon: float
    type: str                        # 'coffee'|'scenic_walk'|'lunch'|'rest'|'micro'
    time_cost_min: int
    persona_affinity: dict[str, float]
    trigger: str | None
    time_of_day_match: list[str]


@dataclass
class CityData:
    id: str
    name: str
    tier: int
    center: tuple[float, float]
    timezone: str
    climate: dict
    movement: dict
    culture: dict
    neighborhoods: list[Neighborhood]
    insert_candidates: list[InsertCandidate]
    scenic_routes: list[dict]
    transit_edges: list[dict]
    engine_modifiers: dict
    landmark_anchors: list[str]
    hidden_gems: list[str]


def _neighborhood_from_dict(d: dict) -> Neighborhood:
    return Neighborhood(
        id=d["id"],
        name=d["name"],
        center=tuple(d["center"]),
        polygon=[tuple(p) for p in d.get("polygon", [])],
        best_times=d.get("best_times", {}),
        crowd_index=d.get("crowd_index", {}),
    )


def _insert_candidate_from_dict(d: dict) -> InsertCandidate:
    return InsertCandidate(
        place_id=d["place_id"],
        name=d["name"],
        lat=d["lat"],
        lon=d["lon"],
        type=d["type"],
        time_cost_min=d["time_cost_min"],
        persona_affinity=d.get("persona_affinity", {}),
        trigger=d.get("trigger"),
        time_of_day_match=d.get("time_of_day_match", []),
    )


def load_city_from_dict(d: dict) -> CityData:
    return CityData(
        id=d["id"],
        name=d["name"],
        tier=d.get("tier", 1),
        center=tuple(d["center"]),
        timezone=d["timezone"],
        climate=d.get("climate", {}),
        movement=d.get("movement", {}),
        culture=d.get("culture", {}),
        neighborhoods=[_neighborhood_from_dict(n) for n in d.get("neighborhoods", [])],
        insert_candidates=[_insert_candidate_from_dict(c) for c in d.get("insert_candidates", [])],
        scenic_routes=d.get("scenic_routes", []),
        transit_edges=d.get("transit_edges", []),
        engine_modifiers=d.get("engine_modifiers", {}),
        landmark_anchors=d.get("landmark_anchors", []),
        hidden_gems=d.get("hidden_gems", []),
    )


def load_city(city_id: str, supabase=None) -> CityData:
    """Load CityData. On first miss, auto-seeds any whitelisted city via real-data pipeline.

    supabase-py 2.x: maybe_single().execute() returns the row dict directly (not APIResponse),
    or None when no rows match. Regular .execute() returns APIResponse with .data list.
    """
    if supabase is not None:
        # maybe_single returns the row dict directly, or None
        row = supabase.table("city_data").select("data").eq("id", city_id).maybe_single().execute()
        if row is not None:
            return load_city_from_dict(row["data"])
    seed_path = Path(__file__).parent / f"seed/{city_id}.json"
    if seed_path.exists():
        seed = json.loads(seed_path.read_text())
        if supabase is not None:
            try:
                supabase.table("city_data").upsert({
                    "id": city_id,
                    "name": seed.get("name", city_id),
                    "tier": seed.get("tier", 1),
                    "country_code": seed.get("country_code", ""),
                    "data": seed,
                }).execute()
            except Exception:
                pass  # non-fatal — frontend will still get data next call
        return load_city_from_dict(seed)
    if supabase is not None:
        wl = supabase.table("city_whitelist").select("*").eq("city_id", city_id).maybe_single().execute()
        if wl is not None:
            from city.on_demand_seeder import seed_city_on_demand
            return seed_city_on_demand(wl, supabase)
    raise ValueError(f"city_not_found: {city_id}")
