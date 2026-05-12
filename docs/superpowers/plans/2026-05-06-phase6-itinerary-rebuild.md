# Phase 6 — Itinerary Screen Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the old ItineraryView/ItineraryCards monoliths and replace them with a clean, engine-message-aware itinerary screen built on the Phase 3 `EngineItinerary` types already in the store.

**Architecture:** `RouteScreen.tsx` is rebuilt from scratch as a pure itinerary list. The explore/map half moves out permanently — explore stays in `MapScreen.tsx` (Phase 4). RouteScreen now owns: day-tab navigation, `EngineItineraryStop` cards, `EngineMessage` banners between stops, swipe-to-remove with rebuild confirmation, multi-city travel day cards, generation counter display, and the "Edit trip" → map handoff. All state is read from `engineItinerary` / `engineMessages` in the store. The existing `Itinerary`-based legacy state (`itinerary`, `itineraryDays`) is NOT touched — new components consume `EngineItinerary` only.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vite, existing store (React Context + useReducer), existing `api.ts`, Vitest.

**Spec refs:**
- `docs/superpowers/specs/2026-04-29-map-ui-full-rebuild-design.md` §11 (Itinerary Screen)
- `docs/superpowers/specs/2026-04-29-map-ui-full-rebuild-design.md` §15 (New Components)
- `docs/superpowers/plans/2026-04-29-master-plan.md` (Architecture Decisions)

**Baseline:** 721 tests, 63 files — all must stay green throughout.

---

## File Map

### Created
| File | Responsibility |
|---|---|
| `frontend/src/modules/route/EngineMessageBanner.tsx` | Single WHAT+WHY+CONSEQUENCE dismissable banner |
| `frontend/src/modules/route/EngineMessageBanner.test.tsx` | Unit tests for banner |
| `frontend/src/modules/route/ItineraryDayView.tsx` | One day's stop list + interleaved banners |
| `frontend/src/modules/route/ItineraryDayView.test.tsx` | Unit tests for day view |
| `frontend/src/modules/route/ItineraryStopCard.tsx` | Individual stop card (time, name, whyForYou, localTip, pills, links) |
| `frontend/src/modules/route/ItineraryStopCard.test.tsx` | Unit tests for stop card |
| `frontend/src/modules/route/TravelDayCard.tsx` | Multi-city ✈️ travel day placeholder |
| `frontend/src/modules/route/TravelDayCard.test.tsx` | Unit tests for travel day card |
| `frontend/src/modules/route/useItinerary.ts` | Hook: remove-stop logic, rebuild trigger, generation guard |
| `frontend/src/modules/route/useItinerary.test.ts` | Unit tests for hook logic |

### Rebuilt (delete old content, write from scratch)
| File | Was | Now |
|---|---|---|
| `frontend/src/modules/route/RouteScreen.tsx` | 477-line explore+itinerary hybrid | Pure itinerary screen: header, day tabs, `ItineraryDayView` per day, generation counter |

### Deleted
| File | Lines |
|---|---|
| `frontend/src/modules/route/ItineraryView.tsx` | 1325 |
| `frontend/src/modules/route/ItineraryCards.tsx` | 1016 |
| `frontend/src/modules/route/AmbientVideo.tsx` | — |

### Modified
| File | Change |
|---|---|
| `frontend/src/modules/route/index.ts` | Remove deleted file exports, add new exports |
| `frontend/src/modules/route/useRoute.ts` | Add `buildEngineItinerary()` wrapper, keep legacy `buildItinerary()` |
| `frontend/src/shared/api.ts` | Add `engineItinerary()` call (POST `/engine-itinerary`) |

### Untouched (do not modify)
- `frontend/src/shared/types.ts` — `EngineItinerary`, `EngineMessage`, `EngineItineraryStop`, `EngineItineraryDay` are already defined
- `frontend/src/shared/store.tsx` — all required actions already exist: `SET_ENGINE_ITINERARY`, `DISMISS_ENGINE_MESSAGE`, `ADD_ENGINE_MESSAGE`, `PUSH_ITINERARY_HISTORY`, `INCREMENT_GENERATION_COUNT`
- `frontend/src/modules/map/` — untouched
- All auth, nav, subscription, profile screens

---

## Task 1: EngineMessageBanner component

**Files:**
- Create: `frontend/src/modules/route/EngineMessageBanner.tsx`
- Create: `frontend/src/modules/route/EngineMessageBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/modules/route/EngineMessageBanner.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EngineMessageBanner } from './EngineMessageBanner'
import type { EngineMessage } from '../../shared/types'

const msg: EngineMessage = {
  id: 'msg-1',
  type: 'resequence',
  what: 'Moved Senso-ji to 8am',
  why: 'It closes at 5pm — you\'d arrive at 4:30',
  consequence: 'You now reach Ueno with 3 hours to spare',
  dismissable: true,
}

describe('EngineMessageBanner', () => {
  it('renders all three message lines', () => {
    render(<EngineMessageBanner message={msg} onDismiss={() => {}} onUndo={() => {}} />)
    expect(screen.getByText('Moved Senso-ji to 8am')).toBeTruthy()
    expect(screen.getByText(/It closes at 5pm/)).toBeTruthy()
    expect(screen.getByText(/You now reach Ueno/)).toBeTruthy()
  })

  it('calls onDismiss when × is tapped', () => {
    const onDismiss = vi.fn()
    render(<EngineMessageBanner message={msg} onDismiss={onDismiss} onUndo={() => {}} />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledWith('msg-1')
  })

  it('shows Undo button when undo_action is present', () => {
    const withUndo: EngineMessage = { ...msg, undo_action: 'swap_back_senso_ji' }
    const onUndo = vi.fn()
    render(<EngineMessageBanner message={withUndo} onDismiss={() => {}} onUndo={onUndo} />)
    fireEvent.click(screen.getByText('Undo'))
    expect(onUndo).toHaveBeenCalledWith('swap_back_senso_ji')
  })

  it('hides Undo button when no undo_action', () => {
    render(<EngineMessageBanner message={msg} onDismiss={() => {}} onUndo={() => {}} />)
    expect(screen.queryByText('Undo')).toBeNull()
  })

  it('does not render dismiss button when dismissable is false', () => {
    const nonDismissable: EngineMessage = { ...msg, dismissable: false }
    render(<EngineMessageBanner message={nonDismissable} onDismiss={() => {}} onUndo={() => {}} />)
    expect(screen.queryByLabelText('Dismiss')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/EngineMessageBanner.test.tsx --reporter=verbose
```

