# Contextual Action Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static `getRecoChips()` on `RecoCard` with contextual, actionable chips that vary by Google Place type — indigo expand chips call `/nearby` and show inline results, white direct chips open Maps deep-links.

**Architecture:** A new `chip-utils.ts` holds all taxonomy logic and URL construction; `ItineraryCards.tsx` is updated to use it and render interactive chips; a new `/nearby` backend endpoint serves expand chip results.

**Tech Stack:** React (inline state for expand panel), TypeScript, FastAPI (Python), Google Places Nearby Search API, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `main.py` | Modify | Add `GET /nearby` endpoint |
| `frontend/src/shared/types.ts` | Modify | Add `NearbyResult` interface |
| `frontend/src/shared/api.ts` | Modify | Add `fetchNearby()` function |
| `frontend/src/modules/route/chip-utils.ts` | Create | Taxonomy logic + direct URL builder |
| `frontend/src/modules/route/chip-utils.test.ts` | Create | Unit tests for chip-utils |
| `frontend/src/modules/route/ItineraryCards.tsx` | Modify | Replace `getRecoChips()`/`RecoChip` with contextual chips + expand panel |

---

### Task 1: Backend `/nearby` endpoint + frontend `NearbyResult` type + `fetchNearby`

**Files:**
- Modify: `main.py` (after the `/place-photo` endpoint at line 1157)
- Modify: `frontend/src/shared/types.ts` (after `PlaceDetails` interface)
- Modify: `frontend/src/shared/api.ts` (after `findPlaceId` function)

- [ ] **Step 1: Add `NearbyResult` to `frontend/src/shared/types.ts`**

Add after the `PlaceDetails` interface (line 201):

```ts
export interface NearbyResult {
  name: string;
  address: string;
  rating: number | null;
  distance_m: number;
  lat: number;
  lon: number;
  place_id: string;
}
```

- [ ] **Step 2: Add `fetchNearby` to `frontend/src/shared/api.ts`**

Add these two lines to the import at the top of the file (add `NearbyResult` to the existing import):

```ts
import type {
  GeoData,
  Place,
  CityResult,
  RouteData,
  LatLon,
  Itinerary,
  WeatherData,
  Persona,
  OnboardingAnswers,
  AutocompleteResult,
  PlaceDetails,
  NearbyResult,
} from './types';
```

Then add the function at the end of the file:

```ts
export async function fetchNearby(
  lat: number,
  lon: number,
  type: string,
): Promise<NearbyResult[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    type,
    radius: '500',
    limit: '3',
  });
  const res = await fetch(`${BASE}/nearby?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
```

- [ ] **Step 3: Add `/nearby` endpoint to `main.py`**

Add after the `/place-photo` endpoint (after line 1156, before the final blank line):

```python
@app.get("/nearby")
def nearby(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    type: str = Query(...),
    radius: int = Query(500),
    limit: int = Query(3),
):
    """
    Google Places Nearby Search — called only on expand chip tap.
    Cost: ~$0.032 per request. Rate-limited per IP.
    """
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not GOOGLE_PLACES_API_KEY:
        return []

    params = {
        "location": f"{lat},{lon}",
        "radius": radius,
        "type": type,
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(
            f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
            params=params,
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return []

        results = []
        for place in data.get("results", [])[:limit]:
            loc = place.get("geometry", {}).get("location", {})
            place_lat = loc.get("lat", 0)
            place_lon = loc.get("lng", 0)
            # Haversine-approximate distance in metres
            import math
            dlat = math.radians(place_lat - lat)
            dlon = math.radians(place_lon - lon)
            a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat)) * math.cos(math.radians(place_lat)) * math.sin(dlon / 2) ** 2
            distance_m = int(6371000 * 2 * math.asin(math.sqrt(a)))
            results.append({
                "name": place.get("name", ""),
                "address": place.get("vicinity", ""),
                "rating": place.get("rating"),
                "distance_m": distance_m,
                "lat": place_lat,
                "lon": place_lon,
                "place_id": place.get("place_id", ""),
            })
        return results
    except Exception:
        return []
