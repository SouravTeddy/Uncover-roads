# Reco Backend + Reel Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move reco computation permanently to the backend at itinerary build time, eliminating the 429 rate-limit storm; clean up the reel screen UI issues that flow from it.

**Architecture:** The `/engine-itinerary` endpoint will gain a Python reco engine that detects itinerary gaps, resolves each trigger into a real place via existing Nearby Search + place_details_cache, and injects the resolved stops (isEngineAdded: true) directly into the itinerary response. The frontend receives a complete itinerary — no prefetch needed. `reco-prefetch.ts` is deleted.

**Tech Stack:** Python 3.11 / FastAPI (backend — `main.py`, new `engine/reco_engine.py`); React 19 + TypeScript (frontend — `ItineraryReelScreen.tsx`, `ReelStopCard.tsx`, `reel-builder.ts`, `DateRangeCalendar.tsx`, `DestinationScreen.tsx`)

## Global Constraints

- Never push to remote without user approval.
- Backend lives at `/Users/souravbiswas/uncover-roads/main.py`; frontend at `/Users/souravbiswas/uncover-roads/frontend/src`.
- `place_details_cache` Supabase table already exists with columns `place_id TEXT PK`, `data JSONB`, `fetched_at TIMESTAMPTZ`.
- Rate limit: `RATE_LIMIT_MAX = 100` per `RATE_LIMIT_WINDOW = 3600` (100 req/hr/IP) in `main.py:341-353`.
- `_batch_place_details(supabase_client, place_ids)` at `main.py:4811` reads from cache only — use it for detail lookups.
- The existing `reel_reco` endpoint body (lines 4418–4482) is the Nearby Search logic to reuse inline.
- Frontend `isEngineAdded: true` on a stop card renders the "Our pick" chip — already implemented in `ReelStopCard.tsx`.
- `DateRangeCalendar` at `frontend/src/modules/destination/DateRangeCalendar.tsx` already accepts `maxDate?: string` prop.
- Do NOT add `editorial_summary` field to Google Places Details API call — it's already returned as `review_summary` (from generativeSummary) or absent; use whichever is non-null.
- TypeScript: run `npx tsc --noEmit` from `frontend/` to verify — zero new errors allowed.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `engine/reco_engine.py` | **Create** | Python port of gap detection + reco resolution |
| `main.py` | **Modify** | (1) Rate limit after cache in `/place-details` + `/reel-reco`; (2) call reco engine at end of `engine_itinerary` |
| `frontend/src/modules/route/reel/reco-prefetch.ts` | **Delete** | Replaced by backend |
| `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` | **Modify** | Remove prefetch call + refs; remove onExplore prop; fix loading screen count label |
| `frontend/src/modules/route/reel/ReelStopCard.tsx` | **Modify** | Remove `onExplore` prop and "Explore nearby" button (lines 1018–1030) |
| `frontend/src/modules/route/reel/ReelRecoCard.tsx` | **Modify** | Remove "Explore nearby" button (lines 222–244) |
| `frontend/src/modules/route/reel/reel-builder.ts` | **Modify** | Fix intro card: remove `totalRecos` / "picks" text; suppress `walking_gap` reco card |
| `frontend/src/modules/destination/DateRangeCalendar.tsx` | **Modify** | Add `maxDays?: number` prop; cap selection to `maxDays` after start is chosen |
| `frontend/src/modules/destination/DestinationScreen.tsx` | **Modify** | Pass `maxDays={14}` to DateRangeCalendar |

---

## Task 1: Fix rate limiter order in `/place-details` and `/reel-reco`

**Files:**
- Modify: `main.py:3963-3965` (place-details rate check)
- Modify: `main.py:4412-4414` (reel-reco rate check)

**Interfaces:**
- Consumes: nothing new
- Produces: cache hits no longer consume the 100 req/hr/IP budget

- [ ] **Step 1: Move rate limit check after cache read in `/place-details`**

In `main.py`, the current order at line ~3963 is:
```python
client_ip = request.client.host if request.client else "unknown"
if not _check_rate_limit(client_ip):
    raise HTTPException(status_code=429, detail="Rate limit exceeded")

# 1. Check Supabase cache
if _supabase:
    try:
        cached = ( ... )
        if cached_row:
            ...
            return cached_row["data"]  # cache hit — no Google call
    except Exception:
        pass  # cache failure is non-fatal
```

