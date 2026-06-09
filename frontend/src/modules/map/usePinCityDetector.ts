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
 * Reverse geocode a lat/lon to a city name + country via Nominatim.
 */
async function reverseGeocode(lat: number, lon: number): Promise<{ city: string | null; country: string | null }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const addr = data.address ?? {};
    return {
      city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? null,
      country: addr.country ?? null,
    };
  } catch {
    return { city: null, country: null };
  }
}

/**
 * Watches selectedPlaces for newly added pins.
 * For each new pin, determines which city it belongs to via a 3-step process:
 *   1. Haversine fast path against known cityFootprints centroids (< 30km → assign, done)
 *   2. Nominatim reverse geocode for city name
 *   3. detectTransitMode (OSRM) if new city confirmed
 *
 * Calls onNewCity when a genuinely new city is detected.
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

    // Step 1: fast haversine check
    const nearestCity = findNearestCity(newPlace.lat, newPlace.lon, knownCities);
    if (nearestCity) return; // pin is within 30km of a known city — no new city

    // Step 2 + 3: async detection
    processingRef.current = true;
    (async () => {
      try {
        const { city: detectedCityName, country: detectedCountry } = await reverseGeocode(newPlace.lat, newPlace.lon);
        if (!detectedCityName) return;

        // Check if this city is already known by name
        const alreadyKnown = knownCities.some(
          c => c.city.toLowerCase() === detectedCityName.toLowerCase(),
        );
        if (alreadyKnown) return;

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
