import { Marker } from 'react-map-gl/maplibre'
import type { ReferencePin } from '../../shared/types'
import {
  REFERENCE_PIN_COLOR,
  REFERENCE_PIN_SIZE,
  REFERENCE_PIN_OPACITY,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  pins: ReferencePin[]
  activePinId: string | null
  onPinClick: (pinId: string) => void
}

/**
 * Renders the reference ghost pin layer — LLM-generated place suggestions
 * for the active persona. Always purple, always 50% opacity.
 * Tapping sets activePinId so the PinCard can be shown.
 */
export function ReferencePinsLayer({ pins, activePinId, onPinClick }: Props) {
  return (
    <>
      {pins.map((pin) => {
        const isActive = activePinId === pin.id
        const icon = CATEGORY_ICONS[pin.category as string] ?? 'location_on'
        const size = isActive ? REFERENCE_PIN_SIZE + 4 : REFERENCE_PIN_SIZE

        return (
          <Marker
            key={pin.id}
            latitude={pin.lat}
            longitude={pin.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(pin.id)
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: REFERENCE_PIN_COLOR,
                border: '2px solid rgba(255,255,255,0.5)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                opacity: isActive ? 0.85 : REFERENCE_PIN_OPACITY,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="ms fill"
                style={{ fontSize: isActive ? 11 : 9, color: '#fff', lineHeight: 1 }}
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
