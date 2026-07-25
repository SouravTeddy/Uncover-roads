# Guide Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GuideBulb icon with contextual nudges, an "Our take" section in every PinCard, and a dot-stack BottomActionTray with hard-blocker detection.

**Architecture:** Two new pure-logic hooks (`useHardBlockers`, `useGuideMessages`) drive two new UI components (`GuideBulb`, `BlockerSheet`). `BottomActionTray` is redesigned with a dot-stack layout. `PinCard` drops the LLM insight call and renders "Our take" chips. `MapScreen` wires everything together using the existing `getAllCachedDetails()` module-level cache from `usePlaceDetails`.

**Tech Stack:** React (hooks, useMemo, useState), TypeScript, Vitest + @testing-library/react, inline CSS with Material Symbols icons (`ms fill` className pattern).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/modules/map/useHardBlockers.ts` | **Create** | Pure `computeHardBlockers` + `useHardBlockers` hook |
| `frontend/src/modules/map/useHardBlockers.test.ts` | **Create** | Unit tests for `computeHardBlockers` |
| `frontend/src/modules/map/useGuideMessages.ts` | **Create** | Pure `computeGuideMessage` + `useGuideMessages` hook |
| `frontend/src/modules/map/useGuideMessages.test.ts` | **Create** | Unit tests for `computeGuideMessage` |
| `frontend/src/modules/map/BlockerSheet.tsx` | **Create** | Bottom sheet listing hard blockers with two CTAs |
| `frontend/src/modules/map/BlockerSheet.test.tsx` | **Create** | Render tests |
| `frontend/src/modules/map/GuideBulb.tsx` | **Create** | Bulb button + animated dot + slide-out panel |
| `frontend/src/modules/map/GuideBulb.test.tsx` | **Create** | Render + interaction tests |
| `frontend/src/modules/map/PinCard.tsx` | **Modify** | Remove `usePersonaInsight`; add "Our take" label |
| `frontend/src/modules/map/BottomActionTray.tsx` | **Modify** | Dot-stack bar + blocker badge; new props |
| `frontend/src/modules/map/MapScreen.tsx` | **Modify** | Wire hooks + new components |

---

## Task 1: `useHardBlockers` — Blocker detection logic

**Files:**
- Create: `frontend/src/modules/map/useHardBlockers.ts`
- Create: `frontend/src/modules/map/useHardBlockers.test.ts`

Three hard blocker cases (spec §"Hard blocker definition"):
1. `place.tags?.business_status === 'CLOSED_PERMANENTLY'`
2. Place opening hours (from `weekday_text`) are closed on a day that falls within the travel range
3. Event pin whose `tags.event_date` is outside `[travelStartDate, travelEndDate]`

Details are looked up using the module-level cache key `${lat.toFixed(5)}:${lon.toFixed(5)}` already used by `usePlaceDetails`.

- [ ] **Step 1.1: Write failing tests**

```typescript
// frontend/src/modules/map/useHardBlockers.test.ts
import { describe, it, expect } from 'vitest'
import { computeHardBlockers } from './useHardBlockers'
import type { Place, PlaceDetails } from '../../shared/types'

function makePlace(overrides: Partial<Place> & { id: string; title: string }): Place {
  return { category: 'cafe', lat: 35.68, lon: 139.69, ...overrides }
}
function makeDetails(weekday_text: string[]): PlaceDetails {
  return { place_id: 'gp', name: 'X', address: '', lat: 35.68, lon: 139.69, weekday_text }
}

const noCache = new Map<string, PlaceDetails>()

