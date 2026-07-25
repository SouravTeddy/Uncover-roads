# Trending & Offbeat Pins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface trending and offbeat places as visually distinct map pins, add matching description blocks to the place card, and gate trending insights behind a 3-free-view counter for non-Pro users.

**Architecture:** The backend already returns `badge` (`trending | hidden_gem | getting_busy | null`) and `badge_reason` per pick from `/api/cities/picks`. All changes are purely display-layer: differentiate `OurPicksPinsLayer` pin visuals by badge, add two new description blocks inside `PinCard`, and fix the curated tab to hide regular `FamousPinsLayer` pins. Free-tier gate is a localStorage counter checked and incremented inside `PinCard`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + Testing Library, MapLibre, Material Symbols icons.

**Constraint:** Do NOT modify `ob-conflict-map.ts`, `ob-resolver.ts`, or any engine logic file.

---

## File Map

| File | Change |
|---|---|
| `frontend/src/modules/map/pin-visual.ts` | Add `OFFBEAT_PIN_BG` (teal gradient) constant |
| `frontend/src/modules/map/OurPicksPinsLayer.tsx` | Use badge-specific background + icon for each pin |
| `frontend/src/modules/map/OurPicksPinsLayer.test.tsx` | Extend tests to cover new visuals |
| `frontend/src/modules/map/MapScreen.tsx` | (1) Hide FamousPinsLayer on curated tab; (2) pass `badgeReason` to PinCard |
| `frontend/src/modules/map/PinCard.tsx` | Add `badgeReason` + `userTier` props; render TrendingBlock / OffbeatBlock; free-gate |
| `frontend/src/modules/map/PinCard.test.tsx` | New test file — trending block, offbeat block, lock UI |

---

## Task 1: Add teal gradient constant + update pin visuals

**Files:**
- Modify: `frontend/src/modules/map/pin-visual.ts`
- Modify: `frontend/src/modules/map/OurPicksPinsLayer.tsx`
- Modify: `frontend/src/modules/map/OurPicksPinsLayer.test.tsx`

### What this achieves
Trending pins → amber fire gradient + `local_fire_department` icon  
Hidden-gem pins → teal gradient + `explore` icon  
Getting-busy pins → orange gradient + category icon (existing behaviour)  
No-badge picks → amber gradient + category icon (existing behaviour)

---

- [ ] **Step 1.1: Add teal constant to pin-visual.ts**

In `frontend/src/modules/map/pin-visual.ts`, after the `PICKS_PIN_BORDER` line (currently ~line 53), add:

```ts
export const OFFBEAT_PIN_BG    = 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
export const OFFBEAT_PIN_COLOR = '#14b8a6'
export const TRENDING_PIN_BG   = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'  // same as PICKS_PIN_BG — alias for clarity
export const TRENDING_PIN_COLOR = '#f59e0b'
```

- [ ] **Step 1.2: Update OurPicksPinsLayer to use badge-specific visuals**

Replace the body of `OurPicksPinsLayer.tsx` with the following (keep the same imports at top, just add the new constants):