Change it to:
```python
client_ip = request.client.host if request.client else "unknown"

# 1. Check Supabase cache — cache hits bypass rate limit entirely
if _supabase:
    try:
        cached = (
            _supabase.table("place_details_cache")
            .select("data, fetched_at")
            .eq("place_id", place_id)
            .maybe_single()
            .execute()
        )
        cached_row = _maybe_single_data(cached)
        if cached_row:
            fetched_at = datetime.fromisoformat(cached_row["fetched_at"])
            if datetime.now(timezone.utc) - fetched_at < timedelta(days=PLACE_CACHE_TTL_DAYS):
                return cached_row["data"]
    except Exception:
        pass

# Cache miss — check rate limit before calling Google
if not _check_rate_limit(client_ip):
    raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

- [ ] **Step 2: Apply same reorder in `/reel-reco`**

In `main.py` around line 4412, `/reel-reco` has no cache of its own but still rate-limits. The Nearby Search results are not cached. Leave the check in place but note it. No code change needed here — `/reel-reco` will be called from the backend in Task 2 (bypassing HTTP entirely), so the rate limit on that endpoint becomes irrelevant for reco computation.

- [ ] **Step 3: Verify backend starts cleanly**

```bash
cd /Users/souravbiswas/uncover-roads
python -c "import main; print('OK')"
```
Expected: `OK` with no import errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add main.py
git commit -m "fix: check place_details_cache before rate limit in /place-details

Cache hits are free — they should not consume the 100 req/hr/IP budget.
Moves _check_rate_limit after the Supabase cache read so only Google API
misses count toward the limit."
```

---

## Task 2: Python reco engine — gap detection module

**Files:**
- Create: `engine/reco_engine.py`

**Interfaces:**
- Consumes: `stops_out` list of stop dicts (as built in `engine_itinerary`), persona weights dict, archetype string, city string, day metadata
- Produces: `derive_day_recos(stops_out, signal)` → `list[dict]` where each dict is `{trigger, after_stop_id, lat, lon, city}`

This module is a Python port of the key dimensions from `reco-engine/engine.ts` + `reco-engine/profile.ts`. It only handles the dimensions that generate place-fetching triggers (lunch, dinner, evening, culture, rest, social_gap, hidden_gem). Structural triggers (walking_gap, density_excess, etc.) are excluded — they don't need a place fetch.

- [ ] **Step 1: Create `engine/reco_engine.py`**

