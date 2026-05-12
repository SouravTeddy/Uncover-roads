# Logic Engine Backend Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `ip_engine.py` with 5 new city attributes (41 cities), new archetype signals for 4 new OB dimensions, conflict checks K–Q, and a `run_multi_city_check()` function with 8 sequence checks, plus a `/persona/multi-city` endpoint.

**Architecture:** All logic lives in `ip_engine.py` as pure functions. The existing `run_conflict_check()` is extended to accept the new `PersonaProfile` fields. A new `run_multi_city_check()` function runs per-city checks for each city then sequence-level checks across the trip. `main.py` gets one new endpoint that calls it.

**Tech Stack:** Python 3.14, FastAPI, pytest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `ip_engine.py` | Modify | Add city attributes, archetype signals, conflict checks K–Q, `run_multi_city_check()` |
| `main.py` | Modify | Add `POST /persona/multi-city` endpoint |
| `requirements.txt` | Modify | Add `pytest` |
| `tests/test_logic_engine.py` | Create | All unit tests for new logic |

---

### Task 1: Add pytest and create test skeleton

**Files:**
- Modify: `requirements.txt`
- Create: `tests/__init__.py`
- Create: `tests/test_logic_engine.py`

- [ ] **Step 1: Add pytest to requirements.txt**

```
fastapi
uvicorn
requests
anthropic
python-dotenv
supabase
pytest
```

- [ ] **Step 2: Create tests/__init__.py**

```python
```
(empty file)

- [ ] **Step 3: Create tests/test_logic_engine.py with skeleton**

```python
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from ip_engine import (
    CITY_PROFILES,
    score_archetype,
    run_conflict_check,
    run_multi_city_check,
    get_city_profile,
)


# ── Fixtures ──────────────────────────────────────────────────

def solo_explorer():
    return {
        "group": "solo", "mood": ["explore"], "pace": "balanced",
        "day_open": "coffee", "dietary": [], "price_min": 1, "price_max": 3,
        "evening_type": "dinner", "social_flags": ["solo"],
        "archetype": "wanderer",
    }

def family_profile():
    return {
        "group": "family", "mood": ["explore"], "pace": "balanced",
        "day_open": "breakfast", "dietary": [], "price_min": 1, "price_max": 3,
        "evening_type": "early", "social_flags": ["family", "kids"],
        "archetype": "explorer",
    }

def halal_profile():
    return {
        "group": "solo", "mood": ["explore"], "pace": "balanced",
        "day_open": "coffee", "dietary": ["halal_certified_only"],
        "price_min": 1, "price_max": 3,
        "evening_type": "markets", "social_flags": ["solo"],
        "archetype": "wanderer",
    }

def budget_profile():
    return {
        "group": "solo", "mood": ["explore"], "pace": "pack",
        "day_open": "grab_go", "dietary": [],
        "price_min": 1, "price_max": 1,
        "evening_type": "markets", "social_flags": ["solo"],
        "archetype": "wanderer",
    }
```

- [ ] **Step 4: Run tests to verify skeleton imports correctly**

```bash
cd /Users/souravbiswas/uncover-roads && python3 -m pytest tests/test_logic_engine.py -v
```

Expected: `ERROR` — `run_multi_city_check` not yet exported from `ip_engine.py`. That's expected at this stage.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt tests/ && git commit -m "test: add pytest and logic engine test skeleton"
```

---

### Task 2: Add 5 new attributes to all 41 city profiles

**Files:**
- Modify: `ip_engine.py` (CITY_PROFILES, lines 135–557)

New attributes per city:
- `halal_supply`: int 0–3 (0=none, 1=few certified, 2=moderate, 3=widely available)
- `kosher_supply`: int 0–3
- `veg_supply`: int 0–3 (plant-based / vegetarian availability)
- `family_friendly`: int 0–3 (kid venues, playgrounds, family restaurants)
- `visa_complexity`: int 0–2 (0=visa-free, 1=on-arrival, 2=advance-required)

Also add `"breakfast_late": True` to `meal_times` for cities where breakfast culture starts after 09:30: Barcelona, Rome, Milan, Lisbon, Mexico City, Istanbul, Cairo, Marrakech, Athens.

- [ ] **Step 1: Write failing test for new city attributes**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 2: City new attributes ───────────────────────────────

def test_all_cities_have_new_attributes():
    required = {"halal_supply", "kosher_supply", "veg_supply", "family_friendly", "visa_complexity"}
    for city_key, profile in CITY_PROFILES.items():
        missing = required - set(profile.keys())
        assert not missing, f"{city_key} missing: {missing}"

def test_new_attribute_ranges():
    for city_key, profile in CITY_PROFILES.items():
        assert 0 <= profile["halal_supply"] <= 3, city_key
        assert 0 <= profile["kosher_supply"] <= 3, city_key
        assert 0 <= profile["veg_supply"] <= 3, city_key
        assert 0 <= profile["family_friendly"] <= 3, city_key
        assert 0 <= profile["visa_complexity"] <= 2, city_key

def test_late_breakfast_cities():
    late = ["barcelona", "rome", "milan", "lisbon", "mexico city", "istanbul", "cairo", "marrakech", "athens"]
    for city in late:
        profile = CITY_PROFILES[city]
        assert profile["meal_times"].get("breakfast_late") is True, f"{city} missing breakfast_late"

def test_tokyo_new_attributes():
    p = CITY_PROFILES["tokyo"]
    assert p["halal_supply"] == 1
    assert p["kosher_supply"] == 0
    assert p["veg_supply"] == 1
    assert p["family_friendly"] == 2
    assert p["visa_complexity"] == 0

def test_london_new_attributes():
    p = CITY_PROFILES["london"]
    assert p["halal_supply"] == 3
    assert p["kosher_supply"] == 3
    assert p["veg_supply"] == 3
    assert p["family_friendly"] == 3
    assert p["visa_complexity"] == 0
```

