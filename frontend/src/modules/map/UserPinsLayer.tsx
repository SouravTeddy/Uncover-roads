import { Marker } from 'react-map-gl/maplibre'
import type { Place, FavouritedPin } from '../../shared/types'
import {
  USER_PIN_COLOR,
  USER_PIN_SIZE,
  SAVED_BADGE_SIZE,
  SAVED_BADGE_COLOR,
  getUserPinStyle,
} from './pin-visual'
import { CATEGORY_ICONS } from './types'

interface Props {
  /** Places the user has explicitly added to their itinerary */
  itineraryPlaces: Place[]
  /** All bookmarked places — used to determine saved badge */
  favouritedPins: FavouritedPin[]
  activePinId: string | null
  onPinClick: (placeId: string) => void
}

/**
 * Renders user-added itinerary pins as blue markers.
 * Each pin checks the favouritedPins list to determine if the ❤️ badge shows.
 * If a pin is in itineraryPlaces it always shows the itinerary ring (blue border).
 */
export function UserPinsLayer({ itineraryPlaces, favouritedPins, activePinId, onPinClick }: Props) {
  const savedIds = new Set(favouritedPins.map((fp) => fp.placeId))

  return (
    <>
      {itineraryPlaces.map((place) => {
        const isActive = activePinId === place.id
        const saved = savedIds.has(place.id)
        const { border, showSavedBadge } = getUserPinStyle({ saved, inItinerary: true })
        const icon = CATEGORY_ICONS[place.category] ?? 'location_on'
        const size = isActive ? USER_PIN_SIZE + 6 : USER_PIN_SIZE

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
            <div style={{ position: 'relative', width: size, height: size }}>
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: USER_PIN_COLOR,
                  border,
                  boxShadow: isActive
                    ? `0 0 0 2px ${USER_PIN_COLOR}, 0 3px 8px rgba(0,0,0,.5)`
                    : '0 2px 6px rgba(0,0,0,0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  className="ms fill"
                  style={{ fontSize: isActive ? 14 : 12, color: '#fff', lineHeight: 1 }}
                >
                  {icon}
                </span>
              </div>
              {showSavedBadge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    fontSize: SAVED_BADGE_SIZE,
                    lineHeight: 1,
                    color: SAVED_BADGE_COLOR,
                    pointerEvents: 'none',
                  }}
                >
                  ❤️
                </span>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
}
