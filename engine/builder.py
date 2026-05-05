"""Builder: orchestrates all 5 engine layers + narrator.

build_itinerary(stops, ctx) → EngineResult
"""
from __future__ import annotations
import uuid
from engine.types import EngineStop, EngineContext, EngineMessage, EngineDay, EngineResult
from engine import constraints, sequencer, transitions, inserts, swapper
from engine import narrator as _narrator


def _ensure_scheduled_times(stops: list[EngineStop], ctx: EngineContext) -> list[EngineStop]:
    """Final pass: assign scheduled_time to any stops that don't have it.

    This is needed because inserts.detect() may add stops that bypass sequencer's
    time assignment. We fill in the gaps using the same logic as sequencer.
    """
    # Find the earliest and latest scheduled times in existing stops
    scheduled = [s for s in stops if s.scheduled_time]
    if not scheduled:
        # No scheduled times set yet (shouldn't happen after sequencer, but handle it)
        start_h = int(ctx.persona.get("arrival_time", "09:00").split(":")[0])
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


def _split_into_days(stops: list[EngineStop], ctx: EngineContext) -> list[EngineDay]:
    """Distribute stops across travel_dates. Naive equal split."""
    dates = ctx.travel_dates
    if not dates:
        return [EngineDay(date="unknown", stops=stops)]
    per_day = max(1, len(stops) // len(dates))
    days: list[EngineDay] = []
    for i, date in enumerate(dates):
        start = i * per_day
        end = start + per_day if i < len(dates) - 1 else len(stops)
        days.append(EngineDay(date=date, stops=stops[start:end]))
    return days


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
    all_messages = msgs1 + msgs2 + msgs3 + msgs4 + msgs5

    # Ensure all stops have scheduled_time (inserts may add stops without it)
    stops = _ensure_scheduled_times(stops, ctx)

    # Single batched narration — fall back to raw messages on failure
    try:
        narrated = await _narrator.narrate(all_messages, ctx)
    except Exception:
        narrated = all_messages

    days = _split_into_days(stops, ctx)
    recs = await _get_recommendations(ctx) if _needs_recommendations(stops, ctx) else None

    return EngineResult(
        days=days,
        messages=narrated,
        generation_id=str(uuid.uuid4()),
        recommendations=recs,
    )
