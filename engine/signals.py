"""Per-stop signal computation.

Generates 2-3 rich, non-repeating signals per stop using real data:
city crowd profiles, persona weights, stop sequence, opening hours,
place details, and transit context.

Each signal type fires at most N times per day (see DAY_BUDGET).
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from datetime import date as _date, datetime as _dt
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from engine.types import EngineStop, EngineContext

# ── Constants ─────────────────────────────────────────────────────────────────

# How many times each signal type may appear per day across all stops
_DAY_BUDGET = {
    "crowd":    5,
    "energy":   3,
    "sequence": 4,
    "value":    4,
    "timing":   8,
    "transit":  6,
    "content":  4,
    "photo":    4,
}

# Category → peak hour buckets (0=midnight … 23=11pm), score 0-1
# Derived from known behavioral patterns
_CATEGORY_PEAK: dict[str, list[float]] = {
    "museum":     [0,0,0,0,0,0,0,0,.2,.6,.9,.95,1,.9,.8,.7,.6,.5,.3,.1,0,0,0,0],
    "gallery":    [0,0,0,0,0,0,0,0,.2,.5,.8,.9,.95,.9,.8,.7,.5,.3,.2,.1,0,0,0,0],
    "historic":   [0,0,0,0,0,0,0,0,.3,.6,.85,.95,1,.95,.85,.7,.5,.3,.1,0,0,0,0],
    "landmark":   [0,0,0,0,0,0,0,.1,.3,.7,.9,.95,1,.95,.9,.8,.6,.4,.3,.2,.1,0,0,0],
    "park":       [0,0,0,0,0,0,.1,.2,.4,.5,.6,.7,.8,.75,.7,.65,.6,.5,.4,.2,.1,0,0,0],
    "garden":     [0,0,0,0,0,0,0,.1,.4,.6,.8,.85,.9,.85,.8,.7,.5,.3,.1,0,0,0,0,0],
    "viewpoint":  [0,0,0,0,0,0,.3,.5,.4,.5,.6,.7,.75,.7,.65,.6,.5,.5,.7,.8,.7,.4,.2,.1],
    "beach":      [0,0,0,0,0,0,0,0,.1,.3,.5,.7,.9,.95,1,.95,.85,.7,.5,.3,.1,0,0,0],
    "nature_reserve": [0,0,0,0,0,0,.1,.3,.5,.6,.7,.7,.75,.75,.7,.65,.55,.4,.2,.1,0,0,0,0],
    "restaurant": [0,0,0,0,0,0,0,0,.1,.2,.3,.4,.95,1,.95,.5,.3,.4,.9,.95,.85,.5,.2,.1],
    "cafe":       [0,0,0,0,0,0,0,.1,.4,.7,.85,.9,.85,.8,.6,.4,.3,.2,.1,0,0,0,0,0],
    "coffee":     [0,0,0,0,0,0,0,.1,.4,.7,.85,.9,.85,.8,.6,.4,.3,.2,.1,0,0,0,0,0],
    "bar":        [0,0,0,0,0,0,0,0,0,0,.1,.1,.2,.2,.3,.4,.5,.6,.8,.95,1,.95,.7,.3],
    "nightlife":  [0,0,0,0,0,0,0,0,0,0,0,0,.1,.1,.2,.3,.4,.5,.7,.9,1,1,.8,.4],
    "market":     [0,0,0,0,0,0,.2,.5,.9,1,.95,.85,.7,.55,.4,.3,.2,.1,0,0,0,0,0,0],
    "shopping":   [0,0,0,0,0,0,0,0,.1,.3,.6,.8,.9,.85,.8,.8,.75,.7,.6,.4,.1,0,0,0],
    "temple":     [0,0,0,0,0,.2,.4,.5,.4,.5,.7,.8,.85,.8,.75,.65,.5,.4,.3,.2,.1,0,0,0],
    "shrine":     [0,0,0,0,0,.2,.4,.5,.4,.5,.7,.8,.85,.8,.75,.65,.5,.4,.3,.2,.1,0,0,0],
    "spa":        [0,0,0,0,0,0,0,0,.1,.2,.4,.5,.6,.65,.7,.75,.8,.85,.9,.7,.4,.2,.1,0],
}
_DEFAULT_PEAK = [0,0,0,0,0,0,0,.1,.3,.5,.7,.8,.85,.8,.75,.7,.6,.5,.3,.2,.1,0,0,0]

# Broad category groups for sequence coherence checks
_BROAD: dict[str, str] = {
    "museum": "cultural", "gallery": "cultural", "historic": "cultural",
    "temple": "cultural", "shrine": "cultural", "castle": "cultural",
    "park": "outdoor", "garden": "outdoor", "beach": "outdoor",
    "viewpoint": "outdoor", "nature_reserve": "outdoor",
    "restaurant": "food", "cafe": "food", "coffee": "food",
    "bar": "food", "market": "food", "lunch": "food", "dinner": "food",
    "nightlife": "social", "spa": "rest", "shopping": "leisure",
}

_TRANSIT_EMOJI = {"walk": "🚶", "transit": "🚇", "rideshare": "🚕"}
_TRANSIT_VERB  = {"walk": "Walk", "transit": "Take transit", "rideshare": "Grab a ride"}


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class StopSignal:
    type: str        # crowd|energy|sequence|value|timing|transit|content|photo
    text: str
    icon: str        # material symbol name or emoji
    priority: int    # lower = higher priority, shown first


@dataclass
class DaySignalState:
    """Tracks signal type usage across stops in a single day."""
    counts: dict[str, int] = field(default_factory=dict)

    def can_fire(self, sig_type: str) -> bool:
        return self.counts.get(sig_type, 0) < _DAY_BUDGET.get(sig_type, 1)

    def record(self, sig_type: str) -> None:
        self.counts[sig_type] = self.counts.get(sig_type, 0) + 1


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_hm(t: str) -> tuple[int, int]:
    h, m = (int(x) for x in t.split(":"))
    return h, m


def _time_to_min(t: str) -> int:
    h, m = _parse_hm(t)
    return h * 60 + m


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _popular_times_score(popular_times: list | None, date_str: str | None, hour: int) -> float | None:
    """Extract busyness score 0–1 from Google Places popular_times for a specific day/hour.

    popular_times: [{day: int (0=Sun), data: [24 ints 0-100]}, ...]
    Returns None if data is unavailable for this day.
    """
    if not popular_times or not date_str:
        return None
    try:
        # Python weekday(): 0=Mon … 6=Sun → Google: 0=Sun … 6=Sat
        py_weekday = _dt.fromisoformat(date_str).weekday()
        google_day = (py_weekday + 1) % 7
        for entry in popular_times:
            if entry.get("day") == google_day:
                data = entry.get("data") or []
                if 0 <= hour < len(data):
                    return data[hour] / 100.0
    except Exception:
        pass
    return None


def _crowd_pressure(
    stop: "EngineStop", ctx: "EngineContext", date_str: str | None,
    popular_times: list | None = None,
) -> float:
    """Compute Crowd Pressure Score 0–1 for this stop at its scheduled time.

    Uses Google Places popular_times when available; falls back to category
    peak curves + neighbourhood crowd index.
    """
    if not stop.scheduled_time:
        return 0.3
    h, _ = _parse_hm(stop.scheduled_time)

    # ── Real data path: Google Popular Times ──────────────────────────────
    real_score = _popular_times_score(popular_times, date_str, h)
    if real_score is not None:
        return real_score

    # ── Fallback: category peak curve + neighbourhood index ───────────────
    peak_curve = _CATEGORY_PEAK.get(stop.category.lower(), _DEFAULT_PEAK)
    base_peak = peak_curve[h]

    crowd_mult = 1.0
    if ctx.city.neighborhoods:
        best_nb = min(
            ctx.city.neighborhoods,
            key=lambda nb: _haversine_km(stop.lat, stop.lon, nb.center[0], nb.center[1]),
            default=None,
        )
        if best_nb:
            try:
                day_type = "weekend" if (
                    date_str and _dt.fromisoformat(date_str).weekday() >= 5
                ) else "weekday"
                crowd_mult = best_nb.crowd_index.get(day_type, 0.5) * 2
            except Exception:
                pass

    is_weekend = bool(date_str and _dt.fromisoformat(date_str).weekday() >= 5)
    weekend_bump = 1.2 if (is_weekend and stop.category.lower() in {"park", "beach", "market", "landmark", "viewpoint"}) else 1.0

    return min(1.0, base_peak * crowd_mult * weekend_bump)


def _sunset_hour(lat: float, lon: float, date_str: str | None) -> float | None:
    """Estimate sunset hour (local) using solar declination formula. Returns hour float."""
    try:
        if not date_str:
            return None
        d = _date.fromisoformat(date_str)
        day_of_year = d.timetuple().tm_yday
        # Solar declination
        decl = math.radians(23.45 * math.sin(math.radians(360/365 * (day_of_year - 81))))
        lat_r = math.radians(lat)
        cos_h = -math.tan(lat_r) * math.tan(decl)
        if abs(cos_h) > 1:
            return None  # polar day/night
        hour_angle = math.degrees(math.acos(cos_h))
        # Approximate UTC sunset (noon UTC + hour_angle/15)
        sunset_utc = 12 + hour_angle / 15
        # Rough local offset from longitude
        local_offset = lon / 15
        return (sunset_utc + local_offset) % 24
    except Exception:
        return None


def _opening_close_min(stop: "EngineStop", date_str: str | None = None) -> int | None:
    """Return closing time in minutes-from-midnight for the visit day, or None.

    opening_hours is stored as [{day: int (0=Mon), open_min: int, close_min: int}].
    """
    if not stop.opening_hours:
        return None
    try:
        visit_weekday: int | None = None
        if date_str:
            visit_weekday = _dt.fromisoformat(date_str).weekday()

        # First pass: match on the visit weekday
        for period in stop.opening_hours:
            day = period.get("day")
            close_min = period.get("close_min")
            if close_min is None:
                continue
            if visit_weekday is not None and day != visit_weekday:
                continue
            return close_min

        # Fallback: return any available close_min (weekday unknown or no match)
        if visit_weekday is not None:
            for period in stop.opening_hours:
                close_min = period.get("close_min")
                if close_min is not None:
                    return close_min
    except Exception:
        pass
    return None


def _cap_text(text: str, max_chars: int = 60) -> str:
    """Hard-cap a signal string so it never gets truncated in the pill."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars - 1].rstrip() + "…"


