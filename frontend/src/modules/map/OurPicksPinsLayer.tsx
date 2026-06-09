import { Marker } from 'react-map-gl/maplibre'
import {
  PICKS_PIN_SIZE, PICKS_PIN_BG, BADGE_COLORS,
  OFFBEAT_PIN_BG, OFFBEAT_PIN_COLOR, TRENDING_PIN_COLOR,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

export interface PlacePickFE {
  place_id: string
  name: string
  lat: number
  lon: number
  category: string
  rating: number | null
  stage: string
  badge: 'trending' | 'hidden_gem' | 'getting_busy' | null
  badge_reason: string | null
}

const BADGE_SYMBOL: Record<string, string> = {
  trending:     '↑',
  hidden_gem:   '✦',
  getting_busy: '!',
}

function pinBackground(badge: PlacePickFE['badge']): string {
  if (badge === 'hidden_gem') return OFFBEAT_PIN_BG
  return PICKS_PIN_BG  // trending, getting_busy, null → amber
}

function pinIcon(badge: PlacePickFE['badge'], category: string): string {
  if (badge === 'trending') return 'local_fire_department'
  if (badge === 'hidden_gem') return 'explore'
  return CATEGORY_ICONS[category] ?? 'place'
}

function pinGlow(badge: PlacePickFE['badge']): string {
  if (badge === 'hidden_gem') return `0 2px 14px ${OFFBEAT_PIN_COLOR}80`
  if (badge === 'trending') return `0 2px 14px ${TRENDING_PIN_COLOR}99`
  return '0 2px 8px rgba(0,0,0,0.4)'
}

interface Props {
  picks: PlacePickFE[]
  activePinId: string | null
  onPinClick: (placeId: string) => void
}

export function OurPicksPinsLayer({ picks, activePinId, onPinClick }: Props) {
  return (
    <>
      {picks.map((pick) => {
        const isActive = activePinId === pick.place_id
        const size = isActive ? PICKS_PIN_SIZE + 4 : PICKS_PIN_SIZE
        const badgeColor = pick.badge ? BADGE_COLORS[pick.badge] : null
        const icon = pinIcon(pick.badge, pick.category)
        const bg   = pinBackground(pick.badge)
        const glow = pinGlow(pick.badge)

        return (
          <Marker
            key={pick.place_id}
            latitude={pick.lat}
            longitude={pick.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              onPinClick(pick.place_id)
            }}
          >
            <div style={{ position: 'relative', width: size, height: size }}>
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: bg,
                  border: '2px solid rgba(255,255,255,0.85)',
                  boxShadow: glow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: isActive ? 1 : 0.92,
                }}
              >
                <span className="ms fill" style={{ fontSize: size * 0.45, color: '#fff', lineHeight: 1 }}>
                  {icon}
                </span>
              </div>
              {pick.badge && badgeColor && (
                <div
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: badgeColor,
                    border: '1.5px solid rgba(10,14,23,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    fontWeight: 700,
                    color: '#fff',
                    padding: '0 3px',
                  }}
                >
                  {BADGE_SYMBOL[pick.badge] ?? ''}
                </div>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
}
