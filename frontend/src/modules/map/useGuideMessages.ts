import { useEffect, useRef, useState } from 'react'
import type { Place, LiveEvent, Persona, PersonaProfile } from '../../shared/types'

export interface GuideMessage {
  id: string
  text: string
  kind: 'area' | 'event' | 'exploring'
  timestamp: number
  actionPlaceId?: string  // place to reveal on map when tapped
}

// ── Persona tag → place category ─────────────────────────────────────────────
// venue_filters stores human-readable placeTags (e.g. 'Heritage Sites').
// Place categories are lowercase OSM values (e.g. 'historic').
export const PLACE_TAG_TO_CATEGORY: Record<string, string> = {
  'local cafés': 'cafe', 'beautiful cafés': 'cafe', 'morning cafés': 'cafe',
  'parks': 'park', 'neighbourhood parks': 'park',
  'street food': 'restaurant', 'food halls': 'restaurant', 'bakeries': 'restaurant',
  "chef's tables": 'restaurant', 'late restaurants': 'restaurant',
  'wine bars': 'bar', 'cocktail bars': 'bar', 'corner bars': 'bar',
  'rooftop bars': 'bar', 'old bars': 'bar',
  'heritage sites': 'historic', 'historic squares': 'historic', 'old quarters': 'historic',
  'architecture': 'historic',
  'key landmarks': 'tourism', 'courtyards': 'tourism', 'design districts': 'tourism',
  'museums': 'museum', 'cultural spots': 'museum',
  'galleries': 'gallery',
  'viewpoints': 'viewpoint', 'rooftops': 'viewpoint',
  'live music': 'nightlife', 'night markets': 'nightlife',
  'side streets': 'place', 'markets': 'place', 'local markets': 'place',
  'sunday markets': 'place', 'neighbourhood gems': 'place', 'local finds': 'place',
  'local institutions': 'place', 'bookshops': 'place', 'residential streets': 'place',
}

// ── Category label map ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  museum:   'museums',
  historic: 'historic sites',
  restaurant: 'restaurants',
  cafe:     'cafés',
  park:     'parks and open spaces',
  tourism:  'landmarks',
  place:    'local spots',
  event:    'events',
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const PAIR_COMPLEMENT_CATS = ['cafe', 'park', 'restaurant', 'bar']
const PAIR_TRIGGER_CATS = new Set(['historic', 'museum', 'tourism', 'viewpoint', 'gallery', 'spa', 'spiritual', 'beach'])
const PAIR_RADIUS_M = 700

// Chains to filter out when picking a meaningful anchor to highlight
const CHAIN_RE = /cafe coffee day|starbucks|mcdonald|kfc|domino|pizza hut|subway|costa coffee|\bccd\b|barista|burger king|dunkin|taco bell/i

// Category tiers for anchor quality — higher tier = better starting point
const ANCHOR_TIER: Record<string, number> = {
  historic: 0, museum: 0, gallery: 0, viewpoint: 0, tourism: 1, park: 1,
  restaurant: 2, cafe: 3, bar: 4,
}

export function findNearbyComplement(anchor: Place, mapPlaces: Place[]): Place | null {
  let best: Place | null = null
  let bestDist = Infinity
  for (const p of mapPlaces) {
    if (p.id === anchor.id || !PAIR_COMPLEMENT_CATS.includes(p.category)) continue
    const d = haversineM(anchor.lat, anchor.lon, p.lat, p.lon)
    if (d < PAIR_RADIUS_M && d < bestDist) {
      best = p
      bestDist = d
    }
  }
  return best
}

/**
 * Build the persona-aware area message.
 * Empathetic tone — suggests, never prescribes. Invites exploration.
 */