- [ ] **Step 2: Run to confirm failure**

```bash
python3 -m pytest tests/test_logic_engine.py::test_all_cities_have_new_attributes -v
```

Expected: FAIL — KeyError on `halal_supply`

- [ ] **Step 3: Add the 5 new attributes to every city in CITY_PROFILES**

For each city, add these 5 keys at the end of its dict. Complete values for all 41 cities:

```python
# In ip_engine.py — add to each city dict:
"abu dhabi":     {..., "halal_supply": 3, "kosher_supply": 1, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 1},
"amsterdam":     {..., "halal_supply": 2, "kosher_supply": 2, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 0},
"athens":        {..., "halal_supply": 2, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0,
                       "meal_times": {"lunch":"14:00","dinner":"21:30","breakfast_late":True}},
"bali":          {..., "halal_supply": 2, "kosher_supply": 0, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 1},
"bangkok":       {..., "halal_supply": 2, "kosher_supply": 0, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 1},
"barcelona":     {..., "halal_supply": 2, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0,
                       "meal_times": {"lunch":"14:00","dinner":"21:30","breakfast_late":True}},
"bengaluru":     {..., "halal_supply": 2, "kosher_supply": 0, "veg_supply": 3, "family_friendly": 2, "visa_complexity": 2},
"berlin":        {..., "halal_supply": 3, "kosher_supply": 2, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 0},
"cairo":         {..., "halal_supply": 3, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 1,
                       "meal_times": {"lunch":"14:00","dinner":"21:00","breakfast_late":True}},
"cape town":     {..., "halal_supply": 2, "kosher_supply": 2, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
"colombo":       {..., "halal_supply": 2, "kosher_supply": 0, "veg_supply": 2, "family_friendly": 2, "visa_complexity": 1},
"delhi":         {..., "halal_supply": 3, "kosher_supply": 1, "veg_supply": 3, "family_friendly": 2, "visa_complexity": 2},
"dubai":         {..., "halal_supply": 3, "kosher_supply": 1, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 1},
"goa":           {..., "halal_supply": 2, "kosher_supply": 0, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 2},
"hanoi":         {..., "halal_supply": 1, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 1},
"hong kong":     {..., "halal_supply": 2, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
"istanbul":      {..., "halal_supply": 3, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 2, "visa_complexity": 1,
                       "meal_times": {"lunch":"13:00","dinner":"21:00","breakfast_late":True}},
"kathmandu":     {..., "halal_supply": 1, "kosher_supply": 0, "veg_supply": 2, "family_friendly": 2, "visa_complexity": 1},
"kuala lumpur":  {..., "halal_supply": 3, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
"kyoto":         {..., "halal_supply": 1, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 0},
"lisbon":        {..., "halal_supply": 1, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0,
                       "meal_times": {"lunch":"13:30","dinner":"21:00","breakfast_late":True}},
"london":        {..., "halal_supply": 3, "kosher_supply": 3, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 0},
"los angeles":   {..., "halal_supply": 2, "kosher_supply": 3, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 2},
"marrakech":     {..., "halal_supply": 3, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 1,
                       "meal_times": {"lunch":"13:00","dinner":"21:00","breakfast_late":True}},
"mexico city":   {..., "halal_supply": 1, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 2, "visa_complexity": 0,
                       "meal_times": {"lunch":"14:00","dinner":"21:00","breakfast_late":True}},
"milan":         {..., "halal_supply": 2, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 2, "visa_complexity": 0,
                       "meal_times": {"lunch":"13:00","dinner":"20:30","breakfast_late":True}},
"mumbai":        {..., "halal_supply": 3, "kosher_supply": 1, "veg_supply": 3, "family_friendly": 2, "visa_complexity": 2},
"nairobi":       {..., "halal_supply": 2, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 1},
"new york":      {..., "halal_supply": 3, "kosher_supply": 3, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 2},
"osaka":         {..., "halal_supply": 1, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 3, "visa_complexity": 0},
"paris":         {..., "halal_supply": 2, "kosher_supply": 2, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
"prague":        {..., "halal_supply": 1, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
"rio de janeiro":{..., "halal_supply": 1, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 2, "visa_complexity": 0},
"rome":          {..., "halal_supply": 2, "kosher_supply": 2, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0,
                       "meal_times": {"lunch":"13:30","dinner":"21:00","breakfast_late":True}},
"seoul":         {..., "halal_supply": 1, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 3, "visa_complexity": 0},
"singapore":     {..., "halal_supply": 3, "kosher_supply": 1, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
"sydney":        {..., "halal_supply": 2, "kosher_supply": 2, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 2},
"taipei":        {..., "halal_supply": 1, "kosher_supply": 0, "veg_supply": 3, "family_friendly": 3, "visa_complexity": 0},
"tokyo":         {..., "halal_supply": 1, "kosher_supply": 0, "veg_supply": 1, "family_friendly": 2, "visa_complexity": 0},
"vienna":        {..., "halal_supply": 2, "kosher_supply": 2, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
"zurich":        {..., "halal_supply": 2, "kosher_supply": 2, "veg_supply": 2, "family_friendly": 3, "visa_complexity": 0},
```

