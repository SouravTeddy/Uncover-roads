# Google-First Map Data + Smart Auto-Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OSM/Overpass as the map data source with Google Nearby Search so every pin has a guaranteed `place_id`, then auto-load pins on map settle with zoom gate + debounce + displacement check instead of a manual "Search Here" button.

**Architecture:** `/map-data` calls Google Nearby Search (multi-type) and caches results in a Supabase `map_data_cache` table keyed by a ~5km tile. The frontend monitors map settle events, applies zoom/displacement guards, then calls the endpoint automatically. A `MapStatusIndicator` component replaces the `SearchHereButton` CTA.

**Tech Stack:** FastAPI (Python), React + TypeScript, MapLibre GL, Google Places Nearby Search API, Supabase (Postgres), react-map-gl

---

## File Map

| File | Change |
|------|--------|
| `main.py` | Replace Overpass query in `/map-data` with Google Nearby Search; add tile cache; add place_id shortcut to `/pin-details` |
| `frontend/src/shared/types.ts` | Add `place_id?`, `rating?`, `open_now?`, `photo_ref?`, `price_level?` to `Place` |
| `frontend/src/shared/api.ts` | Update `mapData()` signature to accept `centerLat, centerLon, radiusM` |
| `frontend/src/modules/map/useMapMove.ts` | Full rewrite: debounce 700ms + zoom gate + displacement check |
| `frontend/src/modules/map/SearchHereButton.tsx` | Delete — replaced by `MapStatusIndicator.tsx` |
| `frontend/src/modules/map/MapStatusIndicator.tsx` | New component: idle/loading/zoomed-out states |
| `frontend/src/modules/map/MapScreen.tsx` | Wire auto-fetch; remove SearchHere state; add mapStatus state |
| `frontend/src/modules/map/usePlaceDetails.ts` | Pass `place.place_id` to skip lookup in `/pin-details` |
| `frontend/src/modules/map/PinCard.tsx` | Show `place.rating`, `place.open_now`, `place.photo_ref` immediately on tap |

---

## Task 1: Supabase — create map_data_cache table

**Files:**
- No code files — SQL migration only

- [ ] **Step 1: Run this SQL in the Supabase SQL editor**

```sql
CREATE TABLE IF NOT EXISTS map_data_cache (
  tile_key   TEXT PRIMARY KEY,          -- "{round(lat,2)},{round(lon,2)}"
  places     JSONB NOT NULL,            -- array of Place objects
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_data_cache_fetched_at_idx
  ON map_data_cache (fetched_at);
```

- [ ] **Step 2: Verify the table exists**

In Supabase Table Editor, confirm `map_data_cache` appears with columns `tile_key`, `places`, `fetched_at`.

---

## Task 2: Backend — replace /map-data with Google Nearby Search

**Files:**
- Modify: `main.py` (the `map_data` function, lines ~167–310)

Context: The current `map_data` function queries Overpass for OSM places. Replace it entirely with Google Nearby Search. The new function:
1. Computes `tile_key = f"{round(center_lat, 2)},{round(center_lon, 2)}"` (~5km grid)
2. Checks `map_data_cache` in Supabase — returns cached if < 24h old
3. Otherwise: calls Google Nearby Search for 7 types, merges results, caches, returns

Each returned `Place` dict now includes `place_id`, `rating`, `open_now`, `photo_ref`, `price_level` directly.

- [ ] **Step 1: Add the Google type list and category mapping constant near the top of main.py** (after the existing `_CATEGORY_TO_GOOGLE_TYPE` dict you added earlier, around line 1210)

```python
# Google Nearby Search types to fetch for map data, and their app category
_NEARBY_TYPE_TO_CATEGORY = {
    "restaurant":       "restaurant",
    "cafe":             "cafe",
    "bar":              "restaurant",
    "museum":           "museum",
    "tourist_attraction": "tourism",
    "park":             "park",
    "night_club":       "restaurant",
}

MAP_DATA_CACHE_TTL_HOURS = int(os.getenv("MAP_DATA_CACHE_TTL_HOURS", "24"))
```

