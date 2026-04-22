// modules/map/MapLibreMarkers.tsx
import { Marker } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444',
  cafe:       '#f97316',
  park:       '#22c55e',
  museum:     '#8b5cf6',
  historic:   '#a16207',
  tourism:    '#0ea5e9',
  event:      '#ec4899',
  place:      '#6b7280',
};

interface Props {
  places: Place[];
  selectedPlace: Place | null;
  highlightIds: Set<string>;
  onPlaceClick: (place: Place) => void;
}

export function MapLibreMarkers({ places, selectedPlace, highlightIds, onPlaceClick }: Props) {
  return (
    <>
      {places.map((place) => {
        const isSelected =
          selectedPlace?.title === place.title &&
          selectedPlace?.lat === place.lat &&
          selectedPlace?.lon === place.lon;
        const color = CATEGORY_COLORS[place.category] ?? '#6b7280';
        const icon  = CATEGORY_ICONS[place.category] ?? 'location_on';
        const size  = isSelected ? 34 : 28;
        const shouldGlow = highlightIds.has(place.id);

        return (
          <Marker
            key={`${place.lat}-${place.lon}-${place.title}`}
            latitude={place.lat}
            longitude={place.lon}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onPlaceClick(place);
            }}
          >
            <div
              className={shouldGlow ? 'marker-glow-burst' : undefined}
              style={{
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: color,
                border: isSelected ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.85)',
                boxShadow: shouldGlow
                  ? undefined
                  : isSelected
                    ? `0 0 0 2px ${color}, 0 3px 8px rgba(0,0,0,.45)`
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
                style={{ fontSize: isSelected ? 17 : 14, color: '#fff', lineHeight: 1 }}
              >
                {icon}
              </span>
            </div>
          </Marker>
        );
      })}
    </>
  );
}