describe('computeHardBlockers', () => {
  it('returns empty array when no places', () => {
    expect(computeHardBlockers([], noCache, '2026-05-20', '2026-05-25')).toEqual([])
  })

  it('returns empty when dates are null', () => {
    const place = makePlace({ id: '1', title: 'Cafe X', tags: { business_status: 'CLOSED_PERMANENTLY' } })
    // permanently closed still flagged even without dates
    const result = computeHardBlockers([place], noCache, null, null)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toMatch(/permanently closed/i)
  })

  it('flags permanently closed place', () => {
    const place = makePlace({ id: '1', title: 'Cafe X', tags: { business_status: 'CLOSED_PERMANENTLY' } })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toHaveLength(1)
    expect(result[0].placeId).toBe('1')
    expect(result[0].placeTitle).toBe('Cafe X')
    expect(result[0].reason).toMatch(/permanently closed/i)
  })

  it('flags place closed on a day within travel range (Thursday)', () => {
    // 2026-05-21 = Thursday
    const place = makePlace({ id: '2', title: 'Museum', lat: 35.68000, lon: 139.69000 })
    const weekday_text = [
      'Monday: 9:00 AM – 5:00 PM',
      'Tuesday: 9:00 AM – 5:00 PM',
      'Wednesday: 9:00 AM – 5:00 PM',
      'Thursday: Closed',
      'Friday: 9:00 AM – 5:00 PM',
      'Saturday: 9:00 AM – 5:00 PM',
      'Sunday: 9:00 AM – 5:00 PM',
    ]
    const cacheKey = `${(35.68).toFixed(5)}:${(139.69).toFixed(5)}`
    const cache = new Map([[cacheKey, makeDetails(weekday_text)]])
    const result = computeHardBlockers([place], cache, '2026-05-20', '2026-05-22')
    expect(result).toHaveLength(1)
    expect(result[0].reason).toMatch(/thursday/i)
    expect(result[0].reason).toMatch(/21/i)
  })

  it('does not flag place open on all days in range', () => {
    const place = makePlace({ id: '3', title: 'Park', lat: 35.68000, lon: 139.69000 })
    const weekday_text = [
      'Monday: 9:00 AM – 9:00 PM',
      'Tuesday: 9:00 AM – 9:00 PM',
      'Wednesday: 9:00 AM – 9:00 PM',
      'Thursday: 9:00 AM – 9:00 PM',
      'Friday: 9:00 AM – 9:00 PM',
      'Saturday: 9:00 AM – 9:00 PM',
      'Sunday: 9:00 AM – 9:00 PM',
    ]
    const cacheKey = `${(35.68).toFixed(5)}:${(139.69).toFixed(5)}`
    const cache = new Map([[cacheKey, makeDetails(weekday_text)]])
    expect(computeHardBlockers([place], cache, '2026-05-20', '2026-05-22')).toEqual([])
  })

  it('flags event pin whose event_date is before travel start', () => {
    const place = makePlace({ id: '4', title: 'Jazz Night', category: 'event', tags: { event_date: '2026-05-10' } })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toHaveLength(1)
    expect(result[0].reason).toMatch(/outside your trip/i)
  })

  it('flags event pin whose event_date is after travel end', () => {
    const place = makePlace({ id: '5', title: 'Jazz Night', category: 'event', tags: { event_date: '2026-06-10' } })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toHaveLength(1)
    expect(result[0].reason).toMatch(/outside your trip/i)
  })

  it('does not flag event within travel range', () => {
    const place = makePlace({ id: '6', title: 'Jazz Night', category: 'event', tags: { event_date: '2026-05-22' } })
    expect(computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')).toEqual([])
  })

  it('skips hours check if place has no cached details', () => {
    const place = makePlace({ id: '7', title: 'Mystery', lat: 99.0, lon: 99.0 })
    expect(computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')).toEqual([])
  })
})
```

- [ ] **Step 1.2: Run tests — verify all fail**

```bash
cd frontend && npx vitest run src/modules/map/useHardBlockers.test.ts
```

Expected: `Cannot find module './useHardBlockers'`

- [ ] **Step 1.3: Implement `useHardBlockers.ts`**

```typescript
// frontend/src/modules/map/useHardBlockers.ts
import { useMemo } from 'react'
import type { Place, PlaceDetails } from '../../shared/types'
import { getAllCachedDetails } from './usePlaceDetails'

export interface HardBlocker {
  placeId: string
  placeTitle: string
  reason: string
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatEventDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function findClosedDayInRange(
  weekdayText: string[],
  startDate: string,
  endDate: string,
): string | null {
  const start = new Date(startDate + 'T12:00:00Z')
  const end = new Date(endDate + 'T12:00:00Z')
  const current = new Date(start)
  while (current <= end) {
    const jsDay = current.getUTCDay() // 0=Sun
    const googleIdx = jsDay === 0 ? 6 : jsDay - 1 // Mon=0 ... Sun=6
    const line = weekdayText[googleIdx] ?? ''
    if (/closed/i.test(line)) {
      const dayName = WEEKDAY_NAMES[jsDay]
      const dayNum = current.getUTCDate()
      const monthName = current.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
      return `Closed on ${dayName}s · your trip includes ${dayName} ${dayNum} ${monthName}`
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return null
}

export function computeHardBlockers(
  selectedPlaces: Place[],
  detailsCache: ReadonlyMap<string, PlaceDetails>,
  travelStartDate: string | null,
  travelEndDate: string | null,
): HardBlocker[] {
  const blockers: HardBlocker[] = []

  for (const place of selectedPlaces) {
    // Case 1: permanently closed
    if (place.tags?.business_status === 'CLOSED_PERMANENTLY') {
      blockers.push({ placeId: place.id, placeTitle: place.title, reason: 'Permanently closed' })
      continue
    }

    // Case 3: event date outside travel range
    if (place.category === 'event' && place.tags?.event_date && travelStartDate && travelEndDate) {
      const eventDate = place.tags.event_date
      if (eventDate < travelStartDate || eventDate > travelEndDate) {
        blockers.push({
          placeId: place.id,
          placeTitle: place.title,
          reason: `Event on ${formatEventDate(eventDate)} is outside your trip dates`,
        })
        continue
      }
    }

    // Case 2: hours don't cover travel dates
    if (travelStartDate && travelEndDate) {
      const cacheKey = `${place.lat.toFixed(5)}:${place.lon.toFixed(5)}`
      const details = detailsCache.get(cacheKey)
      if (details?.weekday_text?.length) {
        const closedReason = findClosedDayInRange(details.weekday_text, travelStartDate, travelEndDate)
        if (closedReason) {
          blockers.push({ placeId: place.id, placeTitle: place.title, reason: closedReason })
        }
      }
    }
  }

  return blockers
}

export function useHardBlockers(
  selectedPlaces: Place[],
  travelStartDate: string | null,
  travelEndDate: string | null,
): HardBlocker[] {
  return useMemo(
    () => computeHardBlockers(selectedPlaces, getAllCachedDetails(), travelStartDate, travelEndDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPlaces, travelStartDate, travelEndDate],
  )
}
```

- [ ] **Step 1.4: Run tests — verify all pass**

```bash
cd frontend && npx vitest run src/modules/map/useHardBlockers.test.ts
```

Expected: all 8 tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add frontend/src/modules/map/useHardBlockers.ts frontend/src/modules/map/useHardBlockers.test.ts
git commit -m "feat(guide): add useHardBlockers — detect permanently closed, closed days, event date conflicts"
```

---

## Task 2: `useGuideMessages` — Guide message evaluation logic

**Files:**
- Create: `frontend/src/modules/map/useGuideMessages.ts`
- Create: `frontend/src/modules/map/useGuideMessages.test.ts`

Priority order: conflict > event nudge (when viewing event pin with a similar event in liveEvents) > area suggestion (0 places) > exploring (≥ 2 places, no blockers).

- [ ] **Step 2.1: Write failing tests**

```typescript
// frontend/src/modules/map/useGuideMessages.test.ts
import { describe, it, expect } from 'vitest'
import { computeGuideMessage } from './useGuideMessages'
import type { Place, LiveEvent } from '../../shared/types'
import type { HardBlocker } from './useHardBlockers'

function makePlace(overrides: Partial<Place> & { id: string }): Place {
  return { title: 'Place', category: 'cafe', lat: 0, lon: 0, ...overrides }
}

const noBlockers: HardBlocker[] = []
const noEvents: LiveEvent[] = []

describe('computeGuideMessage', () => {
  it('returns area message when 0 places selected', () => {
    const msg = computeGuideMessage([], noBlockers, 'Tokyo', null, noEvents, null, null)
    expect(msg?.kind).toBe('area')
    expect(msg?.text).toContain('Tokyo')
  })

  it('returns null when 0 places and city is null', () => {
    expect(computeGuideMessage([], noBlockers, null, null, noEvents, null, null)).toBeNull()
  })

  it('returns conflict message when blockers exist', () => {
    const places = [makePlace({ id: '1' })]
    const blockers: HardBlocker[] = [{ placeId: '1', placeTitle: 'Museum', reason: 'Closed on Thursdays' }]
    const msg = computeGuideMessage(places, blockers, 'Tokyo', null, noEvents, null, null)
    expect(msg?.kind).toBe('conflict')
    expect(msg?.text).toContain('conflict')
  })

  it('conflict message includes count when multiple blockers', () => {
    const blockers: HardBlocker[] = [
      { placeId: '1', placeTitle: 'A', reason: 'r1' },
      { placeId: '2', placeTitle: 'B', reason: 'r2' },
    ]
    const msg = computeGuideMessage([makePlace({ id: '1' }), makePlace({ id: '2' })], blockers, 'Tokyo', null, noEvents, null, null)
    expect(msg?.text).toContain('2')
  })

  it('returns event nudge when viewing event pin with matching genre in liveEvents', () => {
    const activePlace = makePlace({ id: '1', title: 'Jazz Night', category: 'event', tags: { genre: 'jazz' } })
    const liveEvents: LiveEvent[] = [
      { id: 'e1', title: 'Jazz Fest', lat: 0, lon: 0, genre: 'jazz', date: '2026-05-22', time: '', venueName: '', url: '', imageUrl: null },
    ]
    const msg = computeGuideMessage([activePlace], noBlockers, 'Tokyo', activePlace, liveEvents, '2026-05-20', '2026-05-25')
    expect(msg?.kind).toBe('event')
    expect(msg?.text).toContain('Jazz Fest')
  })

  it('does not return event nudge when similar event is out of travel range', () => {
    const activePlace = makePlace({ id: '1', title: 'Jazz Night', category: 'event', tags: { genre: 'jazz' } })
    const liveEvents: LiveEvent[] = [
      { id: 'e1', title: 'Jazz Fest', lat: 0, lon: 0, genre: 'jazz', date: '2026-06-10', time: '', venueName: '', url: '', imageUrl: null },
    ]
    const msg = computeGuideMessage([activePlace], noBlockers, 'Tokyo', activePlace, liveEvents, '2026-05-20', '2026-05-25')
    expect(msg?.kind).not.toBe('event')
  })

  it('returns exploring message when 2+ places and no blockers', () => {
    const places = [makePlace({ id: '1' }), makePlace({ id: '2' })]
    const msg = computeGuideMessage(places, noBlockers, 'Tokyo', null, noEvents, null, null)
    expect(msg?.kind).toBe('exploring')
  })

  it('returns null when 1 place, no blockers, no event', () => {
    const msg = computeGuideMessage([makePlace({ id: '1' })], noBlockers, 'Tokyo', null, noEvents, null, null)
    expect(msg).toBeNull()
  })

  it('conflict takes priority over area suggestion', () => {
    const blockers: HardBlocker[] = [{ placeId: '1', placeTitle: 'X', reason: 'Closed' }]
    const msg = computeGuideMessage([], blockers, 'Tokyo', null, noEvents, null, null)
    expect(msg?.kind).toBe('conflict')
  })
})
```

- [ ] **Step 2.2: Run tests — verify all fail**

```bash
cd frontend && npx vitest run src/modules/map/useGuideMessages.test.ts
```

Expected: `Cannot find module './useGuideMessages'`

- [ ] **Step 2.3: Implement `useGuideMessages.ts`**

```typescript
// frontend/src/modules/map/useGuideMessages.ts
import { useMemo } from 'react'
import type { Place, LiveEvent } from '../../shared/types'
import type { HardBlocker } from './useHardBlockers'

export interface GuideMessage {
  id: string
  text: string
  kind: 'area' | 'event' | 'conflict' | 'exploring'
}

export function computeGuideMessage(
  selectedPlaces: Place[],
  hardBlockers: HardBlocker[],
  city: string | null,
  activePlace: Place | null,
  liveEvents: LiveEvent[],
  travelStartDate: string | null,
  travelEndDate: string | null,
): GuideMessage | null {
  // Priority 1: conflict
  if (hardBlockers.length >= 1) {
    const count = hardBlockers.length
    return {
      id: 'conflict',
      kind: 'conflict',
      text: count === 1
        ? 'We found a conflict — check before you build'
        : `We found ${count} conflicts — check before you build`,
    }
  }

  // Priority 2: event nudge (only when user is viewing an event pin)
  if (activePlace?.category === 'event') {
    const genre = (activePlace.tags?.genre ?? '').toLowerCase()
    const similar = liveEvents.find(e =>
      e.id !== activePlace.id &&
      e.genre.toLowerCase() === genre &&
      travelStartDate != null &&
      travelEndDate != null &&
      e.date >= travelStartDate &&
      e.date <= travelEndDate,
    )
    if (similar) {
      return {
        id: 'event',
        kind: 'event',
        text: genre
          ? `Another ${genre} event nearby — ${similar.title}`
          : `Another event like this nearby — ${similar.title}`,
      }
    }
  }

  // Priority 3: area suggestion (0 places selected)
  if (selectedPlaces.length === 0 && city) {
    return {
      id: 'area',
      kind: 'area',
      text: `Explore the best of ${city} — tap any pin to start building your trip`,
    }
  }

  // Priority 4: exploring (≥ 2 places, no blockers)
  if (selectedPlaces.length >= 2) {
    return {
      id: 'exploring',
      kind: 'exploring',
      text: `Your mix looks good — you've got a nice spread across ${city ?? 'the city'}`,
    }
  }

  return null
}

export function useGuideMessages(
  selectedPlaces: Place[],
  hardBlockers: HardBlocker[],
  city: string | null,
  activePlace: Place | null,
  liveEvents: LiveEvent[],
  travelStartDate: string | null,
  travelEndDate: string | null,
): { message: GuideMessage | null } {
  const message = useMemo(
    () => computeGuideMessage(selectedPlaces, hardBlockers, city, activePlace, liveEvents, travelStartDate, travelEndDate),
    [selectedPlaces, hardBlockers, city, activePlace, liveEvents, travelStartDate, travelEndDate],
  )
  return { message }
}
```

- [ ] **Step 2.4: Run tests — verify all pass**

```bash
cd frontend && npx vitest run src/modules/map/useGuideMessages.test.ts
```

Expected: all 9 tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/modules/map/useGuideMessages.ts frontend/src/modules/map/useGuideMessages.test.ts
git commit -m "feat(guide): add useGuideMessages — area, event, conflict, exploring nudges"
```

---

## Task 3: `BlockerSheet` — Blocker detail bottom sheet

**Files:**
- Create: `frontend/src/modules/map/BlockerSheet.tsx`
- Create: `frontend/src/modules/map/BlockerSheet.test.tsx`

Slides up from bottom (`.48s` spring). Shows one row per blocker with place name + reason. Two CTAs: "I'll fix it" (ghost) and "Build anyway →" (gold).

- [ ] **Step 3.1: Write failing tests**

```typescript
// frontend/src/modules/map/BlockerSheet.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockerSheet } from './BlockerSheet'
import type { HardBlocker } from './useHardBlockers'

const blockers: HardBlocker[] = [
  { placeId: '1', placeTitle: 'Old Town Museum', reason: 'Closed on Thursdays · your trip includes Thursday 21 May' },
  { placeId: '2', placeTitle: 'Jazz Bar', reason: 'Permanently closed' },
]

describe('BlockerSheet', () => {
  it('renders header with blocker count', () => {
    render(<BlockerSheet blockers={blockers} onFix={() => {}} onBuildAnyway={() => {}} />)
    expect(screen.getByText(/2 conflict/i)).toBeTruthy()
  })

  it('renders each blocker place name', () => {
    render(<BlockerSheet blockers={blockers} onFix={() => {}} onBuildAnyway={() => {}} />)
    expect(screen.getByText('Old Town Museum')).toBeTruthy()
    expect(screen.getByText('Jazz Bar')).toBeTruthy()
  })

  it('renders each blocker reason', () => {
    render(<BlockerSheet blockers={blockers} onFix={() => {}} onBuildAnyway={() => {}} />)
    expect(screen.getByText(/Closed on Thursdays/i)).toBeTruthy()
    expect(screen.getByText(/Permanently closed/i)).toBeTruthy()
  })

  it('calls onFix when "I\'ll fix it" is tapped', () => {
    const onFix = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={onFix} onBuildAnyway={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /fix it/i }))
    expect(onFix).toHaveBeenCalledOnce()
  })

  it('calls onBuildAnyway when "Build anyway" is tapped', () => {
    const onBuildAnyway = vi.fn()
    render(<BlockerSheet blockers={blockers} onFix={() => {}} onBuildAnyway={onBuildAnyway} />)
    fireEvent.click(screen.getByRole('button', { name: /build anyway/i }))
    expect(onBuildAnyway).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3.2: Run tests — verify all fail**

```bash
cd frontend && npx vitest run src/modules/map/BlockerSheet.test.tsx
```

Expected: `Cannot find module './BlockerSheet'`

- [ ] **Step 3.3: Implement `BlockerSheet.tsx`**

```tsx
// frontend/src/modules/map/BlockerSheet.tsx
import { useEffect, useRef, useState } from 'react'
import type { HardBlocker } from './useHardBlockers'

interface Props {
  blockers: HardBlocker[]
  onFix: () => void
  onBuildAnyway: () => void
}

export function BlockerSheet({ blockers, onFix, onBuildAnyway }: Props) {
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const count = blockers.length
  const headerText = count === 1 ? '1 conflict before you build' : `${count} conflicts before you build`

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,.35)' }}
        onClick={onFix}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--color-border)', borderBottom: 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.48s cubic-bezier(.22,1,.36,1)',
          willChange: 'transform',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-m)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 10px' }}>
          <span className="ms fill" style={{ fontSize: 20, color: '#fbbf24' }}>warning</span>
          <div>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-1)' }}>
              Heads up before you build
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
              {headerText}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '0 0 4px' }} />

        {/* Blocker rows */}
        {blockers.map((b, i) => (
          <div
            key={b.placeId}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 16px',
              borderTop: i > 0 ? '1px solid var(--color-border)' : undefined,
            }}
          >
            <span className="ms fill" style={{ fontSize: 16, color: '#f87171', marginTop: 2, flexShrink: 0 }}>block</span>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-1)' }}>
                {b.placeTitle}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
                {b.reason}
              </p>
            </div>
          </div>
        ))}

        {/* Note */}
        <p style={{ margin: '6px 16px', fontSize: '0.72rem', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
          Soft suggestions (pacing, sequence, weather) appear in your itinerary — not here.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px 0' }}>
          <button
            onClick={onFix}
            aria-label="I'll fix it"
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: 'transparent',
              border: '1px solid var(--color-border-m)',
              color: 'var(--color-text-2)', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            I'll fix it
          </button>
          <button
            onClick={onBuildAnyway}
            aria-label="Build anyway"
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12,
              background: 'linear-gradient(135deg, #d4a853, #b8893a)',
              border: 'none',
              color: '#0c0c0e', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Build anyway →
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3.4: Run tests — verify all pass**

```bash
cd frontend && npx vitest run src/modules/map/BlockerSheet.test.tsx
```

Expected: all 5 tests PASS

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/modules/map/BlockerSheet.tsx frontend/src/modules/map/BlockerSheet.test.tsx
git commit -m "feat(guide): add BlockerSheet — conflict detail sheet with fix/build-anyway CTAs"
```

---

## Task 4: `GuideBulb` — Bulb button + panel + animations

**Files:**
- Create: `frontend/src/modules/map/GuideBulb.tsx`
- Create: `frontend/src/modules/map/GuideBulb.test.tsx`

Three visual states: idle (no dot), has-message (dot + glow ring), active (panel open). Panel springs from top-right. Cards stagger in at 70ms intervals.

- [ ] **Step 4.1: Write failing tests**

```typescript
// frontend/src/modules/map/GuideBulb.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GuideBulb } from './GuideBulb'
import type { GuideMessage } from './useGuideMessages'

const areaMessage: GuideMessage = { id: 'area', kind: 'area', text: 'Explore the best of Tokyo' }
const conflictMessage: GuideMessage = { id: 'conflict', kind: 'conflict', text: 'We found a conflict' }

describe('GuideBulb', () => {
  it('renders the bulb button', () => {
    render(<GuideBulb message={null} onConflictTap={() => {}} />)
    expect(screen.getByRole('button', { name: /guide/i })).toBeTruthy()
  })

  it('does not render dot when no message', () => {
    render(<GuideBulb message={null} onConflictTap={() => {}} />)
    expect(screen.queryByTestId('guide-dot')).toBeNull()
  })

  it('renders dot when message is present', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    expect(screen.getByTestId('guide-dot')).toBeTruthy()
  })

  it('opens panel on bulb click', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /guide/i }))
    expect(screen.getByText('Explore the best of Tokyo')).toBeTruthy()
  })

  it('hides dot when panel is open', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /guide/i }))
    expect(screen.queryByTestId('guide-dot')).toBeNull()
  })

  it('calls onConflictTap when conflict message card is clicked', () => {
    const onConflictTap = vi.fn()
    render(<GuideBulb message={conflictMessage} onConflictTap={onConflictTap} />)
    fireEvent.click(screen.getByRole('button', { name: /guide/i }))
    fireEvent.click(screen.getByRole('button', { name: /conflict/i }))
    expect(onConflictTap).toHaveBeenCalledOnce()
  })

  it('closes panel when close button is tapped', () => {
    render(<GuideBulb message={areaMessage} onConflictTap={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /guide/i }))
    fireEvent.click(screen.getByRole('button', { name: /close panel/i }))
    expect(screen.queryByText('Explore the best of Tokyo')).toBeNull()
  })
})
```

- [ ] **Step 4.2: Run tests — verify all fail**

```bash
cd frontend && npx vitest run src/modules/map/GuideBulb.test.tsx
```

Expected: `Cannot find module './GuideBulb'`

- [ ] **Step 4.3: Implement `GuideBulb.tsx`**

```tsx
// frontend/src/modules/map/GuideBulb.tsx
import { useState } from 'react'
import type { GuideMessage } from './useGuideMessages'

