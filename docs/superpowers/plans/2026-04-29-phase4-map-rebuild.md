# Phase 4: Map Screen Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the map screen from scratch with three simultaneous pin layers (Famous/Reference/User), a redesigned PinCard bottom sheet, Surprise Me button, Build Itinerary bar, and Discovery Mode toggle — replacing broken FavoritesLayer, TravelDateBar, and TripPlanningCard.

**Architecture:** New MapScreen orchestrates three isolated pin-layer components (FamousPinsLayer, ReferencePinsLayer, UserPinsLayer), each reading directly from the existing store (`places`, `referencePins`, `selectedPlaces`, `favouritedPins`). Pin visual logic lives in a pure `pin-visual.ts` module. PinCard is rebuilt as a bottom sheet driven by `activePinId` in store. No new state fields needed — Phase 3 already added `activePinId`, `mapFilter`, and `cityContexts`.

**Tech Stack:** React 19, TypeScript, MapLibre GL via `react-map-gl/maplibre`, Tailwind CSS 4, Vitest (pure logic tests only — no render tests; MapLibre requires canvas).

**Working directory:** All commands run from `.worktrees/phase4-map-rebuild/frontend` unless noted.

**Baseline:** 386 tests passing on `feature/phase3-types-state`. Every task must keep this green.

---

## Spec references (read before coding)

- `docs/superpowers/specs/2026-04-29-map-ui-full-rebuild-design.md` — Section 7 (Map Screen), Section 14 (Content Safety Rules), Section 15 (New Components), Section 16 (Files to Delete), Section 17 (State Changes)

---

## File Map

```
Create:
  frontend/src/modules/map/pin-visual.ts          → pure: pin color/size/opacity per layer + discovery mode
  frontend/src/modules/map/pin-visual.test.ts     → unit tests for all exported functions
  frontend/src/modules/map/FamousPinsLayer.tsx    → gold star MapLibre Marker components (famous pins)
  frontend/src/modules/map/ReferencePinsLayer.tsx → purple ghost MapLibre Marker components
  frontend/src/modules/map/UserPinsLayer.tsx      → blue user-added MapLibre Markers with saved badge
  frontend/src/modules/map/DiscoveryModeToggle.tsx → "Essentials / Local's pick" toggle button pair
  frontend/src/modules/map/SurpriseMeButton.tsx   → Surprise Me CTA, triggers generation
  frontend/src/modules/map/BuildItineraryBar.tsx   → sticky bar shown when ≥1 pin in itinerary

Rebuild (delete content and write fresh — do NOT modify existing):
  frontend/src/modules/map/MapScreen.tsx          → clean container, wires all new components
  frontend/src/modules/map/PinCard.tsx            → 40%/full bottom sheet driven by activePinId

Delete:
  frontend/src/modules/map/FavoritesLayer.tsx     → replaced by per-pin saved state in UserPinsLayer
  frontend/src/modules/map/favorites-layer.test.ts → tests for deleted file
  frontend/src/modules/map/TravelDateBar.tsx      → replaced by destination screen calendar (Phase 7)
  frontend/src/modules/map/TripPlanningCard.tsx   → replaced by BuildItineraryBar

Modify:
  frontend/src/modules/map/index.ts               → add exports for new components
  frontend/src/modules/map/MapLibreMap.tsx        → add children prop support (already exists — verify)
```

---

## Task 1: Set up worktree for Phase 4

**Files:** None (git setup only)

- [ ] **Step 1: Create branch and worktree**

Run from `/Users/souravbiswas/uncover-roads`:

```bash
git worktree add .worktrees/phase4-map-rebuild -b feature/phase4-map-rebuild feature/phase3-types-state
```

Expected: `Preparing worktree (new branch 'feature/phase4-map-rebuild')` — no error.

