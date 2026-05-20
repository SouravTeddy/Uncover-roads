# Map Screen — 7 Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 map screen issues covering the saved banner, curated tab, category counts, guide bulb, tray overlap, city/date top-right, and a full PinCard redesign.

**Architecture:** Each issue is a targeted, self-contained change. Issues 1–6 are surgical edits to `MapScreen.tsx` and supporting components. Issue 7 splits into (a) a new pure utility function in `pincard-utils.ts` and (b) a full visual rebuild of `PinCard.tsx`.

**Tech Stack:** React 18, Vitest (co-located `.test.ts`), framer-motion, CSS custom properties (`var(--color-*)`), Cormorant Garamond + DM Sans via Google Fonts.

---

## File Map

| File | Changes |
|------|---------|
| `frontend/src/modules/map/MapScreen.tsx` | Issues 1, 3, 5, 6 — city-filter banner, displayCount, hide tray on activePinId, new right-column |
| `frontend/src/modules/map/BottomActionTray.tsx` | Issue 5+6 — remove date pill and its props |
| `frontend/src/modules/map/FilterBar.tsx` | Issue 3 — rename `allCount` → `displayCount` |
| `frontend/src/modules/map/useGuideMessages.ts` | Issue 4 — reset prevConditions on city change |
| `frontend/src/modules/map/pincard-utils.ts` | Issue 7a — add `computeAnalysisInsights` |
| `frontend/src/modules/map/PinCard.tsx` | Issue 7b — full redesign |
| `frontend/src/modules/map/pincard-utils.test.ts` | Tests for `computeAnalysisInsights` |
| `frontend/src/modules/map/useGuideMessages.test.ts` | Tests for city-reset behaviour |

---

## Task 1 — Issue 1: City-scoped Saved Banner

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx:512`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/MapScreen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
// Pure logic test — no component render needed

function cityFavsCount(favouritedPins: Array<{ city: string }>, city: string): number {
  return favouritedPins.filter(p => p.city === city).length
}

describe('cityFavsCount', () => {
  it('returns 0 when all saves are from other cities', () => {
    const pins = [{ city: 'Tokyo' }, { city: 'Tokyo' }]
    expect(cityFavsCount(pins, 'Sydney')).toBe(0)
  })

  it('returns only the count for the current city', () => {
    const pins = [{ city: 'Tokyo' }, { city: 'Sydney' }, { city: 'Sydney' }]
    expect(cityFavsCount(pins, 'Sydney')).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/MapScreen.test.tsx
```

Expected: FAIL — `cityFavsCount` is not defined.

- [ ] **Step 3: Apply fix in MapScreen.tsx**

Find line 512 in `MapScreen.tsx`:
```tsx
{favouritedPins.length > 0 && (
```
Change to:
```tsx
{favouritedPins.filter(p => p.city === city).length > 0 && (
```

Also fix the count displayed at line 532:
```tsx
<span style={{ opacity: 0.7 }}>{favouritedPins.length}</span>
```
Change to:
```tsx
<span style={{ opacity: 0.7 }}>{favouritedPins.filter(p => p.city === city).length}</span>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/modules/map/MapScreen.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx frontend/src/modules/map/MapScreen.test.tsx
git commit -m "fix(map): scope saved banner and count to current city"
```

---

## Task 2 — Issue 2: Curated Tab Count / Pins Audit

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx:272–280, 377`

- [ ] **Step 1: Audit the fetch and count**

Read lines 272–280 and 377 of `MapScreen.tsx`. The current state:
- `ourPicks` fetch runs only when `activeFilter === 'curated'`
- `curatedCount = ourPicks.length + liveEvents.length + recommendedPlaces.length` (line 377)
- `curatedCount` is passed to `FilterBar` before the fetch resolves if the user has never tapped Curated yet

- [ ] **Step 2: Add the guard — only show count after data loads**

Find line 377:
```tsx
const curatedCount = ourPicks.length + liveEvents.length + recommendedPlaces.length;
```

Add a loading flag. At line 160 where `ourPicks` state is declared, add a companion flag:
```tsx
const [ourPicks, setOurPicks] = useState<PlacePickFE[]>([])
const [ourPicksLoaded, setOurPicksLoaded] = useState(false)
```

In the fetch effect (lines 272–280), update:
```tsx
useEffect(() => {
  if (!city || activeFilter !== 'curated') { setOurPicks([]); setOurPicksLoaded(false); return }
  const activeCityContext = cityContexts[activeCityIndex]
  const cityId = activeCityContext?.city ?? city
  fetch(`/api/cities/picks?city_id=${encodeURIComponent(cityId)}`)
    .then(r => r.ok ? r.json() : [])
    .then((data: PlacePickFE[]) => { setOurPicks(data); setOurPicksLoaded(true) })
    .catch(() => { setOurPicks([]); setOurPicksLoaded(true) })
}, [city, activeFilter, activeCityIndex, cityContexts])
```

Update `curatedCount` at line 377:
```tsx
const curatedCount = ourPicksLoaded
  ? ourPicks.length + liveEvents.length + recommendedPlaces.length
  : 0
