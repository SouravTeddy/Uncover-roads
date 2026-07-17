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
    price_level: int | None = None   # Google price_level: 1=cheap 2=moderate 3=exp 4=very exp
    rating_count: int | None = None  # Google user_ratings_total — proxy for popularity/crowds


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
        price_level=d.get("price_level"),
        rating_count=d.get("rating_count"),
    )


def load_city_from_dict(d: dict) -> CityData:
    return CityData(
        id=d["id"],
        name=d["name"],
        tier=d.get("tier", 1),
        center=tuple(d["center"]),
        timezone=d.get("timezone", "UTC"),
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


def _maybe_single_data(response) -> dict | None:
    """Normalize maybe_single().execute() across supabase-py versions.

    - supabase-py 1.x: returns the row dict directly, or None when no match.
    - supabase-py 2.x: returns SyncSingleAPIResponse; row dict is at .data, None when no match.
    """
    if response is None:
        return None
    if hasattr(response, "data"):
        return response.data  # 2.x SyncSingleAPIResponse
    return response  # 1.x — response IS the dict


def _ensure_walk_base_km(city: "CityData", supabase=None) -> "CityData":
    """Lazily compute and backfill walk_base_km for cities seeded before this field existed.

    If movement.walk_base_km is missing, queries Overpass for real pedestrian infrastructure
    density, computes the threshold, and writes it back to the DB row.  Subsequent loads
    will hit the cache and skip Overpass entirely.

    Returns the CityData with walk_base_km populated (may be the same object if already set).
    """
    if city.movement.get("walk_base_km") is not None:
        return city

    from city.seed_builder import _fetch_footway_density, _walk_base_km_from_density

    lat, lon = city.center
    density = _fetch_footway_density(lat, lon)
    walk_base_km = _walk_base_km_from_density(density)

    city.movement["walk_base_km"] = walk_base_km

    if supabase is not None:
        try:
            row = supabase.table("city_data").select("data").eq("id", city.id).maybe_single().execute()
            row_data = _maybe_single_data(row)
            if row_data is not None:
                stored = row_data["data"]
                stored.setdefault("movement", {})["walk_base_km"] = walk_base_km
                supabase.table("city_data").update({"data": stored}).eq("id", city.id).execute()
        except Exception as e:
            print(f"WALK BASE KM BACKFILL: {e}")

    return city


def load_city(city_id: str, supabase=None) -> "CityData":
    """Load CityData. On first miss, auto-seeds any whitelisted city via real-data pipeline.

    Lazily backfills walk_base_km from Overpass if the stored city predates that field.
    """
    if supabase is not None:
        row = supabase.table("city_data").select("data").eq("id", city_id).maybe_single().execute()
        row_data = _maybe_single_data(row)
        if row_data is not None:
            city = load_city_from_dict(row_data["data"])
            return _ensure_walk_base_km(city, supabase)
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
        city = load_city_from_dict(seed)
        return _ensure_walk_base_km(city, supabase)
    if supabase is not None:
        wl = supabase.table("city_whitelist").select("*").eq("city_id", city_id).maybe_single().execute()
        wl_data = _maybe_single_data(wl)
        if wl_data is not None:
            from city.on_demand_seeder import seed_city_on_demand
            return seed_city_on_demand(wl_data, supabase)
    raise ValueError(f"city_not_found: {city_id}")