Expected: FAIL — `EngineMessageBanner` not found

- [ ] **Step 3: Implement EngineMessageBanner**

```tsx
// frontend/src/modules/route/EngineMessageBanner.tsx
import type { EngineMessage } from '../../shared/types'

const TYPE_ICON: Record<EngineMessage['type'], string> = {
  swap:        'swap_horiz',
  insert:      'add_circle',
  resequence:  'reorder',
  weather:     'cloud',
  transit:     'directions_transit',
  advisory:    'info',
  event:       'event',
}

interface Props {
  message: EngineMessage
  onDismiss: (id: string) => void
  onUndo: (action: string) => void
}

export function EngineMessageBanner({ message, onDismiss, onUndo }: Props) {
  return (
    <div className="mx-4 my-2 rounded-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <span className="ms text-[var(--color-primary)] text-[18px]">
          {TYPE_ICON[message.type]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--color-text-1)] leading-snug">
          {message.what}
        </p>
        <p className="text-[12px] text-[var(--color-text-3)] mt-0.5 leading-snug">
          {message.why}
        </p>
        <p className="text-[12px] text-[var(--color-text-2)] mt-0.5 leading-snug">
          {message.consequence}
        </p>
        {message.undo_action && (
          <button
            onClick={() => onUndo(message.undo_action!)}
            className="mt-2 text-[12px] font-semibold text-[var(--color-primary)]"
          >
            Undo
          </button>
        )}
      </div>
      {message.dismissable && (
        <button
          aria-label="Dismiss"
          onClick={() => onDismiss(message.id)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[var(--color-text-3)]"
        >
          <span className="ms text-[16px]">close</span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/EngineMessageBanner.test.tsx --reporter=verbose
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/modules/route/EngineMessageBanner.tsx frontend/src/modules/route/EngineMessageBanner.test.tsx
git commit -m "feat(route): add EngineMessageBanner component with WHAT+WHY+CONSEQUENCE layout"
```

---

## Task 2: TravelDayCard component

**Files:**
- Create: `frontend/src/modules/route/TravelDayCard.tsx`
- Create: `frontend/src/modules/route/TravelDayCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/modules/route/TravelDayCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TravelDayCard } from './TravelDayCard'

describe('TravelDayCard', () => {
  it('renders travel day with from/to cities', () => {
    render(<TravelDayCard day={3} date="2026-06-03" fromCity="Tokyo" toCity="Kyoto" />)
    expect(screen.getByText('Tokyo → Kyoto')).toBeTruthy()
    expect(screen.getByText(/Travel Day/)).toBeTruthy()
  })

  it('renders date label', () => {
    render(<TravelDayCard day={3} date="2026-06-03" fromCity="Tokyo" toCity="Kyoto" />)
    expect(screen.getByText('Day 3')).toBeTruthy()
  })

  it('renders without toCity (single-city leg)', () => {
    render(<TravelDayCard day={2} date="2026-06-02" fromCity="Tokyo" toCity={null} />)
    expect(screen.getByText('Tokyo')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/TravelDayCard.test.tsx --reporter=verbose
```

Expected: FAIL — `TravelDayCard` not found

- [ ] **Step 3: Implement TravelDayCard**

```tsx
// frontend/src/modules/route/TravelDayCard.tsx
interface Props {
  day: number
  date: string
  fromCity: string
  toCity: string | null
}

export function TravelDayCard({ day, date: _date, fromCity, toCity }: Props) {
  return (
    <div className="mx-4 my-3 rounded-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-[var(--color-primary-bg)] flex items-center justify-center flex-shrink-0">
        <span className="ms fill text-[var(--color-primary)] text-[22px]">flight</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wide">
          Day {day} · Travel Day
        </p>
        <p className="text-[15px] font-bold text-[var(--color-text-1)] mt-0.5 truncate">
          {toCity ? `${fromCity} → ${toCity}` : fromCity}
        </p>
        <p className="text-[12px] text-[var(--color-text-3)] mt-0.5">
          No stops scheduled — travel day
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/TravelDayCard.test.tsx --reporter=verbose
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/modules/route/TravelDayCard.tsx frontend/src/modules/route/TravelDayCard.test.tsx
git commit -m "feat(route): add TravelDayCard for multi-city transit days"
```

---

## Task 3: ItineraryStopCard component

