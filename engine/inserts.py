"""Layer 4: Insert detection.

Checks gap between consecutive stops. If gap meets persona-specific thresholds,
injects a non-user-added EngineStop of the appropriate type from city data.
"""
from __future__ import annotations
import math
from engine.types import EngineStop, EngineContext, EngineMessage
from city.data_model import InsertCandidate

_MIN_GAP_INSERT = 15        # minutes — absolute floor for any insert
_COFFEE_GAP_MIN = 180       # minutes since last rest stop before injecting a café break
                             # Calibrate: lower to 120 if users report "no café in long days"
_REST_STOPS_MAX = 5         # absolute max consecutive stops before rest insert for any persona
                             # Calibrate: raise if users report too many unwanted café breaks
_DINNER_INJECT_FLOOR_HOUR = 16  # don't inject post-loop dinner if day ends before 16:00
                                 # (day is too thin; other gaps should be addressed first)
_DINNER_MAX_HOUR = 20           # don't inject post-loop dinner if day ends after 20:00
                                 # (sequential scheduling would push dinner past 20:30)
_EARLY_DAY_CUTOFF_HOUR = 15     # if day ends before this hour, fill the afternoon gap
_EARLY_DAY_MAX_FILLS = 3        # max stops to inject when filling an early-ending day

# Proper meals only — café/coffee are rest, not dining
_DINING_CATS = {"restaurant", "food", "bakery", "street_food", "lunch", "dinner", "breakfast"}
# Rest/break stops — these satisfy coffee inserts but NOT meal detection
_REST_CATS = {"cafe", "coffee", "coffee_shop"}


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


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


_DINNER_FALLBACK_TYPES = ("lunch", "restaurant", "food", "street_food", "bakery")

def _best_candidate(
    type_: str, ctx: EngineContext, near_lat: float, near_lon: float,
    seen_ids: set[str] | None = None,
) -> InsertCandidate | None:
    archetype = ctx.persona.get("archetype", "wanderer")
    candidates = [c for c in ctx.city.insert_candidates if c.type == type_]
    if seen_ids:
        candidates = [c for c in candidates if c.place_id not in seen_ids]
    # Dinner fallback: any food-capable place works if no dinner-tagged candidate exists
    if not candidates and type_ == "dinner":
        candidates = [c for c in ctx.city.insert_candidates if c.type in _DINNER_FALLBACK_TYPES]
        if seen_ids:
            candidates = [c for c in candidates if c.place_id not in seen_ids]
    if not candidates:
        return None
    def _score(c: InsertCandidate) -> float:
        affinity = c.persona_affinity.get(archetype, 0.5)
        dist_km = _haversine_km(c.lat, c.lon, near_lat, near_lon)
        # Max 0.4 penalty for distance; affinity dominates at 0.7
        dist_penalty = min(1.0, dist_km / 5.0) * 0.4
        return affinity * 0.7 + (1.0 - dist_penalty) * 0.3
    return max(candidates, key=_score)


def _candidate_to_stop(c: InsertCandidate, city: str | None = None) -> EngineStop:
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
        city=city,
    )


def _make_insert_message(candidate: InsertCandidate, reason: str) -> EngineMessage:
    return EngineMessage(
        type="insert",
        what=f"Added {candidate.name} ({candidate.type}) to your itinerary.",
        why=reason,
        consequence=f"This adds ~{candidate.time_cost_min} minutes to your day.",
        dismissable=True,
        undo_key=f"insert_{candidate.place_id}",
        stop_id=candidate.place_id,
    )


