# Map & Itinerary v2 — Design Spec
_Date: 2026-03-30_

## Overview

Four parallel enhancements to the React frontend:

1. **Our Picks pin styling** — visually distinct pins for recommended places
2. **"Search this area" CTA** — re-search on map pan
3. **TripSheet improvements** — scrollable, name search, map pin-drop
4. **Smart itinerary** — conflict engine wired + per-stop tags

---

## Issue 1 — Our Picks Pin Styling

### Problem
Recommended ("Our Picks") pins look identical to regular pins. Users cannot tell which places are curated for them.

### Solution
Add `makeRecommendedIcon(category, selected)` alongside the existing `makeIcon()`. Recommended pins use the same teardrop shape but with a distinct amber/orange gradient and a gold star badge.

### Icon spec
```ts
function makeRecommendedIcon(category: string, selected: boolean): L.DivIcon {
  const color = selected
    ? 'linear-gradient(135deg,#fb923c,#ef4444)'
    : 'linear-gradient(135deg,#f59e0b,#f97316)';
  const glow = selected ? 'rgba(239,68,68,.5)' : 'rgba(249,115,22,.5)';
  const icon = CATEGORY_ICONS[category] ?? 'location_on';
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative">
        <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:${color};
             transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
             box-shadow:0 2px 12px ${glow};border:2px solid rgba(255,255,255,.3)">
          <span class="ms fill" style="transform:rotate(45deg);color:#fff;font-size:16px;
                font-family:'Material Symbols Outlined'">${icon}</span>
        </div>
        <div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;
             border-radius:50%;background:#fbbf24;display:flex;align-items:center;
             justify-content:center;font-size:8px;box-shadow:0 1px 4px rgba(0,0,0,.4)">⭐</div>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -40],
  });
}
```

### MapPins change
`MapPins` receives a new `recommendedIds: Set<string>` prop. When rendering a pin, if `recommendedIds.has(place.id)`, use `makeRecommendedIcon`; otherwise use `makeIcon`.

```tsx
// MapScreen.tsx
const recommendedIds = useMemo(
  () => new Set(activeFilter === 'recommended' ? filteredPlaces.map(p => p.id) : []),
  [activeFilter, filteredPlaces]
);

<MapPins
  places={filteredPlaces}
  selectedIds={selectedIds}
  recommendedIds={recommendedIds}
  onPinClick={handlePinClick}
/>
```

---

## Issue 2 — "Search This Area" CTA

### Problem
When the user pans to a new area, places from the original city search don't cover the new view. No way to discover places in the panned area.

### Solution
A `SearchHereButton` floating pill appears centered below the filter bar after the user pans. Tapping it fetches places within the current map bounds and merges them into the places list.

### Trigger logic
Listen to Leaflet's `moveend` event inside a `useMapMove` hook. Track the last search center. When `map.getCenter()` moves more than ~200m from the last search center, set `showSearchHere: true`.

```ts
// useMapMove.ts
export function useMapMove(onMove: () => void) {
  const map = useLeafletMap();
  const lastCenter = useRef<L.LatLng | null>(null);

  useEffect(() => {
    function handleMoveEnd() {
      const center = map.getCenter();
      if (!lastCenter.current || center.distanceTo(lastCenter.current) > 200) {
        onMove();
      }
    }
    map.on('moveend', handleMoveEnd);
    return () => { map.off('moveend', handleMoveEnd); };
  }, [map, onMove]);

  return { updateLastCenter: (c: L.LatLng) => { lastCenter.current = c; } };
}
```

### API change
`api.mapData` gains an optional `bbox` parameter:
```ts
mapData: (city: string, bbox?: { north: number; south: number; east: number; west: number }) =>
  get<Place[]>(`/map-data?city=${encodeURIComponent(city)}${bbox
    ? `&bbox=${bbox.north},${bbox.south},${bbox.east},${bbox.west}` : ''}`),
```

### Store change
New action `MERGE_PLACES` to add new places without duplicates:
```ts
case 'MERGE_PLACES':
  const existingIds = new Set(state.places.map(p => p.id));
  const newPlaces = action.places.filter(p => !existingIds.has(p.id));
  return { ...state, places: [...state.places, ...newPlaces] };
```

