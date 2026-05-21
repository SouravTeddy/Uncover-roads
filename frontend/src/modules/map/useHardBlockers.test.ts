import { describe, it, expect } from 'vitest'
import { computeHardBlockers, computeMultiCityFeasibility } from './useHardBlockers'
import type { Place, PlaceDetails, CityFootprint } from '../../shared/types'

function makePlace(overrides: Partial<Place> & { id: string; title: string }): Place {
  return { category: 'cafe', lat: 35.68, lon: 139.69, ...overrides }
}

function makeDetails(weekday_text: string[]): PlaceDetails {
  return { place_id: 'gp', name: 'X', address: '', lat: 35.68, lon: 139.69, weekday_text }
}

const noCache = new Map<string, PlaceDetails>()

describe('computeHardBlockers', () => {
  it('returns empty array when no places', () => {
    const result = computeHardBlockers([], noCache, '2026-05-20', '2026-05-25')
    expect(result).toEqual([])
  })

  it('flags permanently closed even when dates are null', () => {
    const place = makePlace({
      id: 'p1',
      title: 'Closed Place',
      tags: { business_status: 'CLOSED_PERMANENTLY' },
    })
    const result = computeHardBlockers([place], noCache, null, null)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      placeId: 'p1',
      placeTitle: 'Closed Place',
      reason: 'Permanently closed',
    })
  })

  it('flags permanently closed with dates provided', () => {
    const place = makePlace({
      id: 'p2',
      title: 'Another Closed',
      tags: { business_status: 'CLOSED_PERMANENTLY' },
    })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      placeId: 'p2',
      placeTitle: 'Another Closed',
      reason: 'Permanently closed',
    })
  })

  it('flags place closed on Thursday (2026-05-21) within range 2026-05-20 to 2026-05-22', () => {
    const place = makePlace({
      id: 'p3',
      title: 'Tokyo Cafe',
      lat: 35.68,
      lon: 139.69,
    })
    const cache = new Map<string, PlaceDetails>()
    cache.set('35.68000:139.69000', makeDetails([
      'Monday: 9:00 AM - 10:00 PM',
      'Tuesday: 9:00 AM - 10:00 PM',
      'Wednesday: 9:00 AM - 10:00 PM',
      'Thursday: Closed',
      'Friday: 9:00 AM - 10:00 PM',
      'Saturday: 9:00 AM - 10:00 PM',
      'Sunday: 10:00 AM - 9:00 PM',
    ]))
    const result = computeHardBlockers([place], cache, '2026-05-20', '2026-05-22')
    expect(result).toHaveLength(1)
    expect(result[0].placeId).toBe('p3')
    expect(result[0].placeTitle).toBe('Tokyo Cafe')
    expect(result[0].reason).toMatch(/Closed on Thursday/)
    expect(result[0].reason).toMatch(/21 May/)
  })

  it('does not flag place open on all days in range', () => {
    const place = makePlace({
      id: 'p4',
      title: 'Always Open',
      lat: 35.68,
      lon: 139.69,
    })
    const cache = new Map<string, PlaceDetails>()
    cache.set('35.68000:139.69000', makeDetails([
      'Monday: 9:00 AM - 10:00 PM',
      'Tuesday: 9:00 AM - 10:00 PM',
      'Wednesday: 9:00 AM - 10:00 PM',
      'Thursday: 9:00 AM - 10:00 PM',
      'Friday: 9:00 AM - 10:00 PM',
      'Saturday: 9:00 AM - 10:00 PM',
      'Sunday: 10:00 AM - 9:00 PM',
    ]))
    const result = computeHardBlockers([place], cache, '2026-05-20', '2026-05-25')
    expect(result).toEqual([])
  })

  it('flags event with date before travel start (event: 2026-05-10, travel: 2026-05-20 to 2026-05-25)', () => {
    const place = makePlace({
      id: 'p5',
      title: 'Past Event',
      category: 'event',
      tags: { event_date: '2026-05-10' },
    })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      placeId: 'p5',
      placeTitle: 'Past Event',
    })
    expect(result[0].reason).toMatch(/Event on May 10 is outside your trip dates/)
  })

  it('flags event with date after travel end (event: 2026-06-10)', () => {
    const place = makePlace({
      id: 'p6',
      title: 'Future Event',
      category: 'event',
      tags: { event_date: '2026-06-10' },
    })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      placeId: 'p6',
      placeTitle: 'Future Event',
    })
    expect(result[0].reason).toMatch(/Event on Jun 10 is outside your trip dates/)
  })

  it('does not flag event within travel range (event: 2026-05-22)', () => {
    const place = makePlace({
      id: 'p7',
      title: 'Current Event',
      category: 'event',
      tags: { event_date: '2026-05-22' },
    })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toEqual([])
  })

  it('skips hours check if place has no cached details (lat: 99.0, lon: 99.0 not in cache)', () => {
    const place = makePlace({
      id: 'p8',
      title: 'Uncached Place',
      lat: 99.0,
      lon: 99.0,
    })
    const result = computeHardBlockers([place], noCache, '2026-05-20', '2026-05-25')
    expect(result).toEqual([])
  })
})

