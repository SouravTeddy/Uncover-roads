// modules/map/MapLibreMap.tsx
import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapRef, ViewStateChangeEvent, MapMouseEvent } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { MapLibreMarkers } from './MapLibreMarkers';
import { MapLibreRoute } from './MapLibreRoute';

// OpenFreeMap — completely free, no token required, OSM-based, global CDN
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export interface MapLibreMapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

interface Props {
  center: [number, number]; // [lat, lon]
  zoom?: number;
  places: Place[];
  selectedPlace: Place | null;
  onPlaceClick: (place: Place) => void;
  onMoveEnd: (center: [number, number], zoom: number) => void;
  onClick?: (lngLat: { lat: number; lng: number }) => void;
  routeGeojson?: GeoJSON.Feature<GeoJSON.LineString> | null;
  pinDropResult?: { lat: number; lon: number } | null;
  children?: React.ReactNode;
}

export const MapLibreMap = forwardRef<MapLibreMapHandle, Props>(function MapLibreMap({
  center,
  zoom = 13,
  places,
  selectedPlace,
  onPlaceClick,
  onMoveEnd,
  onClick,
  routeGeojson,
  pinDropResult,
  children,
}: Props, ref) {
  const mapRef = useRef<MapRef>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lon: number, zoom = 15) => {
      mapRef.current?.flyTo({ center: [lon, lat], zoom, duration: 600 });
    },
  }));

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
      onClick={onClick ? (e: MapMouseEvent) => onClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }) : undefined}
    >
      <MapLibreRoute geojson={routeGeojson ?? null} />
      <MapLibreMarkers
        places={places}
        selectedPlace={selectedPlace}
        onPlaceClick={onPlaceClick}
      />
      {pinDropResult && (
        <Marker latitude={pinDropResult.lat} longitude={pinDropResult.lon}>
          <div className="pin-drop-marker">
            <div className="pin-drop-pulse" />
            <div className="pin-drop-dot" />
          </div>
        </Marker>
      )}
      {children}
    </Map>
  );
});
