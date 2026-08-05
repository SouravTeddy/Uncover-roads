"""Builder: orchestrates all 5 engine layers + narrator.

build_itinerary(stops, ctx) → EngineResult
"""
from __future__ import annotations
import math
import uuid
from engine.types import EngineStop, EngineContext, EngineMessage, EngineDay, EngineResult
from engine import constraints, sequencer, transitions, inserts, swapper
from engine import narrator as _narrator
from engine import tags as _tags
from engine import weather as _weather
from engine import ramadan as _ramadan


def _haversine_km(a: EngineStop, b: EngineStop) -> float:
    R = 6371.0
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _ensure_scheduled_times(stops: list[EngineStop], ctx: EngineContext) -> list[EngineStop]:
    """Final pass: assign scheduled_time to any stops that don't have it.

    This is needed because inserts.detect() may add stops that bypass sequencer's
    time assignment. We fill in the gaps using the same logic as sequencer.
    """
    # Find the earliest and latest scheduled times in existing stops
    scheduled = [s for s in stops if s.scheduled_time]
    if not scheduled:
        # No scheduled times set yet (shouldn't happen after sequencer, but handle it)
        _w = ctx.persona.get("weights", {})
        _sf = 9.0 + (_w.get("w_rest_need", 0.4) - 0.5) * 2.0 + (_w.get("w_nightlife", 0.4) - 0.4) * 2.5 - (_w.get("w_efficiency", 0.5) - 0.5) * 2.0
        start_h = int(max(7.5, min(11.5, _sf)))
        current_min = start_h * 60
    else:
        # Start from the latest scheduled stop + its duration
        last_scheduled = max(scheduled, key=lambda s: int(s.scheduled_time.split(":")[0]) * 60 + int(s.scheduled_time.split(":")[1]))
        lh, lm = (int(x) for x in last_scheduled.scheduled_time.split(":"))
        current_min = lh * 60 + lm + last_scheduled.duration_min

    buffer_min = ctx.persona.get("day_buffer_min", 30)
    for stop in stops:
        if stop.scheduled_time is None:
            h, m = divmod(int(current_min), 60)
            stop.scheduled_time = f"{h:02d}:{m:02d}"
            current_min += stop.duration_min + buffer_min

    return stops


def _schedule_day_stops(day_stops: list[EngineStop], start_h: int, start_m: int, buffer_min: int) -> None:
    current_min = start_h * 60 + start_m
    for stop in day_stops:
        h, m = divmod(current_min, 60)
        stop.scheduled_time = f"{h:02d}:{m:02d}"
        current_min += stop.duration_min + buffer_min


def _time_str_to_min(t: str) -> int:
    h, m = (int(x) for x in t.split(":"))
    return h * 60 + m


def _compute_day_start(first_stop: "EngineStop", ctx: "EngineContext", date_str: str) -> int:
    """Compute day start time in minutes from midnight.

    Driven by the first stop's morning affinity (its category) and actual
    opening hours from Places data. Persona weights apply a ±45 min shift.
    No city-level defaults — everything comes from what's actually pinned.
    """
    from datetime import datetime as _dt
    morning_score = sequencer._first_stop_score(first_stop)
    # temple (1.0) → 7:30 AM base; nightlife (0.05) → 10:21 AM base
    base = 7.5 + (1.0 - morning_score) * 3.0

    weights = ctx.persona.get("weights", {})
    w_rest  = weights.get("w_rest_need", 0.4)
    w_night = weights.get("w_nightlife", 0.4)
    w_eff   = weights.get("w_efficiency", 0.5)
    delta = (w_rest - 0.5) * 1.5 + (w_night - 0.4) * 1.0 - (w_eff - 0.5) * 1.0

    start_float = max(6.0, min(23.0, base + delta))
    start_min   = round(start_float * 60 / 15) * 15

    # Hard floor: don't schedule arrival before the first stop actually opens
    try:
        weekday = _dt.fromisoformat(date_str).weekday()
        oh = next((h for h in (first_stop.opening_hours or []) if h.get("day") == weekday), None)
        if oh:
            open_min = oh.get("open_min")
            if open_min is not None:
                start_min = max(start_min, open_min)
    except (ValueError, TypeError, AttributeError):
        pass

    return start_min


