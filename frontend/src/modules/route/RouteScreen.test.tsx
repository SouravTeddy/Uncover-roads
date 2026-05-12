import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { RouteScreen } from './RouteScreen'

afterEach(() => cleanup())

vi.mock('../../shared/store', () => ({
  useAppStore: () => ({
    state: {
      engineItinerary: null,
      engineMessages: [],
      city: 'Tokyo',
      tripContext: { days: 3 },
      generationCount: 1,
      userTier: 'free',
      packTripsRemaining: 0,
      selectedPlaces: [],
    },
    dispatch: vi.fn(),
  }),
  getGenerationAccess: () => ({ allowed: true, degraded: false }),
}))

describe('RouteScreen', () => {
  it('shows empty state when no engineItinerary', () => {
    render(<RouteScreen />)
    expect(screen.getByText(/No itinerary yet/)).toBeTruthy()
  })
})
