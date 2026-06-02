import { useEffect, useRef, useState } from 'react'

export interface HeatmapPoint { lat: number; lon: number }

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const RETRIGGER_KM = 10  // re-fetch when center moves this far (~half the 20km tile radius)

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
    const res = await fetch(`${BASE}/heatmap-seed?lat=${lat}&lon=${lon}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.points) ? data.points : []
  } catch {
    return []
  }
}

// ~0.18 degrees offset ≈ 20km — seeds four quadrants around city center on first load
const SEED_OFFSET = 0.18

function mergePoints(prev: HeatmapPoint[], fresh: HeatmapPoint[]): HeatmapPoint[] {
  const existing = new Set(prev.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`))
  const added = fresh.filter(p => !existing.has(`${p.lat.toFixed(4)},${p.lon.toFixed(4)}`))
  const merged = [...prev, ...added]
  return merged.length > 800 ? merged.slice(merged.length - 800) : merged
}

/**
 * Continuously builds city-wide heatmap anchor points.
 * On city load: seeds center + four quadrant offsets (~20km out) in parallel.
 * Re-fetches whenever the user pans >10km to fill new areas incrementally.
 */
export function useHeatmapSeed(
  cityCenter: { lat: number; lon: number } | null,
  mapCenter: { lat: number; lon: number } | null,
): HeatmapPoint[] {
  const [points, setPoints] = useState<HeatmapPoint[]>([])
  const lastSeedCenter = useRef<HeatmapPoint | null>(null)
  const seededCities = useRef<Set<string>>(new Set())

  // Initial seed on city load — center + four quadrant offsets for broad coverage
  useEffect(() => {
    if (!cityCenter) return
    const key = `${cityCenter.lat.toFixed(2)},${cityCenter.lon.toFixed(2)}`
    if (seededCities.current.has(key)) return
    seededCities.current.add(key)
    setPoints([])  // clear old city's seeds
    lastSeedCenter.current = cityCenter

    const { lat, lon } = cityCenter
    const offsets: [number, number][] = [
      [lat, lon],
      [lat + SEED_OFFSET, lon + SEED_OFFSET],
      [lat + SEED_OFFSET, lon - SEED_OFFSET],
      [lat - SEED_OFFSET, lon + SEED_OFFSET],
      [lat - SEED_OFFSET, lon - SEED_OFFSET],
    ]
    Promise.all(offsets.map(([la, lo]) => fetchSeeds(la, lo))).then(results => {
      const all = results.flat()
      if (all.length) setPoints(prev => mergePoints(prev, all))
    })
  }, [cityCenter])

  // Re-seed when user pans significantly
  useEffect(() => {
    if (!mapCenter || !lastSeedCenter.current) return
    if (distKm(mapCenter, lastSeedCenter.current) < RETRIGGER_KM) return
    lastSeedCenter.current = mapCenter
    fetchSeeds(mapCenter.lat, mapCenter.lon).then(pts => {
      if (!pts.length) return
      setPoints(prev => mergePoints(prev, pts))
    })
  }, [mapCenter])

  return points
}