```tsx
import { Marker } from 'react-map-gl/maplibre'
import {
  PICKS_PIN_SIZE, PICKS_PIN_BG, BADGE_COLORS,
  OFFBEAT_PIN_BG, OFFBEAT_PIN_COLOR, TRENDING_PIN_COLOR,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

export interface PlacePickFE {
  place_id: string
  name: string
  lat: number
  lon: number
  category: string
  rating: number | null
  stage: string
  badge: 'trending' | 'hidden_gem' | 'getting_busy' | null
  badge_reason: string | null
}

const BADGE_SYMBOL: Record<string, string> = {
  trending:     '↑',
  hidden_gem:   '✦',
  getting_busy: '!',
}

function pinBackground(badge: PlacePickFE['badge']): string {
  if (badge === 'hidden_gem') return OFFBEAT_PIN_BG
  return PICKS_PIN_BG  // trending, getting_busy, null all use amber
}

function pinIcon(badge: PlacePickFE['badge'], category: string): string {
  if (badge === 'trending') return 'local_fire_department'
  if (badge === 'hidden_gem') return 'explore'
  return CATEGORY_ICONS[category] ?? 'place'
}

function pinGlow(badge: PlacePickFE['badge']): string {
  if (badge === 'hidden_gem') return `0 2px 14px ${OFFBEAT_PIN_COLOR}80`
  if (badge === 'trending') return `0 2px 14px ${TRENDING_PIN_COLOR}99`
  return '0 2px 8px rgba(0,0,0,0.4)'
}

interface Props {
  picks: PlacePickFE[]
  activePinId: string | null
  onPinClick: (placeId: string) => void
}

export function OurPicksPinsLayer({ picks, activePinId, onPinClick }: Props) {
  return (
    <>
      {picks.map((pick) => {
        const isActive = activePinId === pick.place_id
        const size = isActive ? PICKS_PIN_SIZE + 4 : PICKS_PIN_SIZE
        const badgeColor = pick.badge ? BADGE_COLORS[pick.badge] : null
        const icon = pinIcon(pick.badge, pick.category)
        const bg   = pinBackground(pick.badge)
        const glow = pinGlow(pick.badge)

        return (
          <Marker
            key={pick.place_id}
            latitude={pick.lat}
            longitude={pick.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(pick.place_id)
            }}
          >
            <div style={{ position: 'relative', width: size, height: size }}>
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: bg,
                  border: '2px solid rgba(255,255,255,0.85)',
                  boxShadow: glow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: isActive ? 1 : 0.92,
                }}
              >
                <span className="ms fill" style={{ fontSize: size * 0.45, color: '#fff', lineHeight: 1 }}>
                  {icon}
                </span>
              </div>
              {pick.badge && badgeColor && (
                <div
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: badgeColor,
                    border: '1.5px solid rgba(10,14,23,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#fff',
                    padding: '0 3px',
                  }}
                >
                  {BADGE_SYMBOL[pick.badge] ?? ''}
                </div>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
}
```

- [ ] **Step 1.3: Update OurPicksPinsLayer tests**

Replace `frontend/src/modules/map/OurPicksPinsLayer.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OurPicksPinsLayer } from './OurPicksPinsLayer'

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children, latitude, longitude }: any) => (
    <div data-testid="marker" data-lat={latitude} data-lon={longitude}>{children}</div>
  ),
}))

const picks = [
  { place_id: 'p1', name: 'Blue Note', lat: 35.67, lon: 139.65, category: 'event', rating: 4.5, stage: 'rising', badge: 'trending' as const, badge_reason: 'Reviews up 3x' },
  { place_id: 'p2', name: 'Hidden Ramen', lat: 35.68, lon: 139.66, category: 'restaurant', rating: 4.8, stage: 'hidden_gem', badge: 'hidden_gem' as const, badge_reason: 'Off the trail' },
]

describe('OurPicksPinsLayer', () => {
  it('renders one marker per pick', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
  })

  it('renders fire icon for trending badge', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getByText('local_fire_department')).toBeTruthy()
  })

  it('renders explore icon for hidden_gem badge', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getByText('explore')).toBeTruthy()
  })

  it('renders badge symbol for trending', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getByText('↑')).toBeTruthy()
  })

  it('renders badge symbol for hidden_gem', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getByText('✦')).toBeTruthy()
  })
})
```

- [ ] **Step 1.4: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/OurPicksPinsLayer.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add frontend/src/modules/map/pin-visual.ts \
        frontend/src/modules/map/OurPicksPinsLayer.tsx \
        frontend/src/modules/map/OurPicksPinsLayer.test.tsx
git commit -m "feat(map): differentiate trending/offbeat pin visuals by badge type"
```

---

## Task 2: Fix curated tab — hide regular pins + pass badgeReason

**Files:**
- Modify: `frontend/src/modules/map/MapScreen.tsx`

### What this achieves
- Curated tab shows only `OurPicksPinsLayer` + `LiveEventPinsLayer` + `RecoPlacesPinsLayer` (no regular blue pins)
- `PinCard` receives `badgeReason` string when a pick is open

---

- [ ] **Step 2.1: Wrap FamousPinsLayer in activeFilter guard**

In `MapScreen.tsx`, find the `<FamousPinsLayer` block (currently ~line 534). Wrap it so it only renders when NOT on curated tab:

```tsx
{activeFilter !== 'curated' && (
  <FamousPinsLayer
    places={filteredPlaces.filter(p =>
      !selectedIds.has(p.id) &&
      !ourPicks.some(pick =>
        pick.place_id === p.id ||
        pick.place_id === p.place_id ||
        pick.name.toLowerCase() === p.title.toLowerCase()
      )
    )}
    activePlaceId={activePinId}
    discoveryMode="anchor"
    isDark={isDark}
    onPinClick={handlePinClick}
  />
)}
```

- [ ] **Step 2.2: Derive activeOurPickBadgeReason alongside activeOurPickBadge**

Find this block (~line 498):
```tsx
const activeOurPickBadge = activePlace
  ? (ourPicks.find(p => p.place_id === activePlace.id)?.badge ?? null)
  : null