export function computeAreaText(
  city: string,
  persona: Persona | null,
  mapPlaces: Place[],
): string {
  const tags: string[] = (persona as unknown as { venue_filters?: string[] } | null)?.venue_filters ?? []
  const categorySet = new Set(tags.map(t => PLACE_TAG_TO_CATEGORY[t.toLowerCase()] ?? t.toLowerCase()))
  const matching = mapPlaces.filter(p => categorySet.has(p.category))

  if (matching.length === 0) {
    return `${city} has ${mapPlaces.length} spots loaded — take your time and tap anything that catches your eye`
  }

  const catCount: Record<string, number> = {}
  for (const p of matching) catCount[p.category] = (catCount[p.category] ?? 0) + 1
  const sorted = Object.entries(catCount).sort((a, b) => b[1] - a[1])
  const categoryStr =
    sorted.length >= 2 && sorted[1][1] >= sorted[0][1] * 0.8
      ? `${CATEGORY_LABELS[sorted[0][0]] ?? sorted[0][0]} and ${CATEGORY_LABELS[sorted[1][0]] ?? sorted[1][0]}`
      : (CATEGORY_LABELS[sorted[0][0]] ?? sorted[0][0])

  const pace = (persona as unknown as { pace?: string }).pace
  const isSlowPace = pace === 'walking' || pace === 'local'

  if (isSlowPace) {
    return `There's a nice spread of ${categoryStr} across ${city} — ${matching.length} spots that feel like your pace. No rush, wander wherever draws you`
  }

  return `${city} has ${matching.length} ${categoryStr} that seem like your kind of thing — explore at your own pace, tap anything interesting`
}

/**
 * Returns the best place to highlight as a gentle discovery anchor.
 * Prefers culturally meaningful places (historic, museum, viewpoint, park)
 * over generic chains (Starbucks, Cafe Coffee Day, etc.).
 * Uses centroid proximity as a tiebreaker within each tier.
 */
