# Curated Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the curated tab show three simultaneous pin layers — persona-scored reco picks (deterministic, no LLM), OurPicks trending/hidden gems (Supabase, on-demand seeded), and live events (Ticketmaster + Eventbrite) — with all Pro gates removed.

**Architecture:** The backend `/recommended-places` endpoint is rewritten to score the map places already sent in the request body using a persona affinity lookup table — no LLM, no external API, sub-50ms response. The frontend gains a new `RecoPlacesPinsLayer` component rendered alongside the existing `OurPicksPinsLayer` and `LiveEventPinsLayer` when `activeFilter === 'curated'`. Eventbrite is added as a parallel fetch in `/events`, merged with the existing Ticketmaster results using the same title-dedup pattern already used for Yelp.

**Tech Stack:** Python/FastAPI (backend), React/TypeScript (frontend), react-map-gl/maplibre (map markers), Vitest + Testing Library (frontend tests), pytest (backend tests).

---

### Task 1: Scoring engine replaces LLM in `/recommended-places`

**Files:**
- Modify: `main.py` (lines 1232–1338 — the `/recommended-places` endpoint)
- Test: `tests/test_recommended_places.py` (create)

Context: The current endpoint calls Claude Haiku to hallucinate place names. We replace it with a scoring function that takes `places` (the real map places sent from the frontend) and ranks them by persona affinity + venue filter match + rating. The 7 archetypes are: `wanderer`, `historian`, `epicurean`, `pulse`, `slowtraveller`, `voyager`, `explorer`.

- [ ] **Step 1: Write failing tests**

Create `tests/test_recommended_places.py`:

```python
import pytest
import main as m

PLACES = [
    {"id": "p1", "title": "Senso-ji Temple", "category": "historic", "lat": 35.71, "lon": 139.79, "rating": 4.8},
    {"id": "p2", "title": "Blue Bottle Coffee", "category": "cafe",    "lat": 35.67, "lon": 139.70, "rating": 4.5},
    {"id": "p3", "title": "Shinjuku Gyoen",    "category": "park",     "lat": 35.68, "lon": 139.71, "rating": 4.7},
    {"id": "p4", "title": "Some Event",         "category": "event",    "lat": 35.67, "lon": 139.65, "rating": None},
]

def test_historian_prefers_historic(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "historian",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": PLACES,
    })
    assert r.status_code == 200
    picks = r.json()["picks"]
    assert len(picks) > 0
    assert picks[0]["title"] == "Senso-ji Temple"

def test_events_excluded_from_picks(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "wanderer",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": PLACES,
    })
    picks = r.json()["picks"]
    assert all(p["category"] != "event" for p in picks)

def test_empty_places_returns_empty(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "epicurean",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": [],
    })
    assert r.json()["picks"] == []

def test_venue_filter_boosts_score(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "wanderer",
        "venue_filters": ["cafe"],
        "itinerary_bias": [],
        "places": PLACES,
    })
    picks = r.json()["picks"]
    titles = [p["title"] for p in picks]
    # cafe is in venue_filters so Blue Bottle should rank above park for wanderer
    assert titles.index("Blue Bottle Coffee") < titles.index("Shinjuku Gyoen")

def test_reason_text_is_non_empty(client):
    r = client.post("/recommended-places", json={
        "city": "Tokyo",
        "persona_archetype": "historian",
        "venue_filters": [],
        "itinerary_bias": [],
        "places": PLACES,
    })
    picks = r.json()["picks"]
    assert all(p.get("whyRec") for p in picks)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads
pytest tests/test_recommended_places.py -v
```

Expected: `FAILED` — `test_historian_prefers_historic` fails because the current endpoint calls the LLM (or returns `{"picks": []}` if no Anthropic key).

- [ ] **Step 3: Add scoring constants and helpers above the `/recommended-places` route in `main.py`**

Find the comment `# RECOMMENDED PLACES — LLM picks with persona + behaviour signals` (line ~1232). Insert this block immediately before it:

