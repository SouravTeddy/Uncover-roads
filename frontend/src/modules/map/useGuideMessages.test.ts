import { describe, it, expect } from 'vitest'
import { computeGuideMessage } from './useGuideMessages'
import type { Place, LiveEvent } from '../../shared/types'
import type { HardBlocker } from './useHardBlockers'

function makePlace(overrides: Partial<Place> & { id: string; title: string }): Place {
  return { category: 'cafe', lat: 35.68, lon: 139.69, ...overrides }
}

function makeEvent(overrides: Partial<LiveEvent> & { id: string; title: string; date: string }): LiveEvent {
  return {
    lat: 0, lon: 0, venueName: '', time: '', genre: '', url: '', imageUrl: null,
    ...overrides,
  }
}

describe('computeGuideMessage', () => {
  it('test 1: returns area message when 0 places, city = Tokyo', () => {
    const result = computeGuideMessage([], [], 'Tokyo', null, [], null, null)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('area')
    expect(result?.text).toContain('Tokyo')
  })

  it('test 2: returns null when 0 places and city is null', () => {
    const result = computeGuideMessage([], [], null, null, [], null, null)
    expect(result).toBeNull()
  })

  it('test 3: returns conflict message when 1 blocker', () => {
    const blockers: HardBlocker[] = [
      { placeId: 'p1', placeTitle: 'Place 1', reason: 'Closed' },
    ]
    const result = computeGuideMessage([], blockers, 'Tokyo', null, [], null, null)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('conflict')
    expect(result?.text).toContain('conflict')
  })

  it('test 4: conflict message contains count 2 when 2 blockers', () => {
    const blockers: HardBlocker[] = [
      { placeId: 'p1', placeTitle: 'Place 1', reason: 'Closed' },
      { placeId: 'p2', placeTitle: 'Place 2', reason: 'Closed' },
    ]
    const result = computeGuideMessage([], blockers, 'Tokyo', null, [], null, null)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('conflict')
    expect(result?.text).toContain('2')
  })

  it('test 5: conflict takes priority over area (0 places + blockers → conflict)', () => {
    const blockers: HardBlocker[] = [
      { placeId: 'p1', placeTitle: 'Place 1', reason: 'Closed' },
    ]
    const result = computeGuideMessage([], blockers, 'Tokyo', null, [], null, null)
    expect(result?.kind).toBe('conflict')
    expect(result?.text).not.toContain('Tokyo')
  })

  it('test 6: returns event nudge when activePlace is event + matching liveEvent within travel range', () => {
    const activePlace = makePlace({
      id: 'event1',
      title: 'Active Event',
      category: 'event',
      tags: { genre: 'jazz' },
    })
    const liveEvent = makeEvent({
      id: 'event2',
      title: 'Another Jazz Night',
      genre: 'jazz',
      date: '2026-05-22',
    })
    const result = computeGuideMessage([], [], 'Tokyo', activePlace, [liveEvent], '2026-05-20', '2026-05-25')
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('event')
    expect(result?.text).toContain('Another Jazz Night')
  })

  it('test 7: does NOT return event nudge when matching event is outside travel range', () => {
    const activePlace = makePlace({
      id: 'event1',
      title: 'Active Event',
      category: 'event',
      tags: { genre: 'jazz' },
    })
    const liveEvent = makeEvent({
      id: 'event2',
      title: 'Another Jazz Night',
      genre: 'jazz',
      date: '2026-06-01', // outside range
    })
    const result = computeGuideMessage([], [], 'Tokyo', activePlace, [liveEvent], '2026-05-20', '2026-05-25')
    expect(result?.kind).not.toBe('event')
  })

  it('test 8: returns exploring when 2+ places, no blockers, no activeEvent', () => {
    const places = [
      makePlace({ id: 'p1', title: 'Place 1' }),
      makePlace({ id: 'p2', title: 'Place 2' }),
    ]
    const result = computeGuideMessage(places, [], 'Tokyo', null, [], null, null)
    expect(result).not.toBeNull()
    expect(result?.kind).toBe('exploring')
  })

  it('test 9: returns null when 1 place, no blockers, no event', () => {
    const places = [
      makePlace({ id: 'p1', title: 'Place 1' }),
    ]
    const result = computeGuideMessage(places, [], 'Tokyo', null, [], null, null)
    expect(result).toBeNull()
  })
})
