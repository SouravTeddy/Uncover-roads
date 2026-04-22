# Conversational Search & Count Bug Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the city label/count staleness bug on map scroll, and add a grouped-dropdown conversational search that drops numbered pins + shows a swipeable floating card.

**Architecture:** A pure parser (`parseSearchQuery.ts`) handles client-side tokenization. A `useSearchMode` hook manages all search state locally (never touches the global Redux store). The MapLibreMap component gains a `forwardRef` to expose `flyTo`. MapScreen wires the three new UI components — `SearchDropdown`, `SearchResultCard`, `ViewAllSheet` — alongside numbered pins rendered as map children.

**Tech Stack:** React 19, TypeScript, Vitest + jsdom, react-map-gl/maplibre, existing `/nearby` and `/events` backend endpoints, Nominatim autocomplete.

---

## File Map

| Status | Path | Role |
|---|---|---|
| **new** | `frontend/src/modules/map/parseSearchQuery.ts` | Pure parser: category, location, date extraction |
| **new** | `frontend/src/modules/map/parseSearchQuery.test.ts` | Vitest unit tests for parser |
| **new** | `frontend/src/modules/map/useSearchMode.ts` | Hook: searchResults, activeResultIndex, addedIds, executeQuery, clearSearch |
| **new** | `frontend/src/modules/map/SearchDropdown.tsx` | Grouped dropdown UI (Places / Events / Areas) |
| **new** | `frontend/src/modules/map/SearchResultCard.tsx` | Floating card with swipe, toast, View all pill |
| **new** | `frontend/src/modules/map/ViewAllSheet.tsx` | Bottom sheet listing all results |
| **modify** | `frontend/src/shared/store.tsx` | Add `UPDATE_CITY_LABEL` action (updates city without clearing places) |
| **modify** | `frontend/src/shared/api.ts` | Add `searchNearby()` function with configurable radius/limit |
| **modify** | `frontend/src/modules/map/MapLibreMap.tsx` | Add `forwardRef` + `MapLibreMapHandle.flyTo` |
| **modify** | `frontend/src/modules/map/MapScreen.tsx` | Reverse geocode on move, wire search mode + new components |

---

## Task 1: Add UPDATE_CITY_LABEL to store

**Files:**
- Modify: `frontend/src/shared/store.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/store.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../../../shared/store';

describe('UPDATE_CITY_LABEL', () => {
  it('updates city string without clearing places or cityGeo', () => {
    const withData = {
      ...initialState,
      city: 'Tokyo',
      places: [{ id: '1', title: 'Park', category: 'park' as const, lat: 35, lon: 139 }],
      cityGeo: { lat: 35.6762, lon: 139.6503, bbox: [35, 36, 139, 140] as [number,number,number,number] },
    };
    const next = reducer(withData, { type: 'UPDATE_CITY_LABEL', city: 'Shinjuku' });
    expect(next.city).toBe('Shinjuku');
    expect(next.places).toHaveLength(1);
    expect(next.cityGeo).not.toBeNull();
  });

  it('persists city to localStorage', () => {
    const next = reducer(initialState, { type: 'UPDATE_CITY_LABEL', city: 'Osaka' });
    expect(next.city).toBe('Osaka');
    expect(localStorage.getItem('ur_ss_city')).toBe('"Osaka"');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && npx vitest run src/modules/map/store.test.ts
```

Expected: `TypeError: Action 'UPDATE_CITY_LABEL' is not handled` or property error.

- [ ] **Step 3: Add action type to union in store.tsx**

In `frontend/src/shared/store.tsx`, add to the `Action` union (after `SET_CITY`):

```typescript
  | { type: 'UPDATE_CITY_LABEL'; city: string }
```

- [ ] **Step 4: Add reducer case in store.tsx**

In the `reducer` function, add after the `SET_CITY` case:

```typescript
    case 'UPDATE_CITY_LABEL':
      ssSave('ur_ss_city', action.city);
      return { ...state, city: action.city };
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
cd frontend && npx vitest run src/modules/map/store.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/shared/store.tsx src/modules/map/store.test.ts
git commit -m "feat(store): add UPDATE_CITY_LABEL action — updates city without clearing places"
```

---

## Task 2: Reverse-geocode city label on map scroll

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add reverseGeocode helper at the top of MapScreen.tsx**

Add after the `nominatimToCategory` function (before `export function MapScreen()`):

```typescript
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const addr = data.address ?? {};
    return addr.city ?? addr.town ?? addr.suburb ?? addr.county ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Call reverseGeocode inside handleAreaLoad after places are dispatched**

In `handleAreaLoad`, after the `dispatch(replace ? ...)` call and before the `finally` block:

```typescript
    // Update the city label when the user scrolls to a new area
    const label = await reverseGeocode(centerLat, centerLon);
    if (label && label !== city) {
      dispatch({ type: 'UPDATE_CITY_LABEL', city: label });
    }
