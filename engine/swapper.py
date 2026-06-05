"""Layer 5: Final conflict sweep + auto-swap.

Any stop still violating hard constraints after sequencing/inserts is
auto-swapped. Uses a composite swap score — higher = more likely to swap.
"""
from __future__ import annotations
import math
from engine.types import EngineStop, EngineContext, EngineMessage

SWAP_THRESHOLD = 0.65  # composite score above which we swap


def _swap_score(stop: EngineStop, ctx: EngineContext) -> float:
    """Higher score = more likely to be swapped. Range 0–1."""
    score = 0.0
    # Low rating penalty
    if stop.rating < 3.0:
        score += (3.0 - stop.rating) / 3.0 * 0.5
    # High price vs persona budget (proxy: if price_level == 4 and not epicurean/voyager)
    archetype = ctx.persona.get("archetype", "wanderer")
    if stop.price_level == 4 and archetype not in ("epicurean", "voyager"):
        score += 0.25
    # Outdoor stop in heavy rain (should have been caught in Layer 1 — final check)
    rain = (ctx.weather or {}).get("rain_intensity", "none")
    if stop.outdoor and rain == "heavy":
        score += 0.3
    return min(score, 1.0)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))


def _find_alternatives(
    stop: EngineStop,
    ctx: EngineContext,
    excluded_place_ids: set[str] | None = None,
) -> list[tuple[float, object]]:
    """Score insert_candidates as replacements for `stop`.

    Returns list of (score, InsertCandidate) sorted descending.
    score = persona_affinity × (1 / (1 + distance_km))
    Excludes place_ids in excluded_place_ids (stops already in the itinerary).
    """
    if excluded_place_ids is None:
        excluded_place_ids = set()
    archetype = ctx.persona.get("archetype", "explorer")
    scored = []
    for ic in ctx.city.insert_candidates:
        if not ic.place_id or ic.place_id in excluded_place_ids:
            continue
        affinity = ic.persona_affinity.get(archetype, 0.5)
        dist_km = _haversine_km(stop.lat, stop.lon, ic.lat, ic.lon)
        proximity = 1.0 / (1.0 + dist_km)
        scored.append((affinity * proximity, ic))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:5]


def _emit_swap(original: EngineStop, replacement: EngineStop | None, reason: str) -> EngineMessage:
    if replacement:
        what = f"Swapped {original.name} for {replacement.name}."
        consequence = f"Your itinerary now includes {replacement.name} instead."
    else:
        what = f"{original.name} may not be the best fit for this slot."
        consequence = "No automatic alternative was found — manual review recommended."
    return EngineMessage(
        type="swap",
        what=what,
        why=reason,
        consequence=consequence,
        dismissable=True,
        undo_key=f"swap_{original.place_id}",
        stop_id=original.place_id,
    )


def check(
    stops: list[EngineStop], ctx: EngineContext
) -> tuple[list[EngineStop], list[EngineMessage]]:
    messages: list[EngineMessage] = []
    result: list[EngineStop] = []
    for stop in stops:
        score = _swap_score(stop, ctx)
        if score > SWAP_THRESHOLD:
            alternatives = _find_alternatives(stop, ctx, excluded_place_ids=set())
            reason = f"Composite conflict score {score:.2f} exceeds threshold {SWAP_THRESHOLD}."
            if alternatives:
                result.append(alternatives[0])
                messages.append(_emit_swap(stop, alternatives[0], reason))
            else:
                result.append(stop)
                messages.append(_emit_swap(stop, None, reason))
        else:
            result.append(stop)
    return result, messages