def _propagate_opening_constraints(stops: list["EngineStop"], base_start: int, buffer_min: int, weekday: int) -> int:
    """Advance base_start so that every stop with opening_hours is visited after it opens.

    Iterates forward through stops, tracking the cumulative time offset, and bumps
    base_start whenever a stop would be scheduled before its opening time.
    Returns the adjusted start (in minutes from midnight).
    """
    cur_offset = 0
    adjusted = base_start
    for stop in stops:
        oh = next((h for h in (stop.opening_hours or []) if h.get("day") == weekday), None)
        if oh:
            open_min = oh.get("open_min")
            if open_min is not None:
                required_start = open_min - _HOUR_TOLERANCE_MIN - cur_offset
                if required_start > adjusted:
                    adjusted = required_start
        cur_offset += stop.duration_min + buffer_min
    return adjusted


def _reschedule_day(day: "EngineDay", ctx: EngineContext, start_override: tuple[int, int] | None = None) -> None:
    """Re-assign scheduled_time to all stops in a day after an in-day reorder."""
    from datetime import datetime as _dt
    if start_override is not None:
        start_h, start_m = start_override
    elif day.stops:
        sm = _compute_day_start(day.stops[0], ctx, day.date)
        try:
            weekday = _dt.fromisoformat(day.date).weekday()
        except (ValueError, TypeError):
            weekday = 0
        buffer_min = int(ctx.persona.get("day_buffer_min", 30))
        sm = _propagate_opening_constraints(day.stops, sm, buffer_min, weekday)
        start_h, start_m = sm // 60, sm % 60
    else:
        start_h, start_m = 9, 0
    buffer_min = int(ctx.persona.get("day_buffer_min", 30))
    _schedule_day_stops(day.stops, start_h, start_m, buffer_min)


_HOUR_TOLERANCE_MIN = 15  # allow 15-min window before/after hours


def _non_day1_start_min(day_stops: list["EngineStop"], ctx: "EngineContext", date: str) -> int:
    """Compute the day-start minute for day 2+ of a trip.

    Uses persona["arrival_time"] as the preferred daily start, falling back to
    _compute_day_start, then applies opening-hour constraint propagation so no
    stop is ever visited before it opens.
    """
    from datetime import datetime as _dt
    pa = ctx.persona.get("arrival_time")
    if pa:
        try:
            ph, pm = (int(x) for x in pa.split(":")[:2])
            sm = ph * 60 + pm
        except (ValueError, AttributeError):
            sm = _compute_day_start(day_stops[0], ctx, date)
    else:
        sm = _compute_day_start(day_stops[0], ctx, date)
    try:
        weekday = _dt.fromisoformat(date).weekday()
        buffer_min = int(ctx.persona.get("day_buffer_min", 30))
        sm = _propagate_opening_constraints(day_stops, sm, buffer_min, weekday)
    except (ValueError, TypeError):
        pass
    return sm