```

Replace with:
```tsx
const activeOurPickMatch = activePlace
  ? ourPicks.find(p => p.place_id === activePlace.id) ?? null
  : null
const activeOurPickBadge = activeOurPickMatch?.badge ?? null
const activeOurPickBadgeReason = activeOurPickMatch?.badge_reason ?? null
```

- [ ] **Step 2.3: Pass badgeReason and userTier to PinCard**

Find the `<PinCard` JSX (~line 560+). Add two props:

```tsx
<PinCard
  place={activePlace}
  city={city ?? ''}
  isSelected={selectedIds.has(activePlace.id)}
  isFavourited={isFavourited}
  onAdd={() => handlePlaceAdd(activePlace)}
  onClose={handlePinCardClose}
  onFavourite={() => handleFavourite(activePlace)}
  details={details}
  travelDate={state.tripContext?.date ?? null}
  travelStartDate={state.travelStartDate}
  travelEndDate={state.travelEndDate}
  ourPickBadge={activeOurPickBadge}
  badgeReason={activeOurPickBadgeReason}
  userTier={state.userTier}
/>
```

- [ ] **Step 2.4: Verify app compiles — TypeScript will error on unknown props until Task 3**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | grep "PinCard\|badgeReason\|userTier" | head -10
```

Expected: errors about `badgeReason` and `userTier` not existing on PinCard Props — this is expected. Proceed to Task 3.

- [ ] **Step 2.5: Commit (after Task 3 makes it compile — hold this commit)**

_(combine with Task 3 commit)_

---

## Task 3: Add trending block, offbeat block, and free-gate to PinCard

**Files:**
- Modify: `frontend/src/modules/map/PinCard.tsx`
- Create: `frontend/src/modules/map/PinCard.test.tsx`

### What this achieves
- When `ourPickBadge === 'trending'` and free gate allows: show fire-themed description block above analysis strip
- When `ourPickBadge === 'hidden_gem'`: show teal description block
- When `ourPickBadge === 'trending'` and free gate blocked + user is not Pro: show lock UI; grey out Add button
- `badgeReason` from the API populates the first row if present; fallback content fills remaining rows
- Hero shows a badge pill (Trending now / Hidden gem) top-left

---

- [ ] **Step 3.1: Add badgeReason and userTier to PinCard Props**

In `PinCard.tsx`, find the `interface Props` block and add two optional props:

```tsx
interface Props {
  place: Place
  city: string
  isSelected: boolean
  isFavourited: boolean
  onAdd: () => void
  onClose: () => void
  onFavourite: () => void
  details?: PlaceDetails | null
  travelDate?: string | null
  travelStartDate?: string | null
  travelEndDate?: string | null
  ourPickBadge?: OurPickBadge
  badgeReason?: string | null      // ← new
  userTier?: 'free' | 'pack' | 'pro'  // ← new
}
```

Update the destructuring in the function signature:

```tsx
export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onFavourite,
  details, travelDate, travelStartDate, travelEndDate,
  ourPickBadge = null,
  badgeReason = null,
  userTier = 'free',
}: Props) {
```

- [ ] **Step 3.2: Add free-gate logic using localStorage**

After the existing `const insights = ...` line, add:

