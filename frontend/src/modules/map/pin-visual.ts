import type { DiscoveryMode } from '../../shared/types'

// ── Unified pin design (v2) — matches map-pins-understood.html proto ──────────
export const UNIFIED_PIN_BG        = 'rgba(18,19,24,0.94)'
export const UNIFIED_PIN_BORDER    = '1px solid rgba(242,237,230,0.16)'
export const UNIFIED_PIN_SHADOW    = '0 7px 18px rgba(0,0,0,0.55)'
export const UNIFIED_PIN_SIZE      = 38
export const UNIFIED_ICON_SIZE     = 19
export const UNIFIED_ICON_COLOR    = '#e8e2d8'
export const CURATED_SPARKLE_COLOR = '#d4a853'

// Mood badge: category → { color, Material Symbols Rounded icon }
export const CATEGORY_MOOD: Record<string, { c: string; icon: string }> = {
  restaurant:    { c: '#d8a35e', icon: 'local_fire_department' },
  cafe:          { c: '#d8a35e', icon: 'local_fire_department' },
  bakery:        { c: '#d8a35e', icon: 'local_fire_department' },
  bar:           { c: '#d98aa6', icon: 'celebration' },
  nightlife:     { c: '#d98aa6', icon: 'celebration' },
  market:        { c: '#d98aa6', icon: 'celebration' },
  park:          { c: '#6aa6e0', icon: 'open_in_full' },
  beach:         { c: '#6aa6e0', icon: 'open_in_full' },
  museum:        { c: '#8f9ce0', icon: 'menu_book' },
  historic:      { c: '#8f9ce0', icon: 'menu_book' },
  gallery:       { c: '#8f9ce0', icon: 'menu_book' },
  library:       { c: '#8f9ce0', icon: 'menu_book' },
  spiritual:     { c: '#6fb3a2', icon: 'eco' },
  spa:           { c: '#6fb3a2', icon: 'eco' },
  viewpoint:     { c: '#d4a853', icon: 'star' },
  tourism:       { c: '#d4a853', icon: 'star' },
  // seed_builder types
  coffee:        { c: '#d8a35e', icon: 'local_fire_department' },
  lunch:         { c: '#d8a35e', icon: 'local_fire_department' },
  dinner:        { c: '#d98aa6', icon: 'celebration' },
  breakfast:     { c: '#d8a35e', icon: 'local_fire_department' },
  scenic_walk:   { c: '#6aa6e0', icon: 'open_in_full' },
  rest:          { c: '#6fb3a2', icon: 'eco' },
  micro:         { c: '#d4a853', icon: 'star' },
}
export const DEFAULT_MOOD = { c: '#ad8fd4', icon: 'bolt' }

// Per-place badge → mood (OurPicks: badge field drives mood, not just category)
export const BADGE_MOOD: Record<string, { c: string; icon: string }> = {
  trending:     { c: '#e0a93f', icon: 'local_fire_department' },
  hidden_gem:   { c: '#ad8fd4', icon: 'bolt' },
  getting_busy: { c: '#d98aa6', icon: 'celebration' },
}

// ── Famous pin layer ─────────────────────────────────────────
export const FAMOUS_PIN_SIZE   = 28
export const FAMOUS_STAR_ICON  = 'star'

/** @deprecated use UNIFIED_PIN_BG */
export const FAMOUS_PIN_COLOR_DARK  = '#1e3a5f'
/** @deprecated use UNIFIED_PIN_BG */
export const FAMOUS_PIN_COLOR_LIGHT = '#334155'
/** @deprecated use UNIFIED_PIN_BG */
export function getFamousPinColor(_isDark: boolean): string {
  return UNIFIED_PIN_BG
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
export const PICKS_PIN_SIZE     = 26
export const PICKS_PIN_BG       = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
export const PICKS_PIN_BORDER   = '2px solid rgba(255,255,255,0.85)'
export const TRENDING_PIN_COLOR = '#f59e0b'
export const OFFBEAT_PIN_BG     = 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
export const OFFBEAT_PIN_COLOR  = '#14b8a6'

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
