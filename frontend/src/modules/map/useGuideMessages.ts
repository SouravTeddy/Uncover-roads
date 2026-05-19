import { useMemo } from 'react'
import type { Place, LiveEvent } from '../../shared/types'
import type { HardBlocker } from './useHardBlockers'

export interface GuideMessage {
  id: string
  text: string
  kind: 'area' | 'event' | 'conflict' | 'exploring'
}

/**
 * Compute guide message based on trip state, with priority:
 * 1. conflict — if hardBlockers.length >= 1
 * 2. event nudge — if activePlace is event + matching liveEvent within travel range
 * 3. area — if selectedPlaces.length === 0 && city != null
 * 4. exploring — if selectedPlaces.length >= 2
 * 5. Otherwise: null
 */
export function computeGuideMessage(
  selectedPlaces: Place[],
  hardBlockers: HardBlocker[],
  city: string | null,
  activePlace: Place | null,
  liveEvents: LiveEvent[],
  travelStartDate: string | null,
  travelEndDate: string | null,
): GuideMessage | null {
  // Priority 1: Conflict
  if (hardBlockers.length >= 1) {
    const count = hardBlockers.length
    const text =
      count === 1
        ? 'We found a conflict — check before you build'
        : `We found ${count} conflicts — check before you build`
    return {
      id: 'conflict',
      text,
      kind: 'conflict',
    }
  }

  // Priority 2: Event nudge
  if (activePlace?.category === 'event') {
    const activeGenre = (activePlace.tags?.genre ?? '').toLowerCase()
    // Find a liveEvent with matching genre and within travel range
    const matchingEvent = liveEvents.find((e) => {
      // Must be a different event
      if (e.id === activePlace.id) return false
      // Genre must match (case-insensitive)
      const eventGenre = e.genre.toLowerCase()
      if (eventGenre !== activeGenre) return false
      // Must be within travel range (if both dates provided)
      if (travelStartDate && travelEndDate) {
        return isDateInRange(e.date, travelStartDate, travelEndDate)
      }
      // If dates not provided, don't match
      return false
    })

    if (matchingEvent) {
      const text = activeGenre
        ? `Another ${activeGenre} event nearby — ${matchingEvent.title}`
        : `Another event like this nearby — ${matchingEvent.title}`
      return {
        id: 'event-nudge',
        text,
        kind: 'event',
      }
    }
  }

  // Priority 3: Area
  if (selectedPlaces.length === 0 && city != null) {
    return {
      id: 'area',
      text: `Explore the best of ${city} — tap any pin to start building your trip`,
      kind: 'area',
    }
  }

  // Priority 4: Exploring
  if (selectedPlaces.length >= 2) {
    const cityDisplay = city ?? 'the city'
    return {
      id: 'exploring',
      text: `Your mix looks good — you've got a nice spread across ${cityDisplay}`,
      kind: 'exploring',
    }
  }

  // Priority 5: Otherwise null
  return null
}

/**
 * React hook that wraps computeGuideMessage with useMemo.
 */
export function useGuideMessages(
  selectedPlaces: Place[],
  hardBlockers: HardBlocker[],
  city: string | null,
  activePlace: Place | null,
  liveEvents: LiveEvent[],
  travelStartDate: string | null,
  travelEndDate: string | null,
): { message: GuideMessage | null } {
  const message = useMemo(
    () =>
      computeGuideMessage(
        selectedPlaces,
        hardBlockers,
        city,
        activePlace,
        liveEvents,
        travelStartDate,
        travelEndDate,
      ),
    [selectedPlaces, hardBlockers, city, activePlace, liveEvents, travelStartDate, travelEndDate],
  )

  return { message }
}

/**
 * Check if a date string is within the given range (inclusive).
 * Dates parsed as UTC noon.
 */
function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  const date = new Date(dateStr + 'T12:00:00Z').getTime()
  const start = new Date(startStr + 'T12:00:00Z').getTime()
  const end = new Date(endStr + 'T12:00:00Z').getTime()
  return date >= start && date <= end
}