- [ ] **Step 2: Replace the entire `map_data` function body with the new implementation**

Find the function starting at `@app.get("/map-data")` and replace everything through the closing `except` block with:

```python
@app.get("/map-data")
def map_data(
    city: str = Query(""),
    lat:  float = Query(None),
    lon:  float = Query(None),
    center_lat: float = Query(None),
    center_lon: float = Query(None),
    radius_m:   int   = Query(3000),
    # legacy bbox params — kept for backward compat, ignored when center provided
    south: float = Query(None),
    west:  float = Query(None),
    north: float = Query(None),
    east:  float = Query(None),
):
    """
    Returns nearby places using Google Nearby Search.
    Accepts center_lat/center_lon/radius_m (new) or falls back to city geocode (initial load).
    Results cached in Supabase map_data_cache by ~5km tile key for 24h.
    """
    if not GOOGLE_PLACES_API_KEY:
        return []

    # Resolve search center
    clat = center_lat or lat
    clon = center_lon or lon

    if clat is None or clon is None:
        if not city:
            return []
        geo = geocode(city)
        if "error" in geo:
            return []
        clat, clon = geo["lat"], geo["lon"]

    # Clamp radius to Google's max
    radius_m = max(500, min(radius_m, 50000))

    # Tile key — round to 2dp (~1.1km lat, ~0.8km lon at Tokyo lat 35°)
    # Use a coarser key for caching: round to nearest 0.05 (~5km)
    tile_lat = round(round(clat / 0.05) * 0.05, 2)
    tile_lon = round(round(clon / 0.05) * 0.05, 2)
    tile_key = f"{tile_lat},{tile_lon}"

    # Check cache
    if _supabase:
        try:
            cached = (
                _supabase.table("map_data_cache")
                .select("places, fetched_at")
                .eq("tile_key", tile_key)
                .maybe_single()
                .execute()
            )
            if cached.data:
                fetched_at = datetime.fromisoformat(cached.data["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(hours=MAP_DATA_CACHE_TTL_HOURS):
                    return cached.data["places"]
        except Exception:
            pass

    # Fetch from Google Nearby Search for each type
    seen_place_ids: set[str] = set()
    places: list[dict] = []

    for gtype, category in _NEARBY_TYPE_TO_CATEGORY.items():
        try:
            resp = requests.get(
                f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                params={
                    "location": f"{clat},{clon}",
                    "radius": radius_m,
                    "type": gtype,
                    "key": GOOGLE_PLACES_API_KEY,
                },
                timeout=8,
            )
            results = resp.json().get("results", [])
            for r in results:
                pid = r.get("place_id")
                if not pid or pid in seen_place_ids:
                    continue
                seen_place_ids.add(pid)

                photo_ref = None
                if r.get("photos"):
                    photo_ref = r["photos"][0]["photo_reference"]

                loc = r.get("geometry", {}).get("location", {})
                places.append({
                    "id":         pid,
                    "title":      r.get("name", ""),
                    "lat":        loc.get("lat"),
                    "lon":        loc.get("lng"),
                    "category":   category,
                    "place_id":   pid,
                    "rating":     r.get("rating"),
                    "open_now":   r.get("opening_hours", {}).get("open_now"),
                    "photo_ref":  photo_ref,
                    "price_level": r.get("price_level"),
                    "tags": {
                        "types": ",".join(r.get("types", [])),
                    },
                })
        except Exception:
            continue

    # Cache result (even if empty — avoids hammering API for unpopulated areas)
    if _supabase:
        try:
            _supabase.table("map_data_cache").upsert({
                "tile_key":   tile_key,
                "places":     places,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass

    return places
```

- [ ] **Step 3: Commit**

```bash
git add main.py
git commit -m "feat: replace OSM/Overpass map-data with Google Nearby Search + tile cache"
```

---

## Task 3: Frontend types — extend Place with Google fields

**Files:**
- Modify: `frontend/src/shared/types.ts` (the `Place` interface, around line 87)