# ── Signal generators ─────────────────────────────────────────────────────────

def _sig_crowd(
    stop: "EngineStop", ctx: "EngineContext", date_str: str | None,
    day_state: DaySignalState,
    popular_times: list | None = None,
) -> StopSignal | None:
    if not day_state.can_fire("crowd"):
        return None
    cps = _crowd_pressure(stop, ctx, date_str, popular_times)

    if cps < 0.25:
        text = "Quiet window — you'll have space here"
        icon = "groups"
    elif cps < 0.5:
        text = "Light crowds — solid timing"
        icon = "groups"
    elif cps < 0.75:
        text = "Moderate traffic — build in 15 extra min"
        icon = "warning"
    else:
        text = "Peak crowd window — arrive early or push later"
        icon = "warning"

    day_state.record("crowd")
    return StopSignal(type="crowd", text=_cap_text(text), icon=icon, priority=1)


def _sig_timing(
    stop: "EngineStop", date_str: str | None, day_state: DaySignalState,
) -> StopSignal | None:
    if not day_state.can_fire("timing") or not stop.scheduled_time:
        return None
    close_min = _opening_close_min(stop, date_str)
    if close_min is None:
        return None

    arrive_min = _time_to_min(stop.scheduled_time)
    leave_min  = arrive_min + stop.duration_min
    mins_left  = close_min - leave_min

    if mins_left < 0:
        # Constraint violation — already handled by constraints layer, skip
        return None
    elif mins_left < 30:
        close_h, close_m = divmod(close_min, 60)
        text = f"Closes at {close_h}:{close_m:02d} — tight window, move efficiently"
        icon = "schedule"
    elif mins_left < 90:
        close_h, close_m = divmod(close_min, 60)
        text = f"Open until {close_h}:{close_m:02d} — just enough time at this pace"
        icon = "schedule"
    else:
        return None  # plenty of time — not worth signalling

    day_state.record("timing")
    return StopSignal(type="timing", text=_cap_text(text), icon=icon, priority=2)


