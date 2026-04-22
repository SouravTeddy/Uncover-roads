# Map Search Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the map search tab with rotating placeholders, smart keyword extraction, area search, two-zone result rows, suggestion chips, a zoom-in nudge, glow-burst pin highlights, and a swipe-to-close fix on the cluster picker.

**Architecture:** Extract search logic into `useSmartSearch.ts` (pure functions, easily testable). New `SearchResultRow` and `SearchNudge` components handle display. `MapLibreMap` gains a forwarded ref for `flyTo` and passes viewport bounds via `onMoveEnd`. `MapLibreMarkers` gains a `highlightIds` prop for the glow animation. `MapScreen` wires everything together.

**Tech Stack:** React 18, TypeScript, MapLibre GL (via react-map-gl), Vitest, Tailwind CSS

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/modules/map/useSmartSearch.ts` | `nominatimSearch`, `nominatimToCategory`, `extractSearchIntent`, `getChipsForQuery`, parallel multi-type search |
| Create | `src/modules/map/useSmartSearch.test.ts` | Unit tests for extraction and chip logic |
| Create | `src/modules/map/SearchResultRow.tsx` | Two-zone result row (navigate left, open card right) |
| Create | `src/modules/map/SearchNudge.tsx` | Suggestion chips + zoom-in nudge banner |
| Modify | `src/modules/map/MapLibreMap.tsx` | Forwarded ref with `flyTo`, pass bounds to `onMoveEnd` |
| Modify | `src/modules/map/MapLibreMarkers.tsx` | `highlightIds` prop + glow burst CSS class |
| Modify | `src/index.css` | `@keyframes marker-glow-burst` animation |
| Modify | `src/modules/map/MapScreen.tsx` | Rotating placeholder, cluster swipe fix, area search, zoomend re-run, wiring |

---

## Task 1: Create `useSmartSearch.ts` — search logic + extraction

**Files:**
- Create: `frontend/src/modules/map/useSmartSearch.ts`

- [ ] **Step 1: Write the file**

```typescript
// frontend/src/modules/map/useSmartSearch.ts
import type { Category } from '../../shared/types';

// ── Types ────────────────────────────────────────────────────────

export interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  class: string;
  type: string;
}

export interface SuggestedChip {
  emoji: string;
  label: string;
  type: Category;
}

export interface SearchIntent {
  /** Place categories extracted from the query. Empty = no match found. */
  types: Category[];
  /** Named location extracted (e.g. "Eiffel Tower"). Null = use map bbox. */
  locationQuery: string | null;
  /** Chips to show when types is empty. */
  chips: SuggestedChip[];
}

// ── Dictionaries ─────────────────────────────────────────────────

const DIRECT_MAP: [RegExp, Category][] = [
  [/museum|gallery|galleries|exhibit/i,           'museum'],
  [/park|garden|nature|outdoor/i,                 'park'],
  [/restaurant|dining|food|eat|lunch|dinner/i,    'restaurant'],
  [/cafe|coffee|brunch/i,                         'cafe'],
  [/bar|pub|nightlife/i,                          'place'],
  [/church|mosque|temple|cathedral|synagogue/i,   'historic'],
  [/landmark|monument|heritage|historic/i,        'historic'],
  [/hotel|hostel|accommodation|stay|sleep/i,      'tourism'],
];

const INTENT_MAP: [RegExp, SuggestedChip[]][] = [
  [/morning|breakfast|cozy/i,   [{ emoji: '☕', label: 'cafe', type: 'cafe' }, { emoji: '🥐', label: 'bakery', type: 'restaurant' }]],
  [/night|evening|drinks/i,     [{ emoji: '🍸', label: 'bar', type: 'place' }, { emoji: '🍽️', label: 'restaurant', type: 'restaurant' }]],
  [/kids|family|children/i,     [{ emoji: '🌿', label: 'park', type: 'park' }, { emoji: '🏛️', label: 'museum', type: 'museum' }]],
  [/culture|art|history/i,      [{ emoji: '🏛️', label: 'museum', type: 'museum' }, { emoji: '🏰', label: 'historic', type: 'historic' }]],
  [/nature|walk|green/i,        [{ emoji: '🌿', label: 'park', type: 'park' }]],
  [/shop|buy|market/i,          [{ emoji: '🛍️', label: 'market', type: 'place' }]],
];

const DEFAULT_CHIPS: SuggestedChip[] = [
  { emoji: '☕', label: 'cafe',    type: 'cafe' },
  { emoji: '🏛️', label: 'museum', type: 'museum' },
  { emoji: '🌿', label: 'park',   type: 'park' },
];