```tsx
// Free-gate: trending insights locked after 3 views for non-Pro
const TRENDING_VIEW_KEY = 'ur_trending_views'
const trendingLocked = useMemo(() => {
  if (ourPickBadge !== 'trending') return false
  if (userTier === 'pro') return false
  const count = parseInt(localStorage.getItem(TRENDING_VIEW_KEY) ?? '0', 10)
  return count >= 3
}, [ourPickBadge, userTier])

// Increment counter once when a trending card is opened (not when locked)
useEffect(() => {
  if (ourPickBadge !== 'trending' || trendingLocked || userTier === 'pro') return
  const count = parseInt(localStorage.getItem(TRENDING_VIEW_KEY) ?? '0', 10)
  localStorage.setItem(TRENDING_VIEW_KEY, String(count + 1))
}, [ourPickBadge]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3.3: Add hero badge pill**

In the hero section, after the heart button, add a badge pill for trending/hidden_gem:

```tsx
{/* Hero badge — trending or hidden gem */}
{ourPickBadge === 'trending' && (
  <div style={{
    position: 'absolute', top: 12, left: 12, zIndex: 6,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 9px', borderRadius: 7,
    background: 'rgba(245,158,11,.28)', border: '1px solid rgba(245,158,11,.45)',
    backdropFilter: 'blur(6px)', fontSize: 10, fontWeight: 700, color: '#f59e0b',
  }}>
    <span className="ms fill" style={{ fontSize: 10 }}>trending_up</span>
    Trending now
  </div>
)}
{ourPickBadge === 'hidden_gem' && (
  <div style={{
    position: 'absolute', top: 12, left: 12, zIndex: 6,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 9px', borderRadius: 7,
    background: 'rgba(20,184,166,.25)', border: '1px solid rgba(20,184,166,.4)',
    backdropFilter: 'blur(6px)', fontSize: 10, fontWeight: 700, color: '#14b8a6',
  }}>
    <span className="ms fill" style={{ fontSize: 10 }}>diamond</span>
    Hidden gem
  </div>
)}
```

- [ ] **Step 3.4: Add trending block, offbeat block, and lock UI to sheet body**

In the sheet body, after the `meta chips` block and before the `analysis-strip`, add:

```tsx
{/* ── Trending description block ── */}
{ourPickBadge === 'trending' && !trendingLocked && (
  <div style={{
    position: 'relative', overflow: 'hidden',
    background: '#160f00',
    border: '1px solid rgba(245,158,11,.3)',
    borderRadius: 12, padding: '12px 12px 12px 14px', marginBottom: 14,
  }}>
    {/* Left accent bar */}
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,#f59e0b,#d97706)', borderRadius: '12px 0 0 12px' }} />
    {/* Ambient glow */}
    <div style={{ position: 'absolute', top: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,.18),transparent 70%)', pointerEvents: 'none' }} />
    {/* Header with pulse dot */}
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 8, position: 'relative' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'trendPulse 1.8s infinite', flexShrink: 0 }} />
      What's happening here
    </div>
    {/* Badge reason row — first if present */}
    {badgeReason && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(245,158,11,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <span className="ms fill" style={{ fontSize: 12, color: '#f59e0b' }}>trending_up</span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>{badgeReason}</span>
      </div>
    )}
    {/* Fallback rows */}
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(245,158,11,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <span className="ms fill" style={{ fontSize: 12, color: '#f59e0b' }}>groups</span>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>People are visiting this <strong style={{ color: '#f5f0ea' }}>significantly more</strong> than a few months ago</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(245,158,11,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <span className="ms fill" style={{ fontSize: 12, color: '#f59e0b' }}>videocam</span>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>Showing up in recent <strong style={{ color: '#f5f0ea' }}>travel content</strong> for this area</span>
    </div>
  </div>
)}