```python
"""
Python port of the TypeScript reco-engine gap detection logic.
Only handles dimensions that produce place-fetching triggers.
Structural triggers (walking_gap, density_excess, etc.) are excluded.
"""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Optional


FOOD_CATS  = {"restaurant", "cafe", "bakery", "street_food", "market"}
CULTURE_CATS = {"museum", "gallery", "historic", "heritage", "library", "spiritual"}
OUTDOOR_CATS = {"park", "viewpoint", "beach", "zoo", "aquarium", "amusement_park"}
SOCIAL_CATS  = {"bar", "nightlife", "market", "restaurant"}
REST_CATS    = {"cafe", "park"}
LANDMARK_CATS = {"museum", "historic", "tourism", "gallery", "amusement_park", "zoo", "aquarium"}

# City character — matches profile.ts CITY_CHARACTER
_CITY_CHARACTER: dict[str, dict] = {
    "singapore": {"heritage": 0.5, "nightlife": 0.5},
    "dubai": {"heritage": 0.0, "nightlife": 0.5},
    "tokyo": {"heritage": 1.0, "nightlife": 1.0},
    "kyoto": {"heritage": 1.0, "nightlife": 0.0},
    "bangkok": {"heritage": 0.5, "nightlife": 1.0},
    "mumbai": {"heritage": 0.5, "nightlife": 1.0},
    "bengaluru": {"heritage": 0.5, "nightlife": 0.5},
    "delhi": {"heritage": 1.0, "nightlife": 0.5},
    "goa": {"heritage": 0.5, "nightlife": 1.0},
    "london": {"heritage": 1.0, "nightlife": 1.0},
    "paris": {"heritage": 1.0, "nightlife": 1.0},
    "barcelona": {"heritage": 1.0, "nightlife": 1.0},
    "rome": {"heritage": 1.0, "nightlife": 0.5},
    "amsterdam": {"heritage": 1.0, "nightlife": 1.0},
    "istanbul": {"heritage": 1.0, "nightlife": 0.5},
    "new york": {"heritage": 0.5, "nightlife": 1.0},
    "los angeles": {"heritage": 0.0, "nightlife": 1.0},
    "berlin": {"heritage": 1.0, "nightlife": 1.0},
    "sydney": {"heritage": 0.5, "nightlife": 1.0},
    "bali": {"heritage": 0.5, "nightlife": 0.5},
    "hong kong": {"heritage": 0.5, "nightlife": 1.0},
    "kuala lumpur": {"heritage": 0.5, "nightlife": 0.5},
    "seoul": {"heritage": 0.5, "nightlife": 1.0},
    "prague": {"heritage": 1.0, "nightlife": 1.0},
    "lisbon": {"heritage": 1.0, "nightlife": 1.0},
    "mexico city": {"heritage": 1.0, "nightlife": 1.0},
    "rio de janeiro": {"heritage": 0.5, "nightlife": 1.0},
    "cape town": {"heritage": 0.5, "nightlife": 0.5},
    "marrakech": {"heritage": 1.0, "nightlife": 0.0},
    "cairo": {"heritage": 1.0, "nightlife": 0.0},
    "nairobi": {"heritage": 0.0, "nightlife": 0.5},
    "vienna": {"heritage": 1.0, "nightlife": 0.5},
    "zurich": {"heritage": 0.5, "nightlife": 0.5},
    "osaka": {"heritage": 0.5, "nightlife": 1.0},
    "milan": {"heritage": 1.0, "nightlife": 1.0},
    "athens": {"heritage": 1.0, "nightlife": 1.0},
    "kathmandu": {"heritage": 1.0, "nightlife": 0.0},
    "colombo": {"heritage": 0.5, "nightlife": 0.5},
    "abu dhabi": {"heritage": 0.5, "nightlife": 0.0},
    "taipei": {"heritage": 0.5, "nightlife": 1.0},
    "hanoi": {"heritage": 0.5, "nightlife": 0.5},
}

# Trigger → (time_default, duration_min, api_category)
TRIGGER_DEFAULTS: dict[str, tuple[str, int, str]] = {
    "lunch":     ("13:00", 60,  "restaurant"),
    "dinner":    ("19:30", 90,  "restaurant"),
    "evening":   ("20:00", 90,  "nightlife"),
    "rest":      ("15:30", 30,  "cafe"),
    "culture":   ("10:30", 90,  "museum"),
    "social_gap":("17:00", 60,  "bar"),
    "hidden_gem":("11:00", 45,  "point_of_interest"),
    "local_food":("12:30", 60,  "restaurant"),
    "famous_spots":("10:00",60, "tourism"),
}

GAP_FLOOR = 0.20


def _time_to_min(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def _city_character(city: str) -> dict:
    return _CITY_CHARACTER.get(city.lower().strip(), {"heritage": 0.5, "nightlife": 0.5})


@dataclass
class RecoSignal:
    weights: dict          # EngineWeights as dict
    archetype: str
    archetype_group: str   # 'cultural' | 'sensory' | 'social' | 'explorer'
    pace: str              # 'slow' | 'moderate' | 'fast'
    city: str
    is_first_day: bool
    is_last_day: bool
    arrival_time: Optional[str]
    departure_time: Optional[str]


_ARCHETYPE_GROUPS: dict[str, str] = {
    "historian": "cultural", "slowscholar": "cultural",
    "epicurean": "sensory", "aesthete": "sensory",
    "slowtraveller": "sensory", "ritualseeker": "sensory",
    "pulse": "social", "nightcreature": "social",
    "wanderer": "explorer", "voyager": "explorer",
    "explorer": "explorer", "flaneur": "explorer", "drifter": "explorer",
}


def _archetype_group(archetype: str) -> str:
    key = archetype.lower().replace(" ", "").replace("-", "").replace("_", "")
    return _ARCHETYPE_GROUPS.get(key, "explorer")


def _anchor_stop(stops: list[dict], prefer_last: bool = False, prefer_noon: bool = False) -> Optional[dict]:
    if not stops:
        return None
    if prefer_last:
        return stops[-1]
    if prefer_noon:
        def noon_dist(s):
            end = _time_to_min(s.get("time", "09:00")) + s.get("durationMin", 60)
            return abs(end - 720)
        return min(stops, key=noon_dist)
    return stops[len(stops) // 2]


def derive_day_recos(
    stops: list[dict],   # stops_out dicts for this day (already serialised)
    signal: RecoSignal,
) -> list[dict]:
    """
    Returns list of trigger dicts:
    {trigger, after_stop_id, lat, lon, city, time, duration_min, category}

    One trigger per gap dimension. Deduped by trigger type.
    """
    if not stops:
        return []

    w = signal.weights
    city_char = _city_character(signal.city)
    heritage  = city_char["heritage"]
    nightlife = city_char["nightlife"]

    arrival_min   = _time_to_min(signal.arrival_time)   if signal.is_first_day and signal.arrival_time   else None
    departure_min = _time_to_min(signal.departure_time) if signal.is_last_day  and signal.departure_time else None

    meal_evening_blocked = (
        (departure_min is not None and departure_min < 1020) or
        (arrival_min   is not None and arrival_min   > 1020)
    )
    lunch_blocked = arrival_min is not None and arrival_min > 900

    # ── Compute actual profile from stops ──────────────────────────────
    sorted_stops = sorted(stops, key=lambda s: _time_to_min(s.get("time", "09:00")))

    has_lunch = any(
        660 <= _time_to_min(s.get("time", "00:00")) <= 900 and s.get("category", "") in FOOD_CATS
        for s in sorted_stops
    )
    has_dinner = any(
        _time_to_min(s.get("time", "00:00")) >= 1020 and s.get("category", "") in FOOD_CATS
        for s in sorted_stops
    )
    has_evening = any(_time_to_min(s.get("time", "00:00")) >= 1200 for s in sorted_stops)
    has_culture = any(s.get("category", "") in CULTURE_CATS for s in sorted_stops)
    has_rest    = any(s.get("category", "") in REST_CATS    for s in sorted_stops)
    has_social  = any(s.get("category", "") in SOCIAL_CATS  for s in sorted_stops)
    has_landmark = any(s.get("category", "") in LANDMARK_CATS for s in sorted_stops)
    has_hidden_gem = any(
        (s.get("stage") == "hidden_gem") or
        (s.get("stage") is None and s.get("category", "") not in {"museum", "historic", "viewpoint", "beach"} and (s.get("rating") or 0) >= 4.3)
        for s in sorted_stops
    )

    # ── Targets ────────────────────────────────────────────────────────
    lunch_target   = 0 if lunch_blocked else 0.9
    dinner_target  = 0 if meal_evening_blocked else max(w.get("w_food_density", 0.5) * 0.8 + 0.2, 0.5)
    evening_target = 0 if meal_evening_blocked else max(w.get("w_nightlife", 0.3), nightlife * 0.4)
    culture_target = max(w.get("w_culture_depth", 0.3), heritage * 0.5)
    rest_target    = min(1.0, w.get("w_rest_need", 0.3) * 0.7 + (0.3 if signal.pace == "slow" else 0))
    social_target  = 0.2 if signal.archetype_group == "social" else 0.6
    hidden_gem_target = w.get("w_spontaneity", 0.4) * 0.6

    # ── Gap → trigger ──────────────────────────────────────────────────
    triggers: list[dict] = []
    seen: set[str] = set()

    def _emit(trigger: str, anchor: Optional[dict]) -> None:
        if trigger in seen or anchor is None:
            return
        seen.add(trigger)
        defaults = TRIGGER_DEFAULTS.get(trigger)
        if not defaults:
            return
        time_default, dur, cat = defaults
        triggers.append({
            "trigger":       trigger,
            "after_stop_id": anchor.get("id"),
            "lat":           anchor.get("lat"),
            "lon":           anchor.get("lon"),
            "city":          signal.city,
            "time":          time_default,
            "duration_min":  dur,
            "category":      cat,
        })

    if not has_lunch   and (lunch_target - 0) >= GAP_FLOOR:
        _emit("lunch",      _anchor_stop(sorted_stops, prefer_noon=True))
    if not has_dinner  and (dinner_target - 0) >= GAP_FLOOR:
        _emit("dinner",     _anchor_stop(sorted_stops, prefer_last=True))
    if not has_evening and (evening_target - 0) >= GAP_FLOOR:
        _emit("evening",    _anchor_stop(sorted_stops, prefer_last=True))
    if not has_culture and (culture_target - 0) >= GAP_FLOOR:
        _emit("culture",    _anchor_stop(sorted_stops))
    if not has_rest    and (rest_target - 0) >= GAP_FLOOR:
        _emit("rest",       _anchor_stop(sorted_stops))
    if not has_social  and (social_target - 0) >= GAP_FLOOR:
        _emit("social_gap", _anchor_stop(sorted_stops))
    if not has_hidden_gem and (hidden_gem_target - 0) >= GAP_FLOOR:
        _emit("hidden_gem", _anchor_stop(sorted_stops))

    # Famous spots: inject if no landmark stop and fewer than 4 triggers already
    if not has_landmark and len(triggers) < 4:
        _emit("famous_spots", _anchor_stop(sorted_stops))

    return triggers
```

