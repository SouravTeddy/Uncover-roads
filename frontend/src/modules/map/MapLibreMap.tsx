// modules/map/MapLibreMap.tsx
import { useRef, useCallback } from 'react';
import Map, { MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { MapLibreMarkers } from './MapLibreMarkers';

// OpenFreeMap — completely free, no token required, OSM-based, global CDN
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface Props {
  center: [number, number]; // [lat, lon]
  zoom?: number;
  places: Place[];
  selectedPlace: Place | null;
  onPlaceClick: (place: Place) => void;
  onMoveEnd: (center: [number, number], zoom: number) => void;
  children?: React.ReactNode;
}

export function MapLibreMap({
  center,
  zoom = 13,
  places,
  selectedPlace,
  onPlaceClick,
  onMoveEnd,
  children,
}: Props) {
  const mapRef = useRef<MapRef>(null);

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      const { latitude, longitude, zoom: z } = e.viewState;
      onMoveEnd([latitude, longitude], z);
    },
    [onMoveEnd]
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        latitude: center[0],
        longitude: center[1],
        zoom,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={STYLE_URL}
      onMoveEnd={handleMoveEnd}
    >
      <MapLibreMarkers
        places={places}
        selectedPlace={selectedPlace}
        onPlaceClick={onPlaceClick}
      />
      {children}
    </Map>
  );
}
