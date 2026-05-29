import { Marker } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { AreaNeighborhood } from './useNeighborhoods'

// ── Category colors ────────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  restaurant: '#bf7a8a',
  cafe:       '#c8a050',
  park:       '#6daa76',
  museum:     '#c4a04a',
  viewpoint:  '#7c9fd6',
  historic:   '#c4a04a',
  tourism:    '#9fa8da',
  bar:        '#c8a050',
  nightlife:  '#c8a050',
  default:    '#a3a0a8',
}

function catColor(cat: string): string {
  return CAT_COLOR[cat] ?? CAT_COLOR.default
}

// ── Category icon mapping (Material Symbols) ───────────────────────────────────
const CAT_ICON: Record<string, string> = {
  restaurant: 'restaurant',
  cafe:       'local_cafe',
  park:       'park',
  museum:     'museum',
  historic:   'account_balance',
  tourism:    'photo_camera',
  viewpoint:  'landscape',
  bar:        'local_bar',
  nightlife:  'nightlife',
}

function catIcon(cat: string): string {
  return CAT_ICON[cat] ?? 'location_on'
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  neighborhoods: AreaNeighborhood[]
  mapZoom: number
  selectedAreaId: string | null
  onSelectArea: (id: string | null) => void
  activeFilter: string   // 'all' | 'curated' | 'saved' | sub-category
}

// ── Pin marker (Dot) ───────────────────────────────────────────────────────────
interface PinProps {
  place: Place
  index: number
}

function PinMarker({ place, index }: PinProps) {
  const color = catColor(place.category)
  const icon  = catIcon(place.category)
  const delay = index * 0.05

  return (
    <Marker latitude={place.lat} longitude={place.lon} anchor="center">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: `pinDrop 0.5s cubic-bezier(.34,1.56,.64,1) ${delay}s backwards`,
          pointerEvents: 'none',
        }}
      >
        {/* Label pill above pin */}
        <div
          style={{
            padding: '3px 9px',
            borderRadius: 999,
            marginBottom: 5,
            whiteSpace: 'nowrap',
            background: 'rgba(10,11,16,.96)',
            border: `1px solid ${color}66`,
            boxShadow: '0 4px 14px rgba(0,0,0,.6)',
            fontSize: 10.5,
            fontWeight: 600,
            color: '#f2ede6',
          }}
        >
          {place.title}
        </div>
        {/* Pin circle */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'rgba(14,16,22,.94)',
            border: `1.5px solid ${color}`,
            boxShadow: `0 3px 12px ${color}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span className="ms fill" style={{ fontSize: 15, color }}>{icon}</span>
        </div>
      </div>
    </Marker>
  )
}

// ── Area pill/label rendered at neighborhood centroid ──────────────────────────
interface AreaMarkerProps {
  neighborhood: AreaNeighborhood
  zoom: number
  isSelected: boolean
  onSelect: (id: string | null) => void
}

function AreaMarker({ neighborhood: n, zoom, isSelected, onSelect }: AreaMarkerProps) {
  const pillOp = Math.max(0, Math.min(1, (zoom - 12.5) / 0.5))
  const labelOp = 1 - pillOp

  const col = n.park ? '#5fa570' : '#d6aa56'
  const darkerCol = n.park ? '#4f8a62' : '#b8893a'

  function handleClick(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation()
    onSelect(isSelected ? null : n.id)
  }

  return (
    <Marker latitude={n.lat} longitude={n.lon} anchor="center">
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Faint label — visible when zoomed out */}
        {labelOp > 0.04 && !isSelected && (
          <div
            style={{
              position: 'absolute',
              textAlign: 'center',
              opacity: labelOp,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: col,
                textShadow: '0 1px 10px rgba(0,0,0,.9)',
              }}
            >
              {n.name}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'rgba(242,237,230,.5)',
                marginTop: 2,
                letterSpacing: '.08em',
              }}
            >
              {n.spotCount} spots
            </div>
          </div>
        )}

        {/* Tappable pill — visible when zoomed in */}
        {pillOp > 0.04 && (
          <button
            onClick={handleClick}
            onTouchEnd={handleClick}
            style={{
              position: 'absolute',
              opacity: isSelected ? 1 : pillOp,
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 13px 7px 9px',
              borderRadius: 999,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: isSelected
                ? `linear-gradient(135deg, ${col}, ${darkerCol})`
                : 'rgba(12,13,17,.9)',
              backdropFilter: 'blur(14px)',
              border: `1.5px solid ${isSelected ? col : col + '88'}`,
              boxShadow: isSelected
                ? `0 8px 26px ${col}66, 0 0 22px ${col}44`
                : '0 6px 20px rgba(0,0,0,.5)',
              // reset button defaults
              outline: 'none',
            }}
          >
            {/* Icon chip */}
            <span
              style={{
                display: 'flex',
                width: 24,
                height: 24,
                borderRadius: '50%',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSelected ? 'rgba(12,13,17,.18)' : col + '22',
                border: `1px solid ${isSelected ? 'rgba(12,13,17,.2)' : col + '44'}`,
                flexShrink: 0,
              }}
            >
              <span
                className="ms fill"
                style={{
                  fontSize: 14,
                  color: isSelected ? '#0c0c0e' : col,
                }}
              >
                {n.park ? 'park' : 'place'}
              </span>
            </span>

            {/* Text */}
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                lineHeight: 1.15,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: isSelected ? '#0c0c0e' : '#f2ede6',
                }}
              >
                {n.name}
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: isSelected ? 'rgba(12,13,17,.66)' : '#a3a0a8',
                }}
              >
                {n.spotCount} spots
              </span>
            </span>
          </button>
        )}

      </div>
    </Marker>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function AreaPillsOverlay({
  neighborhoods,
  mapZoom,
  selectedAreaId,
  onSelectArea,
  activeFilter,
}: Props) {
  if (!neighborhoods.length) return null

  const selectedArea = neighborhoods.find(n => n.id === selectedAreaId) ?? null

  // Only show pills/labels when in 'all' mode with no sub-category
  const showAreas = activeFilter === 'all'

  return (
    <>
      {/* Area markers (labels + pills) */}
      {showAreas && neighborhoods.map(n => (
        <AreaMarker
          key={n.id}
          neighborhood={n}
          zoom={mapZoom}
          isSelected={selectedAreaId === n.id}
          onSelect={onSelectArea}
        />
      ))}

      {/* Pins for selected area — staggered pin drop */}
      {selectedArea && selectedArea.places.map((place, i) => (
        <PinMarker key={place.id} place={place} index={i} />
      ))}
    </>
  )
}
