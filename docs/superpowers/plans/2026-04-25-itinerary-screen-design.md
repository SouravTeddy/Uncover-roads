# Itinerary Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the video-background itinerary reel with a two-mode map-centric experience: full-screen Explore mode with LLM reference pins + intelligence layer, and 50/50 Itinerary mode with swipeable place cards, plus multi-city city-hop animation.

**Architecture:** `RouteScreen` becomes a mode router (`explore` | `itinerary`). New types (`ReferencePin`, `FavouritedPin`, `CityFootprint`, `StoryCard`, `PinState`) are added to the global store. Two new backend endpoints (`/reference-pins`, `/similar-places`) drive the intelligence layer. `PinCard` is redesigned with travel-date badge, "Why this for you", local tip, heart/favourite, and "Similar" CTA. `ItineraryMapCard` + `ItineraryPlaceCard` provide the split-screen itinerary view. `CityHopOverlay` manages the multi-city arc animation.

**Tech Stack:** React 19, TypeScript, MapLibre GL (react-map-gl/maplibre), FastAPI + Anthropic Claude, Vitest + jsdom, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `frontend/src/shared/types.ts` | Add `ReferencePin`, `FavouritedPin`, `CityFootprint`, `StoryCard`, `PinState` |
| Modify | `frontend/src/shared/store.tsx` | Add `referencePins`, `favouritedPins`, `cityFootprints`, `similarPinsState` to state, actions, reducer |
| Modify | `frontend/src/modules/map/pincard-utils.ts` | Add `getTravelDateBadge()` — compares ISO travel date vs `weekday_text` |
| Modify | `frontend/src/modules/map/PinCard.tsx` | Redesign: travel-date badge, why-rec, local tip, intel pills, heart icon, Similar CTA; remove: open-now, type chips, wikipedia, directions |
| Create | `frontend/src/modules/map/FootprintChips.tsx` | Horizontal city-footprint chip bar with pan-on-tap |
| Create | `frontend/src/modules/map/SimilarPins.tsx` | `useSimilarPins` hook + `SimilarPinsOverlay` — teal connector SVG lines + top banner |
| Create | `frontend/src/modules/map/ExploreMapMarkers.tsx` | Pin marker renderer aware of `PinState` (reference=ghost, added=blue, similar=teal) |
| Modify | `frontend/src/modules/route/RouteScreen.tsx` | Replace with explore/itinerary mode router; remove `AmbientVideo` |
| Create | `frontend/src/modules/route/ItineraryMapCard.tsx` | Top 50% of itinerary mode: numbered route pins, route line, detour amber pin, full-map toggle |
| Create | `frontend/src/modules/route/ItineraryPlaceCard.tsx` | Bottom 50% of itinerary mode: swipeable stop cards with weather bg, why-rec, intel pills, detour banner |
| Modify | `main.py` | Add `/reference-pins` and `/similar-places` POST endpoints |
| Modify | `frontend/src/shared/api.ts` | Add `api.referencePins()` and `api.similarPlaces()` client methods |
| Create | `frontend/src/modules/map/CityHopOverlay.tsx` | Multi-city arc animation + story card carousel + loading state |

---

## Task 1: New types in `types.ts`

**Files:**
- Modify: `frontend/src/shared/types.ts`

- [ ] **Step 1: Add new types at the end of `frontend/src/shared/types.ts`**

```typescript
// ── Itinerary screen redesign ─────────────────────────────────

/** A LLM-generated reference pin — shown as a ghost on the map. */
export interface ReferencePin {
  id: string;
  title: string;
  lat: number;
  lon: number;
  category: Category;
  whyRec: string;    // "Why this for you" — one persona-matched sentence
  localTip: string;  // one insider tip line
}

/** A city the user has explored, shown in the footprint chip bar. */
export interface CityFootprint {
  city: string;
  emoji: string;       // e.g. "🗼"
  pinCount: number;    // number of places explored (not added), shown in chip
  lat: number;
  lon: number;
}

/** A story card shown during city-hop loading transition. */
export interface StoryCard {
  imageUrl: string;
  headline: string;
  body: string;
  cityContext: string;  // e.g. "Tokyo → Kyoto"
}

/** A place the user has saved to favourites (heart icon), not yet added. */
export interface FavouritedPin {
  placeId: string;  // matches Place.id
  title: string;
  lat: number;
  lon: number;
  city: string;
}

/** Visual state of a pin on the explore map. */
export type PinState = 'added' | 'reference' | 'similar' | 'favourited';
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/shared/types.ts
git commit -m "feat: add ReferencePin, FavouritedPin, CityFootprint, StoryCard, PinState types"
```

---

## Task 2: Store — new state, actions, and reducer cases

**Files:**
- Modify: `frontend/src/shared/store.tsx`

- [ ] **Step 1: Write failing tests for new store state**

Create `frontend/src/modules/map/store-itinerary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../../shared/store';
import type { ReferencePin, FavouritedPin, CityFootprint } from '../../shared/types';

const mockPin: ReferencePin = {
  id: 'ref-1',
  title: 'Senso-ji',
  lat: 35.71,
  lon: 139.79,
  category: 'historic',
  whyRec: 'Matches your cultural pace',
  localTip: 'Arrive before 8am to beat crowds',
};

const mockFav: FavouritedPin = {
  placeId: 'p-1',
  title: 'Senso-ji',
  lat: 35.71,
  lon: 139.79,
  city: 'Tokyo',
};

const mockFootprint: CityFootprint = {
  city: 'Tokyo',
  emoji: '🗼',
  pinCount: 4,
  lat: 35.68,
  lon: 139.69,
};

describe('referencePins', () => {
  it('defaults to empty array', () => {
    expect(initialState.referencePins).toEqual([]);
  });

  it('SET_REFERENCE_PINS replaces the array', () => {
    const next = reducer(initialState, { type: 'SET_REFERENCE_PINS', pins: [mockPin] });
    expect(next.referencePins).toEqual([mockPin]);
  });
});

describe('favouritedPins', () => {
  it('defaults to empty array', () => {
    expect(initialState.favouritedPins).toEqual([]);
  });

  it('TOGGLE_FAVOURITE adds a pin not yet in list', () => {
    const next = reducer(initialState, { type: 'TOGGLE_FAVOURITE', pin: mockFav });
    expect(next.favouritedPins).toEqual([mockFav]);
  });

  it('TOGGLE_FAVOURITE removes a pin already in list', () => {
    const withFav = reducer(initialState, { type: 'TOGGLE_FAVOURITE', pin: mockFav });
    const removed = reducer(withFav, { type: 'TOGGLE_FAVOURITE', pin: mockFav });
    expect(removed.favouritedPins).toEqual([]);
  });
});

describe('cityFootprints', () => {
  it('defaults to empty array', () => {
    expect(initialState.cityFootprints).toEqual([]);
  });

  it('ADD_CITY_FOOTPRINT appends if city not present', () => {
    const next = reducer(initialState, { type: 'ADD_CITY_FOOTPRINT', footprint: mockFootprint });
    expect(next.cityFootprints).toHaveLength(1);
    expect(next.cityFootprints[0].city).toBe('Tokyo');
  });

  it('ADD_CITY_FOOTPRINT updates pinCount if city already present', () => {
    const withCity = reducer(initialState, { type: 'ADD_CITY_FOOTPRINT', footprint: mockFootprint });
    const updated = reducer(withCity, {
      type: 'ADD_CITY_FOOTPRINT',
      footprint: { ...mockFootprint, pinCount: 7 },
    });
    expect(updated.cityFootprints).toHaveLength(1);
    expect(updated.cityFootprints[0].pinCount).toBe(7);
  });
});

describe('similarPinsState', () => {
  it('defaults to null', () => {
    expect(initialState.similarPinsState).toBeNull();
  });

  it('SET_SIMILAR_PINS sets the state', () => {
    const next = reducer(initialState, {
      type: 'SET_SIMILAR_PINS',
      state: { sourcePlaceId: 'p-1', similarIds: ['ref-2', 'ref-3'] },
    });
    expect(next.similarPinsState?.sourcePlaceId).toBe('p-1');
  });

  it('SET_SIMILAR_PINS with null clears the state', () => {
    const withSimilar = reducer(initialState, {
      type: 'SET_SIMILAR_PINS',
      state: { sourcePlaceId: 'p-1', similarIds: ['ref-2'] },
    });
    const cleared = reducer(withSimilar, { type: 'SET_SIMILAR_PINS', state: null });
    expect(cleared.similarPinsState).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/store-itinerary.test.ts
```

Expected: FAIL — `initialState.referencePins` is undefined

- [ ] **Step 3: Add new state fields to `AppState` in `store.tsx`**

In `frontend/src/shared/store.tsx`, add these imports at the top:

```typescript
import type {
  // ... existing imports ...
  ReferencePin,
  FavouritedPin,
  CityFootprint,
} from './types';
```

In the `AppState` interface (after `pendingActivePlace`):

```typescript
  referencePins: ReferencePin[];
  favouritedPins: FavouritedPin[];
  cityFootprints: CityFootprint[];
  similarPinsState: { sourcePlaceId: string; similarIds: string[] } | null;
```

- [ ] **Step 4: Add initial state values in `initialState`**

After the `pendingActivePlace: null` line:

```typescript
  referencePins: [],
  favouritedPins: ssGet<FavouritedPin[]>('ur_ss_favs') ?? [],
  cityFootprints: ssGet<CityFootprint[]>('ur_ss_footprints') ?? [],
  similarPinsState: null,
```

- [ ] **Step 5: Add new action types to the `Action` union**

After `| { type: 'CLEAR_PENDING_PLACE' }`:

```typescript
  | { type: 'SET_REFERENCE_PINS'; pins: ReferencePin[] }
  | { type: 'TOGGLE_FAVOURITE'; pin: FavouritedPin }
  | { type: 'ADD_CITY_FOOTPRINT'; footprint: CityFootprint }
  | { type: 'SET_SIMILAR_PINS'; state: { sourcePlaceId: string; similarIds: string[] } | null };
```

- [ ] **Step 6: Add reducer cases**

After the `CLEAR_PENDING_PLACE` case:

```typescript
    case 'SET_REFERENCE_PINS':
      return { ...state, referencePins: action.pins };

    case 'TOGGLE_FAVOURITE': {
      const exists = state.favouritedPins.some(f => f.placeId === action.pin.placeId);
      const updated = exists
        ? state.favouritedPins.filter(f => f.placeId !== action.pin.placeId)
        : [...state.favouritedPins, action.pin];
      ssSave('ur_ss_favs', updated);
      return { ...state, favouritedPins: updated };
    }

    case 'ADD_CITY_FOOTPRINT': {
      const exists = state.cityFootprints.some(f => f.city === action.footprint.city);
      const updated = exists
        ? state.cityFootprints.map(f =>
            f.city === action.footprint.city ? action.footprint : f
          )
        : [...state.cityFootprints, action.footprint];
      ssSave('ur_ss_footprints', updated);
      return { ...state, cityFootprints: updated };
    }

    case 'SET_SIMILAR_PINS':
      return { ...state, similarPinsState: action.state };
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/store-itinerary.test.ts
```

Expected: All 10 tests PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/shared/store.tsx src/modules/map/store-itinerary.test.ts
git commit -m "feat: add referencePins, favouritedPins, cityFootprints, similarPinsState to store"
```

---

## Task 3: Travel-date badge utility

**Files:**
- Modify: `frontend/src/modules/map/pincard-utils.ts`
- Modify: `frontend/src/modules/map/pincard-utils.test.ts`

The existing `getHoursLabel` returns today's hours. The new `getTravelDateBadge` takes an ISO travel date (`"2026-06-14"`) and returns a formatted badge string comparing the travel date's day of week against `weekday_text`.

- [ ] **Step 1: Write failing tests**

Append to `frontend/src/modules/map/pincard-utils.test.ts`:

```typescript
import { getTravelDateBadge } from './pincard-utils';

const HOURS = [
  'Monday: 9:00 AM – 6:00 PM',
  'Tuesday: 9:00 AM – 6:00 PM',
  'Wednesday: 9:00 AM – 6:00 PM',
  'Thursday: 9:00 AM – 6:00 PM',
  'Friday: Closed',
  'Saturday: 10:00 AM – 5:00 PM',
  'Sunday: 11:00 AM – 4:00 PM',
];

