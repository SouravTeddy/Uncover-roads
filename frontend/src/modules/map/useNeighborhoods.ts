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
    const slug = city.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

    void (async () => {
      const { data } = await supabase.from('city_data').select('data').eq('id', slug).maybeSingle()
      const nbhs = data?.data?.neighborhoods
      if (Array.isArray(nbhs) && nbhs.length > 0) { setRaw(nbhs); return }

      // city_data not yet seeded — ask backend to seed, then retry once
      try {
        await fetch(`${BASE}/api/cities/seed?city_id=${encodeURIComponent(slug)}`, { method: 'POST' })
      } catch { /* network error — skip */ }

      const retry = await supabase.from('city_data').select('data').eq('id', slug).maybeSingle()
      const retryNbhs = retry.data?.data?.neighborhoods
      if (Array.isArray(retryNbhs) && retryNbhs.length > 0) setRaw(retryNbhs)
    })()
  }, [city])

  return useMemo(() => {
    if (!raw.length) return []
    // Only use neighborhoods that came from real OSM data (filter out synthetic fallbacks)
    const real = raw.filter(n => !n.id.startsWith('area_') && !n.id.startsWith('synthetic_'))
    if (!real.length) return []
    return real.map(n => {
      const [lat, lon] = n.center
      const radiusM = n.polygon.length
        ? Math.max(...n.polygon.map(([plat, plon]) => distM(lat, lon, plat, plon))) * 1.6
        : 800
      const park = /park|garden|forest|green|reserve|nature/i.test(n.name)
      const areaPlaces = places.filter(p => {
        let best = real[0], bestD = Infinity
        for (const nb of real) {
          const d = distM(p.lat, p.lon, nb.center[0], nb.center[1])
          if (d < bestD) { bestD = d; best = nb }
        }
        return best.id === n.id
      })
      return { id: n.id, name: n.name, lat, lon, radiusM, park, spotCount: areaPlaces.length, places: areaPlaces }
    })
  }, [raw, places])
}