// Keyframe CSS injected once at module load
const STYLE_ID = 'guide-bulb-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes guideDotBounceIn {
      0%   { transform: scale(0); }
      70%  { transform: scale(1.35); }
      100% { transform: scale(1); }
    }
    @keyframes guideGlowPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(212,168,83,.0); }
      50%       { box-shadow: 0 0 0 8px rgba(212,168,83,.25); }
    }
    @keyframes guideRingPulse {
      0%, 100% { transform: scale(1); opacity: .35; }
      50%       { transform: scale(1.18); opacity: .0; }
    }
  `
  document.head.appendChild(style)
}

interface Props {
  message: GuideMessage | null
  onConflictTap: () => void
}

const KIND_ICON: Record<GuideMessage['kind'], string> = {
  area:      'explore',
  event:     'event',
  conflict:  'warning',
  exploring: 'route',
}
const KIND_COLOR: Record<GuideMessage['kind'], string> = {
  area:      '#60a5fa',
  event:     '#a5b4fc',
  conflict:  '#fbbf24',
  exploring: '#4ade80',
}

export function GuideBulb({ message, onConflictTap }: Props) {
  const [open, setOpen] = useState(false)
  const hasMessage = message !== null

  function handleBulbClick() {
    setOpen(o => !o)
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative', width: 44, height: 44 }}>
      {/* Glow ring — only when dot is visible */}
      {hasMessage && !open && (
        <div
          style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '2px solid rgba(212,168,83,.4)',
            animation: 'guideRingPulse 2.4s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Bulb button */}
      <button
        aria-label="Guide"
        onClick={handleBulbClick}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open
            ? 'rgba(212,168,83,.25)'
            : hasMessage
              ? 'rgba(212,168,83,.12)'
              : 'rgba(15,20,30,.72)',
          border: open
            ? '1.5px solid rgba(212,168,83,.6)'
            : hasMessage
              ? '1.5px solid rgba(212,168,83,.3)'
              : '1px solid rgba(255,255,255,.1)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          animation: hasMessage && !open ? 'guideGlowPulse 2.8s ease-in-out infinite' : undefined,
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        <span
          className="ms fill"
          style={{ fontSize: 22, color: open || hasMessage ? '#d4a853' : 'var(--color-text-3)' }}
        >
          lightbulb
        </span>
      </button>

      {/* Notification dot */}
      {hasMessage && !open && (
        <span
          data-testid="guide-dot"
          style={{
            position: 'absolute', top: 3, right: 3,
            width: 9, height: 9, borderRadius: '50%',
            background: '#d4a853',
            border: '1.5px solid var(--color-surface)',
            animation: 'guideDotBounceIn 0.35s cubic-bezier(.22,1,.36,1) both',
          }}
        />
      )}

      {/* Panel — slides from top-right */}
      {open && message && (
        <div
          style={{
            position: 'absolute', top: 52, right: 0,
            width: 260,
            background: 'rgba(15,20,30,.96)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
            transformOrigin: 'top right',
            animation: 'none',
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 0' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Guide
            </span>
            <button
              aria-label="Close panel"
              onClick={handleClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 2 }}
            >
              <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-3)' }}>close</span>
            </button>
          </div>

          {/* Message card */}
          <div
            style={{
              margin: '8px 10px 10px',
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${KIND_COLOR[message.kind]}22`,
              animation: 'none',
              transform: 'translateY(0)',
              transition: 'transform 0.22s cubic-bezier(.22,1,.36,1) 70ms, opacity 0.22s ease 70ms',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span className="ms fill" style={{ fontSize: 16, color: KIND_COLOR[message.kind], marginTop: 1, flexShrink: 0 }}>
                {KIND_ICON[message.kind]}
              </span>
              <div style={{ flex: 1 }}>
                {message.kind === 'conflict' ? (
                  <button
                    aria-label="View conflict details"
                    onClick={onConflictTap}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      textAlign: 'left',
                      fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-1)', lineHeight: 1.4,
                    }}
                  >
                    {message.text}
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#fbbf24', marginTop: 2 }}>Tap to see details →</span>
                  </button>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-1)', lineHeight: 1.4 }}>
                    {message.text}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4.4: Run tests — verify all pass**

