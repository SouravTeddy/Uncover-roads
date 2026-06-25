import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { DiscoveryMode } from '../../shared/types'
import {
  UNIFIED_PIN_SHADOW,
  UNIFIED_PIN_SIZE, UNIFIED_ICON_SIZE,
  SAVED_BADGE_SIZE, SAVED_BADGE_COLOR,
  getFamousLayerOpacity,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  places: Place[]
  activePlaceId: string | null
  discoveryMode: DiscoveryMode
  isDark: boolean
  onPinClick: (placeId: string) => void
  mapZoom?: number
  favouritedIds?: Set<string>
}

export function FamousPinsLayer({ places, activePlaceId, discoveryMode, isDark, onPinClick, mapZoom = 13, favouritedIds }: Props) {
  const layerOpacity = getFamousLayerOpacity(discoveryMode)
  const labelOpacity = Math.max(0, Math.min(1, mapZoom - 13))

  return (
    <>
      {places.map((place) => {
        const isActive = activePlaceId === place.id
        const isSaved = favouritedIds?.has(place.id) ?? false
        const size = isActive ? UNIFIED_PIN_SIZE + 4 : UNIFIED_PIN_SIZE
        const icon = CATEGORY_ICONS[place.category] ?? 'location_on'
        const pinBg = isDark ? 'rgba(18,19,24,0.94)' : 'rgba(255,255,255,0.96)'
        const pinBorder = isDark
          ? (isActive ? '1.5px solid rgba(242,237,230,0.45)' : '1px solid rgba(242,237,230,0.16)')
          : (isActive ? '1.5px solid rgba(44,36,32,0.45)' : '1px solid rgba(44,36,32,0.14)')
        const iconColor = isDark ? '#e8e2d8' : '#6b5e57'

        return (
          <Marker
            key={place.id}
            latitude={place.lat}
            longitude={place.lon}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(place.id)
            }}
          >
            <div style={{ position: 'relative', width: size, height: size, opacity: layerOpacity, cursor: 'pointer' }}>

              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', height: 14, opacity: labelOpacity }} />

              {/* pin circle */}
              <div style={{
                width: size, height: size, borderRadius: '50%',
                background: pinBg,
                backdropFilter: 'blur(10px)',
                border: pinBorder,
                boxShadow: isActive
                  ? `0 0 0 3px rgba(212,168,83,0.22), ${UNIFIED_PIN_SHADOW}`
                  : UNIFIED_PIN_SHADOW,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.24s cubic-bezier(.34,1.56,.64,1)',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
              }}>
                <span className="ms fill" style={{ fontSize: UNIFIED_ICON_SIZE, color: iconColor, lineHeight: 1 }}>
                  {icon}
                </span>
              </div>

              {isSaved && (
                <span style={{
                  position: 'absolute', top: -3, right: -3,
                  fontSize: SAVED_BADGE_SIZE, lineHeight: 1,
                  color: SAVED_BADGE_COLOR, pointerEvents: 'none',
                }}>❤️</span>
              )}

              {/* label card — fades with zoom */}
              <div style={{
                position: 'absolute', top: 'calc(100% + 7px)',
                left: '50%', transform: 'translateX(-50%)',
                padding: '6px 11px', borderRadius: 13,
                background: isDark ? 'rgba(9,10,14,0.96)' : 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(14px)',
                border: isDark ? '1px solid rgba(242,237,230,0.1)' : '1px solid rgba(44,36,32,0.1)',
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
                {place.title}
              </div>
            </div>
          </Marker>
        )
      })}
    </>
  )
}