- [ ] **Step 2: Verify import works**

```bash
cd /Users/souravbiswas/uncover-roads
python -c "from engine.reco_engine import derive_day_recos; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add engine/reco_engine.py
git commit -m "feat: Python reco engine — gap detection for build-time reco injection

Ports the key gap dimensions from TypeScript reco-engine/engine.ts and
profile.ts. Only dimensions that produce place-fetch triggers are included.
Structural triggers (walking_gap, density_excess, etc.) are excluded."
```

---

## Task 3: Inject reco stops at itinerary build time in `engine_itinerary`

**Files:**
- Modify: `main.py` — `engine_itinerary` function, after `stops_out` is built per day

**Interfaces:**
- Consumes: `derive_day_recos` from `engine/reco_engine.py`; `_batch_place_details`; existing Nearby Search logic extracted as helper `_resolve_reco_trigger`
- Produces: each day's `stops_out` has reco stops injected with `isEngineAdded: True`

- [ ] **Step 1: Add `_resolve_reco_trigger` helper above `engine_itinerary`**

Find the `_batch_place_details` function (around line 4811) and add this helper after it:

```python
def _resolve_reco_trigger(
    trigger: dict,
    existing_place_ids: set[str],
    supabase_client,
    google_api_key: str | None,
    weights: dict,
) -> dict | None:
    """
    Given a trigger dict from derive_day_recos, call Nearby Search + place_details_cache
    and return a stop dict ready to insert into stops_out, or None on failure.
    """
    if not google_api_key:
        return None

    lat, lon = trigger.get("lat"), trigger.get("lon")
    if lat is None or lon is None:
        return None

    from engine.reco_engine import TRIGGER_DEFAULTS
    _TRIGGER_TYPES: dict[str, list[str]] = {
        "lunch":      ["restaurant"],
        "dinner":     ["restaurant"],
        "evening":    ["night_club", "bar"],
        "rest":       ["cafe"],
        "culture":    ["museum", "art_gallery"],
        "social_gap": ["bar"],
        "hidden_gem": ["point_of_interest", "establishment"],
        "local_food": ["restaurant"],
        "famous_spots": ["tourist_attraction", "landmark"],
    }
    _TRIGGER_RADIUS: dict[str, int] = {
        "famous_spots": 3000, "culture": 2000, "hidden_gem": 1500,
    }

    trig = trigger["trigger"]
    google_types = _TRIGGER_TYPES.get(trig, ["restaurant"])
    radius = _TRIGGER_RADIUS.get(trig, 1000)

    best: dict | None = None
    best_score = -1.0

    for gtype in google_types:
        try:
            resp = requests.get(
                f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                params={"location": f"{lat},{lon}", "radius": radius,
                        "type": gtype, "key": google_api_key},
                timeout=5,
            )
            data = resp.json()
            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                continue
            for place in data.get("results", [])[:8]:
                pid = place.get("place_id", "")
                if not pid or pid in existing_place_ids:
                    continue
                rating = place.get("rating") or 0
                score = rating / 5.0
                if score > best_score:
                    best_score = score
                    best = place
                    best["_gtype"] = gtype
        except Exception:
            continue

    if not best:
        return None

    pid = best.get("place_id", "")
    existing_place_ids.add(pid)

    # Fetch from cache (no Google call — read-only)
    details_map = _batch_place_details(supabase_client, [pid]) if supabase_client else {}
    details = details_map.get(pid, {})

    loc = best.get("geometry", {}).get("location", {})
    stop_lat = loc.get("lat", lat)
    stop_lon = loc.get("lng", lon)

    time_default, dur, cat_default = TRIGGER_DEFAULTS.get(trig, ("10:00", 60, "point_of_interest"))
    category = best.get("_gtype") or cat_default

    why_phrases: dict[str, str] = {
        "lunch": "A good spot for lunch near your route.",
        "dinner": "Worth stopping for dinner.",
        "evening": "A place to end the evening.",
        "rest": "A quiet spot to take a break.",
        "culture": "A cultural stop that fits the day.",
        "social_gap": "Somewhere to sit and watch the city.",
        "hidden_gem": "Off the main circuit — worth knowing about.",
        "local_food": "Local food that doesn't make the guidebooks.",
        "famous_spots": "A landmark worth seeing while you're here.",
    }

    import uuid as _uuid
    return {
        "id":          f"reco-{trig}-{_uuid.uuid4().hex[:8]}",
        "placeId":     pid,
        "title":       details.get("name") or best.get("name", ""),
        "area":        "",
        "city":        trigger.get("city", ""),
        "day":         trigger.get("_day_number", 1),
        "time":        time_default,
        "durationMin": dur,
        "category":    category,
        "lat":         stop_lat,
        "lon":         stop_lon,
        "priceLevel":  details.get("price_level") or best.get("price_level"),
        "rating":      details.get("rating") or best.get("rating"),
        "weekdayText": details.get("weekday_text") or None,
        "whyForYou":   why_phrases.get(trig, "An addition based on your plan."),
        "localTip":    details.get("review_summary") or details.get("editorial_summary") or None,
        "googleMapsUrl": f"https://www.google.com/maps/place/?q=place_id:{pid}",
        "website":     details.get("website") or None,
        "photoRef":    details.get("photo_ref") or None,
        "tags":        [],
        "signals":     [],
        "stage":       None,
        "velocityRatio": None,
        "transitFromPrev": None,
        "walkFromPrev": None,
        "isUserAdded": False,
        "isEngineAdded": True,
    }
```