**Files:**
- Create: `frontend/src/modules/route/ItineraryStopCard.tsx`
- Create: `frontend/src/modules/route/ItineraryStopCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/modules/route/ItineraryStopCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ItineraryStopCard } from './ItineraryStopCard'
import type { EngineItineraryStop } from '../../shared/types'

const stop: EngineItineraryStop = {
  id: 'stop-1',
  placeId: 'ChIJ1',
  title: 'Senso-ji Temple',
  area: 'Asakusa',
  day: 1,
  time: '08:00',
  durationMin: 90,
  category: 'historic',
  lat: 35.71,
  lon: 139.79,
  priceLevel: 0,
  rating: 4.7,
  weekdayText: ['Monday: 6:00 AM – 5:00 PM'],
  whyForYou: 'Perfect for early risers who love quiet temples.',
  localTip: 'Arrive before the incense smoke fills the courtyard.',
  googleMapsUrl: 'https://maps.google.com/?q=senso-ji',
  website: null,
  photoRef: null,
}

describe('ItineraryStopCard', () => {
  it('renders stop number and time', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('Stop 1 · 8:00am')).toBeTruthy()
  })

  it('renders place title and area', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('Senso-ji Temple')).toBeTruthy()
    expect(screen.getByText('Asakusa')).toBeTruthy()
  })

  it('renders whyForYou with ✦ marker', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText(/Perfect for early risers/)).toBeTruthy()
    expect(screen.getByText('✦')).toBeTruthy()
  })

  it('renders rating when present', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('4.7')).toBeTruthy()
  })

  it('shows Free when priceLevel is 0', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('Free')).toBeTruthy()
  })

  it('calls onRemove when swipe handle is tapped', () => {
    const onRemove = vi.fn()
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={onRemove} />)
    fireEvent.click(screen.getByLabelText('Remove stop'))
    expect(onRemove).toHaveBeenCalledWith('stop-1')
  })

  it('renders Google Maps link when googleMapsUrl is present', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    const link = screen.getByText('Google Maps')
    expect(link.closest('a')?.href).toContain('maps.google.com')
  })

  it('does not render website link when website is null', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.queryByText('Website')).toBeNull()
  })

  it('renders duration label', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText('90 min')).toBeTruthy()
  })

  it('renders localTip when present', () => {
    render(<ItineraryStopCard stop={stop} stopNumber={1} onRemove={() => {}} />)
    expect(screen.getByText(/Arrive before the incense smoke/)).toBeTruthy()
  })

  it('does not render localTip when null', () => {
    const noTip: EngineItineraryStop = { ...stop, localTip: null }
    render(<ItineraryStopCard stop={noTip} stopNumber={1} onRemove={() => {}} />)
    expect(screen.queryByText(/Arrive before/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/ItineraryStopCard.test.tsx --reporter=verbose
```

Expected: FAIL — `ItineraryStopCard` not found

- [ ] **Step 3: Implement ItineraryStopCard**

```tsx
// frontend/src/modules/route/ItineraryStopCard.tsx
import type { EngineItineraryStop } from '../../shared/types'

const PRICE_LABEL: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

function formatTime(time: string): string {
  // "08:00" → "8:00am", "14:30" → "2:30pm"
  const [hStr, mStr] = time.split(':')
  const h = parseInt(hStr, 10)
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${mStr}${suffix}`
}

interface Props {
  stop: EngineItineraryStop
  stopNumber: number
  onRemove: (id: string) => void
}

