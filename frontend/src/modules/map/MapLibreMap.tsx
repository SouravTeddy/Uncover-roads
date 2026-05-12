// modules/map/MapLibreMap.tsx
import { useRef, useCallback, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapRef as LibreMapRef, ViewStateChangeEvent, MapMouseEvent } from 'react-map-gl/maplibre';
import type { Place } from '../../shared/types';
import { MapLibreMarkers } from './MapLibreMarkers';
import { MapLibreRoute } from './MapLibreRoute';

function getTileUrl(): string {
  return document.documentElement.dataset.theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png';
}

function buildMapStyle(tileUrl: string) {
  return {
    version: 8 as const,
    sources: {
      'carto-tiles': {
        type: 'raster' as const,
        tiles: [tileUrl.replace('{s}', 'a'), tileUrl.replace('{s}', 'b'), tileUrl.replace('{s}', 'c')],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'carto-tiles',
        type: 'raster' as const,
        source: 'carto-tiles',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

export interface MapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

interface Props {
  center: [number, number]; // [lat, lon]
  zoom?: number;
  places: Place[];
  selectedPlace: Place | null;
  highlightIds?: Set<string>;
  onPlaceClick: (place: Place) => void;
  /** Called on every map move end. bbox = [south, north, west, east] */
  onMoveEnd: (center: [number, number], zoom: number, bbox: [number, number, number, number]) => void;
  onClick?: (lngLat: { lat: number; lng: number }) => void;
  routeGeojson?: GeoJSON.Feature<GeoJSON.LineString> | null;
  pinDropResult?: { lat: number; lon: number } | null;
  children?: React.ReactNode;
}

export const MapLibreMap = forwardRef<MapHandle, Props>(function MapLibreMap(
  { center, zoom = 13, places, selectedPlace, highlightIds, onPlaceClick, onMoveEnd, onClick, routeGeojson, pinDropResult, children },
  ref,
) {
  const mapRef = useRef<LibreMapRef>(null);
  const [mapStyle, setMapStyle] = useState(() => buildMapStyle(getTileUrl()));

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lon: number, targetZoom = 15) {
      mapRef.current?.flyTo({ center: [lon, lat], zoom: targetZoom, duration: 800 });
    },
  }));

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      const { latitude, longitude, zoom: z } = e.viewState;
      const b = e.target.getBounds();
      onMoveEnd(
        [latitude, longitude],
        z,
        [b.getSouth(), b.getNorth(), b.getWest(), b.getEast()],
      );
    },
    [onMoveEnd],
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMapStyle(buildMapStyle(getTileUrl()));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: center[0], longitude: center[1], zoom }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      onMoveEnd={handleMoveEnd}
      onClick={onClick ? (e: MapMouseEvent) => onClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }) : undefined}
    >
      <MapLibreRoute geojson={routeGeojson ?? null} />
      <MapLibreMarkers
        places={places}
        selectedPlace={selectedPlace}
        highlightIds={highlightIds ?? new Set()}
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