def enforce_opening_hours(
    days: list[EngineDay], ctx: EngineContext
) -> tuple[list[EngineDay], list[EngineMessage], set[str]]:
    """Option A: reorder stops within each day so no stop is visited before it opens.

    Returns (updated_days, messages, conflicted_place_ids).
    conflicted_place_ids are stops that still have violations after all swap attempts
    and are passed to apply_swapper for replacement.
    """
    from datetime import datetime as _dt
    messages: list[EngineMessage] = []
    conflicted: set[str] = set()

    for _day_idx, day in enumerate(days):
        if day.is_travel_day or not day.stops:
            continue
        try:
            weekday = _dt.fromisoformat(day.date).weekday()  # 0=Monday
        except (ValueError, TypeError):
            continue

        # Multiple passes — each pass attempts one swap, stops when nothing changes
        for _pass in range(len(day.stops)):
            made_swap = False
            for i, stop in enumerate(day.stops):
                oh = next(
                    (h for h in (stop.opening_hours or []) if h.get("day") == weekday),
                    None,
                )
                if not oh:
                    continue
                open_min = oh.get("open_min", 0)
                close_min = oh.get("close_min", 1440)
                sched_min = _time_str_to_min(stop.scheduled_time or "09:00")
                end_min = sched_min + stop.duration_min

                in_window = (
                    sched_min >= open_min - _HOUR_TOLERANCE_MIN
                    and end_min <= close_min + _HOUR_TOLERANCE_MIN
                )
                if in_window:
                    continue

                # Try swapping with each subsequent stop to find one that resolves this
                resolved = False
                for j in range(i + 1, len(day.stops)):
                    day.stops[i], day.stops[j] = day.stops[j], day.stops[i]
                    _d1_override = (
                        _day1_adjusted_start(ctx.user_arrival_time, ctx.user_start_type or "hotel")
                        if _day_idx == 0 and ctx.user_arrival_time
                        else None
                    )
                    _reschedule_day(day, ctx, start_override=_d1_override)
                    # Check whether the originally-problematic stop (now at position j) is fixed
                    stop_oh = next(
                        (h for h in (stop.opening_hours or []) if h.get("day") == weekday),
                        None,
                    )
                    new_stop_sched = _time_str_to_min(day.stops[j].scheduled_time or "09:00")
                    new_stop_end = new_stop_sched + day.stops[j].duration_min
                    fixed = stop_oh is None or (
                        new_stop_sched >= (stop_oh.get("open_min", 0) - _HOUR_TOLERANCE_MIN)
                        and new_stop_end <= (stop_oh.get("close_min", 1440) + _HOUR_TOLERANCE_MIN)
                    )
                    # Also ensure the stop moved into position i is valid in its new (earlier) slot
                    if fixed:
                        candidate = day.stops[i]
                        cand_oh = next(
                            (h for h in (candidate.opening_hours or []) if h.get("day") == weekday),
                            None,
                        )
                        if cand_oh:
                            cand_sched = _time_str_to_min(candidate.scheduled_time or "09:00")
                            cand_end = cand_sched + candidate.duration_min
                            if not (
                                cand_sched >= cand_oh.get("open_min", 0) - _HOUR_TOLERANCE_MIN
                                and cand_end <= cand_oh.get("close_min", 1440) + _HOUR_TOLERANCE_MIN
                            ):
                                fixed = False
                    if fixed:
                        messages.append(EngineMessage(
                            type="resequence",
                            what=f"Moved {stop.name} to a later slot.",
                            why=(
                                f"{stop.name} opens at "
                                f"{open_min // 60:02d}:{open_min % 60:02d} — "
                                f"its original slot was too early."
                            ),
                            consequence=(
                                f"Your day now starts with {day.stops[i].name}, "
                                f"which is already open."
                            ),
                            dismissable=True,
                            undo_key=f"resequence_{stop.place_id}",
                            stop_id=stop.place_id,
                        ))
                        resolved = True
                        made_swap = True
                        break
                    else:
                        # Undo the swap
                        day.stops[i], day.stops[j] = day.stops[j], day.stops[i]
                        _reschedule_day(day, ctx, start_override=_d1_override)

                if not resolved and stop.place_id:
                    conflicted.add(stop.place_id)
                    continue  # continue to next stop; swapper will replace this one

            if not made_swap:
                break  # stable — no more swaps possible

    return days, messages, conflicted