def _sig_value(
    stop: "EngineStop", place_details: dict, ctx: "EngineContext",
    day_state: DaySignalState,
) -> StopSignal | None:
    if not day_state.can_fire("value"):
        return None
    rating = stop.rating if stop.rating and stop.rating != 4.0 else None
    price  = place_details.get("price_level") or stop.price_level
    count  = place_details.get("rating_count")
    if not rating:
        return None

    w_budget = ctx.persona.get("weights", {}).get("w_budget_sensitivity", 0.4)
    text = None
    icon = "star"

    if count and count < 300 and rating >= 4.3:
        text = f"{rating}★ with under 300 reviews — local favourite, not yet discovered"
        icon = "explore"
    elif count and count < 800 and rating >= 4.5:
        text = f"{rating}★ and still under the radar — worth the detour"
        icon = "explore"
    elif price == 0 and rating >= 4.3:
        text = f"{rating}★ and free entry — strong value"
        icon = "star"
    elif price and price >= 3 and w_budget > 0.5:
        text = f"Premium pricing here — decide if {stop.category} is a priority for you"
        icon = "payments"
    elif rating >= 4.6:
        text = f"One of the highest-rated {stop.category} stops on your trip ({rating}★)"
        icon = "star"
    else:
        return None

    day_state.record("value")
    return StopSignal(type="value", text=_cap_text(text), icon=icon, priority=3)


