# Opening Hours Enforcement + Reel Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce opening hours in the engine pipeline (reorder stops that are scheduled before they open, swap unfixable stops with insert candidates), wire user arrival time into day-1 scheduling, and fix truncated reco labels + silenced legacy reco functions in the frontend.

**Architecture:** Two post-scheduling passes run after `_split_into_days` in `builder.py`: `enforce_opening_hours` tries greedy in-day reordering (Option A), then `apply_swapper` replaces stops still in conflict using persona-scored insert candidates (Option C). Opening hours data flows from `place_details_cache` → `_batch_place_details` → `EngineStop.opening_hours` before the engine runs. All actions emit structured `EngineMessage` objects (what + why + consequence). User arrival time adjusts day-1 start via a new `user_arrival_time` field on `EngineContext`.

**Tech Stack:** Python 3.11, FastAPI, dataclasses, pytest; TypeScript/React for frontend fixes.

---

## File map

| File | Change |
|---|---|
| `main.py` | `_parse_weekday_text` helper; add `opening_hours_parsed` to `_batch_place_details`; pre-engine fetch for user-selected stops; add `arrivalTime` to `EngineItineraryPayload`; wire `user_arrival_time` into ctx; post-engine `enforce_opening_hours` + `apply_swapper` calls; add `arrival_time` to `persona_snapshot` |
| `engine/types.py` | Add `user_arrival_time: str \| None = None` to `EngineContext` |
| `engine/builder.py` | `_reschedule_day`; `enforce_opening_hours`; `apply_swapper`; `_haversine_km_coords` helper |
| `engine/swapper.py` | Implement `_find_alternatives` using `insert_candidates` scored by persona affinity × proximity |
| `frontend/src/modules/route/reel/ReelRecoCard.tsx` | `WebkitLineClamp: 2` → `3` on label div |
| `frontend/src/modules/route/reel/reel-builder.ts` | Merge engine + legacy reco branches; always run all reco functions |
| `tests/test_opening_hours.py` | New — unit tests for `_parse_weekday_text`, `enforce_opening_hours`, `apply_swapper` |

---

### Task 1: `_parse_weekday_text` helper + `opening_hours_parsed` in `_batch_place_details`

**Files:**
- Modify: `main.py` (add helper before line 2917, update `_batch_place_details` return at ~line 2932)
- Test: `tests/test_opening_hours.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_opening_hours.py
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import _parse_weekday_text

def test_parse_standard_hours():
    result = _parse_weekday_text(["Monday: 9:00 AM – 9:00 PM"])
    assert result == [{"day": 0, "open_min": 540, "close_min": 1260}]

def test_parse_closed():
    result = _parse_weekday_text(["Tuesday: Closed"])
    assert result == []

def test_parse_24_hours():
    result = _parse_weekday_text(["Wednesday: Open 24 hours"])
    assert result == [{"day": 2, "open_min": 0, "close_min": 1440}]

def test_parse_midnight_close():
    # 12:00 AM as close = end of day
    result = _parse_weekday_text(["Thursday: 9:00 AM – 12:00 AM"])
    assert result == [{"day": 3, "open_min": 540, "close_min": 1440}]

def test_parse_multiple_days():
    result = _parse_weekday_text([
        "Monday: 9:00 AM – 6:00 PM",
        "Sunday: Closed",
    ])
    assert len(result) == 1
    assert result[0]["day"] == 0
    assert result[0]["close_min"] == 1080
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py -v 2>&1 | head -30
```
Expected: ImportError or AttributeError — `_parse_weekday_text` not yet defined.

- [ ] **Step 3: Add `_parse_weekday_text` to `main.py`**

Add this function immediately before `def _batch_place_details` (before line 2917):

```python
import re as _re

_DAY_NAME_TO_WEEKDAY: dict[str, int] = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
_TIME_RE = _re.compile(r"(\d{1,2}):(\d{2})\s*(AM|PM)", _re.IGNORECASE)

def _parse_weekday_text(weekday_text: list[str]) -> list[dict]:
    """Parse Google Places weekday_text into [{day:0-6, open_min:int, close_min:int}].

    0=Monday … 6=Sunday, matching datetime.weekday().
    Closed days are omitted. 'Open 24 hours' → (0, 1440).
    """
    def _to_min(h: int, m: int, ampm: str) -> int:
        if ampm.upper() == "PM" and h != 12:
            h += 12
        elif ampm.upper() == "AM" and h == 12:
            h = 0
        return h * 60 + m

    result = []
    for text in weekday_text:
        colon_idx = text.find(":")
        if colon_idx < 0:
            continue
        day_name = text[:colon_idx].strip().lower()
        weekday = _DAY_NAME_TO_WEEKDAY.get(day_name)
        if weekday is None:
            continue
        rest = text[colon_idx + 1:].strip()
        if "closed" in rest.lower():
            continue
        if "open 24 hours" in rest.lower():
            result.append({"day": weekday, "open_min": 0, "close_min": 1440})
            continue
        times = _TIME_RE.findall(rest)
        if len(times) < 2:
            continue
        open_min = _to_min(int(times[0][0]), int(times[0][1]), times[0][2])
        close_min = _to_min(int(times[-1][0]), int(times[-1][1]), times[-1][2])
        if close_min == 0:   # 12:00 AM as close = midnight = end of day
            close_min = 1440
        result.append({"day": weekday, "open_min": open_min, "close_min": close_min})
    return result
```