```

- [ ] **Step 3: Add dev warning for empty data**

Inside the `.then` handler, after `setOurPicksLoaded(true)`:
```tsx
if (data.length === 0) console.warn('[MapScreen] ourPicks resolved empty for city:', cityId)
```

- [ ] **Step 4: Verify manually**

Run dev server and tap Curated tab — the count should only appear after the fetch resolves. If the API returns empty, the count is 0 and no pins appear (consistent).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "fix(map): show curated count only after picks fetch resolves"
```

---

## Task 3 — Issue 3: Category Counts — displayCount Fix

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx:500–508`
- Modify: `frontend/src/modules/map/FilterBar.tsx:20–27, 82–84`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/FilterBar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'

// Pure logic — compute displayCount
function getDisplayCount(
  activeCategories: string[],
  filteredPlaces: Array<unknown>,
  allPlaces: Array<unknown>,
): number {
  return activeCategories.length > 0 ? filteredPlaces.length : allPlaces.length
}

describe('getDisplayCount', () => {
  it('returns total when no category filter active', () => {
    expect(getDisplayCount([], [1, 2], [1, 2, 3, 4])).toBe(4)
  })

  it('returns filtered length when category active', () => {
    expect(getDisplayCount(['cafe'], [1, 2], [1, 2, 3, 4])).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/modules/map/FilterBar.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Compute displayCount in MapScreen.tsx**

In `MapScreen.tsx`, find line 503:
```tsx
allCount={places.length}
```

Above the return statement (after `curatedCount` on line 377), add:
```tsx
const displayCount = activeCategories.length > 0 ? filteredPlaces.length : places.length
```

Then change line 503:
```tsx
allCount={displayCount}
```

- [ ] **Step 4: Rename prop in FilterBar.tsx**

In `FilterBar.tsx`, rename the prop from `allCount` to `displayCount`:

Props interface (line 23):
```tsx
allCount: number
```
→
```tsx
displayCount: number
```

Destructure (line 31):
```tsx
allCount, curatedCount,
```
→
```tsx
displayCount, curatedCount,
```

Usage (line 82):
```tsx
{allCount > 0 && (
  <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>· {allCount}</span>
)}
```
→
```tsx
{displayCount > 0 && (
  <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>· {displayCount}</span>
)}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/modules/map/FilterBar.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx frontend/src/modules/map/FilterBar.tsx frontend/src/modules/map/FilterBar.test.tsx
git commit -m "fix(map): show category-filtered count in All tab"
```

---

## Task 4 — Issue 4: Guide Bulb — Reset on City Change

**Files:**
- Modify: `frontend/src/modules/map/useGuideMessages.ts:221–261`
- Modify/Create: `frontend/src/modules/map/useGuideMessages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/useGuideMessages.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGuideMessages } from './useGuideMessages'
import type { Place, Persona, PersonaProfile, LiveEvent } from '../../shared/types'

const persona: Persona = 'explorer' as unknown as Persona
const profile: PersonaProfile = { archetype: 'explorer', stops_per_day: 3, venue_filters: ['tourism'] } as PersonaProfile
const place: Place = { id: '1', title: 'Opera House', lat: -33.8, lon: 151.2, category: 'tourism', photo_ref: null, tags: {}, rating: null } as Place

