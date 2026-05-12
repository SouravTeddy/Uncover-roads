# Google Places + MapLibre Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Add Google Places API for autocomplete + rich place details — calling Google only on explicit user actions. (2) Replace Leaflet with MapLibre GL JS + OpenFreeMap tiles for better rendering at zero extra cost.

**Architecture:** MapLibre GL JS (via react-map-gl) replaces Leaflet for WebGL-based map rendering using free OpenFreeMap tiles (no token, no cost); Overpass API continues to supply bulk POI data for free; Google Places Autocomplete replaces Nominatim for city search using session tokens (keystrokes free); Google Place Details fetched only on explicit pin tap and cached in Supabase for 24hrs. All Google API calls proxied through FastAPI backend to protect the key.

**Tech Stack:** react-map-gl v7 + maplibre-gl, OpenFreeMap tiles (free, no token), Google Maps Platform (Places API), FastAPI backend proxy, Supabase (place details cache), OSRM (routing — unchanged)

---

## Current State → Target State

| Concern | Current | After This Plan |
|---|---|---|
| Map renderer | Leaflet / react-leaflet | MapLibre GL JS + OpenFreeMap tiles |
| City search | Nominatim (OSM) | Google Places Autocomplete |
| POI data | Overpass API | Overpass API (unchanged — free) |
| Place details | OSM tags only | Google Place Details (cached 24hr) |
| Routing | OSRM | OSRM (unchanged — free), displayed as GeoJSON layer |
| Geocoding | Nominatim | Google Geocoding via Place Details |

---

## Cost Model

### Google API Pricing

| API | Price | When Called |
|---|---|---|
| Places Autocomplete (with session token) | **FREE** per keystroke | User types in search box |
| Place Details (ends session) | $17/1,000 = **$0.017** | User selects autocomplete result |
| Find Place (resolve place_id from name+coords) | $17/1,000 = **$0.017** | User taps a pin (first time — cached after) |
| Place Details (on tap) | $17/1,000 = **$0.017** | User taps a pin (first time — cached after) |

### MapLibre + OpenFreeMap — $0 (completely free, no token)

### Realistic Monthly Cost Estimates

| Monthly Active Users | Google Cost | Net (after $200 credit) |
|---|---|---|
| 500 | ~$85 | **$0** (within credit) |
| 1,000 | ~$170 | **$0** (within credit) |
| 2,000 | ~$340 | **~$140** |
| 5,000 | ~$850 | **~$650** |
| 10,000 | ~$1,700 | **~$1,500** |

Assumptions: 2 city searches + 4 unique pin taps per user per month. Cache hit rate ~60% at scale reduces this by ~30%.

### Cost Control Rules (enforced in code)
1. Session tokens on all Autocomplete → keystrokes are free
2. Place Details cached in Supabase 24hr TTL
3. In-memory cache prevents repeat Google calls for same pin in same session
4. Google never called on map pan/zoom/filter change
5. Overpass continues supplying bulk POI (free, unlimited)

---

## File Map

### New Files
- `frontend/src/modules/destination/useGoogleCitySearch.ts` — Google Places Autocomplete with session tokens
- `frontend/src/modules/map/usePlaceDetails.ts` — fetch + cache Google Place Details on pin tap
- `frontend/src/modules/map/MapLibreMap.tsx` — MapLibre GL JS map component (replaces Leaflet `<MapContainer>`)
- `frontend/src/modules/map/MapLibreMarkers.tsx` — custom markers as MapLibre `<Marker>` components
- `frontend/src/modules/map/MapLibreRoute.tsx` — OSRM route as GeoJSON layer on MapLibre

### Modified Files
- `frontend/package.json` — add react-map-gl, maplibre-gl; remove react-leaflet, leaflet
- `frontend/src/main.tsx` — add maplibre-gl CSS import
- `frontend/src/shared/types.ts` — add `AutocompleteResult`, `PlaceDetails` types
- `frontend/src/shared/api.ts` — add `placesAutocomplete()`, `geocodePlace()`, `placeDetails()`, `findPlaceId()`
- `frontend/src/modules/destination/CitySearch.tsx` — use Google Autocomplete
- `frontend/src/modules/destination/useCitySearch.ts` — delegate to `useGoogleCitySearch`
- `frontend/src/modules/map/PinCard.tsx` — display Google Place Details (rating, hours, phone, website)
- `frontend/src/modules/map/MapScreen.tsx` — swap Leaflet for MapLibreMap, wire `usePlaceDetails`
- `frontend/src/modules/map/useMapMove.ts` — remove Leaflet hook refs, use MapLibre onMoveEnd callback
- `backend/main.py` — add `/places-autocomplete`, `/place-details`, `/find-place-id`, `/geocode-place` endpoints
- `backend/.env` — add `GOOGLE_PLACES_API_KEY`