def apply_swapper(
    days: list[EngineDay],
    ctx: EngineContext,
    conflicted: set[str],
) -> tuple[list[EngineDay], list[EngineMessage]]:
    """Option C: replace stops that enforce_opening_hours couldn't fix.

    Uses insert_candidates scored by persona affinity × proximity.
    If no replacement found, keeps the original and emits an advisory.
    """
    from engine.swapper import _find_alternatives
    messages: list[EngineMessage] = []

    if not conflicted:
        return days, messages

    all_place_ids: set[str] = {
        s.place_id for d in days for s in d.stops if s.place_id
    }

    for day in days:
        if day.is_travel_day:
            continue
        for i, stop in enumerate(day.stops):
            if stop.place_id not in conflicted:
                continue

            excluded = all_place_ids - {stop.place_id}
            scored = _find_alternatives(stop, ctx, excluded)

            if not scored:
                messages.append(EngineMessage(
                    type="advisory",
                    what=f"{stop.name} has a scheduling conflict we couldn't resolve automatically.",
                    why="Its opening hours don't fit any available time slot, and no suitable alternative was found nearby.",
                    consequence="Check hours before visiting — it may open later than scheduled.",
                    dismissable=True,
                    undo_key=None,
                    stop_id=stop.place_id,
                ))
                continue

            best_score, best_ic = scored[0]
            replacement = EngineStop(
                place_id=best_ic.place_id,
                name=best_ic.name,
                lat=best_ic.lat,
                lon=best_ic.lon,
                category=best_ic.type,
                duration_min=best_ic.time_cost_min,
                opening_hours=[],
                price_level=1,
                rating=4.0,
                neighborhood=None,
                is_user_added=False,
                scheduled_time=stop.scheduled_time,
                city=stop.city,
                rating_count=best_ic.rating_count,
            )
            day.stops[i] = replacement
            all_place_ids.discard(stop.place_id)
            all_place_ids.add(replacement.place_id or "")

            messages.append(EngineMessage(
                type="swap",
                what=f"Replaced {stop.name} with {replacement.name}.",
                why=f"{stop.name}'s opening hours don't fit your {stop.scheduled_time} visit slot.",
                consequence=(
                    f"{replacement.name} is nearby and matches your "
                    f"{ctx.persona.get('archetype', 'explorer')} profile."
                ),
                dismissable=True,
                undo_key=f"swap_{stop.place_id}",
                stop_id=stop.place_id,
            ))

    return days, messages


_TRANSIT_BUFFER_BY_START_TYPE: dict[str, int] = {
    "airport": 45,   # airport → city centre (train/bus ~45 min)
    "hotel":   30,   # already in city, check-in + freshen up
    "custom":   0,   # user is already at the start location
}


def _day1_adjusted_start(user_arrival_time: str, start_type: str = "hotel") -> tuple[int, int]:
    """Compute day-1 start from user arrival time + start-type transit buffer.

    00:00-05:59 → 09:00 (rest needed after overnight travel)
    06:00-08:59 → arrival + transit_buffer + 30 min (freshen up)
    09:00-16:59 → arrival + transit_buffer (standard)
    17:00+      → 09:00 next morning (evening/night arrival)
    """
    try:
        ah, am = (int(x) for x in user_arrival_time.split(":")[:2])
    except (ValueError, TypeError):
        return 9, 0
    arr_min = ah * 60 + am
    transit = _TRANSIT_BUFFER_BY_START_TYPE.get(start_type or "hotel", 30)
    if arr_min < 6 * 60:
        return 9, 0
    elif arr_min < 9 * 60:
        adj = arr_min + transit + 30
    elif arr_min < 17 * 60:
        adj = arr_min + transit
    else:
        return 9, 0
    adj = min(adj, 22 * 60)  # cap at 22:00
    return adj // 60, adj % 60


def _apply_departure_pressure(days: list["EngineDay"], ctx: EngineContext) -> list["EngineDay"]:
    """Trim stops on the last day that would run past user_departure_time."""
    if not ctx.user_departure_time or not days:
        return days
    try:
        dh, dm = (int(x) for x in ctx.user_departure_time.split(":")[:2])
    except (ValueError, AttributeError):
        return days
    cutoff = dh * 60 + dm
    last_day = days[-1]
    kept = []
    for stop in last_day.stops:
        if not stop.scheduled_time:
            kept.append(stop)
            continue
        sh, sm = (int(x) for x in stop.scheduled_time.split(":"))
        end = sh * 60 + sm + stop.duration_min
        if end <= cutoff:
            kept.append(stop)
    last_day.stops = kept
    return days


