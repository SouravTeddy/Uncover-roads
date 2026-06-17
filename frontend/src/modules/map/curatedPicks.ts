import type { Place } from '../../shared/types'

type ArchetypeId = 'wanderer' | 'historian' | 'epicurean' | 'pulse' | 'slowtraveller' | 'voyager' | 'explorer'

// Category weight per archetype — higher = more likely to surface as a golden pin
const ARCHETYPE_CATEGORY_WEIGHTS: Record<ArchetypeId, Partial<Record<string, number>>> = {
  voyager:      { museum: 1.0, historic: 1.0, gallery: 0.9, restaurant: 0.8, viewpoint: 0.7 },
  wanderer:     { market: 1.0, park: 0.9, street_art: 0.9, cafe: 0.8, viewpoint: 0.7, spiritual: 0.7 },
  epicurean:    { restaurant: 1.0, cafe: 0.9, bar: 0.8, market: 0.8, bakery: 0.7 },
  historian:    { historic: 1.0, museum: 1.0, spiritual: 0.8, gallery: 0.7, library: 0.7 },
  pulse:        { bar: 1.0, nightlife: 1.0, market: 0.8, restaurant: 0.7, viewpoint: 0.6 },
  slowtraveller:{ cafe: 1.0, park: 0.9, spiritual: 0.8, gallery: 0.7, viewpoint: 0.7 },
  explorer:     { park: 1.0, viewpoint: 0.9, museum: 0.8, tourism: 0.8, beach: 0.8, historic: 0.7 },
}

const DEFAULT_WEIGHT = 0.4
const MAX_PINS = 7
const MAX_PER_CATEGORY = 2

export function selectCuratedPicks(
  places: Place[],
  archetype: string | null | undefined,
): Place[] {
  const weights = ARCHETYPE_CATEGORY_WEIGHTS[(archetype ?? 'explorer') as ArchetypeId]
    ?? ARCHETYPE_CATEGORY_WEIGHTS.explorer

  // Score each place: rating (0–1) × category affinity weight
  const scored = places
    .filter(p => p.rating !== undefined && p.rating !== null)
    .map(p => ({
      place: p,
      score: (p.rating! / 5) * (weights[p.category] ?? DEFAULT_WEIGHT),
    }))
    .sort((a, b) => b.score - a.score)

  // Category diversity cap: max MAX_PER_CATEGORY pins per category
  const categoryCount: Record<string, number> = {}
  const result: Place[] = []

  for (const { place } of scored) {
    if (result.length >= MAX_PINS) break
    const cat = place.category
    if ((categoryCount[cat] ?? 0) >= MAX_PER_CATEGORY) continue
    categoryCount[cat] = (categoryCount[cat] ?? 0) + 1
    result.push(place)
  }

  return result
}