- [ ] **Step 2: Add reco injection at the end of `engine_itinerary`, after the per-day loop that builds `stops_out`**

Find the section in `engine_itinerary` where the per-day loop ends and `days_out` is assembled (around line 5580). Add the following block **after** `stops_out` is complete for each day, right before the `days_out.append(...)` call:

```python
        # ── Inject reco stops for this day ──────────────────────────────
        try:
            from engine.reco_engine import derive_day_recos, RecoSignal, _archetype_group as _ag
            _pace_map = {"slow": "slow", "balanced": "moderate", "pack": "fast", "spontaneous": "moderate"}
            _raw_answers = body.rawOBAnswers if hasattr(body, "rawOBAnswers") else {}
            _pace = _pace_map.get((_raw_answers.get("pace") or ["moderate"])[0], "moderate") if _raw_answers else "moderate"
            _reco_signal = RecoSignal(
                weights=persona,
                archetype=archetype,
                archetype_group=_ag(archetype),
                pace=_pace,
                city=_stop_city if "_stop_city" in dir() else body.city,
                is_first_day=(i == 0),
                is_last_day=(i == len(result.days) - 1),
                arrival_time=body.arrivalTime or None,
                departure_time=body.departureTime or None,
            )
            _existing_pids: set[str] = {s.get("placeId", "") for s in stops_out if s.get("placeId")}
            _reco_triggers = derive_day_recos(stops_out, _reco_signal)
            for _trigger in _reco_triggers:
                _trigger["_day_number"] = i + 1
                _reco_stop = _resolve_reco_trigger(
                    _trigger, _existing_pids, _supabase, GOOGLE_PLACES_API_KEY, persona
                )
                if _reco_stop:
                    # Insert after anchor stop; fall back to appending
                    _anchor_id = _trigger.get("after_stop_id")
                    _anchor_idx = next(
                        (idx for idx, s in enumerate(stops_out) if s.get("id") == _anchor_id), -1
                    )
                    if _anchor_idx >= 0:
                        stops_out.insert(_anchor_idx + 1, _reco_stop)
                    else:
                        stops_out.append(_reco_stop)
        except Exception as _reco_err:
            print(f"[reco_inject] day {i}: {_reco_err}")
            # Non-fatal: reco injection failure doesn't break the itinerary
```

