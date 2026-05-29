import { Source, Layer } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import type { AreaNeighborhood } from './useNeighborhoods'

interface Props {
  neighborhoods: AreaNeighborhood[]
  visible: boolean
}

function toGeoJSON(neighborhoods: AreaNeighborhood[], park: boolean) {
  return {
    type: 'FeatureCollection' as const,
    features: neighborhoods
      .filter(n => n.park === park && n.spotCount > 0)
      .map(n => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [n.lon, n.lat] },
        properties: { weight: 0.5 + 0.5 * Math.min(n.spotCount / 10, 1) },
      })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const expr = (v: unknown): any => v

function makeLayer(id: string, color: string): LayerProps {
  return {
    id,
    type: 'heatmap',
    paint: {
      'heatmap-weight': expr(['get', 'weight']),
      'heatmap-radius': expr(['interpolate', ['linear'], ['zoom'], 10, 60, 12, 120, 14, 240]),
      'heatmap-intensity': 0.85,
      'heatmap-color': expr([
        'interpolate', ['linear'], ['heatmap-density'],
        0,   `rgba(${color},0)`,
        0.3, `rgba(${color},0.09)`,
        0.7, `rgba(${color},0.26)`,
        1.0, `rgba(${color},0.42)`,
      ]),
      'heatmap-opacity': 1,
    },
  }
}

const cityLayer = makeLayer('area-blobs-city-layer', '214,170,86')
const parkLayer = makeLayer('area-blobs-park-layer', '95,165,112')

export function AreaBlobLayer({ neighborhoods, visible }: Props) {
  if (!visible || !neighborhoods.length) return null

  return (
    <>
      <Source id="area-blobs-city" type="geojson" data={toGeoJSON(neighborhoods, false)}>
        <Layer {...cityLayer} />
      </Source>
      <Source id="area-blobs-park" type="geojson" data={toGeoJSON(neighborhoods, true)}>
        <Layer {...parkLayer} />
      </Source>
    </>
  )
}
