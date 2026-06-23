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
  // Guard against empty strings — `"".includes("")` is always true
  if (!primary) return false;
  return (
    (state.length > 0 && state === primary) ||
    (city.length > 0 && city === primary) ||
    (state.length > 0 && state.includes(primary)) ||
    (state.length > 0 && primary.includes(state))
  );
}

/**
 * Watches selectedPlaces for newly added pins and detects new cities.
 *
 * Each pin is detected independently and in parallel — no lock, no drops.
 * The store's ADD_CITY_FOOTPRINT deduplicates concurrent same-city dispatches.
 *
 * Detection per pin:
 *   1. Fast haversine check against all known city centroids (< 30km → skip)
 *   2. Nominatim reverse geocode — match against primary city + known footprints
 *   3. OSRM transit mode from nearest known city if genuinely new city
 */
export function usePinCityDetector(
  selectedPlaces: Place[],
  cityFootprints: CityFootprint[],
  primaryCityLat: number | null,
  primaryCityLon: number | null,
  primaryCityName: string,
  onNewCity: (city: string, lat: number, lon: number, transit: DetectedTransit | null, country: string | null) => void,
) {
  // Track seen pin IDs so we detect every new pin regardless of add speed
  const seenIdsRef = useRef<Set<string>>(new Set(selectedPlaces.map(p => p.id)));
  const onNewCityRef = useRef(onNewCity);
  useEffect(() => { onNewCityRef.current = onNewCity; });

  // Keep stable refs for values used inside async callbacks
  const cityFootprintsRef = useRef(cityFootprints);
  const primaryCityLatRef = useRef(primaryCityLat);
  const primaryCityLonRef = useRef(primaryCityLon);
  const primaryCityNameRef = useRef(primaryCityName);
  useEffect(() => {
    cityFootprintsRef.current = cityFootprints;
    primaryCityLatRef.current = primaryCityLat;
    primaryCityLonRef.current = primaryCityLon;
    primaryCityNameRef.current = primaryCityName;
  });

  useEffect(() => {
    // Find every pin that wasn't seen before this render
    const newPlaces = selectedPlaces.filter(p => !seenIdsRef.current.has(p.id));
    newPlaces.forEach(p => seenIdsRef.current.add(p.id));

    // Clean up removed pins from seenIds so re-adding works correctly
    const currentIds = new Set(selectedPlaces.map(p => p.id));
    seenIdsRef.current.forEach(id => { if (!currentIds.has(id)) seenIdsRef.current.delete(id); });

    if (newPlaces.length === 0) return;

    for (const place of newPlaces) {
      // Read current footprints at detection time (not stale closure value)
      const footprints = cityFootprintsRef.current;
      const primaryName = primaryCityNameRef.current;
      const primaryLat = primaryCityLatRef.current;
      const primaryLon = primaryCityLonRef.current;

      // Build all known city centroids: primary + detected secondaries
      const knownCities: { city: string; lat: number; lon: number }[] = [];
      if (primaryLat !== null && primaryLon !== null) {
        knownCities.push({ city: primaryName, lat: primaryLat, lon: primaryLon });
      }
      footprints.forEach(f => {
        if (!knownCities.some(k => k.city === f.city)) {
          knownCities.push({ city: f.city, lat: f.lat, lon: f.lon });
        }
      });

      if (knownCities.length === 0) continue;

      // Fast path: within 30km of any known city → definitely same city, skip async
      const nearestKnown = findNearestCity(place.lat, place.lon, knownCities, 30);
      if (nearestKnown) continue;

      // Async detection — independent per pin, no lock
      ;(async () => {
        try {
          const { city: detectedCity, state: detectedState, country: detectedCountry } =
            await reverseGeocode(place.lat, place.lon);

          if (isSameCity(primaryName, detectedCity, detectedState)) return;

          // Re-read footprints after await — another pin may have already added this city
          const currentFootprints = cityFootprintsRef.current;
          const currentKnown: { city: string; lat: number; lon: number }[] = [
            ...(primaryLat !== null && primaryLon !== null ? [{ city: primaryName, lat: primaryLat, lon: primaryLon }] : []),
            ...currentFootprints.map(f => ({ city: f.city, lat: f.lat, lon: f.lon })),
          ];

          const alreadyKnown = currentKnown.some(c => isSameCity(c.city, detectedCity, detectedState));
          if (alreadyKnown) return;

          if (!detectedCity) return;

          // OSRM transit from the nearest known city
          const fromCity = currentKnown[currentKnown.length - 1];
          const { mode, durationMinutes } = await detectTransitMode(
            fromCity.lat, fromCity.lon,
            place.lat, place.lon,
          );

          onNewCityRef.current(detectedCity, place.lat, place.lon, {
            from: fromCity.city,
            to: detectedCity,
            mode,
            durationMinutes,
          }, detectedCountry);
        } catch {
          // Detection is best-effort — network failures are silent
        }
      })();
    }
  }, [selectedPlaces]); // eslint-disable-line react-hooks/exhaustive-deps
}
