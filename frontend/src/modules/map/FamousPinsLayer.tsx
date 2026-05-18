import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { DiscoveryMode } from '../../shared/types'
import {
  FAMOUS_PIN_SIZE,
  getFamousLayerOpacity,
  getFamousPinColor,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  places: Place[]
  activePlaceId: string | null
  discoveryMode: DiscoveryMode
  isDark: boolean
  onPinClick: (placeId: string) => void
}

/**
 * Renders the famous pin layer — neutral slate markers, category icon inside.
 * Color adapts to map theme: deep navy on dark, charcoal on light.
 * In deep discovery mode the layer is de-emphasised at 50% opacity.
 */
export function FamousPinsLayer({ places, activePlaceId, discoveryMode, isDark, onPinClick }: Props) {
  const layerOpacity = getFamousLayerOpacity(discoveryMode)
  const pinColor = getFamousPinColor(isDark)

  return (
    <>
      {places.map((place) => {
        const isActive = activePlaceId === place.id
        const size = isActive ? FAMOUS_PIN_SIZE + 6 : FAMOUS_PIN_SIZE
        const icon = CATEGORY_ICONS[place.category] ?? 'location_on'

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
                backgroundColor: pinColor,
                border: isActive
                  ? '2.5px solid #fff'
                  : '1.5px solid rgba(255,255,255,0.18)',
                boxShadow: isActive
                  ? `0 0 0 2px ${pinColor}, 0 3px 8px rgba(0,0,0,.5)`
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
                style={{ fontSize: isActive ? 16 : 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}
              >
                {icon}
              </span>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