- [ ] **Step 1: Add optional Google fields to the Place interface**

Find:
```ts
export interface Place {
  id: string;
  title: string;
  category: Category;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  imageUrl?: string | null;
  reason?: string;
}
```

Replace with:
```ts
export interface Place {
  id: string;
  title: string;
  category: Category;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  imageUrl?: string | null;
  reason?: string;
  // Google fields — present when place came from Google Nearby Search
  place_id?: string;
  rating?: number;
  open_now?: boolean;
  photo_ref?: string;
  price_level?: number;
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|✓ built"
```

Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/types.ts
git commit -m "feat: add Google Nearby Search fields to Place type"
```

---

## Task 4: Frontend API — update mapData to accept center + radius

**Files:**
- Modify: `frontend/src/shared/api.ts` (the `mapData` function and `api.mapData`, around lines 72–103)

- [ ] **Step 1: Replace the standalone `mapData` function**

Find:
```ts
export async function mapData(
  city: string,
  lat: number,
  lon: number,
  filters: string[] = [],
  bbox?: BBox,
): Promise<Place[]> {
  const params = new URLSearchParams({ city, lat: String(lat), lon: String(lon) });
  filters.forEach(f => params.append('filters', f));
  if (bbox) {
    const [south, north, west, east] = bbox;
    params.set('south', String(south));
    params.set('north', String(north));
    params.set('west', String(west));
    params.set('east', String(east));
  }
  const res = await fetch(`${BASE}/map-data?${params}`);
  if (!res.ok) throw new Error('map-data failed');
  return res.json();
}
```

Replace with:
```ts
export async function mapData(
  city: string,
  centerLat: number,
  centerLon: number,
  radiusM = 3000,
): Promise<Place[]> {
  const params = new URLSearchParams({
    city,
    center_lat: String(centerLat),
    center_lon: String(centerLon),
    radius_m:   String(radiusM),
  });
  const res = await fetch(`${BASE}/map-data?${params}`);
  if (!res.ok) throw new Error('map-data failed');
  return res.json();
}
```

- [ ] **Step 2: Update `api.mapData` to use the same signature**

Find:
```ts
  mapData: (city: string, lat?: number, lon?: number, filters?: string[], bbox?: BBox) => {
    if (lat !== undefined && lon !== undefined) {
      return mapData(city, lat, lon, filters, bbox);
    }
    return get<Place[]>(`/map-data?city=${encodeURIComponent(city)}`);
  },
```

Replace with:
```ts
  mapData: (city: string, lat?: number, lon?: number, radiusM = 3000) => {
    if (lat !== undefined && lon !== undefined) {
      return mapData(city, lat, lon, radiusM);
    }
    return get<Place[]>(`/map-data?city=${encodeURIComponent(city)}`);
  },
```

- [ ] **Step 3: Verify build passes**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|✓ built"
```

Expected: `✓ built in ...` — if TypeScript errors appear about `mapData` call sites, fix them in Task 7.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/api.ts
git commit -m "feat: update mapData API to use center+radius instead of bbox"
```

---

## Task 5: Frontend — rewrite useMapMove with smart auto-fetch logic

**Files:**
- Modify: `frontend/src/modules/map/useMapMove.ts`

Context: The current `useMapMove` just calls `onSearchHere` on every `moveEnd`. The new version:
- Debounces 700ms (resets on each new move)
- Zoom gate: if zoom < 12, calls `onZoomedOut()` instead
- Displacement check: only calls `onFetch` if center moved >40% of viewport width since last fetch

- [ ] **Step 1: Replace the entire contents of `useMapMove.ts`**

```ts
import { useCallback, useRef } from 'react';

// Approximate metres per degree of latitude (constant)
const M_PER_DEG_LAT = 111_000;

interface UseMapMoveProps {
  onFetch: (center: [number, number], zoom: number) => void;
  onZoomedOut: () => void;
}

