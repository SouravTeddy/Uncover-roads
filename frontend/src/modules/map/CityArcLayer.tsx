import { Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayerSpecification } from 'maplibre-gl';
import type { CityFootprint } from '../../shared/types';

const TRANSIT_ICON: Record<string, string> = {
  flight: '✈',
  train: '🚄',
  drive: '🚗',
  bus: '🚌',
};

/**
 * Builds a GeoJSON FeatureCollection with:
 * - One LineString per consecutive city pair (32-step interpolation)
 * - One Point at the midpoint of each arc (for future transit icon placement)
 *
 * Returns null when fewer than 2 cities are provided.
 */
export function buildArcGeoJSON(
  cityFootprints: CityFootprint[],
): GeoJSON.FeatureCollection | null {
  if (cityFootprints.length < 2) return null;

  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < cityFootprints.length - 1; i++) {
    const from = cityFootprints[i];
    const to = cityFootprints[i + 1];
    const STEPS = 32;
    const coords: [number, number][] = [];
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      const lat = from.lat + (to.lat - from.lat) * t;
      const lon = from.lon + (to.lon - from.lon) * t;
      coords.push([lon, lat]); // GeoJSON is [lon, lat]
    }
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    });
    // Midpoint marker
    const midIdx = Math.floor(STEPS / 2);
    features.push({
      type: 'Feature',
      properties: {
        fromCity: from.city,
        toCity: to.city,
        transitMode: to.transitMode ?? null,
        transitIcon: to.transitMode ? (TRANSIT_ICON[to.transitMode] ?? '') : '',
      },
      geometry: { type: 'Point', coordinates: coords[midIdx] },
    });
  }

  return { type: 'FeatureCollection', features };
}

const arcLineStyle: LineLayerSpecification = {
  id: 'city-arc-line',
  type: 'line',
  source: 'city-arc',
  filter: ['==', ['geometry-type'], 'LineString'],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#c49840',
    'line-width': 2,
    'line-dasharray': [4, 3],
    'line-opacity': 0.7,
  },
};

interface Props {
  cityFootprints: CityFootprint[];
}

export function CityArcLayer({ cityFootprints }: Props) {
  const geojson = buildArcGeoJSON(cityFootprints);
  if (!geojson) return null;

  return (
    <Source id="city-arc" type="geojson" data={geojson}>
      <Layer {...arcLineStyle} />
    </Source>
  );
}