const makePlaces = (city: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${city}-${i}`,
    title: `Place ${i}`,
    _city: city,
    lat: 0,
    lon: 0,
    category: 'tourism',
    rating: null,
    tags: {},
  } as never))

describe('computeMultiCityFeasibility', () => {
  const parisFp: CityFootprint = { city: 'Paris', emoji: '🗼', pinCount: 3, lat: 48.8566, lon: 2.3522 }
  const londonFp: CityFootprint = { city: 'London', emoji: '🎡', pinCount: 2, lat: 51.5074, lon: -0.1278 }

  it('returns null when no travel dates set', () => {
    const places = [...makePlaces('Paris', 3), ...makePlaces('London', 2)]
    expect(computeMultiCityFeasibility(places, [parisFp, londonFp], null, null, 3)).toBeNull()
  })

  it('returns null when plan fits within available days', () => {
    // Paris: ceil(3/3)=1 day + London: ceil(2/3)=1 day = 2 city days
    // Paris→London: ~340km drive, <3h → 0 transit days
    // total 2, available 10 → null
    const places = [...makePlaces('Paris', 3), ...makePlaces('London', 2)]
    expect(computeMultiCityFeasibility(places, [parisFp, londonFp], '2026-06-01', '2026-06-10', 3)).toBeNull()
  })

  it('returns blocker when totalNeeded > availableDays', () => {
    // Paris: ceil(6/3)=2 + London: ceil(6/3)=2 = 4 city days, drive <3h → 0 transit
    // 4 needed, 3 available → blocker
    const places = [...makePlaces('Paris', 6), ...makePlaces('London', 6)]
    const result = computeMultiCityFeasibility(places, [parisFp, londonFp], '2026-06-01', '2026-06-03', 3)
    expect(result).not.toBeNull()
    expect(result!.totalNeeded).toBeGreaterThan(result!.availableDays)
    expect(result!.cityCount).toBe(2)
  })

  it('flight leg adds 1 transit day', () => {
    // Tokyo→Sydney: ~7820km flight, >> 180min → +1 transit day
    // Tokyo: ceil(3/3)=1 + Sydney: ceil(3/3)=1 + 1 transit = 3 needed
    const tokyoFp: CityFootprint = { city: 'Tokyo', emoji: '🗾', pinCount: 3, lat: 35.6762, lon: 139.6503, transitMode: 'flight' }
    const sydneyFp: CityFootprint = { city: 'Sydney', emoji: '🦘', pinCount: 3, lat: -33.8688, lon: 151.2093, transitMode: 'flight' }
    const places = [...makePlaces('Tokyo', 3), ...makePlaces('Sydney', 3)]
    // 3 needed, 3 available → null (just fits)
    expect(computeMultiCityFeasibility(places, [tokyoFp, sydneyFp], '2026-06-01', '2026-06-03', 3)).toBeNull()
    // 2 available → blocker
    const result = computeMultiCityFeasibility(places, [tokyoFp, sydneyFp], '2026-06-01', '2026-06-02', 3)
    expect(result).not.toBeNull()
  })
})
