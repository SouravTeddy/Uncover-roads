import { Marker } from 'react-map-gl/maplibre'
import { SEARCH_PIN_BG, SEARCH_PIN_SIZE } from './pin-visual'

export interface SearchResultPin {
  id: string
  number: number
  title: string
  lat: number
  lon: number
}

interface Props {
  pins: SearchResultPin[]
  onPinClick: (pin: SearchResultPin) => void
}

export function NumberedPinsLayer({ pins, onPinClick }: Props) {
  return (
    <>
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          latitude={pin.lat}
          longitude={pin.lon}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation()
            onPinClick(pin)
          }}
        >
          <div
            style={{
              width: SEARCH_PIN_SIZE,
              height: SEARCH_PIN_SIZE,
              borderRadius: '50%',
              backgroundColor: SEARCH_PIN_BG,
              border: '2px solid rgba(255,255,255,0.9)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {pin.number}
          </div>
        </Marker>
      ))}
    </>
  )
}
