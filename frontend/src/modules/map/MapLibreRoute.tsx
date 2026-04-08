// modules/map/MapLibreRoute.tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayerSpecification } from 'maplibre-gl';

interface Props {
  geojson: GeoJSON.Feature<GeoJSON.LineString> | null;
}

const routeLineStyle: LineLayerSpecification = {
  id: 'route-line',
  type: 'line',
  source: 'route',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#6366f1',
    'line-width': 4,
    'line-opacity': 0.85,
  },
};

export function MapLibreRoute({ geojson }: Props) {
  if (!geojson) return null;

  return (
    <Source id="route" type="geojson" data={geojson}>
      <Layer {...routeLineStyle} />
    </Source>
  );
}