export function useMapMove({ onFetch, onZoomedOut }: UseMapMoveProps) {
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef   = useRef<[number, number] | null>(null);

  const handleMoveEnd = useCallback(
    (center: [number, number], zoom: number) => {
      // Clear any pending debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        // Zoom gate — don't load pins when too far out
        if (zoom < 12) {
          onZoomedOut();
          return;
        }

        // Displacement check — only fetch if moved >40% of viewport width
        // Viewport width in degrees at this zoom: 360 / 2^zoom
        const viewportWidthDeg = 360 / Math.pow(2, zoom);
        const thresholdDeg = viewportWidthDeg * 0.4;

        if (lastFetchRef.current) {
          const [lastLat, lastLon] = lastFetchRef.current;
          const dLat = Math.abs(center[0] - lastLat);
          const dLon = Math.abs(center[1] - lastLon);
          if (dLat < thresholdDeg && dLon < thresholdDeg) return;
        }

        lastFetchRef.current = center;
        onFetch(center, zoom);
      }, 700);
    },
    [onFetch, onZoomedOut],
  );

  // Call this when a fetch is initiated externally (e.g. initial load)
  // so the displacement check starts from the right position
  const setLastFetch = useCallback((center: [number, number]) => {
    lastFetchRef.current = center;
  }, []);

  return { handleMoveEnd, setLastFetch };
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|✓ built"
```

TypeScript errors about `useMapMove` call sites are expected — fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/useMapMove.ts
git commit -m "feat: rewrite useMapMove with debounce + zoom gate + displacement check"
```

---

## Task 6: Frontend — MapStatusIndicator component

**Files:**
- Create: `frontend/src/modules/map/MapStatusIndicator.tsx`
- Delete: `frontend/src/modules/map/SearchHereButton.tsx`

Context: Replaces the "Search Here" button. Shows three states in the same top-centre position:
- `loading` → spinner + "Loading places…"
- `zoomed-out` → "Zoom in to see places"
- `idle` → renders nothing

- [ ] **Step 1: Create `MapStatusIndicator.tsx`**

```tsx
interface Props {
  status: 'idle' | 'loading' | 'zoomed-out';
}

export function MapStatusIndicator({ status }: Props) {
  if (status === 'idle') return null;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 h-8 rounded-full"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 7.5rem)',
        zIndex: 1000,
        background: 'rgba(15,20,30,.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,.14)',
        pointerEvents: 'none',
      }}
    >
      {status === 'loading' ? (
        <>
          <span
            className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white/90 animate-spin"
            style={{ flexShrink: 0 }}
          />
          <span className="text-white/80 text-xs font-semibold">Loading places…</span>
        </>
      ) : (
        <>
          <span className="ms fill text-white/50" style={{ fontSize: 14 }}>zoom_in</span>
          <span className="text-white/60 text-xs font-semibold">Zoom in to see places</span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete `SearchHereButton.tsx`**

```bash
rm frontend/src/modules/map/SearchHereButton.tsx
```

- [ ] **Step 3: Verify build (expect errors from MapScreen still importing SearchHereButton — fixed in Task 7)**

```bash
cd frontend && npm run build 2>&1 | grep "error"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/MapStatusIndicator.tsx
git rm frontend/src/modules/map/SearchHereButton.tsx
git commit -m "feat: add MapStatusIndicator, remove SearchHereButton"
```

---

## Task 7: Frontend — wire MapScreen to auto-fetch

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

This is the largest wiring task. Changes:
1. Remove: `showSearchHere`, `searchHereLoading`, `searchHereEmpty` state and all related code
2. Add: `mapStatus: 'idle' | 'loading' | 'zoomed-out'` state
3. Update `handleSearchHere` → `handleAreaLoad(centerLat, centerLon, zoom)` — takes center coords instead of bbox
4. Replace `useMapMove` call with new signature
5. Replace `SearchHereButton` JSX with `MapStatusIndicator`
6. Update initial load to call `handleAreaLoad` and set `setLastFetch`
7. Fix `mapData` call sites (Task 4 changed the signature)

- [ ] **Step 1: Update imports at the top of MapScreen.tsx**

Find:
```ts
import { SearchHereButton } from './SearchHereButton';
```
Replace with:
```ts
import { MapStatusIndicator } from './MapStatusIndicator';
```

- [ ] **Step 2: Replace Search Here state with mapStatus state**

Find and delete these three state lines (around line 104–107):
```ts
  const [showSearchHere, setShowSearchHere]       = useState(false);
  const searchBboxRef                             = useRef<BBox | null>(null);
  const [searchHereLoading, setSearchHereLoading] = useState(false);
  const [searchHereEmpty, setSearchHereEmpty]     = useState(false);
