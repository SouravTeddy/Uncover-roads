import { Source, Layer } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import type { Place } from '../../shared/types'
import type { AreaNeighborhood } from './useNeighborhoods'
import type { HeatmapPoint } from './useHeatmapSeed'

interface Props {
  places: Place[]
  neighborhoods: AreaNeighborhood[]
  heatmapSeeds: HeatmapPoint[]
  visible: boolean
  bbox: [number, number, number, number] | null  // [minLat, maxLat, minLon, maxLon]
  mapCenter: { lat: number; lon: number } | null
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
        properties: { weight: Math.min(1.0, 0.4 + n.spotCount * 0.06) },
      })),
  }
}

function seedGeoJSON(seeds: HeatmapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: seeds.map(s => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
      properties: { weight: 0.7 },
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

// Normal paint values — mirror what's inside makeHoodLayer / makePinLayer
const hoodOpacityNormal = expr(['interpolate', ['linear'], ['zoom'],
  8, 0.0, 9, 0.92, 12, 0.85, 13, 0.0,
])
const hoodRadiusNormal = expr(['interpolate', ['linear'], ['zoom'],
  7, 60, 9, 80, 11, 60, 13, 0,
])
const pinOpacityNormal = expr(['interpolate', ['linear'], ['zoom'],
  8, 0.0, 9, 0.85, 13, 0.7, 14, 0.0,
])
// Hold paint — stays visible at street-level zoom while pins are still loading
// Radius must be held too; opacity alone does nothing when radius is 0
const hoodOpacityHold = expr(['interpolate', ['linear'], ['zoom'],
  8, 0.0, 9, 0.92, 14, 0.85, 16, 0.0,
])
const hoodRadiusHold = expr(['interpolate', ['linear'], ['zoom'],
  7, 60, 9, 80, 11, 60, 13, 30, 15, 18, 16, 0,
])
const pinOpacityHold = expr(['interpolate', ['linear'], ['zoom'],
  8, 0.0, 9, 0.85, 15, 0.7, 16, 0.0,
])

function pinsInViewport(places: Place[], bbox: [number, number, number, number]): boolean {
  const [minLat, maxLat, minLon, maxLon] = bbox
  return places.some(p => p.lat >= minLat && p.lat <= maxLat && p.lon >= minLon && p.lon <= maxLon)
}

export function AreaBlobLayer({ places, neighborhoods, heatmapSeeds, visible, bbox, mapCenter }: Props) {
  if (!visible) return null

  const hasSeeds = heatmapSeeds.length > 0
  const hasHoods = !hasSeeds && neighborhoods.length > 0
  // Hold heatmap when viewport has no pins — prevents blank-map gap while pins load
  const hasPins = bbox ? pinsInViewport(places, bbox) : places.length > 0
  const hoodOpacity = hasPins ? hoodOpacityNormal : hoodOpacityHold
  const hoodRadius  = hasPins ? hoodRadiusNormal  : hoodRadiusHold
  const pinOpacity  = hasPins ? pinOpacityNormal  : pinOpacityHold

  // When no pins in view, inject map center as phantom seed so the hold-mode
  // heatmap always has a data point to render — otherwise layer is invisible
  // even with opacity/radius held if no seed happens to fall in the viewport
  const effectiveSeeds = (!hasPins && mapCenter)
    ? [...heatmapSeeds, { lat: mapCenter.lat, lon: mapCenter.lon }]
    : heatmapSeeds

  return (
    <>
      {hasSeeds && (
        <Source id="area-blobs-seed" type="geojson" data={seedGeoJSON(effectiveSeeds)}>
          <Layer {...({ ...(hoodCityLayer as any), paint: expr({ ...(hoodCityLayer as any).paint, 'heatmap-opacity': hoodOpacity, 'heatmap-radius': hoodRadius }) } as any)} />
        </Source>
      )}

      {hasHoods && (
        <>
          <Source id="area-blobs-hood-city" type="geojson" data={hoodGeoJSON(neighborhoods, false)}>
            <Layer {...({ ...(hoodCityLayer as any), paint: expr({ ...(hoodCityLayer as any).paint, 'heatmap-opacity': hoodOpacity, 'heatmap-radius': hoodRadius }) } as any)} />
          </Source>
          <Source id="area-blobs-hood-park" type="geojson" data={hoodGeoJSON(neighborhoods, true)}>
            <Layer {...({ ...(hoodParkLayer as any), paint: expr({ ...(hoodParkLayer as any).paint, 'heatmap-opacity': hoodOpacity, 'heatmap-radius': hoodRadius }) } as any)} />
          </Source>
        </>
      )}

      {places.length > 0 && (
        <>
          <Source id="area-blobs-city" type="geojson" data={pinGeoJSON(places, false)}>
            <Layer {...({ ...(pinCityLayer as any), paint: expr({ ...(pinCityLayer as any).paint, 'heatmap-opacity': pinOpacity }) } as any)} />
          </Source>
          <Source id="area-blobs-park" type="geojson" data={pinGeoJSON(places, true)}>
            <Layer {...({ ...(pinParkLayer as any), paint: expr({ ...(pinParkLayer as any).paint, 'heatmap-opacity': pinOpacity }) } as any)} />
          </Source>
        </>
      )}
    </>
  )
}