export function findAreaStartPlace(
  persona: Persona | null,
  mapPlaces: Place[],
): Place | null {
  const tags: string[] = (persona as unknown as { venue_filters?: string[] } | null)?.venue_filters ?? []
  const categorySet = new Set(tags.map(t => PLACE_TAG_TO_CATEGORY[t.toLowerCase()] ?? t.toLowerCase()))
  const matching = mapPlaces.filter(p => categorySet.has(p.category))
  const pool = matching.length > 0 ? matching : mapPlaces
  if (!pool.length) return null

  // Sort by tier (lower = better), then deprioritise chain names
  const sorted = [...pool].sort((a, b) => {
    const tA = ANCHOR_TIER[a.category] ?? 5
    const tB = ANCHOR_TIER[b.category] ?? 5
    if (tA !== tB) return tA - tB
    const cA = CHAIN_RE.test(a.title) ? 1 : 0
    const cB = CHAIN_RE.test(b.title) ? 1 : 0
    return cA - cB
  })

  // Among the top tier, find the one closest to the group centroid
  const bestTier = ANCHOR_TIER[sorted[0].category] ?? 5
  const topTier = sorted.filter(p => (ANCHOR_TIER[p.category] ?? 5) === bestTier && !CHAIN_RE.test(p.title))
  const candidates = topTier.length > 0 ? topTier : sorted

  const avgLat = candidates.reduce((s, p) => s + p.lat, 0) / candidates.length
  const avgLon = candidates.reduce((s, p) => s + p.lon, 0) / candidates.length
  let best = candidates[0], bestDist = Infinity
  for (const p of candidates) {
    const d = haversineM(avgLat, avgLon, p.lat, p.lon)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best
}

/**
 * Build readiness message. Returns null if conditions not met.
 * Fires when selection is ≥ 80% of a full itinerary (days × stopsPerDay).
 */
export function computeBuildReadinessText(
  count: number,
  days: number,
  stopsPerDay: number,
): string | null {
  if (stopsPerDay <= 0) return null
  const effectiveDays = days > 0 ? days : 1
  // minimum threshold of 4 so the message isn't trivially spammed on short trips
  const threshold = Math.max(4, Math.floor(effectiveDays * stopsPerDay * 0.8))
  if (count < threshold) return null
  const plural = effectiveDays === 1 ? 'day' : 'days'
  return `You've nearly filled ${effectiveDays} ${plural} — ready to build your itinerary?`
}

/**
 * Returns true when all selected places fit within an 800m bounding box.
 */
export function isGeographicCluster(places: Place[]): boolean {
  if (places.length < 3) return false
  const lats = places.map(p => p.lat)
  const lons = places.map(p => p.lon)
  const latDiff = Math.max(...lats) - Math.min(...lats)
  const lonDiff = Math.max(...lons) - Math.min(...lons)
  const avgLat = (Math.max(...lats) + Math.min(...lats)) / 2
  const latM = latDiff * 111_000
  const lonM = lonDiff * 111_000 * Math.cos((avgLat * Math.PI) / 180)
  const diagonal = Math.sqrt(latM ** 2 + lonM ** 2)
  return diagonal < 800
}

// ── Condition keys — used to detect rising edges ──────────────────────────────

type ConditionKey = 'area' | 'event' | 'build-ready' | 'cluster' | 'pair'

function evaluateConditions(
  selectedPlaces: Place[],
  city: string | null,
  _persona: Persona | null,
  personaProfile: PersonaProfile | null,
  mapPlaces: Place[],
  activePlace: Place | null,
  liveEvents: LiveEvent[],
  travelStartDate: string | null,
  travelEndDate: string | null,
  days: number,
  pairedIds: Set<string>,
): Record<ConditionKey, boolean> {
  const stopsPerDay = personaProfile?.stops_per_day ?? 3
  const count = selectedPlaces.length

  // Area: 0 places + city + places loaded (persona optional — fires generic message when null)
  const area = count === 0 && city !== null && mapPlaces.length > 0

  // Event nudge: viewing an event pin + matching live event in travel dates
  let event = false
  if (activePlace?.category === 'event') {
    const genre = (activePlace.tags?.genre ?? '').toLowerCase()
    const match = liveEvents.find(e => {
      if (e.id === activePlace.id) return false
      if (e.genre.toLowerCase() !== genre) return false
      if (!travelStartDate || !travelEndDate) return false
      return e.date >= travelStartDate && e.date <= travelEndDate
    })
    event = match !== undefined
  }

  // Build readiness: ≥ 80% of full itinerary (falls back to 4-place threshold when days not set)
  const effectiveDays = days > 0 ? days : 1
  const buildThreshold = Math.max(4, Math.floor(effectiveDays * stopsPerDay * 0.8))
  const buildReady = count >= buildThreshold

  // Cluster: all picks within 800m bounding box
  const cluster = isGeographicCluster(selectedPlaces)

  // Pair: latest selected is a landmark/museum and has a nearby complement not yet suggested
  const lastSel = selectedPlaces[count - 1] ?? null
  const pair =
    lastSel !== null &&
    PAIR_TRIGGER_CATS.has(lastSel.category) &&
    !pairedIds.has(lastSel.id) &&
    findNearbyComplement(lastSel, mapPlaces) !== null

  return { area, event, 'build-ready': buildReady, cluster, pair }
}

function buildMessage(
  key: ConditionKey,
  selectedPlaces: Place[],
  city: string | null,
  persona: Persona | null,
  personaProfile: PersonaProfile | null,
  mapPlaces: Place[],
  activePlace: Place | null,
  liveEvents: LiveEvent[],
  travelStartDate: string | null,
  travelEndDate: string | null,
  days: number,
): GuideMessage {
  const now = Date.now()

  if (key === 'area') {
    const startPlace = findAreaStartPlace(persona, mapPlaces)
    return {
      id: `area-${now}`,
      kind: 'area',
      timestamp: now,
      text: computeAreaText(city!, persona!, mapPlaces),
      actionPlaceId: startPlace?.id,
    }
  }

  if (key === 'event') {
    const genre = (activePlace?.tags?.genre ?? '').toLowerCase()
    const text = genre
      ? `There's another ${genre} event nearby that falls in your travel window — might be worth a look`
      : `Another event nearby overlaps with your dates — could be interesting`
    return { id: `event-${now}`, kind: 'event', timestamp: now, text }
  }

  if (key === 'build-ready') {
    const stopsPerDay = personaProfile?.stops_per_day ?? 3
    const effectiveDays = days > 0 ? days : 1
    const plural = effectiveDays === 1 ? 'day' : 'days'
    const text = `You've got a solid spread for ${effectiveDays} ${plural} — whenever it feels right, you could start building your route`
    return {
      id: `build-ready-${now}`,
      kind: 'exploring',
      timestamp: now,
      text: computeBuildReadinessText(selectedPlaces.length, days, stopsPerDay) ? text : text,
    }
  }

  if (key === 'pair') {
    const lastSel = selectedPlaces[selectedPlaces.length - 1]
    const complement = findNearbyComplement(lastSel, mapPlaces)
    const complementLabel = CATEGORY_LABELS[complement?.category ?? ''] ?? 'spot'
    const text = complement
      ? `There's a ${complementLabel} just a short walk from here — might round the stop out nicely`
      : `There might be a café or park nearby worth a wander after this`
    return { id: `pair-${now}`, kind: 'exploring', timestamp: now, text, actionPlaceId: complement?.id }
  }

  // cluster
  return {
    id: `cluster-${now}`,
    kind: 'exploring',
    timestamp: now,
    text: `Your picks are shaping up into a really walkable stretch — sounds like a good day ahead`,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGuideMessages(
  selectedPlaces: Place[],
  city: string | null,
  persona: Persona | null,
  personaProfile: PersonaProfile | null,
  mapPlaces: Place[],
  activePlace: Place | null,
  liveEvents: LiveEvent[],
  travelStartDate: string | null,
  travelEndDate: string | null,
  days: number,
): { messages: GuideMessage[]; hasUnread: boolean; markRead: () => void } {
  const [messages, setMessages] = useState<GuideMessage[]>([])
  const [readCount, setReadCount] = useState(0)

  // Track which conditions were true on the previous render (rising-edge detection)
  const prevConditions = useRef<Record<ConditionKey, boolean>>({
    area: false,
    event: false,
    'build-ready': false,
    cluster: false,
    pair: false,
  })

  // Cluster signal fires at most once per session
  const clusterFired = useRef(false)
  // Track which place IDs have already triggered a pair message
  const pairedIdsRef = useRef<Set<string>>(new Set())

  // Reset rising-edge tracking on city change so area message re-fires
  useEffect(() => {
    prevConditions.current = { area: false, event: false, 'build-ready': false, cluster: false, pair: false }
    clusterFired.current = false
    pairedIdsRef.current = new Set()
  }, [city])

  useEffect(() => {
    const current = evaluateConditions(
      selectedPlaces, city, persona, personaProfile, mapPlaces,
      activePlace, liveEvents, travelStartDate, travelEndDate, days,
      pairedIdsRef.current,
    )

    const toAppend: GuideMessage[] = []

    for (const key of Object.keys(current) as ConditionKey[]) {
      const wasActive = prevConditions.current[key]
      const isActive = current[key]

      // Rising edge — condition just became true
      if (isActive && !wasActive) {
        // Cluster only fires once per session
        if (key === 'cluster' && clusterFired.current) continue
        if (key === 'cluster') clusterFired.current = true

        // Mark the paired place so it doesn't fire again for the same place
        if (key === 'pair') {
          const lastSel = selectedPlaces[selectedPlaces.length - 1]
          if (lastSel) pairedIdsRef.current.add(lastSel.id)
        }

        toAppend.push(buildMessage(
          key, selectedPlaces, city, persona, personaProfile,
          mapPlaces, activePlace, liveEvents, travelStartDate, travelEndDate, days,
        ))
      }
    }

    prevConditions.current = current

    if (toAppend.length > 0) {
      setMessages(prev => [...prev, ...toAppend])
    }
  })

  const markRead = () => setReadCount(c => Math.max(c, messages.length))

  const hasUnread = messages.length > readCount

  return { messages, hasUnread, markRead }
}