```

Replace with:
```ts
  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'zoomed-out'>('loading');
```

- [ ] **Step 3: Rewrite handleSearchHere as handleAreaLoad**

Find the entire `handleSearchHere` function (from `const handleSearchHere = useCallback` through its closing `}, [city, cityGeo, dispatch]);`) and replace with:

```ts
  const handleAreaLoad = useCallback(async (
    centerLat: number,
    centerLon: number,
    radiusM = 3000,
    replace = false,
  ) => {
    if (!city) return;
    setMapStatus('loading');
    try {
      const raw = await mapData(city, centerLat, centerLon, radiusM);
      const withIds = (Array.isArray(raw) ? raw : []).map((p, i) => ({
        ...p,
        id: p.id ?? `${p.title}-${i}`,
      }));
      dispatch(replace
        ? { type: 'SET_PLACES', places: withIds }
        : { type: 'MERGE_PLACES', places: withIds },
      );
    } catch (e) {
      console.error('[MapScreen] handleAreaLoad failed:', e);
    } finally {
      setMapStatus('idle');
      setInitialLoading(false);
    }
  }, [city, dispatch]);
```

- [ ] **Step 4: Update the initial load useEffect**

Find:
```ts
  const initialLoadFired = useRef(false);
  useEffect(() => {
    if (initialLoadFired.current) return;
    if (!cityGeo) return;
    initialLoadFired.current = true;
    const bbox: BBox = cityGeo.bbox ?? [
      cityGeo.lat - 0.1, cityGeo.lat + 0.1,
      cityGeo.lon - 0.1, cityGeo.lon + 0.1,
    ];
    handleSearchHere(bbox);
    // Auto-load events on map entry if a date is already set
    if (state.tripContext.date) {
      loadEvents();
    }
  }, [cityGeo, handleSearchHere]); // eslint-disable-line react-hooks/exhaustive-deps
