# Explore Screen Redesign — Implementation Plan
*2026-05-16 · Spec: `docs/superpowers/specs/2026-05-16-explore-screen-redesign-design.md`*

## Branch
`feature/explore-redesign`

## Context
Full rewrite of DestinationScreen to match approved design: contextual hero image, single invariant search bar, persona curated city cards, recent visits from last session. Six old sub-components deleted, four new ones created. Light+dark theme from day one using token system.

---

## Tasks

### Task 1 — Delete deprecated components
**Files to delete:**
- `src/modules/destination/InProgressSection.tsx`
- `src/modules/destination/ExploreEmptyState.tsx`
- `src/modules/destination/DraftBanner.tsx`
- `src/modules/destination/PlaceChips.tsx`
- `src/modules/destination/PlacePhotoScroll.tsx`
- `src/modules/destination/CityHeroCard.tsx`

Remove their imports from `index.ts`. Run `tsc --noEmit` to confirm no dangling refs.

---

### Task 2 — Create `useLastSession` hook
**File:** `src/modules/destination/useLastSession.ts`

```ts
interface LastSession {
  places: Place[];
  city: string;
  savedAt: string; // ISO
}
```

- `useLastSession()` → `{ session: LastSession | null, saveSession, clearSession }`
- Reads from `localStorage` key `uncover:lastSession`
- `saveSession(places, city)` writes and sets `savedAt = new Date().toISOString()`
- Entries older than 30 days treated as null on read
- `clearSession()` removes key
- Export `saveSession` as a standalone function so `MapScreen` can call it on navigate-away

**Tests:** hook reads null when empty, reads data when set, ignores stale (>30d), saves and reads back.

---

### Task 3 — Create `ExploreHero` component
**File:** `src/modules/destination/ExploreHero.tsx`

Props:
```ts
interface ExploreHeroProps {
  city: string | null;
  persona: Persona | null;
  savedTripCity?: string | null;
  userName: string;
}
```

- Compute greeting label from `new Date().getHours()` (5–12=morning, 12–17=afternoon, 17–21=evening, else=night)
- Select hero image per spec hierarchy:
  1. `city` → `getCityPhotoUrl(city)` (already in `DestinationScreen.tsx` — move to shared util)
  2. `savedTripCity` → `getCityPhotoUrl(savedTripCity)`
  3. `persona?.archetype` → archetype editorial map (flaneur, gastronaut, nightCreature, etc.)
  4. fallback → `photo-1476514525405-09b77a9d1f66`
- Ken Burns: `@keyframes kenBurns` from `index.css` (`heroKenBurns` already exists)
- Gradient overlay: dark / light variants (see spec)
- Watermark: city name or "EXPLORE" in Cormorant Garamond, `rgba(255,255,255,.04)`
- App icon tile: frosted white `rgba(255,255,255,.15)` bg (on photo so always safe), gold `explore` icon

Height: 236px, `flex-shrink:0`.

---

### Task 4 — Rewrite `ExploreSearchBar`
**File:** `src/modules/destination/ExploreSearchBar.tsx`

Current file is being replaced entirely.

Props:
```ts
interface ExploreSearchBarProps {
  onCitySelect: (city: string) => void;
  onNearMe: () => void;
}
```

- Single bar, always the same. No state-driven changes.
- Tapping bar body → opens `CitySearch` autocomplete overlay (existing component, unchanged)
- `near_me` button → calls browser `navigator.geolocation.getCurrentPosition`, resolves city via reverse geocode, calls `onNearMe()` with that city
- Use CSS tokens for colors (not hardcoded rgba):
  - Dark: `background:var(--color-surface)`, `border:1px solid var(--color-border)`
  - Light: handled by token system

---

### Task 5 — Create `CuratedCityCards` component
**File:** `src/modules/destination/CuratedCityCards.tsx`

Props:
```ts
interface CuratedCityCardsProps {
  persona: Persona | null;
  travelStartDate: string | null;
  travelEndDate: string | null;
  onCitySelect: (city: string) => void;
}
```

- Section label + optional date pill (when `travelStartDate` set)
- Horizontal scroll row of city cards (136×178px with dates / 136×188px without)
- City list: derive from persona archetype → curated map; fallback static list:
  ```ts
  const FALLBACK_CITIES = ['Lisbon', 'Kyoto', 'Istanbul', 'Marrakech', 'Porto', 'Vienna'];
  ```
- Per-archetype picks (3–4 cities each): flaneur=Paris/Prague/Lisbon, gastronaut=Tokyo/Lyon/Istanbul, nightCreature=Berlin/Ibiza/Bangkok, etc.
- Card tap: if dates set → `dispatch GO_TO:map` with city+dates; else → open calendar (pass `onCitySelect` callback to parent)
- Card: photo (Unsplash `getCityPhotoUrl`), gradient, city name (Cormorant), country sub-label, archetype tag pill

---

### Task 6 — Create `RecentVisits` component
**File:** `src/modules/destination/RecentVisits.tsx`

