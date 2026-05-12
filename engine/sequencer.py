"""Layer 2: Sequence optimization.

Groups stops by neighborhood, solves TSP within each cluster (exact, small N),
orders clusters by time-of-day score, assigns scheduled_time to every stop.
"""
from __future__ import annotations
import itertools
import math
from engine.types import EngineStop, EngineContext, EngineMessage

_START_HOUR = 9   # default day start if persona has no arrival_time
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


def _assign_scheduled_times(stops: list[EngineStop], ctx: EngineContext) -> list[EngineStop]:
    start_h = int(ctx.persona.get("arrival_time", f"{_START_HOUR:02d}:00").split(":")[0])
    current_min = start_h * 60
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


def optimize(
    stops: list[EngineStop], ctx: EngineContext
) -> tuple[list[EngineStop], list[EngineMessage]]:
    if len(stops) <= 1:
        result = _assign_scheduled_times(list(stops), ctx)
        return result, []

    groups = _group_by_neighborhood(stops)
    # Solve TSP within each neighborhood cluster
    optimized_groups = {nh: _solve_tsp(group) for nh, group in groups.items()}
    # Order clusters by morning score (descending)
    def _cluster_score(nh_stops: tuple[str, list[EngineStop]]) -> float:
        nh_id, _ = nh_stops
        return _neighborhood_time_score(nh_id, "morning", ctx.city)

    ordered = sorted(optimized_groups.items(), key=_cluster_score, reverse=True)
    flat = [stop for _, group in ordered for stop in group]
    messages = _emit_resequence_messages(stops, flat)
    flat = _assign_scheduled_times(flat, ctx)
    return flat, messages
