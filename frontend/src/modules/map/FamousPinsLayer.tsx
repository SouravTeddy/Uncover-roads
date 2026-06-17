import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { DiscoveryMode } from '../../shared/types'
import {
  UNIFIED_PIN_BG, UNIFIED_PIN_BORDER, UNIFIED_PIN_SHADOW,
  UNIFIED_PIN_SIZE, UNIFIED_ICON_SIZE, UNIFIED_ICON_COLOR,
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
}

export function FamousPinsLayer({ places, activePlaceId, discoveryMode, onPinClick, mapZoom = 13 }: Props) {
  const layerOpacity = getFamousLayerOpacity(discoveryMode)
  const labelOpacity = Math.max(0, Math.min(1, mapZoom - 13))

  return (
    <>
      {places.map((place) => {
        const isActive = activePlaceId === place.id
        const size = isActive ? UNIFIED_PIN_SIZE + 4 : UNIFIED_PIN_SIZE
        const icon = CATEGORY_ICONS[place.category] ?? 'location_on'

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

              {/* sparkle spacer — no sparkle, no badge on famous pins */}
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', height: 14, opacity: labelOpacity }} />

              {/* pin circle */}
              <div style={{
                width: size, height: size, borderRadius: '50%',
                background: UNIFIED_PIN_BG,
                backdropFilter: 'blur(10px)',
                border: isActive ? '1.5px solid rgba(242,237,230,0.45)' : UNIFIED_PIN_BORDER,
                boxShadow: isActive
                  ? `0 0 0 3px rgba(212,168,83,0.22), ${UNIFIED_PIN_SHADOW}`
                  : UNIFIED_PIN_SHADOW,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.24s cubic-bezier(.34,1.56,.64,1)',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
              }}>
                <span className="ms fill" style={{ fontSize: UNIFIED_ICON_SIZE, color: UNIFIED_ICON_COLOR, lineHeight: 1 }}>
                  {icon}
                </span>
              </div>

              {/* label card — fades with zoom */}
              <div style={{
                position: 'absolute', top: 'calc(100% + 7px)',
                left: '50%', transform: 'translateX(-50%)',
                padding: '6px 11px', borderRadius: 13,
                background: 'rgba(9,10,14,0.96)', backdropFilter: 'blur(14px)',
                border: '1px solid rgba(242,237,230,0.1)',
                boxShadow: '0 5px 16px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap', maxWidth: 130,
                overflow: 'hidden', textOverflow: 'ellipsis',
                fontSize: 12.5, fontWeight: 600, color: '#f2ede6', letterSpacing: '0.01em',
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
