import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../shared/supabase'
import type { Place } from '../../shared/types'

export interface AreaNeighborhood {
  id: string
  name: string
  lat: number
  lon: number
  radiusM: number   // blob radius in meters, derived from polygon extent
  park: boolean     // green color vs gold
  spotCount: number // total places in this area
  places: Place[]
}

// haversine distance in meters
function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function useNeighborhoods(city: string | null, places: Place[]): AreaNeighborhood[] {
  const [raw, setRaw] = useState<Array<{ id: string; name: string; center: [number, number]; polygon: [number, number][] }>>([])

  useEffect(() => {
    if (!city) return
    void supabase.from('city_data').select('data').eq('id', city.toLowerCase()).single()
      .then(({ data }) => {
        const nbhs = data?.data?.neighborhoods
        if (Array.isArray(nbhs) && nbhs.length > 0) setRaw(nbhs)
      })
  }, [city])

  return useMemo(() => {
    if (!raw.length) return []
    return raw.map(n => {
      const [lat, lon] = n.center
      // radius = max distance from centroid to any polygon vertex
      const radiusM = n.polygon.length
        ? Math.max(...n.polygon.map(([plat, plon]) => distM(lat, lon, plat, plon))) * 1.6
        : 800
      const park = /park|garden|forest|green|reserve|nature/i.test(n.name)
      // assign each place to nearest centroid
      const areaPlaces = places.filter(p => {
        if (!raw.length) return false
        let best = raw[0], bestD = Infinity
        for (const nb of raw) {
          const d = distM(p.lat, p.lon, nb.center[0], nb.center[1])
          if (d < bestD) { bestD = d; best = nb }
        }
        return best.id === n.id
      })
      return { id: n.id, name: n.name, lat, lon, radiusM, park, spotCount: areaPlaces.length, places: areaPlaces }
    })
  }, [raw, places])
}
