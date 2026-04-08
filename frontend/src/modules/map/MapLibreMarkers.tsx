// modules/map/MapLibreMarkers.tsx
import { Marker } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444',
  cafe: '#f97316',
  park: '#22c55e',
  museum: '#8b5cf6',
  historic: '#a16207',
  tourism: '#0ea5e9',
  event: '#ec4899',
  place: '#6b7280',
};

interface Props {
  places: Place[];
  selectedPlace: Place | null;
  onPlaceClick: (place: Place) => void;
}

export function MapLibreMarkers({ places, selectedPlace, onPlaceClick }: Props) {
  return (
    <>
      {places.map((place) => {
        const isSelected =
          selectedPlace?.title === place.title &&
          selectedPlace?.lat === place.lat &&
          selectedPlace?.lon === place.lon;
        const color = CATEGORY_COLORS[place.category] ?? '#6b7280';

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
              style={{
                width: isSelected ? 20 : 14,
                height: isSelected ? 20 : 14,
                borderRadius: '50%',
                backgroundColor: color,
                border: isSelected ? '3px solid white' : '2px solid white',
                boxShadow: isSelected
                  ? `0 0 0 2px ${color}`
                  : '0 1px 4px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            />
          </Marker>
        );
      })}
    </>
  );
}
