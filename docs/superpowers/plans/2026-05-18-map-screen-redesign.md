# Map Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up and extend the Map screen — remove redundant UI, unify bottom controls into a tray, fix curated tab degradation, and expand pin categories on both frontend and backend.

**Architecture:** Each task is self-contained and can be deployed independently. Backend category mapping expands the Google + OSM data pipelines. Frontend changes are purely presentational with no new state.

**Tech Stack:** React + TypeScript, MapLibre (react-map-gl/maplibre), Zustand store, FastAPI Python backend, Google Places Nearby Search API, OSM Overpass fallback.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/modules/map/FilterBar.tsx` | Remove "All" sub-chip; fix reset logic |
| `frontend/src/modules/map/MapScreen.tsx` | Remove back button (single-city); wire BottomActionTray; fix curated degradation |
| `frontend/src/modules/map/BottomActionTray.tsx` | **Create** — unified bottom tray (date + Surprise Me + Build) |
| `frontend/src/modules/map/types.ts` | Add CATEGORY_ICONS + CATEGORY_LABELS for 16 new categories |
| `main.py` | Tier 1: remap bar/nightclub; Tier 2: add 10+ new types; Tier 3: OSM beach + market |

Existing components **BuildItineraryBar**, **SurpriseMeButton**, and the inline **TravelDateBar** in MapScreen are replaced by **BottomActionTray** — but the source files for SurpriseMeButton and TravelDateBar stay (they export logic/utils still used elsewhere).

---

### Task 1: Remove "All" sub-chip from FilterBar

**Files:**
- Modify: `frontend/src/modules/map/FilterBar.tsx:4-11,45-48,118-119`

- [ ] **Step 1: Remove the 'all' entry from SUB_CHIPS**

Replace lines 4–11 in `FilterBar.tsx`:

```ts
const SUB_CHIPS = [
  { key: 'historic',   label: 'Landmarks', icon: 'account_balance' },
  { key: 'cafe',       label: 'Cafes',     icon: 'local_cafe' },
  { key: 'park',       label: 'Parks',     icon: 'park' },
  { key: 'restaurant', label: 'Dining',    icon: 'restaurant' },
  { key: 'museum',     label: 'Galleries', icon: 'palette' },
];
```

- [ ] **Step 2: Update handleSubChip — no longer needs 'all' sentinel**

Replace lines 45–48:

```ts
function handleSubChip(key: string) {
  onCategorySelect(key);
  setExpanded(false);
}
```

- [ ] **Step 3: Add a "Clear" chip as first item in the expanded row so user can reset**

In the sub-category row (line 118), add a clear chip before `{SUB_CHIPS.map(...)}`:

```tsx
{/* Clear chip — resets to no category filter */}
<button
  onClick={() => { onCategorySelect(null); setExpanded(false); }}
  style={{
    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
    padding: '4px 10px', height: 26, borderRadius: 999,
    background: activeCategory === null ? 'rgba(212,168,83,.15)' : 'rgba(15,20,30,.75)',
    border: activeCategory === null ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
    color: activeCategory === null ? 'var(--color-primary-text)' : 'var(--color-text-2)',
    fontSize: '0.72rem', fontWeight: 600,
    backdropFilter: 'blur(8px)', cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all 0.12s ease',
  }}
>
  <span className="ms" style={{ fontSize: 12 }}>layers</span>
  All
</button>
```

- [ ] **Step 4: Fix the isActive check for remaining chips (no longer needs `key === 'all'` branch)**

The existing chip render loop line 119:
```tsx
const isActive = chip.key === 'all' ? activeCategory === null : activeCategory === chip.key;
```
Simplify to:
```tsx
const isActive = activeCategory === chip.key;
```

- [ ] **Step 5: TypeScript check**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add frontend/src/modules/map/FilterBar.tsx
git -C /Users/souravbiswas/uncover-roads commit -m "fix(map): remove redundant All sub-chip, add clear chip"
```

---

