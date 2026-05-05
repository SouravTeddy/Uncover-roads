"""Layer 4: Insert detection.

Checks gap between consecutive stops. If gap meets persona-specific thresholds,
injects a non-user-added EngineStop of the appropriate type from city data.
"""
from __future__ import annotations
import math
from engine.types import EngineStop, EngineContext, EngineMessage
from city.data_model import InsertCandidate

_MIN_GAP_INSERT = 15        # minutes — absolute floor for any insert
_COFFEE_GAP_MIN = 180       # minutes since last coffee before injecting
_LUNCH_GAP_MIN = 60         # gap within 12:00–14:30 window
_REST_STOPS_THRESHOLD = 3   # consecutive stops before rest insert


def _gap_minutes(a: EngineStop, b: EngineStop) -> int:
    """Estimate gap as (b.scheduled_time - a.scheduled_time - a.duration_min).

    If a.scheduled_time is None, treat a as starting at 00:00.
    If b.scheduled_time is None, return 0.
    """
    if not b.scheduled_time:
        return 0
    bh, bm = (int(x) for x in b.scheduled_time.split(":"))
    b_start = bh * 60 + bm
    if a.scheduled_time:
        ah, am = (int(x) for x in a.scheduled_time.split(":"))
        a_end = ah * 60 + am + a.duration_min
    else:
        a_end = a.duration_min  # assume start at 00:00
    return max(0, b_start - a_end)


def _best_candidate(
    type_: str, ctx: EngineContext, near_lat: float, near_lon: float
) -> InsertCandidate | None:
    archetype = ctx.persona.get("archetype", "wanderer")
    candidates = [c for c in ctx.city.insert_candidates if c.type == type_]
    if not candidates:
        return None
    def _score(c: InsertCandidate) -> float:
        affinity = c.persona_affinity.get(archetype, 0.5)
        dist = math.hypot(c.lat - near_lat, c.lon - near_lon)
        return affinity - dist * 10
    return max(candidates, key=_score)


def _candidate_to_stop(c: InsertCandidate) -> EngineStop:
    return EngineStop(
        place_id=c.place_id,
        name=c.name,
        lat=c.lat,
        lon=c.lon,
        category=c.type,
        duration_min=c.time_cost_min,
        opening_hours=[],
        price_level=0,
        rating=0.0,
        neighborhood=None,
        is_user_added=False,
        type=c.type,
    )


def _make_insert_message(candidate: InsertCandidate, reason: str) -> EngineMessage:
    return EngineMessage(
        type="insert",
        what=f"Added {candidate.name} ({candidate.type}) to your itinerary.",
        why=reason,
        consequence=f"This adds ~{candidate.time_cost_min} minutes to your day.",
        dismissable=True,
        undo_key=f"insert_{candidate.place_id}",
    )


def detect(
    stops: list[EngineStop], ctx: EngineContext
) -> tuple[list[EngineStop], list[EngineMessage]]:
    weights = ctx.persona.get("weights", {})
    w_food = weights.get("w_food_density", 0.5)
    w_walk = weights.get("w_walk_affinity", 0.5)
    w_rest = weights.get("w_rest_need", 0.3)

    result: list[EngineStop] = []
    messages: list[EngineMessage] = []
    mins_since_coffee = 9999
    has_lunch_today = any(s.type == "lunch" for s in stops)
    consecutive = 0

    for i, stop in enumerate(stops):
        result.append(stop)
        if stop.type == "coffee":
            mins_since_coffee = 0
        mins_since_coffee += stop.duration_min
        consecutive += 1

        if i == len(stops) - 1:
            break  # no insert after last stop

        gap = _gap_minutes(stop, stops[i + 1])
        if gap < _MIN_GAP_INSERT:
            continue

        mid_lat = (stop.lat + stops[i + 1].lat) / 2
        mid_lon = (stop.lon + stops[i + 1].lon) / 2

        # Coffee insert
        if mins_since_coffee >= _COFFEE_GAP_MIN and w_food > 0.5:
            c = _best_candidate("coffee", ctx, mid_lat, mid_lon)
            if c:
                result.append(_candidate_to_stop(c))
                messages.append(_make_insert_message(c, f"No coffee in the last {mins_since_coffee} minutes."))
                mins_since_coffee = 0
                consecutive = 0
                continue

        # Scenic walk insert
        if w_walk > 0.7 and gap >= 10 and ctx.city.scenic_routes:
            route = next(
                (r for r in ctx.city.scenic_routes
                 if r.get("from_neighborhood") == stop.neighborhood
                 or r.get("to_neighborhood") == (stops[i + 1].neighborhood if i + 1 < len(stops) else None)),
                None
            )
            if route:
                c = _best_candidate("scenic_walk", ctx, mid_lat, mid_lon)
                if c:
                    result.append(_candidate_to_stop(c))
                    messages.append(_make_insert_message(c, "Scenic route detected between neighborhoods."))
                    consecutive = 0
                    continue

        # Lunch insert (12:00–14:30 window)
        if not has_lunch_today and gap >= _LUNCH_GAP_MIN and stop.scheduled_time:
            sh = int(stop.scheduled_time.split(":")[0])
            if 12 <= sh <= 14:
                c = _best_candidate("lunch", ctx, mid_lat, mid_lon)
                if c:
                    result.append(_candidate_to_stop(c))
                    messages.append(_make_insert_message(c, "Lunch window reached with no lunch planned."))
                    has_lunch_today = True
                    consecutive = 0
                    continue

        # Rest insert
        if w_rest > 0.7 and consecutive >= _REST_STOPS_THRESHOLD:
            c = _best_candidate("rest", ctx, mid_lat, mid_lon)
            if c:
                result.append(_candidate_to_stop(c))
                messages.append(_make_insert_message(c, f"You've visited {consecutive} stops without a break."))
                consecutive = 0

    return result, messages
