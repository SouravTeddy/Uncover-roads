import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { DiscoveryMode } from '../../shared/types'
import {
  FAMOUS_PIN_COLOR,
  FAMOUS_PIN_SIZE,
  FAMOUS_STAR_ICON,
  getFamousLayerOpacity,
} from './pin-visual'

interface Props {
  places: Place[]
  activePlaceId: string | null
  discoveryMode: DiscoveryMode
  onPinClick: (placeId: string) => void
}

/**
 * Renders the famous pin layer — gold star markers from Google Places top-rated landmarks.
 * In deep discovery mode (local's pick) the layer is de-emphasised at 50% opacity.
 * Tapping a pin calls onPinClick(place.id).
 */
export function FamousPinsLayer({ places, activePlaceId, discoveryMode, onPinClick }: Props) {
  const layerOpacity = getFamousLayerOpacity(discoveryMode)

  return (
    <>
      {places.map((place) => {
        const isActive = activePlaceId === place.id
        const size = isActive ? FAMOUS_PIN_SIZE + 6 : FAMOUS_PIN_SIZE

        return (
          <Marker
            key={place.id}
            latitude={place.lat}
            longitude={place.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(place.id)
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: FAMOUS_PIN_COLOR,
                border: isActive
                  ? '2.5px solid #fff'
                  : '2px solid rgba(255,255,255,0.85)',
                boxShadow: isActive
                  ? `0 0 0 2px ${FAMOUS_PIN_COLOR}, 0 3px 8px rgba(0,0,0,.5)`
                  : '0 2px 6px rgba(0,0,0,0.35)',
                opacity: layerOpacity,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="ms fill"
                style={{ fontSize: isActive ? 16 : 13, color: '#fff', lineHeight: 1 }}
              >
                {FAMOUS_STAR_ICON}
              </span>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