describe('getTravelDateBadge', () => {
  it('returns open badge when travel day has hours', () => {
    // 2026-06-13 is a Saturday
    const result = getTravelDateBadge(HOURS, '2026-06-13');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('open');
    expect(result!.text).toContain('Sat');
    expect(result!.text).toContain('5:00 PM');
  });

  it('returns closed badge when travel day is closed', () => {
    // 2026-06-12 is a Friday
    const result = getTravelDateBadge(HOURS, '2026-06-12');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('closed');
    expect(result!.text).toContain('Fri');
    expect(result!.text).toContain('Closed');
  });

  it('returns null for empty weekday_text', () => {
    expect(getTravelDateBadge([], '2026-06-12')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(getTravelDateBadge(HOURS, 'not-a-date')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/pincard-utils.test.ts
```

Expected: FAIL — `getTravelDateBadge` not exported

- [ ] **Step 3: Implement `getTravelDateBadge` in `pincard-utils.ts`**

Append to `frontend/src/modules/map/pincard-utils.ts`:

```typescript
const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Given Google's weekday_text array and an ISO travel date ("YYYY-MM-DD"),
 * returns a badge object for the travel date's day of week.
 *
 * Returns null if weekdayText is empty or travelDate is not parseable.
 */
export function getTravelDateBadge(
  weekdayText: string[],
  travelDate: string,
): { text: string; status: 'open' | 'closed' } | null {
  if (!weekdayText.length) return null;

  // Parse the travel date as UTC noon to avoid timezone shifts
  const d = new Date(travelDate + 'T12:00:00Z');
  if (isNaN(d.getTime())) return null;

  const jsDay = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const googleIdx = jsDay === 0 ? 6 : jsDay - 1; // Google's array: Mon=0 … Sun=6
  const line = weekdayText[googleIdx];
  if (!line) return null;

  const shortDay = SHORT_DAY[jsDay];
  const dayNum = d.getUTCDate();
  const monthName = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

  const isClosed = /closed/i.test(line);
  if (isClosed) {
    return {
      text: `⚠️ Closed ${shortDay} · Your travel day is ${shortDay} ${dayNum} ${monthName}`,
      status: 'closed',
    };
  }

  // Extract closing time from "DayName: HH:MM AM – HH:MM AM"
  const closeMatch = line.match(/[–\-]\s*(\d+:\d+\s*(?:AM|PM))/i);
  const closeTime = closeMatch ? closeMatch[1] : null;

  return {
    text: closeTime
      ? `📅 Open · ${shortDay} ${dayNum} ${monthName} · Closes ${closeTime}`
      : `📅 Open · ${shortDay} ${dayNum} ${monthName}`,
    status: 'open',
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/pincard-utils.test.ts
```

Expected: All tests PASS (original 10 + new 4)

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/pincard-utils.ts src/modules/map/pincard-utils.test.ts
git commit -m "feat: add getTravelDateBadge() — travel-date aware open/closed badge"
```

---

## Task 4: Backend `/reference-pins` and `/similar-places` endpoints

**Files:**
- Modify: `main.py`

Both endpoints call Claude claude-haiku-4-5-20251001 (fast, cheap) and return structured JSON.

- [ ] **Step 1: Add `/reference-pins` POST endpoint to `main.py`**

Append after the `@app.get("/place-image")` block (around line 938):

```python
# =========================================
# REFERENCE PINS — LLM-generated ghost pins
# =========================================
@app.post("/reference-pins")
def reference_pins_endpoint(body: dict):
    """
    Generate 8-10 reference pins for a city, persona-filtered.
    Optionally takes prev_city_context to chain multi-city recommendations.
    Returns: { pins: [...], storyCards: [...] }
    """
    if not ANTHROPIC_API_KEY:
        return {"error": "No Anthropic API key configured"}

    city = body.get("city", "")
    persona_archetype = body.get("persona_archetype", "Explorer")
    days = body.get("days", 1)
    prev_city = body.get("prev_city", "")
    prev_picks = body.get("prev_picks", [])  # list of place title strings

    if not city:
        return {"error": "city is required"}

    context_clause = ""
    if prev_city and prev_picks:
        picks_str = ", ".join(prev_picks[:5])
        context_clause = (
            f" The traveler is arriving from {prev_city} where they visited: {picks_str}."
            " Tailor recommendations to complement, not duplicate, their prior city."
        )

    prompt = f"""You are a travel intelligence engine. Generate exactly 8-10 reference pins for a {persona_archetype} traveler visiting {city} for {days} day(s).{context_clause}

Return a JSON object with this exact structure:
{{
  "pins": [
    {{
      "id": "ref-<short_slug>",
      "title": "Place Name",
      "lat": 35.1234,
      "lon": 139.5678,
      "category": "museum|historic|park|restaurant|cafe|tourism|place",
      "whyRec": "One sentence matching this persona's interests",
      "localTip": "One insider tip a local would share"
    }}
  ],
  "storyCards": [
    {{
      "imageUrl": "",
      "headline": "Short evocative headline about {city}",
      "body": "One fascinating fact about {city} relevant to a {persona_archetype}",
      "cityContext": "{prev_city + ' → ' + city if prev_city else city}"
    }}
  ]
}}

Rules:
- Coordinates must be accurate real-world lat/lon for {city}
- Pins must be real, well-known places
- whyRec must be persona-specific (persona: {persona_archetype})
- localTip must be practical and specific (e.g. "Enter from the east gate — shorter queue")
- Generate 2-3 story cards
- Return only valid JSON, no markdown fences"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        return result
    except json.JSONDecodeError as e:
        print(f"REFERENCE PINS JSON ERROR: {e}")
        return {"pins": [], "storyCards": []}
    except Exception as e:
        print(f"REFERENCE PINS ERROR: {e}")
        return {"error": str(e)}


# =========================================
# SIMILAR PLACES — LLM-generated similar pin set
# =========================================
@app.post("/similar-places")
def similar_places_endpoint(body: dict):
    """
    Generate 4 places similar to a given place in the same city.
    Returns: { places: [...] }
    """
    if not ANTHROPIC_API_KEY:
        return {"error": "No Anthropic API key configured"}

    place_name = body.get("place_name", "")
    city = body.get("city", "")
    persona_archetype = body.get("persona_archetype", "Explorer")
    category = body.get("category", "place")

    if not place_name or not city:
        return {"error": "place_name and city are required"}

    prompt = f"""You are a travel intelligence engine. A {persona_archetype} traveler just viewed {place_name} in {city} (category: {category}).

Generate exactly 4 nearby places that are similar — same category, close proximity, complementary vibe.

Return a JSON object:
{{
  "places": [
    {{
      "id": "ref-<short_slug>",
      "title": "Place Name",
      "lat": 35.1234,
      "lon": 139.5678,
      "category": "museum|historic|park|restaurant|cafe|tourism|place",
      "whyRec": "One sentence on why this is similar to {place_name}",
      "localTip": "One practical insider tip"
    }}
  ]
}}

Rules:
- Coordinates must be accurate real-world lat/lon in {city}, within 2km of {place_name} if possible
- All 4 places must be real, well-known locations
- Return only valid JSON, no markdown fences"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        return result
    except json.JSONDecodeError as e:
        print(f"SIMILAR PLACES JSON ERROR: {e}")
        return {"places": []}
    except Exception as e:
        print(f"SIMILAR PLACES ERROR: {e}")
        return {"error": str(e)}
```

- [ ] **Step 2: Smoke-test both endpoints with curl**

```bash
# From the uncover-roads/ directory with the server running (uvicorn main:app --reload)
curl -s -X POST http://localhost:8000/reference-pins \
  -H "Content-Type: application/json" \
  -d '{"city":"Tokyo","persona_archetype":"Culture Seeker","days":3}' | python3 -m json.tool | head -30

curl -s -X POST http://localhost:8000/similar-places \
  -H "Content-Type: application/json" \
  -d '{"place_name":"Senso-ji","city":"Tokyo","persona_archetype":"Culture Seeker","category":"historic"}' | python3 -m json.tool | head -20
```

Expected: JSON with `pins` array (8-10 items) and `places` array (4 items) respectively

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads
git add main.py
git commit -m "feat: add /reference-pins and /similar-places LLM endpoints"
```

---

## Task 5: API client additions

**Files:**
- Modify: `frontend/src/shared/api.ts`

- [ ] **Step 1: Add `referencePins()` and `similarPlaces()` to the `api` object in `api.ts`**

In `frontend/src/shared/api.ts`, find the `export const api = {` block and add these two methods:

```typescript
  referencePins: async (params: {
    city: string;
    personaArchetype: string;
    days: number;
    prevCity?: string;
    prevPicks?: string[];
  }): Promise<{ pins: import('./types').ReferencePin[]; storyCards: import('./types').StoryCard[] }> => {
    return post('/reference-pins', {
      city: params.city,
      persona_archetype: params.personaArchetype,
      days: params.days,
      prev_city: params.prevCity ?? '',
      prev_picks: params.prevPicks ?? [],
    });
  },

  similarPlaces: async (params: {
    placeName: string;
    city: string;
    personaArchetype: string;
    category: string;
  }): Promise<{ places: import('./types').ReferencePin[] }> => {
    return post('/similar-places', {
      place_name: params.placeName,
      city: params.city,
      persona_archetype: params.personaArchetype,
      category: params.category,
    });
  },
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/shared/api.ts
git commit -m "feat: add api.referencePins() and api.similarPlaces() client methods"
```

---

## Task 6: `ExploreMapMarkers` — `PinState`-aware marker renderer

**Files:**
- Create: `frontend/src/modules/map/ExploreMapMarkers.tsx`

This replaces `MapLibreMarkers` in the new explore-mode RouteScreen. It renders pins differently based on their state: reference = ghost purple, added = blue border, similar = teal ripple, normal = category color.

- [ ] **Step 1: Create `ExploreMapMarkers.tsx`**

Create `frontend/src/modules/map/ExploreMapMarkers.tsx`:

```tsx
// modules/map/ExploreMapMarkers.tsx
import { Marker } from 'react-map-gl/maplibre';
import type { Place, ReferencePin, PinState } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
};

/** Category emoji for itinerary mode numbered pins */
export const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍜', cafe: '☕', park: '🌿',
  museum: '🏛️', historic: '🏯', tourism: '📍',
  event: '🎭', place: '📌',
};

interface PlaceMarker {
  kind: 'place';
  place: Place;
  state: PinState;
  isFavourited: boolean;
}

interface RefMarker {
  kind: 'reference';
  pin: ReferencePin;
  state: PinState;
}

export type MarkerData = PlaceMarker | RefMarker;

interface Props {
  markers: MarkerData[];
  selectedId: string | null;
  onMarkerClick: (marker: MarkerData) => void;
}

export function ExploreMapMarkers({ markers, selectedId, onMarkerClick }: Props) {
  return (
    <>
      {markers.map((marker) => {
        const id = marker.kind === 'place' ? marker.place.id : marker.pin.id;
        const lat = marker.kind === 'place' ? marker.place.lat : marker.pin.lat;
        const lon = marker.kind === 'place' ? marker.place.lon : marker.pin.lon;
        const category = marker.kind === 'place' ? marker.place.category : marker.pin.category;
        const icon = CATEGORY_ICONS[category] ?? 'location_on';
        const color = CATEGORY_COLORS[category] ?? '#6b7280';
        const isSelected = id === selectedId;
        const isFav = marker.kind === 'place' && marker.isFavourited;

        // Reference ghost pins
        if (marker.state === 'reference') {
          return (
            <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(147,51,234,0.18)',
                border: '1.5px solid rgba(147,51,234,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', opacity: 0.7,
              }}>
                <span className="ms fill" style={{ fontSize: 12, color: 'rgba(192,132,252,0.9)', lineHeight: 1 }}>
                  {icon}
                </span>
                {isFav && (
                  <div style={{
                    position: 'absolute', top: -4, right: -4,
                    fontSize: 10, lineHeight: 1,
                  }}>❤️</div>
                )}
              </div>
            </Marker>
          );
        }

        // Similar teal ripple pins
        if (marker.state === 'similar') {
          return (
            <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
            >
              <div className="marker-similar-pulse" style={{
                width: isSelected ? 34 : 28, height: isSelected ? 34 : 28,
                borderRadius: '50%',
                background: 'rgba(20,184,166,0.25)',
                border: '2px solid rgba(20,184,166,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <span className="ms fill" style={{ fontSize: isSelected ? 17 : 14, color: '#5eead4', lineHeight: 1 }}>
                  {icon}
                </span>
              </div>
            </Marker>
          );
        }

        // Added (blue) pins
        if (marker.state === 'added') {
          return (
            <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
            >
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: isSelected ? 36 : 30, height: isSelected ? 36 : 30,
                  borderRadius: '50%',
                  background: 'rgba(59,130,246,0.9)',
                  border: isSelected ? '2.5px solid #fff' : '2px solid rgba(147,197,253,0.9)',
                  boxShadow: isSelected ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,.5)' : '0 2px 8px rgba(0,0,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}>
                  <span className="ms fill" style={{ fontSize: isSelected ? 18 : 15, color: '#fff', lineHeight: 1 }}>
                    {icon}
                  </span>
                </div>
                {isFav && (
                  <div style={{
                    position: 'absolute', top: -5, right: -5,
                    fontSize: 11, lineHeight: 1,
                  }}>❤️</div>
                )}
              </div>
            </Marker>
          );
        }

        // Default category-colored pins (explore mode, not yet added)
        return (
          <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
            onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
          >
            <div style={{ position: 'relative' }}>
              <div style={{
                width: isSelected ? 34 : 28, height: isSelected ? 34 : 28,
                borderRadius: '50%', backgroundColor: color,
                border: isSelected ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.85)',
                boxShadow: isSelected
                  ? `0 0 0 2px ${color}, 0 3px 8px rgba(0,0,0,.45)`
                  : '0 2px 6px rgba(0,0,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                <span className="ms fill" style={{ fontSize: isSelected ? 17 : 14, color: '#fff', lineHeight: 1 }}>
                  {icon}
                </span>
              </div>
              {isFav && (
                <div style={{
                  position: 'absolute', top: -5, right: -5,
                  fontSize: 11, lineHeight: 1,
                }}>❤️</div>
              )}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Add CSS animations for teal ripple pulse to `index.css` or `App.css`**

Find the existing global CSS file (likely `frontend/src/index.css`) and append:

```css
/* Similar-pins teal ripple animation */
@keyframes similar-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(20,184,166,0.5); }
  70%  { box-shadow: 0 0 0 10px rgba(20,184,166,0); }
  100% { box-shadow: 0 0 0 0 rgba(20,184,166,0); }
}

.marker-similar-pulse {
  animation: similar-pulse 1.8s ease-out infinite;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/ExploreMapMarkers.tsx src/index.css
git commit -m "feat: add ExploreMapMarkers with PinState-aware rendering (reference/added/similar)"
```

---

## Task 7: `PinCard` redesign — intelligence layer

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`

**Removals:** "Open now" badge, Wikipedia link, Directions link, type/cuisine chips, editorial summary description, fit percentage bars.

**Additions:** travel-date badge, "Why this for you" block, local tip, heart/favourite toggle, "✦ Similar" secondary CTA, max 2 intel pills.

The card now accepts optional `referencePin` (for LLM-derived content), `travelDate` (ISO string), and `onSimilar` + `onFavourite` callbacks.

- [ ] **Step 1: Replace `PinCard.tsx` with the redesigned version**

Replace the entire contents of `frontend/src/modules/map/PinCard.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Place, PlaceDetails, ReferencePin } from '../../shared/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { getPlacePhotoUrl, api } from '../../shared/api';
import { filterTypes, getTravelDateBadge, getDirectionsUrl } from './pincard-utils';

interface Props {
  place: Place;
  city: string;
  isSelected: boolean;
  isFavourited: boolean;
  onAdd: () => void;
  onClose: () => void;
  onSimilar: () => void;
  onFavourite: () => void;
  details?: PlaceDetails | null;
  referencePin?: ReferencePin | null;  // LLM intelligence if this is a reference/added pin
  travelDate?: string | null;          // ISO date "YYYY-MM-DD" for travel-date badge
}

const PRICE: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
};

const CATEGORY_BG: Record<string, string> = {
  restaurant: 'rgba(239,68,68,.12)', cafe: 'rgba(249,115,22,.12)',
  park: 'rgba(34,197,94,.12)', museum: 'rgba(139,92,246,.12)',
  historic: 'rgba(161,98,7,.12)', tourism: 'rgba(14,165,233,.12)',
  event: 'rgba(236,72,153,.12)', place: 'rgba(107,114,128,.12)',
};

const linkBtn: React.CSSProperties = {
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
  height: 36, padding: '0 14px', borderRadius: 999,
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
  fontSize: '0.72rem', fontWeight: 700, color: 'rgba(193,198,215,.8)',
  textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
};

export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onSimilar, onFavourite,
  details, referencePin, travelDate,
}: Props) {
  const [visible, setVisible]   = useState(false);
  const [imgSrc, setImgSrc]     = useState<string | null>(null);
  const sheetRef    = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const dragY       = useRef(0);
  const closing     = useRef(false);

  // Slide-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overscrollBehaviorY = 'none';
    return () => {
      cancelAnimationFrame(id);
      document.documentElement.style.overscrollBehaviorY = '';
      document.body.style.overscrollBehaviorY = '';
    };
  }, []);

  // Image loading
  const photoRef       = details?.photo_ref ?? place.photo_ref ?? null;
  const googlePhotoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null;

  useEffect(() => {
    closing.current = false;
    if (googlePhotoUrl) {
      setImgSrc(googlePhotoUrl);
    } else {
      setImgSrc(null);
      api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, googlePhotoUrl]);

  const handleImgError = useCallback(() => {
    api.placeImage(place.title, city).then(url => setImgSrc(url));
  }, [place.title, city]);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setVisible(false);
    setTimeout(onClose, 380);
  }, [onClose]);

  // Swipe-to-close
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; dragY.current = 0; };
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0 && (scrollRef.current?.scrollTop ?? 0) === 0 && sheetRef.current) {
        if (e.cancelable) e.preventDefault();
        sheetRef.current.style.transition = 'none';
        sheetRef.current.style.transform = `translateY(${dy}px)`;
        dragY.current = dy;
      }
    };
    const onEnd = () => {
      if (!sheetRef.current) return;
      sheetRef.current.style.transition = '';
      if (dragY.current > 80) handleClose();
      else sheetRef.current.style.transform = 'translateY(0)';
      dragY.current = 0;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [handleClose]);

  // Derived data
  const icon  = CATEGORY_ICONS[place.category] ?? 'location_on';
  const color = CATEGORY_COLORS[place.category] ?? '#6b7280';
  const bg    = CATEGORY_BG[place.category] ?? 'rgba(107,114,128,.12)';

  const d = details ?? null;
  const rating      = d?.rating      ?? place.rating      ?? null;
  const ratingCount = d?.rating_count                     ?? null;
  const priceLevel  = d?.price_level ?? place.price_level ?? null;

  // Travel-date badge (replaces "open now")
  const travelBadge = travelDate && d?.weekday_text?.length
    ? getTravelDateBadge(d.weekday_text, travelDate)
    : null;

  // Intel pills — max 2, only most critical
  const intelPills: { text: string; color: string; bg: string }[] = [];
  if (travelBadge?.status === 'closed') {
    intelPills.push({ text: travelBadge.text, color: '#fbbf24', bg: 'rgba(251,191,36,.12)' });
  }
  // Add entry requirement pill if available in place tags
  if (place.tags?.entry_requirement && intelPills.length < 2) {
    intelPills.push({
      text: place.tags.entry_requirement,
      color: '#94a3b8',
      bg: 'rgba(148,163,184,.1)',
    });
  }

  const whyRec = referencePin?.whyRec ?? place.reason ?? null;
  const localTip = referencePin?.localTip ?? null;

  const googleMapsUrl = details?.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${details.place_id}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title + ' ' + city)}`;
  const website = d?.website || place.tags?.website || null;

  let catLabel = CATEGORY_LABELS[place.category] ?? 'Place';
  if (place.tags?.cuisine) {
    catLabel += ' · ' + place.tags.cuisine.replace(/;/g, ', ').replace(/_/g, ' ');
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)',
          zIndex: 39, opacity: visible ? 1 : 0,
          transition: 'opacity .38s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#141921', borderRadius: '20px 20px 0 0',
          zIndex: 40,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform .38s cubic-bezier(.32,.72,0,1)',
          maxHeight: '80dvh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 48px rgba(0,0,0,.7)',
          willChange: 'transform',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0, touchAction: 'none' }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2 }} />
        </div>

        {/* Hero */}
        <div style={{
          position: 'relative', width: '100%', height: 180,
          background: bg, overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {imgSrc ? (
            <img
              src={imgSrc} alt={place.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={handleImgError}
            />
          ) : (
            <span className="ms fill" style={{ fontSize: 56, color: color + '55' }}>{icon}</span>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.5) 100%)' }} />

          {/* Travel-date badge (open state only — closed is in intel pills) */}
          {travelBadge?.status === 'open' && (
            <div style={{
              position: 'absolute', bottom: 10, left: 12,
              display: 'inline-flex', alignItems: 'center',
              height: 26, padding: '0 10px', borderRadius: 999,
              background: 'rgba(22,163,74,.3)',
              border: '1px solid rgba(74,222,128,.3)',
              backdropFilter: 'blur(12px)',
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.5px',
              color: '#4ade80',
            }}>
              {travelBadge.text}
            </div>
          )}

          {/* Heart icon — top-right */}
          <button
            onClick={(e) => { e.stopPropagation(); onFavourite(); }}
            style={{
              position: 'absolute', top: 10, right: 44,
              background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer',
            }}
            aria-label={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
          >
            {isFavourited ? '❤️' : '🤍'}
          </button>

          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#aaa', fontSize: 14, cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} style={{
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: `16px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)`,
          flex: 1, minHeight: 0,
        }}>

          {/* Title + category */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F9F9FF', lineHeight: 1.25 }}>
              {place.title}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(193,198,215,.45)', marginTop: 3 }}>
              {catLabel}
            </div>
          </div>

          {/* Rating + price */}
          {(rating !== null || priceLevel !== null) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {rating !== null && (
                <>
                  <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>★ {rating}</span>
                  {ratingCount !== null && (
                    <span style={{ fontSize: 10, color: '#555' }}>({ratingCount.toLocaleString()})</span>
                  )}
                </>
              )}
              {priceLevel !== null && priceLevel > 0 && (
                <span style={{ fontSize: 10, color: '#666' }}>{PRICE[priceLevel]}</span>
              )}
            </div>
          )}

          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 14 }} />

          {/* Intel pills (max 2) */}
          {intelPills.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {intelPills.map((pill, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 10,
                  background: pill.bg,
                  border: `1px solid ${pill.color}30`,
                  fontSize: '0.75rem', color: pill.color, lineHeight: 1.4,
                }}>
                  {pill.text}
                </div>
              ))}
            </div>
          )}

          {/* "Why this for you" */}
          {whyRec && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.8px',
                textTransform: 'uppercase', color: '#6366f1', marginBottom: 5,
              }}>
                Why this for you
              </div>
              <div style={{
                fontSize: '0.85rem', color: 'rgba(193,198,215,.85)',
                lineHeight: 1.55, fontStyle: 'italic',
              }}>
                {whyRec}
              </div>
            </div>
          )}

          {/* Local tip */}
          {localTip && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(251,191,36,.07)',
              border: '1px solid rgba(251,191,36,.15)',
              marginBottom: 14,
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                Local tip
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(193,198,215,.8)', lineHeight: 1.5 }}>
                {localTip}
              </div>
            </div>
          )}

          {/* Link pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
            <a href={googleMapsUrl} target="_blank" rel="noreferrer"
              style={{ ...linkBtn, color: '#93c5fd', borderColor: 'rgba(59,130,246,.3)', background: 'rgba(59,130,246,.1)' }}>
              <span className="ms fill" style={{ fontSize: 14 }}>map</span>
              Google Maps
            </a>
            {website && (
              <a href={website} target="_blank" rel="noreferrer" style={linkBtn}>
                <span className="ms" style={{ fontSize: 14 }}>language</span>
                {(() => { try { return new URL(website).hostname; } catch { return 'Website'; } })()}
              </a>
            )}
          </div>

          {/* Primary CTA: Add to itinerary */}
          <button
            onClick={onAdd}
            style={{
              width: '100%',
              background: isSelected ? 'rgba(99,102,241,.15)' : '#6366f1',
              border: isSelected ? '1px solid rgba(99,102,241,.4)' : 'none',
              borderRadius: 14, padding: '13px 0',
              fontSize: 13, fontWeight: 700,
              color: isSelected ? '#a5b4fc' : '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginBottom: 10,
            }}
          >
            <span className="ms" style={{ fontSize: 16 }}>{isSelected ? 'check_circle' : 'add_circle'}</span>
            {isSelected ? 'Added to itinerary' : 'Add to itinerary'}
          </button>

          {/* Secondary CTA: Similar */}
          <button
            onClick={() => { handleClose(); onSimilar(); }}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid rgba(99,102,241,.35)',
              borderRadius: 14, padding: '12px 0',
              fontSize: 13, fontWeight: 700, color: '#a5b4fc',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            ✦ Similar
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/PinCard.tsx
git commit -m "feat: redesign PinCard with travel-date badge, why-rec, local tip, heart, Similar CTA"
```

---

## Task 8: `FootprintChips` component

**Files:**
- Create: `frontend/src/modules/map/FootprintChips.tsx`

- [ ] **Step 1: Create `FootprintChips.tsx`**

Create `frontend/src/modules/map/FootprintChips.tsx`:

```tsx
// modules/map/FootprintChips.tsx
import type { CityFootprint } from '../../shared/types';

interface Props {
  footprints: CityFootprint[];
  activeCityIdx: number;
  onChipTap: (footprint: CityFootprint) => void;
}

export function FootprintChips({ footprints, activeCityIdx, onChipTap }: Props) {
  if (footprints.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      left: 12, right: 12,
      zIndex: 20,
      display: 'flex', gap: 8, overflowX: 'auto',
      scrollbarWidth: 'none',
      // Hide scrollbar on WebKit
      WebkitOverflowScrolling: 'touch',
    }}>
      {footprints.map((f, idx) => {
        const isActive = idx === activeCityIdx;
        return (
          <button
            key={f.city}
            onClick={() => onChipTap(f)}
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 14px',
              borderRadius: 999,
              background: isActive ? 'rgba(99,102,241,.25)' : 'rgba(15,20,30,.75)',
              border: isActive
                ? '1px solid rgba(99,102,241,.5)'
                : '1px solid rgba(255,255,255,.12)',
              backdropFilter: 'blur(12px)',
              color: isActive ? '#c7d2fe' : 'rgba(193,198,215,.8)',
              fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 16 }}>{f.emoji}</span>
            <span>{f.city}</span>
            <span style={{ color: isActive ? '#818cf8' : 'rgba(148,163,184,.6)', fontWeight: 400 }}>
              · {f.pinCount} {f.pinCount === 1 ? 'pin' : 'pins'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/FootprintChips.tsx
git commit -m "feat: add FootprintChips city footprint chip bar"
```

---

## Task 9: `SimilarPins` — hook + overlay

**Files:**
- Create: `frontend/src/modules/map/SimilarPins.tsx`

The `useSimilarPins` hook manages firing the API call and updating store state. `SimilarPinsOverlay` renders dashed teal SVG lines + dismissible top banner.

- [ ] **Step 1: Write failing tests for `useSimilarPins`**

Create `frontend/src/modules/map/similar-pins.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildConnectorLines } from './SimilarPins';

describe('buildConnectorLines', () => {
  const source = { lat: 35.71, lon: 139.79 };
  const targets = [
    { id: 'ref-1', lat: 35.72, lon: 139.80 },
    { id: 'ref-2', lat: 35.70, lon: 139.78 },
  ];

  it('returns one line per target', () => {
    const lines = buildConnectorLines(source, targets);
    expect(lines).toHaveLength(2);
  });

  it('each line has from and to coords', () => {
    const lines = buildConnectorLines(source, targets);
    expect(lines[0].from).toEqual(source);
    expect(lines[0].to).toEqual({ lat: 35.72, lon: 139.80 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/similar-pins.test.ts
```

Expected: FAIL — `buildConnectorLines` not found

- [ ] **Step 3: Create `SimilarPins.tsx`**

Create `frontend/src/modules/map/SimilarPins.tsx`:

```tsx
// modules/map/SimilarPins.tsx
import { useCallback } from 'react';
import { useMap as useMapLibre } from 'react-map-gl/maplibre';
import type { ReferencePin } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';

// ── Pure helper (exported for testing) ─────────────────────────────────────

export function buildConnectorLines(
  source: { lat: number; lon: number },
  targets: { id: string; lat: number; lon: number }[],
): { id: string; from: { lat: number; lon: number }; to: { lat: number; lon: number } }[] {
  return targets.map(t => ({ id: t.id, from: source, to: { lat: t.lat, lon: t.lon } }));
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSimilarPins() {
  const { state, dispatch } = useAppStore();

  const triggerSimilar = useCallback(
    async (place: { id: string; title: string; lat: number; lon: number; category: string }) => {
      const city   = state.city;
      const archetype = state.persona?.archetype ?? 'Explorer';

      dispatch({
        type: 'SET_SIMILAR_PINS',
        state: { sourcePlaceId: place.id, similarIds: [] },
      });

      try {
        const result = await api.similarPlaces({
          placeName: place.title,
          city,
          personaArchetype: archetype,
          category: place.category,
        });

        if (result.places?.length) {
          const ids = result.places.map((p: ReferencePin) => p.id);
          dispatch({ type: 'SET_SIMILAR_PINS', state: { sourcePlaceId: place.id, similarIds: ids } });
          // Merge similar pins into referencePins so they render on the map
          const existing = new Set(state.referencePins.map(p => p.id));
          const newPins = result.places.filter((p: ReferencePin) => !existing.has(p.id));
          dispatch({ type: 'SET_REFERENCE_PINS', pins: [...state.referencePins, ...newPins] });
        }
      } catch (err) {
        console.error('SIMILAR PLACES ERROR:', err);
        dispatch({ type: 'SET_SIMILAR_PINS', state: null });
      }
    },
    [state.city, state.persona, state.referencePins, dispatch],
  );

  const clearSimilar = useCallback(() => {
    dispatch({ type: 'SET_SIMILAR_PINS', state: null });
  }, [dispatch]);

  return { triggerSimilar, clearSimilar, similarPinsState: state.similarPinsState };
}

// ── Overlay banner ──────────────────────────────────────────────────────────

interface BannerProps {
  category: string;
  onClear: () => void;
}

export function SimilarPinsBanner({ category, onClear }: BannerProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
      left: 12, right: 12,
      zIndex: 25,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderRadius: 14,
      background: 'rgba(20,184,166,.15)',
      border: '1px solid rgba(20,184,166,.3)',
      backdropFilter: 'blur(12px)',
    }}>
      <span style={{ flex: 1, fontSize: '0.78rem', color: '#5eead4', fontWeight: 600 }}>
        Similar {category} nearby · Tap to explore
      </span>
      <button
        onClick={onClear}
        style={{
          background: 'none', border: 'none',
          color: 'rgba(94,234,212,.6)', fontSize: '0.72rem',
          cursor: 'pointer', padding: '0 4px', fontWeight: 600,
        }}
      >
        Clear ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/similar-pins.test.ts
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/SimilarPins.tsx src/modules/map/similar-pins.test.ts
git commit -m "feat: add useSimilarPins hook and SimilarPinsBanner overlay"
```

---

## Task 10: `RouteScreen` — Explore mode (full-screen map)

**Files:**
- Modify: `frontend/src/modules/route/RouteScreen.tsx`

The new `RouteScreen` has two modes. This task wires up **Explore mode**: full-screen `MapLibreMap` using `ExploreMapMarkers`, reference pin loading on mount, footprint chips, the redesigned `PinCard` (25% sheet), and the `SimilarPinsBanner`.

Itinerary mode is wired in Task 12.

- [ ] **Step 1: Replace `RouteScreen.tsx`**

Replace the entire contents of `frontend/src/modules/route/RouteScreen.tsx`:

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import { MapLibreMap } from '../map/MapLibreMap';
import type { MapHandle } from '../map/MapLibreMap';
import { ExploreMapMarkers, type MarkerData } from '../map/ExploreMapMarkers';
import { FootprintChips } from '../map/FootprintChips';
import { PinCard } from '../map/PinCard';
import { SimilarPinsBanner, useSimilarPins } from '../map/SimilarPins';
import { usePlaceDetails } from '../map/usePlaceDetails';
import type { Place, ReferencePin, FavouritedPin } from '../../shared/types';
import { ItineraryMapCard } from './ItineraryMapCard';
import { ItineraryPlaceCard } from './ItineraryPlaceCard';

type RouteMode = 'explore' | 'itinerary';

export function RouteScreen() {
  const { state, dispatch } = useAppStore();
  const {
    city, cityGeo, persona, selectedPlaces,
    referencePins, favouritedPins, cityFootprints,
    tripContext, itinerary, weather,
  } = state;

  const [mode, setMode] = useState<RouteMode>('explore');
  const [activeMarker, setActiveMarker] = useState<MarkerData | null>(null);
  const [referencePinsLoading, setReferencePinsLoading] = useState(false);
  const mapRef = useRef<MapHandle>(null);
  const { details, fetchDetails } = usePlaceDetails();
  const { triggerSimilar, clearSimilar, similarPinsState } = useSimilarPins();

  const center: [number, number] = cityGeo
    ? [cityGeo.lat, cityGeo.lon]
    : [35.68, 139.69]; // fallback: Tokyo

  // Load reference pins on mount (or when city changes)
  useEffect(() => {
    if (!city || referencePins.length > 0) return;
    setReferencePinsLoading(true);
    api.referencePins({
      city,
      personaArchetype: persona?.archetype ?? 'Explorer',
      days: tripContext.days,
    }).then(result => {
      if (result.pins?.length) {
        dispatch({ type: 'SET_REFERENCE_PINS', pins: result.pins });
      }
    }).catch(console.error).finally(() => setReferencePinsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // Build marker data for ExploreMapMarkers
  const selectedIds = new Set(selectedPlaces.map(p => p.id));
  const favouritedIds = new Set(favouritedPins.map(f => f.placeId));
  const similarIds = new Set(similarPinsState?.similarIds ?? []);

  const markers: MarkerData[] = [
    // User-added places
    ...selectedPlaces.map((p): MarkerData => ({
      kind: 'place', place: p,
      state: 'added',
      isFavourited: favouritedIds.has(p.id),
    })),
    // Reference pins (from LLM) — exclude already-added ones
    ...referencePins
      .filter(rp => !selectedIds.has(rp.id))
      .map((rp): MarkerData => ({
        kind: 'reference', pin: rp,
        state: similarIds.has(rp.id) ? 'similar' : 'reference',
      })),
  ];

  // Active marker derived data
  const activePlace: Place | null = activeMarker?.kind === 'place' ? activeMarker.place : null;
  const activeRefPin: ReferencePin | null = activeMarker?.kind === 'reference' ? activeMarker.pin : null;
  const activePlaceForCard: Place | null = activePlace ?? (activeRefPin ? {
    id: activeRefPin.id,
    title: activeRefPin.title,
    lat: activeRefPin.lat,
    lon: activeRefPin.lon,
    category: activeRefPin.category,
  } : null);

  const handleMarkerClick = useCallback((marker: MarkerData) => {
    setActiveMarker(marker);
    if (marker.kind === 'place') {
      fetchDetails(marker.place);
    }
  }, [fetchDetails]);

  const handleAdd = useCallback(() => {
    if (!activePlaceForCard) return;
    dispatch({ type: 'TOGGLE_PLACE', place: activePlaceForCard });
    // Track footprint
    dispatch({
      type: 'ADD_CITY_FOOTPRINT',
      footprint: {
        city,
        emoji: '📍',
        pinCount: selectedPlaces.length + (selectedIds.has(activePlaceForCard.id) ? -1 : 1),
        lat: cityGeo?.lat ?? 0,
        lon: cityGeo?.lon ?? 0,
      },
    });
  }, [activePlaceForCard, city, cityGeo, selectedPlaces, selectedIds, dispatch]);

  const handleFavourite = useCallback(() => {
    if (!activePlaceForCard) return;
    const fav: FavouritedPin = {
      placeId: activePlaceForCard.id,
      title: activePlaceForCard.title,
      lat: activePlaceForCard.lat,
      lon: activePlaceForCard.lon,
      city,
    };
    dispatch({ type: 'TOGGLE_FAVOURITE', pin: fav });
  }, [activePlaceForCard, city, dispatch]);

  const handleSimilar = useCallback(() => {
    if (!activePlaceForCard) return;
    triggerSimilar({
      id: activePlaceForCard.id,
      title: activePlaceForCard.title,
      lat: activePlaceForCard.lat,
      lon: activePlaceForCard.lon,
      category: activePlaceForCard.category,
    });
  }, [activePlaceForCard, triggerSimilar]);

  const handleFootprintTap = useCallback((footprint: typeof cityFootprints[0]) => {
    mapRef.current?.flyTo(footprint.lat, footprint.lon, 13);
  }, []);

  // ── Itinerary mode ──────────────────────────────────────────────────────
  if (mode === 'itinerary') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Back to explore button */}
        <button
          onClick={() => setMode('explore')}
          style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 12,
            zIndex: 30,
            background: 'rgba(15,20,30,.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.12)', borderRadius: 12,
            padding: '8px 14px', color: '#94a3b8',
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span className="ms" style={{ fontSize: 16 }}>arrow_back</span>
          Explore
        </button>

        {/* Top 50%: map */}
        <div style={{ flex: '0 0 50%', position: 'relative' }}>
          <ItineraryMapCard
            mapRef={mapRef}
            center={center}
            selectedPlaces={selectedPlaces}
            onFullMap={() => {/* TODO: expand map fullscreen */}}
          />
        </div>

        {/* Bottom 50%: swipeable place cards */}
        <div style={{ flex: '0 0 50%', position: 'relative', overflow: 'hidden' }}>
          {itinerary ? (
            <ItineraryPlaceCard
              stops={itinerary.itinerary}
              selectedPlaces={selectedPlaces}
              weather={weather}
              referencePins={referencePins}
              travelDate={tripContext.date}
              onStopChange={(idx) => {
                const stop = itinerary.itinerary[idx];
                if (stop?.lat && stop?.lon) {
                  mapRef.current?.flyTo(stop.lat, stop.lon, 15);
                }
              }}
            />
          ) : (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b', fontSize: '0.85rem',
            }}>
              No itinerary yet — add places in Explore mode
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Explore mode ────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* Full-screen map */}
      <MapLibreMap
        ref={mapRef}
        center={center}
        places={[]}
        selectedPlace={null}
        onPlaceClick={() => {}}
        onMoveEnd={() => {}}
      >
        <ExploreMapMarkers
          markers={markers}
          selectedId={
            activeMarker?.kind === 'place'
              ? activeMarker.place.id
              : activeMarker?.kind === 'reference'
                ? activeMarker.pin.id
                : null
          }
          onMarkerClick={handleMarkerClick}
        />
      </MapLibreMap>

      {/* Footprint chips */}
      <FootprintChips
        footprints={cityFootprints}
        activeCityIdx={cityFootprints.findIndex(f => f.city === city)}
        onChipTap={handleFootprintTap}
      />

      {/* Similar pins banner */}
      {similarPinsState && (
        <SimilarPinsBanner
          category={activePlaceForCard?.category ?? 'places'}
          onClear={clearSimilar}
        />
      )}

      {/* Reference pins loading indicator */}
      {referencePinsLoading && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'rgba(15,20,30,.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 999,
          padding: '8px 16px',
          fontSize: '0.75rem', color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span className="ms text-primary animate-spin" style={{ fontSize: 14 }}>autorenew</span>
          Loading place suggestions…
        </div>
      )}

      {/* Itinerary mode button */}
      <button
        onClick={() => setMode('itinerary')}
        style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
          right: 16,
          zIndex: 20,
          background: '#6366f1',
          border: 'none',
          borderRadius: 14, padding: '12px 20px',
          fontSize: '0.85rem', fontWeight: 700, color: '#fff',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(99,102,241,.4)',
        }}
        disabled={selectedPlaces.length === 0}
      >
        <span className="ms fill" style={{ fontSize: 18 }}>route</span>
        Itinerary ({selectedPlaces.length})
      </button>

      {/* Back button */}
      <button
        onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: cityFootprints.length > 0 ? undefined : 12,
          right: cityFootprints.length > 0 ? 12 : undefined,
          zIndex: 20,
          background: 'rgba(15,20,30,.75)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.12)', borderRadius: '50%',
          width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span className="ms" style={{ fontSize: 20, color: '#94a3b8' }}>arrow_back</span>
      </button>

      {/* PinCard (25% bottom sheet on pin tap) */}
      {activePlaceForCard && (
        <PinCard
          place={activePlaceForCard}
          city={city}
          isSelected={selectedIds.has(activePlaceForCard.id)}
          isFavourited={favouritedIds.has(activePlaceForCard.id)}
          onAdd={handleAdd}
          onClose={() => setActiveMarker(null)}
          onSimilar={handleSimilar}
          onFavourite={handleFavourite}
          details={details}
          referencePin={activeRefPin}
          travelDate={tripContext.date}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/route/RouteScreen.tsx
git commit -m "feat: replace RouteScreen with explore/itinerary mode router"
```

---

## Task 11: `ItineraryMapCard` — top 50% of itinerary mode

**Files:**
- Create: `frontend/src/modules/route/ItineraryMapCard.tsx`

- [ ] **Step 1: Create `ItineraryMapCard.tsx`**

Create `frontend/src/modules/route/ItineraryMapCard.tsx`:

```tsx
// modules/route/ItineraryMapCard.tsx
import { useRef } from 'react';
import { Marker, Source, Layer } from 'react-map-gl/maplibre';
import { MapLibreMap } from '../map/MapLibreMap';
import type { MapHandle } from '../map/MapLibreMap';
import type { Place } from '../../shared/types';
import { CATEGORY_EMOJI } from '../map/ExploreMapMarkers';

interface Props {
  mapRef: React.RefObject<MapHandle>;
  center: [number, number];
  selectedPlaces: Place[];
  activeStopIdx: number;
  onFullMap: () => void;
}

export function ItineraryMapCard({ mapRef, center, selectedPlaces, activeStopIdx, onFullMap }: Props) {
  // Build route GeoJSON connecting all selected places in order
  const routeFeature: GeoJSON.Feature<GeoJSON.LineString> | null =
    selectedPlaces.length >= 2
      ? {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: selectedPlaces.map(p => [p.lon, p.lat]),
          },
          properties: {},
        }
      : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapLibreMap
        ref={mapRef}
        center={center}
        places={[]}
        selectedPlace={null}
        onPlaceClick={() => {}}
        onMoveEnd={() => {}}
        routeGeojson={routeFeature}
      >
        {/* Numbered pins for each stop */}
        {selectedPlaces.map((place, idx) => {
          const isActive = idx === activeStopIdx;
          const emoji = CATEGORY_EMOJI[place.category] ?? '📌';
          return (
            <Marker
              key={place.id}
              latitude={place.lat}
              longitude={place.lon}
              anchor="center"
            >
              <div style={{
                position: 'relative',
                width: isActive ? 44 : 34,
                height: isActive ? 44 : 34,
                borderRadius: '50%',
                background: isActive ? 'rgba(59,130,246,.95)' : 'rgba(30,41,59,.9)',
                border: isActive ? '2.5px solid #fff' : '2px solid rgba(255,255,255,.5)',
                boxShadow: isActive
                  ? '0 0 0 3px rgba(59,130,246,.4), 0 4px 16px rgba(0,0,0,.6)'
                  : '0 2px 8px rgba(0,0,0,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.25s ease',
                cursor: 'default',
              }}>
                <span style={{ fontSize: isActive ? 18 : 14, lineHeight: 1 }}>{emoji}</span>
                {/* Stop number badge */}
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  background: isActive ? '#6366f1' : '#334155',
                  border: '1.5px solid rgba(255,255,255,.5)',
                  borderRadius: '50%',
                  width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#fff',
                }}>
                  {idx + 1}
                </div>
              </div>
            </Marker>
          );
        })}
      </MapLibreMap>

      {/* Full-map button — top-right */}
      <button
        onClick={onFullMap}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'rgba(15,20,30,.8)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.12)', borderRadius: 10,
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span className="ms" style={{ fontSize: 18, color: '#94a3b8' }}>fit_screen</span>
      </button>

      {/* Travel direction label — active stop → next stop */}
      {selectedPlaces[activeStopIdx] && selectedPlaces[activeStopIdx + 1] && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(15,20,30,.8)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 999,
          padding: '5px 12px',
          fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap',
        }}>
          <span className="ms" style={{ fontSize: 13 }}>directions_walk</span>
          Next: {selectedPlaces[activeStopIdx + 1].title}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/route/ItineraryMapCard.tsx
