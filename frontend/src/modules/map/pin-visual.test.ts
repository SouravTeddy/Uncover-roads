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
