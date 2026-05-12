# Map Search Improvements — Design Spec
**Date:** 2026-04-22
**Scope:** 6 improvements to the search tab on MapScreen

---

## 1. Rotating Placeholder Text

**Goal:** Replace static `"Search places in ${city}…"` with rotating example queries that show users what they can type.

**Behaviour:**
- Cycles through contextual strings every **1.5 seconds** with a CSS `opacity` fade transition (~200ms ease).
- Strings are built from the current city's known streets/districts/landmarks (derived from existing `city` context).
- Example rotation: `"Museums near Rue de Rivoli…"` → `"Hotels in Montmartre…"` → `"Parks near the Eiffel Tower…"` → `"Galleries in Le Marais…"` → `"Restaurants on Champs-Élysées…"`
- Falls back to generic names (`"Museums in this area…"`) if no city context is available.
- Rotation stops and placeholder clears immediately when the user focuses the input.

**Implementation:** `useEffect` + `setInterval` in `MapScreen.tsx`. Strings derived from a static array keyed by city, or a generic fallback array.

---

## 2. Area Search (No Location Given)

**Goal:** When a user types a place type without specifying a location, search within the current map viewport.

**Behaviour:**
- After keyword extraction (see #6), if `types` are resolved but no named location is found, call `map.getBounds()` to get the current viewport bbox and pass it to `nominatimSearch`.
- If the bbox diagonal exceeds **~15 km**, show an inline nudge below the search bar:
  *"Showing [type]s in this area. Zoom in for more accurate results."*
- On `zoomend`, if there is an active type-only search (no named location), automatically re-run the search with the new bbox.
- Newly loaded pins from the re-run play the **glow burst** highlight animation (see §2a below).
- Results are capped at **10** for area searches.

**§2a — Glow burst highlight:**
- Each newly loaded matching pin scales to `1.4×` with a coloured glow (`box-shadow: 0 0 16px 6px rgba(124,140,248,0.8)`), staggered by ~100ms per pin.
- Animation plays once, ~400ms total, then pin returns to its normal style.
- Implemented via a temporary CSS class added to the marker's DOM element (accessible via `marker.getElement()`). Class is removed after the animation ends via `animationend` event listener.

---

## 3. Two-Zone Tap on Search Result Row

**Goal:** A single search result row supports two distinct tap targets — navigate to pin vs. open full details card.

**Row layout (left → right):**
```
[category icon]  [name]          [ⓘ icon]
                 [address/street]
```

**Behaviour:**
- **Left zone** (icon + name + address): closes the search dropdown, flies the map to the pin's coordinates, selects it on the map.
- **Right zone** (ⓘ icon, `~40×44px` tap target): opens the full `PinCard` bottom sheet for that place, showing rating, opening hours, links (Google Maps, website, Wikipedia).
- No distance shown — address/street only (derived from Nominatim `display_name`, neighbourhood or street segment).

---

## 4. Fix Swipe-Down on Cluster Picker

**Root cause:** The cluster picker (`clusterGroup` div in `MapScreen.tsx`) has no touch gesture handling. Downward swipe events fall through to MapLibre, which pans the map, firing `moveend` and triggering a data reload.

**Fix:**
- Attach imperative `touchstart` / `touchmove` (non-passive) / `touchend` listeners to the cluster picker container ref — identical pattern to `PinCard.tsx` lines 100–132.
- `touchmove`: call `e.preventDefault()` on downward swipes (`dy > 0`) to block MapLibre from receiving the gesture. Apply `translateY(${dy}px)` to the container.
- `touchend`: if `dragY > 80`, animate out and call `setClusterGroup(null)`. Otherwise snap back to `translateY(0)`.
- Add a drag handle pill at the top of the cluster picker (matching `PinCard` style) as a visual affordance.

---

## 5. Result Row — Show Address, Remove Place Type

**Goal:** Clean up the result row. Place type is redundant when the user searched for it. Address is the useful piece of information.

**Before:** `[icon] [name]  [rating]  [type label]`
**After:** `[icon] [name]  [ⓘ]`
`          [address/street]`

- Remove `CATEGORY_LABELS` display from search result rows.
- Remove rating from the list — rating is available when the user opens the ⓘ card.
- Address shown as a secondary line in muted colour (`text-text-3`), truncated to one line.
- Source: Nominatim result `display_name` — extract the street name and neighbourhood/arrondissement.

---

## 6. Smart Search — Keyword Extraction + Multi-Type

**Goal:** Parse free-text queries to extract place types and named locations. Support multiple types in one query.

### 6a — Keyword extraction (client-side dictionary)

Two dictionaries, checked in order:

**Direct type map** (exact or partial word match → `Category`):
| Input words | Resolved types |
|---|---|
| museum, gallery, art, exhibit | `museum` |
| hotel, hostel, accommodation, stay, sleep | `tourism` (OSM `tourism=hotel`) |
| park, garden, nature, green, outdoor | `park` |
| restaurant, dining, food, eat, lunch, dinner | `restaurant` |
| cafe, coffee, breakfast, brunch, cozy, morning | `cafe` |
| bar, pub, drinks, nightlife, evening, night | `place` (OSM `amenity=bar/pub`) |
| church, mosque, temple, cathedral | `historic` |
| landmark, monument, historic, heritage | `historic` |
| shop, market, shopping, buy, mall | `place` (OSM `shop=*`) |

> Note: resolved types must be valid `Category` values from `types.ts`. Where no exact category exists, use `place` with an OSM tag filter passed to the Nominatim query.

**Intent map** (contextual words → suggested types):
| Words in query | Suggested chips |
|---|---|
| morning, breakfast, cozy | cafe, bakery |
| night, evening, drinks | bar, restaurant |
| kids, family, children | park, museum |
| culture, art, history | museum, gallery, historic |
| nature, walk, green, fresh air | park, garden |
| shop, buy, market | market, shop |
| (no match at all) | cafe, museum, park (defaults) |

**Multi-type:** if the user writes `"museums and parks"`, both types are extracted. Fire **parallel** Nominatim calls (one per type), merge results, deduplicate by OSM `place_id`.

**Named location extraction:** after stripping recognised type/intent words, remaining significant words (≥4 chars, not stop words) are treated as a named location query and passed to `placesAutocomplete()` to resolve coordinates.

### 6b — No-match nudge

When the dictionary returns zero types:
- Show **contextual suggestion chips** below the search bar, derived from the intent map above.
- Chip format: `[emoji] [type label]` (e.g. ☕ cafe), tappable, rounded pill style.
- Tapping a chip: sets search query to that type label, fires area search (#2).
- Message above chips: *"We're still learning — try one of these"* in muted text.
- If intent map also returns nothing: show 3 default chips (cafe, museum, park).

---

## Component Impact Summary

| File | Changes |
|---|---|
| `MapScreen.tsx` | Rotating placeholder, area search trigger, cluster picker swipe fix, zoom re-run logic |
| `PinCard.tsx` | No changes |
| `SearchResultRow.tsx` | New component — two-zone row (extracted from inline JSX in MapScreen) |
| `SearchNudge.tsx` | New component — smart chip suggestions + "zoom in" nudge |
| `useSmartSearch.ts` | New hook — keyword extraction, multi-type parallel search, chip generation |
| `api.ts` | Minor: support array of bbox-scoped Nominatim calls |
| `types.ts` | Add `SearchIntent` type for extracted query structure |