```

Add `Cache-Control` header by wrapping with a `Response`:

Actually — keep it simple, use `responses` parameter on the decorator instead. Replace the endpoint above with this version that includes the header via FastAPI's `Response`:

```python
@app.get("/nearby")
def nearby(
    request: Request,
    response: Response,
    lat: float = Query(...),
    lon: float = Query(...),
    type: str = Query(...),
    radius: int = Query(500),
    limit: int = Query(3),
):
    """
    Google Places Nearby Search — called only on expand chip tap.
    Cost: ~$0.032 per request. Rate-limited per IP.
    """
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not GOOGLE_PLACES_API_KEY:
        return []

    response.headers["Cache-Control"] = "max-age=300"

    params = {
        "location": f"{lat},{lon}",
        "radius": radius,
        "type": type,
        "key": GOOGLE_PLACES_API_KEY,
    }
    try:
        resp = requests.get(
            f"{GOOGLE_PLACES_BASE}/nearbysearch/json",
            params=params,
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            return []

        import math
        results = []
        for place in data.get("results", [])[:limit]:
            loc = place.get("geometry", {}).get("location", {})
            place_lat = loc.get("lat", 0)
            place_lon = loc.get("lng", 0)
            dlat = math.radians(place_lat - lat)
            dlon = math.radians(place_lon - lon)
            a = (math.sin(dlat / 2) ** 2
                 + math.cos(math.radians(lat))
                 * math.cos(math.radians(place_lat))
                 * math.sin(dlon / 2) ** 2)
            distance_m = int(6371000 * 2 * math.asin(math.sqrt(a)))
            results.append({
                "name": place.get("name", ""),
                "address": place.get("vicinity", ""),
                "rating": place.get("rating"),
                "distance_m": distance_m,
                "lat": place_lat,
                "lon": place_lon,
                "place_id": place.get("place_id", ""),
            })
        return results
    except Exception:
        return []
```

Note: `Response` is already imported from `fastapi` in `main.py`. Check the import line and add `Response` if it is missing: `from fastapi import FastAPI, Query, HTTPException, Request, Response`.

- [ ] **Step 4: Start the backend and verify the endpoint responds**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre
uvicorn main:app --reload --port 8000
```

In a second terminal:
```bash
curl "http://localhost:8000/nearby?lat=38.72&lon=-9.18&type=cafe&radius=500&limit=3"
```

Expected: JSON array (may be `[]` without a real API key in dev, that is fine).

- [ ] **Step 5: Commit**

```bash
git add main.py frontend/src/shared/types.ts frontend/src/shared/api.ts
git commit -m "feat: add /nearby endpoint + NearbyResult type + fetchNearby client"
```

---

### Task 2: `chip-utils.ts` — taxonomy logic + direct URL builder + tests

**Files:**
- Create: `frontend/src/modules/route/chip-utils.ts`
- Create: `frontend/src/modules/route/chip-utils.test.ts`

**Context:** `getContextualChips` is the only public function from this file. `RecoCard` in `ItineraryCards.tsx` will call it. No React in this file — pure logic.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/route/chip-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getContextualChips, buildDirectUrl } from './chip-utils';

// ── getContextualChips ───────────────────────────────────────────