```bash
cd frontend && npx vitest run src/modules/map/GuideBulb.test.tsx
```

Expected: all 7 tests PASS

- [ ] **Step 4.5: Commit**

```bash
git add frontend/src/modules/map/GuideBulb.tsx frontend/src/modules/map/GuideBulb.test.tsx
git commit -m "feat(guide): add GuideBulb — animated bulb icon, dot, and slide-out panel"
```

---

## Task 5: `PinCard` — Remove LLM insight, add "Our take" label

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`

Remove the `usePersonaInsight` hook call and its import. Remove the `✦` archetype insight block (lines 239–248). Add a visible **"Our take"** label above the persona badges chips.

- [ ] **Step 5.1: Remove `usePersonaInsight` import and usage**

In `frontend/src/modules/map/PinCard.tsx`, change line 9:

```typescript
// Remove:
import { computePersonaBadges, usePersonaInsight } from './pincard-persona'
// Replace with:
import { computePersonaBadges } from './pincard-persona'
```

- [ ] **Step 5.2: Remove `usePersonaInsight` hook call**

Remove lines 88–92 (the fallback cache + usePersonaInsight call):

```typescript
// Remove these lines entirely:
  const fallbackCache = useRef(new Map<string, string>())
  const activeCache = insightCache ?? fallbackCache
  const { insight, loading: insightLoading } = usePersonaInsight(
    place, persona ?? null, 'map', activeCache,
  )