{/* ── Offbeat / hidden gem block ── */}
{ourPickBadge === 'hidden_gem' && (
  <div style={{
    position: 'relative', overflow: 'hidden',
    background: '#001412',
    border: '1px solid rgba(20,184,166,.28)',
    borderRadius: 12, padding: '12px 12px 12px 14px', marginBottom: 14,
  }}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,#14b8a6,#0d9488)', borderRadius: '12px 0 0 12px' }} />
    <div style={{ position: 'absolute', top: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(20,184,166,.15),transparent 70%)', pointerEvents: 'none' }} />
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#14b8a6', marginBottom: 8, position: 'relative' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6', animation: 'offbeatPulse 1.8s infinite', flexShrink: 0 }} />
      Why this is offbeat
    </div>
    {badgeReason && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(20,184,166,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <span className="ms fill" style={{ fontSize: 12, color: '#14b8a6' }}>explore</span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>{badgeReason}</span>
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(20,184,166,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <span className="ms fill" style={{ fontSize: 12, color: '#14b8a6' }}>people</span>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}><strong style={{ color: '#f5f0ea' }}>Most visitors skip this</strong> — it sees a fraction of the foot traffic of similar spots</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(20,184,166,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <span className="ms fill" style={{ fontSize: 12, color: '#14b8a6' }}>photo_camera</span>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>Rarely photographed — most angles here are still <strong style={{ color: '#f5f0ea' }}>undiscovered</strong></span>
    </div>
  </div>
)}

{/* ── Trending locked (free gate) ── */}
{ourPickBadge === 'trending' && trendingLocked && (
  <div style={{
    background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
    borderRadius: 12, padding: 14, marginBottom: 14,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
  }}>
    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(245,158,11,.13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="ms fill" style={{ fontSize: 18, color: '#f59e0b' }}>lock</span>
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)' }}>Trending insights are Pro</div>
    <div style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.55 }}>Go Pro to see what's driving the buzz on every trending place.</div>
    <button
      style={{
        width: '100%', padding: 9,
        background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dk))',
        border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
        color: '#1a1200', cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}
    >
      Go Pro · $9.99/mo
    </button>
  </div>
)}
```

- [ ] **Step 3.5: Add CSS keyframes for pulse animations**

At the very top of the JSX return (before the backdrop div), add a `<style>` tag:

```tsx
<style>{`
  @keyframes trendPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); }
    50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
  }
  @keyframes offbeatPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(20,184,166,.5); }
    50%      { box-shadow: 0 0 0 5px rgba(20,184,166,0); }
  }
  @keyframes sweep {
    0%   { left: -38%; }
    100% { left: 100%; }
  }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes sectionReveal {
    from { opacity:0; transform:translateY(4px) }
    to   { opacity:1; transform:translateY(0) }
  }
`}</style>
```

(The `sweep`, `fadeIn`, and `sectionReveal` animations are already used in PinCard — this consolidates them. If they already exist as a `<style>` tag in the file, add only the two new keyframes to it.)

- [ ] **Step 3.6: Grey out Add button when trending locked**

Find the CTA button at the bottom of the sheet body. Update the condition:

```tsx
<button
  onClick={onAdd}
  style={{
    width: '100%', padding: '13px 0', borderRadius: 14,
    border: isSelected
      ? '1px solid rgba(212,168,83,.35)'
      : trendingLocked ? '1px solid var(--color-border)' : 'none',
    cursor: trendingLocked ? 'default' : 'pointer',
    fontSize: '0.9rem', fontWeight: 700,
    background: isSelected
      ? 'transparent'
      : trendingLocked
      ? 'var(--color-surface2)'
      : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
    color: isSelected
      ? 'var(--color-primary)'
      : trendingLocked
      ? 'var(--color-text-3)'
      : '#0f0d0c',
    opacity: trendingLocked ? 0.35 : 1,
    boxShadow: isSelected || trendingLocked ? 'none' : '0 6px 28px rgba(212,168,83,.25)',
    transition: 'all 0.15s ease',
    pointerEvents: trendingLocked ? 'none' : 'auto',
  }}
>
  {isSelected ? '✓ In itinerary' : '+ Add to itinerary'}
</button>
```

- [ ] **Step 3.7: Write PinCard tests**

Create `frontend/src/modules/map/PinCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PinCard } from './PinCard'
import type { Place } from '../../shared/types'

vi.mock('../../shared/api', () => ({
  getPlacePhotoUrl: () => 'https://example.com/photo.jpg',
  api: { placeImage: () => Promise.resolve(null) },
}))
vi.mock('../../shared/useSheetDismiss', () => ({ useSheetDismiss: () => {} }))
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: { div: ({ children, ...p }: any) => <div {...p}>{children}</div> },
}))

const basePlace: Place = {
  id: 'p1', title: 'Test Cafe', category: 'cafe',
  lat: 35.67, lon: 139.65,
}
const baseDetails = {
  rating: 4.5, rating_count: 100, address: '1 Main St',
  weekday_text: [], price_level: 1, phone: null, website: null,
  editorial_summary: 'A nice cafe', photo_ref: null, photo_refs: [],
  open_now: true,
}

