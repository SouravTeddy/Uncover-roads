# Trip Card Redesign + Multi-City Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the TripPlanningCard modal (date strip, hotel input, start time) to be immersive and easy to read, then lay the multi-city foundation by tagging every place with its city and showing a journey breadcrumb when places from multiple cities are selected.

**Architecture:** All existing logic in `useTripPlanInput.ts` and `trip-utils.ts` is unchanged — only the visual layer of `TripPlanningCard.tsx` is replaced. Multi-city detection is a pure utility layer (`journey-utils.ts`) consumed by `MapScreen.tsx` to show a `JourneyBreadcrumb` component. Place city tagging happens at the data layer in `api.ts` (`mapData` stamps `_city` on every returned place).

**Tech Stack:** React 18, TypeScript, Tailwind CSS (design tokens: `primary:#3b82f6`, `bg:#0f172a`, font-heading: Plus Jakarta Sans, font-sans: Inter), Material Symbols Outlined icons, Vitest for tests.

---

## Design Language Reference

All new UI must follow these constants (already used throughout the app):

```
Background:   #0f172a  (Tailwind: bg)
Surface:      #141921  (PinCard) / #1A1F2B (cards)
Primary:      #3b82f6  (Tailwind: primary)
Text-1:       #f1f5f9
Text-2:       #cbd5e1
Text-3:       #8e9099
Heading font: "Plus Jakarta Sans" weight 700/800
Body font:    Inter weight 400/500/600
Min font:     12px body, 14px input, 16-20px headings
Border:       rgba(255,255,255,.08)
```

Icons: Material Symbols Outlined (`<span className="ms">icon_name</span>`) — already loaded in the app.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `frontend/src/shared/types.ts` | Modify | Add `_city?: string` to `Place` |
| `frontend/src/shared/api.ts` | Modify | `mapData()` + `_fetchOverpassMapData()` stamp `_city` on results |
| `frontend/src/modules/map/journey-utils.ts` | **Create** | Pure functions: `getJourneyCities`, `isJourneyMode`, `haversineKm`, `suggestTransportMode` |
| `frontend/src/modules/map/journey-utils.test.ts` | **Create** | Vitest tests for journey utils |
| `frontend/src/modules/map/JourneyBreadcrumb.tsx` | **Create** | Animated city pill strip — renders in MapScreen |
| `frontend/src/modules/map/MapScreen.tsx` | Modify | Stamp `_city` on Nominatim search results; render `JourneyBreadcrumb` |
| `frontend/src/modules/map/TripPlanningCard.tsx` | Modify | Full visual redesign — logic (`useTripPlanInput`) untouched |
| `main.py` | Modify | `/geocode` returns `country` field |

---

## Task 1: Add `_city` to the Place type

**Files:**
- Modify: `frontend/src/shared/types.ts:87-102`

- [ ] **Step 1: Add `_city` field to Place interface**

Open `frontend/src/shared/types.ts`. The `Place` interface currently ends at `price_level`. Add one optional field:

```typescript
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
  // Journey mode — city context stamped on fetch
  _city?: string;
}
```

- [ ] **Step 2: Run tests to confirm nothing breaks**

```bash
cd frontend && npm run test -- --run
```

