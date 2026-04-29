// modules/map/MapLibreRoute.tsx
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayerSpecification, CircleLayerSpecification } from 'maplibre-gl';

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
    'line-color': '#e07854',
    'line-width': 3.5,
  },
};

const recBranchFoodStyle: LineLayerSpecification = {
  id: 'rec-branch-food',
  type: 'line',
  source: 'route',
  filter: ['==', ['get', 'branchCategory'], 'food'],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#c49840',
    'line-width': 1.8,
    'line-dasharray': [5, 4],
  },
};

const recBranchCafeStyle: LineLayerSpecification = {
  id: 'rec-branch-cafe',
  type: 'line',
  source: 'route',
  filter: ['==', ['get', 'branchCategory'], 'cafe'],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#6b9470',
    'line-width': 1.8,
    'line-dasharray': [5, 4],
  },
};

const recBranchViewpointStyle: LineLayerSpecification = {
  id: 'rec-branch-viewpoint',
  type: 'line',
  source: 'route',
  filter: ['==', ['get', 'branchCategory'], 'viewpoint'],
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: {
    'line-color': '#4f8fab',
    'line-width': 1.8,
    'line-dasharray': [5, 4],
  },
};

const recMarkerCircleStyle: CircleLayerSpecification = {
  id: 'rec-markers',
  type: 'circle',
  source: 'route',
  filter: ['==', ['get', 'type'], 'rec-marker'],
  paint: {
    'circle-radius': 5.5,
    'circle-color': ['get', 'categoryColor'],
    'circle-stroke-color': 'white',
    'circle-stroke-width': 1.5,
  },
};

const branchOriginDotStyle: CircleLayerSpecification = {
  id: 'branch-origin-dot',
  type: 'circle',
  source: 'route',
  filter: ['==', ['get', 'type'], 'branch-origin'],
  paint: {
    'circle-radius': 2.5,
    'circle-color': ['get', 'categoryColor'],
  },
};

export function MapLibreRoute({ geojson }: Props) {
  if (!geojson) return null;

  return (
    <Source id="route" type="geojson" data={geojson}>
      <Layer {...routeLineStyle} />
      <Layer {...recBranchFoodStyle} />
      <Layer {...recBranchCafeStyle} />
      <Layer {...recBranchViewpointStyle} />
      <Layer {...recMarkerCircleStyle} />
      <Layer {...branchOriginDotStyle} />
    </Source>
  );
}