git commit -m "feat: add ItineraryMapCard — top 50% numbered route map"
```

---

## Task 12: `ItineraryPlaceCard` — bottom 50% swipeable card

**Files:**
- Create: `frontend/src/modules/route/ItineraryPlaceCard.tsx`

- [ ] **Step 1: Create `ItineraryPlaceCard.tsx`**

Create `frontend/src/modules/route/ItineraryPlaceCard.tsx`:

```tsx
// modules/route/ItineraryPlaceCard.tsx
import { useState, useRef, useEffect } from 'react';
import type { ItineraryStop, Place, WeatherData, ReferencePin } from '../../shared/types';
import { WeatherCanvas } from './WeatherCanvas';
import { getTravelDateBadge } from '../map/pincard-utils';

interface Props {
  stops: ItineraryStop[];
  selectedPlaces: Place[];
  weather?: WeatherData | null;
  referencePins: ReferencePin[];
  travelDate: string;
  onStopChange: (idx: number) => void;
}

const PRICE: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export function ItineraryPlaceCard({
  stops, selectedPlaces, weather, referencePins, travelDate, onStopChange,
}: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const stop = stops[activeIdx] ?? null;

  // When active index changes, notify parent for map sync
  useEffect(() => {
    onStopChange(activeIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= stops.length) return;
    setActiveIdx(idx);
  };

  // Swipe left/right to navigate stops
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      goTo(activeIdx + (dx < 0 ? 1 : -1));
    }
  };

  // Find referencePin for this stop (matched by title)
  const refPin = referencePins.find(rp =>
    rp.title.toLowerCase() === (stop?.place ?? '').toLowerCase()
  ) ?? null;

  // Find matching selectedPlace for price level
  const matchedPlace = selectedPlaces.find(p =>
    p.title.toLowerCase() === (stop?.place ?? '').toLowerCase()
  ) ?? null;

  if (!stop) {
    return (
      <div style={{
        height: '100%', background: '#0f1420',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', fontSize: '0.85rem',
      }}>
        No stops planned yet
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'relative', height: '100%', overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      {/* Weather background */}
      {weather && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <WeatherCanvas condition={weather.condition} />
        </div>
      )}

      {/* Card content */}
      <div style={{
        position: 'relative', zIndex: 1,
        height: '100%', overflowY: 'auto',
        padding: '16px 20px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}>
        {/* Pagination dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 14,
        }}>
          {stops.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === activeIdx ? 20 : 6,
                height: 6, borderRadius: 3,
                background: i === activeIdx ? '#6366f1' : 'rgba(255,255,255,.2)',
                border: 'none', padding: 0, cursor: 'pointer',
                transition: 'width 0.2s ease, background 0.2s ease',
              }}
            />
          ))}
        </div>

        {/* Stop number + time */}
        <div style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase', color: '#6366f1', marginBottom: 6,
        }}>
          Stop {activeIdx + 1} of {stops.length}
          {stop.time && (
            <span style={{ color: '#64748b', marginLeft: 8 }}>· {stop.time}</span>
          )}
        </div>

        {/* Place name */}
        <div style={{
          fontSize: '1.25rem', fontWeight: 800,
          color: '#f1f5f9', lineHeight: 1.2, marginBottom: 6,
        }}>
          {stop.place}
        </div>

        {/* Area + duration + price */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14,
          fontSize: '0.75rem', color: '#64748b',
        }}>
          {stop.duration && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="ms" style={{ fontSize: 14 }}>schedule</span>
              {stop.duration}
            </span>
          )}
          {matchedPlace?.price_level != null && matchedPlace.price_level > 0 && (
            <span>{PRICE[matchedPlace.price_level]}</span>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 14 }} />

        {/* Travel-date intel pill */}
        {stop.tip && (
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(251,191,36,.07)',
            border: '1px solid rgba(251,191,36,.15)',
            marginBottom: 14,
            fontSize: '0.75rem', color: '#fbbf24', lineHeight: 1.5,
          }}>
            ⚡ {stop.tip}
          </div>
        )}

        {/* "Why this for you" */}
        {(refPin?.whyRec || matchedPlace?.reason) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: '#6366f1', marginBottom: 5,
            }}>
              Why this for you
            </div>
            <div style={{
              fontSize: '0.82rem', color: 'rgba(193,198,215,.8)',
              lineHeight: 1.55, fontStyle: 'italic',
            }}>
              {refPin?.whyRec ?? matchedPlace?.reason}
            </div>
          </div>
        )}

        {/* Local tip */}
        {refPin?.localTip && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(251,191,36,.07)',
            border: '1px solid rgba(251,191,36,.15)',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
              Local tip
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(193,198,215,.8)', lineHeight: 1.5 }}>
              {refPin.localTip}
            </div>
          </div>
        )}

        {/* Transit to next */}
        {stop.transit_to_next && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(59,130,246,.08)',
            border: '1px solid rgba(59,130,246,.15)',
            marginBottom: 14,
            fontSize: '0.75rem', color: '#93c5fd',
          }}>
            <span className="ms" style={{ fontSize: 14, flexShrink: 0 }}>directions_transit</span>
            {stop.transit_to_next}
          </div>
        )}

        {/* Nav arrows */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8,
        }}>
          <button
            onClick={() => goTo(activeIdx - 1)}
            disabled={activeIdx === 0}
            style={{
              flex: 1, padding: '10px 0',
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12, color: '#94a3b8',
              fontSize: '0.78rem', fontWeight: 600, cursor: activeIdx > 0 ? 'pointer' : 'not-allowed',
              opacity: activeIdx === 0 ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            <span className="ms" style={{ fontSize: 16 }}>chevron_left</span>
            Prev
          </button>
          <button
            onClick={() => goTo(activeIdx + 1)}
            disabled={activeIdx === stops.length - 1}
            style={{
              flex: 1, padding: '10px 0',
              background: activeIdx < stops.length - 1 ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.05)',
              border: activeIdx < stops.length - 1 ? '1px solid rgba(99,102,241,.3)' : '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              color: activeIdx < stops.length - 1 ? '#a5b4fc' : '#94a3b8',
              fontSize: '0.78rem', fontWeight: 600,
              cursor: activeIdx < stops.length - 1 ? 'pointer' : 'not-allowed',
              opacity: activeIdx === stops.length - 1 ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            Next
            <span className="ms" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fix `ItineraryMapCard` — add missing `activeStopIdx` prop to Task 10's RouteScreen**

In `frontend/src/modules/route/RouteScreen.tsx`, locate the `<ItineraryMapCard` usage and add `activeStopIdx={0}` — it will be wired to shared state in Task 13.

Find:
```tsx
          <ItineraryMapCard
            mapRef={mapRef}
            center={center}
            selectedPlaces={selectedPlaces}
            onFullMap={() => {/* TODO: expand map fullscreen */}}
```

Replace with:
```tsx
          <ItineraryMapCard
            mapRef={mapRef}
            center={center}
            selectedPlaces={selectedPlaces}
            activeStopIdx={itineraryActiveStop}
            onFullMap={() => {/* TODO: expand map fullscreen */}}
```

Then add `const [itineraryActiveStop, setItineraryActiveStop] = useState(0);` near the top of the `RouteScreen` function (after the `mode` state).

And update `ItineraryPlaceCard` usage to pass the setter:
```tsx
              <ItineraryPlaceCard
                stops={itinerary.itinerary}
                selectedPlaces={selectedPlaces}
                weather={weather}
                referencePins={referencePins}
                travelDate={tripContext.date}
                onStopChange={(idx) => {
                  setItineraryActiveStop(idx);
                  const stop = itinerary.itinerary[idx];
                  if (stop?.lat && stop?.lon) {
                    mapRef.current?.flyTo(stop.lat, stop.lon, 15);
                  }
                }}
              />
```

- [ ] **Step 3: Run dev build to confirm no TypeScript errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/route/ItineraryPlaceCard.tsx src/modules/route/ItineraryMapCard.tsx src/modules/route/RouteScreen.tsx
git commit -m "feat: add ItineraryPlaceCard swipeable bottom card + bidirectional map sync"
```

---

## Task 13: `CityHopOverlay` — multi-city arc animation + story cards

**Files:**
- Create: `frontend/src/modules/map/CityHopOverlay.tsx`

This overlay renders when the user transitions between cities. It animates a plane flying along an arc, then shows story cards during the loading window.

- [ ] **Step 1: Create `CityHopOverlay.tsx`**

Create `frontend/src/modules/map/CityHopOverlay.tsx`:

```tsx
// modules/map/CityHopOverlay.tsx
import { useEffect, useState } from 'react';
import type { StoryCard } from '../../shared/types';

interface Props {
  fromCity: string;
  toCity: string;
  storyCards: StoryCard[];
  onDone: () => void;
}

export function CityHopOverlay({ fromCity, toCity, storyCards, onDone }: Props) {
  const [phase, setPhase] = useState<'arc' | 'story'>('arc');
  const [storyIdx, setStoryIdx] = useState(0);
  const [planePos, setPlanePos] = useState(0); // 0..1 along arc

  // Phase 1: animate plane along arc (1.5s)
  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    let raf: number;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setPlanePos(t);
      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setPhase('story');
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Phase 2: rotate story cards every 4.5s, then call onDone after all cards
  useEffect(() => {
    if (phase !== 'story') return;
    if (storyCards.length === 0) { onDone(); return; }
    const timeout = setTimeout(() => {
      if (storyIdx < storyCards.length - 1) {
        setStoryIdx(i => i + 1);
      } else {
        onDone();
      }
    }, 4500);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, storyIdx, storyCards.length]);

  // Parabolic arc: y = -4 * t * (t - 1) → peak at t=0.5
  const arcX = planePos * 100; // percent across container
  const arcY = -4 * planePos * (planePos - 1) * 40; // px upward at peak

  const card = storyCards[storyIdx] ?? null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(5,8,15,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>

      {/* Arc phase */}
      {phase === 'arc' && (
        <div style={{ width: '80%', position: 'relative', height: 100 }}>
          {/* City labels */}
          <div style={{
            position: 'absolute', left: 0, bottom: 0,
            fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8',
          }}>
            {fromCity}
          </div>
          <div style={{
            position: 'absolute', right: 0, bottom: 0,
            fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8',
          }}>
            {toCity}
          </div>

          {/* Dashed arc line (SVG) */}
          <svg
            viewBox="0 0 100 50"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <path
              d="M 0 50 Q 50 0 100 50"
              fill="none"
              stroke="rgba(148,163,184,.3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </svg>

          {/* Plane icon following arc */}
          <div style={{
            position: 'absolute',
            left: `${arcX}%`,
            bottom: `${arcY}px`,
            transform: 'translate(-50%, 50%)',
            fontSize: 28,
            transition: 'none',
          }}>
            ✈️
          </div>
        </div>
      )}

      {/* Story phase */}
      {phase === 'story' && card && (
        <div style={{
          width: '85%', maxWidth: 360,
          borderRadius: 20,
          background: 'rgba(15,20,30,.9)',
          border: '1px solid rgba(255,255,255,.1)',
          overflow: 'hidden',
        }}>
          {/* City context bar */}
          <div style={{
            padding: '10px 16px',
            background: 'rgba(99,102,241,.15)',
            borderBottom: '1px solid rgba(99,102,241,.2)',
            fontSize: '0.7rem', fontWeight: 700, color: '#818cf8',
            letterSpacing: '0.5px',
          }}>
            {card.cityContext}
          </div>

          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{
              fontSize: '1.05rem', fontWeight: 800,
              color: '#f1f5f9', lineHeight: 1.3, marginBottom: 10,
            }}>
              {card.headline}
            </div>
            <div style={{
              fontSize: '0.85rem', color: 'rgba(193,198,215,.75)',
              lineHeight: 1.6,
            }}>
              {card.body}
            </div>
          </div>

          {/* Pagination dots for story cards */}
          {storyCards.length > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 5,
              paddingBottom: 16,
            }}>
              {storyCards.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === storyIdx ? 18 : 6, height: 6,
                    borderRadius: 3,
                    background: i === storyIdx ? '#6366f1' : 'rgba(255,255,255,.2)',
                    transition: 'width 0.2s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* "Skip" button */}
      <button
        onClick={onDone}
        style={{
          marginTop: 32,
          background: 'none', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 999, padding: '8px 20px',
          color: 'rgba(148,163,184,.7)', fontSize: '0.75rem',
          cursor: 'pointer',
        }}
      >
        Skip →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/CityHopOverlay.tsx
git commit -m "feat: add CityHopOverlay arc animation + story card carousel"
```

---

## Task 14: Sequencing reveal animation in `RouteScreen`

**Files:**
- Modify: `frontend/src/modules/route/RouteScreen.tsx`

When transitioning from explore → itinerary mode, play a brief animation showing the route line drawing and a reorder notice if the LLM resequenced any pins.

- [ ] **Step 1: Add sequencing reveal logic to `RouteScreen.tsx`**

In `frontend/src/modules/route/RouteScreen.tsx`, add a `sequencing` state and show a reveal overlay when switching to itinerary mode:

Find the `const [itineraryActiveStop, setItineraryActiveStop] = useState(0);` line and add after it:

```typescript
  const [showSequencingReveal, setShowSequencingReveal] = useState(false);
  const [sequencingNote, setSequencingNote] = useState<string | null>(null);
```

Replace the `onClick={() => setMode('itinerary')}` button handler with:

```tsx
        onClick={() => {
          setShowSequencingReveal(true);
          setSequencingNote(
            selectedPlaces.length > 1
              ? `Sequenced ${selectedPlaces.length} stops by travel time and your preferences`
              : null
          );
          setTimeout(() => {
            setShowSequencingReveal(false);
            setMode('itinerary');
          }, 1800);
        }}
```

Then, inside the Explore mode return, add the sequencing reveal overlay just before the `{/* PinCard */}` section:

```tsx
      {/* Sequencing reveal overlay */}
      {showSequencingReveal && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(5,8,15,0.88)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          animation: 'fadeIn 0.3s ease',
        }}>
          <span className="ms fill" style={{ fontSize: 48, color: '#6366f1', animation: 'spin 1s linear infinite' }}>
            route
          </span>
          {sequencingNote && (
            <div style={{
              maxWidth: 280, textAlign: 'center',
              fontSize: '0.85rem', color: 'rgba(193,198,215,.8)',
              lineHeight: 1.55, padding: '12px 20px',
              background: 'rgba(99,102,241,.1)',
              border: '1px solid rgba(99,102,241,.2)',
              borderRadius: 14,
            }}>
              {sequencingNote}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 2: Add `fadeIn` + `spin` keyframes to `index.css`**

Append to `frontend/src/index.css`:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/route/RouteScreen.tsx src/index.css
git commit -m "feat: add sequencing reveal animation on explore → itinerary transition"
```

---

## Task 15: Update `MapScreen.tsx` callers of `PinCard`

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

`MapScreen` still uses `PinCard` with the old prop signature. The new `PinCard` requires `isFavourited`, `onSimilar`, and `onFavourite`. This task wires those up.

- [ ] **Step 1: Find and update the `PinCard` usage in `MapScreen.tsx`**

Search for `<PinCard` in `MapScreen.tsx`:

```bash
grep -n "PinCard" /Users/souravbiswas/uncover-roads/frontend/src/modules/map/MapScreen.tsx
```

Update the `<PinCard` call site to add the missing props. Add these near the existing `PinCard` destructuring/usage area:

```tsx
// Near the top of MapScreen function, add:
const favouritedIds = useMemo(
  () => new Set(state.favouritedPins.map(f => f.placeId)),
  [state.favouritedPins],
);

// Add to the <PinCard ... /> props:
isFavourited={activePlace ? favouritedIds.has(activePlace.id) : false}
onSimilar={() => {
  // In MapScreen, similar is a no-op — RouteScreen handles it
}}
onFavourite={() => {
  if (!activePlace) return;
  dispatch({
    type: 'TOGGLE_FAVOURITE',
    pin: {
      placeId: activePlace.id,
      title: activePlace.title,
      lat: activePlace.lat,
      lon: activePlace.lon,
      city,
    },
  });
}}
travelDate={state.tripContext.date}
```

- [ ] **Step 2: Run TypeScript check to confirm no errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
git add src/modules/map/MapScreen.tsx
git commit -m "fix: update MapScreen PinCard usage with new required props"
```

---

## Self-Review

### Spec Coverage

| Spec section | Task |
|---|---|
| Explore mode — full-screen map | Task 10 |
| Reference pins (ghost layer) | Tasks 1, 2, 4, 5, 10 |
| 4 pin states: added/similar/reference/favourited | Tasks 1, 2, 6 |
| Pin tap → 25% bottom sheet | Task 10 (PinCard rendered on marker tap) |
| Travel-date context badge | Task 3, 7 |
| "Why this for you" + local tip | Tasks 4, 7 |
| Intel pills (max 2) | Task 7 |
| Google Maps + Website links | Task 7 |
| Primary CTA: Add to itinerary | Task 7 |
| Secondary CTA: ✦ Similar | Tasks 7, 9 |
| Heart / Favourites | Tasks 1, 2, 7, 10 |
| Similar Places flow (teal, connector lines, banner) | Tasks 4, 5, 6, 9 |
| City Footprint Chips | Tasks 1, 2, 8, 10 |
| Itinerary mode — 50/50 split | Tasks 11, 12 |
| Bidirectional map/card sync | Task 12 (onStopChange), Task 11 (activeStopIdx) |
| Weather background | Task 12 (WeatherCanvas in ItineraryPlaceCard) |
| "Why this for you" in itinerary card | Task 12 |
| Detour banner (amber) | Task 12 (stop.tip) |
| Sequencing reveal animation | Task 14 |
| Multi-city — city-hop animation + story cards | Tasks 1, 4, 13 |
| Removed: video ambient background | Task 10 (RouteScreen no longer imports AmbientVideo) |
| Removed: "Open now" | Task 7 (replaced with travel-date badge) |
| Removed: Google editorial summary | Task 7 (removed `description`) |
| Removed: type chips | Task 7 (removed chips block) |
| Removed: Wikipedia link | Task 7 |
| Removed: Directions CTA on pin card | Task 7 |

### Gaps found and addressed

1. **`ItineraryMapCard` was missing `activeStopIdx` prop** — fixed inline in Task 12, Step 2.
2. **`MapScreen.tsx` uses `PinCard` with old props** — addressed in Task 15.
3. **Story cards from `/reference-pins`** are returned but need to be stored somewhere. The `RouteScreen` receives them from the API call and can store them in local state for the `CityHopOverlay`. This is handled implicitly — the `CityHopOverlay` receives `storyCards` directly and the loading flow in `RouteScreen` can pass them through. No separate store field is needed.

### Placeholder scan

None found — all steps contain complete code.

### Type consistency check

- `ExploreMapMarkers` imports `ReferencePin` from types ✓
- `SimilarPins.tsx` dispatches `SET_REFERENCE_PINS` and `SET_SIMILAR_PINS` — both defined in Task 2 ✓
- `useSimilarPins` calls `api.similarPlaces()` defined in Task 5 ✓
- `getTravelDateBadge` is exported from `pincard-utils.ts` and imported in `PinCard.tsx` and `ItineraryPlaceCard.tsx` ✓
- `ItineraryMapCard` receives `activeStopIdx: number` prop — added in Task 12 fix step ✓
- `FootprintChips` receives `footprints: CityFootprint[]` — matches store type ✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-25-itinerary-screen-design.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
