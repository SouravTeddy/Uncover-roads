import { useEffect, useRef, useState } from 'react'

export interface HeatmapPoint { lat: number; lon: number }

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const RETRIGGER_KM = 15  // re-fetch when center moves this far

function distKm(a: HeatmapPoint, b: HeatmapPoint): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lon - a.lon) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

async function fetchSeeds(lat: number, lon: number): Promise<HeatmapPoint[]> {
  try {
    const res = await fetch(`${BASE}/heatmap-seed?lat=${lat}&lon=${lon}&radius_km=80`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.points) ? data.points : []
  } catch {
    return []
  }
}

/**
 * Continuously builds city-wide heatmap anchor points.
 * Fires once on city load then re-fetches whenever the user's centre moves >15km.
 * Points accumulate so the heatmap fills in as the user explores.
 */
export function useHeatmapSeed(
  cityCenter: { lat: number; lon: number } | null,
  mapCenter: { lat: number; lon: number } | null,
): HeatmapPoint[] {
  const [points, setPoints] = useState<HeatmapPoint[]>([])
  const lastSeedCenter = useRef<HeatmapPoint | null>(null)
  const seededCities = useRef<Set<string>>(new Set())

  // Initial seed on city load
  useEffect(() => {
    if (!cityCenter) return
    const key = `${cityCenter.lat.toFixed(2)},${cityCenter.lon.toFixed(2)}`
    if (seededCities.current.has(key)) return
    seededCities.current.add(key)
    setPoints([])  // clear old city's seeds
    lastSeedCenter.current = cityCenter
    fetchSeeds(cityCenter.lat, cityCenter.lon).then(pts => {
      if (pts.length) setPoints(pts)
    })
  }, [cityCenter])

  // Re-seed when user moves significantly
  useEffect(() => {
    if (!mapCenter || !lastSeedCenter.current) return
    if (distKm(mapCenter, lastSeedCenter.current) < RETRIGGER_KM) return
    lastSeedCenter.current = mapCenter
    fetchSeeds(mapCenter.lat, mapCenter.lon).then(pts => {
      if (!pts.length) return
      setPoints(prev => {
        const existing = new Set(prev.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`))
        const fresh = pts.filter(p => !existing.has(`${p.lat.toFixed(4)},${p.lon.toFixed(4)}`))
        const merged = [...prev, ...fresh]
        return merged.length > 600 ? merged.slice(merged.length - 600) : merged
      })
    })
  }, [mapCenter])

  return points
}