```

- [ ] **Step 5.3: Remove unused imports**

In the file header, `ShimmerLine` is now unused (it was used only for the insight loading state). Remove it:

```typescript
// Remove:
import { ShimmerLine } from '../../shared/Shimmer'
```

Also remove `insightCache` from the Props interface and destructuring since it's no longer used:

In the Props interface, remove:
```typescript
  insightCache?: MutableRefObject<Map<string, string>>
```

In the function signature destructuring, remove `insightCache` from the parameter list:
```typescript
// Change:
export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onFavourite,
  details, travelDate,
  persona, personaProfile, insightCache,
}: Props) {
// To:
export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onFavourite,
  details, travelDate,
  persona, personaProfile,
}: Props) {
```

- [ ] **Step 5.4: Remove the LLM insight block and add "Our take" label**

Remove the archetype insight block (current lines 239–248):

```tsx
// Remove this entire block:
          {/* Archetype insight — LLM ✦ (persona tone only, no facts) */}
          <div style={{ marginBottom: 12, minHeight: 20 }}>
            {insightLoading ? (
              <ShimmerLine width="80%" height={14} />
            ) : insight ? (
              <p style={{ margin: 0, fontSize: '0.82rem', color: TEXT3, fontStyle: 'italic', lineHeight: 1.5 }}>
                <span style={{ color: AI_MARK, marginRight: 4 }}>✦</span>{insight}
              </p>
            ) : null}
          </div>
```

Replace the persona badges block (current lines 221–237) with a version that includes the "Our take" label:

```tsx
// Replace the persona badges block with:
          {/* Our take */}
          {personaBadges.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ margin: '0 0 5px', fontSize: '0.68rem', fontWeight: 700, color: TEXT3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Our take
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {personaBadges.map((badge) => (
                  <div key={badge.text} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 9px', borderRadius: 999,
                    fontSize: '0.72rem', fontWeight: 700,
                    color: badge.color,
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                  }}>
                    {badge.text}
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 5.5: Remove the `AI_MARK` constant** (no longer used)

```typescript
// Remove this line from the design tokens section:
const AI_MARK  = '#8b5cf6'
```

- [ ] **Step 5.6: Run full test suite to check for regressions**

```bash
cd frontend && npx vitest run
```

Expected: all existing tests pass, no type errors

- [ ] **Step 5.7: Commit**

```bash
git add frontend/src/modules/map/PinCard.tsx
git commit -m "feat(guide): PinCard — drop LLM insight, add 'Our take' label above persona badges"
```

---

## Task 6: `BottomActionTray` — Dot-stack bar redesign + blocker badge

**Files:**
- Modify: `frontend/src/modules/map/BottomActionTray.tsx`

Replace the full-width build button with a three-column row: dot stack · count label · CTA button. Add an amber `!` badge on the CTA corner when `hasBlockers` is true. Tapping the badge (or the CTA when blockers exist) calls `onBlockerTap`.

New props to add: `hasBlockers: boolean` and `onBlockerTap: () => void`.

- [ ] **Step 6.1: Update props interface**

In `frontend/src/modules/map/BottomActionTray.tsx`, update the Props interface:

```typescript
// Change:
interface Props {
  startDate: string | null
  endDate: string | null
  cities: string[]
  onDateTap: () => void
  itineraryPlaces: Place[]
  days: number
  buildLoading: boolean
  onBuild: () => void
}
// To:
interface Props {
  startDate: string | null
  endDate: string | null
  cities: string[]
  onDateTap: () => void
  itineraryPlaces: Place[]
  days: number
  buildLoading: boolean
  onBuild: () => void
  hasBlockers: boolean
  onBlockerTap: () => void
}
```

- [ ] **Step 6.2: Update function signature**

```typescript
// Change:
export function BottomActionTray({
  startDate, endDate, cities, onDateTap,
  itineraryPlaces, days, buildLoading, onBuild,
}: Props) {
// To:
export function BottomActionTray({
  startDate, endDate, cities, onDateTap,
  itineraryPlaces, days, buildLoading, onBuild,
  hasBlockers, onBlockerTap,
}: Props) {
```

- [ ] **Step 6.3: Replace the build button block with the dot-stack bar**

Replace the `{hasItinerary && (...)}` block (lines 56–83) with the new dot-stack layout:

```tsx
        {/* Dot-stack bar — shown when ≥ 1 place is selected */}
        {hasItinerary && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(15,20,30,.92)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: 16,
              padding: '10px 14px',
            }}
          >
            {/* Dot stack — up to 5 dots, decreasing opacity */}
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: (hasBlockers && i === Math.min(count, 5) - 1) ? '#f59e0b' : '#d4a853',
                    opacity: 1 - i * 0.15,
                    marginLeft: i === 0 ? 0 : -5,
                    border: '2.5px solid var(--color-surface)',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* Count label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-1)', lineHeight: 1 }}>
                {count}
              </p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-3)', lineHeight: 1.2 }}>
                {count === 1 ? 'place added' : 'places added'}
              </p>
            </div>

            {/* CTA button with optional blocker badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                disabled={!canBuild || buildLoading}
                onClick={canBuild && !buildLoading ? (hasBlockers ? onBlockerTap : onBuild) : undefined}
                style={{
                  padding: '9px 16px', borderRadius: 12,
                  border: 'none', cursor: canBuild ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem', fontWeight: 700,
                  background: canBuild
                    ? 'linear-gradient(135deg, #d4a853, #b8893a)'
                    : 'var(--color-border)',
                  color: canBuild ? '#0c0c0e' : 'var(--color-text-3)',
                  opacity: canBuild ? 1 : 0.7,
                  boxShadow: canBuild ? '0 4px 20px rgba(212,168,83,.25)' : 'none',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {buildLoading ? 'Building…' : 'Build itinerary →'}
              </button>

              {/* Amber blocker badge */}
              {hasBlockers && canBuild && (
                <button
                  onClick={onBlockerTap}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#f59e0b', border: '2px solid var(--color-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                    fontSize: '0.7rem', fontWeight: 900, color: '#0c0c0e',
                    animation: 'none',
                  }}
                  aria-label="View conflicts"
                >
                  !
                </button>
              )}
            </div>
          </div>
        )}

        {/* "Add one more" hint */}
        {hasItinerary && !canBuild && (
          <p style={{ textAlign: 'center', margin: '0 0 2px', fontSize: '0.68rem', color: 'var(--color-text-3)' }}>
            Add one more place to build
          </p>
        )}
```

- [ ] **Step 6.4: Run full test suite to check for regressions**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass

- [ ] **Step 6.5: Commit**

```bash
git add frontend/src/modules/map/BottomActionTray.tsx
git commit -m "feat(guide): BottomActionTray — dot-stack bar, amber blocker badge, conflict-aware CTA"
```

---

## Task 7: `MapScreen` — Wire everything together

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

Add imports, hook instantiation, blockerSheet state, GuideBulb placement (top-right, same level as FilterBar), BlockerSheet mounting, and updated BottomActionTray props.

- [ ] **Step 7.1: Add new imports**

At the top of `frontend/src/modules/map/MapScreen.tsx`, add after the existing imports:

```typescript
import { GuideBulb } from './GuideBulb'
import { BlockerSheet } from './BlockerSheet'
import { useHardBlockers } from './useHardBlockers'
import { useGuideMessages } from './useGuideMessages'
```

- [ ] **Step 7.2: Add `blockerSheetOpen` state and hook calls**

After the existing `const [buildLoading, setBuildLoading] = useState(false)` line (line 165), add:

```typescript
  const [blockerSheetOpen, setBlockerSheetOpen] = useState(false)

  // Guide feature: blocker detection + message evaluation
  const hardBlockers = useHardBlockers(selectedPlaces, state.travelStartDate, state.travelEndDate)
  const { message: guideMessage } = useGuideMessages(
    selectedPlaces, hardBlockers, city, activePlace,
    liveEvents, state.travelStartDate, state.travelEndDate,
  )
```

- [ ] **Step 7.3: Add GuideBulb to the top overlay**

Inside the top overlay `<div>` (the one with `absolute inset-x-0 top-0`), add an absolutely-positioned container for the bulb, positioned top-right at the same level as the FilterBar. Add it after the closing `</div>` of the FilterBar's `pointerEvents: auto` wrapper (after line ~487):

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
            message={guideMessage}
            onConflictTap={() => { setBlockerSheetOpen(true) }}
          />
        </div>
```

Note: The `position: absolute` is relative to the parent `div.absolute.inset-x-0.top-0`, which is itself positioned relative to the map container. This places the bulb in the top-right corner of the overlay.

- [ ] **Step 7.4: Add BlockerSheet**

At the end of the outer `<>` fragment (just before the closing `</>`), after the `BottomActionTray` block, add:

```tsx
      {/* BlockerSheet — slides up when user opens conflict details */}
      {blockerSheetOpen && (
        <BlockerSheet
          blockers={hardBlockers}
          onFix={() => setBlockerSheetOpen(false)}
          onBuildAnyway={() => {
            setBlockerSheetOpen(false)
            handleBuild()
          }}
        />
      )}
```

- [ ] **Step 7.5: Update BottomActionTray props**

Find the `<BottomActionTray` usage (around line 705) and add the two new props:

```tsx
        <BottomActionTray
          startDate={state.travelStartDate}
          endDate={state.travelEndDate}
          cities={cityContexts.map(c => c.city)}
          onDateTap={() => {}}
          itineraryPlaces={selectedPlaces}
          days={activeCityDays}
          buildLoading={buildLoading}
          onBuild={handleBuild}
          hasBlockers={hardBlockers.length > 0}
          onBlockerTap={() => setBlockerSheetOpen(true)}
        />
```

- [ ] **Step 7.6: Remove `insightCacheRef` and `insightCache` prop from MapScreen**

The `insightCacheRef` is no longer needed since `PinCard` no longer uses `usePersonaInsight`. Remove:

```typescript
// Remove:
  const insightCacheRef = useRef(new Map<string, string>());
```

And in the `<PinCard>` usage (around line 651), remove the `insightCache={insightCacheRef}` prop:

```tsx
// Remove this prop from <PinCard>:
          insightCache={insightCacheRef}
```

- [ ] **Step 7.7: Run full test suite**

```bash
cd frontend && npx vitest run
```

Expected: all tests pass

- [ ] **Step 7.8: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors

- [ ] **Step 7.9: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat(guide): wire GuideBulb, BlockerSheet, hard blockers into MapScreen"
```

---

## Done

All tasks complete. The Guide feature is fully implemented:
- Hard blocker detection runs whenever `selectedPlaces` changes
- GuideBulb floats top-right, dot lights up when any guide message is ready
- Conflict messages open the BlockerSheet via the bulb panel or the BottomActionTray amber badge
- "Our take" section in PinCard shows persona badges without any LLM call
- BottomActionTray shows a dot-stack with place count; amber badge appears on blockers