### Task 2: Remove back button in single-city mode

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx:517-527`

The back button is currently rendered when `!isMultiCity`. Per the design decision: in single-city mode there is no back — the user can tap Explore/other tabs from the bottom nav. In multi-city mode, the MultiCityHeader is shown instead (unchanged).

- [ ] **Step 1: Remove the back button branch**

In `MapScreen.tsx` lines 517–527, replace the `else` branch (single-city back button):

```tsx
{/* Row 1: multi-city tab header only; single-city has no back button */}
{isMultiCity && (
  <div style={{ pointerEvents: 'auto' }}>
    <MultiCityHeader
      cityFootprints={cityFootprints}
      activeCityIdx={activeCityIndex}
      transitSummary={transitSummary}
      onCityTap={(idx) => {
        dispatch({ type: 'SET_ACTIVE_CITY_INDEX', index: idx });
        const f = cityFootprints[idx];
        if (f) mapHandleRef.current?.flyTo(f.lat, f.lon, 12);
      }}
      onAddCity={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
    />
  </div>
)}
```

Note: `goBack` is still used elsewhere (useMap hook) so leave the destructuring.

- [ ] **Step 2: TypeScript check**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add frontend/src/modules/map/MapScreen.tsx
git -C /Users/souravbiswas/uncover-roads commit -m "fix(map): remove back button in single-city mode"
```

---

### Task 3: Create BottomActionTray component

**Files:**
- Create: `frontend/src/modules/map/BottomActionTray.tsx`

This tray replaces three separate bottom-area elements:
1. `TravelDateBar` (currently centred in the top area, should move to bottom)
2. `SurpriseMeButton` (currently floating bottom-right)
3. `BuildItineraryBar` (currently a portal-based full-width button)

The tray is always rendered (not portal-based). It shows contextually:
- **No places selected**: shows TravelDateBar (if dates set) + Surprise Me side-by-side
- **Places selected**: shows "Build Itinerary · N places" button full width + small Surprise Me below it
- **1 place selected**: "Add one more place to build" hint

- [ ] **Step 1: Create BottomActionTray.tsx**

```tsx
import type { Place } from '../../shared/types'

interface Props {
  startDate: string | null
  endDate: string | null
  cities: string[]
  onDateTap: () => void
  itineraryPlaces: Place[]
  days: number
  buildLoading: boolean
  onBuild: () => void
  surpriseDisabled: boolean
  surpriseLoading: boolean
  onSurprise: () => void
}

const MIN_PLACES = 2

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function BottomActionTray({
  startDate, endDate, cities, onDateTap,
  itineraryPlaces, days, buildLoading, onBuild,
  surpriseDisabled, surpriseLoading, onSurprise,
}: Props) {
  const count = itineraryPlaces.length
  const canBuild = count >= MIN_PLACES
  const hasItinerary = count > 0
  const hasDates = !!(startDate && endDate)

  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''
  const buildLabel = buildLoading
    ? 'Building…'
    : `Build itinerary · ${count} place${count === 1 ? '' : 's'}${dayPart}`

  const travelParts: string[] = hasDates
    ? [
        `${formatDate(startDate!)} – ${formatDate(endDate!)}`,
        ...(cities.length > 1 ? [`${cities.length} cities`] : []),
      ]
    : []

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 60,
        padding: '10px 16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        background: 'rgba(12,12,14,.0)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', pointerEvents: 'auto' }}>

        {/* Build itinerary button — only when places are selected */}
        {hasItinerary && (
          <>
            <button
              disabled={!canBuild || buildLoading}
              onClick={canBuild && !buildLoading ? onBuild : undefined}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                border: 'none', cursor: canBuild ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.01em',
                background: canBuild
                  ? 'linear-gradient(135deg, #d4a853, #b8893a)'
                  : 'var(--color-border)',
                color: canBuild ? '#0c0c0e' : 'var(--color-text-3)',
                opacity: canBuild ? 1 : 0.7,
                boxShadow: canBuild ? '0 6px 28px rgba(212,168,83,.25)' : 'none',
                backdropFilter: 'blur(16px)',
                transition: 'all 0.15s ease',
              }}
            >
              {buildLabel} →
            </button>
            {!canBuild && (
              <p style={{ textAlign: 'center', margin: '0 0 2px', fontSize: '0.68rem', color: 'var(--color-text-3)' }}>
                Add one more place to build
              </p>
            )}
          </>
        )}

        {/* Bottom row: date pill + Surprise Me */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* Date pill — left side, only when dates are set */}
          {hasDates ? (
            <button
              onClick={onDateTap}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 999,
                background: 'rgba(15,20,30,0.88)', border: '1px solid var(--color-border-m)',
                backdropFilter: 'blur(12px)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <span className="ms text-primary" style={{ fontSize: 14 }}>calendar_today</span>
              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text-1)', letterSpacing: '0.01em' }}>
                {travelParts.join(' · ')}
              </span>
            </button>
          ) : (
            <div />
          )}

          {/* Surprise Me — right side */}
          <button
            disabled={surpriseLoading || surpriseDisabled}
            onClick={surpriseLoading || surpriseDisabled ? undefined : onSurprise}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 999,
              backgroundColor: 'rgba(10,14,23,0.88)', border: '1px solid #8b5cf6',
              color: surpriseLoading ? 'var(--color-text-2)' : '#c4b5fd',
              fontSize: '0.78rem', fontWeight: 700,
              cursor: surpriseLoading || surpriseDisabled ? 'not-allowed' : 'pointer',
              backdropFilter: 'blur(12px)', transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ fontSize: 13 }}>✦</span>
            {surpriseLoading ? 'Building…' : 'Surprise Me'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add frontend/src/modules/map/BottomActionTray.tsx
git -C /Users/souravbiswas/uncover-roads commit -m "feat(map): add BottomActionTray component"
```

---

### Task 4: Wire BottomActionTray into MapScreen + remove old components

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

- [ ] **Step 1: Add BottomActionTray import, remove BuildItineraryBar + SurpriseMeButton + TravelDateBar imports**

Replace:
```tsx
import { SurpriseMeButton } from './SurpriseMeButton'
import { BuildItineraryBar } from './BuildItineraryBar'
import { TravelDateBar } from './TravelDateBar'
```
With:
```tsx
import { BottomActionTray } from './BottomActionTray'
```

- [ ] **Step 2: Add surpriseLoading state (SurpriseMeButton previously owned this state)**

Add near other useState declarations:
```tsx
const [surpriseLoading, setSurpriseLoading] = useState(false)
```

- [ ] **Step 3: Wrap _runSurprise to set surpriseLoading**

Update `handleSurprise` to set loading before calling `_runSurprise`:
```tsx
const handleSurprise = useCallback(async () => {
  if (!city) return
  if (!personaProfile) {
    setEventsError('Complete your persona first to use Surprise Me')
    setTimeout(() => setEventsError(null), 3500)
    return
  }
  if (state.engineItinerary) {
    setSurpriseConfirm(true)
    return
  }
  setSurpriseLoading(true)
  try {
    await _runSurprise()
  } finally {
    setSurpriseLoading(false)
  }
}, [city, personaProfile, state.engineItinerary, _runSurprise])
```

- [ ] **Step 4: Remove TravelDateBar from top overlay**

Remove the entire TravelDateBar block in the top overlay (lines ~529–539):
```tsx
{/* Travel date bar */}
{(state.travelStartDate || state.travelEndDate) && (
  <div style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'center' }}>
    <TravelDateBar ... />
  </div>
)}
```

- [ ] **Step 5: Remove old SurpriseMeButton floating div (lines ~691–696)**

Remove:
```tsx
{/* Surprise Me (bottom-right) */}
{city && (
  <div style={{ position: 'absolute', bottom: selectedPlaces.length > 0 ? 100 : 72, right: 12, zIndex: 19 }}>
    <SurpriseMeButton onSurprise={handleSurprise} disabled={!city || !personaProfile} />
  </div>
)}
```

- [ ] **Step 6: Replace BuildItineraryBar with BottomActionTray (lines ~729–734)**

Replace:
```tsx
{/* Build itinerary bar — uses portal, renders when places added */}
<BuildItineraryBar
  itineraryPlaces={selectedPlaces}
  days={activeCityDays}
  onBuild={handleBuild}
/>
```
With:
```tsx
{city && (
  <BottomActionTray
    startDate={state.travelStartDate}
    endDate={state.travelEndDate}
    cities={cityContexts.map(c => c.city)}
    onDateTap={() => {}}
    itineraryPlaces={selectedPlaces}
    days={activeCityDays}
    buildLoading={buildLoading}
    onBuild={handleBuild}
    surpriseDisabled={!personaProfile}
    surpriseLoading={surpriseLoading}
    onSurprise={handleSurprise}
  />
)}
```

- [ ] **Step 7: TypeScript check**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add frontend/src/modules/map/MapScreen.tsx
git -C /Users/souravbiswas/uncover-roads commit -m "feat(map): wire BottomActionTray, remove BuildItineraryBar/SurpriseMeButton/TravelDateBar from map"
```

---

### Task 5: Fix curated tab — show OurPicks even when events fail

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

Currently the events error causes a toast that overshadows the OurPicks that loaded fine. The fix: decouple events error from the curated tab — show events error as an inline notice only (not blocking), and always show OurPicks.

- [ ] **Step 1: Replace eventsError toast with a gentler inline indicator**

Replace the `{eventsError && ...}` toast block (lines ~611–620) with a smaller, non-blocking notice that only shows when curated is active:

```tsx
{eventsError && activeFilter === 'curated' && (
  <div
    className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full"
    style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)', zIndex: 25, background: 'rgba(15,20,30,.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)' }}
  >
    <span className="ms fill text-text-3" style={{ fontSize: 13 }}>event_busy</span>
    <span className="text-text-3" style={{ fontSize: '0.68rem' }}>Events unavailable</span>
  </div>
)}
```

- [ ] **Step 2: Ensure OurPicks still render on events API failure**

The `OurPicksPinsLayer` is already rendered independently. Verify that `setOurPicks([])` is NOT called in the events fetch catch block (it shouldn't be — they're separate effects). If it is, remove that call.

Check that in the events useEffect catch block (line ~310–314) only `setLiveEvents([])` is called, not `setOurPicks`. Current code:
```tsx
.catch(() => {
  setEventsError('Events unavailable — check back later')
  setLiveEvents([])
  setEventsLoaded(false)
})
```
This is already correct — `setOurPicks` is not called. No change needed here.

- [ ] **Step 3: TypeScript check**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add frontend/src/modules/map/MapScreen.tsx
git -C /Users/souravbiswas/uncover-roads commit -m "fix(map): soften events error toast; OurPicks renders independently of events"
```

