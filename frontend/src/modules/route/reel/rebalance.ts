import type { EngineItinerary, EngineItineraryStop } from '../../../shared/types';

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function minToTime(m: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, m));
  const h = Math.floor(clamped / 60);
  const min = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function centroid(stops: EngineItineraryStop[]): { lat: number; lon: number } | null {
  if (stops.length === 0) return null;
  return {
    lat: stops.reduce((s, st) => s + st.lat, 0) / stops.length,
    lon: stops.reduce((s, st) => s + st.lon, 0) / stops.length,
  };
}

function sqDist(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  return (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2;
}

// Re-stamp sequential start times for a sorted stop list.
// Keeps durationMin intact; adds a 30-min travel buffer between stops.
function reassignTimes(stops: EngineItineraryStop[], dayStartMin = 9 * 60): EngineItineraryStop[] {
  const BUFFER = 30;
  let cur = dayStartMin;
  return stops.map(stop => {
    const s = { ...stop, time: minToTime(cur) };
    cur += (stop.durationMin ?? 60) + BUFFER;
    return s;
  });
}

/**
 * Rebalance stops across non-travel days so no day has fewer than ~50% of the
 * average stop count. Uses geo-proximity to decide which stops to move —
 * stops geographically closer to the under-full day's centroid are preferred.
 *
 * After rebalancing, times are re-stamped sequentially from 09:00 for each day.
 */
export function rebalanceItinerary(itinerary: EngineItinerary): EngineItinerary {
  const days = itinerary.days ?? [];
  if (days.length <= 1) return itinerary;

  // Separate travel days (no stops, just transit) from regular days
  const nonTravelIdxs: number[] = [];
  days.forEach((d, i) => { if (!d.isTravel) nonTravelIdxs.push(i); });
  if (nonTravelIdxs.length <= 1) return itinerary;

  const total = nonTravelIdxs.reduce((s, i) => s + (days[i].stops?.length ?? 0), 0);
  if (total < 2) return itinerary;

  // Check if rebalance is even necessary (all days within ±1 of target)
  const counts = nonTravelIdxs.map(i => days[i].stops?.length ?? 0);
  if (Math.max(...counts) - Math.min(...counts) <= 1) return itinerary;

  // Mutable per-day stop lists (preserve original within-day order)
  const dayStops = nonTravelIdxs.map(i => [...(days[i].stops ?? [])]);
  const centroids = dayStops.map(centroid);

  // Iteratively move stops from the most over-full day to the most under-full day
  for (let iter = 0; iter < 40; iter++) {
    const sc = dayStops.map(s => s.length);
    const overIdx = sc.indexOf(Math.max(...sc));
    const underIdx = sc.indexOf(Math.min(...sc));

    if (sc[overIdx] - sc[underIdx] <= 1) break;

    const overStops = dayStops[overIdx];
    const underC = centroids[underIdx];

    // Don't move the chronologically first or last stop from the over-full day —
    // these are anchor stops that ground the day's narrative.
    const movable = overStops.length > 2 ? overStops.slice(1, -1) : overStops;

    // Pick the movable stop closest to the under-full day's centroid
    let best: EngineItineraryStop | null = null;
    let bestD = Infinity;
    for (const s of movable) {
      const d = underC ? sqDist(s, underC) : 0;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) break;

    dayStops[overIdx] = overStops.filter(s => s.id !== best!.id);
    dayStops[underIdx] = [...dayStops[underIdx], best];

    // Update centroids after each move
    centroids[overIdx]  = centroid(dayStops[overIdx]);
    centroids[underIdx] = centroid(dayStops[underIdx]);
  }

  // Re-stamp times for every day that changed
  const originalCounts = nonTravelIdxs.map(i => days[i].stops?.length ?? 0);
  const retimedDayStops = dayStops.map((stops, relIdx) => {
    const changed = stops.length !== originalCounts[relIdx];
    if (!changed) return stops;
    // Preserve original day start time if available
    const dayStartStr = stops[0]?.time ?? '09:00';
    const dayStartMin = timeToMin(dayStartStr);
    const startMin = Math.min(dayStartMin, 9 * 60); // never start before 09:00
    return reassignTimes(stops, startMin);
  });

  // Reconstruct full itinerary days
  const newDays = days.map((day, i) => {
    const relIdx = nonTravelIdxs.indexOf(i);
    if (relIdx === -1) return day;
    return { ...day, stops: retimedDayStops[relIdx] };
  });

  return { ...itinerary, days: newDays };
}
