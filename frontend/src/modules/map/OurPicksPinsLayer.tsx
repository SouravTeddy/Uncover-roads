import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import {
  UNIFIED_PIN_SHADOW,
  UNIFIED_PIN_SIZE, UNIFIED_ICON_SIZE,
  SAVED_BADGE_SIZE, SAVED_BADGE_COLOR,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  picks: Place[]
  activePinId: string | null
  onPinClick: (placeId: string) => void
  selectedPlaceIds?: Set<string>
  mapZoom?: number
  favouritedIds?: Set<string>
  isDark?: boolean
}

const CURATED_CIRCLE_BORDER        = '1px solid rgba(212,168,83,0.35)'
const CURATED_CIRCLE_BORDER_ACTIVE = '1.5px solid rgba(212,168,83,0.65)'

export function OurPicksPinsLayer({ picks, activePinId, onPinClick, selectedPlaceIds, mapZoom = 13, favouritedIds, isDark = true }: Props) {
  const labelOpacity = Math.max(0, Math.min(1, mapZoom - 13))

  return (
    <>
      {picks.filter(pick => !selectedPlaceIds?.has(pick.id)).map((pick) => {
        const isActive = activePinId === pick.id
        const isSaved = favouritedIds?.has(pick.id) ?? false
        const size = isActive ? UNIFIED_PIN_SIZE + 4 : UNIFIED_PIN_SIZE
        const icon = CATEGORY_ICONS[pick.category] ?? 'location_on'
        const pinBg = isDark ? 'rgba(18,19,24,0.94)' : 'rgba(255,255,255,0.96)'
        const iconCol = isDark ? '#e8e2d8' : '#6b5e57'

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

              {/* active ring — only pulses when selected */}
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
                background: pinBg,
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
                <span className="ms fill" style={{ fontSize: UNIFIED_ICON_SIZE, color: iconCol, lineHeight: 1 }}>
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
                background: isDark ? 'rgba(9,10,14,0.96)' : 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(212,168,83,0.18)',
                boxShadow: isDark ? '0 5px 16px rgba(0,0,0,0.6)' : '0 2px 12px rgba(0,0,0,0.12)',
                whiteSpace: 'nowrap', maxWidth: 130,
                overflow: 'hidden', textOverflow: 'ellipsis',
                fontSize: 12.5, fontWeight: 600,
                color: isDark ? '#f2ede6' : '#2c2420',
                letterSpacing: '0.01em',
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