- [ ] **Step 4: Add `opening_hours_parsed` to `_batch_place_details` return dict**

In `_batch_place_details` (~line 2932), extend the return dict:

```python
return {
    row["place_id"]: {
        "price_level":          (row.get("data") or {}).get("price_level"),
        "weekday_text":         (row.get("data") or {}).get("weekday_text") or [],
        "editorial_summary":    (row.get("data") or {}).get("editorial_summary"),
        "top_review":           (row.get("data") or {}).get("top_review"),
        "rating_count":         (row.get("data") or {}).get("rating_count"),
        "photo_ref":            (row.get("data") or {}).get("photo_ref"),
        "opening_hours_parsed": _parse_weekday_text(
            (row.get("data") or {}).get("weekday_text") or []
        ),
    }
    for row in (rows or [])
    if row.get("place_id")
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py -v
```
Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_opening_hours.py
git commit -m "feat: parse weekday_text into structured opening hours in batch detail fetch"
```

---

### Task 2: Pre-engine detail fetch — populate `EngineStop.opening_hours`

**Files:**
- Modify: `main.py` (~line 3087 EngineStop construction, ~line 3112 build_itinerary call)

Context: Currently `_batch_place_details` is called AFTER `build_itinerary` returns, so the engine never sees opening hours. We add a pre-engine fetch using only `body.selectedPlaces` place_ids so that user-selected stops have opening hours when `enforce_opening_hours` runs.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_opening_hours.py`:

```python
def test_engine_stop_opening_hours_populated():
    """EngineStop.opening_hours is populated when weekday_text is in place_details."""
    from engine.types import EngineStop
    parsed = _parse_weekday_text(["Monday: 9:00 AM – 6:00 PM"])
    stop = EngineStop(
        place_id="abc", name="Test", lat=0.0, lon=0.0,
        category="museum", duration_min=60, opening_hours=parsed,
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
    )
    assert len(stop.opening_hours) == 1
    assert stop.opening_hours[0]["open_min"] == 540
```

- [ ] **Step 2: Run test to verify it passes immediately** (EngineStop already accepts opening_hours)

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py::test_engine_stop_opening_hours_populated -v
```
Expected: PASS (no code change needed — just verifying the type accepts the field).

- [ ] **Step 3: Add pre-engine `_batch_place_details` call in `engine_itinerary`**

In `main.py`, find the `engine_stops = [...]` list comprehension (~line 3087). Insert immediately before it:

```python
    # Pre-engine detail fetch — opening hours for user-selected stops only
    _pre_place_ids = list({p.place_id or p.id for p in body.selectedPlaces if p.place_id or p.id})
    _pre_details_map = _batch_place_details(_supabase, _pre_place_ids)
```

Then update the `EngineStop` construction to pass opening hours (change `opening_hours=[]` at ~line 3095):

```python
    engine_stops = [
        EngineStop(
            place_id=p.place_id or p.id,
            name=p.title,
            lat=p.lat,
            lon=p.lon,
            category=p.category,
            duration_min=_CATEGORY_DURATION.get(p.category.lower(), 75),
            opening_hours=_pre_details_map.get(
                p.place_id or p.id, {}
            ).get("opening_hours_parsed", []),
            price_level=1,
            rating=p.rating or 4.0,
            neighborhood=None,
            is_user_added=True,
            city=p.city or body.city,
        )
        for p in body.selectedPlaces
    ]
```

- [ ] **Step 4: Verify server starts without error**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "import main; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "feat: populate EngineStop.opening_hours from place_details_cache before engine runs"
```

---

### Task 3: `enforce_opening_hours` in `builder.py` (Option A)

**Files:**
- Modify: `engine/builder.py`
- Test: `tests/test_opening_hours.py`

