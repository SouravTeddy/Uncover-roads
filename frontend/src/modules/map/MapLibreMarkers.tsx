import { Marker } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#d4a853',
  cafe:       '#b88c3a',
  park:       '#5a8a60',
  museum:     '#8878b8',
  historic:   '#4a7fa0',
  tourism:    '#4a7fa0',
  event:      '#8878b8',
  place:      '#6a6058',
};

const PIN_SIZE = 30;

interface Props {
  places: Place[];
  selectedPlace: Place | null;
  selectedPlaces: Place[];         // itinerary selection list (ordered)
  highlightIds: Set<string>;       // hot/trending pins
  onPlaceClick: (place: Place) => void;
}

export function MapLibreMarkers({
  places, selectedPlace, selectedPlaces, highlightIds, onPlaceClick,
}: Props) {
  // Build itinerary position map: placeId → 1-based position
  const itineraryPositions = new Map(selectedPlaces.map((p, i) => [p.id, i + 1]));

  return (
    <>
      {places.map((place) => {
        const isCardOpen =
          selectedPlace?.title === place.title &&
          selectedPlace?.lat === place.lat &&
          selectedPlace?.lon === place.lon;

        const itineraryPos = itineraryPositions.get(place.id) ?? null;
        const isInItinerary = itineraryPos !== null;
        const isHot = highlightIds.has(place.id) && !isInItinerary; // hot loses to selected

        const color = CATEGORY_COLORS[place.category] ?? '#6a6058';
        const icon  = CATEGORY_ICONS[place.category]  ?? 'location_on';

        return (
          <Marker
            key={`${place.lat}-${place.lon}-${place.title}`}
            latitude={place.lat}
            longitude={place.lon}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onPlaceClick(place);
            }}
          >
            <div
              style={{
                position: 'relative',
                width: PIN_SIZE, height: PIN_SIZE,
                animation: isHot ? 'pinBounce 1.8s ease-in-out infinite' : 'none',
                cursor: 'pointer',
              }}
            >
              {/* Pin circle */}
              <div style={{
                width: PIN_SIZE, height: PIN_SIZE,
                borderRadius: '50%',
                backgroundColor: isInItinerary
                  ? color
                  : isCardOpen
                  ? `${color}30`
                  : `${color}18`,
                border: isCardOpen
                  ? `2px solid ${color}`
                  : isInItinerary
                  ? `2px solid ${color}`
                  : `1.5px solid ${color}60`,
                boxShadow: isCardOpen
                  ? `0 0 0 2px ${color}50, 0 3px 12px rgba(0,0,0,.6)`
                  : isInItinerary
                  ? `0 3px 10px ${color}40`
                  : `0 2px 8px rgba(0,0,0,.5), 0 0 0 1px ${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}>
                <span
                  className="ms"
                  style={{
                    fontSize: 15,
                    color: isInItinerary ? '#0c0c0e' : color,
                    lineHeight: 1,
                    fontVariationSettings: isInItinerary
                      ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                      : isCardOpen
                      ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                      : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
                  }}
                >
                  {icon}
                </span>
              </div>

              {/* Itinerary number badge — bottom-right */}
              {isInItinerary && (
                <div style={{
                  position: 'absolute', bottom: -2, right: -4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#0c0c0e',
                  border: `1.5px solid ${color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'dotPop .25s cubic-bezier(.16,1,.3,1)',
                }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: color, lineHeight: 1 }}>
                    {itineraryPos}
                  </span>
                </div>
              )}

              {/* Hot fire badge — top-right */}
              {isHot && (
                <div style={{
                  position: 'absolute', top: -3, right: -4,
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#e05050',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="ms fill" style={{ fontSize: 8, color: '#fff', lineHeight: 1 }}>
                    bolt
                  </span>
                </div>
              )}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
