import { Marker } from 'react-map-gl/maplibre';
import type { Place, ReferencePin, PinState } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
};

/** Category emoji for itinerary mode numbered pins */
export const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍜', cafe: '☕', park: '🌿',
  museum: '🏛️', historic: '🏯', tourism: '📍',
  event: '🎭', place: '📌',
};

interface PlaceMarker {
  kind: 'place';
  place: Place;
  state: PinState;
  isFavourited: boolean;
}

interface RefMarker {
  kind: 'reference';
  pin: ReferencePin;
  state: PinState;
}

export type MarkerData = PlaceMarker | RefMarker;

interface Props {
  markers: MarkerData[];
  selectedId: string | null;
  onMarkerClick: (marker: MarkerData) => void;
}

export function ExploreMapMarkers({ markers, selectedId, onMarkerClick }: Props) {
  return (
    <>
      {markers.map((marker) => {
        const id = marker.kind === 'place' ? marker.place.id : marker.pin.id;
        const lat = marker.kind === 'place' ? marker.place.lat : marker.pin.lat;
        const lon = marker.kind === 'place' ? marker.place.lon : marker.pin.lon;
        const category = marker.kind === 'place' ? marker.place.category : marker.pin.category;
        const icon = CATEGORY_ICONS[category] ?? 'location_on';
        const color = CATEGORY_COLORS[category] ?? '#6b7280';
        const isSelected = id === selectedId;
        const isFav = marker.kind === 'place' && marker.isFavourited;

        // Reference ghost pins
        if (marker.state === 'reference') {
          return (
            <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
            >
              <div style={{
                position: 'relative',
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(147,51,234,0.18)',
                border: '1.5px solid rgba(147,51,234,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', opacity: 0.7,
              }}>
                <span className="ms fill" style={{ fontSize: 12, color: 'rgba(192,132,252,0.9)', lineHeight: 1 }}>
                  {icon}
                </span>
                {isFav && (
                  <div style={{
                    position: 'absolute', top: -4, right: -4,
                    fontSize: 10, lineHeight: 1,
                  }}>❤️</div>
                )}
              </div>
            </Marker>
          );
        }

        // Similar teal ripple pins
        if (marker.state === 'similar') {
          return (
            <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
            >
              <div className="marker-similar-pulse" style={{
                width: isSelected ? 34 : 28, height: isSelected ? 34 : 28,
                borderRadius: '50%',
                background: 'rgba(20,184,166,0.25)',
                border: '2px solid rgba(20,184,166,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <span className="ms fill" style={{ fontSize: isSelected ? 17 : 14, color: '#5eead4', lineHeight: 1 }}>
                  {icon}
                </span>
              </div>
            </Marker>
          );
        }

        // Added (blue) pins
        if (marker.state === 'added') {
          return (
            <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
            >
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: isSelected ? 36 : 30, height: isSelected ? 36 : 30,
                  borderRadius: '50%',
                  background: 'rgba(59,130,246,0.9)',
                  border: isSelected ? '2.5px solid #fff' : '2px solid rgba(147,197,253,0.9)',
                  boxShadow: isSelected ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,.5)' : '0 2px 8px rgba(0,0,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}>
                  <span className="ms fill" style={{ fontSize: isSelected ? 18 : 15, color: '#fff', lineHeight: 1 }}>
                    {icon}
                  </span>
                </div>
                {isFav && (
                  <div style={{
                    position: 'absolute', top: -5, right: -5,
                    fontSize: 11, lineHeight: 1,
                  }}>❤️</div>
                )}
              </div>
            </Marker>
          );
        }

        // Default category-colored pins (explore mode, not yet added)
        return (
          <Marker key={id} latitude={lat} longitude={lon} anchor="bottom"
            onClick={(e) => { e.originalEvent.stopPropagation(); onMarkerClick(marker); }}
          >
            <div style={{ position: 'relative' }}>
              <div style={{
                width: isSelected ? 34 : 28, height: isSelected ? 34 : 28,
                borderRadius: '50%', backgroundColor: color,
                border: isSelected ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.85)',
                boxShadow: isSelected
                  ? `0 0 0 2px ${color}, 0 3px 8px rgba(0,0,0,.45)`
                  : '0 2px 6px rgba(0,0,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                <span className="ms fill" style={{ fontSize: isSelected ? 17 : 14, color: '#fff', lineHeight: 1 }}>
                  {icon}
                </span>
              </div>
              {isFav && (
                <div style={{
                  position: 'absolute', top: -5, right: -5,
                  fontSize: 11, lineHeight: 1,
                }}>❤️</div>
              )}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