// ── Extraction ───────────────────────────────────────────────────

/** Extract place types and a named location from a free-text query. */
export function extractSearchIntent(query: string): SearchIntent {
  const types: Category[] = [];

  for (const [pattern, category] of DIRECT_MAP) {
    if (pattern.test(query) && !types.includes(category)) {
      types.push(category);
    }
  }

  // Named location: text after "near", "in", "at", "on", "around"
  const locMatch = query.match(/(?:near|in|at|on|around)\s+(.+?)(?:\s+and\b|\s+or\b|$)/i);
  const locationQuery = locMatch ? locMatch[1].trim() : null;

  // Chips for when types is empty
  let chips: SuggestedChip[] = [];
  if (types.length === 0) {
    for (const [pattern, suggestions] of INTENT_MAP) {
      if (pattern.test(query)) {
        chips = [...chips, ...suggestions];
        break; // first match wins
      }
    }
    if (chips.length === 0) chips = DEFAULT_CHIPS;
  }

  return { types, locationQuery, chips };
}

// ── Nominatim ────────────────────────────────────────────────────

export function nominatimToCategory(cls: string, type: string): Category {
  if (cls === 'amenity') {
    if (['restaurant', 'bar', 'fast_food', 'food_court', 'biergarten'].includes(type)) return 'restaurant';
    if (type === 'cafe') return 'cafe';
    if (type === 'museum') return 'museum';
  }
  if (cls === 'tourism') {
    if (['museum', 'gallery', 'artwork'].includes(type)) return 'museum';
    if (['hotel', 'hostel'].includes(type)) return 'tourism';
    if (['attraction', 'viewpoint', 'theme_park'].includes(type)) return 'tourism';
  }
  if (cls === 'historic') return 'historic';
  if (cls === 'leisure' || ['park', 'garden', 'nature_reserve'].includes(type)) return 'park';
  return 'place';
}

export async function nominatimSearch(
  query: string,
  bbox: [number, number, number, number] | null,
  signal: AbortSignal,
): Promise<NominatimResult[]> {
  const [south, north, west, east] = bbox ?? [0, 0, 0, 0];
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '10',
    'accept-language': 'en',
  });
  if (bbox) {
    params.set('viewbox', `${west},${north},${east},${south}`);
    params.set('bounded', '1');
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
    signal,
  });
  const data = await res.json();
  if (Array.isArray(data) && data.length === 0 && bbox) {
    params.delete('bounded');
    const res2 = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en' },
      signal,
    });
    return res2.json();
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Run one Nominatim call per type in parallel, merge + deduplicate by place_id.
 * Falls back to a plain text search when types array is empty.
 */
export async function multiTypeNominatimSearch(
  types: Category[],
  plainQuery: string,
  bbox: [number, number, number, number] | null,
  signal: AbortSignal,
): Promise<NominatimResult[]> {
  if (types.length === 0) {
    return nominatimSearch(plainQuery, bbox, signal);
  }

  const results = await Promise.all(
    types.map(type => nominatimSearch(type, bbox, signal)),
  );

  const seen = new Set<number>();
  const merged: NominatimResult[] = [];
  for (const batch of results) {
    for (const r of batch) {
      if (!seen.has(r.place_id)) {
        seen.add(r.place_id);
        merged.push(r);
      }
    }
  }
  return merged.slice(0, 10);
}

// ── Bbox helpers ─────────────────────────────────────────────────