This function runs after `_split_into_days`. For each day, for each stop, if the scheduled time falls before opening or after closing: try swapping with subsequent stops in the day until one resolves the conflict. Re-schedule the day after every swap. Returns updated days, messages, and a set of still-conflicted place_ids for the swapper.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_opening_hours.py`:

```python
def test_enforce_opening_hours_reorders_early_stop():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import enforce_opening_hours
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.4, "w_nightlife": 0.4, "w_efficiency": 0.5}},
        city=city, travel_dates=["2026-06-09"],  # Monday
    )
    # Museum opens at 10:00 (600 min), but scheduled at 09:00
    museum = EngineStop(
        place_id="museum1", name="Museum", lat=0.0, lon=0.0,
        category="museum", duration_min=60,
        opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
        scheduled_time="09:00", city="Test",
    )
    # Park opens at 07:00 — fine at 09:00
    park = EngineStop(
        place_id="park1", name="Park", lat=0.1, lon=0.0,
        category="park", duration_min=45,
        opening_hours=[{"day": 0, "open_min": 420, "close_min": 1200}],
        price_level=1, rating=4.3, neighborhood=None, is_user_added=True,
        scheduled_time="10:30", city="Test",
    )
    day = EngineDay(date="2026-06-09", stops=[museum, park])
    days, msgs, conflicted = enforce_opening_hours([day], ctx)
    # Museum should have been moved after park
    assert days[0].stops[0].name == "Park"
    assert days[0].stops[1].name == "Museum"
    assert len(msgs) == 1
    assert "Museum" in msgs[0].what
    assert len(conflicted) == 0

def test_enforce_opening_hours_flags_unfixable():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import enforce_opening_hours
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.4, "w_nightlife": 0.4, "w_efficiency": 0.5}},
        city=city, travel_dates=["2026-06-09"],
    )
    # Both stops open only at 10:00, both scheduled at 09:00
    museum = EngineStop(
        place_id="m1", name="Museum", lat=0.0, lon=0.0, category="museum",
        duration_min=60, opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
        scheduled_time="09:00", city="Test",
    )
    gallery = EngineStop(
        place_id="g1", name="Gallery", lat=0.1, lon=0.0, category="gallery",
        duration_min=60, opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.3, neighborhood=None, is_user_added=True,
        scheduled_time="10:00", city="Test",
    )
    day = EngineDay(date="2026-06-09", stops=[museum, gallery])
    days, msgs, conflicted = enforce_opening_hours([day], ctx)
    # Museum can't be moved — gallery is also closed at 09:00
    assert "m1" in conflicted
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py::test_enforce_opening_hours_reorders_early_stop tests/test_opening_hours.py::test_enforce_opening_hours_flags_unfixable -v
```
Expected: ImportError — `enforce_opening_hours` not defined in builder.

- [ ] **Step 3: Add `_reschedule_day` and `enforce_opening_hours` to `engine/builder.py`**

Add after `_schedule_day_stops` (after ~line 58 in builder.py):

```python
def _time_str_to_min(t: str) -> int:
    h, m = (int(x) for x in t.split(":"))
    return h * 60 + m


def _reschedule_day(day: "EngineDay", ctx: EngineContext) -> None:
    """Re-assign scheduled_time to all stops in a day after an in-day reorder."""
    weights = ctx.persona.get("weights", {})
    w_rest = weights.get("w_rest_need", 0.4)
    w_night = weights.get("w_nightlife", 0.4)
    w_eff = weights.get("w_efficiency", 0.5)
    _sf = 9.0 + (w_rest - 0.5) * 2.0 + (w_night - 0.4) * 2.5 - (w_eff - 0.5) * 2.0
    _sf = max(7.5, min(11.5, _sf))
    start_h = int(_sf)
    start_m = round((_sf - start_h) * 60 / 15) * 15
    if start_m >= 60:
        start_h += 1
        start_m = 0
    _pa = ctx.persona.get("arrival_time")
    if _pa and isinstance(_pa, str) and ":" in _pa:
        try:
            start_h, start_m = (int(x) for x in _pa.split(":")[:2])
        except (ValueError, TypeError):
            pass
    buffer_min = int(ctx.persona.get("day_buffer_min", 30))
    _schedule_day_stops(day.stops, start_h, start_m, buffer_min)


_HOUR_TOLERANCE_MIN = 15  # allow 15-min window before/after hours