Props:
```ts
interface RecentVisitsProps {
  session: LastSession | null;
  onOpenMap: (places: Place[]) => void;
}
```

- Empty state: dashed box with `pin_drop` icon + message text (token colors, not hardcoded)
- With data: section label "Recent visits · [city]"
- Show first 3–4 places as rows:
  - 40×40px rounded thumbnail (Unsplash photo or fallback)
  - Place name (`var(--color-text-1)`), category · neighbourhood (`var(--color-text-2)`)
  - Chevron (`var(--color-text-4)`)
  - Tap → `onOpenMap([place])`
- Overflow row (when `places.length > 4`):
  - Stacked 24px thumbnails (first 2) + "+N" count bubble
  - Text "N more pins"
  - Tap → `onOpenMap(allPlaces)`
- Multi-city: group by `place._city`, gold heading per group using `var(--color-primary-text)`
- Row dividers: `var(--color-divider)`

---

### Task 7 — Rewrite `DestinationScreen`
**File:** `src/modules/destination/DestinationScreen.tsx`

Wire everything together:

```tsx
export function DestinationScreen() {
  const { state, dispatch } = useAppStore();
  const { city, travelStartDate, travelEndDate, persona, savedTrips } = state;
  const { session } = useLastSession();
  const [showCalendar, setShowCalendar] = useState(false);
  const [pendingCity, setPendingCity] = useState<string | null>(null);

  const userName = // split auth displayName on first space
  const savedTripCity = savedTrips?.[savedTrips.length - 1]?.city ?? null;

  function handleCitySelect(selectedCity: string) {
    dispatch({ type: 'SET_CITY', city: selectedCity });
    setShowCalendar(true);
  }

  function handleNearMe() {
    // set today as date, go to map
  }

  function handleDateSelect(start: string, end: string) {
    dispatch({ type: 'SET_TRAVEL_DATES', startDate: start, endDate: end });
  }

  function handleCalendarClose() {
    setShowCalendar(false);
    if (travelStartDate) dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function handleOpenMap(places: Place[]) {
    places.forEach(p => dispatch({ type: 'SET_PENDING_PLACE', place: p }));
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <ExploreHero city={city} persona={persona} savedTripCity={savedTripCity} userName={userName} />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <ExploreSearchBar onCitySelect={handleCitySelect} onNearMe={handleNearMe} />
        {/* MultiCityChips — when 2+ cities */}
        <CuratedCityCards
          persona={persona}
          travelStartDate={travelStartDate}
          travelEndDate={travelEndDate}
          onCitySelect={handleCitySelect}
        />
        <RecentVisits session={session} onOpenMap={handleOpenMap} />
      </div>
      {showCalendar && (
        <DateRangeCalendar onSelect={handleDateSelect} onClose={handleCalendarClose} />
      )}
    </div>
  );
}
```

---

### Task 8 — Wire `saveSession` in MapScreen
**File:** `src/modules/map/MapScreen.tsx`

When user navigates away from map (dispatch `GO_TO` to destination/trips/profile), call:
```ts
import { saveSession } from '../destination/useLastSession';
saveSession(state.selectedPlaces, state.city ?? '');
```

Hook into the existing navigation dispatch — wrap in a `useEffect` watching `currentScreen`, or intercept dispatch.

---

### Task 9 — Update `index.ts` exports and run type check
- Update `src/modules/destination/index.ts` to export new components
- Remove deleted component exports
- Run `npx tsc --noEmit` — must pass clean
- Run `npm test` in destination module — existing calendar/search tests must still pass

---

### Task 10 — Visual QA both themes
Manual checks (no automated visual regression):
- [ ] Dark: first use — generic travel editorial, "Good morning, [Name]", no recent visits
- [ ] Dark: returning Paris — Paris photo, "Good evening", 3 recent visits + overflow
- [ ] Light: same states — warm cream bg, readable text, gold as `#7a5c18` for text
- [ ] Search bar: identical in all states
- [ ] `near_me`: tapping resolves geolocation, skips calendar
- [ ] Curated card tap (no dates): calendar opens
- [ ] Curated card tap (with dates): goes straight to map
- [ ] Recent visits tap: map opens with those pins
- [ ] Bottom nav: 3 tabs, Explore active

---

## Files Summary

| Action | File |
|---|---|
| Delete | `InProgressSection.tsx`, `ExploreEmptyState.tsx`, `DraftBanner.tsx`, `PlaceChips.tsx`, `PlacePhotoScroll.tsx`, `CityHeroCard.tsx` |
| Create | `useLastSession.ts`, `ExploreHero.tsx`, `CuratedCityCards.tsx`, `RecentVisits.tsx` |
| Rewrite | `DestinationScreen.tsx`, `ExploreSearchBar.tsx` |
| Touch | `MapScreen.tsx` (saveSession call), `index.ts` |
| Untouched | `CitySearch.tsx`, `DateRangeCalendar.tsx`, `useCitySearch.ts`, `types.ts` |