### Deleted Files
- `frontend/src/modules/map/icons.ts` — Leaflet icon setup (replaced by inline marker styles in MapLibreMarkers)

### Database (Supabase)
- New table: `place_details_cache` — `place_id`, `data` (jsonb), `fetched_at` (timestamp)

---

## Task 1: Backend — Google Places Endpoints

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/.env`

- [ ] **Step 1: Get Google Places API key**

1. Go to https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Enable "Places API" under APIs & Services
4. Create an API key → restrict it to your server's IP (or leave unrestricted for dev)
5. Set a billing budget alert at $150/month in Cloud Billing

- [ ] **Step 2: Add key to backend .env**

In `/Users/souravbiswas/uncover-roads/.env`, add:
```
GOOGLE_PLACES_API_KEY=YOUR_KEY_HERE
```

- [ ] **Step 3: Add imports and constants to main.py**

Read `main.py` and add after existing imports:
```python
import uuid
from collections import defaultdict
from time import time

GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place"

# Session token store: maps session_id -> google_session_token
# Session tokens make autocomplete keystrokes FREE — only Place Details is billed
_session_tokens: dict[str, str] = {}

# Simple rate limiting: max 100 Google calls per IP per hour
_rate_limit: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 3600
RATE_LIMIT_MAX = 100

