// modules/map/MapLibreMap.tsx
import { useRef, useCallback, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapRef as LibreMapRef, ViewStateChangeEvent, MapMouseEvent } from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import type { Place } from '../../shared/types';
import { MapLibreMarkers } from './MapLibreMarkers';
import { MapLibreRoute } from './MapLibreRoute';

function getMapStyleUrl(): string {
  const isDark = document.documentElement.dataset.theme !== 'light'
  return isDark
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function forceEnglishLabels(style: any): any {
  const englishField = ['coalesce', ['get', 'name:en'], ['get', 'name']]
  return {
    ...style,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layers: style.layers.map((layer: any) => {
      if (layer.layout?.['text-field'] !== undefined) {
        return { ...layer, layout: { ...layer.layout, 'text-field': englishField } }
      }
      return layer
    }),
  }
}

async function fetchMapStyle(url: string): Promise<StyleSpecification> {
  const res = await fetch(url)
  const style = await res.json()
  return forceEnglishLabels(style)
}

export interface MapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

interface Props {
  center: [number, number]; // [lat, lon]
  zoom?: number;
  places: Place[];
  selectedPlace: Place | null;
  selectedPlaces?: Place[];
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
  { center, zoom = 13, places, selectedPlace, selectedPlaces, highlightIds, onPlaceClick, onMoveEnd, onClick, routeGeojson, pinDropResult, children },
  ref,
) {
  const mapRef = useRef<LibreMapRef>(null);
  const [mapStyle, setMapStyle] = useState<string | StyleSpecification>(getMapStyleUrl());

  useEffect(() => {
    fetchMapStyle(getMapStyleUrl()).then(setMapStyle);
  }, []);

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
      fetchMapStyle(getMapStyleUrl()).then(setMapStyle);
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
        selectedPlaces={selectedPlaces ?? []}
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