---

### Task 6: Expand CATEGORY_ICONS + CATEGORY_LABELS in types.ts

**Files:**
- Modify: `frontend/src/modules/map/types.ts`

New categories to add: `bar`, `nightlife`, `viewpoint`, `gallery`, `street_art`, `bakery`, `spa`, `spiritual`, `stadium`, `zoo`, `aquarium`, `library`, `cinema`, `amusement_park`, `beach`, `market`.

All use Material Symbols icon names (same icon font already used by the app).

- [ ] **Step 1: Replace CATEGORY_ICONS and CATEGORY_LABELS with expanded versions**

```ts
export const CATEGORY_ICONS: Record<string, string> = {
  // Existing
  restaurant:    'restaurant',
  cafe:          'local_cafe',
  park:          'park',
  museum:        'museum',
  historic:      'account_balance',
  tourism:       'photo_camera',
  place:         'location_on',
  event:         'celebration',
  // New
  bar:           'local_bar',
  nightlife:     'nightlife',
  viewpoint:     'landscape',
  gallery:       'palette',
  street_art:    'brush',
  bakery:        'bakery_dining',
  spa:           'spa',
  spiritual:     'temple_buddhist',
  stadium:       'stadium',
  zoo:           'pets',
  aquarium:      'water',
  library:       'local_library',
  cinema:        'theaters',
  amusement_park:'attractions',
  beach:         'beach_access',
  market:        'storefront',
};

export const CATEGORY_LABELS: Record<string, string> = {
  // Existing
  restaurant:    'Dining',
  cafe:          'Cafe',
  park:          'Park',
  museum:        'Museum',
  historic:      'Historic',
  tourism:       'Tourism',
  place:         'Place',
  event:         'Event',
  // New
  bar:           'Bar',
  nightlife:     'Nightlife',
  viewpoint:     'Viewpoint',
  gallery:       'Gallery',
  street_art:    'Street Art',
  bakery:        'Bakery',
  spa:           'Spa',
  spiritual:     'Spiritual',
  stadium:       'Stadium',
  zoo:           'Zoo',
  aquarium:      'Aquarium',
  library:       'Library',
  cinema:        'Cinema',
  amusement_park:'Theme Park',
  beach:         'Beach',
  market:        'Market',
};
```

