# Curated Tab Design

## Goal

Make the curated tab show three layers of real, always-available content: persona-matched place picks (deterministic scoring engine — no LLM), trending/hidden gem picks (OurPicks from Supabase, on-demand seeded), and live events (Ticketmaster + Eventbrite in parallel). Remove all Pro gates for now (tier redesign is a separate discussion).

## Architecture

Three independent pin layers render simultaneously on the map when `activeFilter === 'curated'`. Each has its own component, its own data source, and fails independently. The reco engine and OurPicks are fully self-contained (Supabase + in-memory scoring). Events are external but degrade gracefully.

```
Curated tab
├── RecoPlacesPinsLayer    ← scoring engine (no LLM, no seeding, always works)
├── OurPicksPinsLayer      ← Supabase city_data (on-demand seeded, 3-4s first load)
└── LiveEventPinsLayer     ← Ticketmaster + Eventbrite parallel fetch
```

---

## Backend Changes

### 1. Replace LLM in `/recommended-places` with scoring engine

**Current problem:** The endpoint calls Claude Haiku to hallucinate place names and coordinates. This is unreliable, slow, costs money per session, and invents places that may not exist.

**New approach:** Score the places already loaded on the map (real OSM data, verified coordinates) using a deterministic engine. No external API calls.

**Scoring formula (per place):**

```
score = category_affinity(archetype, place.category)  × 0.5
      + venue_filter_match(venue_filters, place.category) × 0.3
      + rating_score(place.rating)                        × 0.2
```

**Archetype → category affinity table (new constant in main.py):**

```python
ARCHETYPE_CATEGORY_AFFINITY: dict[str, dict[str, float]] = {
    'wanderer':     {'park': 0.9, 'historic': 0.8, 'museum': 0.7, 'tourism': 0.6, 'viewpoint': 0.8},
    'historian':    {'historic': 0.9, 'museum': 0.9, 'tourism': 0.7, 'gallery': 0.7, 'library': 0.6},
    'epicurean':    {'restaurant': 0.9, 'cafe': 0.8, 'bar': 0.7, 'market': 0.8, 'bakery': 0.7},
    'pulse':        {'nightlife': 0.9, 'bar': 0.8, 'restaurant': 0.7, 'stadium': 0.7},
    'slowtraveller':{'cafe': 0.9, 'park': 0.8, 'museum': 0.7, 'gallery': 0.7, 'spa': 0.6},
    'voyager':      {'tourism': 0.9, 'viewpoint': 0.9, 'park': 0.8, 'historic': 0.7, 'beach': 0.8},
    'explorer':     {'park': 0.9, 'beach': 0.8, 'viewpoint': 0.8, 'historic': 0.7, 'amusement_park': 0.6},
}
```

**`rating_score`:** `min(rating, 5.0) / 5.0` if rating exists, else `0.5` (neutral).

**`venue_filter_match`:** `1.0` if `place.category` appears in `venue_filters` or `itinerary_bias` after mapping through `VENUE_TO_CATEGORY`, else `0.0`.

**Reason text (rule-based, no LLM):**

```python
def _reason(archetype: str, place_category: str, venue_filters: list[str], score: float) -> str:
    if place_category in venue_filters:
        return f"Matches your taste for {place_category.replace('_', ' ')}s"
    affinity = ARCHETYPE_CATEGORY_AFFINITY.get(archetype, {}).get(place_category, 0)
    if affinity >= 0.8:
        label = place_category.replace('_', ' ')
        return f"A top pick for {archetype} travellers — great {label}"
    if score >= 0.7:
        return "Highly rated and well suited to your style"
    return "A solid pick for your travel style"
```

**New endpoint behaviour:**

```python
@app.post("/recommended-places")
def recommended_places_endpoint(body: dict):
    city              = body.get("city", "")
    archetype         = body.get("persona_archetype", "explorer").lower()
    venue_filters     = [v.lower() for v in body.get("venue_filters", [])]
    itinerary_bias    = [v.lower() for v in body.get("itinerary_bias", [])]
    places            = body.get("places", [])   # ← NEW: caller sends map places

    if not places:
        return {"picks": []}

    all_filters = list(set(venue_filters + itinerary_bias))
    affinity_table = ARCHETYPE_CATEGORY_AFFINITY.get(archetype, {})

    def score_place(p: dict) -> float:
        cat = p.get("category", "")
        rating = p.get("rating") or None
        cat_score   = affinity_table.get(cat, 0.0)
        filter_score = 1.0 if cat in all_filters else 0.0
        rating_score = (min(float(rating), 5.0) / 5.0) if rating else 0.5
        return cat_score * 0.5 + filter_score * 0.3 + rating_score * 0.2

    scored = [(p, score_place(p)) for p in places if p.get("category") != "event"]
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:15]

    picks = []
    for p, s in top:
        picks.append({
            "id":       p.get("id", ""),
            "title":    p.get("title", ""),
            "category": p.get("category", "place"),
            "lat":      p.get("lat", 0),
            "lon":      p.get("lon", 0),
            "whyRec":   _reason(archetype, p.get("category", ""), all_filters, s),
            "signal":   "persona",
        })

    return {"picks": picks}
```

