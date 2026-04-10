import type { Place } from '../../shared/types';

export type TransportMode = 'train' | 'bullet_train' | 'flight' | 'ferry';

/**
 * Returns ordered unique city names from selectedPlaces, preserving
 * the order places were added. Places without _city are skipped.
 */
export function getJourneyCities(places: Place[]): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const p of places) {
    const c = p._city;
    if (c && !seen.has(c)) {
      seen.add(c);
      cities.push(c);
    }
  }
  return cities;
}

/**
 * Returns true when selectedPlaces contains places from more than one city.
 */
export function isJourneyMode(places: Place[]): boolean {
  return getJourneyCities(places).length > 1;
}

/**
 * Haversine great-circle distance in kilometres between two lat/lon points.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Suggests a transport mode based on straight-line distance between cities.
 * < 150 km  → train/bus
 * 150–600 km → bullet train or short-haul
 * > 600 km  → flight
 */
export function suggestTransportMode(distanceKm: number): TransportMode {
  if (distanceKm < 150) return 'train';
  if (distanceKm < 600) return 'bullet_train';
  return 'flight';
}