Also add the new categories to `SUB_CHIPS` in `FilterBar.tsx` so users can filter by them:

```ts
const SUB_CHIPS = [
  { key: 'historic',      label: 'Landmarks',  icon: 'account_balance' },
  { key: 'cafe',          label: 'Cafes',      icon: 'local_cafe' },
  { key: 'park',          label: 'Parks',      icon: 'park' },
  { key: 'restaurant',    label: 'Dining',     icon: 'restaurant' },
  { key: 'museum',        label: 'Museums',    icon: 'museum' },
  { key: 'bar',           label: 'Bars',       icon: 'local_bar' },
  { key: 'nightlife',     label: 'Nightlife',  icon: 'nightlife' },
  { key: 'gallery',       label: 'Art',        icon: 'palette' },
  { key: 'viewpoint',     label: 'Views',      icon: 'landscape' },
  { key: 'beach',         label: 'Beaches',    icon: 'beach_access' },
  { key: 'market',        label: 'Markets',    icon: 'storefront' },
  { key: 'spiritual',     label: 'Spiritual',  icon: 'temple_buddhist' },
  { key: 'spa',           label: 'Spa',        icon: 'spa' },
];
```

- [ ] **Step 2: TypeScript check**

Run: `cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add frontend/src/modules/map/types.ts frontend/src/modules/map/FilterBar.tsx
git -C /Users/souravbiswas/uncover-roads commit -m "feat(map): add 16 new pin categories with icons, labels, and filter chips"
```

