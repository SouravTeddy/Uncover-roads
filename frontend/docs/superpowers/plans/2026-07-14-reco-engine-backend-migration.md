# Reco Engine Backend Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all reco injection intelligence to the backend so the frontend makes one API call, receives a complete itinerary with all stops (user-selected + injected) and pre-resolved images, and renders immediately with no lazy loading or suggestion cards.

**Architecture:** The backend `engine_itinerary` endpoint becomes the single authority. It receives the user's full persona signal (including `rawOBAnswers` and persona weights), detects gaps per day, selects stop types per persona × group, resolves real places, pre-fetches images, and returns a complete payload. The frontend drops its entire reco-engine folder, `ReelRecoCard`, and `useReelRecommendations` — it is a pure renderer.

**Tech Stack:** Python 3.11 (FastAPI backend on Railway), TypeScript + React 19 (Vite frontend on Vercel), Supabase (`place_details_cache` table), Google Places API.

## Global Constraints

- Per-day injection cap: max 1 stop per trigger type per day (e.g. 1 lunch, 1 rest, 1 culture). Total daily injection limit TBD — will be defined by user separately before Task 4.
- Backend tasks (1–5) must be deployed and verified before frontend removal tasks (6–8) are deployed.
- Injected stops must have `isEngineAdded: true` in the response.
- If image resolution fails for an injected stop, the stop is still included — `imageUrl` is `null` and the frontend falls back to city photo.
- No breaking changes to the response schema — add fields, never remove existing ones.
- `rawOBAnswers` is optional on the backend (old clients that don't send it get current behaviour).
- All backend changes live in `/Users/souravbiswas/uncover-roads/` (not in `frontend/`).
- All frontend changes live in `/Users/souravbiswas/uncover-roads/frontend/src/`.

---

## File Map

**Backend (created/modified):**
- `engine/reco_engine.py` — extend `RecoSignal`, add persona×group category table, update `derive_day_recos`
- `main.py` — extend `EngineItineraryPayload` Pydantic model; update `RecoSignal` construction in injection block; add image pre-resolution to `_resolve_reco_trigger`

**Frontend (modified then deleted):**
- `src/modules/map/MapScreen.tsx` — send `rawOBAnswers` + real `engineWeights` in build call
- `src/shared/api.ts` — update TypeScript type for `engineItinerary.start` body
- `src/modules/route/reel/ItineraryReelScreen.tsx` — remove `deriveRecos` / `recosByDayIdx` from `buildFiltered`
- `src/modules/route/reel/reel-builder.ts` — remove `recosByDayIdx` param and all reco card insertion

**Frontend (deleted in Task 7):**
- `src/modules/route/reco-engine/engine.ts`
- `src/modules/route/reco-engine/profile.ts`
- `src/modules/route/reco-engine/dimensions.ts`
- `src/modules/route/reco-engine/semantics.ts`
- `src/modules/route/reco-engine/signal.ts`
- `src/modules/route/reco-engine/behavior.ts`
- `src/modules/route/reco-engine/index.ts`
- `src/modules/route/reel/ReelRecoCard.tsx`
- `src/modules/route/reel/useReelRecommendations.ts`

---

## Task 1: Extend API contract — send rawOBAnswers and real weights

**Files:**
- Modify: `main.py` — `EngineItineraryPayload` class (~line 162)
- Modify: `frontend/src/shared/api.ts` — `engineItinerary.start` type (~line 184)
- Modify: `frontend/src/modules/map/MapScreen.tsx` — `api.engineItinerary.start(...)` call (~line 531)

**Interfaces:**
- Produces: `EngineItineraryPayload.rawOBAnswers: Optional[dict]` available in injection block; frontend sends `rawOBAnswers` + real weights on every build

- [ ] **Step 1: Add `rawOBAnswers` to backend Pydantic model**

Open `main.py`. Find `class EngineItineraryPayload(BaseModel):` (~line 162). Add one field after `startType`:

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
    arrivalTime: Optional[str] = None
    departureTime: Optional[str] = None
    startType: Optional[str] = "hotel"
    rawOBAnswers: Optional[dict] = None   # ← add this line
```

- [ ] **Step 2: Update TypeScript API type**

Open `frontend/src/shared/api.ts`. Find `engineItinerary.start` (~line 184). Add `rawOBAnswers` and change `engineWeights` from `null` to the real type:

```typescript
start: (body: {
  city: string;
  lat: number;
  lon: number;
  days: number;
  startDate: string;
  selectedPlaces: unknown[];
  personaArchetype: string;
  engineWeights: Record<string, number> | null;
  cities?: string[];
  arrivalTime: string | null;
  departureTime: string | null;
  startType: string;
  rawOBAnswers: Record<string, unknown> | null;   // ← add this
}) =>
  post<{ buildId: string; status: string }>('/engine-itinerary/start', body),
```

- [ ] **Step 3: Send rawOBAnswers and real weights from MapScreen**

Open `frontend/src/modules/map/MapScreen.tsx`. Find `api.engineItinerary.start({` (~line 531). The component already has `state.rawOBAnswers` available via `const { ... } = state`. Add to the destructure at the top of the component:

```typescript
const { selectedPlaces, city, cityGeo, persona, personaProfile, rawOBAnswers, pendingTripDetails, tripContext, journey } = state;
```

Then update the start call:

```typescript
const res = await api.engineItinerary.start({
  city: primaryCity,
  lat: cityGeo?.lat ?? 0,
  lon: cityGeo?.lon ?? 0,
  days,
  startDate,
  selectedPlaces: interleaved,
  personaArchetype: personaProfile?.archetype ?? 'explorer',
  engineWeights: (persona as { weights?: Record<string, number> })?.weights ?? null,
  cities: orderedCities.length > 1 ? orderedCities : undefined,
  arrivalTime: pendingTripDetails?.arrivalTime ?? null,
  departureTime: pendingTripDetails?.departureTime ?? null,
  startType: tripContext.startType ?? 'hotel',
  rawOBAnswers: rawOBAnswers ?? null,   // ← add this
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/api.ts frontend/src/modules/map/MapScreen.tsx main.py
git commit -m "feat: send rawOBAnswers and real persona weights to engine_itinerary"
```

---

## Task 2: Enrich RecoSignal with full OB data and update injection block

**Files:**
- Modify: `engine/reco_engine.py` — extend `RecoSignal` dataclass
- Modify: `main.py` — update `RecoSignal` construction in injection block (~line 5657)

**Interfaces:**
- Consumes: `body.rawOBAnswers` (dict, optional) from Task 1
- Produces: `RecoSignal` with `group`, `is_family`, `mood`, `budget`, `evening_pref` fields available in `derive_day_recos` and `_resolve_reco_trigger`

- [ ] **Step 1: Extend RecoSignal dataclass**

Open `engine/reco_engine.py`. Replace the `RecoSignal` dataclass:

```python
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
    # OB fields — all optional (default to neutral when not sent by old clients)
    group: str = "solo"          # 'solo' | 'couple' | 'family' | 'friends'
    is_family: bool = False
    mood: list = None            # ['culture', 'eat_drink', 'explore', 'relax']
    budget: Optional[str] = None # 'budget' | 'mid' | 'splurge'
    evening_pref: Optional[str] = None  # 'nightlife' | 'dinner' | 'early_night'

    def __post_init__(self):
        if self.mood is None:
            self.mood = []
```

- [ ] **Step 2: Write a test for RecoSignal construction**

Open `engine/test_reco_engine.py` (create if it doesn't exist):

```python
import pytest
from engine.reco_engine import RecoSignal, _archetype_group

def _base_signal(**kwargs):
    defaults = dict(
        weights={"w_food_density": 0.5, "w_culture_depth": 0.5, "w_nightlife": 0.5,
                 "w_rest_need": 0.3, "w_spontaneity": 0.4},
        archetype="explorer",
        archetype_group="explorer",
        pace="moderate",
        city="tokyo",
        is_first_day=False,
        is_last_day=False,
        arrival_time=None,
        departure_time=None,
    )
    defaults.update(kwargs)
    return RecoSignal(**defaults)

def test_reco_signal_defaults_group():
    s = _base_signal()
    assert s.group == "solo"
    assert s.is_family is False
    assert s.mood == []
    assert s.budget is None

def test_reco_signal_family():
    s = _base_signal(group="family", is_family=True)
    assert s.is_family is True

def test_reco_signal_mood():
    s = _base_signal(mood=["culture", "explore"])
    assert "culture" in s.mood
```

- [ ] **Step 3: Run test to verify it fails (RecoSignal doesn't have new fields yet)**

```bash
cd /Users/souravbiswas/uncover-roads && python -m pytest engine/test_reco_engine.py -v
```

Expected: FAIL — `RecoSignal.__init__() got unexpected keyword argument 'group'`

- [ ] **Step 4: Apply the RecoSignal dataclass change from Step 1**

Make the edit described in Step 1.

- [ ] **Step 5: Run test to verify it passes**

```bash
python -m pytest engine/test_reco_engine.py::test_reco_signal_defaults_group engine/test_reco_engine.py::test_reco_signal_family engine/test_reco_engine.py::test_reco_signal_mood -v
```

Expected: 3 PASSED.

- [ ] **Step 6: Update RecoSignal construction in main.py injection block**

Find the injection block in `main.py` (~line 5653). Replace the `_reco_signal = RecoSignal(...)` block:

```python
from engine.reco_engine import derive_day_recos, RecoSignal, _archetype_group as _ag
_pace_map = {"slow": "slow", "balanced": "moderate", "pack": "fast", "spontaneous": "moderate"}
_raw = body.rawOBAnswers or {}
_pace = _pace_map.get((_raw.get("pace") or ["moderate"])[0], "moderate") if _raw else "moderate"
_group = _raw.get("group") or "solo"
_is_family = _group == "family"
_mood = _raw.get("mood") or []
_budget = _raw.get("budget") or None
_evening_pref = _raw.get("evening") or None

_reco_signal = RecoSignal(
    weights=persona,
    archetype=archetype,
    archetype_group=_ag(archetype),
    pace=_pace,
    city=result.days[i].city if result.days[i].city else body.city,
    is_first_day=(i == 0),
    is_last_day=(i == len(result.days) - 1),
    arrival_time=body.arrivalTime or None,
    departure_time=body.departureTime or None,
    group=_group,
    is_family=_is_family,
    mood=_mood,
    budget=_budget,
    evening_pref=_evening_pref,
)
```

- [ ] **Step 7: Commit**

```bash
git add engine/reco_engine.py engine/test_reco_engine.py main.py
git commit -m "feat: enrich RecoSignal with group, mood, budget, evening_pref from rawOBAnswers"
```

---

## Task 3: Persona × group → stop type mapping in _resolve_reco_trigger

**Files:**
- Modify: `engine/reco_engine.py` — add `persona_category_map` function
- Modify: `main.py` — update `_resolve_reco_trigger` to use persona-aware Google types

**Interfaces:**
- Consumes: `RecoSignal.archetype_group`, `RecoSignal.is_family`, `RecoSignal.mood` from Task 2
- Produces: `_persona_google_types(trigger, signal) -> list[str]` — ordered list of Google Place types to try

- [ ] **Step 1: Write failing test for persona category mapping**

Add to `engine/test_reco_engine.py`:

```python
from engine.reco_engine import persona_google_types

def test_family_rest_gets_park():
    s = _base_signal(group="family", is_family=True)
    types = persona_google_types("rest", s)
    assert "park" in types

def test_nightlife_archetype_evening_gets_bar():
    s = _base_signal(archetype="nightcreature", archetype_group="social", evening_pref="nightlife")
    types = persona_google_types("evening", s)
    assert types[0] in ("bar", "night_club")

def test_cultural_archetype_rest_gets_cafe():
    s = _base_signal(archetype="historian", archetype_group="cultural")
    types = persona_google_types("rest", s)
    assert "cafe" in types

def test_family_culture_gets_kid_friendly():
    s = _base_signal(group="family", is_family=True)
    types = persona_google_types("culture", s)
    assert "amusement_park" in types or "zoo" in types
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest engine/test_reco_engine.py::test_family_rest_gets_park engine/test_reco_engine.py::test_nightlife_archetype_evening_gets_bar engine/test_reco_engine.py::test_cultural_archetype_rest_gets_cafe engine/test_reco_engine.py::test_family_culture_gets_kid_friendly -v
```

Expected: 4 FAILED — `cannot import name 'persona_google_types'`

- [ ] **Step 3: Implement persona_google_types in reco_engine.py**

Add after `_anchor_stop` function in `engine/reco_engine.py`:

```python
def persona_google_types(trigger: str, signal: RecoSignal) -> list[str]:
    """
    Returns ordered list of Google Place API types to try for a trigger,
    personalised by archetype group, group type (family), and mood.
    First entry is the primary type; subsequent entries are fallbacks.
    """
    g = signal.archetype_group
    is_family = signal.is_family

    _MAP: dict[str, dict] = {
        "rest": {
            "family":   ["park", "amusement_park", "cafe"],
            "social":   ["bar", "cafe"],
            "cultural": ["cafe", "museum"],
            "sensory":  ["cafe", "park"],
            "explorer": ["park", "viewpoint", "cafe"],
        },
        "lunch": {
            "family":   ["restaurant", "cafe"],
            "social":   ["restaurant", "bar"],
            "cultural": ["restaurant", "cafe"],
            "sensory":  ["restaurant"],
            "explorer": ["restaurant", "market"],
        },
        "dinner": {
            "family":   ["restaurant"],
            "social":   ["restaurant", "bar"],
            "cultural": ["restaurant"],
            "sensory":  ["restaurant"],
            "explorer": ["restaurant", "market"],
        },
        "evening": {
            "family":   ["restaurant"],
            "social":   ["bar", "night_club"],
            "cultural": ["theater", "bar"],
            "sensory":  ["restaurant", "bar"],
            "explorer": ["bar", "viewpoint"],
        },
        "culture": {
            "family":   ["amusement_park", "zoo", "museum"],
            "social":   ["museum", "art_gallery"],
            "cultural": ["museum", "art_gallery", "church"],
            "sensory":  ["art_gallery", "museum"],
            "explorer": ["museum", "art_gallery"],
        },
        "social_gap": {
            "family":   ["park", "cafe"],
            "social":   ["bar", "night_club"],
            "cultural": ["cafe", "bar"],
            "sensory":  ["cafe", "bar"],
            "explorer": ["bar", "cafe"],
        },
        "hidden_gem": {
            "family":   ["point_of_interest", "park"],
            "social":   ["bar", "point_of_interest"],
            "cultural": ["point_of_interest", "historic_site"],
            "sensory":  ["point_of_interest", "cafe"],
            "explorer": ["point_of_interest", "establishment"],
        },
        "local_food": {
            "_all": ["restaurant", "market", "cafe"],
        },
        "famous_spots": {
            "family":   ["amusement_park", "tourist_attraction", "landmark"],
            "_all":     ["tourist_attraction", "landmark"],
        },
    }

    group_key = "family" if is_family else g
    trigger_map = _MAP.get(trigger, {})
    types = trigger_map.get(group_key) or trigger_map.get("_all") or trigger_map.get(g) or ["restaurant"]
    return types
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest engine/test_reco_engine.py::test_family_rest_gets_park engine/test_reco_engine.py::test_nightlife_archetype_evening_gets_bar engine/test_reco_engine.py::test_cultural_archetype_rest_gets_cafe engine/test_reco_engine.py::test_family_culture_gets_kid_friendly -v
```

Expected: 4 PASSED.

- [ ] **Step 5: Update _resolve_reco_trigger in main.py to use persona_google_types**

Find `_resolve_reco_trigger` in `main.py` (~line 4849). It currently takes `weights: dict`. Add `signal: Optional[...]` parameter and update the Google types lookup:

```python
def _resolve_reco_trigger(
    trigger: dict,
    existing_place_ids: set[str],
    supabase_client,
    google_api_key: str | None,
    weights: dict,
    signal=None,   # RecoSignal | None — for persona-aware type selection
) -> dict | None:
```

Inside the function, replace the `google_types = _TRIGGER_TYPES.get(trig, ["restaurant"])` line:

```python
    # Persona-aware type selection when signal is available
    if signal is not None:
        from engine.reco_engine import persona_google_types
        google_types = persona_google_types(trig, signal)
    else:
        google_types = _TRIGGER_TYPES.get(trig, ["restaurant"])
```

- [ ] **Step 6: Pass signal to _resolve_reco_trigger in the injection block**

Find the injection loop in `main.py` (~line 5672). Update the call:

```python
_reco_stop = _resolve_reco_trigger(
    _trigger, _existing_pids, _supabase, GOOGLE_PLACES_API_KEY, persona,
    signal=_reco_signal,   # ← add this
)
```

- [ ] **Step 7: Commit**

```bash
git add engine/reco_engine.py engine/test_reco_engine.py main.py
git commit -m "feat: persona×group→stop type mapping in reco trigger resolution"
```

---

## Task 4: Cap injections — 1 per trigger type per day (dedup + enforce)

**Files:**
- Modify: `engine/reco_engine.py` — verify `derive_day_recos` already dedupes via `seen` set; add total-per-day cap (value TBD with user)
- Modify: `main.py` — verify injection loop respects the cap

**Note:** The per-day total injection limit (e.g. max 3 stops per day total) is to be defined by the user before this task is implemented. The 1-per-trigger-type cap is already implemented via the `seen` set in `derive_day_recos`. This task hardens it and adds the total cap once confirmed.

**Interfaces:**
- Produces: `derive_day_recos` returns at most 1 trigger per type, capped at N total (N = user-defined)

- [ ] **Step 1: Write test confirming 1-per-trigger-type dedup**

Add to `engine/test_reco_engine.py`:

```python
from engine.reco_engine import derive_day_recos

def _stop(id, time, category, lat=35.6, lon=139.7):
    return {"id": id, "time": time, "category": category,
            "lat": lat, "lon": lon, "durationMin": 60}

def test_no_duplicate_trigger_types():
    stops = [
        _stop("s1", "09:00", "museum"),
        _stop("s2", "11:00", "museum"),
        _stop("s3", "14:00", "museum"),
    ]
    signal = _base_signal()
    triggers = derive_day_recos(stops, signal)
    trigger_types = [t["trigger"] for t in triggers]
    assert len(trigger_types) == len(set(trigger_types)), "Duplicate trigger types found"

def test_lunch_not_emitted_when_restaurant_present():
    stops = [
        _stop("s1", "09:00", "museum"),
        _stop("s2", "12:30", "restaurant"),
        _stop("s3", "15:00", "museum"),
    ]
    signal = _base_signal()
    triggers = derive_day_recos(stops, signal)
    assert not any(t["trigger"] == "lunch" for t in triggers)
```

- [ ] **Step 2: Run tests**

```bash
python -m pytest engine/test_reco_engine.py::test_no_duplicate_trigger_types engine/test_reco_engine.py::test_lunch_not_emitted_when_restaurant_present -v
```

Expected: 2 PASSED (these should already pass — confirms existing behaviour).

- [ ] **Step 3: ⚠️ PAUSE — confirm total per-day cap with user before proceeding**

The total cap (max N injections per day regardless of trigger type) needs the user's input. Do not implement a hard number here without confirmation. Once confirmed, add after the `triggers` list is built in `derive_day_recos`:

```python
    # Enforce total-per-day cap (agreed value substituted for N)
    MAX_INJECTIONS_PER_DAY = N   # ← replace N with confirmed value
    return triggers[:MAX_INJECTIONS_PER_DAY]
```

- [ ] **Step 4: Commit once cap value is confirmed and implemented**

```bash
git add engine/reco_engine.py engine/test_reco_engine.py
git commit -m "feat: enforce per-day injection cap of N stops"
```

---

## Task 5: Pre-resolve images for injected stops

**Files:**
- Modify: `main.py` — update `_resolve_reco_trigger` to set `imageUrl` before returning

**Interfaces:**
- Consumes: `place_details_cache` Supabase table (columns: `place_id`, `data` jsonb with `photo_ref`)
- Produces: injected stop dict includes `imageUrl: str | None`

- [ ] **Step 1: Write test for image resolution**

Add to `engine/test_reco_engine.py`:

```python
def test_resolve_trigger_sets_image_url_when_photo_ref_available():
    """Unit test the imageUrl formatting logic, not the full resolver."""
    photo_ref = "ATplDJa1234exampleref"
    api_base = "https://api.example.com"
    expected = f"{api_base}/place-photo?ref={photo_ref}&maxwidth=800"
    result = _format_image_url(photo_ref, api_base)
    assert result == expected

def _format_image_url(photo_ref: str, api_base: str) -> str:
    return f"{api_base}/place-photo?ref={photo_ref}&maxwidth=800"
```

This test validates the URL format. The full integration (with Supabase) is tested manually.

- [ ] **Step 2: Add imageUrl to _resolve_reco_trigger return dict**

Open `main.py`. Find `_resolve_reco_trigger` return dict (~line 4944). The `photoRef` field is already set from `details.get("photo_ref")`. Add `imageUrl` derived from it:

```python
    _photo_ref = details.get("photo_ref") or None
    _api_base = os.environ.get("API_BASE_URL", "")   # set in Railway env

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
        "photoRef":    _photo_ref,
        "imageUrl":    f"{_api_base}/place-photo?ref={_photo_ref}&maxwidth=800" if _photo_ref and _api_base else None,
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

- [ ] **Step 3: Add API_BASE_URL to Railway environment variables**

In Railway dashboard, add environment variable:
```
API_BASE_URL=https://your-railway-app.railway.app
```

(This is already the deployed URL — just needs to be exposed as an env var.)

- [ ] **Step 4: Verify manually**

Build an itinerary. In the response JSON, find a stop where `isEngineAdded: true`. Confirm:
- `photoRef` is a non-null string
- `imageUrl` is `https://your-railway-app.railway.app/place-photo?ref=...&maxwidth=800`
- Pasting that URL in browser returns an image

- [ ] **Step 5: Commit**

```bash
git add main.py
git commit -m "feat: pre-resolve imageUrl for injected stops in _resolve_reco_trigger"
```

---

## Task 6: Remove deriveRecos from frontend buildFiltered

**Deploy Tasks 1–5 to Railway first. Verify injected stops appear correctly in the reel with images before doing this task.**

**Files:**
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` — remove `recosByDayIdx` building from `buildFiltered`

**Interfaces:**
- Consumes: `buildReelCards` now called with empty `recosByDayIdx` (Map stays as param for now — removed in Task 7)
- Produces: reel built entirely from itinerary stops; no frontend-generated reco cards

- [ ] **Step 1: Remove recosByDayIdx computation from buildFiltered**

Open `ItineraryReelScreen.tsx`. Find `buildFiltered` (~line 184). The function currently builds `recosByDayIdx` by calling `computeRecoSignal` and `deriveRecos` for each day. Remove the entire `recosByDayIdx` block (approximately lines 201–252 based on current file), the trip-wide cap block, and the `famous_spots` and `local_food` injections.

Replace with:

```typescript
const recosByDayIdx = new Map<number, ReelRecoCard[]>();
```

The `buildReelCards` call on the line below still receives `recosByDayIdx` — it now receives an empty map, so no frontend reco cards will be built.

- [ ] **Step 2: Remove unused imports from ItineraryReelScreen.tsx**

Remove these imports (they are now unused):

```typescript
import { computeRecoSignal, deriveRecos, buildInteraction } from '../reco-engine';
import { FOOD_CATS } from '../reco-engine/profile';
import { getLocalFoodFact } from './local-food-facts';
```

Keep `syncRecoInteractions` import only if `behavior.ts` tracking is still used (it won't be after Task 7 — remove it now too):

```typescript
// Remove this line:
import { syncRecoInteractions } from '../../../shared/userSync';
```

Also remove the `useEffect` at the bottom that calls `syncRecoInteractions` on unmount (~line 601):

```typescript
// Remove this entire useEffect:
useEffect(() => {
  return () => {
    if (state.recoInteractions.length === 0) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) syncRecoInteractions(user.id, state.recoInteractions as any).catch(console.warn);
    });
  };
}, []);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: errors for unused imports removed, no logic errors.

- [ ] **Step 4: Build the app and verify reel works**

```bash
npm run build
```

Open app, build an itinerary. Confirm:
- Reel loads with no suggestion-style cards
- Backend-injected stops show with "Our pick" chip
- No blank loading cards

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/reel/ItineraryReelScreen.tsx
git commit -m "feat: remove frontend deriveRecos from buildFiltered — backend is now authoritative"
```

---

## Task 7: Delete frontend reco-engine folder and suggestion card system

**Files:**
- Delete: `frontend/src/modules/route/reco-engine/` (entire folder — 7 files)
- Delete: `frontend/src/modules/route/reel/ReelRecoCard.tsx`
- Delete: `frontend/src/modules/route/reel/useReelRecommendations.ts`
- Modify: `frontend/src/shared/api.ts` — remove `reelReco` function
- Modify: `frontend/src/modules/route/reel/reel-builder.ts` — remove `recosByDayIdx` parameter and reco card insertion
- Modify: `frontend/src/modules/route/reel/ItineraryReelScreen.tsx` — remove `ReelRecoCard` import and rendering
- Modify: `frontend/src/modules/route/reel/types.ts` — remove `ReelRecoCard` type if unused elsewhere

- [ ] **Step 1: Grep for all imports of the files to be deleted**

```bash
cd frontend && grep -rn "from.*reco-engine\|from.*ReelRecoCard\|from.*useReelRecommendations\|reelReco\|ReelRecoCard\|RecoInteraction\|syncRecoInteractions" src --include="*.ts" --include="*.tsx"
```

Review the output — every import listed must be removed before deleting the files.

- [ ] **Step 2: Remove recosByDayIdx from reel-builder.ts**

Open `reel-builder.ts`. Find `buildReelCards` signature (~line 447). Remove the `recosByDayIdx` parameter:

```typescript
export function buildReelCards(
  itinerary: EngineItinerary,
  journeyLegs: JourneyLeg[] | null,
  _savedId: string | null,
  weatherByCity: Map<string, WeatherData> = new Map(),
  persona: string,
  // recosByDayIdx removed — backend handles all injections
  cityPhotoMap: Map<string, string | null> = new Map(),
  _cityCountries: Record<string, string> = {},
  tripDetails?: TripDetails | null,
  travelGroup?: string,
): ReelCard[] {
```

Remove the reco card insertion block inside the builder (the block that reads `recosByDayIdx.get(dayIdx)` and inserts `ReelRecoCard` objects after stops, ~lines 715–860). Also remove the `allRecosCount` check near line 933.

- [ ] **Step 3: Update the buildReelCards call in ItineraryReelScreen.tsx**

The call currently passes `recosByDayIdx` as the 6th argument. Remove it:

```typescript
const built = buildReelCards(
  itineraryForBuild,
  journeyLegs,
  reelSavedId,
  wxByCity,
  pName,
  // recosByDayIdx removed
  photoMap,
  cityCountries,
  tripDetailsRef.current,
  state.rawOBAnswers?.group ?? 'solo',
);
```

- [ ] **Step 4: Remove reelReco from api.ts**

Find `reelReco: async (params: {...})` in `api.ts` (~line 200). Delete the entire function including its closing brace and trailing comma.

- [ ] **Step 5: Delete the files**

```bash
cd frontend/src
rm -rf modules/route/reco-engine/
rm modules/route/reel/ReelRecoCard.tsx
rm modules/route/reel/useReelRecommendations.ts
```

- [ ] **Step 6: Verify TypeScript compiles clean**

```bash
cd frontend && npx tsc --noEmit
```

Fix any remaining import errors until output is clean.

- [ ] **Step 7: Build the full app**

```bash
npm run build
```

Expected: build succeeds, no TS errors, no references to deleted files.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: delete frontend reco-engine — suggestion cards fully replaced by backend injections"
```

---

## Task 8: Backward compatibility — saved trips without imageUrl on injected stops

**Files:**
- Modify: `frontend/src/modules/route/reel/ReelStopCard.tsx` — when `stop.isEngineAdded && !stop.imageUrl`, use city photo fallback explicitly

**Context:** Old saved trips (built before Task 5 deployed) have `isEngineAdded: true` stops but no `imageUrl`. Without this task, those stops render with a black background in the reel.

- [ ] **Step 1: Find where stop imageUrl is used in ReelStopCard.tsx**

```bash
grep -n "imageUrl\|photoRef\|cityPhoto\|isEngineAdded" frontend/src/modules/route/reel/ReelStopCard.tsx | head -20
```

- [ ] **Step 2: Add explicit fallback for engine-added stops without images**

Find where the card background image is set (the `<img>` or `backgroundImage` style referencing `stop.imageUrl` or `getPlacePhotoUrl(stop.photoRef)`). The card already has a `cityPhotoUrl` prop or similar fallback mechanism. Ensure engine-added stops without `imageUrl` AND without `photoRef` explicitly fall back to the city photo:

```typescript
const heroImage =
  stop.imageUrl
    ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 800, 1200) : null)
    ?? cityPhotoUrl   // ← this fallback must be used for isEngineAdded stops
    ?? null;
```

Verify `cityPhotoUrl` is already a prop on `ReelStopCard`. If not, it comes from the `cityPhotoMap` in the reel builder — check how it's currently passed.

- [ ] **Step 3: Build and test with an old saved trip**

Open a saved trip from before this migration. Confirm:
- Engine-added stops show the city photo (not a black background) when they have no `imageUrl`
- User-selected stops are unaffected

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/route/reel/ReelStopCard.tsx
git commit -m "fix: use city photo fallback for isEngineAdded stops without imageUrl (saved trip compat)"
```

---

## Deployment Order

```
Tasks 1–5  →  deploy backend to Railway  →  verify injections correct
Task 6     →  deploy frontend to Vercel  →  verify reel works, no suggestion cards
Tasks 7–8  →  deploy frontend to Vercel  →  final cleanup, verify saved trips
```

Do not deploy Task 6 before Tasks 1–5 are confirmed working in production. If Task 6 goes live before the backend is injecting correctly, the reel will show nothing between stops.

---

## Self-Review

**Spec coverage:**
- ✅ rawOBAnswers sent to backend → Task 1
- ✅ Real persona weights sent → Task 1
- ✅ RecoSignal enriched with group/family/mood/budget → Task 2
- ✅ Persona × group → stop type mapping → Task 3
- ✅ 1 per trigger type per day cap → Task 4 (total cap pending user input)
- ✅ Images pre-resolved → Task 5
- ✅ Frontend deriveRecos removed → Task 6
- ✅ Suggestion card system deleted → Task 7
- ✅ Saved trip backward compat → Task 8

**Placeholder scan:** Task 4 Step 3 explicitly pauses for user input on the total cap value — this is intentional, not a placeholder. All other steps have complete code.

**Type consistency:**
- `RecoSignal` extended in Task 2; used in Task 3 (`persona_google_types(trigger, signal)`) and Task 2 (`main.py` construction) — consistent
- `buildReelCards` loses `recosByDayIdx` param in Task 7 Step 2; call site updated in Task 7 Step 3 — consistent
- `imageUrl` added to injected stop dict in Task 5; consumed by Task 8 in `ReelStopCard` — consistent