/** Diagonal distance in km of a [south, north, west, east] bbox. */
export function bboxDiagonalKm(bbox: [number, number, number, number]): number {
  const [south, north, west, east] = bbox;
  const R = 6371;
  const dLat = ((north - south) * Math.PI) / 180;
  const dLon = ((east - west) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((south * Math.PI) / 180) *
      Math.cos((north * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/modules/map/useSmartSearch.ts
git commit -m "feat: add useSmartSearch with keyword extraction and multi-type Nominatim search"
```

---

## Task 2: Write tests for `useSmartSearch`

**Files:**
- Create: `frontend/src/modules/map/useSmartSearch.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// frontend/src/modules/map/useSmartSearch.test.ts
import { describe, it, expect } from 'vitest';
import { extractSearchIntent, bboxDiagonalKm } from './useSmartSearch';

describe('extractSearchIntent', () => {
  it('extracts a single direct type', () => {
    const result = extractSearchIntent('museum');
    expect(result.types).toEqual(['museum']);
    expect(result.locationQuery).toBeNull();
    expect(result.chips).toHaveLength(0);
  });

  it('extracts multiple types', () => {
    const result = extractSearchIntent('museums and parks');
    expect(result.types).toContain('museum');
    expect(result.types).toContain('park');
  });

  it('extracts a named location after "near"', () => {
    const result = extractSearchIntent('hotels near the Eiffel Tower');
    expect(result.types).toContain('tourism');
    expect(result.locationQuery).toBe('the Eiffel Tower');
  });

  it('extracts a named location after "in"', () => {
    const result = extractSearchIntent('cafes in Montmartre');
    expect(result.types).toContain('cafe');
    expect(result.locationQuery).toBe('Montmartre');
  });

  it('returns null locationQuery when no preposition present', () => {
    const result = extractSearchIntent('museum');
    expect(result.locationQuery).toBeNull();
  });

  it('returns intent chips for morning query with no direct type match', () => {
    const result = extractSearchIntent('somewhere cozy for morning');
    expect(result.types).toHaveLength(0);
    expect(result.chips.map(c => c.type)).toContain('cafe');
  });

  it('returns default chips for completely unrecognised query', () => {
    const result = extractSearchIntent('xyzzy foobar');
    expect(result.types).toHaveLength(0);
    expect(result.chips).toHaveLength(3);
    expect(result.chips.map(c => c.label)).toContain('museum');
  });

  it('does not produce chips when types are found', () => {
    const result = extractSearchIntent('museum');
    expect(result.chips).toHaveLength(0);
  });
});

describe('bboxDiagonalKm', () => {
  it('returns ~0 for zero-size bbox', () => {
    expect(bboxDiagonalKm([48.8, 48.8, 2.3, 2.3])).toBeCloseTo(0, 0);
  });

  it('returns > 15 for Paris city bbox', () => {
    // Rough Paris bbox
    expect(bboxDiagonalKm([48.815, 48.902, 2.224, 2.470])).toBeGreaterThan(15);
  });

  it('returns < 5 for a small neighbourhood bbox', () => {
    expect(bboxDiagonalKm([48.858, 48.870, 2.330, 2.345])).toBeLessThan(5);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd frontend
npx vitest run src/modules/map/useSmartSearch.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/modules/map/useSmartSearch.test.ts
git commit -m "test: add useSmartSearch extraction and bbox tests"
```

---

## Task 3: Extend `MapLibreMap` with `flyTo` ref + bounds in `onMoveEnd`

**Files:**
- Modify: `frontend/src/modules/map/MapLibreMap.tsx`

- [ ] **Step 1: Rewrite `MapLibreMap.tsx`**

Replace the entire file content:

```tsx
// frontend/src/modules/map/MapLibreMap.tsx
import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapRef as LibreMapRef, ViewStateChangeEvent, MapMouseEvent } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { MapLibreMarkers } from './MapLibreMarkers';
import { MapLibreRoute } from './MapLibreRoute';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export interface MapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

interface Props {
  center: [number, number]; // [lat, lon]
  zoom?: number;
  places: Place[];
  selectedPlace: Place | null;
  highlightIds?: Set<string>;
  onPlaceClick: (place: Place) => void;
  /** Called on every map move end. bbox = [south, north, west, east] */
  onMoveEnd: (center: [number, number], zoom: number, bbox: [number, number, number, number]) => void;
  onClick?: (lngLat: { lat: number; lng: number }) => void;
  routeGeojson?: GeoJSON.Feature<GeoJSON.LineString> | null;
  pinDropResult?: { lat: number; lon: number } | null;
  children?: React.ReactNode;
}

export const MapLibreMap = forwardRef<MapHandle, Props>(function MapLibreMap(
  { center, zoom = 13, places, selectedPlace, highlightIds, onPlaceClick, onMoveEnd, onClick, routeGeojson, pinDropResult, children },
  ref,
) {
  const mapRef = useRef<LibreMapRef>(null);

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lon: number, targetZoom = 15) {
      mapRef.current?.flyTo({ center: [lon, lat], zoom: targetZoom, duration: 800 });
    },
  }));

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      const { latitude, longitude, zoom: z } = e.viewState;
      const b = e.target.getBounds();
      onMoveEnd(
        [latitude, longitude],
        z,
        [b.getSouth(), b.getNorth(), b.getWest(), b.getEast()],
      );
    },
    [onMoveEnd],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: center[0], longitude: center[1], zoom }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={STYLE_URL}
      onMoveEnd={handleMoveEnd}
      onClick={onClick ? (e: MapMouseEvent) => onClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }) : undefined}
    >
      <MapLibreRoute geojson={routeGeojson ?? null} />
      <MapLibreMarkers
        places={places}
        selectedPlace={selectedPlace}
        highlightIds={highlightIds ?? new Set()}
        onPlaceClick={onPlaceClick}
      />
      {pinDropResult && (
        <Marker latitude={pinDropResult.lat} longitude={pinDropResult.lon}>
          <div className="pin-drop-marker">
            <div className="pin-drop-pulse" />
            <div className="pin-drop-dot" />
          </div>
        </Marker>
      )}
      {children}
    </Map>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/map/MapLibreMap.tsx
git commit -m "feat: expose flyTo handle and viewport bounds from MapLibreMap"
```

---

## Task 4: Add glow burst animation + `highlightIds` to `MapLibreMarkers`

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/modules/map/MapLibreMarkers.tsx`

- [ ] **Step 1: Add keyframe to `src/index.css`**

Append after the existing `@keyframes shimmer` block (around line 117):

```css
/* ── Marker glow burst (search area highlight) ───────────── */
@keyframes marker-glow-burst {
  0%   { transform: scale(1);   box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
  40%  { transform: scale(1.4); box-shadow: 0 0 16px 6px rgba(124,140,248,0.8); }
  100% { transform: scale(1);   box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
}
.marker-glow-burst {
  animation: marker-glow-burst 0.5s ease-out forwards;
}
```

- [ ] **Step 2: Update `MapLibreMarkers.tsx`**

Replace the entire file:

```tsx
// frontend/src/modules/map/MapLibreMarkers.tsx
import { Marker } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444',
  cafe:       '#f97316',
  park:       '#22c55e',
  museum:     '#8b5cf6',
  historic:   '#a16207',
  tourism:    '#0ea5e9',
  event:      '#ec4899',
  place:      '#6b7280',
};

interface Props {
  places: Place[];
  selectedPlace: Place | null;
  highlightIds: Set<string>;
  onPlaceClick: (place: Place) => void;
}

export function MapLibreMarkers({ places, selectedPlace, highlightIds, onPlaceClick }: Props) {
  return (
    <>
      {places.map((place) => {
        const isSelected =
          selectedPlace?.title === place.title &&
          selectedPlace?.lat === place.lat &&
          selectedPlace?.lon === place.lon;
        const color = CATEGORY_COLORS[place.category] ?? '#6b7280';
        const icon  = CATEGORY_ICONS[place.category] ?? 'location_on';
        const size  = isSelected ? 34 : 28;
        const shouldGlow = highlightIds.has(place.id);

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
              className={shouldGlow ? 'marker-glow-burst' : undefined}
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: color,
                border: isSelected ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.85)',
                boxShadow: isSelected
                  ? `0 0 0 2px ${color}, 0 3px 8px rgba(0,0,0,.45)`
                  : '0 2px 6px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="ms fill"
                style={{ fontSize: isSelected ? 17 : 14, color: '#fff', lineHeight: 1 }}
              >
                {icon}
              </span>
            </div>
          </Marker>
        );
      })}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css src/modules/map/MapLibreMarkers.tsx
git commit -m "feat: add glow burst highlight animation to map markers"
```

---

## Task 5: Create `SearchResultRow` component

**Files:**
- Create: `frontend/src/modules/map/SearchResultRow.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/modules/map/SearchResultRow.tsx
import type { NominatimResult } from './useSmartSearch';
import { CATEGORY_ICONS } from './types';
import { nominatimToCategory } from './useSmartSearch';

interface Props {
  result: NominatimResult;
  isLast: boolean;
  onNavigate: () => void;
  onOpenCard: () => void;
}

export function SearchResultRow({ result, isLast, onNavigate, onOpenCard }: Props) {
  const name    = result.name || result.display_name.split(',')[0];
  const address = result.display_name.split(',').slice(1, 3).join(',').trim();
  const category = nominatimToCategory(result.class, result.type);
  const icon     = CATEGORY_ICONS[category] ?? 'location_on';

  return (
    <div
      className="flex items-center"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,.05)' }}
    >
      {/* Left zone — navigate to pin */}
      <button
        onMouseDown={onNavigate}
        className="flex-1 flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 min-w-0"
      >
        <span className="ms fill text-primary flex-shrink-0" style={{ fontSize: 16 }}>{icon}</span>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          {address && <p className="text-white/35 text-xs truncate mt-0.5">{address}</p>}
        </div>
      </button>

      {/* Right zone — open PinCard */}
      <button
        onMouseDown={onOpenCard}
        className="flex-shrink-0 px-4 py-3 active:bg-white/5"
        aria-label="View details"
      >
        <span className="ms text-primary" style={{ fontSize: 20 }}>info</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/map/SearchResultRow.tsx
git commit -m "feat: add two-zone SearchResultRow component"
```

---

## Task 6: Create `SearchNudge` component

**Files:**
- Create: `frontend/src/modules/map/SearchNudge.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/modules/map/SearchNudge.tsx
import type { SuggestedChip } from './useSmartSearch';

interface Props {
  chips: SuggestedChip[];
  showZoomNudge: boolean;
  activeTypeLabel: string;
  onChipTap: (chip: SuggestedChip) => void;
}

export function SearchNudge({ chips, showZoomNudge, activeTypeLabel, onChipTap }: Props) {
  if (showZoomNudge) {
    return (
      <div
        className="mx-12 px-4 py-2 rounded-2xl text-xs flex items-center gap-2"
        style={{
          background: 'rgba(15,20,30,.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.08)',
          pointerEvents: 'auto',
        }}
      >
        <span className="ms text-primary flex-shrink-0" style={{ fontSize: 14 }}>zoom_in</span>
        <span className="text-white/60">
          Showing <span className="text-white/80">{activeTypeLabel}s</span> in this area.{' '}
          <span className="text-primary">Zoom in</span> for more accurate results.
        </span>
      </div>
    );
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="mx-12 px-4 py-3 rounded-2xl"
      style={{
        background: 'rgba(15,20,30,.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.08)',
        pointerEvents: 'auto',
      }}
    >
      <p className="text-white/40 text-xs mb-2">We're still learning — try one of these</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.type + chip.label}
            onMouseDown={() => onChipTap(chip)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:opacity-70"
            style={{
              background: 'rgba(124,140,248,.15)',
              border: '1px solid rgba(124,140,248,.3)',
              color: '#9aa0f5',
            }}
          >
            <span>{chip.emoji}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/map/SearchNudge.tsx
git commit -m "feat: add SearchNudge component with suggestion chips and zoom nudge"
```

---

## Task 7: Fix cluster picker swipe-to-close

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add refs after the existing `const [clusterGroup, setClusterGroup]` line (line ~106)**

Find this line:
```tsx
const [clusterGroup, setClusterGroup] = useState<{ places: Place[]; lat: number; lon: number } | null>(null);
```

Add immediately after it:
```tsx
const clusterSheetRef   = useRef<HTMLDivElement>(null);
const clusterTouchStartY = useRef(0);
const clusterDragY       = useRef(0);
```

- [ ] **Step 2: Add the swipe gesture `useEffect` after the existing `loadEvents` function (around line ~204)**

Add this new `useEffect`:
```tsx
// Swipe-to-close for cluster picker — mirrors PinCard gesture logic
useEffect(() => {
  const el = clusterSheetRef.current;
  if (!el || !clusterGroup) return;

  const onStart = (e: TouchEvent) => {
    clusterTouchStartY.current = e.touches[0].clientY;
    clusterDragY.current = 0;
  };
  const onMove = (e: TouchEvent) => {
    const dy = e.touches[0].clientY - clusterTouchStartY.current;
    if (dy > 0 && el) {
      if (e.cancelable) e.preventDefault();
      el.style.transition = 'none';
      el.style.transform  = `translateY(${dy}px)`;
      clusterDragY.current = dy;
    }
  };
  const onEnd = () => {
    if (!el) return;
    el.style.transition = '';
    if (clusterDragY.current > 80) {
      el.style.transform = 'translateY(100%)';
      setTimeout(() => setClusterGroup(null), 220);
    } else {
      el.style.transform = 'translateY(0)';
    }
    clusterDragY.current = 0;
  };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove',  onMove,  { passive: false });
  el.addEventListener('touchend',   onEnd,   { passive: true });
  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove',  onMove);
    el.removeEventListener('touchend',   onEnd);
  };
}, [clusterGroup]);
```

- [ ] **Step 3: Update the cluster picker JSX — add `ref` and drag handle**

Find the cluster picker div (around line ~435):
```tsx
<div
  className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
  style={{ background: 'rgba(15,20,30,.96)', backdropFilter: 'blur(16px)' }}
>
```

Replace it with:
```tsx
<div
  ref={clusterSheetRef}
  className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
  style={{ background: 'rgba(15,20,30,.96)', backdropFilter: 'blur(16px)', transition: 'transform 0.22s ease' }}
>
  {/* Drag handle */}
  <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px', touchAction: 'none' }}>
    <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)' }} />
  </div>
```

And ensure the closing `</div>` for this container still exists at the correct position after the places list.

- [ ] **Step 4: Commit**

```bash
git add src/modules/map/MapScreen.tsx
git commit -m "fix: swipe-to-close on cluster picker, preventing map pan and reload"
```

---

## Task 8: Add rotating placeholder

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add placeholder state and rotation effect**

After the existing `const abortRef = useRef<AbortController | null>(null);` line, add:

```tsx
// Rotating placeholder
const PLACEHOLDER_EXAMPLES = [
  'Museums in this area…',
  'Hotels nearby…',
  'Parks to explore…',
  'Restaurants around here…',
  'Historic sites nearby…',
  'Cafes to discover…',
  'Galleries in this area…',
];
const [placeholderIdx, setPlaceholderIdx] = useState(0);
const [placeholderVisible, setPlaceholderVisible] = useState(true);

useEffect(() => {
  if (searchQuery) return; // don't rotate while user is typing
  const id = setInterval(() => {
    setPlaceholderVisible(false);
    setTimeout(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_EXAMPLES.length);
      setPlaceholderVisible(true);
    }, 200);
  }, 1500);
  return () => clearInterval(id);
}, [searchQuery]);
```

- [ ] **Step 2: Update the `<input>` placeholder and add fade style**

Find the `<input>` element (around line ~327) and update it:

```tsx
<input
  ref={searchInputRef}
  type="text"
  lang="en"
  value={searchQuery}
  onChange={e => handleSearchInput(e.target.value)}
  onFocus={() => setSearchOpen(true)}
  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
  placeholder={PLACEHOLDER_EXAMPLES[placeholderIdx]}
  className="w-full h-10 rounded-full pl-9 pr-9 text-sm text-white outline-none"
  style={{
    background: 'rgba(15,20,30,.82)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,.1)',
    '--tw-placeholder-opacity': placeholderVisible ? '0.3' : '0',
    transition: 'color 0.2s ease',
  } as React.CSSProperties}
/>
```

> Note: Tailwind's `placeholder-white/30` class uses a CSS variable. Instead, add this to `src/index.css`:
> ```css
> input[data-rotating-placeholder]::placeholder { transition: opacity 0.2s ease; }
> ```
> Then add `data-rotating-placeholder` attribute to the input and use `style={{ opacity: placeholderVisible ? 1 : 0 }}` on a wrapper `<span>` that overlays the placeholder visually — OR use the simpler approach below.

**Simpler approach — use a visible `<span>` overlay instead of the native placeholder:**

Replace the input's placeholder with a visible label overlay. Update the search input wrapper `<div className="flex-1 relative">` contents:

```tsx
<div className="flex-1 relative">
  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 ms text-white/35 text-base pointer-events-none">search</span>
  <input
    ref={searchInputRef}
    type="text"
    lang="en"
    value={searchQuery}
    onChange={e => handleSearchInput(e.target.value)}
    onFocus={() => setSearchOpen(true)}
    onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
    placeholder=""
    className="w-full h-10 rounded-full pl-9 pr-9 text-sm text-white outline-none"
    style={{
      background: 'rgba(15,20,30,.82)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,.1)',
    }}
  />
  {/* Rotating placeholder overlay — only visible when input is empty */}
  {!searchQuery && (
    <span
      className="absolute left-9 top-1/2 -translate-y-1/2 text-sm pointer-events-none truncate"
      style={{
        color: 'rgba(255,255,255,0.3)',
        opacity: placeholderVisible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        maxWidth: 'calc(100% - 72px)',
      }}
    >
      {PLACEHOLDER_EXAMPLES[placeholderIdx]}
    </span>
  )}
  {searchLoading ? (
    <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-white/30 text-sm animate-spin pointer-events-none">autorenew</span>
  ) : searchQuery ? (
    <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 ms text-white/30 text-sm">close</button>
  ) : null}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/map/MapScreen.tsx
git commit -m "feat: rotating placeholder text on map search input"
```

---

## Task 9: Wire smart search, area search, two-zone tap, and nudge into MapScreen

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Update imports at the top of MapScreen**

Add/replace these imports:

```tsx
import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter, Category } from '../../shared/types';
import { TripPlanningCard } from './TripPlanningCard';
import { CATEGORY_ICONS } from './types';
import { useMapMove } from './useMapMove';
import { MapStatusIndicator } from './MapStatusIndicator';
import { MapLoadingOverlay } from './MapLoadingOverlay';
import { usePlaceDetails } from './usePlaceDetails';
import { mapData, api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { MapLibreMap } from './MapLibreMap';
import type { MapHandle } from './MapLibreMap';
import { JourneyBreadcrumb } from './JourneyBreadcrumb';
import { getJourneyCities, isJourneyMode } from './journey-utils';
import { JourneyStrip } from '../journey';
import { SearchResultRow } from './SearchResultRow';
import { SearchNudge } from './SearchNudge';
import {
  nominatimToCategory,
  multiTypeNominatimSearch,
  extractSearchIntent,
  bboxDiagonalKm,
} from './useSmartSearch';
import type { NominatimResult, SuggestedChip } from './useSmartSearch';
```

Remove the old inline `nominatimSearch`, `nominatimToCategory`, and `NominatimResult` definitions from the file (lines 21–77).

- [ ] **Step 2: Add new state variables**

After the existing `const abortRef = useRef<AbortController | null>(null);` line, add:

```tsx
const mapHandleRef = useRef<MapHandle>(null);
const [currentBbox, setCurrentBbox] = useState<[number, number, number, number] | null>(null);
const [activeSearchTypes, setActiveSearchTypes] = useState<{ types: Category[]; label: string } | null>(null);
const [suggestedChips, setSuggestedChips]       = useState<SuggestedChip[]>([]);
const [showZoomNudge, setShowZoomNudge]         = useState(false);
const [highlightIds, setHighlightIds]           = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Replace `handleSearchInput` with the smart version**

Replace the existing `handleSearchInput` function (lines ~218–237) with:

```tsx
function handleSearchInput(val: string) {
  setSearchQuery(val);
  setSearchOpen(true);
  setSuggestedChips([]);
  setShowZoomNudge(false);

  if (!val.trim()) { setSearchResults([]); return; }

  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setSearchLoading(true);

    const intent = extractSearchIntent(val);

    if (intent.types.length === 0 && intent.locationQuery === null) {
      // No match — show suggestion chips
      setSuggestedChips(intent.chips);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    try {
      const bbox = intent.locationQuery === null ? currentBbox : null;
      const results = await multiTypeNominatimSearch(intent.types, val, bbox, abortRef.current.signal);
      if (!abortRef.current.signal.aborted) {
        setSearchResults(results.slice(0, 10));
        if (intent.types.length > 0 && intent.locationQuery === null && bbox && bboxDiagonalKm(bbox) > 15) {
          setShowZoomNudge(true);
          setActiveSearchTypes({ types: intent.types, label: intent.types[0] });
        }
      }
    } catch {
      // aborted or network error — ignore
    } finally {
      setSearchLoading(false);
    }
  }, 320);
}
```

- [ ] **Step 4: Replace `handleSelectResult` with two-zone versions**

Replace the existing `handleSelectResult` function with two handlers:

```tsx
function navigateToResult(r: NominatimResult) {
  const lat = parseFloat(r.lat);
  const lon = parseFloat(r.lon);
  const name = r.name || r.display_name.split(',')[0];
  const category = nominatimToCategory(r.class, r.type);
  const place: Place = { id: `nominatim-${r.place_id}`, title: name, category, lat, lon, _city: city };
  dispatch({ type: 'MERGE_PLACES', places: [place] });
  mapHandleRef.current?.flyTo(lat, lon);
  setSearchQuery('');
  setSearchResults([]);
  setSearchOpen(false);
  setSuggestedChips([]);
  searchInputRef.current?.blur();
}