def _sig_energy(
    stop_idx: int, total_stops: int, cumulative_mins: int,
    ctx: "EngineContext", day_state: DaySignalState,
) -> StopSignal | None:
    if not day_state.can_fire("energy"):
        return None
    w_rest = ctx.persona.get("weights", {}).get("w_rest_need", 0.4)
    day_capacity = 480 * (1.4 - w_rest)  # 384–672 min range
    energy_used = (stop_idx / max(total_stops, 1)) * 0.6 + (cumulative_mins / day_capacity) * 0.4
    energy_left = 1.0 - energy_used

    if stop_idx == 0:
        return None  # first stop — no energy signal needed
    elif energy_left < 0.25:
        text = "Late in the day — 45 min here is plenty, you've covered a lot"
        icon = "battery_low"
    elif energy_left < 0.45:
        pct = int((1 - energy_left) * 100)
        text = f"You're {pct}% through the day — good moment to move at your own pace"
        icon = "battery_3_bar"
    else:
        return None  # person is in flow, don't interrupt

    day_state.record("energy")
    return StopSignal(type="energy", text=_cap_text(text), icon=icon, priority=4)


def _sig_sequence(
    stop: "EngineStop", stop_idx: int, day_stops: list["EngineStop"],
    day_state: DaySignalState,
) -> StopSignal | None:
    if not day_state.can_fire("sequence") or stop_idx == 0:
        return None

    broad = _BROAD.get(stop.category.lower(), "other")
    prev_broads = [_BROAD.get(s.category.lower(), "other") for s in day_stops[:stop_idx]]
    run = sum(1 for b in reversed(prev_broads) if b == broad)

    text = None
    icon = "route"

    is_last = (stop_idx == len(day_stops) - 1)
    next_stop = day_stops[stop_idx + 1] if stop_idx + 1 < len(day_stops) else None

    if is_last:
        text = "Last stop of the day — you'll end on a strong note here"
        icon = "flag"
    elif run >= 2 and broad == "cultural":
        text = f"Third cultural stop in a row — great for depth, take your time"
        icon = "auto_stories"
    elif run >= 2 and broad == "outdoor":
        text = "A few outdoor stops in sequence — good energy flow today"
        icon = "directions_walk"
    elif prev_broads and prev_broads[-1] == "food" and broad == "cultural":
        text = "A full stomach makes museums better — good sequencing"
        icon = "restaurant"
    elif next_stop and _BROAD.get(next_stop.category.lower()) == "food" and stop.scheduled_time:
        h, _ = _parse_hm(stop.scheduled_time)
        if 11 <= h <= 13:
            text = "Lunch is next — 45 min here is a comfortable pace"
            icon = "restaurant"
        elif 17 <= h <= 19:
            text = "Dinner follows — a natural close to the afternoon"
            icon = "restaurant"
    elif stop.transition_to_next == "walk" and next_stop:
        dist = _haversine_km(stop.lat, stop.lon, next_stop.lat, next_stop.lon)
        if dist < 0.3:
            text = f"Only {int(dist*1000)}m to your next stop — no rush here"
            icon = "near_me"
    else:
        return None

    if text is None:
        return None

    day_state.record("sequence")
    return StopSignal(type="sequence", text=_cap_text(text), icon=icon, priority=5)


