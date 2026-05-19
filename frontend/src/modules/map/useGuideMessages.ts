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

/**
 * Build the persona-aware area message.
 * Counts map pins that match the persona's venue_filters, surfaces the top 1–2 categories.
 */
export function computeAreaText(
  city: string,
  persona: Persona,
  mapPlaces: Place[],
): string {
  const filters: string[] = (persona as unknown as { venue_filters?: string[] }).venue_filters ?? []

  // Count pins per matching category
  const counts: Record<string, number> = {}
  for (const p of mapPlaces) {
    if (filters.includes(p.category)) {
      counts[p.category] = (counts[p.category] ?? 0) + 1
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])

  if (sorted.length === 0) {
    // No matching pins — neutral fallback
    return `There are ${mapPlaces.length} spots on this map — tap any pin to start exploring ${city}`
  }

  const total = sorted.reduce((s, [, n]) => s + n, 0)

  // Combine top 2 categories if close in count (within 20%)
  let labelStr: string
  if (sorted.length >= 2 && sorted[1][1] >= sorted[0][1] * 0.8) {
    const l1 = CATEGORY_LABELS[sorted[0][0]] ?? sorted[0][0]
    const l2 = CATEGORY_LABELS[sorted[1][0]] ?? sorted[1][0]
    labelStr = `${l1} and ${l2}`
  } else {
    labelStr = CATEGORY_LABELS[sorted[0][0]] ?? sorted[0][0]
  }

  return `${total} ${labelStr} are on this map — based on your interests, those are your best starting points in ${city}`
}

/**
 * Build readiness message. Returns null if conditions not met.
 * Fires when selection is ≥ 80% of a full itinerary (days × stopsPerDay).
 */
export function computeBuildReadinessText(
  count: number,
  days: number,
  stopsPerDay: number,
  city: string | null,
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

type ConditionKey = 'area' | 'event' | 'build-ready' | 'cluster'

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

  return { area, event, 'build-ready': buildReady, cluster }
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
      text: computeBuildReadinessText(selectedPlaces.length, days, stopsPerDay, city)!,
    }
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
  })

  // Cluster signal fires at most once per session
  const clusterFired = useRef(false)

  useEffect(() => {
    const current = evaluateConditions(
      selectedPlaces, city, persona, personaProfile, mapPlaces,
      activePlace, liveEvents, travelStartDate, travelEndDate, days,
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