- [ ] **Step 3: Find the exact insertion point**

Run this to confirm the line number where `days_out.append` happens:

```bash
grep -n "days_out.append\|scenic_corridors_out\b" /Users/souravbiswas/uncover-roads/main.py | head -10
```

Insert the reco block AFTER `stops_out` is fully built and BEFORE `days_out.append(...)`.

- [ ] **Step 4: Verify backend imports cleanly**

```bash
cd /Users/souravbiswas/uncover-roads
python -c "import main; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Test with a real API call (manual)**

Start the backend locally and call the endpoint:
```bash
# In one terminal:
uvicorn main:app --reload --port 8000

# In another terminal — use a known user token from the app:
curl -s -X POST http://localhost:8000/engine-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"city":"Bangkok","lat":13.75,"lon":100.5,"days":2,"startDate":"2026-08-01","personaArchetype":"explorer","selectedPlaces":[{"title":"Grand Palace","lat":13.75,"lon":100.49,"category":"historic","place_id":"ChIJbbpAhxCe4jARTB3lRIFzjdQ","city":"Bangkok"}]}'
```
Expected: response JSON contains days → stops where some stops have `"isEngineAdded": true`.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add main.py engine/reco_engine.py
git commit -m "feat: inject reco stops at itinerary build time

Adds _resolve_reco_trigger helper and calls derive_day_recos per day
inside engine_itinerary. Reco stops appear in the response as
isEngineAdded: true — no frontend prefetch needed.

Nearby Search + place_details_cache are called synchronously per trigger.
Non-fatal: any per-trigger failure is logged and skipped."
```

---

## Task 4: Delete frontend prefetch pipeline

**Files:**
- Delete: `frontend/src/modules/route/reel/reco-prefetch.ts`
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx`

**Interfaces:**
- Consumes: nothing (deleting code)
- Produces: `ItineraryReelScreen` no longer imports or calls `prefetchRecoStops`

- [ ] **Step 1: Delete `reco-prefetch.ts`**

```bash
rm /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/reco-prefetch.ts
```

- [ ] **Step 2: Remove prefetch imports and refs from `ItineraryReelScreen.tsx`**

Remove these lines from the import block:
```typescript
import { prefetchRecoStops } from './reco-prefetch';
import type { RecoPrefetchResult } from './reco-prefetch';
```

Remove these refs (around line 181–185):
```typescript
// Enriched itinerary: original stops + prefetched reco stops injected as isEngineAdded
const enrichedItineraryRef = useRef<typeof activeItinerary | null>(null);
const prefetchedByDayRef = useRef<RecoPrefetchResult['prefetchedByDay']>(new Map());
```

- [ ] **Step 3: Remove the prefetch `useEffect` block**

Find the `useEffect` that calls `prefetchRecoStops` (it's in the main loading effect, inside a `Promise.all`). Replace the entire prefetch side of the Promise.all so only photos are awaited:

Before (schematic):
```typescript
const [prefetchResult, _photos] = await Promise.all([
  prefetchRecoStops(activeItinerary, state, wxByCity, existingPlaceIds),
  preloadPhotos(...),
]);
enrichedItineraryRef.current = prefetchResult.enrichedItinerary;
prefetchedByDayRef.current   = prefetchResult.prefetchedByDay;
```

After:
```typescript
await preloadPhotos(...);
```

- [ ] **Step 4: Replace `enrichedItineraryRef.current ?? activeItinerary` with `activeItinerary`**

Search for all occurrences of `enrichedItineraryRef.current` in `ItineraryReelScreen.tsx`:
```bash
grep -n "enrichedItineraryRef" /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/ItineraryReelScreen.tsx
```
Replace each with `activeItinerary`.

- [ ] **Step 5: Remove `prefetchedByDay` parameter from `buildFiltered` calls**

`buildFiltered` was modified to accept `prefetchedByDay` to suppress fallback reco stubs. Since reco stubs are no longer needed at all (recos come pre-injected from backend), find the `buildFiltered` calls and remove the parameter. Also remove the `prefetchedByDay` parameter from `buildFiltered`'s signature in `reel-builder.ts` and its usage.

- [ ] **Step 6: Fix loading screen step label**

In `ItineraryReelScreen.tsx` around line 666–669, the STEPS array has:
```typescript
{ label: 'Finding picks for you',  done: imagesReady },
```
Change to:
```typescript
{ label: 'Loading your itinerary', done: imagesReady },
```

Also update `loadingStep` type back to `0 | 1` if it was changed to `0 | 1 | 2` for the prefetch step.

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | head -30
```
Expected: zero errors referencing `reco-prefetch`, `enrichedItineraryRef`, or `prefetchedByDay`.

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add -A
git commit -m "refactor: delete reco-prefetch.ts — recos now come from backend

