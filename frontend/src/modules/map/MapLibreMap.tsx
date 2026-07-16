// modules/map/MapLibreMap.tsx
import { useRef, useCallback, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import type { MapRef as LibreMapRef, ViewStateChangeEvent, MapMouseEvent, MapEvent } from 'react-map-gl/maplibre';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inject3DBuildings(style: any): any {
  const isDark = document.documentElement.dataset.theme !== 'light'
  // Find the first symbol layer (labels) to insert buildings below it
  const firstSymbol = style.layers.findIndex((l: any) => l.type === 'symbol')
  const insertAt = firstSymbol >= 0 ? firstSymbol : style.layers.length

  const buildingLayer = {
    id: 'ur-3d-buildings',
    type: 'fill-extrusion',
    source: 'carto',
    'source-layer': 'building',
    minzoom: 14,
    paint: {
      'fill-extrusion-color': isDark ? '#1e1c1a' : '#d8d0c8',
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
      'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, isDark ? 0.82 : 0.72],
    },
  }

  const layers = [...style.layers]
  layers.splice(insertAt, 0, buildingLayer)
  return { ...style, layers }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleLabels(style: any): any {
  const isDark = document.documentElement.dataset.theme !== 'light'
  // Override text color on all symbol (label) layers to match theme
  const textColor = isDark ? 'rgba(215,205,190,.82)' : 'rgba(38,28,18,.72)'
  const haloColor = isDark ? 'rgba(10,9,8,.7)' : 'rgba(255,252,248,.8)'
  return {
    ...style,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layers: style.layers.map((layer: any) => {
      if (layer.type !== 'symbol' || !layer.paint?.['text-color']) return layer
      return {
        ...layer,
        paint: {
          ...layer.paint,
          'text-color': textColor,
          'text-halo-color': haloColor,
          'text-halo-width': 1.2,
        },
      }
    }),
  }
}

async function fetchMapStyle(url: string): Promise<StyleSpecification> {
  const res = await fetch(url)
  const style = await res.json()
  return inject3DBuildings(styleLabels(forceEnglishLabels(style)))
}

export interface MapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
  resetNorth: () => void;
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
  onBearingChange?: (bearing: number) => void;
  onClick?: (lngLat: { lat: number; lng: number }) => void;
  onLoad?: () => void;
  routeGeojson?: GeoJSON.Feature<GeoJSON.LineString> | null;
  pinDropResult?: { lat: number; lon: number } | null;
  children?: React.ReactNode;
}

export const MapLibreMap = forwardRef<MapHandle, Props>(function MapLibreMap(
  { center, zoom = 13, places, selectedPlace, selectedPlaces, highlightIds, onPlaceClick, onMoveEnd, onBearingChange, onClick, onLoad, routeGeojson, pinDropResult, children },
  ref,
) {
  const mapRef = useRef<LibreMapRef>(null);
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);

  useEffect(() => {
    fetchMapStyle(getMapStyleUrl()).then(setMapStyle);
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lon: number, targetZoom = 15) {
      mapRef.current?.flyTo({ center: [lon, lat], zoom: targetZoom, duration: 800 });
    },
    resetNorth() {
      mapRef.current?.rotateTo(0, { duration: 400 });
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

  const handleMove = useCallback(
    (e: MapEvent) => {
      onBearingChange?.((e.target as any).getBearing() as number);
    },
    [onBearingChange],
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      fetchMapStyle(getMapStyleUrl()).then(setMapStyle);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!mapStyle) return null;

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: center[0], longitude: center[1], zoom, pitch: 35, bearing: 0 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      maxPitch={60}
      onMoveEnd={handleMoveEnd}
      onMove={onBearingChange ? handleMove : undefined}
      onClick={onClick ? (e: MapMouseEvent) => onClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }) : undefined}
      onLoad={onLoad}
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
