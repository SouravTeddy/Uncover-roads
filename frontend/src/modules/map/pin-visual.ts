import type { DiscoveryMode } from '../../shared/types'

// ── Famous pin layer ─────────────────────────────────────────
// Theme-aware: dark map gets a deep navy, light map gets charcoal slate
export const FAMOUS_PIN_COLOR_DARK  = '#1e3a5f'
export const FAMOUS_PIN_COLOR_LIGHT = '#334155'
export const FAMOUS_PIN_SIZE   = 28
export const FAMOUS_STAR_ICON  = 'star'   // Material Symbol name

export function getFamousPinColor(isDark: boolean): string {
  return isDark ? FAMOUS_PIN_COLOR_DARK : FAMOUS_PIN_COLOR_LIGHT
}

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

// ── Our Picks pin layer ──────────────────────────────────────
export const PICKS_PIN_SIZE    = 26
export const PICKS_PIN_BG      = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
export const PICKS_PIN_BORDER  = '2px solid rgba(255,255,255,0.85)'

// ── Live Event pin layer ─────────────────────────────────────
export const EVENT_PIN_COLOR   = '#7c3aed'
export const EVENT_PIN_SIZE    = 26
export const EVENT_PIN_ICON    = 'calendar_month'

// ── Numbered search result pins ──────────────────────────────
export const SEARCH_PIN_BG     = '#3b82f6'
export const SEARCH_PIN_SIZE   = 24

// ── Badge pill colours ───────────────────────────────────────
export const BADGE_COLORS: Record<string, string> = {
  trending:     '#f59e0b',
  hidden_gem:   '#14b8a6',
  getting_busy: '#f97316',
  live_event:   '#7c3aed',
}