prefetchRecoStops and all related refs/effects are removed from
ItineraryReelScreen. The backend injects isEngineAdded stops at build
time so the frontend receives a complete itinerary with no prefetch step."
```

---

## Task 5: Remove "Explore nearby" button from reel cards

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx:1018-1030`
- Modify: `frontend/src/modules/route/reel/ReelRecoCard.tsx:222-244`
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` — remove `onExplore` prop pass

**Interfaces:**
- Consumes: nothing
- Produces: `ReelStopCard` no longer accepts or renders `onExplore`

- [ ] **Step 1: Remove `onExplore` from `ReelStopCard.tsx`**

Remove from Props interface (line ~29):
```typescript
onExplore?: () => void;
```

Remove from component signature (line ~295):
```typescript
{ card, active, onInteract, isJustAdjusted, onExplore, onRemove, onRegisterPanelControl }
```
→ remove `onExplore` from destructure.

Remove the entire "Explore nearby CTA" block (lines 1018–1030):
```typescript
{/* Explore nearby CTA */}
{onExplore && (
  <>
    <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '20px 0' }} />
    <button
      onClick={onExplore}
      style={{ ... }}
    >
      <span className="ms" style={{ fontSize: 18 }}>explore</span>
      Explore nearby
    </button>
  </>
)}
```

- [ ] **Step 2: Remove `onExplore` prop pass in `ItineraryReelScreen.tsx`**

Find the `<ReelStopCard` render (around line 1103) and remove:
```typescript
onExplore={() => {
  const { lat, lon } = (card as ReelStopCardType).stop;
  dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: [lat - 0.03, lat + 0.03, lon - 0.03, lon + 0.03] } });
  dispatch({ type: 'GO_TO', screen: 'map' });
}}
```

- [ ] **Step 3: Remove "Explore nearby" from `ReelRecoCard.tsx`**

Remove the block at lines 222–244:
```typescript
{/* Explore nearby CTA */}
<div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '20px 0' }} />
<button
  onClick={(e) => { ... }}
  style={{ ... }}
>
  <span className="ms" style={{ fontSize: 18 }}>explore</span>
  Explore nearby
</button>
```
Also remove `onMapNavigate` from `ReelRecoCard` Props if its only use was this button.

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | head -20
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/route/reel/ReelStopCard.tsx \
        src/modules/route/reel/ReelRecoCard.tsx \
        src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat: remove Explore nearby button from reel stop and reco cards

Product model: map is the exploration surface. The reel is for reviewing
and trimming the plan. Explore nearby button was sending users back to
map, which they can already do via the back button."
```

---

## Task 6: Fix intro card count + suppress walking_gap + fix scroll dots

**Files:**
- Modify: `frontend/src/modules/route/reel/reel-builder.ts`

**Interfaces:**
- Consumes: existing `buildFiltered` return, `recosByDayIdx`
- Produces: intro card shows single stop count (no "picks"); `walking_gap` trigger cards suppressed; scroll dots count matches stop cards only

- [ ] **Step 1: Remove "picks" from intro card in `reel-builder.ts`**

At line ~203 in `ReelIntroCard.tsx` the chip renders:
```
{card.totalStops} stops · {card.totalRecos} picks
```

In `reel-builder.ts` at line ~514-515, `totalRecos: totalRecoCards` is set. Change the intro card build to set `totalRecos: 0` so the "· X picks" branch never renders:

```typescript
// Before:
totalRecos: totalRecoCards,

// After:
totalRecos: 0,
```

The `ReelIntroCard.tsx` already gates on `(card.totalRecos ?? 0) > 0` — setting it to 0 suppresses the picks chip with no JSX change needed.

- [ ] **Step 2: Suppress `walking_gap` reco cards in `buildFiltered`**

In `reel-builder.ts`, find where reco cards are built from `recosByDayIdx`. Add `walking_gap` to the set of triggers that are skipped (alongside structural triggers that already exist):

Search for where reco cards are pushed to the card list. Find the trigger check:
```bash
grep -n "walking_gap\|SKIP\|trigger.*reco\|reco.*trigger" /Users/souravbiswas/uncover-roads/frontend/src/modules/route/reel/reel-builder.ts | head -15
```

Add a filter to skip `walking_gap` trigger recos before they're added to the card list:
```typescript
// In the section that processes recosByDayIdx entries:
const filteredRecos = dayRecos.filter(r => r.trigger !== 'walking_gap');
```

- [ ] **Step 3: Verify scroll dots are already correct**