Expected: 59 passed (0 failures) — the type addition is purely additive.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/types.ts
git commit -m "feat: add _city field to Place type for journey mode"
```

---

## Task 2: Stamp `_city` on every fetched place

**Files:**
- Modify: `frontend/src/shared/api.ts:98-189`

The `mapData` function and its Overpass fallback both build `Place[]`. Neither stamps `_city` today. Fix both.

- [ ] **Step 1: Stamp `_city` in `_fetchOverpassMapData`**

`_fetchOverpassMapData` takes `lat, lon, radiusM` but doesn't know the city name. Add a `city` parameter:

```typescript
async function _fetchOverpassMapData(
  lat: number,
  lon: number,
  radiusM: number,
  city = '',
): Promise<Place[]> {
  // ... existing query/fetch logic unchanged ...

  // In the place-building loop, add _city:
  places.push({
    id: `osm-${e.type ?? 'n'}-${e.id ?? name}`,
    title: name,
    lat: elLat,
    lon: elLon,
    category: _overpassCategory(tags) as Place['category'],
    _city: city,          // ← ADD THIS
    tags: {
      opening_hours: tags.opening_hours ?? '',
      website: tags.website ?? '',
      cuisine: tags.cuisine ?? '',
      description: tags.description ?? '',
    },
  });
```

- [ ] **Step 2: Stamp `_city` in `mapData` and pass it to Overpass**

```typescript
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
  try {
    const res = await fetch(`${BASE}/map-data?${params}`);
    console.log(`[mapData] backend → ${res.status}`);
    if (res.ok) {
      const data: Place[] = await res.json();
      console.log(`[mapData] backend returned ${data.length} places`);
      if (data.length > 0) {
        // Stamp _city on backend results (backend doesn't set it)
        return data.map(p => ({ ...p, _city: p._city ?? city }));
      }
    }
  } catch (err) {
    console.error('[mapData] backend fetch failed:', err);
  }
  console.log('[mapData] falling back to client-side Overpass');
  return _fetchOverpassMapData(centerLat, centerLon, radiusM, city);  // ← pass city
}
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm run test -- --run
```

Expected: 59 passed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/api.ts
git commit -m "feat: stamp _city on all fetched places (backend + Overpass)"
```

---

## Task 3: Journey utils — pure functions + tests

**Files:**
- Create: `frontend/src/modules/map/journey-utils.ts`
- Create: `frontend/src/modules/map/journey-utils.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `frontend/src/modules/map/journey-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Place } from '../../shared/types';
import {
  getJourneyCities,
  isJourneyMode,
  haversineKm,
  suggestTransportMode,
} from './journey-utils';

const makePlaces = (cities: string[]): Place[] =>
  cities.map((c, i) => ({
    id: `p${i}`, title: `Place ${i}`, category: 'tourism' as const,
    lat: 0, lon: 0, _city: c,
  }));

describe('getJourneyCities', () => {
  it('returns empty array for no places', () => {
    expect(getJourneyCities([])).toEqual([]);
  });

  it('returns single city for same-city places', () => {
    expect(getJourneyCities(makePlaces(['Tokyo', 'Tokyo', 'Tokyo']))).toEqual(['Tokyo']);
  });

  it('returns ordered unique cities matching place add order', () => {
    expect(getJourneyCities(makePlaces(['Tokyo', 'Kyoto', 'Tokyo', 'Osaka']))).toEqual(['Tokyo', 'Kyoto', 'Osaka']);
  });

  it('ignores places with no _city', () => {
    const places: Place[] = [
      { id: 'a', title: 'A', category: 'park', lat: 0, lon: 0, _city: 'Tokyo' },
      { id: 'b', title: 'B', category: 'park', lat: 0, lon: 0 }, // no _city
    ];
    expect(getJourneyCities(places)).toEqual(['Tokyo']);
  });
});

describe('isJourneyMode', () => {
  it('false for empty', () => expect(isJourneyMode([])).toBe(false));
  it('false for single city', () => expect(isJourneyMode(makePlaces(['Tokyo']))).toBe(false));
  it('true for two cities', () => expect(isJourneyMode(makePlaces(['Tokyo', 'Kyoto']))).toBe(true));
  it('true for three cities', () => expect(isJourneyMode(makePlaces(['Tokyo', 'Dubai', 'Sydney']))).toBe(true));
});

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(35.68, 139.69, 35.68, 139.69)).toBeCloseTo(0, 1);
  });

  it('Tokyo to Kyoto is ~370km', () => {
    // Tokyo: 35.68, 139.69 | Kyoto: 35.01, 135.77
    expect(haversineKm(35.68, 139.69, 35.01, 135.77)).toBeCloseTo(370, -1);
  });

  it('London to New York is ~5500km', () => {
    expect(haversineKm(51.5, -0.12, 40.71, -74.01)).toBeCloseTo(5570, -2);
  });
});

