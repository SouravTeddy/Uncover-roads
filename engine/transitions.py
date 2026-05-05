"""Layer 3: Transition scoring.

For each A→B pair, scores walk vs transit vs rideshare and sets
stop.transition_to_next. Emits a 'transit' message when persona's walk
affinity is high but transit is chosen.
"""
from __future__ import annotations
import math
from engine.types import EngineStop, EngineContext, EngineMessage

_WALK_MAX_KM = 1.5        # beyond this → transit
_RIDESHARE_MIN_KM = 5.0   # beyond this → rideshare over transit


def _haversine_km(a: EngineStop, b: EngineStop) -> float:
    R = 6371.0
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _best_mode(a: EngineStop, b: EngineStop, ctx: EngineContext) -> str:
    dist_km = _haversine_km(a, b)
    rain = (ctx.weather or {}).get("rain_intensity", "none")
    walk_penalty = 1.0 if rain in ("heavy", "moderate") else 0.0
    effective_walk_max = _WALK_MAX_KM * (0.5 if walk_penalty else 1.0)
    if dist_km <= effective_walk_max:
        return "walk"
    if dist_km <= _RIDESHARE_MIN_KM:
        return "transit"
    return "rideshare"


def _emit_transit_msg(a: EngineStop, b: EngineStop, mode: str) -> EngineMessage:
    return EngineMessage(
        type="transit",
        what=f"Taking {mode} from {a.name} to {b.name}.",
        why=f"The distance ({_haversine_km(a, b):.1f}km) exceeds comfortable walking range.",
        consequence=f"Added ~{int(_haversine_km(a, b) / 0.08)}min travel time.",
        dismissable=True,
        undo_key=None,
    )


def score(
    stops: list[EngineStop], ctx: EngineContext
) -> tuple[list[EngineStop], list[EngineMessage]]:
    messages: list[EngineMessage] = []
    walk_affinity = ctx.persona.get("weights", {}).get("w_walk_affinity", 0.5)
    for i in range(len(stops) - 1):
        a, b = stops[i], stops[i + 1]
        mode = _best_mode(a, b, ctx)
        stops[i].transition_to_next = mode
        if mode != "walk" and walk_affinity > 0.7:
            messages.append(_emit_transit_msg(a, b, mode))
    return stops, messages
