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
      const { data } = await supabase.from('city_data').select('data').eq('id', slug).single()
      const nbhs = data?.data?.neighborhoods
      if (Array.isArray(nbhs) && nbhs.length > 0) { setRaw(nbhs); return }

      // city_data not yet seeded — ask backend to seed, then retry once
      try {
        await fetch(`${BASE}/api/cities/seed?city_id=${encodeURIComponent(slug)}`, { method: 'POST' })
      } catch { /* network error — skip */ }

      const retry = await supabase.from('city_data').select('data').eq('id', slug).single()
      const retryNbhs = retry.data?.data?.neighborhoods
      if (Array.isArray(retryNbhs) && retryNbhs.length > 0) setRaw(retryNbhs)
    })()
  }, [city])

  // When city_data has too few neighborhoods (common for Indian/Asian cities where
  // OSM admin boundaries don't follow admin_level 8-10), generate a synthetic
  // hexagonal grid so the hood heatmap layer shows meaningful city-wide coverage.
  const effectiveRaw = useMemo(() => {
    if (raw.length >= 3) return raw
    const centerLat = raw[0]?.center[0] ?? (places[0]?.lat ?? 0)
    const centerLon = raw[0]?.center[1] ?? (places[0]?.lon ?? 0)
    if (!centerLat && !centerLon) return raw
    // 6 hex points at ~5km + the center itself
    const R_LAT = 0.045  // ≈ 5km
    const R_LON = R_LAT / Math.cos(centerLat * Math.PI / 180)
    const hexPoints = [0, 60, 120, 180, 240, 300].map((deg, i) => {
      const rad = deg * Math.PI / 180
      return {
        id: `synthetic_${i}`,
        name: `Area ${i + 1}`,
        center: [centerLat + R_LAT * Math.cos(rad), centerLon + R_LON * Math.sin(rad)] as [number, number],
        polygon: [] as [number, number][],
      }
    })
    return [...(raw.length ? raw : [{ id: 'synthetic_center', name: 'Center', center: [centerLat, centerLon] as [number, number], polygon: [] as [number, number][] }]), ...hexPoints]
  }, [raw, places])

  return useMemo(() => {
    if (!effectiveRaw.length) return []
    return effectiveRaw.map(n => {
      const [lat, lon] = n.center
      const radiusM = n.polygon.length
        ? Math.max(...n.polygon.map(([plat, plon]) => distM(lat, lon, plat, plon))) * 1.6
        : 800
      const park = /park|garden|forest|green|reserve|nature/i.test(n.name)
      const areaPlaces = places.filter(p => {
        if (!effectiveRaw.length) return false
        let best = effectiveRaw[0], bestD = Infinity
        for (const nb of effectiveRaw) {
          const d = distM(p.lat, p.lon, nb.center[0], nb.center[1])
          if (d < bestD) { bestD = d; best = nb }
        }
        return best.id === n.id
      })
      return { id: n.id, name: n.name, lat, lon, radiusM, park, spotCount: areaPlaces.length, places: areaPlaces }
    })
  }, [effectiveRaw, places])
}