describe('suggestTransportMode', () => {
  it('train for <150km', () => expect(suggestTransportMode(80)).toBe('train'));
  it('bullet_train for 150-600km', () => expect(suggestTransportMode(370)).toBe('bullet_train'));
  it('flight for >600km', () => expect(suggestTransportMode(700)).toBe('flight'));
  it('flight for intercontinental', () => expect(suggestTransportMode(5500)).toBe('flight'));
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd frontend && npm run test -- --run
```

Expected: FAIL — "Cannot find module './journey-utils'"

- [ ] **Step 3: Create `journey-utils.ts`**

Create `frontend/src/modules/map/journey-utils.ts`:

```typescript
import type { Place } from '../../shared/types';

export type TransportMode = 'train' | 'bullet_train' | 'flight' | 'ferry';

/**
 * Returns ordered unique city names from selectedPlaces, preserving
 * the order places were added. Places without _city are skipped.
 */
export function getJourneyCities(places: Place[]): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const p of places) {
    const c = p._city;
    if (c && !seen.has(c)) {
      seen.add(c);
      cities.push(c);
    }
  }
  return cities;
}

/**
 * Returns true when selectedPlaces contains places from more than one city.
 */
export function isJourneyMode(places: Place[]): boolean {
  return getJourneyCities(places).length > 1;
}

/**
 * Haversine great-circle distance in kilometres between two lat/lon points.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Suggests a transport mode based on straight-line distance between cities.
 * < 150 km  → train/bus
 * 150–600 km → bullet train or short-haul
 * > 600 km  → flight
 */
export function suggestTransportMode(distanceKm: number): TransportMode {
  if (distanceKm < 150) return 'train';
  if (distanceKm < 600) return 'bullet_train';
  return 'flight';
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd frontend && npm run test -- --run
```

Expected: all tests pass (previously 59, now 59 + new journey-utils tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/journey-utils.ts frontend/src/modules/map/journey-utils.test.ts
git commit -m "feat: journey-utils — getJourneyCities, isJourneyMode, haversineKm, suggestTransportMode"
```

---

## Task 4: JourneyBreadcrumb component

**Files:**
- Create: `frontend/src/modules/map/JourneyBreadcrumb.tsx`

- [ ] **Step 1: Create `JourneyBreadcrumb.tsx`**

```tsx
import { useEffect, useState } from 'react';

interface Props {
  cities: string[];
}

/**
 * Animated pill strip showing the journey cities in order.
 * Fades + slides in when journey mode activates (>1 city).
 * Returns null when only 1 city is selected.
 */
export function JourneyBreadcrumb({ cities }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (cities.length > 1) {
      // Defer to next frame so CSS transition fires
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
    }
  }, [cities.length]);

  if (cities.length <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
        scrollbarWidth: 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity .35s ease, transform .35s ease',
        pointerEvents: 'auto',
      }}
    >
      {cities.map((city, i) => (
        <span key={city + i} style={{ display: 'contents' }}>
          <span
            style={{
              flexShrink: 0,
              height: 26,
              padding: '0 10px',
              background: 'rgba(59,130,246,.12)',
              border: '1px solid rgba(59,130,246,.25)',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: '#93c5fd',
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {city}
          </span>
          {i < cities.length - 1 && (
            <span
              className="ms"
              style={{ fontSize: 13, color: 'rgba(148,163,184,.4)', flexShrink: 0 }}
            >
              arrow_forward
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire JourneyBreadcrumb into MapScreen**

In `frontend/src/modules/map/MapScreen.tsx`:

Add import at top:
```typescript
import { JourneyBreadcrumb } from './JourneyBreadcrumb';
import { getJourneyCities } from './journey-utils';
```

For Nominatim search results, stamp `_city` when a place is created from search. Find `handleSelectResult` (~line 260) and update the place object:

```typescript
function handleSelectResult(r: NominatimResult) {
  const lat = parseFloat(r.lat);
  const lon = parseFloat(r.lon);
  const name = r.name || r.display_name.split(',')[0];
  const category = nominatimToCategory(r.class, r.type);
  const place: Place = {
    id: `nominatim-${r.place_id}`,
    title: name,
    category,
    lat,
    lon,
    _city: city,    // ← ADD: stamp current city context
  };
  // ... rest unchanged
}
```

Inside the top overlay `<div>` (after the FilterBar row), add the breadcrumb:

```tsx
{/* Journey breadcrumb — visible when places from >1 city are selected */}
<div style={{ pointerEvents: 'auto' }}>
  <JourneyBreadcrumb cities={getJourneyCities(selectedPlaces)} />
</div>
```

Place this between the FilterBar div and the closing tag of the top overlay:

```tsx
{/* Filter bar */}
<div style={{ pointerEvents: 'auto' }}>
  <FilterBar active={activeFilter as MapFilter} counts={counts} onSelect={handleFilterSelect} />
</div>

{/* Journey breadcrumb */}
<div style={{ pointerEvents: 'auto' }}>
  <JourneyBreadcrumb cities={getJourneyCities(selectedPlaces)} />
</div>
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm run test -- --run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/JourneyBreadcrumb.tsx frontend/src/modules/map/MapScreen.tsx
git commit -m "feat: JourneyBreadcrumb — animated city pill strip for multi-city mode"
```

---

## Task 5: Backend `/geocode` returns `country`

**Files:**
- Modify: `main.py` (geocode endpoint, ~line where the return dict is built)
- Modify: `frontend/src/shared/types.ts` (GeoData interface)

- [ ] **Step 1: Find and update the geocode endpoint in `main.py`**

Search for `@app.get("/geocode")` in `main.py`. The endpoint calls Nominatim and returns a dict. Add `country` to the return:

```python
@app.get("/geocode")
def geocode(city: str = Query(...)):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": city, "format": "json", "limit": 1,
        "addressdetails": 1,
        "accept-language": "en",
    }
    resp = requests.get(url, params=params, headers={"User-Agent": "UncoverRoads/1.0"}, timeout=8)
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise HTTPException(status_code=404, detail="City not found")
    r = results[0]
    addr = r.get("address", {})
    lat  = float(r["lat"])
    lon  = float(r["lon"])
    bb   = r.get("boundingbox", [str(lat-0.1), str(lat+0.1), str(lon-0.1), str(lon+0.1)])
    return {
        "lat":     lat,
        "lon":     lon,
        "city":    r.get("display_name", city),
        "country": addr.get("country", ""),          # ← ADD THIS
        "bbox":    [float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])],
    }
