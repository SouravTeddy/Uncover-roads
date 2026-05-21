import { useMemo } from 'react'
import { getAllCachedDetails } from './usePlaceDetails'
import { computeTotalDays } from './trip-capacity-utils'
import { calculateEstimatedDays } from './journey-legs'
import { haversineKm } from './journey-utils'
import type { Place, PlaceDetails, CityFootprint, TransitMode } from '../../shared/types'

export interface HardBlocker {
  placeId: string
  placeTitle: string
  reason: string
}

/**
 * Detects hard blockers for selected places.
 *
 * Three hard blocker cases:
 * 1. Permanently closed: place.tags?.business_status === 'CLOSED_PERMANENTLY'
 * 2. Event outside trip dates: category === 'event' with event_date outside [travelStartDate, travelEndDate]
 * 3. Closed day within range: place's weekday_text has a "Closed" day within the travel range
 *
 * @param selectedPlaces - Array of selected Place objects
 * @param detailsCache - Map of cached PlaceDetails by key "${lat.toFixed(5)}:${lon.toFixed(5)}"
 * @param travelStartDate - ISO date string (e.g. "2026-05-20") or null
 * @param travelEndDate - ISO date string (e.g. "2026-05-25") or null
 * @returns Array of HardBlocker objects
 */
export function computeHardBlockers(
  selectedPlaces: Place[],
  detailsCache: ReadonlyMap<string, PlaceDetails>,
  travelStartDate: string | null,
  travelEndDate: string | null,
): HardBlocker[] {
  const blockers: HardBlocker[] = []

  for (const place of selectedPlaces) {
    // Case 1: Permanently closed (check regardless of dates)
    if (place.tags?.business_status === 'CLOSED_PERMANENTLY') {
      blockers.push({
        placeId: place.id,
        placeTitle: place.title,
        reason: 'Permanently closed',
      })
      continue
    }

    // Skip remaining checks if dates are null
    if (!travelStartDate || !travelEndDate) {
      continue
    }

    // Case 2: Event outside trip dates
    if (place.category === 'event') {
      const eventDate = place.tags?.event_date
      if (eventDate) {
        if (!isDateInRange(eventDate, travelStartDate, travelEndDate)) {
          const formattedDate = formatDateEventStyle(eventDate)
          blockers.push({
            placeId: place.id,
            placeTitle: place.title,
            reason: `Event on ${formattedDate} is outside your trip dates`,
          })
        }
      }
      continue
    }

    // Case 3: Place closed on a day within travel range
    const cacheKey = `${place.lat.toFixed(5)}:${place.lon.toFixed(5)}`
    const details = detailsCache.get(cacheKey)

    if (details?.weekday_text) {
      const closedDay = findClosedDayInRange(
        details.weekday_text,
        travelStartDate,
        travelEndDate,
      )
      if (closedDay) {
        blockers.push({
          placeId: place.id,
          placeTitle: place.title,
          reason: closedDay.reason,
        })
      }
    }
  }

  return blockers
}

/**
 * React hook that wraps computeHardBlockers with getAllCachedDetails and useMemo.
 * Also injects a __trip__ sentinel blocker if the multi-city plan exceeds available days.
 */
