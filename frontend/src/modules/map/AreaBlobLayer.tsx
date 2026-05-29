import { Source, Layer } from 'react-map-gl/maplibre'
import type { AreaNeighborhood } from './useNeighborhoods'

interface Props {
  neighborhoods: AreaNeighborhood[]
  visible: boolean  // false when activeFilter !== 'all'
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

export function AreaBlobLayer({ neighborhoods, visible }: Props) {
  if (!visible || !neighborhoods.length) return null

  const cityData = toGeoJSON(neighborhoods, false)
  const parkData = toGeoJSON(neighborhoods, true)

  const opacity = 1

  const heatmapCity = {
    type: 'heatmap' as const,
    paint: {
      'heatmap-weight': ['get', 'weight'] as unknown as number,
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 60, 12, 120, 14, 240] as unknown as number,
      'heatmap-intensity': 0.85,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(214,170,86,0)',
        0.3, 'rgba(214,170,86,0.09)',
        0.7, 'rgba(214,170,86,0.26)',
        1.0, 'rgba(214,170,86,0.42)',
      ],
      'heatmap-opacity': opacity,
    },
  }

  const heatmapPark = {
    type: 'heatmap' as const,
    paint: {
      'heatmap-weight': ['get', 'weight'] as unknown as number,
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 60, 12, 120, 14, 240] as unknown as number,
      'heatmap-intensity': 0.85,
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,   'rgba(95,165,112,0)',
        0.3, 'rgba(95,165,112,0.10)',
        0.7, 'rgba(95,165,112,0.30)',
        1.0, 'rgba(95,165,112,0.44)',
      ],
      'heatmap-opacity': opacity,
    },
  }

  return (
    <>
      <Source id="area-blobs-city" type="geojson" data={cityData}>
        <Layer id="area-blobs-city-layer" {...heatmapCity} />
      </Source>
      <Source id="area-blobs-park" type="geojson" data={parkData}>
        <Layer id="area-blobs-park-layer" {...heatmapPark} />
      </Source>
    </>
  )
}