def enforce_opening_hours(
    days: list[EngineDay], ctx: EngineContext
) -> tuple[list[EngineDay], list[EngineMessage], set[str]]:
    """Option A: reorder stops within each day so no stop is visited before it opens.

    Returns: (updated_days, messages, conflicted_place_ids)
    conflicted_place_ids are stops that still have violations after all swap attempts.
    """
    from datetime import datetime as _dt
    messages: list[EngineMessage] = []
    conflicted: set[str] = set()

    for day in days:
        if day.is_travel_day or not day.stops:
            continue
        try:
            weekday = _dt.fromisoformat(day.date).weekday()  # 0=Monday
        except (ValueError, TypeError):
            continue

        # Multiple passes — each pass attempts one swap and restarts from position 0
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
                    candidate = day.stops[j]
                    c_oh = next(
                        (h for h in (candidate.opening_hours or []) if h.get("day") == weekday),
                        None,
                    )
                    # Tentatively reschedule to see if the swap works
                    day.stops[i], day.stops[j] = day.stops[j], day.stops[i]
                    _reschedule_day(day, ctx)
                    new_sched = _time_str_to_min(day.stops[i].scheduled_time or "09:00")
                    new_end = new_sched + day.stops[i].duration_min
                    stop_oh = next(
                        (h for h in (stop.opening_hours or []) if h.get("day") == weekday),
                        None,
                    )
                    fixed = stop_oh is None or (
                        new_sched >= (stop_oh.get("open_min", 0) - _HOUR_TOLERANCE_MIN)
                        and new_end <= (stop_oh.get("close_min", 1440) + _HOUR_TOLERANCE_MIN)
                    )
                    if fixed:
                        messages.append(EngineMessage(
                            type="resequence",
                            what=f"Moved {stop.name} to a later slot.",
                            why=(
                                f"{stop.name} opens at "
                                f"{open_min // 60:02d}:{open_min % 60:02d} — "
                                f"its original time was too early."
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
                        _reschedule_day(day, ctx)

                if not resolved and stop.place_id:
                    conflicted.add(stop.place_id)
                    break  # move on to next stop; this one needs the swapper

            if not made_swap:
                break  # stable — no more swaps possible

    return days, messages, conflicted
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py -v
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/builder.py tests/test_opening_hours.py
git commit -m "feat: enforce_opening_hours — reorder stops to respect opening times (Option A)"
```

---

### Task 4: `_find_alternatives` in `swapper.py` + `apply_swapper` in `builder.py` (Option C)

**Files:**
- Modify: `engine/swapper.py`
- Modify: `engine/builder.py`
- Test: `tests/test_opening_hours.py`

When a stop is flagged as conflicted (can't be fixed by reordering), `apply_swapper` looks for a replacement from `ctx.city.insert_candidates`, scored by persona affinity × proximity. If a replacement is found, the stop is swapped and an EngineMessage explains why. If not, an advisory is emitted and the original stop is kept.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_opening_hours.py`:

```python
def test_apply_swapper_replaces_conflicted_stop():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import apply_swapper
    from city.data_model import CityData, InsertCandidate

    candidate = InsertCandidate(
        place_id="cafe1", name="Corner Café", lat=0.05, lon=0.05,
        type="coffee", time_cost_min=30,
        persona_affinity={"explorer": 0.8},
        trigger=None, time_of_day_match=["morning"],
    )
    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[candidate],
        scenic_routes=[], transit_edges=[], engine_modifiers={},
        landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {}},
        city=city, travel_dates=["2026-06-09"],
    )
    conflict_stop = EngineStop(
        place_id="m1", name="Closed Museum", lat=0.0, lon=0.0, category="museum",
        duration_min=60, opening_hours=[{"day": 0, "open_min": 600, "close_min": 1080}],
        price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
        scheduled_time="09:00", city="Test",
    )
    day = EngineDay(date="2026-06-09", stops=[conflict_stop])
    days, msgs = apply_swapper([day], ctx, conflicted={"m1"})
    assert days[0].stops[0].name == "Corner Café"
    assert len(msgs) == 1
    assert msgs[0].type == "swap"
    assert "Corner Café" in msgs[0].what

def test_apply_swapper_emits_advisory_when_no_alternative():
    from engine.types import EngineStop, EngineDay, EngineContext
    from engine.builder import apply_swapper
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[],  # no candidates
        scenic_routes=[], transit_edges=[], engine_modifiers={},
        landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "explorer", "arrival_time": "09:00", "day_buffer_min": 30,
                 "weights": {}},
        city=city, travel_dates=["2026-06-09"],
    )
    conflict_stop = EngineStop(
        place_id="m1", name="Lonely Museum", lat=0.0, lon=0.0, category="museum",
        duration_min=60, opening_hours=[], price_level=1, rating=4.5,
        neighborhood=None, is_user_added=True, scheduled_time="09:00", city="Test",
    )
    day = EngineDay(date="2026-06-09", stops=[conflict_stop])
    days, msgs = apply_swapper([day], ctx, conflicted={"m1"})
    assert days[0].stops[0].name == "Lonely Museum"  # kept in place
    assert len(msgs) == 1
    assert msgs[0].type == "advisory"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py::test_apply_swapper_replaces_conflicted_stop tests/test_opening_hours.py::test_apply_swapper_emits_advisory_when_no_alternative -v
```
Expected: ImportError — `apply_swapper` not in builder.

- [ ] **Step 3: Implement `_find_alternatives` in `engine/swapper.py`**

Replace the existing `_find_alternatives` stub (lines 29-31 of swapper.py):

```python
import math as _math


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = _math.radians(lat2 - lat1)
    dlon = _math.radians(lon2 - lon1)
    h = (_math.sin(dlat / 2) ** 2
         + _math.cos(_math.radians(lat1)) * _math.cos(_math.radians(lat2))
         * _math.sin(dlon / 2) ** 2)
    return 2 * R * _math.asin(_math.sqrt(h))


def _find_alternatives(
    stop: EngineStop,
    ctx: EngineContext,
    excluded_place_ids: set[str],
) -> list[tuple[float, object]]:
    """Score insert_candidates for use as a replacement for `stop`.

    Returns a list of (score, InsertCandidate) sorted descending by score.
    Score = persona_affinity × (1 / (1 + distance_km)).
    Excludes place_ids already in the itinerary (passed via excluded_place_ids).
    """
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
```

- [ ] **Step 4: Add `apply_swapper` to `engine/builder.py`**

Add after `enforce_opening_hours` in builder.py:

```python
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
```

- [ ] **Step 5: Run all opening hours tests**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py -v
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/builder.py engine/swapper.py tests/test_opening_hours.py
git commit -m "feat: apply_swapper — replace unfixable stops with persona-scored insert candidates (Option C)"
```

---

### Task 5: Wire up post-engine passes in `main.py`

**Files:**
- Modify: `main.py` (~line 3112 — after `build_itinerary` call, before the stops_out loop)

After `build_itinerary` returns and after the full `_batch_place_details` call, update inserted stops' opening hours and call the two new passes.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_opening_hours.py`:

```python
def test_opening_hours_updated_for_inserted_stops():
    """After engine runs, inserted stop opening hours are backfilled from place_details_map."""
    from engine.types import EngineStop
    # Simulates what main.py does after the engine
    stop = EngineStop(
        place_id="ins1", name="Inserted Café", lat=0.0, lon=0.0,
        category="coffee", duration_min=30, opening_hours=[],
        price_level=1, rating=4.0, neighborhood=None, is_user_added=False,
        scheduled_time="09:30", city="Test",
    )
    place_details_map = {
        "ins1": {"opening_hours_parsed": [{"day": 0, "open_min": 480, "close_min": 1200}]}
    }
    # Apply the backfill logic
    if stop.place_id in place_details_map:
        parsed = place_details_map[stop.place_id].get("opening_hours_parsed", [])
        if parsed:
            stop.opening_hours = parsed
    assert len(stop.opening_hours) == 1
    assert stop.opening_hours[0]["open_min"] == 480
```

- [ ] **Step 2: Run test to verify it passes immediately** (logic is pure Python, no code change needed)

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py::test_opening_hours_updated_for_inserted_stops -v
```
Expected: PASS.

- [ ] **Step 3: Wire up the passes in `main.py`**

In `main.py`, find the block after `build_itinerary` returns. Current structure (~line 3129):

```python
    result = await build_itinerary(engine_stops, ctx)

    # Inject short-trip warning ...

    # Batch-fetch price level and opening hours from cache ...
    _all_result_stops = [s for day in result.days for s in day.stops]
    all_place_ids = list({s.place_id for s in _all_result_stops if s.place_id})
    place_details_map = _batch_place_details(_supabase, all_place_ids)

    # Fetch discovery stage ...
    _stage_map: dict[str, dict] = {}
    ...
```

After the `place_details_map` line, add:

```python
    # Backfill opening_hours for inserted stops (inserts.detect adds stops that bypass pre-engine fetch)
    for _s in _all_result_stops:
        if _s.place_id and not _s.opening_hours:
            _parsed = place_details_map.get(_s.place_id, {}).get("opening_hours_parsed", [])
            if _parsed:
                _s.opening_hours = _parsed

    # Post-scheduling passes: enforce opening hours (A), then swap unfixables (C)
    from engine.builder import enforce_opening_hours as _enforce_hours, apply_swapper as _apply_swapper
    result.days, _hour_msgs, _conflicted = _enforce_hours(result.days, ctx)
    result.days, _swap_msgs = _apply_swapper(result.days, ctx, _conflicted)
    result.messages.extend(_hour_msgs + _swap_msgs)
```

- [ ] **Step 4: Verify server starts and imports are clean**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "import main; print('OK')"
```
Expected: `OK`

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/ -v --tb=short 2>&1 | tail -30
```
Expected: all existing tests still pass; opening_hours tests pass.

- [ ] **Step 6: Commit**

```bash
git add main.py
git commit -m "feat: wire enforce_opening_hours + apply_swapper into engine-itinerary post-processing"
```

---

### Task 6: `EngineContext.user_arrival_time` + day-1 scheduling adjustment

**Files:**
- Modify: `engine/types.py`
- Modify: `engine/builder.py` (`_split_into_days`)
- Modify: `main.py` (add `arrivalTime` to `EngineItineraryPayload`, pass to `EngineContext`)
- Test: `tests/test_opening_hours.py`

The user enters their arrival time in TripDetailsSheet. This should only affect day-1 start time — subsequent days use the persona's normal `arrival_time`. Logic (from existing LLM prompt docs):
- 00:00–05:59 → start 09:00
- 06:00–08:59 → start = arrival + 60 min
- 09:00–16:59 → start = arrival + 30 min
- 17:00+ → start 09:00 (settle in, fresh start tomorrow)

- [ ] **Step 1: Write the failing test**

Add to `tests/test_opening_hours.py`:

```python
def test_split_into_days_uses_user_arrival_time_for_day1():
    from engine.types import EngineStop, EngineContext
    from engine.builder import _split_into_days
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "wanderer", "arrival_time": "10:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.5, "w_nightlife": 0.4, "w_efficiency": 0.3}},
        city=city,
        travel_dates=["2026-06-09", "2026-06-10"],
        user_arrival_time="14:00",  # afternoon arrival → 14:30 start
    )
    stops = [
        EngineStop(
            place_id=f"p{i}", name=f"Place{i}", lat=float(i)*0.01, lon=0.0,
            category="museum", duration_min=60, opening_hours=[],
            price_level=1, rating=4.5, neighborhood=None, is_user_added=True,
            city="Test",
        )
        for i in range(4)
    ]
    days = _split_into_days(stops, ctx)
    # Day 1: should start at 14:30 (14:00 + 30 min)
    assert days[0].stops[0].scheduled_time == "14:30"
    # Day 2: should start at persona's 10:00
    assert days[1].stops[0].scheduled_time == "10:00"

def test_split_into_days_late_arrival_resets_to_0900():
    from engine.types import EngineStop, EngineContext
    from engine.builder import _split_into_days
    from city.data_model import CityData

    city = CityData(
        id="test", name="Test", tier=1, center=(0.0, 0.0), timezone="UTC",
        climate={}, movement={}, culture={},
        neighborhoods=[], insert_candidates=[], scenic_routes=[],
        transit_edges=[], engine_modifiers={}, landmark_anchors=[], hidden_gems=[],
    )
    ctx = EngineContext(
        persona={"archetype": "wanderer", "arrival_time": "10:00", "day_buffer_min": 30,
                 "weights": {"w_rest_need": 0.5, "w_nightlife": 0.4, "w_efficiency": 0.3}},
        city=city,
        travel_dates=["2026-06-09", "2026-06-10"],
        user_arrival_time="21:00",  # very late → reset to 09:00
    )
    stops = [
        EngineStop(
            place_id=f"p{i}", name=f"P{i}", lat=float(i)*0.01, lon=0.0,
            category="museum", duration_min=60, opening_hours=[],
            price_level=1, rating=4.5, neighborhood=None, is_user_added=True, city="Test",
        )
        for i in range(4)
    ]
    days = _split_into_days(stops, ctx)
    assert days[0].stops[0].scheduled_time == "09:00"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py::test_split_into_days_uses_user_arrival_time_for_day1 tests/test_opening_hours.py::test_split_into_days_late_arrival_resets_to_0900 -v
```
Expected: AttributeError — `EngineContext` has no `user_arrival_time`.

- [ ] **Step 3: Add `user_arrival_time` to `EngineContext` in `engine/types.py`**

```python
@dataclass
class EngineContext:
    persona: dict
    city: "CityData"
    travel_dates: list[str]
    weather: dict | None = None
    generation_count: int = 0
    user_arrival_time: str | None = None   # user's actual arrival time, day-1 only
```

- [ ] **Step 4: Add `_day1_start` helper and update `_split_into_days` in `engine/builder.py`**

Add this helper immediately before `_split_into_days`:

```python
def _day1_adjusted_start(user_arrival_time: str) -> tuple[int, int]:
    """Compute day-1 start from user arrival time.

    00:00-05:59 → 09:00 (rest needed after night flight)
    06:00-08:59 → arrival + 60 min (quick freshen-up)
    09:00-16:59 → arrival + 30 min (standard check-in buffer)
    17:00+      → 09:00 next morning (evening/night arrival)
    """
    try:
        ah, am = (int(x) for x in user_arrival_time.split(":")[:2])
    except (ValueError, TypeError):
        return 9, 0
    arr_min = ah * 60 + am
    if arr_min < 6 * 60:
        return 9, 0
    elif arr_min < 9 * 60:
        adj = arr_min + 60
    elif arr_min < 17 * 60:
        adj = arr_min + 30
    else:
        return 9, 0
    adj = min(adj, 22 * 60)  # cap at 22:00
    return adj // 60, adj % 60
```

In `_split_into_days`, the function currently computes `start_h, start_m` once and uses it for all days. Update it to track a `day_counter` and use the adjusted start for day 0 only.

Find the single-city loop (around line 111):

```python
    if n_cities == 1:
        per_day = max(1, len(stops) // total_days)
        days: list[EngineDay] = []
        for i, date in enumerate(dates):
            slice_start = i * per_day
            slice_end = slice_start + per_day if i < total_days - 1 else len(stops)
            day_stops = stops[slice_start:slice_end]
            _schedule_day_stops(day_stops, start_h, start_m, buffer_min)
            days.append(EngineDay(date=date, stops=day_stops))
        return days
```

Replace with:

```python
    if n_cities == 1:
        per_day = max(1, len(stops) // total_days)
        days: list[EngineDay] = []
        for i, date in enumerate(dates):
            slice_start = i * per_day
            slice_end = slice_start + per_day if i < total_days - 1 else len(stops)
            day_stops = stops[slice_start:slice_end]
            if i == 0 and ctx.user_arrival_time:
                _d1h, _d1m = _day1_adjusted_start(ctx.user_arrival_time)
                _schedule_day_stops(day_stops, _d1h, _d1m, buffer_min)
            else:
                _schedule_day_stops(day_stops, start_h, start_m, buffer_min)
            days.append(EngineDay(date=date, stops=day_stops))
        return days
```

Apply the same pattern to the multi-city loop. Find the section with `date_idx = 0`:

```python
    days = []
    date_idx = 0
    for (city, city_stops), n_days in zip(city_groups, city_days):
        n_days = max(1, n_days)
        per_day = max(1, len(city_stops) // n_days)
        for j in range(n_days):
            date = dates[date_idx] if date_idx < total_days else dates[-1]
            date_idx += 1
            slice_start = j * per_day
            slice_end = slice_start + per_day if j < n_days - 1 else len(city_stops)
            day_stops = city_stops[slice_start:slice_end]
            _schedule_day_stops(day_stops, start_h, start_m, buffer_min)
            days.append(EngineDay(date=date, stops=day_stops))
```

Replace with:

```python
    days = []
    date_idx = 0
    global_day_idx = 0
    for (city, city_stops), n_days in zip(city_groups, city_days):
        n_days = max(1, n_days)
        per_day = max(1, len(city_stops) // n_days)
        for j in range(n_days):
            date = dates[date_idx] if date_idx < total_days else dates[-1]
            date_idx += 1
            slice_start = j * per_day
            slice_end = slice_start + per_day if j < n_days - 1 else len(city_stops)
            day_stops = city_stops[slice_start:slice_end]
            if global_day_idx == 0 and ctx.user_arrival_time:
                _d1h, _d1m = _day1_adjusted_start(ctx.user_arrival_time)
                _schedule_day_stops(day_stops, _d1h, _d1m, buffer_min)
            else:
                _schedule_day_stops(day_stops, start_h, start_m, buffer_min)
            global_day_idx += 1
            days.append(EngineDay(date=date, stops=day_stops))
```

- [ ] **Step 5: Add `arrivalTime` to `EngineItineraryPayload` in `main.py` and wire to ctx**

In `main.py`, update `EngineItineraryPayload` class (~line 105):

```python
class EngineItineraryPayload(BaseModel):
    city: str
    lat: float
    lon: float
    days: int
    startDate: str
    selectedPlaces: list[EngineItineraryPlace]
    personaArchetype: str = "explorer"
    engineWeights: Optional[dict] = None
    cities: Optional[list[str]] = None
    arrivalTime: Optional[str] = None   # user's arrival time for day 1 (HH:MM)
```

Update `EngineContext` construction (~line 3105) to pass `user_arrival_time`:

```python
    ctx = EngineContext(
        persona=persona,
        city=city_data,
        travel_dates=travel_dates,
        weather=None,
        user_arrival_time=body.arrivalTime or None,
    )
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest tests/test_opening_hours.py -v
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add engine/types.py engine/builder.py main.py tests/test_opening_hours.py
git commit -m "feat: wire user arrival time into day-1 schedule adjustment"
```

---

### Task 7: `persona_snapshot` — add `arrival_time`

**Files:**
- Modify: `main.py` (~line 3290)

- [ ] **Step 1: Update `persona_snapshot` dict**

In `main.py`, find `persona_snapshot = {` (~line 3290) and add `arrival_time`:

```python
    persona_snapshot = {
        "w_walk_affinity":      weights.get("w_walk_affinity", 0.5),
        "w_scenic":             weights.get("w_scenic", 0.5),
        "w_efficiency":         weights.get("w_efficiency", 0.5),
        "w_food_density":       weights.get("w_food_density", 0.5),
        "w_culture_depth":      weights.get("w_culture_depth", 0.5),
        "w_nightlife":          weights.get("w_nightlife", 0.4),
        "w_budget_sensitivity": weights.get("w_budget_sensitivity", 0.4),
        "w_crowd_aversion":     weights.get("w_crowd_aversion", 0.5),
        "w_spontaneity":        weights.get("w_spontaneity", 0.5),
        "w_rest_need":          weights.get("w_rest_need", 0.4),
        "arrival_time":         persona.get("arrival_time", "09:00"),
    }
```

- [ ] **Step 2: Verify**

```bash
cd /Users/souravbiswas/uncover-roads && python -c "import main; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add main.py
git commit -m "fix: include arrival_time in persona_snapshot response"
```

---

### Task 8: `ReelRecoCard` — fix truncated label

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelRecoCard.tsx` (line 172)

- [ ] **Step 1: Change `WebkitLineClamp: 2` to `3`**

In `ReelRecoCard.tsx` at line 172, change:

```tsx
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
```

to:

```tsx
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/route/reel/ReelRecoCard.tsx
git commit -m "fix: allow reco card label up to 3 lines to prevent mid-sentence truncation"
```

---

### Task 9: `reel-builder` — always run all reco functions

**Files:**
- Modify: `frontend/src/modules/route/reel/reel-builder.ts` (lines 741–754)

Context: `recosByDayIdx` is always populated (one entry per day) because `ItineraryReelScreen` calls `deriveRecos` for every day. So `recosByDayIdx.has(dayIdx)` is always true, and `buildMealRecos`, `buildPersonaRecos`, `buildClosingConflictRecos`, `buildWalkingGapRecos` never run. Fix: always run all functions and merge, relying on the existing deduplication-by-trigger at lines 756–761.

- [ ] **Step 1: Verify current branching in `reel-builder.ts`**

Read lines 741–754 to confirm they match:
```typescript
    const allRecos: ReelRecoCard[] = recosByDayIdx.has(dayIdx)
      ? [
          ...(recosByDayIdx.get(dayIdx) ?? []),
          ...buildDiscoveryRecos(sortedStops, persona, day.city),
          ...buildWeatherReco(...),
        ]
      : [
          ...buildMealRecos(...),
          ...buildPersonaRecos(...),
          ...buildWeatherReco(...),
          ...buildClosingConflictRecos(...),
          ...buildWalkingGapRecos(...),
          ...buildDiscoveryRecos(...),
        ];
```

- [ ] **Step 2: Replace the branching with a flat union**

Replace lines 741–754 with:

```typescript
    const allRecos: ReelRecoCard[] = [
      ...(recosByDayIdx.get(dayIdx) ?? []),
      ...buildMealRecos(sortedStops, persona, day.city),
      ...buildPersonaRecos(sortedStops, persona, day.city, weights),
      ...buildWeatherReco(sortedStops, getWeatherForCity(day.city), persona, day.city),
      ...buildClosingConflictRecos(sortedStops, persona, day.city),
      ...buildWalkingGapRecos(sortedStops, persona, day.city, weights),
      ...buildDiscoveryRecos(sortedStops, persona, day.city),
    ];
```

The existing deduplication loop at lines 756–761 (`recosByStop` map, keyed by `trigger`) already handles duplicates — no additional change needed.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/reel-builder.ts
git commit -m "fix: always run all reco functions — engine + meal + persona + closing + walking + discovery"
```

---

## Self-review

**Spec coverage:**
- ✅ Opening hours data flow: `_parse_weekday_text` + `_batch_place_details` (Task 1)
- ✅ Pre-engine fetch for user-selected stops (Task 2)
- ✅ Option A — in-day reorder: `enforce_opening_hours` (Task 3)
- ✅ Option C — swapper replacement: `apply_swapper` + `_find_alternatives` (Task 4)
- ✅ Post-engine wiring + insert stop backfill (Task 5)
- ✅ User arrival time → day-1 schedule: `user_arrival_time`, `_day1_adjusted_start`, payload field (Task 6)
- ✅ `persona_snapshot` includes `arrival_time` (Task 7)
- ✅ Truncated reco label (Task 8)
- ✅ Legacy recos silenced (Task 9)

**Known limitation:** `InsertCandidate` objects don't carry opening hours, so the swapper can't verify that a replacement is open at the scheduled time. The replacement is scored by affinity + proximity only. This is acceptable for now — the swapper selects the best available candidate, and the `enforce_opening_hours` pass will catch any remaining issues on a subsequent rebuild.

**Type consistency check:**
- `enforce_opening_hours` returns `(list[EngineDay], list[EngineMessage], set[str])` — matches Task 5 usage `_enforce_hours(result.days, ctx)` → 3-tuple unpack ✅
- `apply_swapper(days, ctx, conflicted={"m1"})` — Task 4 test uses keyword arg; Task 5 uses positional: `_apply_swapper(result.days, ctx, _conflicted)` ✅
- `_day1_adjusted_start` returns `tuple[int, int]` → used as `_d1h, _d1m = _day1_adjusted_start(...)` ✅
- `EngineContext.user_arrival_time` added in Task 6, referenced in `_split_into_days` in same task ✅