def _split_into_days(stops: list[EngineStop], ctx: EngineContext) -> list[EngineDay]:
    """Distribute stops across travel_dates, grouping by city for multi-city trips.

    Single-city: distribute stops evenly across all dates.
    Multi-city: group stops by city, allocate dates proportionally per city,
    so city transitions always fall between days (enabling transit cards).
    """
    dates = ctx.travel_dates
    if not dates:
        return [EngineDay(date="unknown", stops=stops)]

    buffer_min = int(ctx.persona.get("day_buffer_min", 30))

    # Group stops by city, preserving optimized order within each city.
    city_order: list[str] = []
    city_stop_map: dict[str, list[EngineStop]] = {}
    for stop in stops:
        city = stop.city or "__unknown__"
        if city not in city_stop_map:
            city_stop_map[city] = []
            city_order.append(city)
        city_stop_map[city].append(stop)

    city_groups = [(c, city_stop_map[c]) for c in city_order]
    n_cities = len(city_groups)
    total_days = len(dates)

    if n_cities == 1:
        # Single city — distribute evenly across dates. Every day gets its own
        # date, scheduled fresh from a sane per-day start time — never carried
        # forward or merged onto a previous day's date. (A "continue same day"
        # heuristic used to decide this from each day's pre-reco end time, but
        # dinner/rest recommendations are injected later in main.py, so it
        # systematically misjudged days that would later fill out as "light,"
        # sometimes collapsing an entire multi-day trip onto one date.)
        per_day = max(1, len(stops) // total_days)
        days: list[EngineDay] = []
        for i, date in enumerate(dates):
            slice_start = i * per_day
            slice_end = slice_start + per_day if i < total_days - 1 else len(stops)
            day_stops = stops[slice_start:slice_end]
            if i == 0 and ctx.user_arrival_time:
                _d1h, _d1m = _day1_adjusted_start(ctx.user_arrival_time, ctx.user_start_type or "hotel")
                _schedule_day_stops(day_stops, _d1h, _d1m, buffer_min)
            elif day_stops:
                sm = _non_day1_start_min(day_stops, ctx, date)
                _schedule_day_stops(day_stops, sm // 60, sm % 60, buffer_min)

            days.append(EngineDay(date=date, stops=day_stops))
        return days

    # Multi-city: allocate dates proportionally, minimum 1 day per city
    total_stops = max(len(stops), 1)
    city_days: list[int] = []
    remaining = total_days
    for i, (city, city_stops) in enumerate(city_groups):
        if i == n_cities - 1:
            city_days.append(remaining)
        else:
            alloc = max(1, round(len(city_stops) / total_stops * total_days))
            alloc = min(alloc, remaining - (n_cities - 1 - i))
            city_days.append(alloc)
            remaining -= alloc

    days = []
    date_idx = 0
    global_day_idx = 0
    for city_idx, ((city, city_stops), n_days) in enumerate(zip(city_groups, city_days)):
        n_days = max(1, n_days)
        per_day = max(1, len(city_stops) // n_days)
        for j in range(n_days):
            # Ran out of allocated dates (rounding can occasionally overshoot) —
            # fall back to reusing the last date rather than crashing.
            if date_idx >= total_days:
                date = dates[-1]
            else:
                date = dates[date_idx]
            date_idx += 1

            slice_start = j * per_day
            slice_end = slice_start + per_day if j < n_days - 1 else len(city_stops)
            day_stops = city_stops[slice_start:slice_end]
            if global_day_idx == 0 and ctx.user_arrival_time:
                _d1h, _d1m = _day1_adjusted_start(ctx.user_arrival_time, ctx.user_start_type or "hotel")
                _schedule_day_stops(day_stops, _d1h, _d1m, buffer_min)
            elif day_stops:
                sm = _non_day1_start_min(day_stops, ctx, date)
                _schedule_day_stops(day_stops, sm // 60, sm % 60, buffer_min)
            global_day_idx += 1
            days.append(EngineDay(date=date, stops=day_stops))

    return days


def _heavy_walk_advisories(days: list[EngineDay], ctx: EngineContext) -> list[EngineMessage]:
    """Emit a day-level advisory when a day's walking distance exceeds persona rest threshold."""
    w_rest = ctx.persona.get("weights", {}).get("w_rest_need", 0.4)
    # At w_rest=0.5 → warn above 6km walk; at w_rest=0.8 → warn above 2.4km
    heavy_km_threshold = 12.0 * (1.0 - min(w_rest, 0.95))
    messages = []
    for day in days:
        if day.is_travel_day or len(day.stops) < 2:
            continue
        walk_km = sum(
            _haversine_km(day.stops[i], day.stops[i + 1])
            for i in range(len(day.stops) - 1)
            if day.stops[i].transition_to_next == "walk"
        )
        if walk_km < heavy_km_threshold:
            continue
        last = day.stops[-1]
        if last.scheduled_time:
            lh, lm = (int(x) for x in last.scheduled_time.split(":"))
            end_min = lh * 60 + lm + last.duration_min
            early_end_min = end_min - 60
            if early_end_min > 0:
                eh, em = divmod(early_end_min, 60)
                consequence = f"Consider wrapping up around {eh:02d}:{em:02d} to give your feet a rest."
            else:
                consequence = "Consider dropping the last stop to give your feet a rest."
        else:
            consequence = "Consider dropping one stop to give your feet a rest."
        messages.append(EngineMessage(
            type="advisory",
            what=f"Heavy walking day — roughly {walk_km:.1f}km on foot.",
            why="Your route covers a lot of ground today.",
            consequence=consequence,
            dismissable=True,
            undo_key=None,
            stop_id=None,
        ))
    return messages


def _weather_message_for_stop(stop: EngineStop, rain_intensity: str, is_hot: bool) -> EngineMessage:
    """One combined message for a stop — never two — when both heat and rain apply."""
    heavy_rain = rain_intensity == "heavy"

    if is_hot and heavy_rain:
        return EngineMessage(
            type="weather",
            what=f"{stop.name} is an outdoor stop during a hot spell with heavy rain.",
            why="High heat and heavy rain both make outdoor visits uncomfortable and may close attractions.",
            consequence="Consider an indoor alternative, or visit before 11am when it's cooler and drier.",
            dismissable=True,
            undo_key=None,
            stop_id=stop.place_id,
        )
    if is_hot:
        return EngineMessage(
            type="weather",
            what=f"{stop.name} is an outdoor stop during a hot spell.",
            why="Forecast high is above the comfortable outdoor threshold for this city.",
            consequence="Consider visiting before 11am or after 5pm, with a shade/water break nearby.",
            dismissable=True,
            undo_key=None,
            stop_id=stop.place_id,
        )
    return EngineMessage(
        type="weather",
        what=f"{stop.name} is an outdoor stop during {rain_intensity} rain.",
        why="Heavy rain makes outdoor visits uncomfortable and may close attractions.",
        consequence="Consider an indoor alternative for this slot.",
        dismissable=True,
        undo_key=None,
        stop_id=stop.place_id,
    )


def _weather_advisories(days: list[EngineDay], ctx: EngineContext) -> list[EngineMessage]:
    """Emit a per-stop weather advisory using the real forecast for that day's
    actual date — runs after day-splitting, since only EngineDay has a real date.
    One weather lookup per day (not per stop); applies equally to user-added
    and engine-added stops."""
    climate = ctx.city.climate or {}
    heat_threshold_c = climate.get("heat_threshold_c", 32)
    rain_months = climate.get("rain_months", [])
    hot_months = climate.get("hot_months", [])
    lat, lon = ctx.city.center

    messages: list[EngineMessage] = []
    for day in days:
        if not any(s.outdoor for s in day.stops):
            continue
        wx = _weather.resolve_travel_weather(
            lat=lat, lon=lon, travel_date=day.date,
            heat_threshold_c=heat_threshold_c, rain_months=rain_months,
            hot_months=hot_months,
        )
        is_hot = bool(wx.get("is_hot"))
        rain_intensity = wx.get("rain_intensity", "none")
        if not is_hot and rain_intensity != "heavy":
            continue
        for stop in day.stops:
            if stop.outdoor:
                messages.append(_weather_message_for_stop(stop, rain_intensity, is_hot))
    return messages


_ALCOHOL_CATEGORIES = {"bar", "nightlife"}
_DINING_CATEGORIES = {"restaurant", "cafe", "coffee", "lunch", "dinner"}
_RAMADAN_DINING_CUTOFF_MIN = 19 * 60  # 7pm — iftar-adjacent; stops scheduled after this are fine


def _alcohol_advisories(days: list[EngineDay], ctx: EngineContext) -> list[EngineMessage]:
    """Per-stop advisory on bar/nightlife stops in a city/region where alcohol
    is restricted. Unconditional — not gated on the user's ritual preference,
    since that preference isn't currently sent to this pipeline at all."""
    if not (ctx.city.culture or {}).get("alcohol_restricted"):
        return []
    messages: list[EngineMessage] = []
    for day in days:
        for stop in day.stops:
            if stop.category.lower() not in _ALCOHOL_CATEGORIES:
                continue
            messages.append(EngineMessage(
                type="alcohol",
                what=f"{stop.name} is in an area with alcohol restrictions.",
                why="This city/region limits where alcohol is served.",
                consequence="Alcohol may only be available in licensed hotel venues — confirm before arriving.",
                dismissable=True,
                undo_key=None,
                stop_id=stop.place_id,
            ))
    return messages


def _ramadan_advisories(days: list[EngineDay], ctx: EngineContext) -> list[EngineMessage]:
    """Per-stop advisory on daytime dining stops that fall within Ramadan in a
    Ramadan-affected city — daytime dining is commonly restricted or closed."""
    if not (ctx.city.culture or {}).get("ramadan_affected"):
        return []
    messages: list[EngineMessage] = []
    for day in days:
        if not _ramadan.is_ramadan_date(day.date):
            continue
        for stop in day.stops:
            if stop.category.lower() not in _DINING_CATEGORIES:
                continue
            if not stop.scheduled_time:
                continue
            h, m = (int(x) for x in stop.scheduled_time.split(":"))
            if h * 60 + m >= _RAMADAN_DINING_CUTOFF_MIN:
                continue
            messages.append(EngineMessage(
                type="ramadan",
                what=f"{stop.name} falls during Ramadan daytime hours.",
                why="Daytime dining is commonly restricted or closed during Ramadan in this city.",
                consequence="Kitchen may be closed or curtained off until sunset — confirm before arriving.",
                dismissable=True,
                undo_key=None,
                stop_id=stop.place_id,
            ))
    return messages


def _needs_recommendations(stops: list[EngineStop], ctx: EngineContext) -> bool:
    return len(stops) < len(ctx.travel_dates)


async def _get_recommendations(ctx: EngineContext) -> list[dict]:
    """Return persona-matched place suggestions when stop count < day count."""
    archetype = ctx.persona.get("archetype", "wanderer")
    return [
        {"reason": "Your trip has room for more — here are some places you might like.",
         "archetype": archetype,
         "suggestions": ctx.city.hidden_gems[:3]}
    ]


async def build_itinerary(
    stops: list[EngineStop], ctx: EngineContext
) -> EngineResult:
    # Layer chain
    stops, msgs1 = constraints.resolve(stops, ctx)
    stops, msgs2 = sequencer.optimize(stops, ctx)
    stops, msgs3 = transitions.score(stops, ctx)
    stops, msgs4 = inserts.detect(stops, ctx)
    stops, msgs5 = swapper.check(stops, ctx)
    stops = _tags.apply(stops, ctx)
    all_messages = msgs1 + msgs2 + msgs3 + msgs4 + msgs5

    # Ensure all stops have scheduled_time (inserts may add stops without it)
    stops = _ensure_scheduled_times(stops, ctx)

    # Single batched narration — fall back to raw messages on failure
    try:
        narrated = await _narrator.narrate(all_messages, ctx)
    except Exception:
        narrated = all_messages

    days = _split_into_days(stops, ctx)
    days = _apply_departure_pressure(days, ctx)
    walk_advisories = _heavy_walk_advisories(days, ctx)
    weather_advisories = _weather_advisories(days, ctx)
    alcohol_advisories = _alcohol_advisories(days, ctx)
    ramadan_advisories = _ramadan_advisories(days, ctx)
    # Nightlife/walkability are NOT computed here — they need the final per-day
    # stop count/content *after* lunch/dinner/rest recommendations are injected
    # (that happens later, in main.py's per-day loop), otherwise they judge a
    # day's business off ~2 stops when it'll end up with 6-7. See main.py's
    # _nightlife_advisory_message / _walkability_advisory_message.
    recs = await _get_recommendations(ctx) if _needs_recommendations(stops, ctx) else None

    return EngineResult(
        days=days,
        messages=narrated + walk_advisories + weather_advisories
        + alcohol_advisories + ramadan_advisories,
        generation_id=str(uuid.uuid4()),
        recommendations=recs,
    )
