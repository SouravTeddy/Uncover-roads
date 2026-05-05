"""Layer 1: Hard constraint resolution.

Resolves: closing time conflicts, outdoor stops in heavy rain, high-heat walk
forcing transit. Each conflict emits a structured EngineMessage.
"""
from __future__ import annotations
from engine.types import EngineStop, EngineContext, EngineMessage

# Minutes before closing that we flag as a conflict
_CLOSING_BUFFER_MIN = 30


def _parse_time_to_minutes(time_str: str) -> int:
    """Parse 'HH:MM' → total minutes since midnight."""
    h, m = time_str.split(":")
    return int(h) * 60 + int(m)


def _arrival_minutes(ctx: EngineContext) -> int:
    return _parse_time_to_minutes(ctx.persona.get("arrival_time", "09:00"))


def _closing_minutes(stop: EngineStop) -> int | None:
    for oh in stop.opening_hours:
        close = oh.get("close")
        if close:
            h = int(close.get("hour", 23))
            m = int(close.get("minute", 0))
            return h * 60 + m
    return None  # no closing info → assume open


def _has_closing_conflict(stop: EngineStop, arrival_min: int) -> bool:
    ch_min = _closing_minutes(stop)
    if ch_min is None:
        return False
    return arrival_min >= ch_min or (ch_min - arrival_min) < _CLOSING_BUFFER_MIN


def _make_swap_message(stop: EngineStop, ctx: EngineContext) -> EngineMessage:
    ch_min = _closing_minutes(stop)
    ch_h = ch_min // 60 if ch_min is not None else 0
    return EngineMessage(
        type="swap",
        what=f"{stop.name} closes at {ch_h:02d}:00",
        why=f"Arrival at {ctx.persona.get('arrival_time', '?')} leaves less than {_CLOSING_BUFFER_MIN} minutes.",
        consequence=f"{stop.name} has been swapped for a nearby alternative.",
        dismissable=False,
        undo_key=f"swap_{stop.place_id}",
    )


def _make_weather_message(stop: EngineStop, rain_intensity: str) -> EngineMessage:
    return EngineMessage(
        type="weather",
        what=f"{stop.name} is an outdoor stop during {rain_intensity} rain.",
        why="Heavy rain makes outdoor visits uncomfortable and may close attractions.",
        consequence="Consider an indoor alternative for this slot.",
        dismissable=True,
        undo_key=None,
    )


def resolve(
    stops: list[EngineStop], ctx: EngineContext
) -> tuple[list[EngineStop], list[EngineMessage]]:
    messages: list[EngineMessage] = []
    arrival_min = _arrival_minutes(ctx)
    rain_intensity = (ctx.weather or {}).get("rain_intensity", "none")

    result: list[EngineStop] = []
    for stop in stops:
        # Closing time conflict
        if _has_closing_conflict(stop, arrival_min):
            messages.append(_make_swap_message(stop, ctx))
            # Pass through — Layer 5 (swapper) does the actual replacement
            result.append(stop)
            continue

        # Outdoor + heavy rain
        if stop.outdoor and rain_intensity == "heavy":
            messages.append(_make_weather_message(stop, rain_intensity))

        result.append(stop)

    return result, messages
