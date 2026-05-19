import { describe, it, expect } from 'vitest'
import { computeHardBlockers } from './useHardBlockers'
import type { Place, PlaceDetails } from '../../shared/types'

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