export function useHardBlockers(
  selectedPlaces: Place[],
  travelStartDate: string | null,
  travelEndDate: string | null,
  cityFootprints: CityFootprint[],
  stopsPerDay: number,
): HardBlocker[] {
  return useMemo(() => {
    const placeBlockers = computeHardBlockers(selectedPlaces, getAllCachedDetails(), travelStartDate, travelEndDate)

    const feasibility = computeMultiCityFeasibility(
      selectedPlaces,
      cityFootprints,
      travelStartDate,
      travelEndDate,
      stopsPerDay,
    )

    const tripBlocker: HardBlocker[] = feasibility
      ? [{
          placeId: '__trip__',
          placeTitle: 'Your travel plan',
          reason: `Your plan may need ~${feasibility.totalNeeded} days — you've set ${feasibility.availableDays}. Full breakdown in your itinerary.`,
        }]
      : []

    return [...tripBlocker, ...placeBlockers]
  }, [selectedPlaces, travelStartDate, travelEndDate, cityFootprints, stopsPerDay])
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

/**
 * Day names for JS getUTCDay() indexing (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Format a date string as short month name + day (e.g. "May 10", "Jun 10") for events.
 */
function formatDateEventStyle(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z')
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return formatter.format(date)
}

/**
 * Format a date string as day + short month name (e.g. "10 May", "10 Jun") for closed days.
 */
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z')
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const formatted = formatter.format(date)
  // Swap "May 10" to "10 May"
  const parts = formatted.split(' ')
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`
  }
  return formatted
}

// ─── Multi-city feasibility ───────────────────────────────────────────────────

export interface MultiCityFeasibilityResult {
  totalNeeded: number
  availableDays: number
  cityCount: number
}

function estimateTransitMinutes(km: number, mode: TransitMode): number {
  switch (mode) {
    case 'drive': return (km / 80) * 60
    case 'train': return (km / 150) * 60
    case 'flight': return ((km / 900) + 3) * 60
    default: return ((km / 900) + 3) * 60
  }
}

export function computeMultiCityFeasibility(
  selectedPlaces: Place[],
  cityFootprints: CityFootprint[],
  travelStartDate: string | null,
  travelEndDate: string | null,
  stopsPerDay: number,
): MultiCityFeasibilityResult | null {
  const availableDays = computeTotalDays(travelStartDate, travelEndDate)
  if (availableDays === 0) return null

  const cityGroups = new Map<string, number>()
  for (const place of selectedPlaces) {
    const city = place._city ?? 'Unknown'
    cityGroups.set(city, (cityGroups.get(city) ?? 0) + 1)
  }

  let cityDays = 0
  for (const count of cityGroups.values()) {
    cityDays += Math.max(1, calculateEstimatedDays(count, stopsPerDay))
  }

  let transitDays = 0
  for (let i = 0; i < cityFootprints.length - 1; i++) {
    const from = cityFootprints[i]
    const to = cityFootprints[i + 1]
    const km = haversineKm(from.lat, from.lon, to.lat, to.lon)
    const mode: TransitMode = to.transitMode ?? 'flight'
    if (estimateTransitMinutes(km, mode) > 180) transitDays += 1
  }

  const totalNeeded = cityDays + transitDays
  if (totalNeeded > availableDays) {
    return { totalNeeded, availableDays, cityCount: cityGroups.size }
  }
  return null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Find the first day in the travel range when the place is closed.
 * Returns { dayName, date, reason } if found, else null.
 *
 * weekday_text: Google's array of 7 strings, Monday (index 0) to Sunday (index 6).
 * We iterate each calendar day from startDate to endDate (inclusive),
 * convert JS day-of-week (0=Sun, 6=Sat) to Google's index (0=Mon, 6=Sun),
 * then check if weekday_text[googleIdx] contains "Closed".
 */
function findClosedDayInRange(
  weekday_text: string[],
  startDate: string,
  endDate: string,
): { reason: string } | null {
  const start = new Date(startDate + 'T12:00:00Z')
  const end = new Date(endDate + 'T12:00:00Z')

  // Iterate each day from start to end (inclusive)
  const current = new Date(start)
  while (current <= end) {
    const jsDay = current.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
    // Convert JS day to Google's index: Mon=0, Tue=1, ..., Sun=6
    const googleIdx = jsDay === 0 ? 6 : jsDay - 1

    if (googleIdx >= 0 && googleIdx < weekday_text.length) {
      if (/closed/i.test(weekday_text[googleIdx])) {
        const dayName = WEEKDAY_NAMES[jsDay]
        const dateStr = current.toISOString().split('T')[0]
        const formattedDate = formatDateShort(dateStr)
        return {
          reason: `Closed on ${dayName} · your trip includes ${dayName} ${formattedDate}`,
        }
      }
    }

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return null
}
