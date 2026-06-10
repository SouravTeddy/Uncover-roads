import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { computeAreaText, computeBuildReadinessText, isGeographicCluster, findPeacefulNearby, useGuideMessages } from './useGuideMessages'
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

// ── findPeacefulNearby ────────────────────────────────────────────────────────

describe('findPeacefulNearby', () => {
  const anchor = makePlace({ id: 'a1', title: 'Senso-ji', category: 'historic', lat: 35.7148, lon: 139.7967 })

  it('finds a park within 700m of a selected place', () => {
    // ~300m north of anchor
    const park = makePlace({ id: 'p1', title: 'Hamarikyu Gardens', category: 'park', lat: 35.7175, lon: 139.7967 })
    const result = findPeacefulNearby([anchor], [park], new Set())
    expect(result).not.toBeNull()
    expect(result?.peaceful.id).toBe('p1')
    expect(result?.anchor.id).toBe('a1')
  })

  it('returns null when peaceful place is beyond 700m', () => {
    // ~5km away
    const park = makePlace({ id: 'p2', title: 'Shinjuku Gyoen', category: 'park', lat: 35.6852, lon: 139.7100 })
    const result = findPeacefulNearby([anchor], [park], new Set())
    expect(result).toBeNull()
  })

  it('ignores non-peaceful categories (cafe, restaurant)', () => {
    const cafe = makePlace({ id: 'c1', title: 'Coffee Shop', category: 'cafe', lat: 35.7149, lon: 139.7968 })
    const result = findPeacefulNearby([anchor], [cafe], new Set())
    expect(result).toBeNull()
  })

  it('skips already-discovered peaceful places', () => {
    const park = makePlace({ id: 'p3', title: 'Small Garden', category: 'garden', lat: 35.7150, lon: 139.7968 })
    const result = findPeacefulNearby([anchor], [park], new Set(['p3']))
    expect(result).toBeNull()
  })

  it('returns null when selectedPlaces is empty', () => {
    const park = makePlace({ id: 'p4', category: 'park', lat: 35.7148, lon: 139.7967 })
    const result = findPeacefulNearby([], [park], new Set())
    expect(result).toBeNull()
  })

  it('recognises temple and shrine as peaceful categories', () => {
    const temple = makePlace({ id: 't1', title: 'Hidden Temple', category: 'temple', lat: 35.7149, lon: 139.7968 })
    const shrine = makePlace({ id: 's1', title: 'Old Shrine', category: 'shrine', lat: 35.7150, lon: 139.7966 })
    expect(findPeacefulNearby([anchor], [temple], new Set())).not.toBeNull()
    expect(findPeacefulNearby([anchor], [shrine], new Set())).not.toBeNull()
  })
})

// ── useGuideMessages peaceful bulb message ────────────────────────────────────

describe('useGuideMessages peaceful condition', () => {
  const profileBase = { archetype: 'explorer', stops_per_day: 3, venue_filters: [] } as unknown as PersonaProfile
  // Anchor stop added to itinerary
  const stop = makePlace({ id: 'stop1', title: 'Asakusa Market', category: 'historic', lat: 35.7148, lon: 139.7967 })
  // Peaceful place ~300m from stop — within radius
  const nearPark = makePlace({ id: 'park1', title: 'Riverside Park', category: 'park', lat: 35.7175, lon: 139.7967 })
  // Peaceful place ~5km from stop — outside radius
  const farPark = makePlace({ id: 'park2', title: 'Far Garden', category: 'park', lat: 35.6852, lon: 139.7100 })

  it('fires a peaceful message when a park is within 700m of a selected stop', () => {
    const { result } = renderHook(() =>
      useGuideMessages([stop], 'Tokyo', null, profileBase, [nearPark], null, [], null, null, 1)
    )
    const peaceful = result.current.messages.find(m => m.kind === 'peaceful')
    expect(peaceful).toBeTruthy()
    expect(peaceful?.text).toContain('Riverside Park')
    expect(peaceful?.text).toContain('park')
    expect(peaceful?.actionPlaceId).toBe('park1')
  })

  it('does not fire a peaceful message when peaceful place is beyond 700m', () => {
    const { result } = renderHook(() =>
      useGuideMessages([stop], 'Tokyo', null, profileBase, [farPark], null, [], null, null, 1)
    )
    expect(result.current.messages.find(m => m.kind === 'peaceful')).toBeUndefined()
  })

  it('does not fire peaceful message when no selected stops', () => {
    const { result } = renderHook(() =>
      useGuideMessages([], 'Tokyo', null, profileBase, [nearPark], null, [], null, null, 1)
    )
    expect(result.current.messages.find(m => m.kind === 'peaceful')).toBeUndefined()
  })

  it('does not fire peaceful for non-peaceful category even if nearby', () => {
    const nearCafe = makePlace({ id: 'cafe1', title: 'Coffee', category: 'cafe', lat: 35.7149, lon: 139.7968 })
    const { result } = renderHook(() =>
      useGuideMessages([stop], 'Tokyo', null, profileBase, [nearCafe], null, [], null, null, 1)
    )
    expect(result.current.messages.find(m => m.kind === 'peaceful')).toBeUndefined()
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