function renderCard(overrides: Partial<Parameters<typeof PinCard>[0]> = {}) {
  return render(
    <PinCard
      place={basePlace}
      city="Tokyo"
      isSelected={false}
      isFavourited={false}
      onAdd={vi.fn()}
      onClose={vi.fn()}
      onFavourite={vi.fn()}
      details={baseDetails as any}
      {...overrides}
    />
  )
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('PinCard — trending block', () => {
  it('shows trending block for trending badge when under limit', () => {
    renderCard({ ourPickBadge: 'trending', userTier: 'free' })
    expect(screen.getByText("What's happening here")).toBeTruthy()
  })

  it('shows lock UI after 3 views for free user', () => {
    localStorage.setItem('ur_trending_views', '3')
    renderCard({ ourPickBadge: 'trending', userTier: 'free' })
    expect(screen.getByText('Trending insights are Pro')).toBeTruthy()
  })

  it('does NOT lock for pro user even after 3 views', () => {
    localStorage.setItem('ur_trending_views', '5')
    renderCard({ ourPickBadge: 'trending', userTier: 'pro' })
    expect(screen.getByText("What's happening here")).toBeTruthy()
    expect(screen.queryByText('Trending insights are Pro')).toBeNull()
  })

  it('shows badgeReason when provided', () => {
    renderCard({ ourPickBadge: 'trending', userTier: 'free', badgeReason: 'Reviews up 3x this month' })
    expect(screen.getByText('Reviews up 3x this month')).toBeTruthy()
  })

  it('shows Trending now hero badge', () => {
    renderCard({ ourPickBadge: 'trending', userTier: 'free' })
    expect(screen.getByText('Trending now')).toBeTruthy()
  })
})

describe('PinCard — offbeat block', () => {
  it('shows offbeat block for hidden_gem badge', () => {
    renderCard({ ourPickBadge: 'hidden_gem', userTier: 'free' })
    expect(screen.getByText('Why this is offbeat')).toBeTruthy()
  })

  it('shows Hidden gem hero badge', () => {
    renderCard({ ourPickBadge: 'hidden_gem', userTier: 'free' })
    expect(screen.getByText('Hidden gem')).toBeTruthy()
  })

  it('never locks offbeat block', () => {
    localStorage.setItem('ur_trending_views', '99')
    renderCard({ ourPickBadge: 'hidden_gem', userTier: 'free' })
    expect(screen.getByText('Why this is offbeat')).toBeTruthy()
    expect(screen.queryByText('Trending insights are Pro')).toBeNull()
  })
})
```

- [ ] **Step 3.8: Run tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/PinCard.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 3.9: TypeScript check**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | grep -i error | head -20
```

Expected: 0 errors.

- [ ] **Step 3.10: Commit**

```bash
git add frontend/src/modules/map/MapScreen.tsx \
        frontend/src/modules/map/PinCard.tsx \
        frontend/src/modules/map/PinCard.test.tsx
git commit -m "feat(map): trending/offbeat description blocks + free tier gate in PinCard"
```

---

## Task 4: Full test suite + dev server smoke test

**Files:** No new files — just verification

- [ ] **Step 4.1: Run all map tests**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run src/modules/map/
```

Expected: all existing tests pass, new tests pass, no regressions.

- [ ] **Step 4.2: Run the full test suite**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx vitest run
```

Expected: all tests pass. Any pre-existing failures are pre-existing — do not count as regressions.

- [ ] **Step 4.3: TypeScript check (full)**

```bash
cd /Users/souravbiswas/uncover-roads/frontend
npx tsc --noEmit 2>&1 | grep -i error
```

Expected: 0 errors.

- [ ] **Step 4.4: Dev server smoke test**

Start the dev server:
```bash
cd /Users/souravbiswas/uncover-roads/frontend
npm run dev
```

Open `http://localhost:5200`. Verify:
1. All tab — map loads normally, blue pins visible for regular places
2. Curated tab — only amber/teal/purple pins from `/api/cities/picks`, no blue regular pins
3. Tap a trending (fire) pin → place card opens with fire-colored "Trending now" badge on hero and "What's happening here" block
4. Tap a hidden_gem (teal) pin → "Hidden gem" badge + "Why this is offbeat" block
5. Tap trending pin 4 times — 4th tap shows lock UI, Add button greyed
6. Pro tier user never sees lock (verify by setting `userTier: 'pro'` in store devtools or temporarily hardcoding in test)

- [ ] **Step 4.5: Commit**

```bash
git add -A
git commit -m "feat(map): trending/offbeat pins — display layer complete"
```

---

## What is NOT in this plan

The following were discussed but are deferred — they require backend work or a separate planning session:
- **On-demand seeding** (YouTube/Reddit/Google Places API calls at city select time) — backend pipeline
- **Push notifications** (1–2 weeks post-seed, opens itinerary reel) — backend + push infra  
- **Reel reco cards for trending places** — separate reel feature plan
- **Itinerary freshness alerts** — separate feature plan
- **Eventbrite integration** — separate feature plan

These deferred items do not block the display-layer changes in this plan.
