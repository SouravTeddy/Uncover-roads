import { useEffect, useRef } from 'react';
import type { Place, CityFootprint, TransitMode } from '../../shared/types';
import { haversineKm } from './journey-utils';
import { detectTransitMode } from './journey-legs';

export interface DetectedTransit {
  from: string;
  to: string;
  mode: TransitMode;
  durationMinutes: number | undefined;
}

/**
 * Synchronous — finds the nearest city within thresholdKm.
 * Exported for testing.
 */
export function findNearestCity(
  pinLat: number,
  pinLon: number,
  cities: { city: string; lat: number; lon: number }[],
  thresholdKm = 30,
): string | null {
  let nearest: string | null = null;
  let nearestDist = Infinity;
  for (const c of cities) {
    const dist = haversineKm(pinLat, pinLon, c.lat, c.lon);
    if (dist < thresholdKm && dist < nearestDist) {
      nearestDist = dist;
      nearest = c.city;
    }
  }
  return nearest;
}

/**
 * Reverse geocode a lat/lon to a city name, state, and country via Nominatim.
 */
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string | null; state: string | null; country: string | null }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const addr = data.address ?? {};
    return {
      city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? null,
      state: addr.state ?? null,
      country: addr.country ?? null,
    };
  } catch {
    return { city: null, state: null, country: null };
  }
}

/**
 * Returns true if the reverse-geocoded state/city for a pin belongs to the
 * primary city. Matches on state or city name — handles cases like:
 *   Talpona (state="Goa")  + primaryCity="Goa"   → same city ✓
 *   Shibuya (state="Tokyo") + primaryCity="Tokyo" → same city ✓
 *   Pune    (city="Pune")   + primaryCity="Mumbai" → different ✓
 */
function isSameCity(
  primaryCityName: string,
  detectedCity: string | null,
  detectedState: string | null,
): boolean {
  const primary = primaryCityName.toLowerCase();
  const city = detectedCity?.toLowerCase() ?? '';
  const state = detectedState?.toLowerCase() ?? '';
  return state === primary || city === primary || state.includes(primary) || primary.includes(state && state);
}

/**
 * Watches selectedPlaces for newly added pins.
 * For each new pin, determines which city it belongs to:
 *   1. Haversine fast path against known multi-city footprints (< 30km → same city)
 *   2. Nominatim reverse geocode — if state/city name matches primary city, same city
 *   3. detectTransitMode (OSRM) if genuinely new city confirmed
 *
 * Calls onNewCity only when a pin is in a genuinely different city.
 */
export function usePinCityDetector(
  selectedPlaces: Place[],
  cityFootprints: CityFootprint[],
  primaryCityLat: number | null,
  primaryCityLon: number | null,
  primaryCityName: string,
  onNewCity: (city: string, lat: number, lon: number, transit: DetectedTransit | null, country: string | null) => void,
) {
  const prevCountRef = useRef(selectedPlaces.length);
  const processingRef = useRef(false);
  const onNewCityRef = useRef(onNewCity);
  useEffect(() => { onNewCityRef.current = onNewCity; });

  useEffect(() => {
    const prevCount = prevCountRef.current;
    const currentCount = selectedPlaces.length;
    prevCountRef.current = currentCount;

    if (currentCount <= prevCount) return; // removal or no change
    // Note: pins added while an async city-detection is in flight are silently
    // dropped. In practice, users rarely add two different-city pins within the
    // ~2s Nominatim + OSRM round-trip. A queue can be added here if needed.
    if (processingRef.current) return;

    const newPlace = selectedPlaces[currentCount - 1];
    if (!newPlace) return;

    // Build list of known city centroids
    const knownCities: { city: string; lat: number; lon: number }[] = [];
    if (cityFootprints.length > 0) {
      cityFootprints.forEach(f => knownCities.push({ city: f.city, lat: f.lat, lon: f.lon }));
    } else if (primaryCityLat !== null && primaryCityLon !== null) {
      knownCities.push({ city: primaryCityName, lat: primaryCityLat, lon: primaryCityLon });
    }

    if (knownCities.length === 0) return;

    // Step 1: fast haversine check for already-known multi-city footprints (30km)
    if (cityFootprints.length > 0) {
      const nearestCity = findNearestCity(newPlace.lat, newPlace.lon, knownCities, 30);
      if (nearestCity) return; // already within a known city's radius
    }

    // Step 2 + 3: async detection — reverse geocode and check state/city name
    processingRef.current = true;
    (async () => {
      try {
        const { city: detectedCityName, state: detectedState, country: detectedCountry } = await reverseGeocode(newPlace.lat, newPlace.lon);

        // If the pin's state or city matches the primary city name, it's the same city.
        // Handles: Talpona (state=Goa) → primary=Goa; Tokyo suburb (state=Tokyo) → primary=Tokyo.
        if (isSameCity(primaryCityName, detectedCityName, detectedState)) return;

        // Also check against all known footprint city names
        const alreadyKnown = knownCities.some(c =>
          isSameCity(c.city, detectedCityName, detectedState),
        );
        if (alreadyKnown) return;

        if (!detectedCityName) return;

        // Step 3: OSRM to determine transit mode from nearest known city
        // Uses the last footprint as the "from" city — cityFootprints is populated in
        // ADD_CITY_FOOTPRINT dispatch order, so this is the most-recently-detected city.
        const fromCity = knownCities[knownCities.length - 1];
        const { mode, durationMinutes } = await detectTransitMode(
          fromCity.lat, fromCity.lon,
          newPlace.lat, newPlace.lon,
        );

        const transit: DetectedTransit = {
          from: fromCity.city,
          to: detectedCityName,
          mode,
          durationMinutes,
        };

        onNewCityRef.current(detectedCityName, newPlace.lat, newPlace.lon, transit, detectedCountry);
      } finally {
        processingRef.current = false;
      }
    })();
  }, [selectedPlaces.length]); // eslint-disable-line react-hooks/exhaustive-deps
}