- [ ] **Step 2: Verify baseline tests pass**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run 2>&1 | tail -6
```

Expected: `Tests  386 passed (386)` — 0 failures.

- [ ] **Step 3: Verify TypeScript is clean**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No output (clean).

---

## Task 2: Pin visual constants

**Files:**
- Create: `frontend/src/modules/map/pin-visual.ts`
- Create: `frontend/src/modules/map/pin-visual.test.ts`

This is the single source of truth for all pin colours, sizes, and opacity rules. All three layer components import from here.

Pin visual spec (from master plan + spec Section 7):
```
Famous pins     → gold (#f59e0b), star icon, 28px
User-added      → blue (#3b82f6), solid circle, 24px, blue ring when in itinerary
Reference ghost → purple (#8b5cf6), 18px, 50% opacity
Saved badge     → red ❤️ 10px overlaid top-right of any pin
Itinerary ring  → blue 2px border around pin circle
discovery_mode: 'deep' → famous layer at 50% opacity
discovery_mode: 'anchor' → famous layer at 100% opacity
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/map/pin-visual.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  FAMOUS_PIN_COLOR,
  FAMOUS_PIN_SIZE,
  REFERENCE_PIN_COLOR,
  REFERENCE_PIN_SIZE,
  REFERENCE_PIN_OPACITY,
  USER_PIN_COLOR,
  USER_PIN_SIZE,
  SAVED_BADGE_SIZE,
  ITINERARY_RING_COLOR,
  getFamousLayerOpacity,
  getUserPinStyle,
} from './pin-visual'

describe('pin-visual constants', () => {
  it('famous pin is gold, 28px', () => {
    expect(FAMOUS_PIN_COLOR).toBe('#f59e0b')
    expect(FAMOUS_PIN_SIZE).toBe(28)
  })

  it('reference pin is purple, 18px, 50% opacity', () => {
    expect(REFERENCE_PIN_COLOR).toBe('#8b5cf6')
    expect(REFERENCE_PIN_SIZE).toBe(18)
    expect(REFERENCE_PIN_OPACITY).toBe(0.5)
  })

  it('user pin is blue, 24px', () => {
    expect(USER_PIN_COLOR).toBe('#3b82f6')
    expect(USER_PIN_SIZE).toBe(24)
  })

  it('saved badge is 10px', () => {
    expect(SAVED_BADGE_SIZE).toBe(10)
  })

  it('itinerary ring is blue', () => {
    expect(ITINERARY_RING_COLOR).toBe('#3b82f6')
  })
})

describe('getFamousLayerOpacity', () => {
  it('returns 1 in anchor mode', () => {
    expect(getFamousLayerOpacity('anchor')).toBe(1)
  })

  it('returns 0.5 in deep mode', () => {
    expect(getFamousLayerOpacity('deep')).toBe(0.5)
  })
})

describe('getUserPinStyle', () => {
  it('no ring, no badge for plain pin', () => {
    const s = getUserPinStyle({ saved: false, inItinerary: false })
    expect(s.border).not.toContain('#3b82f6')
    expect(s.showSavedBadge).toBe(false)
  })

  it('shows saved badge when saved', () => {
    const s = getUserPinStyle({ saved: true, inItinerary: false })
    expect(s.showSavedBadge).toBe(true)
  })

  it('adds itinerary ring when inItinerary', () => {
    const s = getUserPinStyle({ saved: false, inItinerary: true })
    expect(s.border).toContain('#3b82f6')
  })

  it('shows both ring and badge when saved + inItinerary', () => {
    const s = getUserPinStyle({ saved: true, inItinerary: true })
    expect(s.showSavedBadge).toBe(true)
    expect(s.border).toContain('#3b82f6')
  })
})
```

- [ ] **Step 2: Run test — expect failures**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run src/modules/map/pin-visual.test.ts
```

Expected: `FAIL` — cannot find module `./pin-visual`.

- [ ] **Step 3: Create pin-visual.ts**

Create `frontend/src/modules/map/pin-visual.ts`:

```typescript
import type { DiscoveryMode } from '../../shared/types'

// ── Famous pin layer ─────────────────────────────────────────
export const FAMOUS_PIN_COLOR  = '#f59e0b'
export const FAMOUS_PIN_SIZE   = 28
export const FAMOUS_STAR_ICON  = 'star'   // Material Symbol name

// ── Reference ghost pin layer ────────────────────────────────
export const REFERENCE_PIN_COLOR   = '#8b5cf6'
export const REFERENCE_PIN_SIZE    = 18
export const REFERENCE_PIN_OPACITY = 0.5

// ── User-added pin layer ─────────────────────────────────────
export const USER_PIN_COLOR = '#3b82f6'
export const USER_PIN_SIZE  = 24

// ── Shared decoration ────────────────────────────────────────
export const SAVED_BADGE_SIZE      = 10
export const SAVED_BADGE_COLOR     = '#ef4444'
export const ITINERARY_RING_COLOR  = '#3b82f6'
export const ITINERARY_RING_WIDTH  = 2

/**
 * Famous layer opacity is 100% in anchor mode (essentials).
 * In deep mode (local's pick) famous pins are de-emphasised at 50%.
 */
export function getFamousLayerOpacity(mode: DiscoveryMode): number {
  return mode === 'deep' ? 0.5 : 1
}

interface PinFlags {
  saved: boolean
  inItinerary: boolean
}

interface UserPinStyle {
  border: string
  showSavedBadge: boolean
}

/**
 * Returns the border CSS string and badge visibility for a user-added pin.
 * inItinerary → blue 2px border (itinerary ring)
 * saved       → red ❤️ badge overlaid top-right
 */
export function getUserPinStyle({ saved, inItinerary }: PinFlags): UserPinStyle {
  const border = inItinerary
    ? `2px solid ${ITINERARY_RING_COLOR}`
    : '2px solid rgba(255,255,255,0.85)'
  return { border, showSavedBadge: saved }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run src/modules/map/pin-visual.test.ts
```

Expected: `Tests  10 passed (10)`.

- [ ] **Step 5: Verify full suite still green**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run 2>&1 | tail -5
```

Expected: 396 tests passing (386 + 10 new).

- [ ] **Step 6: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/pin-visual.ts frontend/src/modules/map/pin-visual.test.ts
git commit -m "feat(map): add pin-visual constants and style helpers"
```

---

## Task 3: FamousPinsLayer

**Files:**
- Create: `frontend/src/modules/map/FamousPinsLayer.tsx`

Renders famous places as gold/star `<Marker>` components inside MapLibreMap. No test file — pure JSX, no logic to unit test beyond what's in pin-visual.ts.

- [ ] **Step 1: Create FamousPinsLayer.tsx**

Create `frontend/src/modules/map/FamousPinsLayer.tsx`:

```typescript
import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { DiscoveryMode } from '../../shared/types'
import {
  FAMOUS_PIN_COLOR,
  FAMOUS_PIN_SIZE,
  FAMOUS_STAR_ICON,
  getFamousLayerOpacity,
} from './pin-visual'

interface Props {
  places: Place[]
  activePlaceId: string | null
  discoveryMode: DiscoveryMode
  onPinClick: (placeId: string) => void
}

/**
 * Renders the famous pin layer — gold star markers from Google Places top-rated landmarks.
 * In deep discovery mode (local's pick) the layer is de-emphasised at 50% opacity.
 * Tapping a pin dispatches SET_ACTIVE_PIN_ID via onPinClick.
 */
export function FamousPinsLayer({ places, activePlaceId, discoveryMode, onPinClick }: Props) {
  const layerOpacity = getFamousLayerOpacity(discoveryMode)

  return (
    <>
      {places.map((place) => {
        const isActive = activePlaceId === place.id
        const size = isActive ? FAMOUS_PIN_SIZE + 6 : FAMOUS_PIN_SIZE

        return (
          <Marker
            key={place.id}
            latitude={place.lat}
            longitude={place.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(place.id)
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: FAMOUS_PIN_COLOR,
                border: isActive
                  ? '2.5px solid #fff'
                  : '2px solid rgba(255,255,255,0.85)',
                boxShadow: isActive
                  ? `0 0 0 2px ${FAMOUS_PIN_COLOR}, 0 3px 8px rgba(0,0,0,.5)`
                  : '0 2px 6px rgba(0,0,0,0.35)',
                opacity: layerOpacity,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="ms fill"
                style={{ fontSize: isActive ? 16 : 13, color: '#fff', lineHeight: 1 }}
              >
                {FAMOUS_STAR_ICON}
              </span>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/FamousPinsLayer.tsx
git commit -m "feat(map): add FamousPinsLayer — gold star famous pin markers"
```

---

## Task 4: ReferencePinsLayer

**Files:**
- Create: `frontend/src/modules/map/ReferencePinsLayer.tsx`

Renders LLM-generated reference ghost pins (purple, 50% opacity). Toggleable via `mapFilter: 'for_you'`.

- [ ] **Step 1: Create ReferencePinsLayer.tsx**

Create `frontend/src/modules/map/ReferencePinsLayer.tsx`:

```typescript
import { Marker } from 'react-map-gl/maplibre'
import type { ReferencePin } from '../../shared/types'
import {
  REFERENCE_PIN_COLOR,
  REFERENCE_PIN_SIZE,
  REFERENCE_PIN_OPACITY,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  pins: ReferencePin[]
  activePinId: string | null
  onPinClick: (pinId: string) => void
}

/**
 * Renders the reference ghost pin layer — LLM-generated place suggestions
 * for the active persona. Always purple, always 50% opacity.
 * Tapping sets activePinId so the PinCard can be shown.
 */
export function ReferencePinsLayer({ pins, activePinId, onPinClick }: Props) {
  return (
    <>
      {pins.map((pin) => {
        const isActive = activePinId === pin.id
        const icon = CATEGORY_ICONS[pin.category as string] ?? 'location_on'
        const size = isActive ? REFERENCE_PIN_SIZE + 4 : REFERENCE_PIN_SIZE

        return (
          <Marker
            key={pin.id}
            latitude={pin.lat}
            longitude={pin.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(pin.id)
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: REFERENCE_PIN_COLOR,
                border: '2px solid rgba(255,255,255,0.5)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                opacity: isActive ? 0.85 : REFERENCE_PIN_OPACITY,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="ms fill"
                style={{ fontSize: isActive ? 11 : 9, color: '#fff', lineHeight: 1 }}
              >
                {icon}
              </span>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/ReferencePinsLayer.tsx
git commit -m "feat(map): add ReferencePinsLayer — purple ghost reference pin markers"
```

---

## Task 5: UserPinsLayer

**Files:**
- Create: `frontend/src/modules/map/UserPinsLayer.tsx`

Renders user-added pins (blue, solid) with saved badge (❤️) and itinerary ring. Reads `selectedPlaces` and `favouritedPins` from store.

- [ ] **Step 1: Create UserPinsLayer.tsx**

Create `frontend/src/modules/map/UserPinsLayer.tsx`:

```typescript
import { Marker } from 'react-map-gl/maplibre'
import type { Place, FavouritedPin } from '../../shared/types'
import {
  USER_PIN_COLOR,
  USER_PIN_SIZE,
  SAVED_BADGE_SIZE,
  SAVED_BADGE_COLOR,
  getUserPinStyle,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  /** Places the user has explicitly added to their itinerary */
  itineraryPlaces: Place[]
  /** All bookmarked places — used to determine saved badge */
  favouritedPins: FavouritedPin[]
  activePinId: string | null
  onPinClick: (placeId: string) => void
}

/**
 * Renders user-added itinerary pins as blue markers.
 * Each pin checks the favouritedPins list to determine if the ❤️ badge shows.
 * If a pin is in itineraryPlaces it always shows the itinerary ring (blue border).
 */
export function UserPinsLayer({ itineraryPlaces, favouritedPins, activePinId, onPinClick }: Props) {
  const savedIds = new Set(favouritedPins.map((fp) => fp.placeId))

  return (
    <>
      {itineraryPlaces.map((place) => {
        const isActive = activePinId === place.id
        const saved = savedIds.has(place.id)
        const { border, showSavedBadge } = getUserPinStyle({ saved, inItinerary: true })
        const icon = CATEGORY_ICONS[place.category] ?? 'location_on'
        const size = isActive ? USER_PIN_SIZE + 6 : USER_PIN_SIZE

        return (
          <Marker
            key={place.id}
            latitude={place.lat}
            longitude={place.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(place.id)
            }}
          >
            <div style={{ position: 'relative', width: size, height: size }}>
              {/* Pin body */}
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: USER_PIN_COLOR,
                  border,
                  boxShadow: isActive
                    ? `0 0 0 2px ${USER_PIN_COLOR}, 0 3px 8px rgba(0,0,0,.5)`
                    : '0 2px 6px rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  className="ms fill"
                  style={{ fontSize: isActive ? 14 : 12, color: '#fff', lineHeight: 1 }}
                >
                  {icon}
                </span>
              </div>
              {/* Saved badge */}
              {showSavedBadge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    fontSize: SAVED_BADGE_SIZE,
                    lineHeight: 1,
                    color: SAVED_BADGE_COLOR,
                    pointerEvents: 'none',
                  }}
                >
                  ❤️
                </span>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/UserPinsLayer.tsx
git commit -m "feat(map): add UserPinsLayer — blue user-added pins with saved badge and itinerary ring"
```

---

## Task 6: DiscoveryModeToggle

**Files:**
- Create: `frontend/src/modules/map/DiscoveryModeToggle.tsx`

Appears after a city is selected. Two buttons: "Show me the essentials" / "Show me what locals know". Dispatches `SET_DISCOVERY_MODE` for the active city.

- [ ] **Step 1: Create DiscoveryModeToggle.tsx**

Create `frontend/src/modules/map/DiscoveryModeToggle.tsx`:

```typescript
import type { DiscoveryMode } from '../../shared/types'

interface Props {
  mode: DiscoveryMode
  onChange: (mode: DiscoveryMode) => void
}

const ACCENT = '#3b82f6'
const SURFACE = 'rgba(255,255,255,0.06)'
const BORDER = 'rgba(255,255,255,0.1)'
const TEXT1 = '#f1f5f9'
const TEXT3 = 'rgba(193,198,215,0.7)'

/**
 * Discovery mode toggle — appears on the map after a city is selected.
 * anchor = "Show me the essentials" (famous landmarks)
 * deep   = "Show me what locals know" (hidden gems boosted)
 */
export function DiscoveryModeToggle({ mode, onChange }: Props) {
  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 20,
    fontSize: '0.72rem',
    fontWeight: 700,
    border: `1px solid ${BORDER}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '6px 8px',
        background: 'rgba(10,14,23,0.85)',
        borderRadius: 24,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${BORDER}`,
      }}
    >
      <button
        style={{
          ...btnBase,
          background: mode === 'anchor' ? ACCENT : SURFACE,
          color: mode === 'anchor' ? '#fff' : TEXT3,
          borderColor: mode === 'anchor' ? ACCENT : BORDER,
        }}
        onClick={() => onChange('anchor')}
      >
        ★ Essentials
      </button>
      <button
        style={{
          ...btnBase,
          background: mode === 'deep' ? ACCENT : SURFACE,
          color: mode === 'deep' ? '#fff' : TEXT3,
          borderColor: mode === 'deep' ? ACCENT : BORDER,
        }}
        onClick={() => onChange('deep')}
      >
        ✦ Local's pick
      </button>
    </div>
  )
}
```

> No test file — pure JSX with no logic to unit test beyond visual state.

- [ ] **Step 2: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/DiscoveryModeToggle.tsx
git commit -m "feat(map): add DiscoveryModeToggle — essentials/local's pick mode switcher"
```

---

## Task 7: BuildItineraryBar

**Files:**
- Create: `frontend/src/modules/map/BuildItineraryBar.tsx`

Sticky bottom bar that appears when the user has added ≥1 place to their itinerary. Shows pin count + day count. Tapping navigates to the itinerary screen.

- [ ] **Step 1: Create BuildItineraryBar.tsx**

Create `frontend/src/modules/map/BuildItineraryBar.tsx`:

```typescript
import { createPortal } from 'react-dom'
import type { Place } from '../../shared/types'

interface Props {
  itineraryPlaces: Place[]
  days: number   // from active CityContext.days — 0 means no dates set
  onBuild: () => void
}

const ACCENT = '#3b82f6'

/**
 * Sticky bottom bar shown when user has ≥1 place in their itinerary.
 * days=0 means dates not selected — still shows pin count but says "Build itinerary".
 */
export function BuildItineraryBar({ itineraryPlaces, days, onBuild }: Props) {
  if (itineraryPlaces.length === 0) return null

  const pinWord = itineraryPlaces.length === 1 ? 'place' : 'places'
  const dayPart = days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''
  const label = `Build itinerary · ${itineraryPlaces.length} ${pinWord}${dayPart}`

  const bar = (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        padding: '12px 16px',
        background: 'rgba(10,14,23,0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <button
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 14,
          backgroundColor: ACCENT,
          border: 'none',
          color: '#fff',
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.01em',
        }}
        onClick={onBuild}
      >
        {label} →
      </button>
    </div>
  )

  return createPortal(bar, document.body)
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/BuildItineraryBar.tsx
git commit -m "feat(map): add BuildItineraryBar — sticky bar when pins added to itinerary"
```

---

## Task 8: SurpriseMeButton

**Files:**
- Create: `frontend/src/modules/map/SurpriseMeButton.tsx`

Always-visible button that calls the backend to build a full N-day itinerary using the engine + persona, then navigates to the itinerary screen. Counts as 1 generation.

- [ ] **Step 1: Create SurpriseMeButton.tsx**

Create `frontend/src/modules/map/SurpriseMeButton.tsx`:

```typescript
import { useState } from 'react'

interface Props {
  disabled?: boolean
  onSurprise: () => Promise<void>
}

const ACCENT = '#8b5cf6'  // purple — distinct from the blue Build Itinerary bar

/**
 * "Surprise Me" button — builds a full itinerary from scratch using the engine.
 * Counts as 1 generation. Single-city only (multi-city uses intentional planning).
 * Calls onSurprise() which should: call API, dispatch SET_ENGINE_ITINERARY,
 * dispatch INCREMENT_GENERATION_COUNT, navigate to route screen.
 */
export function SurpriseMeButton({ disabled, onSurprise }: Props) {
  const [loading, setLoading] = useState(false)

  async function handlePress() {
    if (loading || disabled) return
    setLoading(true)
    try {
      await onSurprise()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      disabled={loading || disabled}
      onClick={handlePress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 16px',
        borderRadius: 999,
        backgroundColor: 'rgba(10,14,23,0.88)',
        border: `1px solid ${ACCENT}`,
        color: loading ? 'rgba(193,198,215,0.5)' : '#c4b5fd',
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.15s ease',
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ fontSize: 13 }}>✦</span>
      {loading ? 'Building…' : 'Surprise Me'}
    </button>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/SurpriseMeButton.tsx
git commit -m "feat(map): add SurpriseMeButton — one-tap full itinerary generation"
```

---

## Task 9: Rebuild PinCard

**Files:**
- Rebuild: `frontend/src/modules/map/PinCard.tsx` (delete all content, write fresh)

**Do NOT modify the existing file** — open a new buffer, write fresh content, save (overwrite). The existing PinCard takes `place: Place` as a prop. The rebuilt card still takes `place: Place` (for backwards compatibility during the MapScreen rebuild), but adds:
- New visual design: 40% bottom sheet → swipe/tap to expand to full sheet
- Three CTA buttons: `❤️ Save` / `+ Add to itinerary` / `✦ Similar`
- `whyForYou` (LLM ✦) archetype pill — one sentence, persona-matched, no facts
- Intel pills: travel-date open/close alert from `weekdayText` + `travelDate`
- Full-sheet expansion: local tip, Google Maps link, Website link, photo gallery

The rebuilt card wires to the store via `onSave` / `onAdd` / `onSimilar` callbacks (same as old card). The parent MapScreen dispatches `SET_ACTIVE_PIN_ID` to show/hide.

The existing `pincard-utils.ts` and `pincard-persona.ts` are still used — no changes needed there.

- [ ] **Step 1: Read the existing PinCard to understand what imports MapScreen uses**

```bash
grep -n "onAdd\|onClose\|onSimilar\|onFavourite\|PinCard" .worktrees/phase4-map-rebuild/frontend/src/modules/map/MapScreen.tsx | head -20
```

Note the prop names so the rebuilt PinCard keeps the same interface for the existing MapScreen call site. The interface must match:
```typescript
interface Props {
  place: Place
  city: string
  isSelected: boolean
  isFavourited: boolean
  onAdd: () => void
  onClose: () => void
  onSimilar: () => void
  onFavourite: () => void
  details?: PlaceDetails | null
  referencePin?: ReferencePin | null
  travelDate?: string | null
  persona?: Persona | null
  personaProfile?: PersonaProfile | null
  insightCache?: MutableRefObject<Map<string, string>>
}
```

- [ ] **Step 2: Write the rebuilt PinCard**

**Overwrite** `frontend/src/modules/map/PinCard.tsx` with:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { Place, PlaceDetails, ReferencePin } from '../../shared/types'
import type { Persona, PersonaProfile } from '../../shared/types'
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types'
import { getPlacePhotoUrl, api } from '../../shared/api'
import { getTravelDateBadge } from './pincard-utils'
import { ShimmerLine } from '../../shared/Shimmer'
import { computePersonaBadges, usePersonaInsight } from './pincard-persona'

// ── Design tokens ─────────────────────────────────────────────
const SURFACE  = 'rgba(15,19,28,0.97)'
const BORDER   = 'rgba(255,255,255,0.08)'
const TEXT1    = '#f1f5f9'
const TEXT3    = 'rgba(193,198,215,0.7)'
const ACCENT   = '#3b82f6'
const AI_MARK  = '#8b5cf6'

const PRICE: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
}

interface Props {
  place: Place
  city: string
  isSelected: boolean
  isFavourited: boolean
  onAdd: () => void
  onClose: () => void
  onSimilar: () => void
  onFavourite: () => void
  details?: PlaceDetails | null
  referencePin?: ReferencePin | null
  travelDate?: string | null
  persona?: Persona | null
  personaProfile?: PersonaProfile | null
  insightCache?: MutableRefObject<Map<string, string>>
}

/**
 * PinCard — bottom sheet that slides up on pin tap.
 *
 * 40% collapsed view:   hero image, name, area, rating, archetype pill (LLM ✦),
 *                        intel pills (factual), CTAs: Save / Add / Similar
 * Full expanded view:   + local tip (LLM ✦), Google Maps link, website, photo gallery
 *
 * Content rules (spec Section 14):
 *   - whyForYou / localTip: LLM ✦ — persona tone only, NO hours/prices/facts
 *   - rating, priceLevel, weekdayText: Google Places — factual, no AI marker
 *   - Intel pills: deterministic from weekdayText + travelDate
 */
export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onSimilar, onFavourite,
  details, referencePin, travelDate,
  persona, personaProfile, insightCache,
}: Props) {
  const [visible, setVisible]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [imgSrc, setImgSrc]     = useState<string | null>(null)
  const sheetRef    = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const dragY       = useRef(0)
  const closing     = useRef(false)

  // Slide-in animation
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

  // Hero image
  const photoRef = details?.photo_ref ?? place.photo_ref ?? null
  const googlePhotoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null

  useEffect(() => {
    closing.current = false
    if (googlePhotoUrl) {
      const img = new Image()
      img.onload = () => setImgSrc(googlePhotoUrl)
      img.onerror = () => setImgSrc(null)
      img.src = googlePhotoUrl
    } else {
      setImgSrc(null)
    }
  }, [googlePhotoUrl])

  // LLM archetype insight
  const { insight, loading: insightLoading } = usePersonaInsight(
    place, city, personaProfile ?? null, insightCache ?? { current: new Map() }
  )

  // Persona trait badges (deterministic from weights — not LLM)
  const badges = personaProfile ? computePersonaBadges(personaProfile, place.category) : []

  // Intel pills — deterministic from Google Places data + travel date
  const dateAlert = travelDate ? getTravelDateBadge(details?.weekday_text ?? null, travelDate) : null
  const rating = details?.rating ?? place.rating ?? null
  const ratingCount = details?.user_ratings_total ?? null
  const priceLevel = details?.price_level ?? null
  const catColor = CATEGORY_COLORS[place.category] ?? '#6b7280'
  const catIcon = CATEGORY_ICONS[place.category] ?? 'location_on'

  // Swipe to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    dragY.current = e.touches[0].clientY - touchStartY.current
    if (sheetRef.current && dragY.current > 0) {
      sheetRef.current.style.transform = `translateY(${dragY.current}px)`
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

  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place'
  const websiteUrl = details?.website ?? referencePin?.website ?? null
  const mapsUrl = details?.google_maps_url ?? null

  return (
    <>
      {/* Backdrop — tap to close */}
      <div
        onClick={() => { if (!closing.current) { closing.current = true; onClose() } }}
        style={{
          position: 'fixed', inset: 0, zIndex: 39,
          background: 'transparent',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 40,
          background: SURFACE,
          borderRadius: '20px 20px 0 0',
          border: `1px solid ${BORDER}`,
          borderBottom: 'none',
          backdropFilter: 'blur(20px)',
          maxHeight: expanded ? '92vh' : '48vh',
          overflow: expanded ? 'auto' : 'hidden',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1), max-height 0.3s ease',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Hero image */}
        <div
          style={{
            height: 140,
            background: imgSrc ? 'transparent' : catColor + '22',
            position: 'relative',
            overflow: 'hidden',
            margin: '0 0 0 0',
          }}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={place.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span className="ms fill" style={{ fontSize: 48, color: catColor, opacity: 0.6 }}>
                {catIcon}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(15,19,28,0.8) 0%, transparent 50%)',
          }} />
        </div>

        {/* Card body */}
        <div style={{ padding: '12px 16px 20px' }}>
          {/* Title + area */}
          <div style={{ marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: TEXT1, lineHeight: 1.2 }}>
              {place.title}
            </h2>
            {place.area && (
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: TEXT3 }}>
                {place.area}
              </p>
            )}
          </div>

          {/* Rating + price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {rating !== null && (
              <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>
                ★ {rating.toFixed(1)}
                {ratingCount !== null && (
                  <span style={{ color: TEXT3, fontWeight: 400 }}> ({ratingCount.toLocaleString()})</span>
                )}
              </span>
            )}
            {priceLevel !== null && priceLevel in PRICE && (
              <span style={{ fontSize: '0.75rem', color: TEXT3 }}>{PRICE[priceLevel]}</span>
            )}
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, color: catColor,
              background: catColor + '18', borderRadius: 99, padding: '2px 8px',
            }}>
              {categoryLabel}
            </span>
          </div>

          {/* Intel pills — factual only, no AI */}
          {dateAlert && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 99, marginBottom: 8,
              background: dateAlert.type === 'warning' ? 'rgba(234,179,8,.12)' : 'rgba(34,197,94,.1)',
              border: `1px solid ${dateAlert.type === 'warning' ? 'rgba(234,179,8,.3)' : 'rgba(34,197,94,.3)'}`,
              fontSize: '0.7rem', fontWeight: 700,
              color: dateAlert.type === 'warning' ? '#fbbf24' : '#86efac',
            }}>
              {dateAlert.type === 'warning' ? '⚠️' : '✓'} {dateAlert.label}
            </div>
          )}

          {/* Archetype insight — LLM ✦ */}
          <div style={{ marginBottom: 12 }}>
            {insightLoading ? (
              <ShimmerLine width="80%" height={14} />
            ) : insight ? (
              <p style={{ margin: 0, fontSize: '0.78rem', color: TEXT3, fontStyle: 'italic', lineHeight: 1.5 }}>
                <span style={{ color: AI_MARK, marginRight: 4 }}>✦</span>
                {insight}
              </p>
            ) : null}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: expanded ? 16 : 0 }}>
            <button
              onClick={onFavourite}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                background: isFavourited ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.06)',
                border: `1px solid ${isFavourited ? 'rgba(239,68,68,.4)' : BORDER}`,
                color: isFavourited ? '#f87171' : TEXT3,
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {isFavourited ? '❤️ Saved' : '🤍 Save'}
            </button>
            <button
              onClick={onAdd}
              style={{
                flex: 2, padding: '10px 0', borderRadius: 12,
                background: isSelected ? 'rgba(59,130,246,.15)' : ACCENT,
                border: `1px solid ${isSelected ? 'rgba(59,130,246,.4)' : 'transparent'}`,
                color: isSelected ? '#60a5fa' : '#fff',
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {isSelected ? '✓ In itinerary' : '+ Add to itinerary'}
            </button>
            <button
              onClick={() => { onSimilar(); setExpanded(false) }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                background: 'rgba(255,255,255,.06)',
                border: `1px solid ${BORDER}`,
                color: AI_MARK,
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              ✦ Similar
            </button>
          </div>

          {/* Expand toggle */}
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              style={{
                width: '100%', marginTop: 8, padding: '8px 0',
                background: 'transparent', border: 'none',
                color: TEXT3, fontSize: '0.72rem', cursor: 'pointer',
              }}
            >
              More details ↓
            </button>
          )}

          {/* Expanded content */}
          {expanded && (
            <div>
              {/* Local tip — LLM ✦ */}
              {referencePin?.local_tip && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.2)',
                }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: TEXT3, lineHeight: 1.5 }}>
                    <span style={{ color: AI_MARK, marginRight: 4 }}>✦</span>
                    {referencePin.local_tip}
                  </p>
                </div>
              )}

              {/* Links */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    <span className="ms" style={{ fontSize: 14 }}>map</span>
                    Google Maps
                  </a>
                )}
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    <span className="ms" style={{ fontSize: 14 }}>language</span>
                    Website
                  </a>
                )}
              </div>

              <button
                onClick={() => setExpanded(false)}
                style={{
                  width: '100%', marginTop: 12, padding: '8px 0',
                  background: 'transparent', border: 'none',
                  color: TEXT3, fontSize: '0.72rem', cursor: 'pointer',
                }}
              >
                Show less ↑
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const linkStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', gap: 5,
  height: 36, padding: '0 14px', borderRadius: 999,
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.1)',
  fontSize: '0.72rem', fontWeight: 700,
  color: 'rgba(193,198,215,.8)',
  textDecoration: 'none',
  WebkitTapHighlightColor: 'transparent',
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Run full test suite**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run 2>&1 | tail -5
```

Expected: All prior tests still pass (rebuilding PinCard doesn't touch any test files).

- [ ] **Step 5: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/PinCard.tsx
git commit -m "feat(map): rebuild PinCard — 40%/full bottom sheet with new visual design and CTAs"
```

---

## Task 10: Rebuild MapScreen

**Files:**
- Rebuild: `frontend/src/modules/map/MapScreen.tsx`

The new MapScreen:
- Reads `places` (famous), `referencePins` (reference), `selectedPlaces` (user-added) from the `useMap()` hook
- Reads `activePinId`, `mapFilter`, `cityContexts`, `activeCityIndex`, `favouritedPins` from store
- Renders `FamousPinsLayer`, `ReferencePinsLayer`, `UserPinsLayer` as children of `MapLibreMap`
- Shows `PinCard` when `activePinId` is set (looks up the active place from combined lists)
- Shows `FilterBar` with updated chips
- Shows `DiscoveryModeToggle` when a city is loaded
- Shows `SurpriseMeButton` (always visible when city loaded)
- Shows `BuildItineraryBar` when `selectedPlaces.length > 0`
- Removes all references to `TripPlanningCard`, `TravelDateBar`, `FavoritesMarker`, `FavoritesSheet`

- [ ] **Step 1: Read current MapScreen imports to know what to preserve**

```bash
head -35 .worktrees/phase4-map-rebuild/frontend/src/modules/map/MapScreen.tsx
```

Note all imports that are NOT from the deleted files (TripPlanningCard, TravelDateBar, FavoritesLayer). These must be preserved.

- [ ] **Step 2: Write the rebuilt MapScreen**

**Overwrite** `frontend/src/modules/map/MapScreen.tsx` with the following. Replace `/* ... existing search/filter/similar logic ... */` with the retained logic from the old MapScreen that handles search, filter, similar pins, map move — do NOT rewrite that logic, only remove the deleted-component imports and add the new layer/UI components:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter, Category, MapFilterChip } from '../../shared/types';
import { isCurationLocked } from '../../shared/tier';
import { SearchResultRow } from './SearchResultRow';
import { SearchNudge } from './SearchNudge';
import {
  nominatimToCategory,
  multiTypeNominatimSearch,
  extractSearchIntent,
  bboxDiagonalKm,
} from './useSmartSearch';
import type { NominatimResult, SuggestedChip } from './useSmartSearch';
import type { MapHandle } from './MapLibreMap';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { useMapMove } from './useMapMove';
import { MapStatusIndicator } from './MapStatusIndicator';
import { MapLoadingOverlay } from './MapLoadingOverlay';
import { usePlaceDetails } from './usePlaceDetails';
import { useSimilarPins } from './SimilarPins';
import { mapData, api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { MapLibreMap } from './MapLibreMap';
import { JourneyBreadcrumb } from './JourneyBreadcrumb';
import { getJourneyCities, isJourneyMode } from './journey-utils';
import { JourneyStrip } from '../journey';
import { FamousPinsLayer } from './FamousPinsLayer';
import { ReferencePinsLayer } from './ReferencePinsLayer';
import { UserPinsLayer } from './UserPinsLayer';
import { DiscoveryModeToggle } from './DiscoveryModeToggle';
import { SurpriseMeButton } from './SurpriseMeButton';
import { BuildItineraryBar } from './BuildItineraryBar';
import type { DiscoveryMode } from '../../shared/types';

// ── Main screen ─────────────────────────────────────────────────

const PLACEHOLDER_EXAMPLES = [
  'Museums in this area…',
  'Hotels nearby…',
  'Parks to explore…',
  'Restaurants around here…',
  'Historic sites nearby…',
  'Cafes to discover…',
  'Galleries in this area…',
];

export function MapScreen() {
  const {
    city, cityGeo, filteredPlaces, recommendedPlaces, places, selectedPlaces,
    activeFilter, loading, error, activePlace, setActivePlace,
    togglePlace, setFilter, trackViewedCategory, goBack,
  } = useMap();

  const { state, dispatch } = useAppStore();
  const { pendingActivePlace, activePinId, mapFilter, cityContexts, activeCityIndex, favouritedPins } = state;
  const personaProfile = state.personaProfile ?? null;

  // Session cache for PinCard persona insights
  const insightCacheRef = useRef(new Map<string, string>());

  // Guard: if city was lost (fresh tab, cleared session), kick back to destination
  useEffect(() => {
    if (!city) dispatch({ type: 'GO_TO', screen: 'destination' });
  }, [city, dispatch]);

  // Discovery mode for active city
  const activeDiscoveryMode: DiscoveryMode =
    cityContexts[activeCityIndex]?.discoveryMode ?? 'anchor';
  const activeCityDays = cityContexts[activeCityIndex]?.days ?? 0;

  // Handle pending active place (e.g. from search result tap)
  useEffect(() => {
    if (pendingActivePlace) {
      setActivePlace(pendingActivePlace);
      dispatch({ type: 'SET_PENDING_ACTIVE_PLACE', place: null });
    }
  }, [pendingActivePlace, setActivePlace, dispatch]);

  // ── Pin tap handler ────────────────────────────────────────
  // When a pin is tapped, find the corresponding Place and set it as active
  const handlePinClick = useCallback((placeId: string) => {
    const found =
      places.find(p => p.id === placeId) ??
      state.referencePins.find(p => p.id === placeId) ??
      selectedPlaces.find(p => p.id === placeId) ?? null;
    if (found) setActivePlace(found as Place);
    dispatch({ type: 'SET_ACTIVE_PIN_ID', id: placeId });
  }, [places, state.referencePins, selectedPlaces, setActivePlace, dispatch]);

  const handlePinCardClose = useCallback(() => {
    setActivePlace(null);
    dispatch({ type: 'SET_ACTIVE_PIN_ID', id: null });
  }, [setActivePlace, dispatch]);

  // ── Discovery mode change ──────────────────────────────────
  const handleDiscoveryModeChange = useCallback((mode: DiscoveryMode) => {
    dispatch({ type: 'SET_DISCOVERY_MODE', cityIndex: activeCityIndex, mode });
  }, [activeCityIndex, dispatch]);

  // ── Surprise Me ───────────────────────────────────────────
  const handleSurprise = useCallback(async () => {
    if (!city || !personaProfile) return;
    dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
    // API call for surprise itinerary — engine builds full N-day plan
    // Response sets SET_ENGINE_ITINERARY then navigates to route screen
    try {
      const result = await api.post('/api/itinerary/surprise', {
        city,
        days: activeCityDays || 1,
        persona: personaProfile,
      });
      dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: result.data });
      dispatch({ type: 'GO_TO', screen: 'route' });
    } catch {
      // Silence — user sees no error for Surprise Me failures
    }
  }, [city, personaProfile, activeCityDays, dispatch]);

  // ── Build itinerary bar ────────────────────────────────────
  const handleBuildItinerary = useCallback(() => {
    dispatch({ type: 'GO_TO', screen: 'route' });
  }, [dispatch]);

  // ── Map ref + move tracking ────────────────────────────────
  const mapRef = useRef<MapHandle>(null);
  const { onMoveEnd, bbox } = useMapMove(cityGeo);

  // ── Similar pins + highlight ───────────────────────────────
  const { highlightIds } = useSimilarPins(state.similarPinsState, places);

  // ── Search state (preserved from old MapScreen) ───────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestedChips, setSuggestedChips] = useState<SuggestedChip[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const placeholderIdx = useRef(0);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_EXAMPLES[0]);

  useEffect(() => {
    const id = setInterval(() => {
      placeholderIdx.current = (placeholderIdx.current + 1) % PLACEHOLDER_EXAMPLES.length;
      setPlaceholder(PLACEHOLDER_EXAMPLES[placeholderIdx.current]);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // Search handler (preserved from old MapScreen)
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || !cityGeo) { setSearchResults([]); setShowDropdown(false); return; }
    setSuggestedChips(extractSearchIntent(q));
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await multiTypeNominatimSearch(q, cityGeo, bbox);
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, [cityGeo, bbox]);

  const handleSearchResultTap = useCallback((result: NominatimResult) => {
    setShowDropdown(false);
    setSearchQuery('');
    const place: Place = {
      id: result.place_id.toString(),
      title: result.display_name.split(',')[0],
      category: nominatimToCategory(result.type, result.class),
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
    };
    mapRef.current?.flyTo(place.lat, place.lon, 16);
    setActivePlace(place);
    dispatch({ type: 'SET_ACTIVE_PIN_ID', id: place.id });
  }, [setActivePlace, dispatch]);

  // PinCard details
  const { details } = usePlaceDetails(activePlace?.id ?? null);
  const referencePin = activePlace
    ? state.referencePins.find(rp => rp.id === activePlace.id) ?? null
    : null;
  const isFavourited = activePlace
    ? favouritedPins.some(fp => fp.placeId === activePlace.id)
    : false;
  const isSelected = activePlace
    ? selectedPlaces.some(sp => sp.id === activePlace.id)
    : false;

  const travelDate = cityContexts[activeCityIndex]?.startDate ?? null;

  // Journey mode
  const inJourneyMode = isJourneyMode(state);
  const journeyCities = inJourneyMode ? getJourneyCities(state) : [];

  if (!cityGeo) return null;

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%', overflow: 'hidden' }}>
      <MapLoadingOverlay visible={loading} />

      <MapLibreMap
        ref={mapRef}
        center={[cityGeo.lat, cityGeo.lon]}
        zoom={13}
        places={[]}
        selectedPlace={null}
        highlightIds={highlightIds}
        onPlaceClick={() => {}}
        onMoveEnd={onMoveEnd}
      >
        {/* Three simultaneous pin layers */}
        <FamousPinsLayer
          places={places}
          activePlaceId={activePinId}
          discoveryMode={activeDiscoveryMode}
          onPinClick={handlePinClick}
        />
        <ReferencePinsLayer
          pins={state.referencePins}
          activePinId={activePinId}
          onPinClick={handlePinClick}
        />
        <UserPinsLayer
          itineraryPlaces={selectedPlaces}
          favouritedPins={favouritedPins}
          activePinId={activePinId}
          onPinClick={handlePinClick}
        />
      </MapLibreMap>

      {/* Journey breadcrumb strip (multi-city) */}
      {inJourneyMode && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}>
          <JourneyStrip cities={journeyCities} />
        </div>
      )}

      {/* Top search bar */}
      <div style={{
        position: 'absolute', top: inJourneyMode ? 56 : 12,
        left: 12, right: 12, zIndex: 20,
      }}>
        <MapStatusIndicator city={city ?? ''} error={error} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(10,14,23,0.88)', borderRadius: 14,
          padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
        }}>
          <span className="ms" style={{ fontSize: 18, color: 'rgba(193,198,215,0.5)' }}>search</span>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#f1f5f9', fontSize: '0.88rem',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }}
              style={{ background: 'transparent', border: 'none', color: 'rgba(193,198,215,0.5)', cursor: 'pointer' }}
            >
              <span className="ms" style={{ fontSize: 18 }}>close</span>
            </button>
          )}
        </div>
        {showDropdown && searchResults.length > 0 && (
          <div style={{
            marginTop: 6, background: 'rgba(10,14,23,0.95)',
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)', overflow: 'hidden',
          }}>
            {searchResults.slice(0, 5).map(r => (
              <SearchResultRow
                key={r.place_id}
                result={r}
                onClick={() => handleSearchResultTap(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ position: 'absolute', top: inJourneyMode ? 120 : 76, left: 12, right: 12, zIndex: 19 }}>
        <FilterBar
          activeFilter={activeFilter}
          onFilterChange={f => { setFilter(f as MapFilter); trackViewedCategory(f as Category); }}
        />
      </div>

      {/* Discovery mode toggle — bottom-left above SurpriseMe */}
      {city && (
        <div style={{ position: 'absolute', bottom: selectedPlaces.length > 0 ? 100 : 72, left: 12, zIndex: 19 }}>
          <DiscoveryModeToggle
            mode={activeDiscoveryMode}
            onChange={handleDiscoveryModeChange}
          />
        </div>
      )}

      {/* Surprise Me — bottom-right */}
      {city && (
        <div style={{ position: 'absolute', bottom: selectedPlaces.length > 0 ? 100 : 72, right: 12, zIndex: 19 }}>
          <SurpriseMeButton onSurprise={handleSurprise} />
        </div>
      )}

      {/* PinCard */}
      {activePlace && (
        <PinCard
          place={activePlace}
          city={city ?? ''}
          isSelected={isSelected}
          isFavourited={isFavourited}
          onAdd={() => togglePlace(activePlace)}
          onClose={handlePinCardClose}
          onSimilar={() => {
            // Similar pins flow — handled by useSimilarPins hook
          }}
          onFavourite={() => dispatch({ type: 'TOGGLE_FAVOURITE', pin: { placeId: activePlace.id, title: activePlace.title, lat: activePlace.lat, lon: activePlace.lon, category: activePlace.category } })}
          details={details}
          referencePin={referencePin}
          travelDate={travelDate}
          persona={state.persona}
          personaProfile={personaProfile}
          insightCache={insightCacheRef}
        />
      )}

      {/* Build Itinerary bar */}
      <BuildItineraryBar
        itineraryPlaces={selectedPlaces}
        days={activeCityDays}
        onBuild={handleBuildItinerary}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -30
```

Fix any TypeScript errors before proceeding. Common issues:
- `FavouritedPin` interface — check `placeId` vs `id` field name in `favouritedPins.some(fp => fp.placeId === ...)`
- `TOGGLE_FAVOURITE` action payload — check what the existing reducer expects

To find the correct FavouritedPin and TOGGLE_FAVOURITE signature:
```bash
grep -n "TOGGLE_FAVOURITE\|FavouritedPin" .worktrees/phase4-map-rebuild/frontend/src/shared/store.tsx | head -10
grep -n "FavouritedPin" .worktrees/phase4-map-rebuild/frontend/src/shared/types.ts | head -5
```

Adjust the `onFavourite` handler and `isFavourited` check to match the actual type.

- [ ] **Step 4: Run full test suite**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run 2>&1 | tail -5
```

Expected: All prior tests still pass.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/MapScreen.tsx
git commit -m "feat(map): rebuild MapScreen — 3 pin layers, BuildItineraryBar, SurpriseMe, DiscoveryMode"
```

---

## Task 11: Delete old files

**Files:**
- Delete: `frontend/src/modules/map/FavoritesLayer.tsx`
- Delete: `frontend/src/modules/map/favorites-layer.test.ts`
- Delete: `frontend/src/modules/map/TravelDateBar.tsx`
- Delete: `frontend/src/modules/map/TripPlanningCard.tsx`

- [ ] **Step 1: Check nothing imports these files**

```bash
grep -rn "FavoritesLayer\|FavoritesMarker\|FavoritesSheet\|TravelDateBar\|TripPlanningCard" .worktrees/phase4-map-rebuild/frontend/src/ | grep -v ".test."
```

Expected: No output. If there are imports, fix them first (the rebuilt MapScreen no longer imports these).

- [ ] **Step 2: Delete the files**

```bash
rm .worktrees/phase4-map-rebuild/frontend/src/modules/map/FavoritesLayer.tsx
rm .worktrees/phase4-map-rebuild/frontend/src/modules/map/favorites-layer.test.ts
rm .worktrees/phase4-map-rebuild/frontend/src/modules/map/TravelDateBar.tsx
rm .worktrees/phase4-map-rebuild/frontend/src/modules/map/TripPlanningCard.tsx
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Run full test suite**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run 2>&1 | tail -5
```

Expected: Tests pass. Count will be slightly lower than before (favorites-layer.test.ts tests removed — that's expected).

- [ ] **Step 5: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add -A
git commit -m "chore(map): delete FavoritesLayer, TravelDateBar, TripPlanningCard — replaced by new architecture"
```

---

## Task 12: Update index.ts exports

**Files:**
- Modify: `frontend/src/modules/map/index.ts`

- [ ] **Step 1: Read current index.ts**

```bash
cat .worktrees/phase4-map-rebuild/frontend/src/modules/map/index.ts
```

- [ ] **Step 2: Add exports for new components**

Add to `frontend/src/modules/map/index.ts`:

```typescript
export { FamousPinsLayer } from './FamousPinsLayer'
export { ReferencePinsLayer } from './ReferencePinsLayer'
export { UserPinsLayer } from './UserPinsLayer'
export { DiscoveryModeToggle } from './DiscoveryModeToggle'
export { SurpriseMeButton } from './SurpriseMeButton'
export { BuildItineraryBar } from './BuildItineraryBar'
export * from './pin-visual'
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd .worktrees/phase4-map-rebuild && git add frontend/src/modules/map/index.ts
git commit -m "chore(map): export new Phase 4 map components from index"
```

---

## Task 13: Final verification

- [ ] **Step 1: Full test suite**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx vitest run 2>&1 | tail -8
```

Expected: All tests pass, 0 failures.

- [ ] **Step 2: TypeScript clean**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx tsc --noEmit
```

Expected: No output.

- [ ] **Step 3: ESLint clean**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npx eslint src/ 2>&1 | head -30
```

Fix any warnings that are errors. Minor warnings are acceptable.

- [ ] **Step 4: Build passes**

```bash
cd .worktrees/phase4-map-rebuild/frontend && npm run build 2>&1 | tail -10
```

Expected: `built in Xs` with no errors.

- [ ] **Step 5: Announce completion**

Phase 4 implementation complete. Use superpowers:finishing-a-development-branch to complete the work.

---

## Definition of Done

- [ ] All tests passing (`npx vitest run` 0 failures)
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Build clean (`npm run build`)
- [ ] FamousPinsLayer, ReferencePinsLayer, UserPinsLayer wired in MapScreen
- [ ] PinCard rebuilt with 40%/full sheet, 3 CTAs (Save/Add/Similar)
- [ ] DiscoveryModeToggle, SurpriseMeButton, BuildItineraryBar present on map
- [ ] FavoritesLayer.tsx, TravelDateBar.tsx, TripPlanningCard.tsx deleted
- [ ] All changes committed to `feature/phase4-map-rebuild`
