import { describe, it, expect } from 'vitest'
import { computeAreaText, computeBuildReadinessText, isGeographicCluster } from './useGuideMessages'
import type { Place, Persona } from '../../shared/types'

function makePlace(overrides: Partial<Place> & { id: string }): Place {
  return { title: 'Place', category: 'cafe', lat: 35.68, lon: 139.69, ...overrides }
}

function makePersona(venueFilters: string[]): Persona {
  return {
    archetype: 'historian',
    archetype_name: 'Historian',
    archetype_desc: 'Loves historic sites.',
    ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null,
    archetypeData: { name: 'Historian', desc: '', venue_filters: venueFilters, itinerary_bias: [] },
    venue_filters: venueFilters,
    itinerary_bias: [],
  } as unknown as Persona
}

// ── computeAreaText ───────────────────────────────────────────────────────────

describe('computeAreaText', () => {
  it('mentions the city name', () => {
    const persona = makePersona(['museum', 'historic'])
    const places = [makePlace({ id: '1', category: 'museum' })]
    const text = computeAreaText('Tokyo', persona, places)
    expect(text).toContain('Tokyo')
  })

  it('counts matching pins and uses readable category label', () => {
    const persona = makePersona(['museum', 'historic'])
    const places = [
      makePlace({ id: '1', category: 'museum' }),
      makePlace({ id: '2', category: 'museum' }),
      makePlace({ id: '3', category: 'historic' }),
    ]
    const text = computeAreaText('Paris', persona, places)
    expect(text).toContain('3')
    expect(text).toContain('museums')
  })

  it('combines top 2 categories when within 20% of each other', () => {
    const persona = makePersona(['museum', 'historic'])
    const places = [
      makePlace({ id: '1', category: 'museum' }),
      makePlace({ id: '2', category: 'museum' }),
      makePlace({ id: '3', category: 'historic' }),
      makePlace({ id: '4', category: 'historic' }),
    ]
    const text = computeAreaText('Paris', persona, places)
    expect(text).toContain('museums')
    expect(text).toContain('historic sites')
  })

  it('uses neutral fallback when no pins match persona', () => {
    const persona = makePersona(['museum'])
    const places = [makePlace({ id: '1', category: 'park' })]
    const text = computeAreaText('Berlin', persona, places)
    expect(text).toContain('Berlin')
    expect(text).toContain('1')
    expect(text).not.toContain('museums')
  })

  it('mentions "based on your interests"', () => {
    const persona = makePersona(['cafe'])
    const places = [makePlace({ id: '1', category: 'cafe' })]
    const text = computeAreaText('Lisbon', persona, places)
    expect(text).toContain('based on your interests')
  })
})

// ── computeBuildReadinessText ─────────────────────────────────────────────────

describe('computeBuildReadinessText', () => {
  it('returns null when count < 80% threshold', () => {
    // 3 days × 4 stops × 0.8 = 9.6 → threshold = 9; count = 5
    expect(computeBuildReadinessText(5, 3, 4)).toBeNull()
  })

  it('returns null when count < 2', () => {
    expect(computeBuildReadinessText(1, 1, 2)).toBeNull()
  })

  it('returns null when days = 0', () => {
    expect(computeBuildReadinessText(5, 0, 3)).toBeNull()
  })

  it('returns message containing day count when threshold met', () => {
    // 2 days × 3 stops × 0.8 = 4.8 → threshold = 4; count = 4
    const text = computeBuildReadinessText(4, 2, 3)
    expect(text).not.toBeNull()
    expect(text).toContain('2 days')
    expect(text).toContain('ready to build')
  })

  it('uses singular "day" for 1-day trip', () => {
    // 1 day × 3 stops × 0.8 = 2.4 → threshold = 2; count = 2
    const text = computeBuildReadinessText(2, 1, 3)
    expect(text).toContain('1 day')
    expect(text).not.toContain('days')
  })
})

// ── isGeographicCluster ───────────────────────────────────────────────────────

describe('isGeographicCluster', () => {
  it('returns false when fewer than 3 places', () => {
    const places = [
      makePlace({ id: '1', lat: 48.856, lon: 2.352 }),
      makePlace({ id: '2', lat: 48.857, lon: 2.353 }),
    ]
    expect(isGeographicCluster(places)).toBe(false)
  })

  it('returns true when all places within 800m', () => {
    // ~200m spread around Paris center
    const places = [
      makePlace({ id: '1', lat: 48.8560, lon: 2.3522 }),
      makePlace({ id: '2', lat: 48.8562, lon: 2.3524 }),
      makePlace({ id: '3', lat: 48.8558, lon: 2.3520 }),
    ]
    expect(isGeographicCluster(places)).toBe(true)
  })

  it('returns false when places are spread across the city (>800m)', () => {
    // ~5km spread
    const places = [
      makePlace({ id: '1', lat: 48.830, lon: 2.300 }),
      makePlace({ id: '2', lat: 48.875, lon: 2.350 }),
      makePlace({ id: '3', lat: 48.855, lon: 2.330 }),
    ]
    expect(isGeographicCluster(places)).toBe(false)
  })
})