function openCardFromResult(r: NominatimResult) {
  const lat = parseFloat(r.lat);
  const lon = parseFloat(r.lon);
  const name = r.name || r.display_name.split(',')[0];
  const category = nominatimToCategory(r.class, r.type);
  const place: Place = { id: `nominatim-${r.place_id}`, title: name, category, lat, lon, _city: city };
  dispatch({ type: 'MERGE_PLACES', places: [place] });
  setActivePlace(place);
  fetchDetails(place);
  mapHandleRef.current?.flyTo(lat, lon);
  setSearchQuery('');
  setSearchResults([]);
  setSearchOpen(false);
  setSuggestedChips([]);
  searchInputRef.current?.blur();
}
```

- [ ] **Step 5: Add chip tap handler**

```tsx
function handleChipTap(chip: SuggestedChip) {
  setSearchQuery(chip.label);
  setSuggestedChips([]);
  setShowZoomNudge(false);
  // Trigger search with the chip type directly using current bbox
  if (abortRef.current) abortRef.current.abort();
  abortRef.current = new AbortController();
  setSearchLoading(true);
  const bbox = currentBbox;
  multiTypeNominatimSearch([chip.type], chip.label, bbox, abortRef.current.signal)
    .then(results => {
      if (!abortRef.current?.signal.aborted) {
        setSearchResults(results.slice(0, 10));
        setSearchOpen(true);
        setActiveSearchTypes({ types: [chip.type], label: chip.label });
        if (bbox && bboxDiagonalKm(bbox) > 15) setShowZoomNudge(true);
      }
    })
    .catch(() => {})
    .finally(() => setSearchLoading(false));
}
```

- [ ] **Step 6: Update `handleMapMoveEnd` to store bbox + re-run area search on zoom**

Replace the existing `handleMapMoveEnd` function:

```tsx
const handleMapMoveEnd = useCallback((center: [number, number], zoom: number, bbox: [number, number, number, number]) => {
  setCurrentBbox(bbox);
  handleMoveEnd(center, zoom);

  // Re-run area search if there's an active type-only search
  if (activeSearchTypes && searchQuery) {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    multiTypeNominatimSearch(activeSearchTypes.types, searchQuery, bbox, abortRef.current.signal)
      .then(results => {
        if (!abortRef.current?.signal.aborted) {
          const newIds = new Set(results.map(r => `nominatim-${r.place_id}`));
          setHighlightIds(newIds);
          // Clear highlight after animation
          setTimeout(() => setHighlightIds(new Set()), 800);
          setSearchResults(results.slice(0, 10));
          setShowZoomNudge(bboxDiagonalKm(bbox) > 15);
        }
      })
      .catch(() => {});
  }
}, [handleMoveEnd, activeSearchTypes, searchQuery]);
```

- [ ] **Step 7: Update `clearSearch` to reset all new state**

Replace the existing `clearSearch` function:

```tsx
function clearSearch() {
  setSearchQuery('');
  setSearchResults([]);
  setSearchOpen(false);
  setSuggestedChips([]);
  setShowZoomNudge(false);
  setActiveSearchTypes(null);
  if (debounceRef.current) clearTimeout(debounceRef.current);
  if (abortRef.current) abortRef.current.abort();
}
```

- [ ] **Step 8: Add `ref` to `MapLibreMap` and `highlightIds` prop in JSX**

Find the `<MapLibreMap` JSX (around line ~293) and update:

```tsx
<MapLibreMap
  ref={mapHandleRef}
  center={center}
  zoom={cityGeo ? 13 : 2}
  places={filteredPlaces}
  selectedPlace={activePlace}
  highlightIds={highlightIds}
  onPlaceClick={handlePinClick}
  onMoveEnd={handleMapMoveEnd}
  routeGeojson={routeGeojson}