def _check_rate_limit(ip: str) -> bool:
    now = time()
    _rate_limit[ip] = [t for t in _rate_limit[ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit[ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_limit[ip].append(now)
    return True
```

- [ ] **Step 4: Add /places-autocomplete endpoint**

```python
@app.get("/places-autocomplete")
async def places_autocomplete(
    request: Request,
    input: str,
    session_id: str,
    types: str = "(cities)",
):
    """
    Google Places Autocomplete with session tokens.
    All keystrokes in a session are FREE — billing only happens at Place Details.
    types: "(cities)" for city search, "establishment" for POI search.
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"predictions": []}

    if not _check_rate_limit(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    if session_id not in _session_tokens:
        _session_tokens[session_id] = str(uuid.uuid4())
    session_token = _session_tokens[session_id]

    params = {
        "input": input,
        "types": types,
        "sessiontoken": session_token,
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/autocomplete/json", params=params, timeout=5)
        data = resp.json()
        return {
            "predictions": [
                {
                    "place_id": p["place_id"],
                    "description": p["description"],
                    "main_text": p["structured_formatting"]["main_text"],
                    "secondary_text": p["structured_formatting"].get("secondary_text", ""),
                }
                for p in data.get("predictions", [])
            ]
        }
    except Exception as e:
        return {"predictions": [], "error": str(e)}
```

- [ ] **Step 5: Add /geocode-place endpoint**

```python
@app.get("/geocode-place")
async def geocode_place(request: Request, place_id: str, session_id: str):
    """
    Get lat/lon + name from a place_id after autocomplete selection.
    This ENDS the session token (billing event: $0.017).
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"lat": None, "lon": None}

    if not _check_rate_limit(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    session_token = _session_tokens.pop(session_id, None)

    params = {
        "place_id": place_id,
        "fields": "geometry,name,formatted_address",
        "key": GOOGLE_PLACES_API_KEY,
    }
    if session_token:
        params["sessiontoken"] = session_token

    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/details/json", params=params, timeout=5)
        data = resp.json()
        result = data.get("result", {})
        loc = result.get("geometry", {}).get("location", {})
        return {
            "lat": loc.get("lat"),
            "lon": loc.get("lng"),
            "name": result.get("name"),
            "address": result.get("formatted_address"),
        }
    except Exception as e:
        return {"lat": None, "lon": None, "error": str(e)}
```

- [ ] **Step 6: Add /find-place-id endpoint**

```python
@app.get("/find-place-id")
async def find_place_id(request: Request, name: str, lat: float, lon: float):
    """
    Resolve Google place_id from an OSM place name + coordinates.
    Called once per unique pin tap — result cached client-side.
    Cost: $0.017/call (Find Place Basic Data).
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"place_id": None}

    if not _check_rate_limit(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    params = {
        "input": name,
        "inputtype": "textquery",
        "locationbias": f"point:{lat},{lon}",
        "fields": "place_id,name",
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/findplacefromtext/json", params=params, timeout=5)
        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates:
            return {"place_id": candidates[0]["place_id"], "name": candidates[0].get("name")}
        return {"place_id": None}
    except Exception as e:
        return {"place_id": None, "error": str(e)}
```

- [ ] **Step 7: Add /place-details endpoint**

```python
@app.get("/place-details")
async def place_details(request: Request, place_id: str):
    """
    Fetch Google Place Details. Cost: $0.017/call.
    No session token needed here (standalone call, not after autocomplete).
    Backend checks Supabase cache first (Task 2 wires up the cache).
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"error": "Google Places API key not configured"}

    if not _check_rate_limit(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,photos,types",
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/details/json", params=params, timeout=5)
        data = resp.json()
        result = data.get("result", {})

        photo_ref = None
        if result.get("photos"):
            photo_ref = result["photos"][0]["photo_reference"]

        return {
            "place_id": place_id,
            "name": result.get("name"),
            "address": result.get("formatted_address"),
            "lat": result.get("geometry", {}).get("location", {}).get("lat"),
            "lon": result.get("geometry", {}).get("location", {}).get("lng"),
            "rating": result.get("rating"),
            "rating_count": result.get("user_ratings_total"),
            "phone": result.get("formatted_phone_number"),
            "website": result.get("website"),
            "price_level": result.get("price_level"),
            "open_now": result.get("opening_hours", {}).get("open_now"),
            "weekday_text": result.get("opening_hours", {}).get("weekday_text", []),
            "photo_ref": photo_ref,
            "types": result.get("types", []),
        }
    except Exception as e:
        return {"error": str(e)}
```

- [ ] **Step 8: Test all endpoints**

```bash
cd /Users/souravbiswas/uncover-roads
uvicorn main:app --reload
```

```bash
# Autocomplete
curl "http://localhost:8000/places-autocomplete?input=bang&session_id=test1"
# Expected: {"predictions": [{"place_id": "...", "description": "Bangalore...", "main_text": "Bangalore", ...}]}

# Geocode (use place_id from above result)
curl "http://localhost:8000/geocode-place?place_id=ChIJbU60yXAWrjsR4E9-UejD3_g&session_id=test1"
# Expected: {"lat": 12.97..., "lon": 77.59..., "name": "Bengaluru", "address": "..."}

# Find place_id from name+coords
curl "http://localhost:8000/find-place-id?name=Vidhana+Soudha&lat=12.979&lon=77.591"
# Expected: {"place_id": "ChIJ...", "name": "Vidhana Soudha"}

# Place details
curl "http://localhost:8000/place-details?place_id=ChIJ..."
# Expected: {"place_id": "...", "name": "...", "rating": 4.5, "open_now": true, ...}
```

- [ ] **Step 9: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add main.py .env
git commit -m "feat: add Google Places autocomplete, geocode, find-place-id, place-details endpoints"
```

---

## Task 2: Supabase Cache for Place Details

**Files:**
- New SQL (run in Supabase dashboard)
- Modify: `backend/main.py`
- Modify: `backend/.env`

- [ ] **Step 1: Create cache table in Supabase**

In Supabase dashboard → SQL Editor, run:
```sql
create table if not exists place_details_cache (
  place_id text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_place_details_fetched
  on place_details_cache(fetched_at);
```

- [ ] **Step 2: Add Supabase service key to backend .env**

In `/Users/souravbiswas/uncover-roads/.env`, add:
```
SUPABASE_URL=https://wdfxpmzkctrxwziovbuy.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```
Service role key is in Supabase → Project Settings → API → service_role key.

- [ ] **Step 3: Install supabase-py**

```bash
cd /Users/souravbiswas/uncover-roads
echo "supabase" >> requirements.txt
pip install supabase
```

- [ ] **Step 4: Add Supabase client and cache logic to main.py**

After the existing imports, add:
```python
from supabase import create_client, Client as SupabaseClient
from datetime import datetime, timedelta, timezone

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

_supabase: SupabaseClient | None = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
```

- [ ] **Step 5: Update /place-details to check cache before calling Google**

Replace the existing `/place-details` endpoint body with:
```python
@app.get("/place-details")
async def place_details(request: Request, place_id: str):
    if not GOOGLE_PLACES_API_KEY:
        return {"error": "Google Places API key not configured"}

    if not _check_rate_limit(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # 1. Check Supabase cache
    if _supabase:
        try:
            cached = (
                _supabase.table("place_details_cache")
                .select("data, fetched_at")
                .eq("place_id", place_id)
                .maybe_single()
                .execute()
            )
            if cached.data:
                fetched_at = datetime.fromisoformat(cached.data["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(hours=24):
                    return cached.data["data"]  # cache hit — no Google call
        except Exception:
            pass  # cache failure is non-fatal, fall through to Google

    # 2. Cache miss — call Google
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,photos,types",
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(f"{GOOGLE_PLACES_BASE}/details/json", params=params, timeout=5)
        data = resp.json()
        result = data.get("result", {})

        photo_ref = None
        if result.get("photos"):
            photo_ref = result["photos"][0]["photo_reference"]

        details = {
            "place_id": place_id,
            "name": result.get("name"),
            "address": result.get("formatted_address"),
            "lat": result.get("geometry", {}).get("location", {}).get("lat"),
            "lon": result.get("geometry", {}).get("location", {}).get("lng"),
            "rating": result.get("rating"),
            "rating_count": result.get("user_ratings_total"),
            "phone": result.get("formatted_phone_number"),
            "website": result.get("website"),
            "price_level": result.get("price_level"),
            "open_now": result.get("opening_hours", {}).get("open_now"),
            "weekday_text": result.get("opening_hours", {}).get("weekday_text", []),
            "photo_ref": photo_ref,
            "types": result.get("types", []),
        }

        # 3. Write to cache
        if _supabase:
            try:
                _supabase.table("place_details_cache").upsert({
                    "place_id": place_id,
                    "data": details,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception:
                pass  # cache write failure is non-fatal

        return details
    except Exception as e:
        return {"error": str(e)}
```

- [ ] **Step 6: Verify cache works**

```bash
# First call — hits Google, writes to Supabase
curl "http://localhost:8000/place-details?place_id=ChIJbU60yXAWrjsR4E9-UejD3_g"

# Second call same place_id — check server logs: should NOT make outgoing Google request
curl "http://localhost:8000/place-details?place_id=ChIJbU60yXAWrjsR4E9-UejD3_g"
```

Check Supabase dashboard → Table Editor → place_details_cache: row should appear after first call.

- [ ] **Step 7: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add main.py requirements.txt .env
git commit -m "feat: add Supabase 24hr cache for Google Place Details"
```

---

## Task 3: Frontend Types and API Client

**Files:**
- Modify: `frontend/src/shared/types.ts`
- Modify: `frontend/src/shared/api.ts`

- [ ] **Step 1: Add new types to types.ts**

Read `frontend/src/shared/types.ts` and add:
```ts
export interface AutocompleteResult {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  rating?: number;
  rating_count?: number;
  phone?: string;
  website?: string;
  price_level?: number; // 0 = free, 1–4 = $ to $$$$
  open_now?: boolean;
  weekday_text?: string[];
  photo_ref?: string;
  types?: string[];
}
```

- [ ] **Step 2: Add API methods to api.ts**

Read `frontend/src/shared/api.ts`. Note the existing `API_URL` constant and the pattern used for other methods. Add:

```ts
import type { AutocompleteResult, PlaceDetails } from './types';

// Add to the existing api object or export functions — match the existing pattern in the file

export async function placesAutocomplete(
  input: string,
  sessionId: string,
  types = '(cities)'
): Promise<AutocompleteResult[]> {
  const params = new URLSearchParams({ input, session_id: sessionId, types });
  const res = await fetch(`${API_URL}/places-autocomplete?${params}`);
  const data = await res.json();
  return data.predictions ?? [];
}

export async function geocodePlace(
  placeId: string,
  sessionId: string
): Promise<{ lat: number; lon: number; name: string; address: string }> {
  const params = new URLSearchParams({ place_id: placeId, session_id: sessionId });
  const res = await fetch(`${API_URL}/geocode-place?${params}`);
  return res.json();
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const params = new URLSearchParams({ place_id: placeId });
  const res = await fetch(`${API_URL}/place-details?${params}`);
  return res.json();
}

export async function findPlaceId(
  name: string,
  lat: number,
  lon: number
): Promise<string | null> {
  const params = new URLSearchParams({ name, lat: String(lat), lon: String(lon) });
  const res = await fetch(`${API_URL}/find-place-id?${params}`);
  const data = await res.json();
  return data.place_id ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/shared/types.ts frontend/src/shared/api.ts
git commit -m "feat: add AutocompleteResult, PlaceDetails types and Google API client methods"
```

---

## Task 4: Google Autocomplete for City Search

**Files:**
- Create: `frontend/src/modules/destination/useGoogleCitySearch.ts`
- Modify: `frontend/src/modules/destination/CitySearch.tsx`
- Modify: `frontend/src/modules/destination/useCitySearch.ts`

- [ ] **Step 1: Create useGoogleCitySearch.ts**

```ts
// frontend/src/modules/destination/useGoogleCitySearch.ts
import { useState, useCallback, useRef } from 'react';
import { placesAutocomplete, geocodePlace } from '../../shared/api';
import type { AutocompleteResult } from '../../shared/types';

function newSessionId() {
  return Math.random().toString(36).slice(2);
}

export function useGoogleCitySearch() {
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionIdRef = useRef<string>(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (input.length < 2) {
      setResults([]);
      return;
    }

    // 300ms debounce — reduces calls while typing, keystrokes are still free (session tokens)
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const predictions = await placesAutocomplete(input, sessionIdRef.current);
        setResults(predictions);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const selectResult = useCallback(async (result: AutocompleteResult) => {
    // This call ends the session — billing event ($0.017)
    const geo = await geocodePlace(result.place_id, sessionIdRef.current);
    // Reset session for next search
    sessionIdRef.current = newSessionId();
    setResults([]);
    return geo;
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    sessionIdRef.current = newSessionId();
  }, []);

  return { results, loading, search, selectResult, clear };
}
```

- [ ] **Step 2: Read CitySearch.tsx**

Read `frontend/src/modules/destination/CitySearch.tsx` in full to understand:
- How the input onChange is wired
- How results are rendered
- How a result selection triggers navigation/state update

- [ ] **Step 3: Update CitySearch.tsx to use useGoogleCitySearch**

Replace the existing search hook import and usage. The key changes:
1. Replace `useCitySearch()` call with `useGoogleCitySearch()`
2. On input change: call `search(value)`
3. On result click: call `await selectResult(result)` then use returned `{ lat, lon, name }` to update app state (same as current flow with geo data)
4. Render `result.main_text` as primary text and `result.secondary_text` as secondary text in the dropdown

```tsx
// Replace hook import:
import { useGoogleCitySearch } from './useGoogleCitySearch';

// Inside component:
const { results, loading, search, selectResult } = useGoogleCitySearch();

// On input change:
<input
  onChange={(e) => search(e.target.value)}
  // ... rest of existing input props
/>

// Dropdown results:
{results.map((r) => (
  <button
    key={r.place_id}
    onClick={async () => {
      const geo = await selectResult(r);
      // Use geo.lat, geo.lon, geo.name — same as existing city selection flow
      onCitySelect({ lat: geo.lat, lon: geo.lon, name: geo.name });
    }}
  >
    <span className="font-medium">{r.main_text}</span>
    <span className="text-sm text-gray-400 ml-1">{r.secondary_text}</span>
  </button>
))}
```

- [ ] **Step 4: Update useCitySearch.ts**

Read `frontend/src/modules/destination/useCitySearch.ts`. If it's only used in CitySearch.tsx (verify with grep below), replace its contents with a re-export to avoid breaking any other imports:

```bash
grep -r "useCitySearch" /Users/souravbiswas/uncover-roads/frontend/src --include="*.ts" --include="*.tsx" -l
```

If only CitySearch.tsx uses it, replace `useCitySearch.ts` contents with:
```ts
// Delegates to Google Places implementation
export { useGoogleCitySearch as useCitySearch } from './useGoogleCitySearch';
```

- [ ] **Step 5: Test city search**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run dev
```

Open the app → type a city name → verify Google autocomplete results appear → select a result → verify map navigates to that city.

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/destination/useGoogleCitySearch.ts \
  frontend/src/modules/destination/CitySearch.tsx \
  frontend/src/modules/destination/useCitySearch.ts
git commit -m "feat: replace Nominatim city search with Google Places Autocomplete"
```

---

## Task 5: Google Place Details on Pin Tap

**Files:**
- Create: `frontend/src/modules/map/usePlaceDetails.ts`
- Modify: `frontend/src/modules/map/PinCard.tsx`
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Create usePlaceDetails.ts**

```ts
// frontend/src/modules/map/usePlaceDetails.ts
import { useState, useCallback } from 'react';
import { fetchPlaceDetails, findPlaceId } from '../../shared/api';
import type { Place, PlaceDetails } from '../../shared/types';

// In-memory cache: place_id → details (avoids repeat calls within same browser session)
const detailsCache = new Map<string, PlaceDetails>();
// In-memory cache: "name:lat:lon" → place_id (avoids repeat Find Place calls)
const placeIdCache = new Map<string, string>();

export function usePlaceDetails() {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetails = useCallback(async (place: Place) => {
    setLoading(true);
    setDetails(null);

    try {
      // Step 1: Get Google place_id (OSM data doesn't include it)
      const cacheKey = `${place.title}:${place.lat}:${place.lon}`;
      let placeId = placeIdCache.get(cacheKey);

      if (!placeId) {
        placeId = await findPlaceId(place.title, place.lat, place.lon) ?? undefined;
        if (placeId) {
          placeIdCache.set(cacheKey, placeId);
        }
      }

      if (!placeId) {
        // Google couldn't match this place — show nothing extra
        return;
      }

      // Step 2: Get details (backend checks Supabase cache first)
      if (detailsCache.has(placeId)) {
        setDetails(detailsCache.get(placeId)!);
        return;
      }

      const result = await fetchPlaceDetails(placeId);
      if (!result.error) {
        detailsCache.set(placeId, result);
        setDetails(result);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearDetails = useCallback(() => setDetails(null), []);

  return { details, loading, fetchDetails, clearDetails };
}
```

- [ ] **Step 2: Read PinCard.tsx**

Read `frontend/src/modules/map/PinCard.tsx` to understand its current props and layout.

- [ ] **Step 3: Update PinCard.tsx to accept and display Google details**

Add `details` and `detailsLoading` as optional props:

```tsx
import type { Place, PlaceDetails } from '../../shared/types';

interface PinCardProps {
  place: Place;
  details?: PlaceDetails | null;
  detailsLoading?: boolean;
  onClose: () => void;
  // ...any existing props
}

export function PinCard({ place, details, detailsLoading, onClose }: PinCardProps) {
  // Keep all existing content (title, category, reason, imageUrl, etc.) unchanged

  // Add this section below existing content:
  return (
    <div>
      {/* existing content — do not change */}

      {/* Google details section */}
      {detailsLoading && (
        <p className="text-xs text-gray-400 mt-2 animate-pulse">Loading details...</p>
      )}

      {details && !detailsLoading && (
        <div className="mt-3 space-y-1.5 text-sm border-t border-white/10 pt-3">
          {details.rating && (
            <div className="flex items-center gap-1">
              <span>⭐</span>
              <span className="font-medium">{details.rating}</span>
              <span className="text-gray-400">({details.rating_count?.toLocaleString()})</span>
            </div>
          )}

          {details.open_now !== undefined && (
            <div className={details.open_now ? 'text-green-400' : 'text-red-400'}>
              {details.open_now ? '● Open now' : '● Closed'}
            </div>
          )}

          {details.price_level !== undefined && details.price_level > 0 && (
            <div className="text-gray-300">{'$'.repeat(details.price_level)}</div>
          )}

          {details.phone && (
            <a href={`tel:${details.phone}`} className="block text-blue-400 hover:underline">
              📞 {details.phone}
            </a>
          )}

          {details.website && (
            <a
              href={details.website}
              target="_blank"
              rel="noreferrer"
              className="block text-blue-400 hover:underline truncate"
            >
              🌐 {new URL(details.website).hostname}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Read MapScreen.tsx**

Read `frontend/src/modules/map/MapScreen.tsx` to find:
- Where `selectedPlace` state is managed
- Where `<PinCard>` is rendered
- The existing `handlePlaceClick` (or equivalent) function

- [ ] **Step 5: Wire usePlaceDetails into MapScreen.tsx**

```tsx
import { usePlaceDetails } from './usePlaceDetails';

// Inside MapScreen component:
const { details, loading: detailsLoading, fetchDetails, clearDetails } = usePlaceDetails();

// Update place click handler (find existing handler and add fetchDetails call):
const handlePlaceClick = useCallback((place: Place) => {
  setSelectedPlace(place);
  fetchDetails(place); // Google called here only — never on map move
}, [fetchDetails]);

// Update PinCard render (find where <PinCard> is rendered and add props):
<PinCard
  place={selectedPlace}
  details={details}
  detailsLoading={detailsLoading}
  onClose={() => {
    setSelectedPlace(null);
    clearDetails();
  }}
/>
```

- [ ] **Step 6: Test pin tap flow**

```bash
npm run dev
```

1. Search for a city → map loads with Overpass pins
2. Tap a pin → PinCard opens
3. After ~1s → Google details appear (rating, hours, phone, website)
4. Tap same pin again → details appear instantly (in-memory cache)
5. Open browser Network tab → confirm no Google calls on map pan/zoom

- [ ] **Step 7: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/map/usePlaceDetails.ts \
  frontend/src/modules/map/PinCard.tsx \
  frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: show Google Place Details (rating, hours, phone, website) on pin tap"
```

---

---

## Task 6: Install MapLibre, Remove Leaflet

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Install MapLibre packages, remove Leaflet**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm install react-map-gl@7 maplibre-gl
npm uninstall react-leaflet leaflet
```

- [ ] **Step 2: Add maplibre-gl CSS import**

In `frontend/src/main.tsx`, add at the top:
```tsx
import 'maplibre-gl/dist/maplibre-gl.css';
```

- [ ] **Step 3: Update vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run build
```
Expected: Build completes (will have type errors in MapScreen until Task 7 — that's fine)

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/package.json frontend/package-lock.json frontend/src/main.tsx frontend/vite.config.ts
git commit -m "feat: install maplibre-gl + react-map-gl, remove leaflet"
```

---

## Task 7: Create MapLibreMap and Marker Components

**Files:**
- Create: `frontend/src/modules/map/MapLibreMap.tsx`
- Create: `frontend/src/modules/map/MapLibreMarkers.tsx`

- [ ] **Step 1: Create MapLibreMap.tsx**

```tsx
// frontend/src/modules/map/MapLibreMap.tsx
import { useRef, useCallback } from 'react';
import Map, { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { MapLibreMarkers } from './MapLibreMarkers';

// OpenFreeMap — completely free, no token, OSM-based, global CDN
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface Props {
  center: [number, number]; // [lat, lon]
  zoom: number;
  places: Place[];
  selectedPlace: Place | null;
  onPlaceClick: (place: Place) => void;
  onMoveEnd: (center: [number, number], zoom: number) => void;
  children?: React.ReactNode;
}

export function MapLibreMap({
  center,
  zoom,
  places,
  selectedPlace,
  onPlaceClick,
  onMoveEnd,
  children,
}: Props) {
  const mapRef = useRef<MapRef>(null);

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      const { latitude, longitude, zoom: z } = e.viewState;
      onMoveEnd([latitude, longitude], z);
    },
    [onMoveEnd]
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        latitude: center[0],
        longitude: center[1],
        zoom,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={STYLE_URL}
      onMoveEnd={handleMoveEnd}
    >
      <MapLibreMarkers
        places={places}
        selectedPlace={selectedPlace}
        onPlaceClick={onPlaceClick}
      />
      {children}
    </Map>
  );
}
```

- [ ] **Step 2: Create MapLibreMarkers.tsx**

```tsx
// frontend/src/modules/map/MapLibreMarkers.tsx
import { Marker } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444',
  cafe: '#f97316',
  park: '#22c55e',
  museum: '#8b5cf6',
  historic: '#a16207',
  tourism: '#0ea5e9',
  event: '#ec4899',
  place: '#6b7280',
};

interface Props {
  places: Place[];
  selectedPlace: Place | null;
  onPlaceClick: (place: Place) => void;
}

export function MapLibreMarkers({ places, selectedPlace, onPlaceClick }: Props) {
  return (
    <>
      {places.map((place) => {
        const isSelected = selectedPlace?.title === place.title;
        const color = CATEGORY_COLORS[place.category] ?? '#6b7280';

        return (
          <Marker
            key={`${place.lat}-${place.lon}-${place.title}`}
            latitude={place.lat}
            longitude={place.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onPlaceClick(place);
            }}
          >
            <div
              style={{
                width: isSelected ? 20 : 14,
                height: isSelected ? 20 : 14,
                borderRadius: '50%',
                backgroundColor: color,
                border: isSelected ? '3px solid white' : '2px solid white',
                boxShadow: isSelected
                  ? `0 0 0 2px ${color}`
                  : '0 1px 4px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            />
          </Marker>
        );
      })}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/map/MapLibreMap.tsx frontend/src/modules/map/MapLibreMarkers.tsx
git commit -m "feat: add MapLibreMap and MapLibreMarkers components"
```

---

## Task 8: Migrate MapScreen from Leaflet to MapLibre

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`
- Modify: `frontend/src/modules/map/useMapMove.ts`
- Delete: `frontend/src/modules/map/icons.ts`

- [ ] **Step 1: Read MapScreen.tsx**

Read `frontend/src/modules/map/MapScreen.tsx` in full. Identify:
- Where `<MapContainer>` is used → replace with `<MapLibreMap>`
- Where Leaflet marker components are rendered → remove (handled by MapLibreMarkers inside MapLibreMap)
- Where `useMapEvents` / `useMap` hooks are used → replace with `onMoveEnd` prop

- [ ] **Step 2: Replace Leaflet imports and MapContainer in MapScreen.tsx**

Remove:
```tsx
import { MapContainer, TileLayer, useMapEvents, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { createIcon } from './icons';
```

Add:
```tsx
import { MapLibreMap } from './MapLibreMap';
import { MapLibreRoute } from './MapLibreRoute'; // added in Task 9
```

Replace `<MapContainer ...>` JSX with:
```tsx
<MapLibreMap
  center={[geo.lat, geo.lon]}
  zoom={13}
  places={filteredPlaces}
  selectedPlace={selectedPlace}
  onPlaceClick={handlePlaceClick}
  onMoveEnd={handleMapMoveEnd}
/>
```

Where `handleMapMoveEnd` is:
```tsx
const handleMapMoveEnd = useCallback(
  (center: [number, number], zoom: number) => {
    onMoveEnd?.(center, zoom);
  },
  [onMoveEnd]
);
```

- [ ] **Step 3: Simplify useMapMove.ts**

Replace contents of `frontend/src/modules/map/useMapMove.ts` with:
```ts
// frontend/src/modules/map/useMapMove.ts
import { useCallback } from 'react';

interface UseMapMoveProps {
  onSearchHere: (center: [number, number]) => void;
}

export function useMapMove({ onSearchHere }: UseMapMoveProps) {
  const handleMoveEnd = useCallback(
    (center: [number, number], _zoom: number) => {
      onSearchHere(center);
    },
    [onSearchHere]
  );

  return { handleMoveEnd };
}
```

- [ ] **Step 4: Delete icons.ts**

```bash
# Verify nothing else imports icons.ts
grep -r "from.*icons" /Users/souravbiswas/uncover-roads/frontend/src/modules/map --include="*.ts" --include="*.tsx"
# If only MapScreen imported it and that import is now removed, delete it:
rm /Users/souravbiswas/uncover-roads/frontend/src/modules/map/icons.ts
```

- [ ] **Step 5: Run dev server and verify**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run dev
```

Expected:
- Map renders with OpenFreeMap tiles (OSM-style, looks clean)
- No Mapbox token prompt
- Pins appear for current city
- Clicking a pin opens PinCard
- Map pan/zoom works smoothly

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/map/MapScreen.tsx \
  frontend/src/modules/map/useMapMove.ts
git rm frontend/src/modules/map/icons.ts
git commit -m "feat: migrate MapScreen from Leaflet to MapLibre GL JS with OpenFreeMap tiles"
```

---

## Task 9: Route Display as GeoJSON Layer

**Files:**
- Create: `frontend/src/modules/map/MapLibreRoute.tsx`
- Modify: `frontend/src/modules/map/MapLibreMap.tsx`
- Modify: `frontend/src/modules/map/MapScreen.tsx` or `TripSheet.tsx`

- [ ] **Step 1: Create MapLibreRoute.tsx**

```tsx
// frontend/src/modules/map/MapLibreRoute.tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayerSpecification } from 'maplibre-gl';

interface Props {
  geojson: GeoJSON.Feature<GeoJSON.LineString> | null;
}

const routeLineStyle: LineLayerSpecification = {
  id: 'route-line',
  type: 'line',
  source: 'route',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#6366f1',
    'line-width': 4,
    'line-opacity': 0.85,
  },
};

export function MapLibreRoute({ geojson }: Props) {
  if (!geojson) return null;

  return (
    <Source id="route" type="geojson" data={geojson}>
      <Layer {...routeLineStyle} />
    </Source>
  );
}
```

- [ ] **Step 2: Add routeGeojson prop to MapLibreMap.tsx**

In `MapLibreMap.tsx`, add optional `routeGeojson` prop:
```tsx
import { MapLibreRoute } from './MapLibreRoute';

interface Props {
  // ... existing props ...
  routeGeojson?: GeoJSON.Feature<GeoJSON.LineString> | null;
}

// Inside <Map>, after <MapLibreMarkers>:
<MapLibreRoute geojson={routeGeojson ?? null} />
```

- [ ] **Step 3: Read TripSheet.tsx to find where OSRM route data is used**

Read `frontend/src/modules/map/TripSheet.tsx`. Find where `routeData` (the OSRM response) is consumed. OSRM returns `{ routes: [{ geometry: { type: "LineString", coordinates: [...] } }] }`.

- [ ] **Step 4: Pass route GeoJSON up to MapScreen**

In the component that holds route data (TripSheet or MapScreen), convert OSRM geometry to a GeoJSON Feature and pass it to MapLibreMap:

```ts
// Convert OSRM geometry → GeoJSON Feature
const routeGeojson: GeoJSON.Feature<GeoJSON.LineString> | null = routeData?.routes?.[0]
  ? {
      type: 'Feature',
      properties: {},
      geometry: routeData.routes[0].geometry,
    }
  : null;
```

Pass to `<MapLibreMap routeGeojson={routeGeojson} />`.

- [ ] **Step 5: Test route display**

1. Select a city → add stops to trip → generate route
2. Expected: Route appears as an indigo line on the map
3. Verify: Line is smooth and anti-aliased (WebGL rendering)

- [ ] **Step 6: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add frontend/src/modules/map/MapLibreRoute.tsx \
  frontend/src/modules/map/MapLibreMap.tsx \
  frontend/src/modules/map/MapScreen.tsx \
  frontend/src/modules/map/TripSheet.tsx
git commit -m "feat: display OSRM route as GeoJSON line layer on MapLibre map"
```

---

## What You Get After This Plan

| Feature | Before | After |
|---|---|---|
| Map renderer | Leaflet (CPU canvas) | MapLibre GL JS (WebGL — smooth, fast) |
| Map tiles | OpenStreetMap (free) | OpenFreeMap (free, better looking) |
| Map tile cost | $0 | **$0** (OpenFreeMap is free) |
| City search | Nominatim (OSM, sometimes slow/wrong) | Google Places (accurate, typo-tolerant) |
| Place cards | OSM tags only | Rating, open/closed, phone, website, price |
| Route display | Leaflet polyline | MapLibre GeoJSON line (anti-aliased) |
| Custom map style | Not possible | Yes — swap STYLE_URL for any MapLibre style |
| Routing | OSRM (unchanged) | OSRM (unchanged) |
| POI data | Overpass (unchanged) | Overpass (unchanged) |
| Mapbox token needed | No | **No** |

## Cost Summary

**MapLibre + OpenFreeMap: $0/month forever.**

**Google APIs per active session:** ~$0.07–0.17 (2 city searches + 4–5 unique pin taps)

| Monthly Active Users | Google Cost | Map Cost | Net (after $200 credit) |
|---|---|---|---|
| 1,000 | ~$170 | $0 | **$0** (within credit) |
| 2,000 | ~$340 | $0 | **~$140** |
| 5,000 | ~$850 | $0 | **~$650** |

**Cost doesn't spike until ~2,000–3,000 MAU** — by which point you have revenue.