```

- [ ] **Step 3: Verify manually in dev**

```bash
cd frontend && npm run dev
```

Open the app, navigate to a city, scroll the map at least 40% of the viewport. The search bar placeholder should update to `Search places in [new area]`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "fix(map): reverse-geocode city label when map scrolls to new area"
```

---

## Task 3: Parser — parseSearchQuery + validateSearchDate

**Files:**
- Create: `frontend/src/modules/map/parseSearchQuery.ts`
- Create: `frontend/src/modules/map/parseSearchQuery.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/map/parseSearchQuery.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSearchQuery, validateSearchDate } from './parseSearchQuery';

describe('parseSearchQuery', () => {
  it('detects museum category', () => {
    expect(parseSearchQuery('museum near shinjuku').category).toBe('museum');
  });
  it('detects gallery as museum', () => {
    expect(parseSearchQuery('art gallery in roppongi').category).toBe('museum');
  });
  it('detects event category', () => {
    expect(parseSearchQuery('live events on april 23').category).toBe('event');
  });
  it('detects park category', () => {
    expect(parseSearchQuery('park near harajuku').category).toBe('park');
  });
  it('detects restaurant category', () => {
    expect(parseSearchQuery('restaurant near shibuya').category).toBe('restaurant');
  });
  it('extracts location after near', () => {
    expect(parseSearchQuery('museum near shinjuku station').locationString).toBe('shinjuku station');
  });
  it('extracts location after in', () => {
    expect(parseSearchQuery('park in ueno').locationString).toBe('ueno');
  });
  it('returns null location when no prefix', () => {
    expect(parseSearchQuery('museum').locationString).toBeNull();
  });
  it('detects date "april 23"', () => {
    expect(parseSearchQuery('events on april 23').dateString).toBe('april 23');
  });
  it('detects date "23rd april"', () => {
    expect(parseSearchQuery('events 23rd april near shinjuku').dateString).toBe('23rd april');
  });
  it('returns null category for unrecognized input', () => {
    expect(parseSearchQuery('shinjuku station').category).toBeNull();
  });
});

describe('validateSearchDate', () => {
  it('resolves "april 23" to ISO date', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('april 23', null, null);
    expect(result.isoDate).toBe(`${year}-04-23`);
  });
  it('resolves "23rd april" to ISO date', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('23rd april', null, null);
    expect(result.isoDate).toBe(`${year}-04-23`);
  });
  it('withinTrip is null when no travel dates', () => {
    const result = validateSearchDate('april 23', null, null);
    expect(result.withinTrip).toBeNull();
    expect(result.nudgeMessage).toBeNull();
  });
  it('withinTrip is true when date is inside window', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('april 23', `${year}-04-20`, `${year}-04-26`);
    expect(result.withinTrip).toBe(true);
    expect(result.nudgeMessage).toBeNull();
  });
  it('withinTrip is false and nudgeMessage set when date is outside window', () => {
    const year = new Date().getFullYear();
    const result = validateSearchDate('may 10', `${year}-04-20`, `${year}-04-26`);
    expect(result.withinTrip).toBe(false);
    expect(result.nudgeMessage).toContain('outside your trip');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd frontend && npx vitest run src/modules/map/parseSearchQuery.test.ts
```

Expected: `Cannot find module './parseSearchQuery'`

- [ ] **Step 3: Create parseSearchQuery.ts**

Create `frontend/src/modules/map/parseSearchQuery.ts`:

```typescript
import type { Category } from '../../shared/types';

export interface ParsedQuery {
  category: Category | null;
  locationString: string | null;
  dateString: string | null;
}

export interface DateValidation {
  isoDate: string | null;
  withinTrip: boolean | null;
  nudgeMessage: string | null;
}

const CATEGORY_KEYWORDS: Record<string, Category> = {
  museum: 'museum', gallery: 'museum', art: 'museum',
  restaurant: 'restaurant', food: 'restaurant', eat: 'restaurant',
  café: 'restaurant', cafe: 'restaurant',
  park: 'park', garden: 'park', nature: 'park',
  temple: 'historic', shrine: 'historic', historic: 'historic',
  event: 'event', events: 'event', live: 'event', show: 'event', concert: 'event',
  bar: 'restaurant', nightlife: 'restaurant',
};

const LOCATION_PREFIXES = ['near', 'in', 'around', 'by'];

const DATE_PATTERN =
  /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))\b/i;

export function parseSearchQuery(input: string): ParsedQuery {
  const lower = input.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Category: first matching keyword wins
  let category: Category | null = null;
  for (const word of words) {
    if (CATEGORY_KEYWORDS[word]) { category = CATEGORY_KEYWORDS[word]; break; }
  }

  // Location: text after first location prefix
  let locationString: string | null = null;
  for (const prefix of LOCATION_PREFIXES) {
    const idx = words.indexOf(prefix);
    if (idx !== -1 && idx < words.length - 1) {
      locationString = words.slice(idx + 1).join(' ');
      break;
    }
  }

  // Date: regex match
  const dateMatch = lower.match(DATE_PATTERN);
  const dateString = dateMatch ? dateMatch[0].replace(/(?:st|nd|rd|th)/i, '').trim() : null;

  return { category, locationString, dateString };
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function resolveDate(dateString: string): Date | null {
  const lower = dateString.toLowerCase().trim();
  // "april 23" or "23 april"
  const m1 = lower.match(/^([a-z]+)\s+(\d{1,2})$/);
  const m2 = lower.match(/^(\d{1,2})\s+([a-z]+)$/);
  let day = -1, month = -1;
  if (m1) { month = MONTH_MAP[m1[1]] ?? -1; day = parseInt(m1[2]); }
  else if (m2) { day = parseInt(m2[1]); month = MONTH_MAP[m2[2]] ?? -1; }
  if (day < 1 || month < 0) return null;
  return new Date(new Date().getFullYear(), month, day);
}

export function validateSearchDate(
  dateString: string,
  travelStartDate: string | null,
  travelEndDate: string | null,
): DateValidation {
  const resolved = resolveDate(dateString);
  if (!resolved) return { isoDate: null, withinTrip: null, nudgeMessage: null };

  const isoDate = resolved.toISOString().split('T')[0];

  if (!travelStartDate || !travelEndDate) {
    return { isoDate, withinTrip: null, nudgeMessage: null };
  }

  const withinTrip = isoDate >= travelStartDate && isoDate <= travelEndDate;
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const nudgeMessage = withinTrip
    ? null
    : `${fmt(isoDate)} is outside your trip (${fmt(travelStartDate)}–${fmt(travelEndDate)})`;

  return { isoDate, withinTrip, nudgeMessage };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd frontend && npx vitest run src/modules/map/parseSearchQuery.test.ts
```

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/parseSearchQuery.ts frontend/src/modules/map/parseSearchQuery.test.ts
git commit -m "feat(search): add parseSearchQuery + validateSearchDate utilities"
```

---

## Task 4: Add searchNearby to api.ts

**Files:**
- Modify: `frontend/src/shared/api.ts`

- [ ] **Step 1: Add NearbyResult interface and searchNearby function**

In `frontend/src/shared/api.ts`, add before the last export:

```typescript
export interface NearbyResult {
  name: string;
  address: string;
  rating?: number;
  distance_m: number;
  lat: number;
  lon: number;
  place_id: string;
}