/>
```

- [ ] **Step 9: Replace the search results dropdown JSX**

Find the search results dropdown (lines ~352–374):
```tsx
{searchOpen && searchResults.length > 0 && (
  <div ... >
    {searchResults.map((r, i) => ( ... ))}
  </div>
)}
```

Replace with:
```tsx
{searchOpen && searchResults.length > 0 && (
  <div
    className="mx-12 rounded-2xl overflow-hidden"
    style={{
      background: 'rgba(15,20,30,.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,.1)',
      pointerEvents: 'auto',
    }}
  >
    {searchResults.map((r, i) => (
      <SearchResultRow
        key={r.place_id}
        result={r}
        isLast={i === searchResults.length - 1}
        onNavigate={() => navigateToResult(r)}
        onOpenCard={() => openCardFromResult(r)}
      />
    ))}
  </div>
)}

{/* Smart search nudge — chips or zoom nudge */}
{searchOpen && (searchResults.length > 0 || suggestedChips.length > 0 || showZoomNudge) && (
  <SearchNudge
    chips={suggestedChips}
    showZoomNudge={showZoomNudge}
    activeTypeLabel={activeSearchTypes?.label ?? ''}
    onChipTap={handleChipTap}
  />
)}
```

- [ ] **Step 10: Run the dev server and verify visually**

```bash
cd frontend
npm run dev
```

Check:
1. Placeholder rotates every 1.5s with fade
2. Typing "museum" shows museum results with name + address rows, ⓘ opens PinCard
3. Typing "something cozy for morning" shows ☕ cafe, 🥐 bakery chips
4. Tapping a chip searches for that type using current map bbox
5. Zoomed-out area search shows zoom nudge
6. After zooming in, matching pins play glow burst once
7. Swiping down on cluster picker dismisses it without refreshing the map

- [ ] **Step 11: Commit**

```bash
git add src/modules/map/MapScreen.tsx
git commit -m "feat: wire smart search, area bbox search, two-zone results, suggestion chips, glow burst, zoom nudge"
```
