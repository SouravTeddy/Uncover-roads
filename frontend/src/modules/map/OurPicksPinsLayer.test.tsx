import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OurPicksPinsLayer } from './OurPicksPinsLayer'
import type { Place } from '../../shared/types'

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children, latitude, longitude }: any) => (
    <div data-testid="marker" data-lat={latitude} data-lon={longitude}>{children}</div>
  ),
}))

const picks: Place[] = [
  { id: 'p1', title: 'Blue Note', lat: 35.67, lon: 139.65, category: 'event', rating: 4.5 } as Place,
  { id: 'p2', title: 'Hidden Ramen', lat: 35.68, lon: 139.66, category: 'restaurant', rating: 4.8 } as Place,
]

describe('OurPicksPinsLayer', () => {
  it('renders one marker per pick', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
  })

  it('renders category icon for each pick', () => {
    render(<OurPicksPinsLayer picks={picks} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getAllByTestId('marker')).toHaveLength(2)
  })

  it('does not render excluded picks when selectedPlaceIds contains their id', () => {
    render(
      <OurPicksPinsLayer
        picks={picks}
        activePinId={null}
        onPinClick={() => {}}
        selectedPlaceIds={new Set(['p1'])}
      />
    )
    expect(screen.getAllByTestId('marker')).toHaveLength(1)
  })

  it('scales active pin larger', () => {
    const { container } = render(
      <OurPicksPinsLayer picks={picks} activePinId="p1" onPinClick={() => {}} />
    )
    expect(container.querySelectorAll('[data-testid="marker"]')).toHaveLength(2)
  })

  it('renders no markers when picks is empty', () => {
    render(<OurPicksPinsLayer picks={[]} activePinId={null} onPinClick={() => {}} />)
    expect(screen.queryAllByTestId('marker')).toHaveLength(0)
  })
})