```

Note: The exact shape of the existing return dict may vary — find it and add `"country": addr.get("country", "")`. The `addressdetails: 1` param must be present for Nominatim to return address components. Check if it's already in the params; if not, add it.

- [ ] **Step 2: Update `GeoData` type in `frontend/src/shared/types.ts`**

```typescript
export interface GeoData {
  lat: number;
  lon: number;
  bbox: [number, number, number, number]; // south, north, west, east
  country?: string;   // ← ADD: ISO country name from Nominatim
}
```

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm run test -- --run
```

Expected: all tests pass (type change is additive, no logic changes).

- [ ] **Step 4: Commit**

```bash
git add main.py frontend/src/shared/types.ts
git commit -m "feat: /geocode returns country field for multi-city journey mode"
```

---

## Task 6: TripPlanningCard visual redesign

**Files:**
- Modify: `frontend/src/modules/map/TripPlanningCard.tsx`

**Do NOT change `useTripPlanInput.ts` or `trip-utils.ts`.** All logic hooks remain identical. Only the JSX/styles in `TripPlanningCard.tsx` change.

The current problems:
- Fonts: 8–11px — unreadable on mobile
- Date strip pills: 44px wide, cramped
- Chip icons: emoji instead of Material Symbols
- Colors: purple/indigo instead of app's blue primary
- The modal slides in from nothing — needs entrance animation
- Section labels too small (8px uppercase)
- Input font too small (11px)

- [ ] **Step 1: Replace `TripPlanningCard.tsx` with redesigned version**

Full file replacement (all logic props stay identical — only JSX changes):

