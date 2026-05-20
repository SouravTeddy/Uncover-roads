import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecoPlacesPinsLayer } from './RecoPlacesPinsLayer'
import type { Place } from '../../shared/types'

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children, latitude, longitude, onClick }: any) => (
    <div data-testid="reco-marker" data-lat={latitude} data-lon={longitude} onClick={onClick}>{children}</div>
  ),
}))

const places: Place[] = [
  { id: 'r1', title: 'Blue Bottle', category: 'cafe', lat: 35.67, lon: 139.70,
    tags: {}, reason: 'Matches your taste for cafes', reasonSignal: 'persona' },
  { id: 'r2', title: 'Senso-ji',   category: 'historic', lat: 35.71, lon: 139.79,
    tags: {}, reason: 'Top pick for historians', reasonSignal: 'persona' },
]

describe('RecoPlacesPinsLayer', () => {
  it('renders one marker per place', () => {
    render(<RecoPlacesPinsLayer places={places} activePinId={null} onPinClick={() => {}} />)
    expect(screen.getAllByTestId('reco-marker')).toHaveLength(2)
  })

  it('renders nothing when places is empty', () => {
    render(<RecoPlacesPinsLayer places={[]} activePinId={null} onPinClick={() => {}} />)
    expect(screen.queryAllByTestId('reco-marker')).toHaveLength(0)
  })

  it('calls onPinClick with place id when marker is clicked', () => {
    const spy = vi.fn()
    render(<RecoPlacesPinsLayer places={places} activePinId={null} onPinClick={spy} />)
    screen.getAllByTestId('reco-marker')[0].click()
    expect(spy).toHaveBeenCalledWith('r1')
  })
})
