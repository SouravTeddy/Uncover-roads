import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGuideMessages } from './useGuideMessages'
import type { Place, PersonaProfile } from '../../shared/types'

const profile: PersonaProfile = { archetype: 'explorer', stops_per_day: 3, venue_filters: ['tourism'] } as PersonaProfile
const place: Place = { id: '1', title: 'Opera House', lat: -33.8, lon: 151.2, category: 'tourism', photo_ref: null, tags: {}, rating: null } as Place

describe('useGuideMessages city reset', () => {
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
