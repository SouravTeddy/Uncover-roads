import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';

export type SemanticRole =
  | 'anchor'
  | 'scenic_rest'
  | 'fuel_stop'
  | 'cultural_deep'
  | 'social_hub'
  | 'evening_wind'
  | 'transit_filler';

const SCENIC_CATS = new Set(['beach', 'park', 'viewpoint', 'zoo', 'aquarium', 'amusement_park']);
const SOCIAL_CATS = new Set(['bar', 'nightlife']);
const FOOD_CATS   = new Set(['restaurant', 'cafe', 'bakery', 'street_food', 'market']);

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function hasScenicroNeighbor(stop: EngineItineraryStop, stops: EngineItineraryStop[]): boolean {
  const idx = stops.indexOf(stop);
  const prev = stops[idx - 1];
  const next = stops[idx + 1];
  return (prev ? SCENIC_CATS.has(prev.category) : false) || (next ? SCENIC_CATS.has(next.category) : false);
}

export function computeStopSemantics(
  stop: EngineItineraryStop,
  stops: EngineItineraryStop[],
  signal: Pick<RecoSignal, 'weather'>,
): SemanticRole {
  const startMin = timeToMin(stop.time);

  // Social hub: bar/nightlife any time (takes priority over evening_wind)
  if (SOCIAL_CATS.has(stop.category)) {
    return 'social_hub';
  }

  // Evening wind-down: food after 19:00
  if (startMin >= 19 * 60 && FOOD_CATS.has(stop.category)) {
    return 'evening_wind';
  }

  // Cultural deep: museum/gallery/historic with long duration
  if ((stop.category === 'museum' || stop.category === 'gallery' || stop.category === 'historic') && stop.durationMin >= 120) {
    return 'cultural_deep';
  }

  // Scenic rest: cafe/park in good weather with scenic neighbor OR long duration cafe
  if (stop.category === 'cafe' || stop.category === 'park') {
    const isScenic = signal.weather?.isOutdoorFriendly && hasScenicroNeighbor(stop, stops);
    if (isScenic) return 'scenic_rest';
    return 'fuel_stop';
  }

  // Fuel stop: quick food
  if (FOOD_CATS.has(stop.category) && stop.durationMin < 45) {
    return 'fuel_stop';
  }

  // Anchor: main category attractions
  if (stop.category === 'museum' || stop.category === 'gallery' || stop.category === 'historic' ||
      stop.category === 'tourism' || SCENIC_CATS.has(stop.category)) {
    return 'anchor';
  }

  return 'transit_filler';
}