def _sig_transit(
    stop: "EngineStop", prev_stop: "EngineStop" | None,
    ctx: "EngineContext", day_state: DaySignalState,
) -> StopSignal | None:
    if not day_state.can_fire("transit") or not prev_stop:
        return None
    dist_km = _haversine_km(prev_stop.lat, prev_stop.lon, stop.lat, stop.lon)
    mode = prev_stop.transition_to_next or stop.transition_to_next or "walk"
    w_walk = ctx.persona.get("weights", {}).get("w_walk_affinity", 0.5)

    # Walk time at 5km/h, transit at 20km/h with 5min overhead, rideshare at 30km/h with 3min
    if mode == "walk":
        mins = int(dist_km / 5 * 60)
        if mins < 3:
            return None  # trivially close, not worth signalling
        text = f"{mins} min walk from {prev_stop.name[:15]} — {dist_km:.1f}km"
        icon = "directions_walk"
    elif mode == "transit":
        mins = int(dist_km / 20 * 60) + 5
        text = f"~{mins} min by transit from {prev_stop.name[:15]}"
        icon = "directions_transit"
        if w_walk > 0.7:
            text += f" — or a scenic {int(dist_km/5*60)} min walk if you prefer"
    else:
        mins = int(dist_km / 30 * 60) + 3
        text = f"~{mins} min rideshare from {prev_stop.name[:15]} ({dist_km:.1f}km)"
        icon = "local_taxi"

    day_state.record("transit")
    return StopSignal(type="transit", text=_cap_text(text), icon=icon, priority=6)


def _sig_content(
    stop: "EngineStop", place_details: dict, day_state: DaySignalState,
) -> StopSignal | None:
    if not day_state.can_fire("content"):
        return None
    editorial = place_details.get("editorial_summary")
    top_review = place_details.get("top_review")

    if editorial and len(editorial) > 20:
        text = editorial[:80].rstrip()
        if len(editorial) > 80:
            text += "…"
        day_state.record("content")
        return StopSignal(type="content", text=_cap_text(text, 80), icon="info", priority=7)
    return None


def _sig_discovery(
    stage: str | None, velocity_ratio: float | None, day_state: DaySignalState,
) -> "StopSignal | None":
    if not day_state.can_fire("value"):
        return None
    if stage == "hidden_gem":
        day_state.record("value")
        return StopSignal(
            type="value",
            text="Hidden gem — highly rated with under 500 reviews. Rarely on tourist lists.",
            icon="diamond",
            priority=3,
        )
    if stage == "rising" and velocity_ratio and velocity_ratio >= 2.0:
        day_state.record("value")
        return StopSignal(
            type="value",
            text="Trending fast — this place is building serious momentum right now.",
            icon="trending_up",
            priority=4,
        )
    if stage == "rising":
        day_state.record("value")
        return StopSignal(
            type="value",
            text="Rising spot — earning a strong reputation among those who know.",
            icon="star_half",
            priority=5,
        )
    return None


