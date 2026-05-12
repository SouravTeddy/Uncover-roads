# Contextual Action Chips Design Spec

**Date:** 2026-04-08
**Status:** Approved

---

## Goal

Replace the generic, static recommendation chips on `RecoCard` (the between-stop cards in the itinerary view) with contextual, actionable chips that vary by Google Place type and do something useful when tapped.

---

## Current State

`getRecoChips()` in `ItineraryCards.tsx` produces chips based on 6 broad OSM categories (`museum`, `historic`, `park`, `tourism`, `restaurant`, `cafe`). Chips are display-only — no tap handler. Result: every park card shows "Coffee break · Photo spot · Café nearby · Restrooms" regardless of the specific place.

---

## Chip Anatomy

Two visual and behavioural types:

### Expand chip (indigo `›`)
- Background: `rgba(99,102,241,.15)`, border: `rgba(99,102,241,.3)`, text: `#a5b4fc`
- Label ends with `›`
- Tapping calls `GET /nearby` and renders an inline result panel below the chip row
- Only one expand chip can be open at a time; tapping the active chip collapses it

### Direct chip (white `↗`)
- Background: `rgba(255,255,255,.07)`, border: `rgba(255,255,255,.12)`, text: `#fff`
- Label ends with `↗`
- Tapping opens Apple Maps (iOS/macOS) or Google Maps (Android/other) deep-link constructed client-side from the stop's `lat`/`lon`
- No network call, no loading state

---

## Expand Panel UX

When an expand chip is tapped:
1. Chip highlights (border brightens to `rgba(99,102,241,.5)`)
2. Panel slides open below the chip row with an indigo subtle background
3. Panel shows up to 3 results: name, walk-time estimate (distance_m ÷ 80 m/min), star rating
4. Each result has a "Go ↗" button — opens Maps directions to that place's lat/lon
5. "Go ↗" on top result is solid indigo; subsequent results use muted styling
6. While loading (API call in flight): panel shows 3 skeleton rows with shimmer
7. If API returns 0 results: panel shows "Nothing found nearby" in muted text
8. Tapping the active chip again collapses the panel

---

## Chip Taxonomy

`getRecoChips()` is replaced by a new function that accepts `googleTypes: string[]` and `timeMins: number`.

### Type → Chip mapping

| Google types match | Expand chips `›` | Direct chips `↗` |
|---|---|---|
| `museum`, `art_gallery`, `exhibition_center` | Museum café (`cafe`), Gift shop (`store`) | Book tickets, Restrooms |
| `hindu_temple`, `mosque`, `church`, `place_of_worship`, `synagogue` | Café nearby (`cafe`) | Prayer times, Dress code, Restrooms |
| `park`, `national_park`, `botanical_garden`, `hiking_area`, `nature_reserve` | Café nearby (`cafe`), Photo spots (`tourist_attraction`) | Trail map, Restrooms |
| `tourist_attraction`, `viewpoint`, `landmark` | Best angles (`tourist_attraction`), Café nearby (`cafe`) | Street view, Restrooms |
| `restaurant`, `food`, `bar`, `night_club` | Dessert nearby (`bakery`) | Walk it off, Leave review, Restrooms |
| `cafe`, `bakery`, `coffee_shop` | Dessert nearby (`bakery`) | Walk it off, Leave review, Restrooms |
| `historic`, `monument`, `ruins`, `castle`, `memorial` | Photo spots (`tourist_attraction`), Café nearby (`cafe`) | Book ahead, Restrooms |
| *(fallback — no match)* | Café nearby (`cafe`) | Explore nearby, Restrooms |

**Type matching:** Check if any element of `googleTypes[]` matches the type group. First matching group wins.

**Time-based chips** (layered on top of type chips, replacing the first chip if the chip row would exceed 4):
- 11:00–13:59 → adds `Lunch nearby ›` (`restaurant`, expand)
- 15:00–16:59 → adds `Afternoon coffee ›` (`cafe`, expand)
- ≥ 18:00 → adds `Dinner nearby ›` (`restaurant`, expand)

**Max 4 chips total.** Time chip counts toward the 4.

---

## Direct Chip Actions

| Chip label | Maps query |
|---|---|
| Restrooms | `?q=restroom` near stop lat/lon |
| Trail map | `?q=hiking+trail` near stop lat/lon |
| Walk it off | Walking directions from stop lat/lon (no destination — opens Maps in walking mode) |
| Leave review | `https://maps.google.com/?q={stop.place}` |
| Street view | `https://maps.google.com/?q={lat},{lon}&layer=c` (Street View) |
| Book tickets | `https://www.google.com/search?q=tickets+{stop.place}` |
| Book ahead | `https://www.google.com/search?q=tickets+{stop.place}` |
| Prayer times | `https://www.google.com/search?q=prayer+times+{stop.place}` |
| Dress code | `https://www.google.com/search?q=dress+code+{stop.place}` |
| Explore nearby | Maps search near stop lat/lon |

Platform detection (same pattern as PinCard directions):
```ts
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const base = isMac ? 'maps://maps.apple.com/' : 'https://maps.google.com/maps';
```

---

## Backend: `/nearby` Endpoint

```
GET /nearby?lat=<float>&lon=<float>&type=<string>&radius=500&limit=3
```

**Calls:** Google Places Nearby Search API
**Returns:**
```json
[
  { "name": "Casa do Parque", "address": "...", "rating": 4.2, "distance_m": 210, "lat": 38.72, "lon": -9.18, "place_id": "ChIJ..." }
]
```

**Cost:** ~$0.032 per request (Google Places Nearby Search). Called only on tap — not on card render.

**Rate limiting:** Uses existing `_check_rate_limit(client_ip)` pattern from other Google endpoints.

**Error handling:** Returns `[]` on API error (frontend shows "Nothing found nearby").

**No caching:** Results are location-contextual and low-frequency; browser cache headers sufficient (`Cache-Control: max-age=300`).

---

## Data Flow

```
RecoCard
  ├── currentItem.stop.place + lat + lon  (from ItineraryStop)
  ├── currentItem.matchedCategory         (existing OSM category, used as fallback)
  └── googleTypes: string[]               (NEW — read from usePlaceDetails cache)
        └── getAllCachedDetails().get(placeId)?.types ?? []
              └── placeId from getCachedPlaceIdKey(place, lat, lon)
```

`RecoCard` reads Google types directly from the module-level cache (same pattern as `useTripPlanInput`). No prop drilling through `ItineraryCards` → `RecoCard`.

On expand chip tap:
```
RecoChip (expand) → onTap → fetch /nearby?lat=&lon=&type= → setResults → render panel
```

---

## Files to Change

| File | Change |
|---|---|
| `backend/main.py` | Add `GET /nearby` endpoint |
| `frontend/src/shared/api.ts` | Add `fetchNearby(lat, lon, type)` function |
| `frontend/src/shared/types.ts` | Add `NearbyResult` interface |
| `frontend/src/modules/route/ItineraryCards.tsx` | Replace `getRecoChips()` + `RecoChip` with type-aware logic and actionable chips |

---

## What Does NOT Change

- `usePlaceDetails.ts` — cache read via existing `getAllCachedDetails()` + `getCachedPlaceIdKey()` exports
- `StopCard`, `IntroCard`, `FinaleCard` — untouched
- `ItineraryView.tsx` — untouched
- The `RecoCard` layout (transit strip, "While you're here", "Next up" text, swipe hint) — only the chip row changes
- Google Places Details fetch flow — no new details fetched

---

## NearbyResult Type

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
