import { Source, Layer } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'

interface Props {
  places: Place[]
  visible: boolean
}

function toGeoJSON(places: Place[], parkOnly: boolean) {
  return {
    type: 'FeatureCollection' as const,
    features: places
      .filter(p => parkOnly ? p.category === 'park' : p.category !== 'park')
      .map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
        properties: { weight: 0.8 },
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
      'heatmap-radius': expr(['interpolate', ['linear'], ['zoom'], 10, 40, 12, 80, 14, 160]),
      'heatmap-intensity': 0.7,
      'heatmap-color': expr([
        'interpolate', ['linear'], ['heatmap-density'],
        0,   `rgba(${color},0)`,
        0.2, `rgba(${color},0.06)`,
        0.5, `rgba(${color},0.20)`,
        1.0, `rgba(${color},0.38)`,
      ]),
      'heatmap-opacity': 1,
    },
  }
}

const cityLayer = makeLayer('area-blobs-city-layer', '214,170,86')
const parkLayer = makeLayer('area-blobs-park-layer', '95,165,112')

export function AreaBlobLayer({ places, visible }: Props) {
  if (!visible || !places.length) return null

  return (
    <>
      <Source id="area-blobs-city" type="geojson" data={toGeoJSON(places, false)}>
        <Layer {...cityLayer} />
      </Source>
      <Source id="area-blobs-park" type="geojson" data={toGeoJSON(places, true)}>
        <Layer {...parkLayer} />
      </Source>
    </>
  )
}