```python
# ── Persona scoring engine ─────────────────────────────────────────────────
_ARCHETYPE_AFFINITY: dict[str, dict[str, float]] = {
    'wanderer':      {'park': 0.9, 'historic': 0.8, 'museum': 0.7, 'tourism': 0.6, 'viewpoint': 0.8},
    'historian':     {'historic': 0.9, 'museum': 0.9, 'tourism': 0.7, 'gallery': 0.7, 'library': 0.6},
    'epicurean':     {'restaurant': 0.9, 'cafe': 0.8, 'bar': 0.7, 'market': 0.8, 'bakery': 0.7},
    'pulse':         {'nightlife': 0.9, 'bar': 0.8, 'restaurant': 0.7, 'stadium': 0.7},
    'slowtraveller': {'cafe': 0.9, 'park': 0.8, 'museum': 0.7, 'gallery': 0.7, 'spa': 0.6},
    'voyager':       {'tourism': 0.9, 'viewpoint': 0.9, 'park': 0.8, 'historic': 0.7, 'beach': 0.8},
    'explorer':      {'park': 0.9, 'beach': 0.8, 'viewpoint': 0.8, 'historic': 0.7, 'amusement_park': 0.6},
}

def _score_place(place: dict, archetype: str, all_filters: list[str]) -> float:
    cat = place.get("category", "")
    rating = place.get("rating")
    affinity   = _ARCHETYPE_AFFINITY.get(archetype, {}).get(cat, 0.0)
    filter_hit = 1.0 if cat in all_filters else 0.0
    rating_val = (min(float(rating), 5.0) / 5.0) if rating else 0.5
    return affinity * 0.5 + filter_hit * 0.3 + rating_val * 0.2

def _pick_reason(archetype: str, category: str, all_filters: list[str], score: float) -> str:
    if category in all_filters:
        label = category.replace("_", " ")
        return f"Matches your taste for {label}s"
    affinity = _ARCHETYPE_AFFINITY.get(archetype, {}).get(category, 0.0)
    if affinity >= 0.8:
        label = category.replace("_", " ")
        return f"A top pick for {archetype} travellers — great {label}"
    if score >= 0.7:
        return "Highly rated and well suited to your style"
    return "A solid pick for your travel style"
```

- [ ] **Step 4: Replace the `/recommended-places` endpoint body**

Replace the entire function body of `recommended_places_endpoint` (lines ~1235–1338) with:

```python
@app.post("/recommended-places")
def recommended_places_endpoint(body: dict):
    """Score map places by persona affinity. No LLM — deterministic engine."""
    archetype   = body.get("persona_archetype", "explorer").lower()
    venue_filters   = [v.lower() for v in body.get("venue_filters", [])]
    itinerary_bias  = [v.lower() for v in body.get("itinerary_bias", [])]
    places          = body.get("places", [])

    if not places:
        return {"picks": []}

    all_filters = list(set(venue_filters + itinerary_bias))
    non_events  = [p for p in places if p.get("category") != "event"]

    scored = sorted(
        [(p, _score_place(p, archetype, all_filters)) for p in non_events],
        key=lambda x: x[1],
        reverse=True,
    )

    picks = []
    for p, s in scored[:15]:
        picks.append({
            "id":       p.get("id", ""),
            "title":    p.get("title", ""),
            "category": p.get("category", "place"),
            "lat":      p.get("lat", 0),
            "lon":      p.get("lon", 0),
            "whyRec":   _pick_reason(archetype, p.get("category", ""), all_filters, s),
            "signal":   "persona",
        })

    return {"picks": picks}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_recommended_places.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add main.py tests/test_recommended_places.py
git commit -m "feat: replace LLM in /recommended-places with deterministic persona scoring engine"
```

---

### Task 2: Remove Pro gate from `/api/cities/picks` and add Eventbrite to `/events`

**Files:**
- Modify: `main.py` (line 2578 — `cities_picks`; lines 1550–1715 — `events`)
- Test: `tests/test_events_endpoint.py` (modify — add Eventbrite tests)

Context: Two small backend changes. `cities_picks` just needs one parameter removed. `events` gets a `_fetch_eventbrite()` helper that runs in parallel with the Ticketmaster call, then merges using the same title-dedup pattern already used for Yelp. `EVENTBRITE_API_KEY` is already in the environment.

- [ ] **Step 1: Write failing test for Eventbrite merge**

Append to `tests/test_events_endpoint.py`:

```python
def make_eventbrite_response(event_name="Art Fair", lat=35.69, lon=139.70):
    return {
        "events": [{
            "id": "eb-999",
            "name": {"text": event_name},
            "start": {"local": "2026-06-02T10:00:00"},
            "url": "https://eventbrite.com/e/999",
            "logo": {"url": "https://example.com/art.jpg"},
            "venue": {
                "name": "Tokyo Forum",
                "address": {"localized_address_display": "3-5-1 Marunouchi, Tokyo"},
                "latitude": str(lat),
                "longitude": str(lon),
            },
            "category_id": "105",
        }]
    }

def test_events_merges_eventbrite(client):
    """Eventbrite events appear in results when EVENTBRITE_API_KEY is set."""
    def fake_get(url, **kwargs):
        mock = MagicMock()
        mock.status_code = 200
        if "ticketmaster" in url:
            mock.json.return_value = {"_embedded": {"events": []}}
        elif "eventbriteapi" in url:
            mock.json.return_value = make_eventbrite_response()
        return mock

    with patch("requests.get", side_effect=fake_get), \
         patch.object(m, "TICKETMASTER_KEY", "fake_key"), \
         patch.object(m, "EVENTBRITE_API_KEY", "fake_eb"), \
         patch.object(m, "YELP_API_KEY", ""):
        r = client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        assert r.status_code == 200
        places = r.json()["places"]
        assert any("Art Fair" in p["title"] for p in places)

def test_events_deduplicates_across_sources(client):
    """Same event title from Ticketmaster and Eventbrite appears only once."""
    def fake_get(url, **kwargs):
        mock = MagicMock()
        mock.status_code = 200
        if "ticketmaster" in url:
            mock.json.return_value = make_tm_response("Jazz Night")
        elif "eventbriteapi" in url:
            mock.json.return_value = make_eventbrite_response("Jazz Night")
        return mock

    with patch("requests.get", side_effect=fake_get), \
         patch.object(m, "TICKETMASTER_KEY", "fake_key"), \
         patch.object(m, "EVENTBRITE_API_KEY", "fake_eb"), \
         patch.object(m, "YELP_API_KEY", ""):
        r = client.get("/events?city=Tokyo&start_date=2026-06-01&end_date=2026-06-08")
        places = r.json()["places"]
        jazz_nights = [p for p in places if p["title"] == "Jazz Night"]
        assert len(jazz_nights) == 1
```

- [ ] **Step 2: Run to verify fail**

```bash
pytest tests/test_events_endpoint.py::test_events_merges_eventbrite tests/test_events_endpoint.py::test_events_deduplicates_across_sources -v
```

Expected: FAIL — `AttributeError` or assertion error because `EVENTBRITE_API_KEY` attribute doesn't exist on `m` and Eventbrite fetch isn't implemented.

- [ ] **Step 3: Remove `require_pro` from `cities_picks`**

Find line 2578:
```python
async def cities_picks(city_id: str, _user=Depends(require_pro)):
```
Change to:
```python
async def cities_picks(city_id: str):
```

- [ ] **Step 4: Add `EVENTBRITE_API_KEY` constant near the other API key constants in `main.py`**

Find where `TICKETMASTER_KEY` is assigned (search for `TICKETMASTER_KEY = os.environ`). Add immediately after it:

```python
EVENTBRITE_API_KEY = os.environ.get("EVENTBRITE_API_KEY", "")
```

- [ ] **Step 5: Add `_fetch_eventbrite()` helper before the `/events` route**

Insert this function immediately before `@app.get("/events")` (line ~1550):

```python
def _fetch_eventbrite(
    city: str, start_date: str, end_date: str,
    lat: float | None, lon: float | None,
) -> list[dict]:
    if not EVENTBRITE_API_KEY:
        return []
    params: dict = {
        "q":                        city,
        "start_date.range_start":   f"{start_date}T00:00:00",
        "start_date.range_end":     f"{end_date}T23:59:59",
        "expand":                   "venue",
        "page_size":                20,
    }
    if lat is not None and lon is not None:
        params["location.latitude"]  = lat
        params["location.longitude"] = lon
        params["location.within"]    = "10km"
    try:
        r = requests.get(
            "https://www.eventbriteapi.com/v3/events/search/",
            params=params,
            headers={"Authorization": f"Bearer {EVENTBRITE_API_KEY}"},
            timeout=8,
        )
        r.raise_for_status()
        return r.json().get("events", [])
    except Exception as e:
        print(f"EVENTS Eventbrite error (non-fatal): {e}")
        return []
```