Note: for cities with `breakfast_late`, update the `meal_times` dict inline (don't duplicate it — merge the key in). The `{...}` notation above means keep all existing keys and add the 5 new ones.

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_logic_engine.py -k "city" -v
```

Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add ip_engine.py tests/test_logic_engine.py && git commit -m "feat: add 5 new attributes to all 41 city profiles"
```

---

### Task 3: Extend ARCHETYPE_SIGNALS with 4 new OB dimensions

**Files:**
- Modify: `ip_engine.py` (ARCHETYPE_SIGNALS dict, after line ~105)

- [ ] **Step 1: Write failing test**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 3: New archetype signals ─────────────────────────────

def test_archetype_signals_group_solo_boosts_slowtraveller():
    scores = score_archetype({"group": "solo", "mood": [], "day_open": None,
                               "budget": None, "evening": None})
    assert scores.get("slowtraveller", 0) > 0 or scores.get("wanderer", 0) > 0

def test_archetype_signals_evening_bars_boosts_pulse():
    scores = score_archetype({"group": None, "mood": [], "day_open": None,
                               "budget": None, "evening": "bars"})
    assert scores.get("pulse", 0) >= 2

def test_archetype_signals_luxury_boosts_voyager():
    scores = score_archetype({"group": None, "mood": [], "day_open": None,
                               "budget": "luxury", "evening": None})
    assert scores.get("voyager", 0) >= 2

def test_archetype_signals_breakfast_boosts_epicurean():
    scores = score_archetype({"group": None, "mood": [], "day_open": "breakfast",
                               "budget": None, "evening": None})
    assert scores.get("epicurean", 0) >= 2

def test_archetype_signals_family_boosts_explorer():
    scores = score_archetype({"group": "family", "mood": [], "day_open": None,
                               "budget": None, "evening": None})
    assert scores.get("explorer", 0) >= 2
```

- [ ] **Step 2: Run to confirm failure**

```bash
python3 -m pytest tests/test_logic_engine.py -k "archetype_signals" -v
```

Expected: FAIL — signals not present yet

- [ ] **Step 3: Add new entries to ARCHETYPE_SIGNALS in ip_engine.py**

In `ip_engine.py`, after the existing `ARCHETYPE_SIGNALS` keys (`ritual`, `sensory`, `pace`, `style`, `attractions`), add:

```python
    # group → archetype weight
    "group": {
        "solo":    {"slowtraveller": 1, "wanderer": 1},
        "couple":  {"voyager": 1, "epicurean": 1},
        "family":  {"explorer": 2},
        "friends": {"pulse": 2},
    },
    # day_open → archetype weight
    "day_open": {
        "coffee":    {"voyager": 1, "slowtraveller": 1},
        "breakfast": {"epicurean": 2},
        "straight":  {"explorer": 1, "historian": 1},
        "grab_go":   {"wanderer": 1, "explorer": 1},
    },
    # budget → archetype weight
    "budget": {
        "budget":      {"wanderer": 1, "explorer": 1},
        "mid_range":   {},
        "comfortable": {"voyager": 1, "epicurean": 1},
        "luxury":      {"voyager": 2, "epicurean": 2},
    },
    # evening → archetype weight
    "evening": {
        "bars":        {"pulse": 2},
        "dinner_wind": {"epicurean": 1, "voyager": 1},
        "markets":     {"wanderer": 2},
        "early":       {"slowtraveller": 1, "historian": 1},
    },
    # mood → archetype weight (multi-select handled in score_archetype)
    "mood": {
        "explore":   {"wanderer": 2, "explorer": 1},
        "relax":     {"slowtraveller": 2},
        "eat_drink": {"epicurean": 3},
        "culture":   {"historian": 3, "voyager": 1},
    },
```

- [ ] **Step 4: Extend `score_archetype()` to handle new fields**

Replace the current `score_archetype` function body with:

```python
def score_archetype(ob_answers: dict) -> dict:
    """
    Takes OB answers dict and returns {archetype: score} sorted desc.
    Accepts both old format (ritual/sensory/pace/style/attractions/social)
    and new format (group/mood/day_open/budget/evening + old fields).
    mood and attractions are lists (multi-select).
    """
    scores = {k: 0 for k in ARCHETYPES}

    for field, signals in ARCHETYPE_SIGNALS.items():
        val = ob_answers.get(field)
        if not val:
            continue
        # Multi-select fields
        if field in ("attractions", "mood"):
            for item in (val if isinstance(val, list) else [val]):
                for arch, w in signals.get(str(item), {}).items():
                    scores[arch] = scores.get(arch, 0) + w
        else:
            for arch, w in signals.get(str(val), {}).items():
                scores[arch] = scores.get(arch, 0) + w

    return dict(sorted(scores.items(), key=lambda x: -x[1]))
```

- [ ] **Step 5: Run tests**

```bash
python3 -m pytest tests/test_logic_engine.py -k "archetype_signals" -v
```

Expected: 5 PASS

- [ ] **Step 6: Commit**

```bash
git add ip_engine.py tests/test_logic_engine.py && git commit -m "feat: extend archetype signals with group, day_open, budget, evening, mood dimensions"
```

---

### Task 4: Add conflict checks K and L (dietary, family)

**Files:**
- Modify: `ip_engine.py` (`run_conflict_check`, after existing check J)

- [ ] **Step 1: Write failing tests**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 4: Conflict checks K and L ──────────────────────────

def test_check_K_halal_scarce_city():
    result = run_conflict_check("tokyo", halal_profile())
    messages = [c["message"] for c in result["conflicts"]]
    assert any("halal" in m.lower() for m in messages)
    severities = [c["severity"] for c in result["conflicts"]]
    assert "high" in severities

def test_check_K_halal_abundant_city_no_conflict():
    result = run_conflict_check("kuala lumpur", halal_profile())
    halal_conflicts = [c for c in result["conflicts"]
                       if "halal" in c["message"].lower()]
    assert len(halal_conflicts) == 0

def test_check_K_veg_scarce():
    p = {**solo_explorer(), "dietary": ["vegan_boost"]}
    result = run_conflict_check("tokyo", p)
    messages = [c["message"] for c in result["conflicts"]]
    assert any("plant" in m.lower() or "vegetarian" in m.lower() or "veg" in m.lower()
               for m in messages)

def test_check_L_family_bars_nightlife_city():
    p = {**family_profile(), "evening_type": "bars"}
    result = run_conflict_check("amsterdam", p)
    messages = [c["message"] for c in result["conflicts"]]
    assert any("family" in m.lower() or "evening" in m.lower() for m in messages)

def test_check_L_family_low_family_friendly():
    result = run_conflict_check("hanoi", family_profile())
    # hanoi family_friendly=2, should produce LOW
    instructions = [c["instruction"] for c in result["conflicts"]]
    assert any("buffer" in i.lower() or "family" in i.lower() for i in instructions)
```

- [ ] **Step 2: Run to confirm failure**

```bash
python3 -m pytest tests/test_logic_engine.py -k "check_K or check_L" -v
```

Expected: FAIL

- [ ] **Step 3: Add checks K and L to `run_conflict_check()` in ip_engine.py**

Inside `run_conflict_check`, add these after the existing check J block. Also update the function to read new persona fields:

```python
    # Read new PersonaProfile fields (with old-format fallback)
    group        = persona.get("group") or persona.get("social", "")
    dietary      = persona.get("dietary", [])
    evening_type = persona.get("evening_type", "")
    price_max    = persona.get("price_max", 4)

    # ── CATEGORY K: Dietary × city supply ──
    if "halal_certified_only" in dietary:
        halal = city_profile.get("halal_supply", 2)
        if halal == 0:
            conflicts.append({
                "severity": "high",
                "message": f"Halal dining is unavailable in {city}. Certified restaurants cannot be sourced.",
                "instruction": "Remove all restaurant stops. Add self-catering note."
            })
        elif halal == 1:
            conflicts.append({
                "severity": "high",
                "message": f"Halal options are very limited in {city}. Only a handful of certified spots.",
                "instruction": "Restrict restaurant stops to certified halal list only. Flag all others."
            })

    if "kosher_certified_only" in dietary:
        kosher = city_profile.get("kosher_supply", 1)
        if kosher == 0:
            conflicts.append({
                "severity": "high",
                "message": f"Kosher dining is unavailable in {city}.",
                "instruction": "Add self-catering note. Remove restaurant stops."
            })
        elif kosher == 1:
            conflicts.append({
                "severity": "medium",
                "message": f"Kosher options are very limited in {city}.",
                "instruction": "Restrict to known certified spots only."
            })

    if "vegan_boost" in dietary:
        veg = city_profile.get("veg_supply", 2)
        if veg <= 1:
            conflicts.append({
                "severity": "low",
                "message": f"Plant-based options are scarce in {city}.",
                "instruction": "Flag meat-heavy restaurants. Surface available vegetarian spots."
            })

    # ── CATEGORY L: Family × city ──
    if "family" in group or "kids" in persona.get("social_flags", []):
        if evening_type == "bars" and city_profile.get("nightlife", 2) >= 2:
            conflicts.append({
                "severity": "medium",
                "message": f"Bar-led evenings aren't suited for families in {city}.",
                "instruction": "Replace evening block with family night market or early dinner."
            })
        if city_profile.get("family_friendly", 2) <= 1:
            conflicts.append({
                "severity": "low",
                "message": f"Family-specific venues are limited in {city}.",
                "instruction": "Add 15 min buffer between stops. Prioritise parks and open spaces."
            })
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_logic_engine.py -k "check_K or check_L" -v
```

Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add ip_engine.py tests/test_logic_engine.py && git commit -m "feat: add conflict checks K (dietary) and L (family) to run_conflict_check"
```

---

### Task 5: Add conflict checks M, N, O (budget, group supply, terrain)

**Files:**
- Modify: `ip_engine.py` (`run_conflict_check`, after check L)

- [ ] **Step 1: Write failing tests**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 5: Conflict checks M, N, O ──────────────────────────

def test_check_M_budget_expensive_city_high():
    result = run_conflict_check("zurich", budget_profile())
    messages = [c["message"] for c in result["conflicts"]]
    severities = [c["severity"] for c in result["conflicts"]]
    assert any("budget" in m.lower() or "expensive" in m.lower() or "cost" in m.lower()
               for m in messages)
    assert "high" in severities

def test_check_M_budget_moderate_city_medium():
    result = run_conflict_check("tokyo", budget_profile())  # cost_tier=3
    messages = [c["message"] for c in result["conflicts"]]
    assert any("budget" in m.lower() or "free" in m.lower() or "cost" in m.lower()
               for m in messages)

def test_check_M_mid_range_expensive_city_low():
    p = {**solo_explorer(), "price_max": 2}  # mid-range in expensive city
    result = run_conflict_check("zurich", p)
    instructions = [c["instruction"] for c in result["conflicts"]]
    assert any("highlight" in i.lower() or "paid" in i.lower() for i in instructions)

def test_check_N_group_tourist_only_city():
    p = {**solo_explorer(), "group": "friends",
         "social_flags": ["group"], "evening_type": "bars"}
    result = run_conflict_check("marrakech", p)  # tourist_only=True, nightlife=1
    instructions = [c["instruction"] for c in result["conflicts"]]
    assert any("communal" in i.lower() or "dining" in i.lower() for i in instructions)

def test_check_O_family_hilly_pack():
    p = {**family_profile(), "pace": "pack", "stops_per_day": 7.0}
    result = run_conflict_check("kathmandu", p)  # terrain_hilly=True
    messages = [c["message"] for c in result["conflicts"]]
    assert any("hilly" in m.lower() or "terrain" in m.lower() for m in messages)
```

- [ ] **Step 2: Run to confirm failure**

```bash
python3 -m pytest tests/test_logic_engine.py -k "check_M or check_N or check_O" -v
```

Expected: FAIL

- [ ] **Step 3: Add checks M, N, O to `run_conflict_check()` in ip_engine.py**

```python
    # ── CATEGORY M: Budget × city cost ──
    cost_tier = city_profile.get("cost_tier", 2)
    if price_max == 1 and cost_tier == 4:
        conflicts.append({
            "severity": "high",
            "message": f"{city} is expensive and your budget is tight. Most paid venues will be out of range.",
            "instruction": "Restrict to free attractions + street food only. Flag all paid entry venues."
        })
    elif price_max == 1 and cost_tier == 3:
        conflicts.append({
            "severity": "medium",
            "message": f"Your budget may feel stretched in {city}.",
            "instruction": "Flag all paid attractions. Prioritise free alternatives first."
        })
    elif price_max == 2 and cost_tier == 4:
        conflicts.append({
            "severity": "low",
            "message": f"{city} skews expensive — one paid highlight per day is the sweet spot for your budget.",
            "instruction": "Allow one paid highlight per day maximum. Surface free alternatives for the rest."
        })

    # ── CATEGORY N: Group supply ──
    if ("group" in group or "friends" in persona.get("social_flags", [])):
        if city_profile.get("tourist_only", False) and city_profile.get("nightlife", 2) <= 1:
            conflicts.append({
                "severity": "medium",
                "message": f"Group-friendly social venues are limited in {city}.",
                "instruction": "Prioritise communal dining, food markets, and riad-style experiences over bars."
            })

    # ── CATEGORY O: Terrain × group ──
    if city_profile.get("terrain_hilly", False):
        stops = persona.get("stops_per_day", 4)
        is_family = "family" in group or "kids" in persona.get("social_flags", [])
        if is_family and stops > 5:
            conflicts.append({
                "severity": "medium",
                "message": f"Hilly terrain in {city} is tiring with kids at this pace.",
                "instruction": "Cap at 5 stops per day. Add +15 min per stop for terrain. Avoid hills after 15:00."
            })
        elif is_family:
            conflicts.append({
                "severity": "low",
                "message": f"{city} has hilly terrain — good to know with kids.",
                "instruction": "Add +15 min buffer per stop. Prefer flatter neighbourhood routes."
            })
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_logic_engine.py -k "check_M or check_N or check_O" -v
```

Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add ip_engine.py tests/test_logic_engine.py && git commit -m "feat: add conflict checks M (budget), N (group supply), O (terrain)"
```

---

### Task 6: Add conflict checks P and Q (meal times, alcohol × evening)

**Files:**
- Modify: `ip_engine.py` (`run_conflict_check`, after check O)

- [ ] **Step 1: Write failing tests**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 6: Conflict checks P and Q ──────────────────────────

def test_check_P_early_dinner_late_city():
    p = {**solo_explorer(), "evening_type": "early", "day_open": "coffee"}
    result = run_conflict_check("barcelona", p)
    messages = [c["message"] for c in result["conflicts"]]
    assert any("dinner" in m.lower() or "restaurant" in m.lower() or "open" in m.lower()
               for m in messages)

def test_check_P_breakfast_late_city():
    p = {**solo_explorer(), "day_open": "breakfast"}
    result = run_conflict_check("rome", p)
    instructions = [c["instruction"] for c in result["conflicts"]]
    assert any("late" in i.lower() or "shift" in i.lower() or "hour" in i.lower()
               for i in instructions)

def test_check_P_no_conflict_normal_city():
    p = {**solo_explorer(), "evening_type": "early", "day_open": "breakfast"}
    result = run_conflict_check("tokyo", p)
    meal_conflicts = [c for c in result["conflicts"]
                      if "dinner" in c.get("message","").lower()
                      or "breakfast" in c.get("message","").lower()]
    assert len(meal_conflicts) == 0

def test_check_Q_bars_dry_city():
    p = {**solo_explorer(), "evening_type": "bars"}
    result = run_conflict_check("cairo", p)  # alcohol=False
    messages = [c["message"] for c in result["conflicts"]]
    severities = [c["severity"] for c in result["conflicts"]]
    assert any("bar" in m.lower() or "alcohol" in m.lower() or "licensed" in m.lower()
               for m in messages)
    assert "high" in severities
```

- [ ] **Step 2: Run to confirm failure**

```bash
python3 -m pytest tests/test_logic_engine.py -k "check_P or check_Q" -v
```

Expected: FAIL

- [ ] **Step 3: Add checks P and Q to `run_conflict_check()` in ip_engine.py**

```python
    # ── CATEGORY P: Meal time mismatch ──
    day_open     = persona.get("day_open", "")
    meal_times   = city_profile.get("meal_times", {})
    dinner_time  = meal_times.get("dinner", "19:00")
    breakfast_late = meal_times.get("breakfast_late", False)

    if day_open == "breakfast" and breakfast_late:
        conflicts.append({
            "severity": "low",
            "message": f"Sit-down breakfast culture in {city} starts late — most spots won't open before 09:30.",
            "instruction": "Shift day-open block +1 hour. First attraction pushed to 11:00."
        })

    if evening_type == "early" and dinner_time > "21:00":
        conflicts.append({
            "severity": "medium",
            "message": f"Restaurants in {city} don't open for dinner until {dinner_time} — your early evening may feel empty.",
            "instruction": "Shift evening block start to 19:30 local. Fill pre-dinner slot with evening stroll or market."
        })

    # ── CATEGORY Q: Alcohol × evening ──
    if evening_type == "bars" and not city_profile.get("alcohol", True):
        conflicts.append({
            "severity": "high",
            "message": f"No licensed bars or nightlife venues in {city}.",
            "instruction": "Replace evening block with night souk, tea culture, or rooftop café."
        })
```

- [ ] **Step 4: Run all conflict check tests**

```bash
python3 -m pytest tests/test_logic_engine.py -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add ip_engine.py tests/test_logic_engine.py && git commit -m "feat: add conflict checks P (meal times) and Q (alcohol x evening)"
```

---

### Task 7: Add run_multi_city_check() with per-city and sequence checks

**Files:**
- Modify: `ip_engine.py` (add after `run_conflict_check`)

- [ ] **Step 1: Write failing tests**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 7: run_multi_city_check ──────────────────────────────

def make_trip(cities, nights, start="2026-06-01"):
    return {"cities": cities, "nights_per_city": nights, "start_date": start}

def test_multi_city_returns_per_city_conflicts():
    trip = make_trip(["tokyo", "kyoto"], [3, 2])
    result = run_multi_city_check(trip, halal_profile())
    assert "tokyo" in result["per_city"]
    assert "kyoto" in result["per_city"]
    assert result["per_city"]["tokyo"]["has_conflicts"] is True

def test_seq1_walkability_drop():
    trip = make_trip(["amsterdam", "dubai"], [3, 3])
    p = {**solo_explorer(), "stops_per_day": 2.5, "flexibility": 0.9}
    result = run_multi_city_check(trip, p)
    seq_messages = [c["message"] for c in result["sequence_conflicts"]]
    assert any("walkab" in m.lower() or "car" in m.lower() for m in seq_messages)

def test_seq2_cumulative_cost_high():
    trip = make_trip(["zurich", "london", "new york"], [3, 3, 3])
    result = run_multi_city_check(trip, budget_profile())
    seq_severities = [c["severity"] for c in result["sequence_conflicts"]]
    assert "high" in seq_severities

def test_seq4_ramadan_continuity():
    trip = make_trip(["dubai", "marrakech"], [3, 3], start="2026-03-15")
    result = run_multi_city_check(trip, solo_explorer())
    seq_messages = [c["message"] for c in result["sequence_conflicts"]]
    assert any("ramadan" in m.lower() for m in seq_messages)

def test_seq5_pace_sustainability():
    trip = make_trip(["tokyo", "kyoto", "osaka", "seoul", "bangkok"], [2,2,2,2,2])
    p = {**solo_explorer(), "stops_per_day": 7.0}
    result = run_multi_city_check(trip, p)
    seq_messages = [c["message"] for c in result["sequence_conflicts"]]
    assert any("stop" in m.lower() or "rest" in m.lower() or "pace" in m.lower()
               for m in seq_messages)

def test_seq7_museum_fatigue():
    trip = make_trip(["rome", "paris", "athens"], [3, 3, 3])
    p = {**solo_explorer(), "mood": ["culture"]}
    result = run_multi_city_check(trip, p)
    seq_messages = [c["message"] for c in result["sequence_conflicts"]]
    assert any("culture" in m.lower() or "museum" in m.lower() or "back to back" in m.lower()
               for m in seq_messages)

def test_seq8_dietary_continuity_halal():
    trip = make_trip(["tokyo", "kyoto", "osaka"], [2, 2, 2])
    result = run_multi_city_check(trip, halal_profile())
    seq_messages = [c["message"] for c in result["sequence_conflicts"]]
    assert any("halal" in m.lower() and "stock" in m.lower() for m in seq_messages)
```

- [ ] **Step 2: Run to confirm failure**

```bash
python3 -m pytest tests/test_logic_engine.py -k "multi_city or seq" -v
```

Expected: FAIL — `run_multi_city_check` not defined yet

- [ ] **Step 3: Add `run_multi_city_check()` to ip_engine.py**

Add after `run_conflict_check`:

```python
# ══════════════════════════════════════════════════════════════
# MULTI-CITY CONFLICT CHECK
# ══════════════════════════════════════════════════════════════

def _travel_month(start_date: str, days_offset: int) -> int:
    """Return month number for a date offset from start_date."""
    import datetime
    try:
        d = datetime.datetime.strptime(start_date, "%Y-%m-%d") + datetime.timedelta(days=days_offset)
        return d.month
    except Exception:
        return datetime.datetime.now().month


def _overlaps_ramadan(month: int) -> bool:
    return month in [3, 4]


def _all_consecutive(subset: list, full_list: list) -> bool:
    """Return True if all items in subset appear consecutively in full_list."""
    if not subset:
        return False
    indices = [full_list.index(c) for c in subset if c in full_list]
    return indices == list(range(min(indices), max(indices) + 1))


def run_multi_city_check(trip: dict, persona: dict) -> dict:
    """
    trip = {"cities": [...], "nights_per_city": [...], "start_date": "YYYY-MM-DD"}
    persona = PersonaProfile dict.
    Returns {"per_city": {city: conflict_result}, "sequence_conflicts": [...]}
    """
    cities           = trip["cities"]
    nights           = trip["nights_per_city"]
    start_date       = trip.get("start_date", "2026-01-01")
    profiles         = {c: get_city_profile(c) for c in cities}

    # ── Per-city checks ──────────────────────────────────────
    per_city = {}
    cumulative_days = 0
    for i, city in enumerate(cities):
        city_start = start_date  # simplified: use start_date + cumulative offset
        import datetime
        try:
            city_start = (
                datetime.datetime.strptime(start_date, "%Y-%m-%d")
                + datetime.timedelta(days=cumulative_days)
            ).strftime("%Y-%m-%d")
        except Exception:
            pass
        per_city[city] = run_conflict_check(city, persona, city_start)
        cumulative_days += nights[i]

    # ── Sequence checks ──────────────────────────────────────
    seq = []

    # SEQ-1: Walkability drop
    prefers_walking = persona.get("stops_per_day", 4) <= 3.5 or persona.get("flexibility", 0) >= 0.8
    for i in range(len(cities) - 1):
        a, b = profiles[cities[i]], profiles[cities[i + 1]]
        if a and b and prefers_walking:
            if (a.get("walkability", 2) - b.get("walkability", 2)) >= 2:
                seq.append({
                    "severity": "medium",
                    "message": f"Moving from walkable {cities[i].title()} to car-dependent {cities[i+1].title()}.",
                    "instruction": f"Increase transit weighting for {cities[i+1].title()} days."
                })

    # SEQ-2: Cumulative cost
    price_max = persona.get("price_max", 4)
    total_nights = sum(nights)
    if total_nights > 0:
        weighted_avg = sum(
            profiles[c].get("cost_tier", 2) * nights[i]
            for i, c in enumerate(cities)
            if profiles[c]
        ) / total_nights
        if weighted_avg > price_max + 1:
            seq.append({
                "severity": "high",
                "message": f"Your route averages cost tier {weighted_avg:.1f} — above your budget preference of {price_max}.",
                "instruction": "Restrict paid venues across trip. Prioritise free attractions in expensive cities."
            })
        elif weighted_avg > price_max:
            seq.append({
                "severity": "medium",
                "message": f"Your combined route is slightly over budget (avg cost tier {weighted_avg:.1f}).",
                "instruction": "Flag expensive city days. One paid highlight per day maximum."
            })

    # SEQ-3: Climate whiplash
    cumulative = 0
    for i in range(len(cities) - 1):
        month_a = _travel_month(start_date, cumulative)
        month_b = _travel_month(start_date, cumulative + nights[i])
        pa, pb  = profiles[cities[i]], profiles[cities[i + 1]]
        if pa and pb:
            a_hot = month_a in pa.get("climate_hot", [])
            b_hot = month_b in pb.get("climate_hot", [])
            if a_hot != b_hot:
                seq.append({
                    "severity": "low",
                    "message": f"Significant climate change between {cities[i].title()} and {cities[i+1].title()}.",
                    "instruction": "Add packing note for temperature shift."
                })
        cumulative += nights[i]

    # SEQ-4: Ramadan continuity
    cumulative = 0
    affected_days = 0
    affected_city_names = []
    for i, city in enumerate(cities):
        p = profiles[city]
        if p and p.get("ramadan_affected"):
            month = _travel_month(start_date, cumulative)
            if _overlaps_ramadan(month):
                affected_days += nights[i]
                affected_city_names.append(city.title())
        cumulative += nights[i]
    if affected_days > 0:
        seq.append({
            "severity": "high",
            "message": f"{affected_days} day(s) of your trip fall during Ramadan in: {', '.join(affected_city_names)}.",
            "instruction": "Schedule all food stops after Iftar (~18:30). Note daytime closures."
        })

    # SEQ-5: Pace sustainability
    stops_per_day = persona.get("stops_per_day", 4)
    total_stops   = stops_per_day * total_nights
    if total_stops > 40 and total_nights > 7:
        longest_city = cities[nights.index(max(nights))]
        seq.append({
            "severity": "medium",
            "message": f"High stop count ({int(total_stops)} stops) over {total_nights} days — fatigue risk on long trips.",
            "instruction": f"Consider a rest day in {longest_city.title()}. Reduce stops on day 4+."
        })

    # SEQ-6: Visa complexity
    for i in range(len(cities) - 1):
        p = profiles[cities[i + 1]]
        if p and p.get("visa_complexity", 0) == 2:
            seq.append({
                "severity": "low",
                "message": f"Entry to {cities[i+1].title()} requires advance visa application.",
                "instruction": "Add visa planning note. Allow 4–6 weeks before travel."
            })

    # SEQ-7: Museum fatigue
    mood = persona.get("mood", [])
    if isinstance(mood, str):
        mood = [mood]
    if "culture" in mood:
        museum_heavy = [c for c in cities if profiles[c] and profiles[c].get("heritage", 0) >= 3]
        if len(museum_heavy) >= 3 and _all_consecutive(museum_heavy, cities):
            seq.append({
                "severity": "low",
                "message": f"Three high-culture cities back to back: {', '.join(c.title() for c in museum_heavy)}.",
                "instruction": "Consider a lighter city between cultural stops to avoid fatigue."
            })

    # SEQ-8: Dietary continuity (halal)
    dietary = persona.get("dietary", [])
    if "halal_certified_only" in dietary:
        scarce = [c for c in cities if profiles[c] and profiles[c].get("halal_supply", 2) <= 1]
        for city in scarce:
            seq.append({
                "severity": "high",
                "message": f"Halal options are very limited in {city.title()} — stock up before arriving.",
                "instruction": f"Flag {city.title()} restaurant stops as scarce. Add pre-arrival note."
            })

    return {
        "per_city":          per_city,
        "sequence_conflicts": seq,
        "has_sequence_conflicts": len(seq) > 0,
    }
```

- [ ] **Step 4: Export `run_multi_city_check` in main.py import line**

```python
# In main.py line 16, update:
from ip_engine import build_persona_response, get_city_profile, run_conflict_check, run_multi_city_check, ARCHETYPES
```

- [ ] **Step 5: Run all multi-city tests**

```bash
python3 -m pytest tests/test_logic_engine.py -k "multi_city or seq" -v
```

Expected: all PASS

- [ ] **Step 6: Run full test suite**

```bash
python3 -m pytest tests/test_logic_engine.py -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add ip_engine.py main.py tests/test_logic_engine.py && git commit -m "feat: add run_multi_city_check with 8 sequence conflict checks"
```

---

### Task 8: Add POST /persona/multi-city endpoint

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Write failing test**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 8: /persona/multi-city endpoint ─────────────────────

def test_multi_city_endpoint_shape():
    """Integration test — calls run_multi_city_check directly (no HTTP)."""
    from ip_engine import run_multi_city_check
    trip = {"cities": ["tokyo", "kyoto"], "nights_per_city": [3, 2], "start_date": "2026-06-01"}
    result = run_multi_city_check(trip, halal_profile())
    assert "per_city" in result
    assert "sequence_conflicts" in result
    assert "has_sequence_conflicts" in result
    assert isinstance(result["sequence_conflicts"], list)
```

- [ ] **Step 2: Run to confirm pass (shape test uses existing function)**

```bash
python3 -m pytest tests/test_logic_engine.py::test_multi_city_endpoint_shape -v
```

Expected: PASS

- [ ] **Step 3: Add endpoint to main.py**

In `main.py`, after the existing `/persona` endpoint, add:

```python
class MultiCityRequest(BaseModel):
    cities: list[str]
    nights_per_city: list[int]
    start_date: str
    persona: dict  # PersonaProfile from frontend ob-resolver

@app.post("/persona/multi-city")
async def persona_multi_city(req: MultiCityRequest):
    if len(req.cities) != len(req.nights_per_city):
        raise HTTPException(status_code=400, detail="cities and nights_per_city must have equal length")
    if len(req.cities) < 2:
        raise HTTPException(status_code=400, detail="multi-city requires at least 2 cities")

    trip = {
        "cities":          req.cities,
        "nights_per_city": req.nights_per_city,
        "start_date":      req.start_date,
    }
    result = run_multi_city_check(trip, req.persona)
    return result
```

- [ ] **Step 4: Verify server starts without errors**

```bash
cd /Users/souravbiswas/uncover-roads && python3 -c "import main; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Run full test suite**

```bash
python3 -m pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_logic_engine.py && git commit -m "feat: add POST /persona/multi-city endpoint"
```

---

### Task 9: Update build_persona_response to accept PersonaProfile fields

**Files:**
- Modify: `ip_engine.py` (`build_persona_response`, line ~702)

The existing function only uses old OB fields. Update it to pass through new PersonaProfile fields when present.

- [ ] **Step 1: Write failing test**

Add to `tests/test_logic_engine.py`:

```python
# ── Task 9: build_persona_response with new fields ────────────

def test_build_persona_response_new_fields_passed_through():
    ob = {
        # old fields
        "ritual": "coffee", "sensory": "visual", "pace": "any",
        "style": "planner", "attractions": ["historic"], "social": "solo",
        # new fields
        "group": "solo", "mood": ["culture"], "day_open": "coffee",
        "budget": "mid_range", "evening": "dinner_wind",
        "dietary": [], "price_min": 1, "price_max": 3,
        "evening_type": "dinner", "social_flags": ["solo"],
        "stops_per_day": 4.5,
    }
    result = build_persona_response(ob, "tokyo")
    assert "persona" in result
    assert "conflicts" in result
    # New fields should be echoed in persona
    assert result["persona"].get("group") == "solo"
    assert result["persona"].get("evening_type") == "dinner"
```

- [ ] **Step 2: Run to confirm failure**

```bash
python3 -m pytest tests/test_logic_engine.py::test_build_persona_response_new_fields_passed_through -v
```

Expected: FAIL — new fields not in persona output

- [ ] **Step 3: Update build_persona_response in ip_engine.py**

In the `persona` dict inside `build_persona_response`, add the new fields:

```python
    persona = {
        # existing fields
        "archetype":      archetype,
        "ritual":         ob_answers.get("ritual"),
        "sensory":        ob_answers.get("sensory"),
        "pace":           ob_answers.get("pace"),
        "style":          ob_answers.get("style"),
        "social":         ob_answers.get("social"),
        "attractions":    ob_answers.get("attractions", []),
        "archetype_name": arch_data.get("name", archetype),
        "archetype_desc": arch_data.get("desc", ""),
        "venue_filters":  arch_data.get("venue_filters", []),
        "itinerary_bias": arch_data.get("itinerary_bias", []),
        "top_matches":    top_matches,
        # new PersonaProfile fields (present only when new OB format used)
        "group":          ob_answers.get("group"),
        "mood":           ob_answers.get("mood"),
        "day_open":       ob_answers.get("day_open"),
        "budget":         ob_answers.get("budget"),
        "evening_type":   ob_answers.get("evening_type"),
        "dietary":        ob_answers.get("dietary", []),
        "price_min":      ob_answers.get("price_min"),
        "price_max":      ob_answers.get("price_max"),
        "social_flags":   ob_answers.get("social_flags", []),
        "stops_per_day":  ob_answers.get("stops_per_day"),
        "flexibility":    ob_answers.get("flexibility"),
    }
```

- [ ] **Step 4: Run full test suite**

```bash
python3 -m pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add ip_engine.py tests/test_logic_engine.py && git commit -m "feat: pass PersonaProfile fields through build_persona_response"
```