```tsx
import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { useTripPlanInput } from './useTripPlanInput';
import type { StartChip } from './useTripPlanInput';

interface Props {
  onClose: () => void;
  onRequestPinDrop: () => void;
  pinDropResult: { lat: number; lon: number } | null;
  pinPlaceName?: string | null;
  onClearPin: () => void;
}

// ── Design tokens (match app theme) ─────────────────────────────
const SURFACE  = '#141921';
const SURFACE2 = '#1A1F2B';
const PRIMARY  = '#3b82f6';
const PRIMARY_BG = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1 = '#f1f5f9';
const TEXT2 = '#cbd5e1';
const TEXT3 = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

const CHIPS: Array<{ value: StartChip; icon: string; label: string }> = [
  { value: 'hotel',   icon: 'hotel',   label: 'Hotel'   },
  { value: 'airport', icon: 'flight',  label: 'Airport' },
  { value: 'pin',     icon: 'location_on', label: 'Drop pin' },
];

export function TripPlanningCard({
  onClose,
  onRequestPinDrop,
  pinDropResult,
  pinPlaceName,
  onClearPin,
}: Props) {
  const { state } = useAppStore();
  const city        = state.city;
  const placesCount = state.selectedPlaces.length;
  const locationInputRef = useRef<HTMLDivElement>(null);

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const {
    dates, selectedDate, setSelectedDate,
    startChip, handleChipChange,
    locationQuery, locationResults, locationLoading, selectedLocation,
    handleLocationInput, handleSelectLocation,
    startTimeDisplay,
    canBuild, handleBuild,
  } = useTripPlanInput();

  function handlePinChip() {
    handleChipChange('pin');
    onRequestPinDrop();
    onClose();
  }

  function handleClearPin() {
    onClearPin();
    handleChipChange('hotel');
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      />

      {/* Modal sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 16, right: 16,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
          zIndex: 51,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s ease',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            padding: '22px 20px 18px',
            background: `linear-gradient(135deg, rgba(59,130,246,.08) 0%, rgba(15,23,42,0) 60%)`,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          {/* Close */}
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>

          {/* Label + city */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: PRIMARY, marginBottom: 6,
            fontFamily: 'Inter, sans-serif',
          }}>
            Plan your day
          </div>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 22, fontWeight: 800, color: TEXT1, lineHeight: 1.1,
          }}>
            {city || 'Your City'}
          </div>
          <div style={{
            marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 24, padding: '0 10px',
            background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
            borderRadius: 999,
          }}>
            <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>place</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#93c5fd',
              fontFamily: 'Inter, sans-serif',
            }}>
              {placesCount} place{placesCount !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Starting point */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Starting point
            </div>

            {/* Chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {CHIPS.map(chip => {
                const active = startChip === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => {
                      if (chip.value === 'pin') { handlePinChip(); return; }
                      handleChipChange(chip.value);
                    }}
                    style={{
                      flex: 1,
                      height: 44,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 2,
                      background: active ? PRIMARY_BG : 'rgba(255,255,255,.04)',
                      border: `1.5px solid ${active ? PRIMARY_BORDER : BORDER}`,
                      borderRadius: 14, cursor: 'pointer',
                      transition: 'all .15s ease',
                    }}
                  >
                    <span className="ms" style={{
                      fontSize: 17,
                      color: active ? PRIMARY : TEXT3,
                    }}>
                      {chip.icon}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: active ? '#93c5fd' : TEXT3,
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {chip.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Pin drop confirmation */}
            {pinDropResult ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px',
                background: 'rgba(20,184,166,.08)',
                border: '1px solid rgba(20,184,166,.25)',
                borderRadius: 14,
              }}>
                <span className="ms" style={{ fontSize: 18, color: '#2dd4bf', flexShrink: 0 }}>location_on</span>
                <span style={{ fontSize: 13, color: '#5eead4', flex: 1, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  {pinPlaceName ?? `${pinDropResult.lat.toFixed(4)}, ${pinDropResult.lon.toFixed(4)}`}
                </span>
                <button
                  onClick={handleClearPin}
                  style={{
                    fontSize: 11, fontWeight: 700, color: TEXT3,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Clear
                </button>
              </div>
            ) : startChip !== 'pin' && (
              /* Hotel/Airport search input */
              <div ref={locationInputRef} style={{ position: 'relative' }}>
                <div
                  style={{
                    background: SURFACE2,
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 14, height: 52,
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0 14px',
                    transition: 'border-color .15s',
                  }}
                >
                  <span className="ms" style={{ fontSize: 20, color: TEXT3, flexShrink: 0 }}>
                    {startChip === 'hotel' ? 'hotel' : 'flight'}
                  </span>
                  <input
                    type="text"
                    aria-label={startChip === 'hotel' ? 'Hotel or address search' : 'Airport search'}
                    value={locationQuery}
                    onChange={e => handleLocationInput(e.target.value)}
                    placeholder={startChip === 'hotel' ? 'Search hotel or address…' : 'Search airport…'}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      fontSize: 14, fontWeight: 600, color: TEXT1,
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      caretColor: PRIMARY,
                    }}
                  />
                  {locationLoading && (
                    <span className="ms animate-spin" style={{ fontSize: 16, color: TEXT3, flexShrink: 0 }}>autorenew</span>
                  )}
                  {selectedLocation && !locationLoading && (
                    <span className="ms" style={{ fontSize: 18, color: '#4ade80', flexShrink: 0 }}>check_circle</span>
                  )}
                </div>

                {locationResults.length > 0 && (() => {
                  const rect = locationInputRef.current?.getBoundingClientRect();
                  if (!rect) return null;
                  return createPortal(
                    <div
                      style={{
                        position: 'fixed',
                        top: rect.bottom + 4,
                        left: rect.left,
                        width: rect.width,
                        zIndex: 9999,
                        background: '#1E2535',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,.6)',
                      }}
                    >
                      {locationResults.map((r, i) => (
                        <button
                          key={r.place_id}
                          onMouseDown={() => handleSelectLocation(r)}
                          style={{
                            width: '100%', textAlign: 'left',
                            padding: '12px 16px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                            display: 'flex', alignItems: 'center', gap: 12,
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: PRIMARY_BG,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span className="ms" style={{ fontSize: 16, color: PRIMARY }}>
                              {startChip === 'hotel' ? 'hotel' : 'flight'}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                              {r.main_text}
                            </div>
                            <div style={{ fontSize: 11, color: TEXT3, marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
                              {r.secondary_text}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>,
                    document.body,
                  );
                })()}
              </div>
            )}
          </div>

          {/* Travel date */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Travel date
            </div>
            <div style={{
              display: 'flex', gap: 6,
              overflowX: 'auto', paddingBottom: 4,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}>
              {dates.map(d => {
                const active = d.isoDate === selectedDate;
                const isToday = d === dates[0];
                return (
                  <button
                    key={d.isoDate}
                    onClick={() => setSelectedDate(d.isoDate)}
                    aria-label={`Select ${d.dayAbbr} ${d.dayNum}`}
                    aria-pressed={active}
                    style={{
                      flexShrink: 0, width: 52,
                      padding: '10px 4px 8px',
                      background: active ? PRIMARY_BG : 'rgba(255,255,255,.04)',
                      border: `1.5px solid ${active ? PRIMARY_BORDER : BORDER}`,
                      borderRadius: 14, textAlign: 'center', cursor: 'pointer',
                      transition: 'all .15s ease',
                    }}
                  >
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      color: active ? '#93c5fd' : TEXT3,
                      fontFamily: 'Inter, sans-serif',
                      marginBottom: 4,
                    }}>
                      {isToday ? 'TODAY' : d.dayAbbr.toUpperCase()}
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 800, lineHeight: 1,
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      color: active ? TEXT1 : 'rgba(255,255,255,.45)',
                    }}>
                      {d.dayNum}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recommended start time */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
            background: 'rgba(59,130,246,.06)',
            border: `1px solid ${PRIMARY_BORDER}`,
            borderRadius: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: PRIMARY_BG,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms" style={{ fontSize: 20, color: PRIMARY }}>schedule</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                textTransform: 'uppercase', color: '#60a5fa',
                fontFamily: 'Inter, sans-serif', marginBottom: 3,
              }}>
                Recommended start
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800, color: TEXT1, lineHeight: 1,
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}>
                {startTimeDisplay}
              </div>
            </div>
            <div style={{
              fontSize: 11, color: TEXT3, textAlign: 'right', lineHeight: 1.6,
              fontFamily: 'Inter, sans-serif',
            }}>
              Based on {placesCount} place{placesCount !== 1 ? 's' : ''}<br />
              + opening hours
            </div>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <div style={{ padding: 20 }}>
          <button
            onClick={() => handleBuild(pinDropResult)}
            disabled={!canBuild}
            style={{
              width: '100%', height: 54,
              background: canBuild
                ? `linear-gradient(135deg, ${PRIMARY}, #2563eb)`
                : 'rgba(255,255,255,.06)',
              border: 'none',
              borderRadius: 16, cursor: canBuild ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 15, fontWeight: 800,
              color: canBuild ? '#fff' : 'rgba(255,255,255,.25)',
              letterSpacing: 0.2,
              boxShadow: canBuild ? `0 4px 24px rgba(59,130,246,.35)` : 'none',
              transition: 'all .2s ease',
            }}
          >
            <span className="ms" style={{ fontSize: 20 }}>auto_fix</span>
            Build my itinerary
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm run test -- --run
```

Expected: all tests pass (pure visual change, no logic altered).

- [ ] **Step 3: Visual sanity check — open the app and tap "Build Itinerary"**

Verify:
- Modal slides up from bottom with smooth animation
- City name is large and readable (22px, Plus Jakarta Sans 800)
- Starting point chips show Material Symbols icons
- Date strip pills are wider (52px) with larger day numbers (18px)
- Location input is 52px tall with proper icon
- "Recommended start" block has icon + large time (18px)
- CTA button is 54px tall with gradient and glow

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/TripPlanningCard.tsx
git commit -m "feat: TripPlanningCard redesign — larger fonts, immersive header, slide-up animation"
```