- [ ] **Step 6: Merge Eventbrite results inside the `/events` handler**

Inside the `events()` function, find the block that ends with `# ── Yelp Events (merged in if key is configured) ──` (line ~1644). Add a new Eventbrite merge block after the Yelp block (before the `print(f"EVENTS: ...")` line at ~1709):

```python
        # ── Eventbrite Events ──
        eb_raw = _fetch_eventbrite(city, start_date, end_date, lat, lon)
        existing_titles = {p["title"].lower() for p in places}
        for ev in eb_raw:
            venue = ev.get("venue") or {}
            try:
                ev_lat = float(venue.get("latitude") or 0)
                ev_lon = float(venue.get("longitude") or 0)
            except (TypeError, ValueError):
                continue
            if ev_lat == 0 and ev_lon == 0:
                continue
            name = (ev.get("name") or {}).get("text", "Event")
            if name.lower() in existing_titles:
                continue
            existing_titles.add(name.lower())
            start_local = (ev.get("start") or {}).get("local", "")
            event_date = start_local[:10] if start_local else start_date
            event_time = start_local[11:16] if len(start_local) > 10 else ""
            logo = ev.get("logo") or {}
            places.append({
                "id":       f"eb-{ev.get('id', '')}",
                "title":    name,
                "lat":      ev_lat,
                "lon":      ev_lon,
                "category": "event",
                "imageUrl": logo.get("url"),
                "tags": {
                    "event_date": event_date,
                    "event_time": event_time,
                    "venue":      venue.get("name", ""),
                    "genre":      "",
                    "website":    ev.get("url", ""),
                },
            })
        print(f"EVENTS (Eventbrite): added {len(eb_raw)} raw events")
```

- [ ] **Step 7: Run all event tests**

```bash
pytest tests/test_events_endpoint.py -v
```

Expected: all tests PASS including the two new Eventbrite tests.

- [ ] **Step 8: Commit**

```bash
git add main.py tests/test_events_endpoint.py
git commit -m "feat: add Eventbrite to /events, remove Pro gate from /api/cities/picks"
```

---

### Task 3: New `RecoPlacesPinsLayer` frontend component

**Files:**
- Create: `frontend/src/modules/map/RecoPlacesPinsLayer.tsx`
- Create: `frontend/src/modules/map/RecoPlacesPinsLayer.test.tsx`

Context: Amber sparkle pins for persona-picked places. Follows the exact same pattern as `OurPicksPinsLayer.tsx`. Pin: 24px circle, `linear-gradient(135deg, #f59e0b, #d97706)` background, `auto_awesome` Material Symbol icon. Prop interface takes `Place[]` (not `PlacePickFE[]`) because reco places come from the existing `Place` type.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/RecoPlacesPinsLayer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecoPlacesPinsLayer } from './RecoPlacesPinsLayer'
import type { Place } from '../../shared/types'

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children, latitude, longitude }: any) => (
    <div data-testid="reco-marker" data-lat={latitude} data-lon={longitude}>{children}</div>
  ),
}))

const places: Place[] = [
  { id: 'r1', title: 'Blue Bottle', category: 'cafe', lat: 35.67, lon: 139.70,
    tags: {}, reason: 'Matches your taste for cafes', reasonSignal: 'persona' },
  { id: 'r2', title: 'Senso-ji',   category: 'historic', lat: 35.71, lon: 139.79,
    tags: {}, reason: 'Top pick for historians', reasonSignal: 'persona' },
]

