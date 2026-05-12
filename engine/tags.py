"""Tags pass: adds informational conflict tags to EngineStop.tags.

Max 2 tags per stop. Priority: heat > jet_lag > sunset.
"""
from __future__ import annotations
from engine.types import EngineStop, EngineContext


def compute_tags(stop: EngineStop, ctx: EngineContext, *, is_first_day: bool) -> list[str]:
    """Return up to 2 tags for a single stop."""
    tags: list[str] = []

    # ☀️ Beat the heat — outdoor stop 12pm–3pm in hot season
    if len(tags) < 2 and stop.scheduled_time:
        h = int(stop.scheduled_time.split(":")[0])
        if 12 <= h < 15:
            hot_months: list[int] = []
            if ctx.city and hasattr(ctx.city, "climate"):
                hot_months = ctx.city.climate.get("hot_months", [])
            if ctx.travel_dates:
                try:
                    month = int(ctx.travel_dates[0].split("-")[1])
                    if month in hot_months:
                        tags.append("☀️ Beat the heat")
                except (IndexError, ValueError):
                    pass

    # ✈️ Light — jet lag day — first day + timezone diff > 5h
    if len(tags) < 2 and is_first_day:
        tz_diff = abs(ctx.persona.get("timezone_offset", 0) or 0)
        if tz_diff > 5:
            tags.append("✈️ Light — jet lag day")

    # 🌅 Sunset timing — within 30min of 19:00
    if len(tags) < 2 and stop.scheduled_time:
        h = int(stop.scheduled_time.split(":")[0])
        m = int(stop.scheduled_time.split(":")[1])
        stop_min = h * 60 + m
        if abs(stop_min - 19 * 60) <= 30:
            tags.append("🌅 Sunset timing")

    return tags[:2]


def apply(stops: list[EngineStop], ctx: EngineContext) -> list[EngineStop]:
    """Apply tags to all stops in-place. Returns the same list."""
    first_date = ctx.travel_dates[0] if ctx.travel_dates else None
    for i, stop in enumerate(stops):
        is_first = (i == 0) if first_date else False
        stop.tags = compute_tags(stop, ctx, is_first_day=is_first)
    return stops