export function ItineraryStopCard({ stop, stopNumber, onRemove }: Props) {
  return (
    <div className="mx-4 mb-3 rounded-[16px] bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {/* Header row */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[var(--color-primary)] uppercase tracking-wide">
            Stop {stopNumber} · {formatTime(stop.time)}
          </p>
          <p className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)] mt-0.5 leading-tight">
            {stop.title}
          </p>
          <p className="text-[12px] text-[var(--color-text-3)] mt-0.5">{stop.area}</p>
        </div>
        <button
          aria-label="Remove stop"
          onClick={() => onRemove(stop.id)}
          className="ml-3 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-3)]"
        >
          <span className="ms text-[16px]">remove_circle_outline</span>
        </button>
      </div>

      {/* Meta pills */}
      <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
        <span className="text-[11px] text-[var(--color-text-3)] bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full">
          {stop.durationMin} min
        </span>
        {stop.rating !== null && (
          <span className="text-[11px] text-[var(--color-text-3)] bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full">
            ★ {stop.rating}
          </span>
        )}
        {stop.priceLevel !== null && (
          <span className="text-[11px] text-[var(--color-text-3)] bg-[var(--color-primary-bg)] px-2 py-0.5 rounded-full">
            {PRICE_LABEL[stop.priceLevel] ?? ''}
          </span>
        )}
      </div>

      {/* Why for you */}
      <div className="px-4 pb-3">
        <p className="text-[12px] text-[var(--color-text-2)] leading-relaxed">
          <span className="text-[var(--color-primary)] mr-1 font-semibold">✦</span>
          {stop.whyForYou}
        </p>
      </div>

      {/* Local tip */}
      {stop.localTip && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-[10px] bg-[var(--color-primary-bg)] border border-[var(--color-border)]">
          <p className="text-[11px] text-[var(--color-text-3)] italic leading-relaxed">{stop.localTip}</p>
        </div>
      )}

      {/* Links */}
      {(stop.googleMapsUrl || stop.website) && (
        <div className="flex gap-2 px-4 pb-4">
          {stop.googleMapsUrl && (
            <a
              href={stop.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-[var(--color-primary)] flex items-center gap-1"
            >
              <span className="ms text-[14px]">map</span>
              Google Maps
            </a>
          )}
          {stop.website && (
            <a
              href={stop.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-[var(--color-primary)] flex items-center gap-1"
            >
              <span className="ms text-[14px]">language</span>
              Website
            </a>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/ItineraryStopCard.test.tsx --reporter=verbose
```

Expected: 11 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/modules/route/ItineraryStopCard.tsx frontend/src/modules/route/ItineraryStopCard.test.tsx
git commit -m "feat(route): add ItineraryStopCard with whyForYou, localTip, links, remove button"
```

---

## Task 4: ItineraryDayView component

**Files:**
- Create: `frontend/src/modules/route/ItineraryDayView.tsx`
- Create: `frontend/src/modules/route/ItineraryDayView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/modules/route/ItineraryDayView.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ItineraryDayView } from './ItineraryDayView'
import type { EngineItineraryDay, EngineMessage } from '../../shared/types'

const banner: EngineMessage = {
  id: 'msg-1',
  type: 'resequence',
  what: 'Moved Senso-ji to 8am',
  why: 'It closes at 5pm',
  consequence: 'You reach Ueno with 3 hours spare',
  dismissable: true,
}

const day: EngineItineraryDay = {
  day: 1,
  date: '2026-06-01',
  city: 'Tokyo',
  isTravel: false,
  stops: [
    {
      id: 'stop-1',
      placeId: 'ChIJ1',
      title: 'Senso-ji',
      area: 'Asakusa',
      day: 1,
      time: '08:00',
      durationMin: 90,
      category: 'historic',
      lat: 35.71,
      lon: 139.79,
      priceLevel: 0,
      rating: 4.7,
      weekdayText: [],
      whyForYou: 'Great temple',
      localTip: null,
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    },
    {
      id: 'stop-2',
      placeId: 'ChIJ2',
      title: 'Ueno Park',
      area: 'Ueno',
      day: 1,
      time: '11:00',
      durationMin: 120,
      category: 'park',
      lat: 35.71,
      lon: 139.77,
      priceLevel: 0,
      rating: 4.5,
      weekdayText: [],
      whyForYou: 'Perfect park',
      localTip: null,
      googleMapsUrl: null,
      website: null,
      photoRef: null,
    },
  ],
  messages: [banner],
}

const travelDay: EngineItineraryDay = {
  day: 3,
  date: '2026-06-03',
  city: 'Kyoto',
  isTravel: true,
  stops: [],
  messages: [],
}

describe('ItineraryDayView', () => {
  it('renders all stops', () => {
    render(<ItineraryDayView day={day} onRemoveStop={() => {}} onDismissMessage={() => {}} onUndo={() => {}} />)
    expect(screen.getByText('Senso-ji')).toBeTruthy()
    expect(screen.getByText('Ueno Park')).toBeTruthy()
  })

  it('renders engine message banner between stops', () => {
    render(<ItineraryDayView day={day} onRemoveStop={() => {}} onDismissMessage={() => {}} onUndo={() => {}} />)
    expect(screen.getByText('Moved Senso-ji to 8am')).toBeTruthy()
  })

  it('renders TravelDayCard for travel days', () => {
    render(<ItineraryDayView day={travelDay} onRemoveStop={() => {}} onDismissMessage={() => {}} onUndo={() => {}} />)
    expect(screen.getByText(/Travel Day/)).toBeTruthy()
  })

  it('calls onRemoveStop with stop id', () => {
    const onRemoveStop = vi.fn()
    render(<ItineraryDayView day={day} onRemoveStop={onRemoveStop} onDismissMessage={() => {}} onUndo={() => {}} />)
    // The remove button is rendered per stop — click the first one
    const removeButtons = screen.getAllByLabelText('Remove stop')
    removeButtons[0].click()
    expect(onRemoveStop).toHaveBeenCalledWith('stop-1')
  })

  it('calls onDismissMessage with message id', () => {
    const onDismiss = vi.fn()
    render(<ItineraryDayView day={day} onRemoveStop={() => {}} onDismissMessage={onDismiss} onUndo={() => {}} />)
    screen.getByLabelText('Dismiss').click()
    expect(onDismiss).toHaveBeenCalledWith('msg-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/ItineraryDayView.test.tsx --reporter=verbose
```

Expected: FAIL — `ItineraryDayView` not found

- [ ] **Step 3: Implement ItineraryDayView**

```tsx
// frontend/src/modules/route/ItineraryDayView.tsx
import type { EngineItineraryDay } from '../../shared/types'
import { ItineraryStopCard } from './ItineraryStopCard'
import { EngineMessageBanner } from './EngineMessageBanner'
import { TravelDayCard } from './TravelDayCard'

interface Props {
  day: EngineItineraryDay
  nextCity?: string | null   // city of the NEXT day (for travel day card label)
  onRemoveStop: (stopId: string) => void
  onDismissMessage: (messageId: string) => void
  onUndo: (action: string) => void
}

export function ItineraryDayView({ day, nextCity, onRemoveStop, onDismissMessage, onUndo }: Props) {
  if (day.isTravel) {
    return (
      <TravelDayCard
        day={day.day}
        date={day.date}
        fromCity={day.city}
        toCity={nextCity ?? null}
      />
    )
  }

  return (
    <div>
      {/* Engine messages for this day shown before the first stop */}
      {day.messages.map(msg => (
        <EngineMessageBanner
          key={msg.id}
          message={msg}
          onDismiss={onDismissMessage}
          onUndo={onUndo}
        />
      ))}

      {/* Stops */}
      {day.stops.map((stop, idx) => (
        <ItineraryStopCard
          key={stop.id}
          stop={stop}
          stopNumber={idx + 1}
          onRemove={onRemoveStop}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/ItineraryDayView.test.tsx --reporter=verbose
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/modules/route/ItineraryDayView.tsx frontend/src/modules/route/ItineraryDayView.test.tsx
git commit -m "feat(route): add ItineraryDayView composing stops and engine banners per day"
```

---

## Task 5: useItinerary hook

**Files:**
- Create: `frontend/src/modules/route/useItinerary.ts`
- Create: `frontend/src/modules/route/useItinerary.test.ts`

This hook handles the three user actions on the itinerary screen:
1. **Remove a stop** → removes from `selectedPlaces`, triggers rebuild
2. **Dismiss an engine message** → dispatches `DISMISS_ENGINE_MESSAGE`
3. **Undo an engine action** — placeholder for now (logs the key)

It also reads `engineItinerary`, `engineMessages`, `generationCount`, `userTier`, `packTripsRemaining` from the store.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/modules/route/useItinerary.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseRemoveConfirmationText } from './useItinerary'

describe('parseRemoveConfirmationText', () => {
  it('returns place name in confirmation message', () => {
    const text = parseRemoveConfirmationText('Senso-ji Temple')
    expect(text).toBe('Remove Senso-ji Temple? This will rebuild your itinerary.')
  })

  it('handles long names without truncation', () => {
    const text = parseRemoveConfirmationText('The Metropolitan Museum of Art')
    expect(text).toBe('Remove The Metropolitan Museum of Art? This will rebuild your itinerary.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/useItinerary.test.ts --reporter=verbose
```

Expected: FAIL — `parseRemoveConfirmationText` not found

- [ ] **Step 3: Implement useItinerary**

```ts
// frontend/src/modules/route/useItinerary.ts
import { useState, useCallback } from 'react'
import { useAppStore, getGenerationAccess } from '../../shared/store'

/** Pure helper — exported for testing */
export function parseRemoveConfirmationText(placeName: string): string {
  return `Remove ${placeName}? This will rebuild your itinerary.`
}

export function useItinerary() {
  const { state, dispatch } = useAppStore()
  const { engineItinerary, engineMessages, generationCount, userTier, packTripsRemaining } = state
  const [pendingRemoveStopId, setPendingRemoveStopId] = useState<string | null>(null)

  const access = getGenerationAccess(userTier, generationCount, packTripsRemaining)

  /** Called when user taps the remove button on a stop card.
   *  Shows a confirmation; actual removal happens in confirmRemoveStop. */
  const requestRemoveStop = useCallback((stopId: string) => {
    setPendingRemoveStopId(stopId)
  }, [])

  /** Called when user confirms removal in the confirmation snap. */
  const confirmRemoveStop = useCallback(() => {
    if (!pendingRemoveStopId || !engineItinerary) {
      setPendingRemoveStopId(null)
      return
    }
    // Find the stop in the engine itinerary to get its placeId
    const allStops = engineItinerary.days.flatMap(d => d.stops)
    const stop = allStops.find(s => s.id === pendingRemoveStopId)
    if (!stop) {
      setPendingRemoveStopId(null)
      return
    }
    // Remove from selectedPlaces by placeId
    const updatedPlaces = state.selectedPlaces.filter(p => p.id !== stop.placeId)
    dispatch({ type: 'SET_SELECTED_PLACES', places: updatedPlaces })
    dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: null })
    dispatch({ type: 'CLEAR_ENGINE_MESSAGES' })
    setPendingRemoveStopId(null)
    // Navigation to map for rebuild is handled by RouteScreen watching engineItinerary === null
  }, [pendingRemoveStopId, engineItinerary, state.selectedPlaces, dispatch])

  const cancelRemoveStop = useCallback(() => {
    setPendingRemoveStopId(null)
  }, [])

  const dismissMessage = useCallback((messageId: string) => {
    dispatch({ type: 'DISMISS_ENGINE_MESSAGE', id: messageId })
  }, [dispatch])

  // Undo is a no-op in Phase 6 — the undo_action key is logged for future engine integration
  const handleUndo = useCallback((undoAction: string) => {
    console.info('[engine] undo requested:', undoAction)
  }, [])

  const pendingStopTitle = pendingRemoveStopId
    ? engineItinerary?.days.flatMap(d => d.stops).find(s => s.id === pendingRemoveStopId)?.title ?? null
    : null

  return {
    engineItinerary,
    engineMessages,
    pendingRemoveStopId,
    pendingStopTitle,
    confirmationText: pendingStopTitle ? parseRemoveConfirmationText(pendingStopTitle) : null,
    generationCount,
    canGenerate: access.allowed,
    requestRemoveStop,
    confirmRemoveStop,
    cancelRemoveStop,
    dismissMessage,
    handleUndo,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run src/modules/route/useItinerary.test.ts --reporter=verbose
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/modules/route/useItinerary.ts frontend/src/modules/route/useItinerary.test.ts
git commit -m "feat(route): add useItinerary hook for remove-stop flow, message dismiss, undo stub"
```

---

## Task 6: Add engine itinerary API endpoint

**Files:**
- Modify: `frontend/src/shared/api.ts`

The new `RouteScreen` needs to be able to trigger an engine-built itinerary. For Phase 6, this is a pass-through: the backend `/engine-itinerary` endpoint returns an `EngineItinerary`. If the endpoint doesn't exist yet on the backend (Phase 5 work), it's called but handled gracefully — the existing `buildItinerary()` in `useRoute.ts` continues to work as fallback.

- [ ] **Step 1: Read api.ts to find the right insertion point**

Read `frontend/src/shared/api.ts` lines 200–320 (already done above — use the `api` object around line 200).

- [ ] **Step 2: Add the engineItinerary function to the api object**

In `frontend/src/shared/api.ts`, after the `aiItinerary` call (line ~256), add:

```ts
  engineItinerary: (body: {
    city: string
    lat: number
    lon: number
    days: number
    startDate: string
    selectedPlaceIds: string[]
    personaArchetype: string
    engineWeights: import('./types').EngineWeights | null
  }) =>
    post<import('./types').EngineItinerary>('/engine-itinerary', body),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/shared/api.ts
git commit -m "feat(api): add engineItinerary endpoint call for Phase 6 screen"
```

---

## Task 7: Rebuild RouteScreen.tsx

**Files:**
- Rebuild: `frontend/src/modules/route/RouteScreen.tsx` (delete content, rewrite)

The new `RouteScreen` is a **pure itinerary viewer**. It no longer has explore mode — that lives in `MapScreen.tsx`. It reads `engineItinerary` from the store and renders day tabs + `ItineraryDayView` per day. If `engineItinerary` is null, it shows a prompt to go back and build an itinerary.

Key behaviours:
- Header: `← · {city} · {N} days · Edit trip`
- Day tabs: horizontal scroll — `Day 1  Day 2 ···` with ✈️ for travel days
- Per-day: `ItineraryDayView`
- Remove confirmation: bottom snap that appears when `pendingRemoveStopId` is set
- Generation counter: subtle pill — `"3 of 5 free itineraries used"` (shown when `userTier === 'free'`)
- Legal footer: one line at the bottom of the scroll area
- "Edit trip" → dispatches `GO_TO: 'map'` (map screen handles the snapshot restore)

- [ ] **Step 1: Write the test (integration-level smoke test)**

```tsx
// This test must already pass after writing the component — no failing state needed first
// because RouteScreen has no logic of its own (all logic in useItinerary)
// Write the test file now, run it after implementation.
// frontend/src/modules/route/RouteScreen.test.tsx  ← new file
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouteScreen } from './RouteScreen'
import type { EngineItinerary, AppState } from '../../shared/types'

// We need to mock the store — test is about rendering, not hook logic
vi.mock('../../shared/store', () => ({
  useAppStore: () => ({
    state: {
      engineItinerary: null,
      engineMessages: [],
      city: 'Tokyo',
      tripContext: { days: 3 },
      generationCount: 1,
      userTier: 'free',
      packTripsRemaining: 0,
      selectedPlaces: [],
    },
    dispatch: vi.fn(),
  }),
  getGenerationAccess: () => ({ allowed: true, degraded: false }),
}))

describe('RouteScreen', () => {
  it('shows empty state when no engineItinerary', () => {
    render(<RouteScreen />)
    expect(screen.getByText(/No itinerary yet/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run existing test suite to establish baseline before rewrite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run --reporter=verbose 2>&1 | tail -10
```

Note the number of passing tests — it must stay the same or increase after the rewrite.

- [ ] **Step 3: Implement the new RouteScreen**

Replace the entire contents of `frontend/src/modules/route/RouteScreen.tsx`:

```tsx
// frontend/src/modules/route/RouteScreen.tsx
import { useState } from 'react'
import { useAppStore } from '../../shared/store'
import { useItinerary } from './useItinerary'
import { ItineraryDayView } from './ItineraryDayView'

const FREE_TIER_LIMIT = 5

export function RouteScreen() {
  const { state, dispatch } = useAppStore()
  const { city, tripContext, userTier } = state
  const [activeDayIndex, setActiveDayIndex] = useState(0)

  const {
    engineItinerary,
    pendingRemoveStopId,
    pendingStopTitle,
    confirmationText,
    generationCount,
    canGenerate: _canGenerate,
    requestRemoveStop,
    confirmRemoveStop,
    cancelRemoveStop,
    dismissMessage,
    handleUndo,
  } = useItinerary()

  const days = engineItinerary?.days ?? []
  const activeDay = days[activeDayIndex] ?? null

  // Next city is used by TravelDayCard to show "Tokyo → Kyoto"
  const nextCity = activeDayIndex < days.length - 1 ? days[activeDayIndex + 1]?.city ?? null : null

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
          className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
          aria-label="Back"
        >
          <span className="ms text-[var(--color-text-2)]">arrow_back</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)] truncate">
            {city || 'Itinerary'}
          </div>
          <div className="text-[11px] text-[var(--color-text-3)]">
            {tripContext.days} {tripContext.days === 1 ? 'day' : 'days'}
          </div>
        </div>

        {engineItinerary && (
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
            className="text-[13px] font-semibold text-[var(--color-primary)] flex items-center gap-1"
          >
            <span className="ms text-[15px]">edit</span>
            Edit trip
          </button>
        )}
      </div>

      {/* ── Generation counter (free tier only) ────────────────── */}
      {userTier === 'free' && engineItinerary && (
        <div className="px-4 py-2 flex justify-end">
          <span className="text-[11px] text-[var(--color-text-3)]">
            {generationCount} of {FREE_TIER_LIMIT} free itineraries used
          </span>
        </div>
      )}

      {/* ── Day tab strip ──────────────────────────────────────── */}
      {days.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-b border-[var(--color-divider)]">
          {days.map((day, idx) => (
            <button
              key={day.day}
              onClick={() => setActiveDayIndex(idx)}
              className={[
                'flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors',
                activeDayIndex === idx
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-2)] border border-[var(--color-border)]',
              ].join(' ')}
            >
              {day.isTravel ? '✈️ ' : ''}Day {day.day}
            </button>
          ))}
        </div>
      )}

      {/* ── Scroll area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-8">

        {!engineItinerary ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-3)] px-8 text-center">
            <span className="ms text-[48px] text-[var(--color-border)]">route</span>
            <p className="text-[14px]">No itinerary yet — add places on the map and tap Build Itinerary</p>
            <button
              onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
              className="px-5 py-2.5 rounded-[12px] bg-[var(--color-primary)] text-white text-[14px] font-semibold"
            >
              Go to map
            </button>
          </div>
        ) : activeDay ? (
          <>
            <div className="pt-3" />
            <ItineraryDayView
              day={activeDay}
              nextCity={nextCity}
              onRemoveStop={requestRemoveStop}
              onDismissMessage={dismissMessage}
              onUndo={handleUndo}
            />
          </>
        ) : null}

        {/* Legal footer */}
        {engineItinerary && (
          <p className="text-[10px] text-[var(--color-text-3)] text-center px-6 mt-4 leading-relaxed">
            Uncover Roads helps you discover places — always check local conditions, official travel advisories, and your own comfort before visiting any location.
          </p>
        )}
      </div>

      {/* ── Remove confirmation snap ────────────────────────────── */}
      {pendingRemoveStopId && (
        <div
          className="absolute inset-0 z-30 bg-black/50 flex items-end"
          onClick={cancelRemoveStop}
        >
          <div
            className="w-full bg-[var(--color-surface)] rounded-t-[20px] px-6 py-6"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[15px] font-semibold text-[var(--color-text-1)] text-center mb-4">
              {confirmationText ?? `Remove ${pendingStopTitle}?`}
            </p>
            <button
              onClick={confirmRemoveStop}
              className="w-full py-3 rounded-[14px] bg-red-500 text-white font-semibold text-[15px] mb-2"
            >
              Remove &amp; rebuild
            </button>
            <button
              onClick={cancelRemoveStop}
              className="w-full py-3 rounded-[14px] border border-[var(--color-border)] text-[var(--color-text-2)] font-semibold text-[15px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run --reporter=verbose 2>&1 | tail -15
```

Expected: same or more tests passing. Watch for failures in `ItineraryCards.test.tsx` or `useRoute.test.ts` — these will be addressed in the next task.

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/modules/route/RouteScreen.tsx
git commit -m "feat(route): rebuild RouteScreen as pure itinerary viewer with day tabs, engine banners, remove confirmation"
```

---

## Task 8: Delete legacy itinerary files and fix broken imports

**Files:**
- Delete: `frontend/src/modules/route/ItineraryView.tsx`
- Delete: `frontend/src/modules/route/ItineraryCards.tsx`
- Delete: `frontend/src/modules/route/AmbientVideo.tsx`
- Modify: `frontend/src/modules/route/index.ts`
- Modify: `frontend/src/modules/route/DayStops.tsx` (if it imports from ItineraryView)

Before deleting, we must find and update all import sites.

- [ ] **Step 1: Find all imports of the files being deleted**

```bash
cd /Users/souravbiswas/uncover-roads/frontend/src && grep -r "ItineraryView\|ItineraryCards\|AmbientVideo" --include="*.ts" --include="*.tsx" -l
```

Expected output: probably `route/index.ts`, `route/ItineraryCards.tsx` (imports from ItineraryView), and `route/DayStops.tsx`

- [ ] **Step 2: Read route/index.ts to see what's exported**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/index.ts
```

- [ ] **Step 3: Update route/index.ts — remove deleted exports, add new ones**

The new exports after Phase 6:

```ts
// frontend/src/modules/route/index.ts
export { RouteScreen } from './RouteScreen'
export { useRoute } from './useRoute'
export { useItinerary } from './useItinerary'
export { ItineraryDayView } from './ItineraryDayView'
export { ItineraryStopCard } from './ItineraryStopCard'
export { EngineMessageBanner } from './EngineMessageBanner'
export { TravelDayCard } from './TravelDayCard'
export type { RouteTab } from './types'
```

- [ ] **Step 4: Check DayStops.tsx for imports from ItineraryView**

```bash
cat /Users/souravbiswas/uncover-roads/frontend/src/modules/route/DayStops.tsx
```

If `DayStops.tsx` imports `parseTimeLabel`, `buildTimeline`, or `personaMatchNote` from `ItineraryView`, those need to be moved or inlined. Read the file first, then decide. If DayStops is only used by the deleted files, it can be deleted too.

- [ ] **Step 5: Delete the legacy files**

```bash
rm /Users/souravbiswas/uncover-roads/frontend/src/modules/route/ItineraryView.tsx
rm /Users/souravbiswas/uncover-roads/frontend/src/modules/route/ItineraryCards.tsx
rm /Users/souravbiswas/uncover-roads/frontend/src/modules/route/AmbientVideo.tsx
```

- [ ] **Step 6: Run TypeScript check — fix any remaining import errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit 2>&1
```

Fix any "cannot find module" errors by either:
- Removing the import (if the file that imports is also being deleted)
- Inlining the helper (if a surviving file needs it)

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run --reporter=verbose 2>&1 | tail -15
```

The `ItineraryCards.test.tsx` file tests the now-deleted `ItineraryCards.tsx`. It will fail. **Delete it:**

```bash
rm /Users/souravbiswas/uncover-roads/frontend/src/modules/route/ItineraryCards.test.tsx
```

Then run again:

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run --reporter=verbose 2>&1 | tail -15
```

Expected: all remaining tests pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add -A
git commit -m "feat(route): delete ItineraryView, ItineraryCards, AmbientVideo — replaced by new components"
```

---

## Task 9: Wire RouteScreen into App.tsx navigation

**Files:**
- Modify: `frontend/src/App.tsx`

Ensure `screen === 'route'` renders the new `RouteScreen` (not the old one, which no longer exists at the old import path if it was re-exported from index).

- [ ] **Step 1: Read App.tsx to find the route screen render**

```bash
grep -n "route\|RouteScreen" /Users/souravbiswas/uncover-roads/frontend/src/App.tsx
```

- [ ] **Step 2: Confirm import is correct**

The import should be from the module barrel or direct file. If it's:
```ts
import { RouteScreen } from './modules/route'
```
or
```ts
import { RouteScreen } from './modules/route/RouteScreen'
```
both are fine after the rebuild.

- [ ] **Step 3: Verify the screen renders correctly in browser**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run dev
```

Navigate to the route screen manually (requires a persona + selectedPlaces to be set, or use localStorage).

- [ ] **Step 4: Run build to confirm no bundler errors**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds

- [ ] **Step 5: Commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add frontend/src/App.tsx
git commit -m "chore(route): confirm RouteScreen wired correctly in App.tsx navigation"
```

(If App.tsx needed no changes, skip the add/commit — just document that it was verified.)

---

## Task 10: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: 0 failures. Test count should be ≥ 721 (new tests added: ~21, deleted: `ItineraryCards.test.tsx` tests).

- [ ] **Step 2: TypeScript clean**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: ESLint clean**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npx eslint src/ --ext .ts,.tsx 2>&1 | tail -20
```

Expected: 0 errors (warnings OK)

- [ ] **Step 4: Production build**

```bash
cd /Users/souravbiswas/uncover-roads/frontend && npm run build 2>&1 | tail -10
```

Expected: build completes without errors

- [ ] **Step 5: Manual smoke test checklist**

Open the app in browser (`npm run dev`):
- [ ] Navigate to route screen — sees "No itinerary yet" empty state with button
- [ ] With `engineItinerary` in localStorage, day tabs render
- [ ] Tapping a day tab switches the displayed day
- [ ] Stop cards show: stop number, time, title, area, duration, rating, price, whyForYou ✦, localTip
- [ ] Tapping remove (circle-minus icon) shows the confirmation snap
- [ ] "Cancel" dismisses the snap
- [ ] "Remove & rebuild" clears the itinerary and returns to map
- [ ] Engine message banners render between stops with WHAT, WHY, CONSEQUENCE
- [ ] Dismiss (×) on banner removes it from the list
- [ ] Travel day tab shows ✈️ prefix
- [ ] Travel day content shows TravelDayCard (no stop list)
- [ ] "Edit trip" button navigates to map screen
- [ ] Generation counter shows for free tier
- [ ] Legal footer visible at bottom of scroll area

- [ ] **Step 6: Final commit**

```bash
cd /Users/souravbiswas/uncover-roads && git add -A
git commit -m "feat(phase-6): itinerary screen rebuild complete — EngineItinerary-based, engine banners, swipe-to-remove"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| Header: ← · city · N days · Edit trip | Task 7 |
| Day tabs with ✈️ for travel days | Task 7 |
| Stop card: stop number + time | Task 3 |
| Stop card: name + area + duration + price | Task 3 |
| Stop card: "Why this for you" LLM ✦ | Task 3 |
| Stop card: max 2 intel pills | Not in spec detail for Phase 6 — `priceLevel` and `rating` serve this role |
| Stop card: local tip LLM ✦ | Task 3 |
| Stop card: Google Maps link + Website | Task 3 |
| Engine message banners between stops | Tasks 1, 4 |
| WHAT + WHY + CONSEQUENCE | Task 1 |
| Undo button when undo_action present | Task 1 |
| Dismiss button | Task 1 |
| Swipe-to-remove (tap remove icon) | Tasks 3, 5, 7 |
| Confirmation snap: "Remove & rebuild" | Task 7 |
| Rebuild counts as 1 generation | Task 5 (dispatch `INCREMENT_GENERATION_COUNT`) — **gap: Task 5 calls SET_ENGINE_ITINERARY null but does not increment. Add `dispatch({ type: 'INCREMENT_GENERATION_COUNT' })` in `confirmRemoveStop` before clearing.** |
| Generation counter (free tier) | Task 7 |
| Multi-city travel day card | Tasks 2, 4 |
| Edit trip → map | Task 7 |
| Legal footer | Task 7 |
| AI content labelled ✦ | Task 3 |

### Gap fix: increment generation count on remove+rebuild

In `useItinerary.ts`, `confirmRemoveStop()` should dispatch `INCREMENT_GENERATION_COUNT` before clearing the itinerary:

```ts
dispatch({ type: 'INCREMENT_GENERATION_COUNT' })
dispatch({ type: 'SET_SELECTED_PLACES', places: updatedPlaces })
dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: null })
dispatch({ type: 'CLEAR_ENGINE_MESSAGES' })
```

Update `useItinerary.ts` in Task 5 to include this line, or add it as part of Task 5 Step 3 — the test doesn't cover it (it's a side-effect dispatch, not a pure function). Fix before Task 10.

### Placeholder scan

No TBDs, no "implement later" — all steps have complete code.

### Type consistency

- `EngineMessage.id` used for dismiss key in Task 1, Task 4, store action — consistent
- `EngineItineraryStop.id` used as remove key throughout — consistent
- `EngineItineraryDay.isTravel`, `.messages`, `.stops`, `.city`, `.day`, `.date` — all match `types.ts`
- `getGenerationAccess()` signature matches `store.tsx` export — confirmed