### SearchHereButton component
```tsx
// SearchHereButton.tsx
export function SearchHereButton({ onSearch }: { onSearch: () => void }) {
  return (
    <button
      onClick={onSearch}
      className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 text-white text-xs font-semibold"
      style={{ background: 'rgba(15,23,42,.88)', backdropFilter: 'blur(6px)',
               boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}
    >
      <span className="ms text-sm">search</span>
      Search this area
    </button>
  );
}
```

Rendered in `MapScreen` below the filter bar, centered, only when `showSearchHere` is true:
```tsx
{showSearchHere && (
  <div className="flex justify-center" style={{ pointerEvents: 'auto' }}>
    <SearchHereButton onSearch={handleSearchHere} />
  </div>
)}
```

After search, hide the button and update `lastCenter`.

---

## Issue 3 — TripSheet Improvements

### Problem
1. Sheet content is not scrollable — fields get cut off on small screens
2. No way to enter the name of the hotel/airport/station
3. No way to drop a custom starting pin on the map

### Solution

#### 3a — Scrollable content
Wrap fields in a `flex-1 overflow-y-auto` div. Generate button stays in a `flex-shrink-0` sticky footer outside the scroll area.

#### 3b — Location name search
When `startType` is `hotel`, `airport`, `station`, or `airbnb`, a labeled search card expands below the chip row:
- Text input with a search icon
- On input change (debounced 300ms), call Nominatim:
  ```
  GET https://nominatim.openstreetmap.org/search?q=<query>&format=json&limit=5
  ```
- Show up to 5 autocomplete results
- On selection, set `locationName`, `locationLat`, `locationLon` in local state and dispatch `SET_TRIP_CONTEXT`
- For `airbnb`: same input but no autocomplete (free-text only)

#### 3c — Drop pin on map (P2 mode)
A 5th chip **"📍 Drop a pin"** appears alongside hotel/airport/station/airbnb.

When selected:
- `startType` is set to `'pin'`
- The name search card is replaced by a teal prompt: _"Tap anywhere on the map above to drop your pin"_
- `MapScreen` detects `tripContext.startType === 'pin'` and `showTripSheet === true`, attaches a one-time Leaflet `click` handler
- On map tap: gets `latlng`, calls Nominatim reverse geocode (`/reverse?lat=&lon=&format=json`), sets `locationName` (from `display_name`), `locationLat`, `locationLon`
- Confirmation chip replaces the prompt: `"📍 Near Connaught Place ✓"`

#### Updated TripContext type
```ts
// types.ts
export type StartType = 'hotel' | 'airport' | 'station' | 'airbnb' | 'pin';
// TripContext.startType changes from the existing union to include 'pin'
```

---

## Issue 4 — Smart Itinerary: Conflict Engine + Per-Stop Tags

### Problem
1. `trip_context` is not passed from the frontend to `api.aiItinerary()`, so the AI cannot use arrival time, date, or days to make time-aware decisions
2. Conflict engine decisions are invisible to the user — no indication that the schedule was adapted

### Solution

#### 4a — Wire trip_context to the API
In `useRoute.ts`, pull `tripContext` and `persona` from the store. Pass both to `api.aiItinerary()`:

```ts
// useRoute.ts — in buildItinerary()
const { city, selectedPlaces, tripContext, persona } = state;
const data = await api.aiItinerary({
  city,
  places: selectedPlaces,
  days: tripContext.days,
  day_number: tripContext.dayNumber,
  pace: persona?.pace ?? 'moderate',
  persona: persona?.archetype_desc ?? '',
  persona_archetype: persona?.archetype ?? '',
  persona_context: {
    traits: persona?.traits,
    itinerary_bias: persona?.itinerary_bias,
    venue_filters: persona?.venue_filters,
  },
  trip_context: {
    date: tripContext.date,
    start_type: tripContext.startType,
    arrival_time: tripContext.arrivalTime,
    flight_time: tripContext.flightTime,
    is_long_haul: tripContext.isLongHaul,
    days: tripContext.days,
    day_number: tripContext.dayNumber,
    location_lat: tripContext.locationLat,
    location_lon: tripContext.locationLon,
    location_name: tripContext.locationName,
  },
});
```

