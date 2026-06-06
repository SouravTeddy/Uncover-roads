"""On-demand city seeder.

Called by load_city() when a city is in city_whitelist but not yet seeded.
Calls build_city_seed() (~3–4s), stores to Supabase city_data,
marks city_whitelist.seeded = true.

All subsequent load_city() calls for the same city read from Supabase instantly.
"""
from __future__ import annotations

from city.data_model import CityData
from city.seed_builder import build_city_seed


def seed_city_on_demand(whitelist_row: dict, supabase) -> CityData:
    """Generate and store CityData for a whitelisted-but-unseeded city.

    Args:
        whitelist_row: Row from city_whitelist table.
                       Required keys: city_id, name, country_code, tier, lat, lon, timezone
        supabase: Supabase client instance

    Returns:
        CityData for the newly seeded city

    Raises:
        ValueError: if build_city_seed fails (propagated to caller)
    """
    city = build_city_seed(whitelist_row)

    city_dict = {
        "id": city.id,
        "name": city.name,
        "tier": city.tier,
        "center": list(city.center),
        "timezone": city.timezone,
        "climate": city.climate,
        "movement": city.movement,
        "culture": city.culture,
        "neighborhoods": [
            {"id": n.id, "name": n.name, "center": list(n.center),
             "polygon": [list(p) for p in n.polygon],
             "best_times": n.best_times, "crowd_index": n.crowd_index}
            for n in city.neighborhoods
        ],
        "insert_candidates": [
            {"place_id": ic.place_id, "name": ic.name, "lat": ic.lat, "lon": ic.lon,
             "type": ic.type, "time_cost_min": ic.time_cost_min,
             "persona_affinity": ic.persona_affinity, "trigger": ic.trigger,
             "time_of_day_match": ic.time_of_day_match}
            for ic in city.insert_candidates
        ],
        "scenic_routes": city.scenic_routes,
        "transit_edges": city.transit_edges,
        "engine_modifiers": city.engine_modifiers,
        "landmark_anchors": city.landmark_anchors,
        "hidden_gems": city.hidden_gems,
    }

    supabase.table("city_data").upsert({
        "id": city.id,
        "name": city.name,
        "country_code": whitelist_row["country_code"],
        "tier": city.tier,
        "data": city_dict,
    }).execute()

    supabase.table("city_whitelist").update(
        {"seeded": True}
    ).eq("city_id", city.id).execute()

    return city