---

### Task 7: Backend Tier 1 + 2 — expand Google Places category mapping

**Files:**
- Modify: `main.py:2037-2045` (`_NEARBY_TYPE_TO_CATEGORY`)

- [ ] **Step 1: Replace _NEARBY_TYPE_TO_CATEGORY with expanded mapping**

```python
_NEARBY_TYPE_TO_CATEGORY = {
    # Existing (corrected)
    "restaurant":         "restaurant",
    "cafe":               "cafe",
    "bar":                "bar",          # was "restaurant"
    "museum":             "museum",
    "tourist_attraction": "tourism",
    "park":               "park",
    "night_club":         "nightlife",    # was "restaurant"
    # Tier 2 additions
    "bakery":             "bakery",
    "spa":                "spa",
    "church":             "spiritual",
    "mosque":             "spiritual",
    "hindu_temple":       "spiritual",
    "stadium":            "stadium",
    "zoo":                "zoo",
    "aquarium":           "aquarium",
    "library":            "library",
    "movie_theater":      "cinema",
    "amusement_park":     "amusement_park",
    "art_gallery":        "gallery",
}
```

- [ ] **Step 2: Confirm the Google Nearby Search loop uses _NEARBY_TYPE_TO_CATEGORY correctly**

Check `main.py:482` — the loop `for gtype, category in _NEARBY_TYPE_TO_CATEGORY.items()` calls Google's Nearby Search for each type. New types will automatically be queried.

No code change needed here — just verify.