#### 4b — Add tags to ItineraryStop type
```ts
// types.ts
export interface ItineraryStop {
  place: string;
  lat?: number;
  lon?: number;
  tip?: string;
  duration?: string;
  transit_to_next?: string;
  tags?: string[];   // ← new: ["☀️ Beat the heat", "✈️ Light — jet lag day"]
}
```

The backend Claude prompt is instructed to populate `tags` with 0–2 short strings per stop when a conflict applies to that stop.

#### 4c — Per-stop tag pills in ItineraryView
Below the place title, before the tip block, render tags as small colored pills:

```tsx
{stop.tags && stop.tags.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {stop.tags.map((tag, i) => (
      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border"
        style={tagStyle(tag)}>
        {tag}
      </span>
    ))}
  </div>
)}
```

Tag color mapping (`tagStyle`):
| Keyword in tag | Background | Border | Text |
|---|---|---|---|
| heat / sun | `rgba(234,179,8,.12)` | `rgba(234,179,8,.25)` | `#eab308` |
| jet lag / flight | `rgba(99,102,241,.12)` | `rgba(99,102,241,.25)` | `#818cf8` |
| ramadan / evening / iftar | `rgba(139,92,246,.12)` | `rgba(139,92,246,.25)` | `#a78bfa` |
| altitude | `rgba(20,184,166,.12)` | `rgba(20,184,166,.25)` | `#14b8a6` |
| (default) | `rgba(255,255,255,.06)` | `rgba(255,255,255,.1)` | `#94a3b8` |

#### 4d — conflict_notes summary line
`summary.conflict_notes` (already in the API response) renders as a single small grey line at the top of the stop list:

```tsx
{itinerary.summary?.conflict_notes && (
  <p className="text-text-3 text-xs mb-3 px-1">
    {itinerary.summary.conflict_notes}
  </p>
)}
```

---

## Backend prompt addition (Issue 4b)

Add to the Claude prompt in `main.py`:

```
For each stop, add a "tags" array with 0–2 short strings (max 30 chars each)
if a conflict override applies to that stop. Examples:
- "☀️ Beat the heat" (outdoor stop moved to morning)
- "✈️ Light — jet lag day" (reduced intensity)
- "🌙 Evening only (Ramadan)" (food stop after sunset)
- "🏔️ Easy pace — altitude" (high elevation city)
Leave tags empty [] if no conflict applies to the stop.
```

---

## Component Map

| File | Change |
|---|---|
| `src/modules/map/MapScreen.tsx` | Add `recommendedIds`, `showSearchHere` state, render `SearchHereButton`, wire pin-drop click handler |
| `src/modules/map/MapPins` (in MapScreen.tsx) | Accept `recommendedIds` prop, use `makeRecommendedIcon` |
| `src/modules/map/makeIcon.ts` | Extract `makeIcon` + add `makeRecommendedIcon` |
| `src/modules/map/useMapMove.ts` | New hook — Leaflet `moveend` listener |
| `src/modules/map/SearchHereButton.tsx` | New component — floating search pill |
| `src/modules/map/TripSheet.tsx` | Scrollable layout, location search, drop-pin P2 mode |
| `src/shared/api.ts` | Add `bbox` param to `mapData`, update `aiItinerary` signature |
| `src/shared/store.tsx` | Add `MERGE_PLACES` action |
| `src/shared/types.ts` | Add `tags?: string[]` to `ItineraryStop`; add `'pin'` to `StartType` |
| `src/modules/route/useRoute.ts` | Pass `tripContext` + `persona` to `api.aiItinerary()` |
| `src/modules/route/ItineraryView.tsx` | Render per-stop tag pills + `conflict_notes` summary line |
| `main.py` | Add `tags` instruction to Claude prompt |

---

## Out of Scope
- Backend Nominatim proxy (calls go direct from frontend)
- Saving preferred starting locations
- Multi-day conflict display
- Backend changes to the conflict engine rules themselves
