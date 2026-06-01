import { Source, Layer } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { AreaNeighborhood } from './useNeighborhoods'

interface Props {
  places: Place[]
  neighborhoods: AreaNeighborhood[]
  visible: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const expr = (v: unknown): any => v

function pinGeoJSON(places: Place[], parkOnly: boolean) {
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

function hoodGeoJSON(hoods: AreaNeighborhood[], parkOnly: boolean) {
  return {
    type: 'FeatureCollection' as const,
    features: hoods
      .filter(n => parkOnly ? n.park : !n.park)
      .map(n => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [n.lon, n.lat] },
        // weight based on how many spots this neighbourhood has — richer areas glow brighter
        properties: { weight: Math.min(1.0, 0.4 + n.spotCount * 0.06) },
      })),
  }
}

// Neighbourhood-centroid layer — city-wide distinct blobs at low zoom
function makeHoodLayer(id: string, color: string): LayerProps {
  return {
    id,
    type: 'heatmap',
    paint: {
      'heatmap-weight': expr(['get', 'weight']),
      // Large radius at city-overview so each neighbourhood fills a visible blob.
      // Shrinks as user zooms in (pin-density layer takes over).
      'heatmap-radius': expr(['interpolate', ['linear'], ['zoom'],
        7,  60,
        9,  80,
        11, 60,
        13,  0,
      ]),
      'heatmap-intensity': 1.8,
      'heatmap-color': expr([
        'interpolate', ['linear'], ['heatmap-density'],
        0,   `rgba(${color},0)`,
        0.08, `rgba(${color},0.12)`,
        0.35, `rgba(${color},0.30)`,
        1.0,  `rgba(${color},0.50)`,
      ]),
      // Visible when zoomed out; fades as pin layer takes over
      'heatmap-opacity': expr(['interpolate', ['linear'], ['zoom'],
        8,  0.0,
        9,  0.92,
        12, 0.85,
        13, 0.0,
      ]),
    },
  }
}

// Pin-density layer — visible from city overview down to local street level.
// Large radius at low zoom creates organic city-wide blobs from real pin clusters.
function makePinLayer(id: string, color: string): LayerProps {
  return {
    id,
    type: 'heatmap',
    paint: {
      'heatmap-weight': expr(['get', 'weight']),
      'heatmap-radius': expr(['interpolate', ['linear'], ['zoom'],
        8,  40,
        10, 25,
        12, 45,
        14, 80,
      ]),
      'heatmap-intensity': 1.4,
      'heatmap-color': expr([
        'interpolate', ['linear'], ['heatmap-density'],
        0,   `rgba(${color},0)`,
        0.1, `rgba(${color},0.10)`,
        0.4, `rgba(${color},0.26)`,
        1.0, `rgba(${color},0.44)`,
      ]),
      // Starts visible at city overview zoom, fades at street level where pins take over
      'heatmap-opacity': expr(['interpolate', ['linear'], ['zoom'],
        8,  0.0,
        9,  0.85,
        13, 0.7,
        14, 0.0,
      ]),
    },
  }
}

const hoodCityLayer = makeHoodLayer('area-blobs-hood-city-layer', '214,170,86')
const hoodParkLayer = makeHoodLayer('area-blobs-hood-park-layer', '95,165,112')
const pinCityLayer  = makePinLayer('area-blobs-city-layer',  '214,170,86')
const pinParkLayer  = makePinLayer('area-blobs-park-layer',  '95,165,112')

export function AreaBlobLayer({ places, neighborhoods, visible }: Props) {
  if (!visible) return null

  const hasHoods = neighborhoods.length > 0

  return (
    <>
      {/* Neighbourhood-centroid blobs — city-wide, visible when zoomed out */}
      {hasHoods && (
        <>
          <Source id="area-blobs-hood-city" type="geojson" data={hoodGeoJSON(neighborhoods, false)}>
            <Layer {...hoodCityLayer} />
          </Source>
          <Source id="area-blobs-hood-park" type="geojson" data={hoodGeoJSON(neighborhoods, true)}>
            <Layer {...hoodParkLayer} />
          </Source>
        </>
      )}

      {/* Pin-density blobs — local fill as user zooms in */}
      {places.length > 0 && (
        <>
          <Source id="area-blobs-city" type="geojson" data={pinGeoJSON(places, false)}>
            <Layer {...pinCityLayer} />
          </Source>
          <Source id="area-blobs-park" type="geojson" data={pinGeoJSON(places, true)}>
            <Layer {...pinParkLayer} />
          </Source>
        </>
      )}
    </>
  )
}
