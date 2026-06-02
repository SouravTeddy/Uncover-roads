import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { computeAreaText, computeBuildReadinessText, isGeographicCluster, useGuideMessages } from './useGuideMessages'
import type { Place, Persona, PersonaProfile } from '../../shared/types'

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
  it('names the specific place when a start place is provided', () => {
    const persona = makePersona(['museum'])
    const startPlace = makePlace({ id: '1', title: 'Edo-Tokyo Museum', category: 'museum' })
    const text = computeAreaText('Tokyo', persona, [startPlace], startPlace)
    expect(text).toContain('Edo-Tokyo Museum')
    expect(text).toContain('museum')
  })

  it('uses persona-match phrasing when place matches persona', () => {
    const persona = makePersona(['museum'])
    const startPlace = makePlace({ id: '1', title: 'Louvre', category: 'museum' })
    const text = computeAreaText('Paris', persona, [startPlace], startPlace)
    expect(text).toContain('recommended')
  })

  it('uses city phrasing when place does not match persona', () => {
    const persona = makePersona(['cafe'])
    const startPlace = makePlace({ id: '1', title: 'Brandenburg Gate', category: 'historic' })
    const text = computeAreaText('Berlin', persona, [startPlace], startPlace)
    expect(text).toContain('Berlin')
    expect(text).toContain('Brandenburg Gate')
  })

  it('falls back to generic message when no start place', () => {
    const persona = makePersona(['museum'])
    const text = computeAreaText('Madrid', persona, [], null)
    expect(text).toContain('Madrid')
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

// ── useGuideMessages city reset ───────────────────────────────────────────────

const profile = { archetype: 'explorer', stops_per_day: 3, venue_filters: ['tourism'] } as unknown as PersonaProfile
const place = { id: '1', title: 'Opera House', lat: -33.8, lon: 151.2, category: 'tourism', photo_ref: null, tags: {} } as unknown as Place

describe('useGuideMessages city reset', () => {
  // clusterFired resets per city so that cluster message can re-fire on city change
  it('fires area message again when city changes', () => {
    const { result, rerender } = renderHook(
      ({ city }: { city: string }) =>
        useGuideMessages([], city, 'explorer' as any, profile, [place], null, [], null, null, 2),
      { initialProps: { city: 'Sydney' } }
    )

    // First render — area message should fire
    expect(result.current.messages.length).toBe(1)

    // City changes to Tokyo — area message should fire again
    rerender({ city: 'Tokyo' })
    expect(result.current.messages.length).toBe(2)
  })
})