def detect(
    stops: list[EngineStop], ctx: EngineContext
) -> tuple[list[EngineStop], list[EngineMessage]]:
    weights = ctx.persona.get("weights", {})
    w_walk = weights.get("w_walk_affinity", 0.5)
    w_rest = weights.get("w_rest_need", 0.3)

    # Rest threshold scales with w_rest: high-rest personas get breaks sooner.
    # w_rest=0.8 → 3 stops, w_rest=0.3 → 5 stops.
    rest_threshold = max(3, round(_REST_STOPS_MAX - w_rest * 2))

    result: list[EngineStop] = []
    messages: list[EngineMessage] = []
    mins_since_rest = 9999

    def _has_meal_in_window(hour_from: int, hour_to: int) -> bool:
        """Returns True if a proper meal (not café) is scheduled in the time window."""
        for s in stops:
            if s.scheduled_time:
                sh = int(s.scheduled_time.split(":")[0])
                if hour_from <= sh <= hour_to:
                    if s.type in _DINING_CATS or s.category in _DINING_CATS:
                        return True
        return False

    # Café/coffee stops satisfy rest but NOT lunch/dinner detection
    has_breakfast_today = _has_meal_in_window(6, 10)
    has_lunch_today = _has_meal_in_window(11, 14)
    # Dinner check: any dining stop in the evening window counts as dinner covered.
    # We check the full stops list, not just result, so user-added restaurants are included.
    has_dinner_today = _has_meal_in_window(17, 23)

    consecutive = 0
    seen_ids: set[str] = {s.place_id for s in stops if s.place_id}

    for i, stop in enumerate(stops):
        result.append(stop)
        if stop.category in _REST_CATS or stop.type in _REST_CATS:
            mins_since_rest = 0
        mins_since_rest += stop.duration_min
        consecutive += 1

        if i == len(stops) - 1:
            break  # no insert after last stop

        gap = _gap_minutes(stop, stops[i + 1])
        if gap < _MIN_GAP_INSERT:
            continue

        mid_lat = (stop.lat + stops[i + 1].lat) / 2
        mid_lon = (stop.lon + stops[i + 1].lon) / 2

        # Coffee/café insert — fires when no rest break in the last 3h.
        # Uses time-window only; mins_since_rest resets naturally when a café is encountered.
        if mins_since_rest >= _COFFEE_GAP_MIN:
            c = _best_candidate("coffee", ctx, mid_lat, mid_lon, seen_ids)
            if c:
                result.append(_candidate_to_stop(c, city=stop.city))
                coffee_reason = "No break yet today." if mins_since_rest >= 600 else f"No break in the last {mins_since_rest // 60}h {mins_since_rest % 60}m."
                messages.append(_make_insert_message(c, coffee_reason))
                seen_ids.add(c.place_id)
                mins_since_rest = 0
                consecutive = 0
                continue

        # Scenic walk insert — threshold lowered to >= 0.6 to include slowtraveller,
        # aesthete, slowscholar, explorer (was > 0.7 which silently cut slowtraveller=0.7)
        if w_walk >= 0.6 and gap >= 10 and ctx.city.scenic_routes:
            route = next(
                (r for r in ctx.city.scenic_routes
                 if r.get("from_neighborhood") == stop.neighborhood
                 or r.get("to_neighborhood") == (stops[i + 1].neighborhood if i + 1 < len(stops) else None)),
                None
            )
            if route:
                c = _best_candidate("scenic_walk", ctx, mid_lat, mid_lon, seen_ids)
                if c:
                    result.append(_candidate_to_stop(c, city=stop.city))
                    messages.append(_make_insert_message(c, "Scenic route detected between neighborhoods."))
                    seen_ids.add(c.place_id)
                    consecutive = 0
                    continue

        # Breakfast insert (7:00–10:00 window)
        if not has_breakfast_today and stop.scheduled_time:
            sh = int(stop.scheduled_time.split(":")[0])
            if 7 <= sh <= 10:
                c = _best_candidate("breakfast", ctx, mid_lat, mid_lon, seen_ids)
                if c:
                    result.append(_candidate_to_stop(c, city=stop.city))
                    messages.append(_make_insert_message(c, "Morning window reached with no breakfast planned."))
                    seen_ids.add(c.place_id)
                    has_breakfast_today = True
                    consecutive = 0
                    continue

        # Lunch insert (11:00–14:00 window) — café stops do NOT satisfy this
        if not has_lunch_today and stop.scheduled_time:
            sh = int(stop.scheduled_time.split(":")[0])
            if 11 <= sh <= 14:
                c = _best_candidate("lunch", ctx, mid_lat, mid_lon, seen_ids)
                if c:
                    result.append(_candidate_to_stop(c, city=stop.city))
                    messages.append(_make_insert_message(c, "Lunch window reached with no meal planned."))
                    seen_ids.add(c.place_id)
                    has_lunch_today = True
                    consecutive = 0
                    continue

        # Dinner insert (18:00–20:00 window) — café stops do NOT satisfy this
        if not has_dinner_today and stop.scheduled_time:
            sh = int(stop.scheduled_time.split(":")[0])
            if 18 <= sh <= 20:
                c = _best_candidate("dinner", ctx, mid_lat, mid_lon, seen_ids)
                if c:
                    result.append(_candidate_to_stop(c, city=stop.city))
                    messages.append(_make_insert_message(c, "Evening window reached with no dinner planned."))
                    seen_ids.add(c.place_id)
                    has_dinner_today = True
                    consecutive = 0
                    continue

        # Rest insert — fires for all personas; threshold is persona-scaled
        if consecutive >= rest_threshold:
            c = _best_candidate("rest", ctx, mid_lat, mid_lon, seen_ids)
            if c:
                result.append(_candidate_to_stop(c, city=stop.city))
                messages.append(_make_insert_message(c, f"You've visited {consecutive} stops without a break."))
                seen_ids.add(c.place_id)
                mins_since_rest = 0
                consecutive = 0

    # Post-loop: if no dining stop exists in the evening window, always inject dinner.
    # No timing-window guard — the scheduler re-sequences stops anyway and will place
    # dinner after the last stop at whatever time the day ends.
    if not has_dinner_today and result:
        last = result[-1]
        c = _best_candidate("dinner", ctx, last.lat, last.lon, seen_ids)
        if c:
            result.append(_candidate_to_stop(c, city=last.city))
            messages.append(_make_insert_message(c, "No restaurant in your plan — added dinner to close the day."))
            seen_ids.add(c.place_id)

    # Early-day gap fill: if the day ends before _EARLY_DAY_CUTOFF_HOUR (15:00) and the user
    # has added few stops, inject afternoon candidates to fill the empty hours rather than
    # leaving the plan dead. We try: coffee break → afternoon attraction → then let the
    # post-loop dinner check above handle evening. Cap at _EARLY_DAY_MAX_FILLS to avoid bloat.
    if result:
        last = result[-1]
        if last.scheduled_time:
            lh, lm = (int(x) for x in last.scheduled_time.split(":"))
            last_end_min = lh * 60 + lm + last.duration_min
            if last_end_min < _EARLY_DAY_CUTOFF_HOUR * 60:
                fills = 0
                # 1. Coffee/café break if no recent rest
                if mins_since_rest >= _COFFEE_GAP_MIN and fills < _EARLY_DAY_MAX_FILLS:
                    c = _best_candidate("coffee", ctx, last.lat, last.lon, seen_ids)
                    if c:
                        result.append(_candidate_to_stop(c, city=last.city))
                        messages.append(_make_insert_message(c, "Added a break to fill your afternoon."))
                        seen_ids.add(c.place_id)
                        last = result[-1]
                        fills += 1

                # 2. Afternoon attraction (try scenic_walk, rest, then any available candidate)
                for fill_type in ("scenic_walk", "rest", "coffee", "lunch"):
                    if fills >= _EARLY_DAY_MAX_FILLS:
                        break
                    c = _best_candidate(fill_type, ctx, last.lat, last.lon, seen_ids)
                    if c:
                        result.append(_candidate_to_stop(c, city=last.city))
                        messages.append(_make_insert_message(c, "Added an afternoon stop to fill your day."))
                        seen_ids.add(c.place_id)
                        last = result[-1]
                        fills += 1

                # 3. Dinner handled unconditionally by the post-loop block above.

    return result, messages