```

Replace with:
```ts
  const initialLoadFired = useRef(false);
  useEffect(() => {
    if (initialLoadFired.current) return;
    if (!cityGeo) return;
    initialLoadFired.current = true;
    setLastFetch([cityGeo.lat, cityGeo.lon]);
    handleAreaLoad(cityGeo.lat, cityGeo.lon, 5000, true);
    if (state.tripContext.date) {
      loadEvents();
    }
  }, [cityGeo, handleAreaLoad]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Update useMapMove call**

Find:
```ts
  const { handleMoveEnd } = useMapMove({
    onSearchHere: useCallback((_center: [number, number]) => {
      setShowSearchHere(true);
    }, []),
  });
```

Replace with:
```ts
  const { handleMoveEnd, setLastFetch } = useMapMove({
    onFetch: useCallback((center: [number, number]) => {
      handleAreaLoad(center[0], center[1], 3000, true);
    }, [handleAreaLoad]),
    onZoomedOut: useCallback(() => {
      setMapStatus('zoomed-out');
    }, []),
  });
```

- [ ] **Step 6: Update handleMapMoveEnd — remove bbox computation (no longer needed)**

Find:
```ts
  const handleMapMoveEnd = useCallback((center: [number, number], zoom: number) => {
    // Approximate viewport bbox from center + zoom (rough estimate)
    const latDelta = 180 / Math.pow(2, zoom) * 0.5;
    const lonDelta = 360 / Math.pow(2, zoom) * 0.5;
    const bbox: BBox = [
      center[0] - latDelta,
      center[0] + latDelta,
      center[1] - lonDelta,
      center[1] + lonDelta,
    ];
    searchBboxRef.current = bbox;
    handleMoveEnd(center, zoom);
  }, [handleMoveEnd]);
```

Replace with:
```ts
  const handleMapMoveEnd = useCallback((center: [number, number], zoom: number) => {
    handleMoveEnd(center, zoom);
  }, [handleMoveEnd]);
```

- [ ] **Step 7: Replace SearchHereButton JSX with MapStatusIndicator**

Find (somewhere in the JSX return):
```tsx
      {showSearchHere && (
        <SearchHereButton
          onSearch={handleSearchHere}
          loading={searchHereLoading}
          empty={searchHereEmpty}
        />
      )}
```

Replace with:
```tsx
      <MapStatusIndicator status={mapStatus} />
```

- [ ] **Step 8: Remove unused BBox import if no longer used elsewhere**

Check if `BBox` is still referenced in the file:
```bash
grep -n "BBox" frontend/src/modules/map/MapScreen.tsx
```

If the only remaining reference is the import line, remove it from the import:
```ts
import { mapData, api } from '../../shared/api';
// remove ", type { BBox }" from this line if present
```

- [ ] **Step 9: Verify full build**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|✓ built"
```

Expected: `✓ built in ...`

- [ ] **Step 10: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: auto-fetch pins on map settle, replace SearchHereButton with MapStatusIndicator"
```

---

## Task 8: Backend + Frontend — /pin-details shortcut when place_id known

**Files:**
- Modify: `main.py` (the `pin_details` function)
- Modify: `frontend/src/shared/api.ts` (the `fetchPinDetails` function)
- Modify: `frontend/src/modules/map/usePlaceDetails.ts`

Context: Since places now come from Google Nearby Search, they already have a `place_id`. We can skip the entire lookup chain in `/pin-details` and jump straight to Place Details.

- [ ] **Step 1: Update `fetchPinDetails` in api.ts to accept optional place_id**

Find:
```ts
export async function fetchPinDetails(
  lat: number,
  lon: number,
  name: string,
  category = '',
): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), name, category });
```

Replace with:
```ts
export async function fetchPinDetails(
  lat: number,
  lon: number,
  name: string,
  category = '',
  placeId = '',
): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), name, category, place_id: placeId });
```

- [ ] **Step 2: Update `usePlaceDetails.ts` to pass place.place_id**

Find:
```ts
      const result = await fetchPinDetails(place.lat, place.lon, place.title, place.category);
```

Replace with:
```ts
      const result = await fetchPinDetails(place.lat, place.lon, place.title, place.category, place.place_id ?? '');
```

- [ ] **Step 3: Add place_id shortcut at the top of `pin_details` in main.py**

Find the start of the `pin_details` function body (after the docstring, around the rate limit check):
```python
    if not GOOGLE_PLACES_API_KEY:
        return {"place_id": None}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    coords_key = f"{lat:.5f},{lon:.5f}"

    # ── 1. Coords cache → skip both lookups if place_id already known ──
    place_id = None
```

Update the function signature to accept `place_id` and add a shortcut:

```python
@app.get("/pin-details")
def pin_details(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    name: str = Query(""),
    category: str = Query(""),
    place_id: str = Query(""),   # ← new: skip all lookups if provided
):
```

Then immediately after the rate limit check, add:
```python
    # ── Shortcut: if place_id already known (Google Nearby Search result), skip lookup ──
    resolved_place_id = place_id.strip() or None
```

And replace the variable name `place_id` with `resolved_place_id` throughout the rest of the function (the Supabase cache lookups, findplacefromtext, nearbysearch blocks all set `place_id = ...` — change those assignments to `resolved_place_id = ...`).

The key shortcut: jump directly to step 4 (place_details_cache check) if `resolved_place_id` is already set.

Full updated function (replace from the `@app.get("/pin-details")` decorator through the end):

```python
@app.get("/pin-details")
def pin_details(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    name: str = Query(""),
    category: str = Query(""),
    place_id: str = Query(""),
):
    """
    Single-call endpoint: resolves place_id then fetches full details.
    If place_id is provided (Google Nearby Search result), skips all lookups.
    """
    if not GOOGLE_PLACES_API_KEY:
        return {"place_id": None}

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    coords_key = f"{lat:.5f},{lon:.5f}"
    resolved_id = place_id.strip() or None

    if not resolved_id:
        # ── 1. Coords cache ──
        if _supabase:
            try:
                cached = (
                    _supabase.table("place_id_cache")
                    .select("place_id")
                    .eq("coords_key", coords_key)
                    .maybe_single()
                    .execute()
                )
                if cached.data and cached.data.get("place_id"):
                    resolved_id = cached.data["place_id"]
            except Exception:
                pass

    if not resolved_id and name:
        # ── 2. Name-based lookup ──
        try:
            resp = requests.get(
                f"{GOOGLE_PLACES_BASE}/findplacefromtext/json",
                params={
                    "input": name,
                    "inputtype": "textquery",
                    "locationbias": f"point:{lat},{lon}",
                    "fields": "place_id,name",
                    "key": GOOGLE_PLACES_API_KEY,
                },
                timeout=5,
            )
            candidates = resp.json().get("candidates", [])
            if candidates:
                resolved_id = candidates[0]["place_id"]
        except Exception:
            pass

    if not resolved_id:
        # ── 3. Type-ranked nearbysearch ──
        google_type = _CATEGORY_TO_GOOGLE_TYPE.get(category, "")
        if google_type:
            try:
                resp = requests.get(
                    f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                    params={
                        "location": f"{lat},{lon}",
                        "rankby": "distance",
                        "type": google_type,
                        "key": GOOGLE_PLACES_API_KEY,
                    },
                    timeout=5,
                )
                results = resp.json().get("results", [])
                if results:
                    resolved_id = results[0]["place_id"]
            except Exception:
                pass

    if not resolved_id:
        # ── 4. 100m catch-all ──
        try:
            resp = requests.get(
                f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
                params={
                    "location": f"{lat},{lon}",
                    "radius": 100,
                    "key": GOOGLE_PLACES_API_KEY,
                },
                timeout=5,
            )
            results = resp.json().get("results", [])
            if results:
                resolved_id = results[0]["place_id"]
        except Exception:
            pass

    if not resolved_id:
        return {"place_id": None}

    # ── Cache resolved_id ──
    if _supabase and not place_id.strip():
        try:
            _supabase.table("place_id_cache").upsert({
                "coords_key": coords_key,
                "place_id": resolved_id,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass

    # ── Check place_details_cache ──
    if _supabase:
        try:
            cached_details = (
                _supabase.table("place_details_cache")
                .select("data, fetched_at")
                .eq("place_id", resolved_id)
                .maybe_single()
                .execute()
            )
            if cached_details.data:
                fetched_at = datetime.fromisoformat(cached_details.data["fetched_at"])
                if datetime.now(timezone.utc) - fetched_at < timedelta(days=PLACE_CACHE_TTL_DAYS):
                    return cached_details.data["data"]
        except Exception:
            pass

    # ── Fetch from Google Place Details ──
    try:
        resp = requests.get(
            f"{GOOGLE_PLACES_BASE}/details/json",
            params={
                "place_id": resolved_id,
                "fields": "name,formatted_address,geometry,rating,user_ratings_total,opening_hours,formatted_phone_number,website,price_level,photos,types,editorial_summary,reviews",
                "key": GOOGLE_PLACES_API_KEY,
            },
            timeout=5,
        )
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return {"place_id": None, "error": data.get("status", "UNKNOWN")}

        result = data.get("result", {})
        photo_ref = None
        if result.get("photos"):
            photo_ref = result["photos"][0]["photo_reference"]

        details = {
            "place_id": resolved_id,
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
            "editorial_summary": result.get("editorial_summary", {}).get("overview"),
            "top_review": result["reviews"][0]["text"] if result.get("reviews") else None,
        }

        if _supabase:
            try:
                _supabase.table("place_details_cache").upsert({
                    "place_id": resolved_id,
                    "data": details,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            except Exception:
                pass

        return details
    except Exception as e:
        return {"place_id": None, "error": str(e)}
```

- [ ] **Step 4: Verify full build**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|✓ built"
```

Expected: `✓ built in ...`

- [ ] **Step 5: Commit**

```bash
git add main.py frontend/src/shared/api.ts frontend/src/modules/map/usePlaceDetails.ts
git commit -m "feat: skip place_id lookup in /pin-details when place_id already known"
```

---

## Task 9: Frontend — PinCard shows Google data from Place immediately

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`

Context: Places from Google Nearby Search already have `rating`, `open_now`, `photo_ref`, `price_level`. We can show these instantly on tap — before the Place Details call returns — because they're on the `place` prop itself.

- [ ] **Step 1: Add immediate display of place-level Google data in PinCard**

In `PinCard.tsx`, find the meta row section (currently only reads from `activeDetails`):
```tsx
        {/* Meta row: rating · open/closed · price */}
        {(activeDetails?.rating || activeDetails?.open_now !== undefined || activeDetails?.price_level) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            {activeDetails!.rating !== undefined && (
```

Replace the meta row with one that falls back to `place` fields when `activeDetails` isn't loaded yet:
```tsx
        {/* Meta row: rating · open/closed · price — from place (instant) or details (enriched) */}
        {(() => {
          const rating     = activeDetails?.rating     ?? place.rating;
          const openNow    = activeDetails?.open_now   ?? place.open_now;
          const priceLevel = activeDetails?.price_level ?? place.price_level;
          const ratingCount = activeDetails?.rating_count;
          if (rating === undefined && openNow === undefined && priceLevel === undefined) return null;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              {rating !== undefined && (
                <>
                  <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>★ {rating}</span>
                  {ratingCount !== undefined && (
                    <span style={{ fontSize: 10, color: '#777' }}>({ratingCount.toLocaleString()})</span>
                  )}
                </>
              )}
              {openNow !== undefined && (
                <span style={{ fontSize: 10, color: openNow ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  ● {openNow ? 'Open' : 'Closed'}
                </span>
              )}
              {priceLevel !== undefined && priceLevel > 0 && (
                <span style={{ fontSize: 10, color: '#777' }}>{PRICE[priceLevel]}</span>
              )}
            </div>
          );
        })()}
```

Also update the `photoUrl` line to use `place.photo_ref` as an immediate fallback:
```tsx
  const photoUrl = (activeDetails?.photo_ref ?? place.photo_ref)
    ? getPlacePhotoUrl((activeDetails?.photo_ref ?? place.photo_ref)!)
    : null;
```

- [ ] **Step 2: Verify full build**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|✓ built"
```

Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/PinCard.tsx
git commit -m "feat: PinCard shows rating/open/photo from Place object immediately on tap"
```

---

## Task 10: Push and deploy

- [ ] **Step 1: Push feature branch**

```bash
git push origin feature/google-maplibre
```

- [ ] **Step 2: Create PR and merge to main**

```bash
gh pr create --title "feat: Google-first map data + smart auto-loading" \
  --body "Replaces OSM/Overpass with Google Nearby Search. Every pin has place_id. Auto-loads on map settle with debounce + zoom gate + displacement check. Removes Search Here button. MapStatusIndicator shows loading/zoom-out state."
gh pr merge --merge
```

- [ ] **Step 3: Verify Railway redeploys** — check Railway dashboard that the new main.py is live before testing

- [ ] **Step 4: Smoke test**
  - Open any city → pins load automatically ✓
  - Zoom out below zoom 12 → "Zoom in to see places" indicator appears ✓
  - Tap any pin → photo, rating, open/closed show immediately ✓
  - Tap any pin → full hours/phone/website appear shortly after ✓
  - Scroll to new area, stop → "Loading places…" appears then pins update ✓
  - Scroll back to same area → loads instantly from cache ✓
