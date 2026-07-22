"""Plan quality scrubber — runs once after build_itinerary(), before the result is returned.

Enforces four contracts in a single pass:
  1. Dedup        — same place cannot appear twice in the plan
  2. Category     — certain place types can never be tourist stops
  3. Quality floor — engine-added stops must meet a rating/review threshold by city tier
  4. Time fitness  — insert candidates must be visited within their declared time-of-day window
"""
from __future__ import annotations
import unicodedata
from engine.types import EngineResult, EngineContext, EngineMessage


# ── 1. Category blocklist ────────────────────────────────────────────────────
# Place types that are never valid tourist stops regardless of rating.
# Only the engine-assigned `category` field is checked (EngineStop has no raw types[]).
_BLOCKED_CATEGORIES: frozenset[str] = frozenset({
    "parking", "car_parking", "bicycle_parking", "car_wash",
    "gas_station", "petrol_station", "fuel",
    "atm", "bank", "money_changer",
    "insurance_agency", "real_estate_agency",
    "storage", "self_storage",
    "laundry", "dry_cleaning",
    "locksmith", "moving_company",
    "car_repair", "car_dealer", "car_rental",
    "police", "courthouse", "embassy",
    "local_government_office", "city_hall",
    "transit_station", "subway_station", "bus_station", "train_station",
})


# ── 2. Quality floor by city tier ───────────────────────────────────────────
# CityData.tier is 1 (well-mapped) / 2 (partially mapped) / 3 (thinly mapped).
# India, Nigeria, Egypt → typically tier 3; US, France, Japan → tier 1.
# Floors only apply to engine-added (non-user) stops.
_MIN_RATING: dict[int, float] = {1: 3.5, 2: 3.8, 3: 4.0}
_MIN_REVIEWS: dict[int, int]  = {1: 20,  2: 50,  3: 100}


# ── 3. Time-of-day fitness ───────────────────────────────────────────────────
# Maps the time bucket of a scheduled stop to allowed buckets.
# InsertCandidate.time_of_day_match carries the intended windows; we enforce them here.
def _time_bucket(time_str: str | None) -> str:
    """'09:30' → 'morning' | 'afternoon' | 'evening' | 'night'"""
    if not time_str:
        return "morning"
    try:
        h = int(time_str.split(":")[0])
    except (ValueError, IndexError):
        return "morning"
    if h < 12:
        return "morning"
    if h < 17:
        return "afternoon"
    if h < 21:
        return "evening"
    return "night"


def _normalise(name: str) -> str:
    """Lowercase, strip accents, collapse whitespace."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_ = nfkd.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_.lower().split())


# ── Main entry point ─────────────────────────────────────────────────────────

def scrub(result: EngineResult, ctx: EngineContext) -> EngineResult:
    """Clean the engine result in-place and return it."""
    tier = getattr(ctx.city, "tier", 1) or 1
    min_rating  = _MIN_RATING.get(tier, 3.5)
    min_reviews = _MIN_REVIEWS.get(tier, 20)

    removed_names: list[str] = []

    # Track seen identities across ALL days for dedup
    seen_ids:    set[str] = set()
    seen_titles: set[str] = set()

    for day in result.days:
        if day.is_travel_day:
            continue

        kept = []
        for stop in day.stops:
            reason = _reject_reason(
                stop, seen_ids, seen_titles,
                min_rating, min_reviews,
            )
            if reason:
                removed_names.append(stop.name)
                # Emit a silent advisory so the message log is traceable
                result.messages.append(EngineMessage(
                    type="advisory",
                    what=f"Removed {stop.name} from your itinerary.",
                    why=reason,
                    consequence="",
                    dismissable=True,
                    undo_key=None,
                    stop_id=stop.place_id,
                ))
                continue

            # Register as seen only after passing all checks
            if stop.place_id:
                seen_ids.add(stop.place_id)
            seen_titles.add(_normalise(stop.name))
            kept.append(stop)

        day.stops = kept

    if removed_names:
        print(f"[plan_scrubber] removed {len(removed_names)} stop(s): {removed_names}")

    return result


def _reject_reason(stop, seen_ids, seen_titles, min_rating, min_reviews) -> str | None:
    """Return a human-readable reason to remove this stop, or None to keep it."""

    # ── 1. Dedup ──────────────────────────────────────────────────────────
    if stop.place_id and stop.place_id in seen_ids:
        return "Duplicate — this place already appears earlier in your plan."
    if _normalise(stop.name) in seen_titles:
        return "Duplicate — a stop with this name already appears in your plan."

    # ── 2. Category blocklist ─────────────────────────────────────────────
    cat = (stop.category or "").lower().strip()
    if cat in _BLOCKED_CATEGORIES:
        return f"'{cat}' is not a valid tourist stop category."

    # ── 3. Quality floor (engine-added stops only) ─────────────────────────
    if not stop.is_user_added:
        if stop.rating is not None and stop.rating > 0 and stop.rating < min_rating:
            return (
                f"Rating {stop.rating:.1f} is below the {min_rating:.1f} floor "
                f"for this city tier."
            )
        if (
            stop.rating_count is not None
            and stop.rating_count > 0
            and stop.rating_count < min_reviews
        ):
            return (
                f"Only {stop.rating_count} reviews — below the {min_reviews} "
                f"minimum for reliable data in this city."
            )

    # ── 4. Time-of-day fitness (engine-added stops with declared windows) ──
    if not stop.is_user_added and stop.scheduled_time:
        allowed: list[str] = getattr(stop, "time_of_day_match", None) or []
        if allowed:
            bucket = _time_bucket(stop.scheduled_time)
            if bucket not in allowed:
                return (
                    f"'{stop.name}' ({stop.category}) is scheduled at "
                    f"{stop.scheduled_time} but only fits {allowed}."
                )

    return None
