"""Layer 2: Sequence optimization.

Groups stops by neighborhood, solves TSP within each cluster (exact, small N),
orders clusters by time-of-day score, assigns scheduled_time to every stop.
"""
from __future__ import annotations
import itertools
import math
from engine.types import EngineStop, EngineContext, EngineMessage

_TRANSIT_MIN_PER_KM = 3.0  # minutes per km for transit cost


def _haversine_km(a: EngineStop, b: EngineStop) -> float:
    R = 6371.0
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _solve_tsp(stops: list[EngineStop]) -> list[EngineStop]:
    """Exact TSP for small N (≤ 8). Nearest-neighbor for larger N."""
    if len(stops) <= 1:
        return stops
    if len(stops) <= 8:
        best_order, best_cost = stops, float("inf")
        for perm in itertools.permutations(stops):
            cost = sum(_haversine_km(perm[i], perm[i + 1]) for i in range(len(perm) - 1))
            if cost < best_cost:
                best_cost, best_order = cost, list(perm)
        return best_order
    # nearest-neighbor greedy for N > 8
    remaining = list(stops)
    result = [remaining.pop(0)]
    while remaining:
        last = result[-1]
        nearest = min(remaining, key=lambda s: _haversine_km(last, s))
        remaining.remove(nearest)
        result.append(nearest)
    return result


def _group_by_neighborhood(stops: list[EngineStop]) -> dict[str, list[EngineStop]]:
    groups: dict[str, list[EngineStop]] = {}
    for stop in stops:
        key = stop.neighborhood or "_unknown"
        groups.setdefault(key, []).append(stop)
    return groups


def _neighborhood_time_score(nh_id: str, time_bucket: str, city) -> float:
    for nh in city.neighborhoods:
        if nh.id == nh_id:
            return nh.best_times.get(time_bucket, 0.5)
    return 0.5


def _persona_start_min(ctx: EngineContext) -> int:
    """Compute day start in minutes-from-midnight from persona weights."""
    w = ctx.persona.get("weights", {})
    sf = 9.0 + (w.get("w_rest_need", 0.4) - 0.5) * 2.0 \
             + (w.get("w_nightlife", 0.4) - 0.4) * 2.5 \
             - (w.get("w_efficiency", 0.5) - 0.5) * 2.0
    sf = max(7.5, min(11.5, sf))
    start_h = int(sf)
    start_m = round((sf - start_h) * 60 / 15) * 15
    if start_m >= 60:
        start_h += 1
        start_m = 0
    return start_h * 60 + start_m


def _assign_scheduled_times(stops: list[EngineStop], ctx: EngineContext) -> list[EngineStop]:
    current_min = _persona_start_min(ctx)
    buffer_min = ctx.persona.get("day_buffer_min", 30)
    for stop in stops:
        h, m = divmod(int(current_min), 60)
        stop.scheduled_time = f"{h:02d}:{m:02d}"
        current_min += stop.duration_min + buffer_min
    return stops


def _emit_resequence_messages(
    original: list[EngineStop], resequenced: list[EngineStop]
) -> list[EngineMessage]:
    original_ids = [s.place_id for s in original]
    new_ids = [s.place_id for s in resequenced]
    if original_ids == new_ids:
        return []
    return [
        EngineMessage(
            type="resequence",
            what="Stop order optimized to minimize travel between neighborhoods.",
            why="Grouping nearby stops reduces transit time and backtracking.",
            consequence="Your itinerary now flows more efficiently through the city.",
            dismissable=True,
            undo_key=None,
        )
    ]


# Categories that work well as first stop of the day (high score = earlier)
_MORNING_AFFINITY: dict[str, float] = {
    "museum": 0.9, "gallery": 0.8, "historic": 0.9, "landmark": 0.85,
    "temple": 1.0, "shrine": 1.0, "castle": 0.9, "monument": 0.8,
    "park": 0.85, "garden": 0.8, "viewpoint": 0.95, "beach": 0.7,
    "market": 0.9,
    # Neutral
    "shopping": 0.5, "hotel": 0.5,
    # Bad morning starts — pushed toward afternoon/evening
    "restaurant": 0.3, "cafe": 0.4, "bar": 0.1, "nightlife": 0.05,
    "spa": 0.2, "wellness": 0.2, "massage": 0.15,
}


def _first_stop_score(stop: EngineStop) -> float:
    return _MORNING_AFFINITY.get(stop.category.lower(), 0.5)


def _optimize_within_city(stops: list[EngineStop], ctx: EngineContext) -> list[EngineStop]:
    """TSP + morning-affinity sort for a single city's stops."""
    if len(stops) <= 1:
        return list(stops)

    groups = _group_by_neighborhood(stops)
    optimized_groups = {nh: _solve_tsp(group) for nh, group in groups.items()}

    def _cluster_score(nh_stops: tuple[str, list[EngineStop]]) -> float:
        nh_id, group = nh_stops
        nh_score = _neighborhood_time_score(nh_id, "morning", ctx.city)
        best_first = max(_first_stop_score(s) for s in group)
        return nh_score * 0.5 + best_first * 0.5

    ordered = sorted(optimized_groups.items(), key=_cluster_score, reverse=True)
    result = [stop for _, group in ordered for stop in group]

    # Best morning-appropriate stop leads the first cluster
    first_cluster = ordered[0][1] if ordered else []
    if len(first_cluster) > 1:
        best_idx = max(range(len(first_cluster)), key=lambda i: _first_stop_score(first_cluster[i]))
        if best_idx != 0:
            first_cluster[0], first_cluster[best_idx] = first_cluster[best_idx], first_cluster[0]
        result = first_cluster + result[len(first_cluster):]

    return result


def optimize(
    stops: list[EngineStop], ctx: EngineContext
) -> tuple[list[EngineStop], list[EngineMessage]]:
    if len(stops) <= 1:
        result = _assign_scheduled_times(list(stops), ctx)
        return result, []

    # Group stops by city, preserving the user's city order (first-occurrence).
    # For multi-city trips this ensures Kyoto → Tokyo order is never flipped by TSP.
    city_order: list[str] = []
    city_stop_map: dict[str, list[EngineStop]] = {}
    for stop in stops:
        key = stop.city or "_unknown"
        if key not in city_stop_map:
            city_stop_map[key] = []
            city_order.append(key)
        city_stop_map[key].append(stop)

    flat: list[EngineStop] = []
    for city_key in city_order:
        flat.extend(_optimize_within_city(city_stop_map[city_key], ctx))

    messages = _emit_resequence_messages(stops, flat)
    flat = _assign_scheduled_times(flat, ctx)
    return flat, messages
