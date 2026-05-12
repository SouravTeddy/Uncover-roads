import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OurPicksPinsLayer } from './OurPicksPinsLayer'

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children, latitude, longitude }: any) => (
    <div data-testid="marker" data-lat={latitude} data-lon={longitude}>{children}</div>
  ),
}))

const picks = [
  { place_id: 'p1', name: 'Blue Note', lat: 35.67, lon: 139.65, category: 'event', rating: 4.5, stage: 'rising', badge: 'trending' as const, badge_reason: 'Reviews up 3x' },
  { place_id: 'p2', name: 'Hidden Ramen', lat: 35.68, lon: 139.66, category: 'restaurant', rating: 4.8, stage: 'hidden_gem', badge: 'hidden_gem' as const, badge_reason: 'Off the trail' },
]

describe('OurPicksPinsLayer', () => {
  it('renders one marker per pick', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
  })

  it('renders badge when pick has badge', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    const badge = screen.getByText('↑')
    expect(badge).toBeTruthy()
  })
})