describe('RecoPlacesPinsLayer', () => {
  it('renders one marker per place', () => {
    render(<RecoPlacesPinsLayer places={places} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getAllByTestId('reco-marker')).toHaveLength(2)
  })

  it('renders nothing when places is empty', () => {
    render(<RecoPlacesPinsLayer places={[]} activePinId={null} onPinClick={() => {}} />)
    expect(screen.queryAllByTestId('reco-marker')).toHaveLength(0)
  })

  it('calls onPinClick with place id when marker is clicked', () => {
    const spy = vi.fn()
    render(<RecoPlacesPinsLayer places={places} activePinId={null} onPinClick={spy} />)
    screen.getAllByTestId('reco-marker')[0].click()
    expect(spy).toHaveBeenCalledWith('r1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/RecoPlacesPinsLayer.test.tsx
```

Expected: FAIL — `Cannot find module './RecoPlacesPinsLayer'`.

- [ ] **Step 3: Create `RecoPlacesPinsLayer.tsx`**

```tsx
import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'

const RECO_PIN_BG = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
const PIN_SIZE    = 24

interface Props {
  places:      Place[]
  activePinId: string | null
  onPinClick:  (placeId: string) => void
}

export function RecoPlacesPinsLayer({ places, activePinId, onPinClick }: Props) {
  return (
    <>
      {places.map(place => {
        const isActive = activePinId === place.id
        const size     = isActive ? PIN_SIZE + 4 : PIN_SIZE
        return (
          <Marker
            key={place.id}
            latitude={place.lat}
            longitude={place.lon}
            anchor="center"
            onClick={() => onPinClick(place.id)}
          >
            <div
              style={{
                width: size, height: size, borderRadius: '50%',
                background: RECO_PIN_BG,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isActive
                  ? '0 0 0 3px rgba(245,158,11,.5), 0 4px 12px rgba(0,0,0,.4)'
                  : '0 2px 8px rgba(0,0,0,.35)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                opacity: isActive ? 1 : 0.92,
              }}
            >
              <span
                className="ms fill"
                style={{ fontSize: 13, color: '#0c0c0e', userSelect: 'none' }}
              >
                auto_awesome
              </span>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/modules/map/RecoPlacesPinsLayer.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/RecoPlacesPinsLayer.tsx frontend/src/modules/map/RecoPlacesPinsLayer.test.tsx
git commit -m "feat: add RecoPlacesPinsLayer — amber sparkle pins for persona picks"
```

---

### Task 4: Pass `places` in `api.recommendedPlaces()` and `useMap.loadRecommended()`

**Files:**
- Modify: `frontend/src/shared/api.ts` (lines 213–228)
- Modify: `frontend/src/modules/map/useMap.ts` (lines 69–94)

Context: The new backend endpoint requires `places` in the request body so it can score real map places. We add `places: Place[]` to the `recommendedPlaces` params type in `api.ts` and pass `places` (the current state value) in `useMap.ts`'s `loadRecommended()` call.

- [ ] **Step 1: Update `api.ts` — add `places` to `recommendedPlaces` params**

In `frontend/src/shared/api.ts`, replace lines 213–228:

```ts
  recommendedPlaces: (params: {
    city: string;
    personaArchetype: string;
    personaDesc: string;
    venueFilters: string[];
    itineraryBias: string[];
    viewedCategories: string[];
  }) =>
    post<{ picks: Place[] }>('/recommended-places', {
      city: params.city,
      persona_archetype: params.personaArchetype,
      persona_desc: params.personaDesc,
      venue_filters: params.venueFilters,
      itinerary_bias: params.itineraryBias,
      viewed_categories: params.viewedCategories,
    }),
```

With:

```ts
  recommendedPlaces: (params: {
    city: string;
    personaArchetype: string;
    venueFilters: string[];
    itineraryBias: string[];
    places: Place[];
  }) =>
    post<{ picks: Place[] }>('/recommended-places', {
      city:             params.city,
      persona_archetype: params.personaArchetype,
      venue_filters:    params.venueFilters,
      itinerary_bias:   params.itineraryBias,
      places:           params.places,
    }),
```

- [ ] **Step 2: Update `useMap.ts` — pass `places` in `loadRecommended()`**

In `frontend/src/modules/map/useMap.ts`, replace the `api.recommendedPlaces({...})` call (lines 73–80):

```ts
      const result = await api.recommendedPlaces({
        city,
        personaArchetype: persona.archetype,
        personaDesc: persona.archetype_desc ?? '',
        venueFilters: persona.venue_filters ?? [],
        itineraryBias: persona.itinerary_bias ?? [],
        viewedCategories: [...viewedCategoriesRef.current],
      });
```

With:

```ts
      const result = await api.recommendedPlaces({
        city,
        personaArchetype: persona.archetype,
        venueFilters:     persona.venue_filters ?? [],
        itineraryBias:    persona.itinerary_bias ?? [],
        places,
      });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run existing useMap tests**

```bash
npx vitest run src/modules/map/useMap.test.ts
```

Expected: all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/api.ts frontend/src/modules/map/useMap.ts
git commit -m "feat: pass map places to /recommended-places — enables scoring real pins"
```

---

### Task 5: Wire `RecoPlacesPinsLayer` into `MapScreen`, fix `eventsLoaded` dead code

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

Context: Three changes in `MapScreen.tsx`:
1. Import and render `RecoPlacesPinsLayer` inside the `activeFilter === 'curated'` block (alongside existing `OurPicksPinsLayer` and `LiveEventPinsLayer`).
2. Remove the `const [, setEventsLoaded] = useState(false)` dead state and its three call sites.
3. The `recommendedPlaces` array is already returned by `useMap()` — just destructure it and pass it to the new layer.

- [ ] **Step 1: Add the import**

In `MapScreen.tsx`, find the import block for pin layers (lines 29–31):

```ts
import { OurPicksPinsLayer } from './OurPicksPinsLayer'
import type { PlacePickFE } from './OurPicksPinsLayer'
import { LiveEventPinsLayer } from './LiveEventPinsLayer'
```

Add `RecoPlacesPinsLayer`:

```ts
import { OurPicksPinsLayer } from './OurPicksPinsLayer'
import type { PlacePickFE } from './OurPicksPinsLayer'
import { LiveEventPinsLayer } from './LiveEventPinsLayer'
import { RecoPlacesPinsLayer } from './RecoPlacesPinsLayer'
```

- [ ] **Step 2: Destructure `recommendedPlaces` from `useMap()`**

Find where `useMap()` is destructured (search for `const {` near `city, cityGeo, places`). Add `recommendedPlaces` to the destructure:

```ts
const {
  city, cityGeo, places, filteredPlaces, recommendedPlaces,
  selectedPlaces, activeFilter, loading, error,
  loadPlaces, activePlace, setActivePlace,
  togglePlace, setFilter, trackViewedCategory,
  goToRoute, goBack,
} = useMap(activeCategories)
```

- [ ] **Step 3: Remove `eventsLoaded` dead state**

Find line 147:
```ts
const [, setEventsLoaded]         = useState(false);
```
Delete this line entirely.

Then find and remove the three `setEventsLoaded(...)` call sites:
- Line ~272: `setEventsLoaded(false)` inside the cleanup/early-return block
- Line ~299: `setEventsLoaded(true)` inside the `.then()` success block
- Line ~305: `setEventsLoaded(false)` inside the `.catch()` block

- [ ] **Step 4: Render `RecoPlacesPinsLayer` in the curated block**

Find the curated rendering block (around line 416):

```tsx
          <OurPicksPinsLayer
            picks={ourPicks}
            activePinId={activePlace?.id ?? null}
            onPinClick={...}
          />
```

Add `RecoPlacesPinsLayer` immediately before `OurPicksPinsLayer`:

```tsx
          <RecoPlacesPinsLayer
            places={recommendedPlaces}
            activePinId={activePlace?.id ?? null}
            onPinClick={(id) => {
              const p = recommendedPlaces.find(r => r.id === id)
              if (p) setActivePlace(p)
            }}
          />
          <OurPicksPinsLayer
            picks={ourPicks}
            activePinId={activePlace?.id ?? null}
            onPinClick={...}
          />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run full frontend test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: render RecoPlacesPinsLayer on curated tab, remove eventsLoaded dead state"
```

---

### Task 6: Remove curated lock from `FilterBar`

**Files:**
- Modify: `frontend/src/modules/map/FilterBar.tsx`
- Modify: `frontend/src/modules/map/MapScreen.tsx` (remove props passed to FilterBar)
- Test: `frontend/src/modules/map/FilterBar.test.tsx` (update)

Context: Remove `curatedLocked` and `onLockedTap` entirely from `FilterBar`. The curated chip always calls `onSelect('curated')` and always renders with the "unlocked" style. Also remove the `isCurationLocked` import from `MapScreen`.

- [ ] **Step 1: Update the FilterBar test to assert no lock icon**

In `frontend/src/modules/map/FilterBar.test.tsx`, find any test that renders `FilterBar`. Update the render call to remove `curatedLocked` and `onLockedTap`. Add a test:

```tsx
it('curated chip is always tappable — no lock icon', () => {
  render(
    <FilterBar
      active="all"
      activeCategories={[]}
      allCount={10}
      curatedCount={3}
      categoryCounts={{}}
      onSelect={() => {}}
      onCategoriesSelect={() => {}}
    />
  )
  expect(screen.queryByText('lock')).toBeNull()
})
```

- [ ] **Step 2: Run to verify the new test fails (and existing renders break due to prop change)**

```bash
npx vitest run src/modules/map/FilterBar.test.tsx
```

Expected: FAIL — TypeScript error because `curatedLocked` is still required in the Props interface.

- [ ] **Step 3: Update `FilterBar.tsx` Props interface**

Remove `curatedLocked: boolean` and `onLockedTap: () => void` from the `Props` interface (lines 25, 29).

Update the destructure on line 32–35 to remove them:

```ts
export function FilterBar({
  active, activeCategories, allCount, curatedCount,
  categoryCounts, onSelect, onCategoriesSelect,
}: Props) {
```

- [ ] **Step 4: Update the curated button in `FilterBar.tsx`**

Replace the curated button (lines 92–122) with the unlocked-only version:

```tsx
        <button
          onClick={() => { onSelect('curated'); setExpanded(false) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', height: 28, borderRadius: 999,
            background: active === 'curated' ? 'var(--color-primary-bg)' : 'rgba(15,20,30,.82)',
            border: active === 'curated'
              ? '1px solid var(--color-primary)'
              : '1px solid rgba(212,168,83,.3)',
            color: active === 'curated'
              ? 'var(--color-primary)'
              : 'var(--color-primary-text)',
            fontSize: '0.75rem', fontWeight: 700,
            backdropFilter: 'blur(8px)', cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 11 }}>✦</span>
          Curated
          {curatedCount > 0 && (
            <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>· {curatedCount}</span>
          )}
        </button>
```

- [ ] **Step 5: Remove lock props from `MapScreen.tsx`**

In `MapScreen.tsx`:

Remove the import of `isCurationLocked`:
```ts
import { isCurationLocked } from '../../shared/tier';
```

Remove `curatedLocked` and `onLockedTap` from the `<FilterBar ... />` JSX (around line 481):
```tsx
curatedLocked={isCurationLocked(state)}
...
onLockedTap={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
```

- [ ] **Step 6: Run full frontend test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/modules/map/FilterBar.tsx frontend/src/modules/map/FilterBar.test.tsx frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: remove curated lock gate — curated tab always accessible"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/recommended-places` → scoring engine: Task 1
- ✅ Remove `require_pro` from `/api/cities/picks`: Task 2
- ✅ Add Eventbrite to `/events`: Task 2
- ✅ New `RecoPlacesPinsLayer`: Task 3
- ✅ Pass `places` in api call: Task 4
- ✅ Wire layer into MapScreen: Task 5
- ✅ Fix `eventsLoaded` dead code: Task 5
- ✅ Remove `isCurationLocked` from FilterBar: Task 6

**Type consistency:**
- `Place` type used consistently for `RecoPlacesPinsLayer.places` and `api.recommendedPlaces.params.places`
- `recommendedPlaces: Place[]` returned by `useMap()` matches `RecoPlacesPinsLayer` prop type
- `_score_place` and `_pick_reason` defined in Task 1 before they are used in the endpoint

**On-demand seeding note:** When a user taps Curated on a new city, `OurPicksPinsLayer` calls `/api/cities/picks?city_id=...`. If that city has no `insert_candidates` yet, the on-demand seeder in `city/on_demand_seeder.py` fires automatically and seeds the city in ~3–4 seconds. No action required in this plan — the seeder is already wired in.
