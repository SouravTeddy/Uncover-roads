import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import {
  UNIFIED_PIN_BG, UNIFIED_PIN_SHADOW,
  UNIFIED_PIN_SIZE, UNIFIED_ICON_SIZE, UNIFIED_ICON_COLOR,
  SAVED_BADGE_SIZE, SAVED_BADGE_COLOR,
  CATEGORY_MOOD, DEFAULT_MOOD,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  picks: Place[]
  activePinId: string | null
  onPinClick: (placeId: string) => void
  selectedPlaceIds?: Set<string>
  mapZoom?: number
  favouritedIds?: Set<string>
}

const CURATED_CIRCLE_BORDER        = '1px solid rgba(212,168,83,0.35)'
const CURATED_CIRCLE_BORDER_ACTIVE = '1.5px solid rgba(212,168,83,0.65)'

export function OurPicksPinsLayer({ picks, activePinId, onPinClick, selectedPlaceIds, mapZoom = 13, favouritedIds }: Props) {
  const labelOpacity = Math.max(0, Math.min(1, mapZoom - 13))

  return (
    <>
      {picks.filter(pick => !selectedPlaceIds?.has(pick.id)).map((pick) => {
        const isActive = activePinId === pick.id
        const isSaved = favouritedIds?.has(pick.id) ?? false
        const size = isActive ? UNIFIED_PIN_SIZE + 4 : UNIFIED_PIN_SIZE
        const icon = CATEGORY_ICONS[pick.category] ?? 'location_on'
        const mood = CATEGORY_MOOD[pick.category] ?? DEFAULT_MOOD

        return (
          <Marker
            key={pick.id}
            latitude={pick.lat}
            longitude={pick.lon}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(pick.id)
            }}
          >
            <div style={{ position: 'relative', width: size, height: size, cursor: 'pointer', overflow: 'visible' }}>

              {/* dual ping rings — curated attention signal */}
              <div style={{
                position: 'absolute',
                top: 0, right: 0, bottom: 0, left: 0,
                borderRadius: '50%',
                border: `1.5px solid ${mood.c}`,
                animation: 'pinPulse 2.6s 0s cubic-bezier(.2,.6,.4,1) infinite',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute',
                top: 0, right: 0, bottom: 0, left: 0,
                borderRadius: '50%',
                border: `1.5px solid ${mood.c}`,
                animation: 'pinPulse 2.6s 1.3s cubic-bezier(.2,.6,.4,1) infinite',
                pointerEvents: 'none',
              }} />

              {/* active ring */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: -3, right: -3, bottom: -3, left: -3,
                  borderRadius: '50%',
                  border: '1.5px solid #d4a853',
                  animation: 'pinPulse 1.5s ease-out infinite',
                  pointerEvents: 'none',
                }} />
              )}

              {/* pin circle — gold border marks curated picks */}
              <div style={{
                width: size, height: size, borderRadius: '50%',
                background: UNIFIED_PIN_BG,
                backdropFilter: 'blur(10px)',
                border: isActive ? CURATED_CIRCLE_BORDER_ACTIVE : CURATED_CIRCLE_BORDER,
                boxShadow: isActive
                  ? `0 0 0 3px rgba(212,168,83,0.18), ${UNIFIED_PIN_SHADOW}`
                  : `0 0 0 1px rgba(212,168,83,0.08), ${UNIFIED_PIN_SHADOW}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.24s cubic-bezier(.34,1.56,.64,1)',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
                position: 'relative', zIndex: 2,
              }}>
                <span className="ms fill" style={{ fontSize: UNIFIED_ICON_SIZE, color: UNIFIED_ICON_COLOR, lineHeight: 1 }}>
                  {icon}
                </span>
              </div>

              {isSaved && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  fontSize: SAVED_BADGE_SIZE, lineHeight: 1,
                  color: SAVED_BADGE_COLOR, pointerEvents: 'none', zIndex: 3,
                }}>❤️</span>
              )}

              {/* label card — fades with zoom */}
              <div style={{
                position: 'absolute', top: 'calc(100% + 7px)',
                left: '50%', transform: 'translateX(-50%)',
                padding: '6px 11px', borderRadius: 13,
                background: 'rgba(9,10,14,0.96)', backdropFilter: 'blur(14px)',
                border: '1px solid rgba(212,168,83,0.18)',
                boxShadow: '0 5px 16px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap', maxWidth: 130,
                overflow: 'hidden', textOverflow: 'ellipsis',
                fontSize: 12.5, fontWeight: 600, color: '#f2ede6', letterSpacing: '0.01em',
                pointerEvents: 'none',
                opacity: labelOpacity,
                transition: 'opacity 0.25s ease',
              }}>
                {pick.title}
              </div>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
