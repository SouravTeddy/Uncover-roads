import { useEffect, useRef, useState } from 'react'
import type { Place, LiveEvent, Persona, PersonaProfile } from '../../shared/types'

export interface GuideMessage {
  id: string
  text: string
  kind: 'area' | 'event' | 'exploring'
  timestamp: number
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

const PAIR_COMPLEMENT_CATS = ['cafe', 'park', 'restaurant']
const PAIR_TRIGGER_CATS = new Set(['historic', 'museum', 'tourism'])
const PAIR_RADIUS_M = 700

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
 * Finds the centroid of persona-matching pins and surfaces the closest one as a starting point.
 * Adapts language to the user's pace preference.
 */
export function computeAreaText(
  city: string,
  persona: Persona,
  mapPlaces: Place[],
): string {
  const filters: string[] = (persona as unknown as { venue_filters?: string[] }).venue_filters ?? []
  const matching = mapPlaces.filter(p => filters.includes(p.category))

  if (matching.length === 0) {
    return `There are ${mapPlaces.length} spots on this map — tap any pin to start exploring ${city}`
  }

  // Find centroid of matching pins
  const avgLat = matching.reduce((s, p) => s + p.lat, 0) / matching.length
  const avgLon = matching.reduce((s, p) => s + p.lon, 0) / matching.length

  // Closest place to centroid = natural starting anchor
  let startPlace = matching[0]
  let bestDist = Infinity
  for (const p of matching) {
    const d = haversineM(avgLat, avgLon, p.lat, p.lon)
    if (d < bestDist) { bestDist = d; startPlace = p }
  }

  const pace = (persona as unknown as { pace?: string }).pace
  const isSlowPace = pace === 'walking' || pace === 'local'

  if (isSlowPace) {
    return `Since you enjoy taking it slow, start at ${startPlace.title} — it's central to the ${matching.length} spots we think you'll love in ${city}`
  }

  return `Based on your interests, ${startPlace.title} is a great first stop — ${matching.length} spots nearby match your travel style`
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
  if (days <= 0 || stopsPerDay <= 0) return null
  const threshold = Math.floor(days * stopsPerDay * 0.8)
  if (count < threshold || count < 2) return null
  const plural = days === 1 ? 'day' : 'days'
  return `You've nearly filled ${days} ${plural} — ready to build your itinerary?`
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
  persona: Persona | null,
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

  // Area: 0 places + city + persona
  const area = count === 0 && city !== null && persona !== null && mapPlaces.length > 0

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

  // Build readiness: ≥ 80% of full itinerary
  const buildReady =
    count >= 2 &&
    days > 0 &&
    count >= Math.floor(days * stopsPerDay * 0.8)

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
    return {
      id: `area-${now}`,
      kind: 'area',
      timestamp: now,
      text: computeAreaText(city!, persona!, mapPlaces),
    }
  }

  if (key === 'event') {
    const genre = (activePlace?.tags?.genre ?? '').toLowerCase()
    const match = liveEvents.find(e => {
      if (e.id === activePlace?.id) return false
      if (e.genre.toLowerCase() !== genre) return false
      if (!travelStartDate || !travelEndDate) return false
      return e.date >= travelStartDate && e.date <= travelEndDate
    })!
    const text = genre
      ? `Another ${genre} event nearby — ${match.title}`
      : `Another event like this nearby — ${match.title}`
    return { id: `event-${now}`, kind: 'event', timestamp: now, text }
  }

  if (key === 'build-ready') {
    const stopsPerDay = personaProfile?.stops_per_day ?? 3
    return {
      id: `build-ready-${now}`,
      kind: 'exploring',
      timestamp: now,
      text: computeBuildReadinessText(selectedPlaces.length, days, stopsPerDay)!,
    }
  }

  if (key === 'pair') {
    const lastSel = selectedPlaces[selectedPlaces.length - 1]
    const complement = findNearbyComplement(lastSel, mapPlaces)
    const complementLabel = CATEGORY_LABELS[complement?.category ?? ''] ?? 'a nearby spot'
    const text = complement
      ? `${lastSel.title} pairs nicely with ${complement.title} (${complementLabel}) just a short walk away`
      : `${lastSel.title} is a great pick — look for a café or park nearby to round out the stop`
    return { id: `pair-${now}`, kind: 'exploring', timestamp: now, text }
  }

  // cluster
  return {
    id: `cluster-${now}`,
    kind: 'exploring',
    timestamp: now,
    text: `Your picks are all close together — great for a focused day, or spread out to cover more of ${city ?? 'the city'}`,
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