**Frontend call site change (`api.ts`):** Add `places` to the request body — pass the current map places array so the backend scores real, verified places.

### 2. Remove `require_pro` from `/api/cities/picks`

Remove the `_user=Depends(require_pro)` parameter. The endpoint becomes:

```python
@app.get("/api/cities/picks", response_model=list[PlacePick])
async def cities_picks(city_id: str):
```

### 3. Add Eventbrite as parallel event source in `/events`

Fetch Ticketmaster and Eventbrite in parallel using `concurrent.futures.ThreadPoolExecutor`. Merge results and deduplicate on a `(title_slug, date)` fingerprint.

**Eventbrite API call:**

```python
EVENTBRITE_URL = "https://www.eventbriteapi.com/v3/events/search/"

def _fetch_eventbrite(city: str, start_date: str, end_date: str, lat: float | None, lon: float | None) -> list[dict]:
    token = os.environ.get("EVENTBRITE_API_KEY", "")
    if not token:
        return []
    params = {
        "q": city,
        "start_date.range_start": f"{start_date}T00:00:00",
        "start_date.range_end":   f"{end_date}T23:59:59",
        "expand": "venue",
        "page_size": 20,
    }
    if lat and lon:
        params["location.latitude"]  = lat
        params["location.longitude"] = lon
        params["location.within"]    = "10km"
    r = requests.get(EVENTBRITE_URL, params=params,
                     headers={"Authorization": f"Bearer {token}"}, timeout=8)
    r.raise_for_status()
    return r.json().get("events", [])
```

**Dedup fingerprint:**

```python
def _fingerprint(title: str, date: str) -> str:
    import re
    slug = re.sub(r"[^a-z0-9]", "", title.lower())[:30]
    return f"{slug}_{date}"
```

---

## Frontend Changes

### 4. New `RecoPlacesPinsLayer` component

**File:** `frontend/src/modules/map/RecoPlacesPinsLayer.tsx`

Pin style: warm amber gradient (`linear-gradient(135deg, #f59e0b, #d97706)`), `auto_awesome` icon (Material Symbols), size 24px. Distinct from OurPicks (which uses the same gradient but with badge pills) — reco pins have no badge, just the sparkle icon.

```tsx
interface Props {
  places: Place[]
  activePinId: string | null
  onPinClick: (placeId: string) => void
}
```

Renders a `Marker` per place. On click: calls `onPinClick(place.id)`.

### 5. Wire `recommendedPlaces` to MapScreen curated layer

In `MapScreen.tsx`:

- Add `recommendedPlaces` from `useMap()` (already returned by the hook)
- Dedup: filter `recommendedPlaces` to exclude any `id` already in `ourPicks` (by `place_id`)
- Render `<RecoPlacesPinsLayer>` inside the `activeFilter === 'curated'` block alongside existing layers

### 6. Pass `places` in `api.recommendedPlaces()` call

In `api.ts`, the `recommendedPlaces` call adds `places` to the request body:

```ts
recommendedPlaces: (params) =>
  post('/recommended-places', { ...params, places: params.places })
```

Update `useMap.ts` to pass the current `places` array in the call.

### 7. Remove `isCurationLocked()` gate

In `FilterBar.tsx`: remove the lock check. The curated chip always calls `onSelect('curated')` regardless of tier. Remove the lock icon from the chip.

In `tier.ts`: `isCurationLocked` can stay as-is for when tier redesign happens — just stop calling it from FilterBar.

### 8. Fix `eventsLoaded` dead code

In `MapScreen.tsx` line 147: change `const [, setEventsLoaded] = useState(false)` to remove the setter — it's called in three places but never read. Remove all three `setEventsLoaded(...)` call sites.

---

## Data Flow at Runtime

```
User taps Curated
│
├── RecoPlacesPinsLayer
│   └── useMap calls /recommended-places with places[] already in memory
│       → scores in-memory, returns top 15 in <50ms, no external call
│
├── OurPicksPinsLayer
│   └── MapScreen fetches /api/cities/picks?city_id=...
│       → Supabase city_data lookup
│       → if city not seeded: on_demand_seeder runs (~3-4s first time, instant after)
│
└── LiveEventPinsLayer
    └── api.events() — Ticketmaster + Eventbrite fetched in parallel
        → merged, deduped, returned
        → if both fail: events layer silently hides, other two unaffected
```

---

## What's Not In This Spec

- Tier redesign (Pro/free gate logic) — separate discussion
- `place_dynamic_profiles` population (trending/hidden gem badges) — V2, pipeline not yet built
- Admin seeding UI — not needed; on-demand seeder handles it automatically