def _sig_photo(
    stop: "EngineStop", ctx: "EngineContext", date_str: str | None,
    day_state: DaySignalState,
) -> StopSignal | None:
    if not day_state.can_fire("photo") or not stop.scheduled_time:
        return None

    arrive_h, _ = _parse_hm(stop.scheduled_time)
    sunset = _sunset_hour(stop.lat, stop.lon, date_str)

    # Golden hour = 1h before sunset
    if sunset:
        golden_start = sunset - 1.0
        golden_end   = sunset + 0.25
        mins_to_golden = int((golden_start - arrive_h) * 60)

        if 0 <= mins_to_golden <= 90:
            golden_h = int(golden_start)
            golden_m = int((golden_start - golden_h) * 60)
            text = f"Golden hour starts at {golden_h}:{golden_m:02d} — you arrive 30 min before it. Stay for the light"
            day_state.record("photo")
            return StopSignal(type="photo", text=_cap_text(text), icon="camera_alt", priority=8)
        elif -30 <= mins_to_golden < 0:
            text = "You're arriving during golden hour — best light of the day right now"
            day_state.record("photo")
            return StopSignal(type="photo", text=_cap_text(text), icon="camera_alt", priority=8)

    # Category-specific photo tips — only fire once per day
    _PHOTO_TIPS: dict[str, str] = {
        "viewpoint":  "Best angle: arrive before 9AM or after 4PM to avoid haze",
        "landmark":   "Early morning gets you the cleanest shots before crowds arrive",
        "temple":     "Side courtyards often have better angles than the main gate",
        "shrine":     "Torii gate shots — shoot from low to frame the sky",
        "museum":     "First floor galleries are usually better lit for photography",
        "market":     "The vendor stalls at opening have the best colour and energy",
        "beach":      "Water reflection is sharpest 30–60 min after sunrise",
        "park":       "Elevated spots within the park give the best skyline framing",
        "garden":     "Shoot from ground level to foreground the planting",
    }
    tip = _PHOTO_TIPS.get(stop.category.lower())
    if tip:
        day_state.record("photo")
        return StopSignal(type="photo", text=_cap_text(tip), icon="camera_alt", priority=8)

    return None


# ── Main entry point ──────────────────────────────────────────────────────────

def compute_stop_signals(
    stop: "EngineStop",
    stop_idx: int,
    day_stops: list["EngineStop"],
    ctx: "EngineContext",
    place_details: dict,
    date_str: str | None,
    day_state: DaySignalState,
    cumulative_mins: int = 0,
    stage: str | None = None,
    velocity_ratio: float | None = None,
    max_signals: int = 3,
) -> list[dict]:
    """
    Compute up to max_signals signals for a stop.
    Returns list of {type, text, icon} dicts for the API response.
    """
    prev_stop = day_stops[stop_idx - 1] if stop_idx > 0 else None
    popular_times = place_details.get("popular_times")
    candidates: list[StopSignal] = []

    for fn in [
        lambda: _sig_discovery(stage, velocity_ratio, day_state),
        lambda: _sig_crowd(stop, ctx, date_str, day_state, popular_times),
        lambda: _sig_timing(stop, date_str, day_state),
        lambda: _sig_value(stop, place_details, ctx, day_state),
        lambda: _sig_transit(stop, prev_stop, ctx, day_state),
        lambda: _sig_content(stop, place_details, day_state),
        lambda: _sig_sequence(stop, stop_idx, day_stops, day_state),
        lambda: _sig_energy(stop_idx, len(day_stops), cumulative_mins, ctx, day_state),
        lambda: _sig_photo(stop, ctx, date_str, day_state),
    ]:
        sig = fn()
        if sig:
            candidates.append(sig)

    # Sort by priority (lower = shown first), take top N
    candidates.sort(key=lambda s: s.priority)
    selected = candidates[:max_signals]

    return [{"type": s.type, "text": s.text, "icon": s.icon} for s in selected]