export async function searchNearby(
  lat: number,
  lon: number,
  type: string,
  radius: number,
  limit: number,
): Promise<NearbyResult[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    type,
    radius: String(radius),
    limit: String(limit),
  });
  const res = await fetch(`${BASE}/nearby?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/shared/api.ts
git commit -m "feat(api): add searchNearby with configurable radius and limit"
```

---

## Task 5: useSearchMode hook

**Files:**
- Create: `frontend/src/modules/map/useSearchMode.ts`

- [ ] **Step 1: Create the hook**

Create `frontend/src/modules/map/useSearchMode.ts`:

```typescript
import { useState, useCallback } from 'react';
import type { Place, Category } from '../../shared/types';
import { searchNearby, api } from '../../shared/api';

export interface StructuredQuery {
  category: Category;
  locationName: string;
  locationLat: number;
  locationLon: number;
  date?: string; // ISO date, only for 'event' category
}

export interface SearchResult extends Place {
  searchIndex: number;
}

interface SearchModeState {
  isActive: boolean;
  queryLabel: string;
  searchResults: SearchResult[];
  activeResultIndex: number;
  addedIds: Set<string>;
  isLoading: boolean;
}

// Maps our app Category to Google Places API type string
const CATEGORY_TO_GOOGLE_TYPE: Record<string, string> = {
  museum: 'museum',
  restaurant: 'restaurant',
  cafe: 'cafe',
  park: 'park',
  historic: 'tourist_attraction',
  tourism: 'tourist_attraction',
  place: 'point_of_interest',
  event: 'point_of_interest',
};

export function useSearchMode(city: string) {
  const [state, setState] = useState<SearchModeState>({
    isActive: false,
    queryLabel: '',
    searchResults: [],
    activeResultIndex: 0,
    addedIds: new Set(),
    isLoading: false,
  });

  const executeQuery = useCallback(
    async (query: StructuredQuery) => {
      const label = `${query.category} near ${query.locationName}${query.date ? ` · ${query.date}` : ''}`;
      setState(s => ({
        ...s,
        isActive: true,
        queryLabel: label,
        isLoading: true,
        searchResults: [],
        activeResultIndex: 0,
        addedIds: new Set(),
      }));

      try {
        let results: Place[];

        if (query.category === 'event' && query.date) {
          const raw = await api.events(city, query.date, query.date, query.locationLat, query.locationLon);
          results = (Array.isArray(raw) ? raw : []).map((p, i) => ({
            ...p,
            id: p.id ?? `search-event-${i}`,
          }));
        } else {
          const googleType = CATEGORY_TO_GOOGLE_TYPE[query.category] ?? 'point_of_interest';
          const raw = await searchNearby(query.locationLat, query.locationLon, googleType, 1500, 15);
          results = raw.map((r, i): Place => ({
            id: r.place_id || `search-${query.category}-${i}`,
            title: r.name,
            category: query.category,
            lat: r.lat,
            lon: r.lon,
            rating: r.rating,
            place_id: r.place_id,
          }));
        }

        const searchResults: SearchResult[] = results.map((p, i) => ({
          ...p,
          searchIndex: i,
        }));

        setState(s => ({ ...s, isLoading: false, searchResults }));
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    },
    [city],
  );

  const clearSearch = useCallback(() => {
    setState({
      isActive: false,
      queryLabel: '',
      searchResults: [],
      activeResultIndex: 0,
      addedIds: new Set(),
      isLoading: false,
    });
  }, []);

  const goToResult = useCallback((index: number) => {
    setState(s => ({
      ...s,
      activeResultIndex: Math.max(0, Math.min(index, s.searchResults.length - 1)),
    }));
  }, []);

  const markAdded = useCallback((id: string) => {
    setState(s => {
      const addedIds = new Set(s.addedIds);
      addedIds.add(id);
      // Advance to next unread result after adding
      const next = Math.min(s.activeResultIndex + 1, s.searchResults.length - 1);
      return { ...s, addedIds, activeResultIndex: next };
    });
  }, []);

  return {
    isActive: state.isActive,
    queryLabel: state.queryLabel,
    searchResults: state.searchResults,
    activeResultIndex: state.activeResultIndex,
    addedIds: state.addedIds,
    isLoading: state.isLoading,
    executeQuery,
    clearSearch,
    goToResult,
    markAdded,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/useSearchMode.ts
git commit -m "feat(search): add useSearchMode hook for local search state management"
```

---

## Task 6: Expose flyTo from MapLibreMap

**Files:**
- Modify: `frontend/src/modules/map/MapLibreMap.tsx`

- [ ] **Step 1: Add forwardRef and MapLibreMapHandle**

Replace the top of `frontend/src/modules/map/MapLibreMap.tsx` with:

```typescript
// modules/map/MapLibreMap.tsx
import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapRef, ViewStateChangeEvent, MapMouseEvent } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { MapLibreMarkers } from './MapLibreMarkers';
import { MapLibreRoute } from './MapLibreRoute';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export interface MapLibreMapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}
```

- [ ] **Step 2: Wrap the component with forwardRef**

Replace `export function MapLibreMap({` with:

```typescript
export const MapLibreMap = forwardRef<MapLibreMapHandle, Props>(function MapLibreMap({
```

And add the closing `)` after the final `}` of the component.

Add `useImperativeHandle` inside the component body, after the `mapRef` declaration:

```typescript
  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lon: number, zoom = 15) => {
      mapRef.current?.flyTo({ center: [lon, lat], zoom, duration: 600 });
    },
  }));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/MapLibreMap.tsx
git commit -m "feat(map): expose flyTo via forwardRef on MapLibreMap"
```

---

## Task 7: SearchDropdown component

**Files:**
- Create: `frontend/src/modules/map/SearchDropdown.tsx`

- [ ] **Step 1: Create SearchDropdown.tsx**

Create `frontend/src/modules/map/SearchDropdown.tsx`:

```typescript
import type { ParsedQuery, DateValidation } from './parseSearchQuery';
import type { StructuredQuery } from './useSearchMode';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import type { Category } from '../../shared/types';

interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
}

interface Props {
  parsedQuery: ParsedQuery;
  locationSuggestions: NominatimSuggestion[];
  dateValidation: DateValidation | null;
  onSelect: (query: StructuredQuery) => void;
}

const CATEGORY_EMOJI: Partial<Record<Category, string>> = {
  museum: '🏛',
  restaurant: '🍜',
  park: '🌿',
  historic: '🏯',
  event: '🎉',
  cafe: '☕',
};

export function SearchDropdown({ parsedQuery, locationSuggestions, dateValidation, onSelect }: Props) {
  const { category, dateString } = parsedQuery;

  // Build place rows (Places group)
  const placeRows = category && category !== 'event'
    ? locationSuggestions.map(loc => ({
        label: `${CATEGORY_EMOJI[category] ?? '📍'} ${CATEGORY_LABELS[category] ?? category} near ${loc.name || loc.display_name.split(',')[0]}`,
        query: {
          category,
          locationName: loc.name || loc.display_name.split(',')[0],
          locationLat: parseFloat(loc.lat),
          locationLon: parseFloat(loc.lon),
        } satisfies StructuredQuery,
        nudge: null,
      }))
    : [];

  // Build event rows (Events group)
  const eventRows = category === 'event' && dateString && dateValidation?.isoDate
    ? locationSuggestions.map(loc => ({
        label: `🎉 Events on ${dateString} near ${loc.name || loc.display_name.split(',')[0]}`,
        query: {
          category: 'event' as Category,
          locationName: loc.name || loc.display_name.split(',')[0],
          locationLat: parseFloat(loc.lat),
          locationLon: parseFloat(loc.lon),
          date: dateValidation.isoDate!,
        } satisfies StructuredQuery,
        nudge: dateValidation.nudgeMessage,
      }))
    : [];

  // Nominatim area fallback (no category detected)
  const areaRows = !category
    ? locationSuggestions.map(loc => ({
        label: `📍 ${loc.name || loc.display_name.split(',')[0]}`,
        query: {
          category: 'place' as Category,
          locationName: loc.name || loc.display_name.split(',')[0],
          locationLat: parseFloat(loc.lat),
          locationLon: parseFloat(loc.lon),
        } satisfies StructuredQuery,
        nudge: null,
      }))
    : [];

  const hasRows = placeRows.length > 0 || eventRows.length > 0 || areaRows.length > 0;
  if (!hasRows) return null;

  const rowStyle: React.CSSProperties = {
    borderBottom: '1px solid rgba(255,255,255,.06)',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  };

  const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,.88)', fontSize: 13 };
  const sectionStyle: React.CSSProperties = {
    padding: '5px 14px 3px',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'rgba(255,255,255,.3)',
    borderBottom: '1px solid rgba(255,255,255,.06)',
  };
  const nudgeStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#fb923c',
    marginTop: 2,
  };

  return (
    <div
      className="mx-12 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15,20,30,.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.1)',
        pointerEvents: 'auto',
      }}
    >
      {placeRows.length > 0 && (
        <>
          <div style={sectionStyle}>Places</div>
          {placeRows.map((row, i) => (
            <button
              key={i}
              onMouseDown={() => onSelect(row.query)}
              style={{ ...rowStyle, borderBottom: i < placeRows.length - 1 ? rowStyle.borderBottom : 'none' }}
            >
              <span style={labelStyle}>{row.label}</span>
            </button>
          ))}
        </>
      )}

      {eventRows.length > 0 && (
        <>
          <div style={sectionStyle}>Events</div>
          {eventRows.map((row, i) => (
            <button
              key={i}
              onMouseDown={() => onSelect(row.query)}
              style={{ ...rowStyle, borderBottom: 'none' }}
            >
              <span style={labelStyle}>{row.label}</span>
              {row.nudge && <span style={nudgeStyle}>⚠ {row.nudge}. Still search?</span>}
            </button>
          ))}
        </>
      )}

      {areaRows.length > 0 && (
        <>
          <div style={sectionStyle}>Areas</div>
          {areaRows.map((row, i) => (
            <button
              key={i}
              onMouseDown={() => onSelect(row.query)}
              style={{ ...rowStyle, borderBottom: i < areaRows.length - 1 ? rowStyle.borderBottom : 'none' }}
            >
              <span style={labelStyle}>{row.label}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/SearchDropdown.tsx
git commit -m "feat(search): add SearchDropdown component with Places/Events/Areas groups"
```

---

## Task 8: SearchResultCard + ViewAllSheet components

**Files:**
- Create: `frontend/src/modules/map/SearchResultCard.tsx`
- Create: `frontend/src/modules/map/ViewAllSheet.tsx`

- [ ] **Step 1: Create SearchResultCard.tsx**

Create `frontend/src/modules/map/SearchResultCard.tsx`:

```typescript
import { useRef, useState } from 'react';
import type { SearchResult } from './useSearchMode';
import { CATEGORY_LABELS, CATEGORY_ICONS } from './types';

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

interface Props {
  results: SearchResult[];
  activeIndex: number;
  addedIds: Set<string>;
  onNavigate: (index: number) => void;
  onAdd: (result: SearchResult) => void;
  onViewAll: () => void;
  onClear: () => void;
  queryLabel: string;
}

export function SearchResultCard({
  results, activeIndex, addedIds, onNavigate, onAdd, onViewAll, onClear, queryLabel,
}: Props) {
  const place = results[activeIndex];
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef(0);

  if (!place) return null;

  const isAdded = addedIds.has(place.id);
  const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place';

  function handleAdd() {
    if (isAdded) return;
    onAdd(place);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastText(`✓ ${place.title} added`);
    toastTimer.current = setTimeout(() => setToastText(null), 2500);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50 && activeIndex > 0) onNavigate(activeIndex - 1);
    else if (dx < -50 && activeIndex < results.length - 1) onNavigate(activeIndex + 1);
  }

  return (
    <div
      className="absolute inset-x-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', zIndex: 20 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
        style={{ background: 'rgba(15,20,30,.96)', backdropFilter: 'blur(16px)' }}
      >
        {/* Card header row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(59,130,246,.12)' }}
          >
            <span className="ms fill text-primary" style={{ fontSize: 14 }}>{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-1 font-semibold text-sm truncate">
              <span className="text-text-3 mr-1">({activeIndex + 1})</span>
              {place.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-text-3" style={{ fontSize: 10 }}>{categoryLabel}</span>
              {place.rating != null && (
                <span className="text-text-3" style={{ fontSize: 10 }}>⭐ {place.rating.toFixed(1)}</span>
              )}
              {place.price_level != null && (
                <span className="text-text-3" style={{ fontSize: 10 }}>{PRICE_LABELS[place.price_level]}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Prev / Next */}
            <div className="flex gap-1">
              <button
                onClick={() => onNavigate(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,.08)' }}
              >
                <span className="ms text-text-2" style={{ fontSize: 14 }}>chevron_left</span>
              </button>
              <button
                onClick={() => onNavigate(activeIndex + 1)}
                disabled={activeIndex === results.length - 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,.08)' }}
              >
                <span className="ms text-text-2" style={{ fontSize: 14 }}>chevron_right</span>
              </button>
            </div>
            {/* Add button */}
            <button
              onClick={handleAdd}
              className="h-7 px-3 rounded-lg font-semibold"
              style={{
                fontSize: 11,
                background: isAdded ? 'rgba(52,199,89,.15)' : '#3b82f6',
                color: isAdded ? '#34c759' : 'white',
                border: isAdded ? '1px solid rgba(52,199,89,.3)' : 'none',
              }}
            >
              {isAdded ? '✓ Added' : '+ Add'}
            </button>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between px-4 py-2">
          {toastText ? (
            <span className="text-xs font-medium" style={{ color: '#34c759' }}>{toastText}</span>
          ) : (
            <span className="text-text-3" style={{ fontSize: 10 }}>
              {activeIndex + 1} of {results.length} · swipe to browse
            </span>
          )}
          <button
            onMouseDown={onViewAll}
            className="text-xs font-medium"
            style={{ color: '#3b82f6' }}
          >
            View all {results.length} →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ViewAllSheet.tsx**

Create `frontend/src/modules/map/ViewAllSheet.tsx`:

```typescript
import type { SearchResult } from './useSearchMode';
import { CATEGORY_LABELS, CATEGORY_ICONS } from './types';

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

interface Props {
  results: SearchResult[];
  addedIds: Set<string>;
  onSelect: (index: number) => void;
  onAdd: (result: SearchResult) => void;
  onClose: () => void;
  queryLabel: string;
}

export function ViewAllSheet({ results, addedIds, onSelect, onAdd, onClose, queryLabel }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 28, background: 'rgba(0,0,0,.4)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-2xl overflow-hidden"
        style={{
          zIndex: 29,
          background: 'rgba(13,17,23,.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,.1)',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle + title */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-white/8">
          <div
            className="w-8 h-1 rounded-full mx-auto mb-3"
            style={{ background: 'rgba(255,255,255,.2)' }}
          />
          <div className="flex items-center justify-between">
            <p className="text-text-1 font-semibold text-sm capitalize">{queryLabel}</p>
            <button onClick={onClose}>
              <span className="ms text-text-3" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {results.map((place, index) => {
            const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
            const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place';
            const added = addedIds.has(place.id);
            return (
              <button
                key={place.id}
                onClick={() => { onSelect(index); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                style={{ borderTop: index > 0 ? '1px solid rgba(255,255,255,.06)' : undefined }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: added ? 'rgba(52,199,89,.12)' : 'rgba(59,130,246,.12)' }}
                >
                  <span
                    className="ms fill"
                    style={{ fontSize: 14, color: added ? '#34c759' : '#3b82f6' }}
                  >
                    {added ? 'check' : icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm truncate"
                    style={{ color: added ? '#34c759' : 'rgba(255,255,255,.9)' }}
                  >
                    {index + 1}. {place.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-text-3" style={{ fontSize: 10 }}>{categoryLabel}</span>
                    {place.rating != null && (
                      <span className="text-text-3" style={{ fontSize: 10 }}>⭐ {place.rating.toFixed(1)}</span>
                    )}
                    {place.price_level != null && (
                      <span className="text-text-3" style={{ fontSize: 10 }}>{PRICE_LABELS[place.price_level]}</span>
                    )}
                  </div>
                </div>
                {added ? (
                  <span className="text-xs font-medium" style={{ color: '#34c759', flexShrink: 0 }}>Added</span>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); onAdd(place); }}
                    className="px-2.5 h-7 rounded-lg text-white font-semibold flex-shrink-0"
                    style={{ fontSize: 11, background: '#3b82f6' }}
                  >
                    + Add
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom safe area */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)', flexShrink: 0 }} />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/SearchResultCard.tsx frontend/src/modules/map/ViewAllSheet.tsx
git commit -m "feat(search): add SearchResultCard and ViewAllSheet components"
```

---

## Task 9: Wire everything into MapScreen

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add new imports**

Add to the import block at the top of `MapScreen.tsx` (`useRef` is already imported — just add the rest):

```typescript
import { Marker } from 'react-map-gl/maplibre';
import { parseSearchQuery, validateSearchDate } from './parseSearchQuery';
import { useSearchMode } from './useSearchMode';
import type { StructuredQuery, SearchResult } from './useSearchMode';
import { SearchDropdown } from './SearchDropdown';
import { SearchResultCard } from './SearchResultCard';
import { ViewAllSheet } from './ViewAllSheet';
import type { MapLibreMapHandle } from './MapLibreMap';
```

Actually, `useRef` is already imported. Just add the other imports. Use `useRef` for the map ref.

- [ ] **Step 2: Add mapRef and search mode inside MapScreen**

Inside `MapScreen()`, after existing state declarations, add:

```typescript
  const mapRef = useRef<MapLibreMapHandle>(null);
  // Note: `searchResults` already exists in MapScreen (NominatimResult[]).
  // Destructure useSearchMode's searchResults as `conversationalResults` to avoid conflict.
  const {
    isActive: searchModeActive,
    queryLabel,
    searchResults: conversationalResults,
    activeResultIndex,
    addedIds,
    isLoading: searchModeLoading,
    executeQuery,
    clearSearch: clearSearchMode,
    goToResult,
    markAdded,
  } = useSearchMode(city);

  const [showViewAll, setShowViewAll] = useState(false);
```

- [ ] **Step 3: Update the search input handler to use parseSearchQuery**

First, add two new state declarations inside `MapScreen()` alongside the existing `useState` calls:

```typescript
  const [locationSuggestions, setLocationSuggestions] = useState<NominatimResult[]>([]);
  const [parsedQuery, setParsedQuery] = useState<ReturnType<typeof parseSearchQuery> | null>(null);
```

Then replace the existing `handleSearchInput` function body with:

```typescript
  function handleSearchInput(val: string) {
    setSearchQuery(val);
    setSearchOpen(true);
    if (!val.trim()) {
      setSearchResults([]);
      setLocationSuggestions([]);
      setParsedQuery(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const parsed = parseSearchQuery(val);
      setParsedQuery(parsed);

      // Location to search with Nominatim
      const locationQuery = parsed.locationString ?? val;

      setSearchLoading(true);
      try {
        const bbox = cityGeo?.bbox ?? null;
        const results = await nominatimSearch(locationQuery, bbox, abortRef.current.signal);
        if (!abortRef.current.signal.aborted) {
          if (parsed.category) {
            setLocationSuggestions(results.slice(0, 3));
            setSearchResults([]);
          } else {
            setSearchResults(results.slice(0, 5));
            setLocationSuggestions([]);
          }
        }
      } catch {
        // aborted or network error
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }
```

- [ ] **Step 4: Add handleSelectStructuredQuery function**

Add after `clearSearch()`:

```typescript
  function handleSelectStructuredQuery(query: StructuredQuery) {
    setSearchQuery('');
    setSearchResults([]);
    setLocationSuggestions([]);
    setParsedQuery(null);
    setSearchOpen(false);
    searchInputRef.current?.blur();
    executeQuery(query);
  }

  function handleSearchResultAdd(result: import('./useSearchMode').SearchResult) {
    dispatch({ type: 'TOGGLE_PLACE', place: result });
    markAdded(result.id);
  }
```

- [ ] **Step 5: Update clearSearch to also clear search mode**

Replace the existing `clearSearch` function:

```typescript
  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setLocationSuggestions([]);
    setParsedQuery(null);
    setSearchOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    clearSearchMode();
    setShowViewAll(false);
  }
```

- [ ] **Step 6: Fly to active search result when activeResultIndex changes**

Add a useEffect after the existing effects:

```typescript
  useEffect(() => {
    if (!searchModeActive || conversationalResults.length === 0) return;
    const result = conversationalResults[activeResultIndex];
    if (result) {
      mapRef.current?.flyTo(result.lat, result.lon, 15);
    }
  }, [activeResultIndex, searchModeActive, searchResults]);
```

- [ ] **Step 7: Pass mapRef to MapLibreMap**

Update the `<MapLibreMap` JSX to pass the ref:

```tsx
      <MapLibreMap
        ref={mapRef}
        center={center}
        zoom={cityGeo ? 13 : 2}
        places={searchModeActive ? [] : filteredPlaces}
        selectedPlace={searchModeActive ? null : activePlace}
        onPlaceClick={searchModeActive ? (_p: Place) => {} : handlePinClick}
        onMoveEnd={handleMapMoveEnd}
        routeGeojson={routeGeojson}
      >
```

Note: when search mode is active, pass empty `places` to hide regular pins (search result pins are rendered as children).

- [ ] **Step 8: Add numbered search pins as children of MapLibreMap**

Inside the `<MapLibreMap>` JSX, add after `routeGeojson`:

```tsx
        {searchModeActive && conversationalResults.map((place, index) => (
          <Marker
            key={`search-pin-${place.id}`}
            latitude={place.lat}
            longitude={place.lon}
            anchor="center"
            onClick={(e) => { e.originalEvent.stopPropagation(); goToResult(index); }}
          >
            <div
              style={{
                width: index === activeResultIndex ? 28 : 24,
                height: index === activeResultIndex ? 28 : 24,
                borderRadius: '50%',
                background: addedIds.has(place.id) ? '#34c759' : index === activeResultIndex ? '#ff9f0a' : '#3b82f6',
                border: '2.5px solid white',
                color: 'white',
                fontSize: index === activeResultIndex ? 11 : 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {addedIds.has(place.id) ? '✓' : index + 1}
            </div>
          </Marker>
        ))}
      </MapLibreMap>
```

- [ ] **Step 9: Replace the search dropdown JSX with SearchDropdown**

Replace the existing `{searchOpen && searchResults.length > 0 && (...)}` dropdown block with:

```tsx
        {/* Conversational grouped dropdown */}
        {searchOpen && parsedQuery && locationSuggestions.length > 0 && (
          <SearchDropdown
            parsedQuery={parsedQuery}
            locationSuggestions={locationSuggestions}
            dateValidation={
              parsedQuery.dateString
                ? validateSearchDate(parsedQuery.dateString, state.travelStartDate, state.travelEndDate)
                : null
            }
            onSelect={handleSelectStructuredQuery}
          />
        )}

        {/* Existing Nominatim fallback dropdown (no category detected) */}
        {searchOpen && !parsedQuery?.category && searchResults.length > 0 && (
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
              <button
                key={r.place_id}
                onMouseDown={() => handleSelectResult(r)}
                className="w-full text-left px-4 py-3 transition-colors active:bg-white/5"
                style={{ borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}
              >
                <p className="text-white text-sm font-medium truncate">{r.name || r.display_name.split(',')[0]}</p>
                <p className="text-white/35 text-xs truncate mt-0.5">{r.display_name.split(',').slice(1, 3).join(',').trim()}</p>
              </button>
            ))}
          </div>
        )}
```

- [ ] **Step 10: Add SearchResultCard and ViewAllSheet below the map, outside the top overlay**

After the existing `{eventsNoDate && (...)}` block, add:

```tsx
      {/* Search result floating card */}
      {searchModeActive && conversationalResults.length > 0 && (
        <SearchResultCard
          results={conversationalResults}
          activeIndex={activeResultIndex}
          addedIds={addedIds}
          onNavigate={goToResult}
          onAdd={handleSearchResultAdd}
          onViewAll={() => setShowViewAll(true)}
          onClear={clearSearch}
          queryLabel={queryLabel}
        />
      )}

      {/* View all sheet */}
      {showViewAll && (
        <ViewAllSheet
          results={conversationalResults}
          addedIds={addedIds}
          onSelect={(index) => { goToResult(index); setShowViewAll(false); }}
          onAdd={handleSearchResultAdd}
          onClose={() => setShowViewAll(false)}
          queryLabel={queryLabel}
        />
      )}
```

- [ ] **Step 11: Update search placeholder for conversational mode**

Change the `placeholder` prop on the `<input>`:

```tsx
              placeholder={searchModeActive
                ? queryLabel
                : `Search places in ${city || 'city'}…`}
```

- [ ] **Step 12: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 13: Run all tests**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 14: Smoke test in dev**

```bash
cd frontend && npm run dev
```

Test checklist:
- [ ] Map scroll updates city label in search bar placeholder
- [ ] Typing "museum near shinjuku" shows grouped dropdown with Places group
- [ ] Typing "events on april 23" shows Events group with date nudge if outside trip
- [ ] Selecting from dropdown drops numbered pins, shows floating card
- [ ] Swiping card left/right navigates pins (active pin turns amber)
- [ ] Tapping a numbered pin jumps to that card
- [ ] Tapping "+ Add" shows toast, pin turns green, card advances
- [ ] "View all" opens sheet, sheet rows match cards
- [ ] ✕ on search bar clears everything and restores regular pins
- [ ] Filter counts (All, Museums, etc.) update correctly after scrolling

- [ ] **Step 15: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat(search): wire conversational search into MapScreen — numbered pins, floating card, grouped dropdown"
```
