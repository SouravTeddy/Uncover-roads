import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'

const RECO_PIN_BG = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
const PIN_SIZE    = 24

interface Props {
  places:      Place[]
  activePinId: string | null
  onPinClick:  (placeId: string) => void
}

export function RecoPlacesPinsLayer({ places, activePinId, onPinClick }: Props) {
  return (
    <>
      {places.map(place => {
        const isActive = activePinId === place.id
        const size     = isActive ? PIN_SIZE + 4 : PIN_SIZE
        return (
          <Marker
            key={place.id}
            latitude={place.lat}
            longitude={place.lon}
            anchor="center"
            onClick={() => onPinClick(place.id)}
          >
            <div
              style={{
                width: size, height: size, borderRadius: '50%',
                background: RECO_PIN_BG,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isActive
                  ? '0 0 0 3px rgba(245,158,11,.5), 0 4px 12px rgba(0,0,0,.4)'
                  : '0 2px 8px rgba(0,0,0,.35)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                opacity: isActive ? 1 : 0.92,
              }}
            >
              <span
                className="ms fill"
                style={{ fontSize: 13, color: '#0c0c0e', userSelect: 'none' }}
              >
                auto_awesome
              </span>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
