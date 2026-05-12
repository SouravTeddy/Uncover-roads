import { routeInterCity } from '../../shared/api';
import { addDaysToIso } from './trip-capacity-utils';
import type { JourneyLeg, OriginType, OriginPlace, Place, TransitMode } from '../../shared/types';

/**
 * Hour (24h) after which a hotel check-in is considered "late".
 * Used to decide whether the itinerary starts on day 1 or day 2.
 * Note: future scheduling logic will use full trip context (night-place placement,
 * day density) — this threshold is the baseline for the simple case.
 */
export const LATE_CHECKIN_THRESHOLD_HOUR = 18;

/**
 * Minutes of rest to allow after hotel check-in before the itinerary begins.
 * Accounts for settling in and freshening up.
 */
export const POST_CHECKIN_REST_MINUTES = 45;

/**
 * Determines transit mode between two geographic points via OSRM.
 * Falls back to 'flight' when no road route exists (ocean/island crossing).
 * Also returns the OSRM duration in minutes (undefined when no road route).
 */
export async function detectTransitMode(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
): Promise<{ mode: TransitMode; durationMinutes: number | undefined }> {
  const result = await routeInterCity(fromLat, fromLon, toLat, toLon);
  if (!result) return { mode: 'flight', durationMinutes: undefined };
  if (result.duration_min > 480) return { mode: 'flight', durationMinutes: result.duration_min };
  if (result.duration_min > 120) return { mode: 'train', durationMinutes: result.duration_min };
  return { mode: 'drive', durationMinutes: result.duration_min };
}

/**
 * Calculates how many days a city visit will take based on place count and pace.
 * Adds 1 day for first-city long-haul arrival (arriving evening, light day 1).
 */
export function calculateEstimatedDays(
  placeCount: number,
  stopsPerDay: number,
  isFirstCity = false,
  isLongHaul = false,
): number {
  const base = Math.ceil(placeCount / Math.max(1, stopsPerDay));
  return isFirstCity && isLongHaul ? base + 1 : base;
}

/**
 * Returns the number of travel days to deduct from the user's budget.
 * Travel days = departure day + return day, only when flying from home/airport.
 * Short flights (<4h) don't consume a full day.
 */
export function calculateTravelDays(
  originType: OriginType | undefined,
  firstTransitDurationMin: number | undefined,
): number {
  if (!originType) return 0;
  if (originType !== 'home' && originType !== 'airport') return 0;
  if (!firstTransitDurationMin || firstTransitDurationMin < 240) return 0;
  return 2;
}

/**
 * Stamps each city leg with an ISO arrivalDate, cascading from startDate.
 * Transit legs that are drive/train with duration > 360 min add 1 calendar day.
 */
export function calculateArrivalDates(
  legs: JourneyLeg[],
  startDate: string,
): JourneyLeg[] {
  let currentDate = startDate;
  return legs.map(leg => {
    if (leg.type === 'origin') return leg;
    if (leg.type === 'transit') {
      if (leg.mode !== 'flight' && (leg.durationMinutes ?? 0) > 360) {
        currentDate = addDaysToIso(currentDate, 1);
      }
      return leg;
    }
    const dated = { ...leg, arrivalDate: currentDate };
    currentDate = addDaysToIso(currentDate, leg.estimatedDays);
    return dated;
  });
}

/**
 * Builds a JourneyLeg array from a flat list of selected places.
 * Groups by _city, creates transit legs between cities via OSRM.
 */
export async function buildJourneyLegs(
  places: Place[],
  origin: OriginPlace | null,
  stopsPerDay: number,
  isLongHaul = false,
): Promise<JourneyLeg[]> {
  const legs: JourneyLeg[] = [];

  if (origin) {
    legs.push({ type: 'origin', place: origin });
  }

  const cityMap = new Map<string, Place[]>();
  for (const p of places) {
    const city = p._city ?? 'Unknown';
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(p);
  }

  const cities = [...cityMap.keys()];

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    const cityPlaces = cityMap.get(city)!;
    const estimatedDays = calculateEstimatedDays(cityPlaces.length, stopsPerDay, i === 0, isLongHaul);

    if (i > 0) {
      const prevCity = cities[i - 1];
      const prevPlaces = cityMap.get(prevCity)!;
      const fromPlace = prevPlaces[Math.floor(prevPlaces.length / 2)];
      const toPlace = cityPlaces[0];
      const { mode, durationMinutes } = await detectTransitMode(fromPlace.lat, fromPlace.lon, toPlace.lat, toPlace.lon);

      legs.push({
        type: 'transit',
        mode,
        from: prevCity,
        to: city,
        fromCoords: [fromPlace.lat, fromPlace.lon],
        toCoords: [toPlace.lat, toPlace.lon],
        durationMinutes,
      });
    }

    legs.push({
      type: 'city',
      city,
      countryCode: '',
      places: cityPlaces,
      estimatedDays,
    });
  }

  // Apply hotel check-out squeeze to last city leg
  if (origin?.originType === 'hotel' && origin.checkOutTime) {
    const [h, m] = origin.checkOutTime.split(':').map(Number);
    const checkoutTotalMin = h * 60 + m;
    const CHECKOUT_MORNING_CUTOFF_MIN = 13 * 60; // 1:00 PM — if checkout is before 1 PM, squeeze last city
    if (checkoutTotalMin < CHECKOUT_MORNING_CUTOFF_MIN) {
      const lastCityIdx = legs.reduce((acc, l, i) => l.type === 'city' ? i : acc, -1);
      if (lastCityIdx >= 0) {
        const lastCity = legs[lastCityIdx] as Extract<JourneyLeg, { type: 'city' }>;
        legs[lastCityIdx] = {
          ...lastCity,
          estimatedDays: Math.max(1, lastCity.estimatedDays - 1),
          advisorMessage: `Ending your last morning early — time to pack for check-out at ${origin.checkOutTime}.`,
        };
      }
    }
  }

  return legs;
}