The dots filter is at `ItineraryReelScreen.tsx:1007`:
```typescript
const dotCards = displayCards.filter(c =>
  c.type !== 'reco' && c.type !== 'transit' && c.type !== 'intel' &&
  c.type !== 'scenic' && c.type !== 'group' && c.type !== 'day_transition'
);
```
This correctly shows one dot per stop + intro card. The mismatch reported (13 dots vs 57 cards) was caused by the prefetch failing — recos fell back to 57 lazy `ReelRecoCard` stubs which inflate `displayCards` but not `dotCards`. With recos now coming from backend as proper stop cards (`type: 'stop'`), they WILL appear in dotCards. Confirm this is intentional: each reco stop should have a dot.

If dots become too many (e.g., 40+ dots for a long trip), a future task can switch to a progress bar. No code change needed now.

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/route/reel/reel-builder.ts
git commit -m "fix: remove picks count from intro card; suppress walking_gap reco stubs

Intro card now shows total stops only — 'X picks' was confusing because
the number included failed prefetch attempts. walking_gap trigger never
produces a place recommendation so its reco card is suppressed."
```

---

## Task 7: Date limit cap — 14 days max

**Files:**
- Modify: `frontend/src/modules/destination/DateRangeCalendar.tsx`
- Modify: `frontend/src/modules/destination/DestinationScreen.tsx`

**Interfaces:**
- Consumes: `DateRangeCalendar` Props
- Produces: users cannot select a date range longer than 14 days

- [ ] **Step 1: Add `maxDays` prop to `DateRangeCalendar`**

In `DateRangeCalendar.tsx`, add to the Props interface:
```typescript
maxDays?: number;
```

In `handleDayClick`, after a start date is set and the user selects an end date, cap it:
```typescript
// Existing logic (around line 55-62):
if (!startDate || (startDate && endDate)) {
  setStartDate(iso);
  setEndDate(null);
} else {
  const s = iso < startDate ? iso : startDate;
  let e = iso < startDate ? startDate : iso;

  // Cap end date to maxDays after start
  if (maxDays) {
    const maxEnd = new Date(s + 'T12:00:00');
    maxEnd.setDate(maxEnd.getDate() + maxDays - 1);
    const maxIso = maxEnd.toISOString().slice(0, 10);
    if (e > maxIso) e = maxIso;
  }

  setStartDate(s);
  setEndDate(e);
  onSelect(s, e);
}
```

Also grey out days beyond the cap during hover: when `startDate` is set and `!endDate`, days more than `maxDays - 1` days after `startDate` should render as disabled (same style as past dates). Add this check in the day render:
```typescript
const isOverLimit = !!maxDays && startDate && !endDate &&
  iso > (() => {
    const d = new Date(startDate + 'T12:00:00');
    d.setDate(d.getDate() + maxDays - 1);
    return d.toISOString().slice(0, 10);
  })();
```
Apply disabled styling to `isOverLimit` days (same as `isPast`).

- [ ] **Step 2: Pass `maxDays={14}` in `DestinationScreen.tsx`**

Find the `<DateRangeCalendar` usage in `DestinationScreen.tsx` (around line 80+) and add the prop:
```typescript
<DateRangeCalendar
  city={pendingCity}
  maxDays={14}
  onSelect={handleDateSelect}
  ...
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | head -20
```
Expected: zero errors.

- [ ] **Step 4: Manual test**

Open the app in browser. Pick a city. On the calendar:
- Select a start date
- Attempt to select an end date 20 days later — it should snap to start + 13 days
- Days beyond 14 should appear greyed out

- [ ] **Step 5: Commit**

```bash
git add src/modules/destination/DateRangeCalendar.tsx \
        src/modules/destination/DestinationScreen.tsx
git commit -m "feat: 14-day max trip duration cap in date picker

Adds maxDays prop to DateRangeCalendar. End date is capped at
startDate + maxDays - 1. Days beyond the limit are greyed out.
DestinationScreen passes maxDays=14 (multi-city upper bound)."
```

---

## Self-Review

### Spec coverage
- ✅ Rate limit fires after cache — Task 1
- ✅ Backend reco computation at build time — Tasks 2 + 3
- ✅ Delete `reco-prefetch.ts` — Task 4
- ✅ Remove "Explore nearby" button — Task 5
- ✅ Fix intro card "57 picks" — Task 6
- ✅ Suppress walking_gap reco cards — Task 6
- ✅ Scroll dots mismatch — Task 6 (root cause fixed; dots now track real stop cards)
- ✅ Date limit 14 days — Task 7
- ✅ Loading screen step label fix — Task 4 Step 6

### Type consistency
- `derive_day_recos` returns `list[dict]` with keys: `trigger, after_stop_id, lat, lon, city, time, duration_min, category` — used consistently in Task 3.
- `_resolve_reco_trigger` consumes that exact shape and adds `_day_number` before the call — consistent.
- `RecoSignal` dataclass defined in Task 2 is imported in Task 3 as `from engine.reco_engine import derive_day_recos, RecoSignal` — consistent.
- `onExplore` prop removed from `ReelStopCard` Props AND from the `ItineraryReelScreen` render — no dangling references.

### Placeholder check
- No TBDs, no "add appropriate error handling" without code — every step has the actual implementation.
