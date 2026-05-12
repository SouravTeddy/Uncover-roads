import { Marker } from 'react-map-gl/maplibre'
import type { LiveEvent } from '../../shared/types'
import { EVENT_PIN_COLOR, EVENT_PIN_SIZE, EVENT_PIN_ICON } from './pin-visual'

interface Props {
  events: LiveEvent[]
  activePinId: string | null
  onPinClick: (eventId: string) => void
}

export function LiveEventPinsLayer({ events, activePinId, onPinClick }: Props) {
  return (
    <>
      {events.map((ev) => {
        const isActive = activePinId === ev.id
        const size = isActive ? EVENT_PIN_SIZE + 4 : EVENT_PIN_SIZE

        return (
          <Marker
            key={ev.id}
            latitude={ev.lat}
            longitude={ev.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(ev.id)
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: EVENT_PIN_COLOR,
                border: '2px solid rgba(255,255,255,0.7)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: isActive ? 1 : 0.88,
                transition: 'all 0.15s ease',
              }}
            >
              <span className="ms fill" style={{ fontSize: size * 0.45, color: '#fff', lineHeight: 1 }}>
                {EVENT_PIN_ICON}
              </span>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