describe('getContextualChips — type matching', () => {
  it('returns museum chips for museum type', () => {
    const chips = getContextualChips(['museum'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Museum café ›');
    expect(labels).toContain('Gift shop ›');
    expect(labels).toContain('Book tickets ↗');
    expect(labels).toContain('Restrooms ↗');
    expect(chips.length).toBeLessThanOrEqual(4);
  });

  it('returns museum chips for art_gallery type', () => {
    const chips = getContextualChips(['art_gallery'], 10 * 60);
    expect(chips.map(c => c.label)).toContain('Museum café ›');
  });

  it('returns worship chips for church type', () => {
    const chips = getContextualChips(['church'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Prayer times ↗');
    expect(labels).toContain('Dress code ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns park chips for park type', () => {
    const chips = getContextualChips(['park'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Photo spots ›');
    expect(labels).toContain('Trail map ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns attraction chips for tourist_attraction type', () => {
    const chips = getContextualChips(['tourist_attraction'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Best angles ›');
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Street view ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns food chips for restaurant type', () => {
    const chips = getContextualChips(['restaurant'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Dessert nearby ›');
    expect(labels).toContain('Walk it off ↗');
    expect(labels).toContain('Leave review ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('returns food chips for cafe type', () => {
    const chips = getContextualChips(['cafe'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Dessert nearby ›');
  });

  it('returns historic chips for castle type', () => {
    const chips = getContextualChips(['castle'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Photo spots ›');
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Book ahead ↗');
  });

  it('returns fallback chips for unknown type', () => {
    const chips = getContextualChips(['unknown_type'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Café nearby ›');
    expect(labels).toContain('Explore nearby ↗');
    expect(labels).toContain('Restrooms ↗');
  });

  it('first matching group wins — does not mix groups', () => {
    // museum + park: should match museum group only
    const chips = getContextualChips(['museum', 'park'], 10 * 60);
    const labels = chips.map(c => c.label);
    expect(labels).toContain('Museum café ›');
    expect(labels).not.toContain('Trail map ↗');
  });
});

describe('getContextualChips — time-based chips', () => {
  it('adds Lunch nearby at 11:00', () => {
    const chips = getContextualChips(['park'], 11 * 60);
    expect(chips.map(c => c.label)).toContain('Lunch nearby ›');
  });

  it('adds Lunch nearby at 13:59', () => {
    const chips = getContextualChips(['park'], 13 * 60 + 59);
    expect(chips.map(c => c.label)).toContain('Lunch nearby ›');
  });

  it('does not add Lunch at 14:00', () => {
    const chips = getContextualChips(['park'], 14 * 60);
    expect(chips.map(c => c.label)).not.toContain('Lunch nearby ›');
  });

  it('adds Afternoon coffee at 15:00', () => {
    const chips = getContextualChips(['park'], 15 * 60);
    expect(chips.map(c => c.label)).toContain('Afternoon coffee ›');
  });

  it('adds Afternoon coffee at 16:59', () => {
    const chips = getContextualChips(['park'], 16 * 60 + 59);
    expect(chips.map(c => c.label)).toContain('Afternoon coffee ›');
  });

  it('does not add Afternoon coffee at 17:00', () => {
    const chips = getContextualChips(['park'], 17 * 60);
    expect(chips.map(c => c.label)).not.toContain('Afternoon coffee ›');
  });

  it('adds Dinner nearby at 18:00', () => {
    const chips = getContextualChips(['park'], 18 * 60);
    expect(chips.map(c => c.label)).toContain('Dinner nearby ›');
  });

  it('never exceeds 4 chips total', () => {
    // park has 4 type chips; time chip must replace one
    const chips = getContextualChips(['park'], 11 * 60);
    expect(chips.length).toBeLessThanOrEqual(4);
  });

  it('time chip replaces first chip when row is already 4', () => {
    // park → [Café nearby ›, Photo spots ›, Trail map ↗, Restrooms ↗] = 4
    // at 11am, Lunch nearby › should appear, first chip removed
    const chips = getContextualChips(['park'], 11 * 60);
    expect(chips[0].label).toBe('Lunch nearby ›');
    expect(chips.length).toBe(4);
  });
});

describe('getContextualChips — chip shape', () => {
  it('expand chips have kind expand and nearbyType', () => {
    const chips = getContextualChips(['park'], 10 * 60);
    const expand = chips.filter(c => c.kind === 'expand');
    expect(expand.length).toBeGreaterThan(0);
    expand.forEach(c => {
      expect(c.nearbyType).toBeTruthy();
    });
  });

  it('direct chips have kind direct and no nearbyType', () => {
    const chips = getContextualChips(['park'], 10 * 60);
    const direct = chips.filter(c => c.kind === 'direct');
    expect(direct.length).toBeGreaterThan(0);
    direct.forEach(c => {
      expect(c.nearbyType).toBeUndefined();
    });
  });
});

// ── buildDirectUrl ───────────────────────────────────────────────

describe('buildDirectUrl', () => {
  const stop = { place: 'Monsanto Forest', lat: 38.72, lon: -9.18 };

  it('Restrooms — search near coordinates', () => {
    const url = buildDirectUrl('Restrooms ↗', stop, false);
    expect(url).toContain('restroom');
    expect(url).toContain('38.72');
  });

  it('Trail map — search near coordinates', () => {
    const url = buildDirectUrl('Trail map ↗', stop, false);
    expect(url).toContain('hiking');
  });

  it('Walk it off — walking directions from coordinates', () => {
    const url = buildDirectUrl('Walk it off ↗', stop, false);
    expect(url).toContain('38.72');
    expect(url).toContain('-9.18');
  });

  it('Leave review — Google Maps search for place', () => {
    const url = buildDirectUrl('Leave review ↗', stop, false);
    expect(url).toContain('maps.google.com');
    expect(url).toContain(encodeURIComponent('Monsanto Forest'));
  });

  it('Street view — Google Maps street view layer', () => {
    const url = buildDirectUrl('Street view ↗', stop, false);
    expect(url).toContain('layer=c');
  });

  it('Book tickets — Google search', () => {
    const url = buildDirectUrl('Book tickets ↗', stop, false);
    expect(url).toContain('google.com/search');
    expect(url).toContain('tickets');
  });

  it('Book ahead — Google search', () => {
    const url = buildDirectUrl('Book ahead ↗', stop, false);
    expect(url).toContain('google.com/search');
    expect(url).toContain('tickets');
  });

  it('Prayer times — Google search', () => {
    const url = buildDirectUrl('Prayer times ↗', stop, false);
    expect(url).toContain('prayer+times');
  });

  it('Dress code — Google search', () => {
    const url = buildDirectUrl('Dress code ↗', stop, false);
    expect(url).toContain('dress+code');
  });

  it('Explore nearby — Maps near coordinates', () => {
    const url = buildDirectUrl('Explore nearby ↗', stop, false);
    expect(url).toContain('38.72');
    expect(url).toContain('-9.18');
  });

  it('uses Apple Maps base on iOS/Mac', () => {
    const url = buildDirectUrl('Restrooms ↗', stop, true);
    expect(url).toContain('maps.apple.com');
  });

  it('uses Google Maps base on non-Mac', () => {
    const url = buildDirectUrl('Restrooms ↗', stop, false);
    expect(url).toContain('maps.google.com');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/modules/route/chip-utils.test.ts
```

Expected: FAIL — "Cannot find module './chip-utils'"

- [ ] **Step 3: Create `frontend/src/modules/route/chip-utils.ts`**

```ts
// Chip taxonomy and URL builder for contextual action chips on RecoCard.

export type ChipKind = 'expand' | 'direct';

export interface ChipDef {
  label: string;      // e.g. "Café nearby ›" or "Restrooms ↗"
  emoji: string;
  kind: ChipKind;
  nearbyType?: string; // Google Places type for expand chips (e.g. 'cafe')
}

// ── Type → chip groups ───────────────────────────────────────────

interface ChipGroup {
  types: string[];
  expand: Array<{ label: string; emoji: string; nearbyType: string }>;
  direct: Array<{ label: string; emoji: string }>;
}

const CHIP_GROUPS: ChipGroup[] = [
  {
    types: ['museum', 'art_gallery', 'exhibition_center'],
    expand: [
      { label: 'Museum café ›', emoji: '☕', nearbyType: 'cafe' },
      { label: 'Gift shop ›',   emoji: '🛍', nearbyType: 'store' },
    ],
    direct: [
      { label: 'Book tickets ↗', emoji: '🎟' },
      { label: 'Restrooms ↗',    emoji: '🚻' },
    ],
  },
  {
    types: ['hindu_temple', 'mosque', 'church', 'place_of_worship', 'synagogue'],
    expand: [
      { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
    ],
    direct: [
      { label: 'Prayer times ↗', emoji: '🙏' },
      { label: 'Dress code ↗',   emoji: '👗' },
      { label: 'Restrooms ↗',    emoji: '🚻' },
    ],
  },
  {
    types: ['park', 'national_park', 'botanical_garden', 'hiking_area', 'nature_reserve'],
    expand: [
      { label: 'Café nearby ›',  emoji: '☕', nearbyType: 'cafe' },
      { label: 'Photo spots ›',  emoji: '📸', nearbyType: 'tourist_attraction' },
    ],
    direct: [
      { label: 'Trail map ↗',  emoji: '🥾' },
      { label: 'Restrooms ↗', emoji: '🚻' },
    ],
  },
  {
    types: ['tourist_attraction', 'viewpoint', 'landmark'],
    expand: [
      { label: 'Best angles ›', emoji: '📸', nearbyType: 'tourist_attraction' },
      { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
    ],
    direct: [
      { label: 'Street view ↗', emoji: '🗺' },
      { label: 'Restrooms ↗',   emoji: '🚻' },
    ],
  },
  {
    types: ['restaurant', 'food', 'bar', 'night_club', 'cafe', 'bakery', 'coffee_shop'],
    expand: [
      { label: 'Dessert nearby ›', emoji: '🍦', nearbyType: 'bakery' },
    ],
    direct: [
      { label: 'Walk it off ↗',  emoji: '🚶' },
      { label: 'Leave review ↗', emoji: '⭐' },
      { label: 'Restrooms ↗',    emoji: '🚻' },
    ],
  },
  {
    types: ['historic', 'monument', 'ruins', 'castle', 'memorial'],
    expand: [
      { label: 'Photo spots ›', emoji: '📸', nearbyType: 'tourist_attraction' },
      { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
    ],
    direct: [
      { label: 'Book ahead ↗', emoji: '🎟' },
      { label: 'Restrooms ↗',  emoji: '🚻' },
    ],
  },
];

const FALLBACK_GROUP: ChipGroup = {
  types: [],
  expand: [
    { label: 'Café nearby ›', emoji: '☕', nearbyType: 'cafe' },
  ],
  direct: [
    { label: 'Explore nearby ↗', emoji: '🗺' },
    { label: 'Restrooms ↗',      emoji: '🚻' },
  ],
};

// ── Time-based chip definitions ──────────────────────────────────

const TIME_CHIPS: Array<{ minStart: number; minEnd: number; chip: ChipDef }> = [
  {
    minStart: 11 * 60,
    minEnd: 14 * 60,
    chip: { label: 'Lunch nearby ›', emoji: '🍽', kind: 'expand', nearbyType: 'restaurant' },
  },
  {
    minStart: 15 * 60,
    minEnd: 17 * 60,
    chip: { label: 'Afternoon coffee ›', emoji: '☕', kind: 'expand', nearbyType: 'cafe' },
  },
  {
    minStart: 18 * 60,
    minEnd: Infinity,
    chip: { label: 'Dinner nearby ›', emoji: '🌙', kind: 'expand', nearbyType: 'restaurant' },
  },
];

// ── Public API ───────────────────────────────────────────────────

/**
 * Returns up to 4 contextual chips for a stop.
 * @param googleTypes  Google Place types[] for the stop (from usePlaceDetails cache)
 * @param timeMins     Current stop start time in minutes from midnight
 */
export function getContextualChips(googleTypes: string[], timeMins: number): ChipDef[] {
  // Find first matching group
  const group =
    CHIP_GROUPS.find(g => g.types.some(t => googleTypes.includes(t))) ??
    FALLBACK_GROUP;

  // Build initial chip list from type group
  const typeChips: ChipDef[] = [
    ...group.expand.map(e => ({ label: e.label, emoji: e.emoji, kind: 'expand' as const, nearbyType: e.nearbyType })),
    ...group.direct.map(d => ({ label: d.label, emoji: d.emoji, kind: 'direct' as const })),
  ];

  // Check for a time-based chip
  const timeChip = TIME_CHIPS.find(
    tc => timeMins >= tc.minStart && timeMins < tc.minEnd,
  )?.chip ?? null;

  if (!timeChip) return typeChips.slice(0, 4);

  // Time chip prepended; if total would exceed 4, drop the first type chip
  const combined =
    typeChips.length < 4
      ? [timeChip, ...typeChips]
      : [timeChip, ...typeChips.slice(1)];

  return combined.slice(0, 4);
}

// ── Direct chip URL builder ──────────────────────────────────────

export interface DirectChipStop {
  place: string;
  lat: number;
  lon: number;
}

/**
 * Builds a Maps deep-link for a direct chip.
 * @param label   The chip label (including the ↗ suffix)
 * @param stop    Stop coordinates and name
 * @param isMac   true for Apple Maps base, false for Google Maps
 */
export function buildDirectUrl(
  label: string,
  stop: DirectChipStop,
  isMac: boolean,
): string {
  const appleBase = 'maps://maps.apple.com/';
  const googleBase = 'https://maps.google.com/maps';
  const googleSearch = 'https://maps.google.com/';
  const gSearch = 'https://www.google.com/search';
  const { lat, lon, place } = stop;

  if (label === 'Restrooms ↗') {
    return isMac
      ? `${appleBase}?q=restroom&near=${lat},${lon}`
      : `${googleSearch}?q=restroom&near=${lat},${lon}`;
  }
  if (label === 'Trail map ↗') {
    return isMac
      ? `${appleBase}?q=hiking+trail&near=${lat},${lon}`
      : `${googleSearch}?q=hiking+trail&near=${lat},${lon}`;
  }
  if (label === 'Walk it off ↗') {
    return isMac
      ? `${appleBase}?saddr=${lat},${lon}&dirflg=w`
      : `${googleBase}?saddr=${lat},${lon}&dirflg=w`;
  }
  if (label === 'Leave review ↗') {
    return `https://maps.google.com/?q=${encodeURIComponent(place)}`;
  }
  if (label === 'Street view ↗') {
    return `https://maps.google.com/?q=${lat},${lon}&layer=c`;
  }
  if (label === 'Book tickets ↗' || label === 'Book ahead ↗') {
    return `${gSearch}?q=tickets+${encodeURIComponent(place)}`;
  }
  if (label === 'Prayer times ↗') {
    return `${gSearch}?q=prayer+times+${encodeURIComponent(place)}`;
  }
  if (label === 'Dress code ↗') {
    return `${gSearch}?q=dress+code+${encodeURIComponent(place)}`;
  }
  // Explore nearby (fallback)
  return isMac
    ? `${appleBase}?q=things+to+do&near=${lat},${lon}`
    : `${googleSearch}?q=things+to+do&near=${lat},${lon}`;
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run src/modules/route/chip-utils.test.ts
```

Expected: All tests PASS (37 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/route/chip-utils.ts frontend/src/modules/route/chip-utils.test.ts
git commit -m "feat: add chip-utils — contextual chip taxonomy + direct URL builder"
```

---

### Task 3: Update `RecoCard` and `RecoChip` in `ItineraryCards.tsx`

**Files:**
- Modify: `frontend/src/modules/route/ItineraryCards.tsx`

**Context:** `RecoCard` is around line 480. It currently calls `getRecoChips()` and renders `<RecoChip>` (display-only). We need to:
1. Import `getContextualChips`, `buildDirectUrl`, `ChipDef` from `./chip-utils`
2. Import `getAllCachedDetails`, `getCachedPlaceIdKey` from `../map/usePlaceDetails`
3. Import `fetchNearby`, `NearbyResult` from `../../shared/api` and `../../shared/types`
4. Replace `RecoCard` internals to use new chip logic with expand state
5. Replace `RecoChip` with two new variants: `ExpandChip` and `DirectChip`

- [ ] **Step 1: Add imports to `ItineraryCards.tsx`**

Replace the existing import block at line 1–9 with:

```ts
import { useState, useRef, useEffect, useMemo } from 'react';
import type { ItineraryStop, Place, TripContext, Persona, WeatherData, ItinerarySummary, NearbyResult } from '../../shared/types';
import { fetchNearby } from '../../shared/api';
import { resolveScene, resolveTransition } from './sceneMap';
import {
  parseTimeLabel,
  buildTimeline,
  personaMatchNote,
  type StopWithTime,
} from './ItineraryView';
import { getContextualChips, buildDirectUrl, type ChipDef } from './chip-utils';
import { getAllCachedDetails, getCachedPlaceIdKey } from '../map/usePlaceDetails';
```

- [ ] **Step 2: Remove `getRecoChips` and replace `RecoCard`**

Delete the `getRecoChips` function (lines 50–84 in the original file).

Replace the `RecoCard` function (from `function RecoCard` through the closing `}`) with:

```tsx
function RecoCard({
  currentItem,
  nextItem,
}: {
  currentItem: StopWithTime;
  nextItem: StopWithTime | null;
}) {
  const { stop, startMins } = currentItem;
  const transit = stop.transit_to_next;

  // Read Google types from cache
  const placeId = stop.place && stop.lat != null && stop.lon != null
    ? getCachedPlaceIdKey(stop.place, stop.lat!, stop.lon!)
    : undefined;
  const googleTypes: string[] = placeId
    ? (getAllCachedDetails().get(placeId)?.types ?? [])
    : [];

  const chips = getContextualChips(googleTypes, startMins);

  // Expand state — null means no chip open
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [results, setResults] = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(false);

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

  async function handleExpandTap(chip: ChipDef) {
    if (!chip.nearbyType) return;
    if (openLabel === chip.label) {
      setOpenLabel(null);
      setResults([]);
      return;
    }
    setOpenLabel(chip.label);
    setResults([]);
    if (stop.lat == null || stop.lon == null) return;
    setLoading(true);
    try {
      const data = await fetchNearby(stop.lat!, stop.lon!, chip.nearbyType);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }

  function handleDirectTap(chip: ChipDef) {
    const url = buildDirectUrl(chip.label, { place: stop.place, lat: stop.lat!, lon: stop.lon! }, isMac);
    window.open(url, '_blank', 'noopener');
  }

  return (
    <>
      {/* Dark gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.88) 100%)',
      }} />

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 80px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Transit strip */}
        {transit && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 12,
            background: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.15)',
            alignSelf: 'flex-start',
          }}>
            <span className="ms fill" style={{ color: '#38bdf8', fontSize: 15 }}>directions</span>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{transit}</span>
          </div>
        )}

        {/* Heading */}
        <div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            While you're here
          </p>
          {nextItem && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, margin: 0 }}>
              Next up: <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{nextItem.stop.place}</span>
            </p>
          )}
        </div>

        {/* Chip row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chips.map((chip, i) =>
            chip.kind === 'expand' ? (
              <ExpandChip
                key={i}
                chip={chip}
                isOpen={openLabel === chip.label}
                onTap={() => handleExpandTap(chip)}
              />
            ) : (
              <DirectChip
                key={i}
                chip={chip}
                onTap={() => handleDirectTap(chip)}
              />
            )
          )}
        </div>

        {/* Expand panel */}
        {openLabel && (
          <ExpandPanel
            label={openLabel}
            results={results}
            loading={loading}
            isMac={isMac}
          />
        )}

        {/* Swipe hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Swipe to continue</span>
          <span className="ms" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>expand_more</span>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Replace `RecoChip` with `ExpandChip`, `DirectChip`, and `ExpandPanel`**

Delete the existing `RecoChip` function (lines 558–577 in the original).

Add these three components in its place (after `RecoCard`):

```tsx
function ExpandChip({
  chip,
  isOpen,
  onTap,
}: {
  chip: ChipDef;
  isOpen: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 99,
        border: `1px solid ${isOpen ? 'rgba(99,102,241,.5)' : 'rgba(99,102,241,.3)'}`,
        background: isOpen ? 'rgba(99,102,241,.25)' : 'rgba(99,102,241,.15)',
        backdropFilter: 'blur(10px)',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 13 }}>{chip.emoji}</span>
      <span style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 500 }}>{chip.label}</span>
    </button>
  );
}

function DirectChip({
  chip,
  onTap,
}: {
  chip: ChipDef;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 99,
        border: '1px solid rgba(255,255,255,.12)',
        background: 'rgba(255,255,255,.07)',
        backdropFilter: 'blur(10px)',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 13 }}>{chip.emoji}</span>
      <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>{chip.label}</span>
    </button>
  );
}

function ExpandPanel({
  label,
  results,
  loading,
  isMac,
}: {
  label: string;
  results: NearbyResult[];
  loading: boolean;
  isMac: boolean;
}) {
  function openDirections(r: NearbyResult) {
    const appleBase = 'maps://maps.apple.com/';
    const googleBase = 'https://maps.google.com/maps';
    const url = isMac
      ? `${appleBase}?daddr=${r.lat},${r.lon}&dirflg=w`
      : `${googleBase}?daddr=${r.lat},${r.lon}&dirflg=w`;
    window.open(url, '_blank', 'noopener');
  }

  return (
    <div style={{
      background: 'rgba(99,102,241,.08)',
      border: '1px solid rgba(99,102,241,.2)',
      borderRadius: 12,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, color: '#818cf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label.replace(' ›', '')}
      </div>

      {loading ? (
        // Skeleton rows
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ width: 120, height: 10, borderRadius: 4, background: 'rgba(255,255,255,.1)', animation: 'shimmer 1.5s infinite' }} />
                <div style={{ width: 80, height: 8, borderRadius: 4, background: 'rgba(255,255,255,.07)', animation: 'shimmer 1.5s infinite' }} />
              </div>
              <div style={{ width: 44, height: 26, borderRadius: 8, background: 'rgba(255,255,255,.07)', animation: 'shimmer 1.5s infinite' }} />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, margin: 0 }}>Nothing found nearby</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {results.map((r, i) => {
            const walkMins = Math.ceil(r.distance_m / 80);
            return (
              <div key={r.place_id}>
                {i > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 7 }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>
                      {walkMins} min walk{r.rating != null ? ` · ★ ${r.rating}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => openDirections(r)}
                    style={{
                      background: i === 0 ? '#4f46e5' : 'rgba(255,255,255,.07)',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 9,
                      color: '#fff',
                      fontWeight: i === 0 ? 600 : 400,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Go ↗
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify the frontend builds without TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npm run build
```

Expected: Build completes with no TypeScript errors. Warnings about `!` non-null assertions on `stop.lat`/`stop.lon` are acceptable if the build passes.

- [ ] **Step 5: Run all frontend tests**

```bash
cd /Users/souravbiswas/uncover-roads/.worktrees/google-maplibre/frontend
npx vitest run
```

Expected: All tests pass including the 37 chip-utils tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/route/ItineraryCards.tsx
git commit -m "feat: replace static RecoCard chips with contextual expand/direct chips"
```

---

## Self-Review

**Spec coverage:**
- ✅ Two chip types (expand indigo `›`, direct white `↗`) — Task 3 ExpandChip/DirectChip
- ✅ Expand chip calls `/nearby` — Task 3 `handleExpandTap`
- ✅ Direct chip opens Maps deep-link — Task 3 `handleDirectTap` + Task 2 `buildDirectUrl`
- ✅ One expand panel at a time; tapping active chip collapses it — `openLabel === chip.label` toggle logic
- ✅ Chip highlights when open — border brightens in `ExpandChip` `isOpen` branch
- ✅ Panel: 3 results, name, walk time, rating — `ExpandPanel` with `distance_m ÷ 80` walk time
- ✅ Each result has "Go ↗" button — `openDirections` in `ExpandPanel`
- ✅ Top result solid indigo, others muted — `i === 0` conditional in ExpandPanel
- ✅ Skeleton while loading — 3 skeleton rows in `ExpandPanel` loading branch
- ✅ "Nothing found nearby" on empty — `results.length === 0` branch
- ✅ Full chip taxonomy — all 8 groups in CHIP_GROUPS + FALLBACK_GROUP
- ✅ Time-based chips — TIME_CHIPS in chip-utils
- ✅ Max 4 chips total — `slice(0, 4)` + first-chip replacement logic
- ✅ Platform detection for Maps links — `isMac` passed through
- ✅ All direct chip URLs — `buildDirectUrl` covers all 10 label types
- ✅ `/nearby` endpoint — Task 1 with Haversine distance, rate limiting, Cache-Control
- ✅ `NearbyResult` type — Task 1
- ✅ `fetchNearby` client function — Task 1
- ✅ Read Google types from cache via `getAllCachedDetails` + `getCachedPlaceIdKey` — Task 3 RecoCard
- ✅ No prop drilling — RecoCard reads cache directly

**Placeholder scan:** No TBDs, TODOs, or incomplete sections found.

**Type consistency:** `ChipDef` defined in Task 2 and imported in Task 3. `NearbyResult` defined in Task 1 and used in Task 3. `DirectChipStop` defined in Task 2 and used in Task 2 tests. All consistent.