describe('useGuideMessages city reset', () => {
  it('fires area message again when city changes', () => {
    const { result, rerender } = renderHook(
      ({ city }: { city: string }) =>
        useGuideMessages([], city, persona, profile, [place], null, [], null, null, 2),
      { initialProps: { city: 'Sydney' } }
    )

    // First render — area message should fire
    const firstCount = result.current.messages.length
    expect(firstCount).toBe(1)

    // City changes to Tokyo — area message should fire again
    rerender({ city: 'Tokyo' })
    expect(result.current.messages.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/modules/map/useGuideMessages.test.ts
```

Expected: FAIL — second rerender produces no new message (rising edge never detected).

- [ ] **Step 3: Add city-reset effect in useGuideMessages.ts**

In `useGuideMessages.ts`, after the `clusterFired` ref declaration (line 229), add:

```ts
// Reset rising-edge tracking on city change so area message re-fires
useEffect(() => {
  prevConditions.current = { area: false, event: false, 'build-ready': false, cluster: false }
}, [city])
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/modules/map/useGuideMessages.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/useGuideMessages.ts frontend/src/modules/map/useGuideMessages.test.ts
git commit -m "fix(map): reset guide bulb rising-edge on city change"
```

---

## Task 5 — Issue 5: Hide BottomActionTray Behind PinCard

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx:742–754`

- [ ] **Step 1: Wrap BottomActionTray with activePinId guard**

Find lines 742–754 in `MapScreen.tsx`:

```tsx
{/* BottomActionTray — lifted outside the stacking-context div so it renders above BottomNav (zIndex 30) */}
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
  />
)}
```

Replace with:

```tsx
{/* BottomActionTray — hidden when PinCard is open to prevent overlap */}
{city && !activePinId && (
  <BottomActionTray
    itineraryPlaces={selectedPlaces}
    days={activeCityDays}
    buildLoading={buildLoading}
    onBuild={handleBuild}
  />
)}
```

Note: `startDate`, `endDate`, `cities`, `onDateTap` props are removed here — they will be cleaned from `BottomActionTray` in Task 6.

- [ ] **Step 2: Verify**

Run dev server. Open a pin — the build itinerary tray should disappear. Close the pin — it reappears.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "fix(map): hide BottomActionTray when PinCard is open"
```

---

## Task 6 — Issue 6: City Name + Date Top-Right + Remove Date Pill

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx:544–560`
- Modify: `frontend/src/modules/map/BottomActionTray.tsx`

**Sub-task A: Remove date pill from BottomActionTray**

- [ ] **Step 1: Strip date props from BottomActionTray.tsx**

Replace the entire file content of `BottomActionTray.tsx` with:

```tsx
import type { Place } from '../../shared/types'

interface Props {
  itineraryPlaces: Place[]
  days: number
  buildLoading: boolean
  onBuild: () => void
}

const MIN_PLACES = 2

export function BottomActionTray({ itineraryPlaces, days, buildLoading, onBuild }: Props) {
  const count = itineraryPlaces.length
  const canBuild = count >= MIN_PLACES
  const hasItinerary = count > 0
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''
  const buildLabel = buildLoading
    ? 'Building…'
    : `Build itinerary · ${count} place${count === 1 ? '' : 's'}${dayPart}`

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 60,
        padding: '10px 16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', pointerEvents: 'auto' }}>
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
      </div>
    </div>
  )
}
```

**Sub-task B: Add city/date/bulb right column in MapScreen.tsx**

- [ ] **Step 2: Replace GuideBulb block with right-column**

Find lines 545–560 in `MapScreen.tsx`:

```tsx
{/* GuideBulb — top-right, same level as FilterBar */}
<div
  style={{
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
    right: '1rem',
    zIndex: 25,
    pointerEvents: 'auto',
  }}
>
  <GuideBulb
    messages={guideMessages}
    hasUnread={guideHasUnread}
    onRead={markGuideRead}
  />
</div>
```

Replace with:

```tsx
{/* Right column — city name, travel dates, guide bulb */}
<div
  style={{
    position: 'absolute',
    top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
    right: '1rem',
    zIndex: 25,
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  }}
>
  {city && (
    <span
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {city}
    </span>
  )}
  {state.travelStartDate && state.travelEndDate && (
    <span
      onClick={() => {}}
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--color-text-3)',
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      {new Date(state.travelStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      {' – '}
      {new Date(state.travelEndDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
    </span>
  )}
  <GuideBulb
    messages={guideMessages}
    hasUnread={guideHasUnread}
    onRead={markGuideRead}
  />
</div>
```

- [ ] **Step 3: Verify**

Run dev server. Top-right should show city name in gold Cormorant Garamond, dates in small muted text below, bulb below that. Tray has no date pill.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx frontend/src/modules/map/BottomActionTray.tsx
git commit -m "feat(map): move city+date to top-right, remove date pill from tray"
```

---

## Task 7a — Issue 7: computeAnalysisInsights Utility

**Files:**
- Modify: `frontend/src/modules/map/pincard-utils.ts`
- Create: `frontend/src/modules/map/pincard-utils.test.ts`

The function takes `(place, details, ourPickBadge, travelStart, travelEnd)` and returns up to 3 insight strings in priority order: trend velocity → hours/open status → best-time heuristic.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/map/pincard-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeAnalysisInsights } from './pincard-utils'
import type { Place, PlaceDetails } from '../../shared/types'

const basePlace = (category: string): Place => ({
  id: '1', title: 'Test', lat: 0, lon: 0, category,
  photo_ref: null, tags: {}, rating: null,
}) as Place

const baseDetails = (overrides: Partial<PlaceDetails> = {}): PlaceDetails => ({
  place_id: '1', name: 'Test', address: '', lat: 0, lon: 0,
  rating: null, rating_count: null, price_level: null,
  weekday_text: [], photo_ref: null, open_now: null,
  ...overrides,
}) as PlaceDetails

describe('computeAnalysisInsights', () => {
  it('returns trend velocity insight for trending badge', () => {
    const insights = computeAnalysisInsights(
      basePlace('tourism'), baseDetails(), 'trending', '2026-05-20', '2026-05-27'
    )
    expect(insights[0]).toContain('Popular in May')
  })

  it('returns hidden gem insight', () => {
    const insights = computeAnalysisInsights(
      basePlace('cafe'), baseDetails(), 'hidden_gem', '2026-05-20', '2026-05-27'
    )
    expect(insights[0]).toContain('Hidden gem')
  })

  it('returns getting busy insight', () => {
    const insights = computeAnalysisInsights(
      basePlace('cafe'), baseDetails(), 'getting_busy', '2026-05-20', '2026-05-27'
    )
    expect(insights[0]).toContain('Getting popular')
  })

  it('returns hours insight when all travel days open', () => {
    // weekday_text for all 7 days — none closed
    const weekday_text = [
      'Monday: 9:00 AM – 10:00 PM',
      'Tuesday: 9:00 AM – 10:00 PM',
      'Wednesday: 9:00 AM – 10:00 PM',
      'Thursday: 9:00 AM – 10:00 PM',
      'Friday: 9:00 AM – 10:00 PM',
      'Saturday: 9:00 AM – 10:00 PM',
      'Sunday: 9:00 AM – 10:00 PM',
    ]
    const insights = computeAnalysisInsights(
      basePlace('museum'), baseDetails({ weekday_text }), null, '2026-05-20', '2026-05-21'
    )
    // At least one insight should mention open
    expect(insights.some(i => i.toLowerCase().includes('open'))).toBe(true)
  })

  it('returns closed alert when place closed on a travel day', () => {
    const weekday_text = [
      'Monday: 9:00 AM – 10:00 PM',
      'Tuesday: Closed',
      'Wednesday: 9:00 AM – 10:00 PM',
      'Thursday: 9:00 AM – 10:00 PM',
      'Friday: 9:00 AM – 10:00 PM',
      'Saturday: 9:00 AM – 10:00 PM',
      'Sunday: 9:00 AM – 10:00 PM',
    ]
    // 2026-05-19 is a Tuesday
    const insights = computeAnalysisInsights(
      basePlace('museum'), baseDetails({ weekday_text }), null, '2026-05-19', '2026-05-19'
    )
    expect(insights.some(i => i.toLowerCase().includes('closed'))).toBe(true)
  })

  it('returns heuristic for landmark on weekend travel', () => {
    // 2026-05-23 is a Saturday
    const insights = computeAnalysisInsights(
      basePlace('tourism'), baseDetails(), null, '2026-05-23', '2026-05-24'
    )
    expect(insights.some(i => i.includes('weekends'))).toBe(true)
  })

  it('returns no more than 3 insights', () => {
    const weekday_text = [
      'Monday: 9:00 AM – 10:00 PM',
      'Tuesday: 9:00 AM – 10:00 PM',
      'Wednesday: 9:00 AM – 10:00 PM',
      'Thursday: 9:00 AM – 10:00 PM',
      'Friday: 9:00 AM – 10:00 PM',
      'Saturday: 9:00 AM – 10:00 PM',
      'Sunday: 9:00 AM – 10:00 PM',
    ]
    const insights = computeAnalysisInsights(
      basePlace('tourism'), baseDetails({ weekday_text }), 'trending', '2026-05-23', '2026-05-24'
    )
    expect(insights.length).toBeLessThanOrEqual(3)
  })

  it('returns empty array when no insights apply', () => {
    const insights = computeAnalysisInsights(basePlace('place'), baseDetails(), null, null, null)
    expect(insights).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/modules/map/pincard-utils.test.ts
```

Expected: FAIL — `computeAnalysisInsights` not exported.

- [ ] **Step 3: Implement computeAnalysisInsights in pincard-utils.ts**

Append to `frontend/src/modules/map/pincard-utils.ts`:

```ts
type OurPickBadge = 'trending' | 'hidden_gem' | 'getting_busy' | null

/**
 * Returns up to 3 travel-aware insight strings for the Our Analysis aura strip.
 * Priority: trend velocity → hours/open status → best-time heuristic.
 */
export function computeAnalysisInsights(
  place: { category: string },
  details: { weekday_text?: string[]; open_now?: boolean | null } | null | undefined,
  ourPickBadge: OurPickBadge,
  travelStart: string | null,
  travelEnd: string | null,
): string[] {
  const insights: string[] = []

  // 1. Trend velocity — from ourPicks badge
  if (ourPickBadge && travelStart) {
    const month = new Date(travelStart + 'T12:00:00Z').toLocaleString('en-US', {
      month: 'long', timeZone: 'UTC',
    })
    if (ourPickBadge === 'trending') {
      insights.push(`Popular in ${month} — can get busy around your trip`)
    } else if (ourPickBadge === 'hidden_gem') {
      insights.push(`Hidden gem — fewer crowds during your trip`)
    } else if (ourPickBadge === 'getting_busy') {
      insights.push(`Getting popular — worth visiting early in your trip`)
    }
  }

  // 2. Hours / open status across travel days
  if (details?.weekday_text?.length && travelStart && travelEnd) {
    const start = new Date(travelStart + 'T12:00:00Z')
    const end = new Date(travelEnd + 'T12:00:00Z')
    const closedDays: string[] = []
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const jsDay = d.getUTCDay()
      const googleIdx = jsDay === 0 ? 6 : jsDay - 1
      const line = details.weekday_text[googleIdx]
      if (line && /closed/i.test(line)) {
        closedDays.push(DAY_NAMES[jsDay])
      }
    }

    if (closedDays.length === 0) {
      insights.push(`Open on all your travel days`)
    } else {
      insights.push(`Closed on ${closedDays[0]} — check your itinerary`)
    }
  }

  // 3. Best visiting time heuristic
  if (travelStart && travelEnd) {
    const startDay = new Date(travelStart + 'T12:00:00Z').getUTCDay()
    const endDay = new Date(travelEnd + 'T12:00:00Z').getUTCDay()
    const includesWeekend = (() => {
      const start = new Date(travelStart + 'T12:00:00Z')
      const end = new Date(travelEnd + 'T12:00:00Z')
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.getUTCDay()
        if (day === 0 || day === 6) return true
      }
      return false
    })()

    const cat = place.category
    if ((cat === 'tourism' || cat === 'park' || cat === 'historic') && includesWeekend) {
      insights.push(`Gets busy on weekends — go early morning`)
    } else if (cat === 'restaurant') {
      insights.push(`Peak lunch 12–2pm — consider booking ahead`)
    } else if (cat === 'cafe') {
      const allWeekdays = (() => {
        const start = new Date(travelStart + 'T12:00:00Z')
        const end = new Date(travelEnd + 'T12:00:00Z')
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
          const day = d.getUTCDay()
          if (day === 0 || day === 6) return false
        }
        return true
      })()
      if (allWeekdays) {
        insights.push(`Quieter on weekdays — your trip includes weekday mornings`)
      }
    }
  }

  // Suppress heuristic (insight[2]) if it duplicates the hours/open message logic
  // (no overlap possible — different message bodies)

  return insights.slice(0, 3)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/modules/map/pincard-utils.test.ts
```

Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/map/pincard-utils.ts frontend/src/modules/map/pincard-utils.test.ts
git commit -m "feat(map): add computeAnalysisInsights for Our Analysis aura strip"
```

---

## Task 7b — Issue 7: PinCard Full Redesign

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`

This is a full visual rewrite. The component contract (props) does not change. New additions:
- `ourPickBadge` prop (derived from `MapScreen` — see step 3)
- Hero: 190px, single image from `details?.photo_ref ?? place.photo_ref`
- Heart button overlaid top-right on hero with dark glass pill (both themes)
- Scrollable body max 80vh (only body scrolls, hero stays fixed)
- Category chip, place name in Cormorant Garamond gold gradient, address
- Meta chips: Open/Closed (sage), Rating (amber), Price (surface2)
- Our Analysis aura strip (calls `computeAnalysisInsights`)
- Description (place.tags?.description if present, truncated)
- Hours row
- CTA: gold gradient button / outlined in-itinerary state
- framer-motion stagger on sections

- [ ] **Step 1: Add ourPickBadge prop to PinCard**

In `MapScreen.tsx`, find where `<PinCard>` is rendered. Pass the active place's badge:

First, find the ourPicks badge for the active place. After `const isFavourited = ...` (line 373), add:

```tsx
const activeOurPickBadge = activePlace
  ? (ourPicks.find(p => p.place_id === activePlace.id)?.badge ?? null)
  : null
```

Then find the `<PinCard>` render in `MapScreen.tsx` and add `ourPickBadge={activeOurPickBadge}` as a prop.

- [ ] **Step 2: Verify framer-motion is available**

```bash
cat frontend/package.json | grep framer-motion
```

If not present:
```bash
cd frontend && npm install framer-motion
```

- [ ] **Step 3: Rewrite PinCard.tsx**

Replace the full content of `frontend/src/modules/map/PinCard.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Place, PlaceDetails, ReferencePin } from '../../shared/types'
import type { Persona, PersonaProfile } from '../../shared/types'
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types'
import { getPlacePhotoUrl, api } from '../../shared/api'
import { computeAnalysisInsights } from './pincard-utils'
import { useSheetDismiss } from '../../shared/useSheetDismiss'

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
}

const PRICE: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

interface Props {
  place: Place
  city: string
  isSelected: boolean
  isFavourited: boolean
  onAdd: () => void
  onClose: () => void
  onFavourite: () => void
  details?: PlaceDetails | null
  referencePin?: ReferencePin | null
  travelDate?: string | null
  travelStartDate?: string | null
  travelEndDate?: string | null
  persona?: Persona | null
  personaProfile?: PersonaProfile | null
  ourPickBadge?: 'trending' | 'hidden_gem' | 'getting_busy' | null
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
}

const containerVariants = {
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onFavourite,
  details, travelDate, travelStartDate, travelEndDate,
  ourPickBadge = null,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const dragY = useRef(0)
  const closing = useRef(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    document.documentElement.style.overscrollBehaviorY = 'none'
    document.body.style.overscrollBehaviorY = 'none'
    return () => {
      cancelAnimationFrame(id)
      document.documentElement.style.overscrollBehaviorY = ''
      document.body.style.overscrollBehaviorY = ''
    }
  }, [])

  const photoRef = details?.photo_ref ?? place.photo_ref ?? null
  const googlePhotoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null

  useEffect(() => {
    closing.current = false
    setImgSrc(null)
    if (googlePhotoUrl) {
      const img = new Image()
      img.onload = () => setImgSrc(googlePhotoUrl)
      img.onerror = () => {
        api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url) })
      }
      img.src = googlePhotoUrl
    } else {
      api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, googlePhotoUrl])

  useSheetDismiss(onClose, true)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    dragY.current = 0
  }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`
      dragY.current = dy
    }
  }, [])
  const handleTouchEnd = useCallback(() => {
    if (dragY.current > 80 && !closing.current) {
      closing.current = true
      if (sheetRef.current) {
        sheetRef.current.style.transform = 'translateY(100%)'
        sheetRef.current.style.transition = 'transform 0.25s ease'
      }
      setTimeout(onClose, 240)
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    dragY.current = 0
  }, [onClose])

  const catColor = CATEGORY_COLORS[place.category] ?? '#6b7280'
  const catIcon = CATEGORY_ICONS[place.category] ?? 'location_on'
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place'
  const rating = details?.rating ?? place.rating ?? null
  const ratingCount = details?.rating_count ?? null
  const priceLevel = details?.price_level ?? null
  const openNow = details?.open_now ?? null
  const description = (place as Place & { description?: string }).description ?? null
  const weekdayText = details?.weekday_text ?? []

  // Resolve travel start/end: prefer explicit props, fall back to travelDate for single-day
  const resolvedStart = travelStartDate ?? travelDate ?? null
  const resolvedEnd = travelEndDate ?? travelDate ?? null

  const insights = computeAnalysisInsights(place, details ?? null, ourPickBadge, resolvedStart, resolvedEnd)

  return (
    <>
      <div
        onClick={() => { if (!closing.current) { closing.current = true; onClose() } }}
        style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.01)' }}
      />

      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          backdropFilter: 'blur(20px)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          willChange: 'transform',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, touchAction: 'none', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-m)' }} />
        </div>

        {/* Hero — fixed 190px, does not scroll */}
        <div style={{ height: 190, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {imgSrc ? (
            <img src={imgSrc} alt={place.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(135deg, ${catColor}22, ${catColor}44)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms fill" style={{ fontSize: 56, color: catColor, opacity: 0.6 }}>{catIcon}</span>
            </div>
          )}

          {/* Bottom gradient fade */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--color-surface) 0%, transparent 55%)' }} />

          {/* Heart button — dark glass, same both themes */}
          <button
            onClick={onFavourite}
            style={{
              position: 'absolute', top: 11, right: 11,
              width: 36, height: 36, borderRadius: '50%',
              background: isFavourited ? 'rgba(212,168,83,0.35)' : 'rgba(0,0,0,0.48)',
              border: `1px solid ${isFavourited ? 'rgba(212,168,83,0.5)' : 'rgba(255,255,255,0.18)'}`,
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isFavourited ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Scrollable body */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '12px 16px 32px',
            flex: 1,
          }}
        >
          {/* Category chip */}
          <motion.div variants={sectionVariants} style={{ marginBottom: 6 }}>
            <span style={{
              display: 'inline-block',
              fontSize: '0.7rem', fontWeight: 700,
              color: catColor,
              background: catColor + '18',
              borderRadius: 99,
              padding: '2px 8px',
            }}>
              {categoryLabel}
            </span>
          </motion.div>

          {/* Place name */}
          <motion.h2
            variants={sectionVariants}
            style={{
              margin: '0 0 4px',
              fontFamily: 'var(--font-heading)',
              fontSize: 24, fontWeight: 700, lineHeight: 1.1,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {place.title}
          </motion.h2>

          {/* Address */}
          {details?.address && (
            <motion.p
              variants={sectionVariants}
              style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--color-text-3)' }}
            >
              {details.address.split(',')[0]}
            </motion.p>
          )}

          {/* Meta chips row */}
          <motion.div variants={sectionVariants} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {openNow !== null && (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: 99,
                background: openNow ? 'var(--color-sage-bg)' : 'var(--color-amber-bg)',
                border: `1px solid ${openNow ? 'var(--color-sage-bdr)' : 'var(--color-amber-bdr)'}`,
                color: openNow ? 'var(--color-sage)' : 'var(--color-amber)',
              }}>
                {openNow ? 'Open' : 'Closed'}
              </span>
            )}
            {rating !== null && (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: 99,
                background: 'var(--color-amber-bg)',
                border: '1px solid var(--color-amber-bdr)',
                color: 'var(--color-amber)',
              }}>
                ★ {typeof rating === 'number' ? rating.toFixed(1) : rating}
                {ratingCount !== null && (
                  <span style={{ fontWeight: 400, opacity: 0.7 }}> ({(ratingCount as number).toLocaleString()})</span>
                )}
              </span>
            )}
            {priceLevel !== null && priceLevel in PRICE && (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: 99,
                background: 'var(--color-surface2)',
                border: '1px solid var(--color-border-m)',
                color: 'var(--color-text-3)',
              }}>
                {PRICE[priceLevel as keyof typeof PRICE]}
              </span>
            )}
          </motion.div>

          {/* Our Analysis aura strip */}
          {insights.length > 0 && (
            <motion.div
              variants={sectionVariants}
              style={{
                position: 'relative',
                background: 'var(--color-primary-bg)',
                border: '1px solid rgba(212,168,83,.22)',
                borderRadius: 12,
                padding: '10px 12px 10px 16px',
                marginBottom: 14,
                overflow: 'hidden',
              }}
            >
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3,
                background: 'linear-gradient(to bottom, var(--color-primary), var(--color-primary-dk))',
                borderRadius: '12px 0 0 12px',
              }} />
              {/* Glow */}
              <div style={{
                position: 'absolute', top: -20, left: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(212,168,83,.22)',
                filter: 'blur(24px)',
                pointerEvents: 'none',
              }} />
              <p style={{ margin: '0 0 6px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Our Analysis
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {insights.map((text, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-2)', lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Description */}
          {description && (
            <motion.div variants={sectionVariants} style={{ marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                {descExpanded || description.length <= 120 ? description : description.slice(0, 120) + '…'}
              </p>
              {description.length > 120 && (
                <button
                  onClick={() => setDescExpanded(e => !e)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: 'var(--color-primary)', cursor: 'pointer', marginTop: 2 }}
                >
                  {descExpanded ? 'See less' : 'See more →'}
                </button>
              )}
            </motion.div>
          )}

          {/* Hours row */}
          {weekdayText.length > 0 && (
            <motion.div variants={sectionVariants} style={{ marginBottom: 14 }}>
              <button
                onClick={() => setHoursOpen(h => !h)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '0.75rem', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <span className="ms" style={{ fontSize: 14 }}>schedule</span>
                Hours
                <span className="ms" style={{ fontSize: 13 }}>{hoursOpen ? 'expand_less' : 'expand_more'}</span>
              </button>
              <AnimatePresence>
                {hoursOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {weekdayText.map((line, i) => (
                        <p key={i} style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-3)' }}>{line}</p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* CTA — Add to itinerary */}
          <motion.div variants={sectionVariants}>
            <button
              onClick={onAdd}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                border: isSelected ? '1px solid rgba(212,168,83,.35)' : 'none',
                cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 700,
                background: isSelected
                  ? 'transparent'
                  : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
                color: isSelected ? 'var(--color-primary)' : '#0f0d0c',
                boxShadow: isSelected ? 'none' : 'var(--shadow-primary, 0 6px 28px rgba(212,168,83,.25))',
                transition: 'all 0.15s ease',
              }}
            >
              {isSelected ? '✓ In itinerary' : '+ Add to itinerary'}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Add missing prop passthrough in MapScreen.tsx**

Find the `<PinCard>` usage in `MapScreen.tsx` and ensure it passes:
- `travelStartDate={state.travelStartDate}`
- `travelEndDate={state.travelEndDate}`
- `ourPickBadge={activeOurPickBadge}`

The existing `travelDate` prop can stay (PinCard uses it as fallback).

- [ ] **Step 5: Verify design tokens are present**

Check that `--color-sage`, `--color-sage-bg`, `--color-sage-bdr`, `--color-amber`, `--color-amber-bg`, `--color-amber-bdr`, `--color-primary-bg`, `--shadow-primary` exist in `frontend/src/index.css`. If any are missing, add them to the `@theme` block:

```bash
grep -n "color-sage\|color-amber\|shadow-primary" frontend/src/index.css
```

If `--color-sage` is missing, add to the `@theme` block:
```css
--color-sage: #6b9470;
--color-sage-bg: rgba(107,148,112,.15);
--color-sage-bdr: rgba(107,148,112,.30);
--color-amber: #c49840;
--color-amber-bg: rgba(196,152,64,.15);
--color-amber-bdr: rgba(196,152,64,.30);
--shadow-primary: 0 6px 28px rgba(212,168,83,.25);
```

- [ ] **Step 6: Run dev server and verify**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run dev
```

Open a city on map, tap a pin. Verify:
- Hero image 190px, no scroll on hero
- Heart overlaid top-right, dark glass in both light and dark themes
- Gold gradient place name in Cormorant Garamond
- Meta chips with correct sage/amber/surface2 styling
- Our Analysis strip appears if ourPicks badge present or weekday_text available
- Body scrolls, hero stays fixed
- CTA gold gradient; switches to outlined when added

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/map/PinCard.tsx frontend/src/modules/map/MapScreen.tsx
git commit -m "feat(map): redesign PinCard — gallery hero, aura strip, scrollable body, gold CTA"
```

---

## Self-Review

**Spec coverage check:**

| Issue | Task | Covered? |
|-------|------|----------|
| 1 — City-scoped saved banner | Task 1 | ✓ |
| 2 — Curated count/pins | Task 2 | ✓ |
| 3 — Category counts displayCount | Task 3 | ✓ |
| 4 — Guide bulb city reset | Task 4 | ✓ |
| 5 — Tray overlaps PinCard | Task 5 | ✓ |
| 6 — Date + city top-right | Task 6 | ✓ |
| 7 — PinCard redesign | Tasks 7a + 7b | ✓ |

**Placeholder scan:** No TBDs or "implement later" phrases found.

**Type consistency:**
- `computeAnalysisInsights` defined in Task 7a, imported in Task 7b's PinCard — signatures match.
- `ourPickBadge` prop added to PinCard in Task 7b; `activeOurPickBadge` computed in MapScreen in Task 7b Step 1.
- `PlacePickFE.place_id` used in `ourPicks.find(p => p.place_id === activePlace.id)` — matches the confirmed field name.
- `BottomActionTray` props stripped in Task 6; call site in MapScreen updated in Task 5 — consistent.
- `displayCount` renamed from `allCount` in FilterBar; MapScreen passes `displayCount` — consistent.