---

## Task 7: Push and open PR

- [ ] **Step 1: Push the feature branch**

```bash
git push origin feature/google-maplibre
```

- [ ] **Step 2: Verify PR #35 has all commits**

The existing PR #35 tracks `feature/google-maplibre → main`. All commits from this plan will be included automatically since they're pushed to the same branch.

- [ ] **Step 3: Run full test suite one final time**

```bash
cd frontend && npm run test -- --run
```

Expected output:
```
Test Files  4 passed (4)
     Tests  XX passed (XX)
```
(previously 59 tests + new journey-utils tests)

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|------------|------|
| Fix bad design — date of travel card | Task 6 |
| Fix bad design — hotel location input | Task 6 |
| Bold fonts, easy to read | Task 6 (22px heading, 18px date, 14px input) |
| Add visuals where necessary | Task 6 (Material Symbols icons, gradient header, icon blocks) |
| Animations | Task 6 (slide-up modal, chip transitions) + Task 4 (breadcrumb fade-in) |
| Nothing breaks | Tests run after every task |
| Design language consistent | All tasks use SURFACE/PRIMARY/TEXT tokens matching app |
| Multi-city `_city` stamping | Tasks 1, 2 |
| Journey detection utils | Task 3 |
| Journey breadcrumb in map | Task 4 |
| Backend `/geocode` country | Task 5 |

**Placeholder scan:** No TBD, no "implement later", all code blocks complete.

**Type consistency:**
- `Place._city: string | undefined` — added in Task 1, used in Tasks 2, 3, 4
- `getJourneyCities(Place[]): string[]` — defined in Task 3, consumed in Task 4
- `JourneyBreadcrumb` props `{ cities: string[] }` — matches `getJourneyCities` return type
- `startChip: StartChip` — unchanged, imported from existing `useTripPlanInput`
- All `useTripPlanInput` return values used in Task 6 match the existing hook signature exactly
