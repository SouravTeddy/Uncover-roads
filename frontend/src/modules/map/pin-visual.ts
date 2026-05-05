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

export function getUserPinStyle({ saved, inItinerary }: PinFlags): UserPinStyle {
  const border = inItinerary
    ? `2px solid ${ITINERARY_RING_COLOR}`
    : '2px solid rgba(255,255,255,0.85)'
  return { border, showSavedBadge: saved }
}
