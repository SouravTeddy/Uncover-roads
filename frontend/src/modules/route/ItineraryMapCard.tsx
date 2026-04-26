import { Marker } from 'react-map-gl/maplibre';
import { MapLibreMap } from '../map/MapLibreMap';
import type { MapHandle } from '../map/MapLibreMap';
import type { Place } from '../../shared/types';
import { CATEGORY_EMOJI } from '../map/ExploreMapMarkers';

interface Props {
  mapRef: React.RefObject<MapHandle | null>;
  center: [number, number];
  selectedPlaces: Place[];
  activeStopIdx: number;
  onFullMap: () => void;
}

export function ItineraryMapCard({ mapRef, center, selectedPlaces, activeStopIdx, onFullMap }: Props) {
  const routeFeature: GeoJSON.Feature<GeoJSON.LineString> | null =
    selectedPlaces.length >= 2
      ? {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: selectedPlaces.map(p => [p.lon, p.lat]),
          },
          properties: {},
        }
      : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapLibreMap
        ref={mapRef}
        center={center}
        places={[]}
        selectedPlace={null}
        onPlaceClick={() => {}}
        onMoveEnd={() => {}}
        routeGeojson={routeFeature}
      >
        {selectedPlaces.map((place, idx) => {
          const isActive = idx === activeStopIdx;
          const emoji = CATEGORY_EMOJI[place.category] ?? '📌';
          return (
            <Marker
              key={place.id}
              latitude={place.lat}
              longitude={place.lon}
              anchor="center"
            >
              <div style={{
                position: 'relative',
                width: isActive ? 44 : 34,
                height: isActive ? 44 : 34,
                borderRadius: '50%',
                background: isActive ? 'rgba(59,130,246,.95)' : 'rgba(30,41,59,.9)',
                border: isActive ? '2.5px solid #fff' : '2px solid rgba(255,255,255,.5)',
                boxShadow: isActive
                  ? '0 0 0 3px rgba(59,130,246,.4), 0 4px 16px rgba(0,0,0,.6)'
                  : '0 2px 8px rgba(0,0,0,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.25s ease',
                cursor: 'default',
              }}>
                <span style={{ fontSize: isActive ? 18 : 14, lineHeight: 1 }}>{emoji}</span>
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  background: isActive ? '#6366f1' : '#334155',
                  border: '1.5px solid rgba(255,255,255,.5)',
                  borderRadius: '50%',
                  width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#fff',
                }}>
                  {idx + 1}
                </div>
              </div>
            </Marker>
          );
        })}
      </MapLibreMap>

      <button
        onClick={onFullMap}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'rgba(15,20,30,.8)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.12)', borderRadius: 10,
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span className="ms" style={{ fontSize: 18, color: '#94a3b8' }}>fit_screen</span>
      </button>

      {selectedPlaces[activeStopIdx] && selectedPlaces[activeStopIdx + 1] && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(15,20,30,.8)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 999,
          padding: '5px 12px',
          fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap',
        }}>
          <span className="ms" style={{ fontSize: 13 }}>directions_walk</span>
          Next: {selectedPlaces[activeStopIdx + 1].title}
        </div>
      )}
    </div>
  );
}