- [ ] **Step 3: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add main.py
git -C /Users/souravbiswas/uncover-roads commit -m "feat(backend): expand Google Places category mapping — bar, nightlife, gallery, spa, spiritual, stadium, zoo, aquarium, library, cinema, amusement_park"
```

---

### Task 8: Backend Tier 3 — expand OSM Overpass query + category mapping

**Files:**
- Modify: `main.py:348-418` (`_overpass_map_data`)

- [ ] **Step 1: Add new OSM query tags to the Overpass query**

Replace the query string (lines 350–364):

```python
    query = f"""
[out:json][timeout:25];
(
  node["amenity"~"restaurant|cafe|bar|food_court"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"="museum"]["name"](around:{radius_m},{clat},{clon});
  way["amenity"="museum"]["name"](around:{radius_m},{clat},{clon});
  node["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"](around:{radius_m},{clat},{clon});
  way["tourism"~"attraction|museum|artwork|viewpoint|gallery"]["name"](around:{radius_m},{clat},{clon});
  node["leisure"~"park|garden|nature_reserve"]["name"](around:{radius_m},{clat},{clon});
  way["leisure"~"park|garden|nature_reserve"]["name"](around:{radius_m},{clat},{clon});
  node["historic"]["name"](around:{radius_m},{clat},{clon});
  way["historic"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"="marketplace"]["name"](around:{radius_m},{clat},{clon});
  way["amenity"="marketplace"]["name"](around:{radius_m},{clat},{clon});
  node["natural"="beach"]["name"](around:{radius_m},{clat},{clon});
  way["natural"="beach"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"~"bar|nightclub"]["name"](around:{radius_m},{clat},{clon});
  node["amenity"~"library|cinema|spa"]["name"](around:{radius_m},{clat},{clon});
);
out center 200;
"""
```

- [ ] **Step 2: Expand the category inference block**

Replace lines 379–397 (the `if/elif` chain that derives `cat` from OSM tags):

```python
        amenity  = tags.get("amenity", "")
        tourism  = tags.get("tourism", "")
        leisure  = tags.get("leisure", "")
        historic = tags.get("historic", "")
        natural  = tags.get("natural", "")

        if amenity in ("bar", "nightclub", "pub"):
            cat = "bar"
        elif amenity in ("restaurant", "food_court") or tags.get("cuisine"):
            cat = "restaurant"
        elif amenity == "cafe":
            cat = "cafe"
        elif amenity == "museum" or tourism == "museum":
            cat = "museum"
        elif amenity == "marketplace":
            cat = "market"
        elif amenity == "library":
            cat = "library"
        elif amenity == "cinema":
            cat = "cinema"
        elif amenity == "spa":
            cat = "spa"
        elif leisure in ("park", "nature_reserve"):
            cat = "park"
        elif leisure == "garden":
            cat = "park"
        elif natural == "beach":
            cat = "beach"
        elif historic:
            cat = "historic"
        elif tourism == "artwork":
            cat = "street_art"
        elif tourism == "viewpoint":
            cat = "viewpoint"
        elif tourism == "gallery":
            cat = "gallery"
        elif tourism in ("attraction",):
            cat = "tourism"
        else:
            cat = "place"
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/souravbiswas/uncover-roads add main.py
git -C /Users/souravbiswas/uncover-roads commit -m "feat(backend): expand OSM Overpass query — beach, market, bar, library, cinema, spa, street_art, viewpoint, gallery"
```

---

## Execution checklist (summary)

- [ ] Task 1 — FilterBar: remove All sub-chip
- [ ] Task 2 — MapScreen: remove back button (single-city)
- [ ] Task 3 — BottomActionTray: create component
- [ ] Task 4 — MapScreen: wire BottomActionTray, remove old components
- [ ] Task 5 — MapScreen: fix curated tab events degradation
- [ ] Task 6 — types.ts + FilterBar: add 16 new categories
- [ ] Task 7 — main.py: Tier 1 + 2 Google Places mapping
- [ ] Task 8 — main.py: Tier 3 OSM Overpass expansion
