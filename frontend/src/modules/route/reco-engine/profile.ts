import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';
import { computeStopSemantics } from './semantics';

export interface ItineraryProfile {
  hasLunch: number | null;
  hasDinner: number | null;
  hasEveningActivity: number | null;
  hasCulture: number | null;
  hasOutdoor: number | null;
  hasRest: number | null;
  hasSocialStop: number | null;
  hasHiddenGem: number | null;
  densityScore: number | null;
  walkIntensity: number | null;
  categoryDiversity: number | null;
  timeBalance: number | null;
  geoEfficiency: number | null;
  weatherAlignment: number | null;
  crowdOptimization: number | null;
  budgetAlignment: number | null;
  liveEventOverlap: number | null;
  // Phase 2 stubs — always null until feeds connected
  trendAlignment: null;
  localVelocity: null;
  curatedCoverage: null;
  routeScenicity: null;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CULTURE_CATS  = new Set(['museum', 'gallery', 'historic', 'heritage', 'library', 'spiritual']);
const OUTDOOR_CATS  = new Set(['park', 'viewpoint', 'beach', 'zoo', 'aquarium', 'amusement_park']);
const SOCIAL_CATS   = new Set(['bar', 'nightlife', 'market', 'restaurant']);
export const FOOD_CATS = new Set(['restaurant', 'cafe', 'bakery', 'street_food', 'market']);
const REST_CATS     = new Set(['cafe', 'park']);
const CROWD_PEAK: Record<string, [number, number]> = {
  museum: [600, 720], beach: [660, 900], market: [540, 660], historic: [600, 780], viewpoint: [660, 780],
};

export function computeTargetProfile(signal: RecoSignal): ItineraryProfile {
  const w = signal.weights;
  const { pace, isFamily, trip } = signal;
  // Clip meal/activity targets based on arrival/departure constraints
  const arrivalMin  = trip.isFirstDay  && trip.arrivalTime   ? timeToMin(trip.arrivalTime)   : null;
  const departureMin = trip.isLastDay  && trip.departureTime ? timeToMin(trip.departureTime) : null;

  // Lunch is unreachable if arriving after 15:00 (900)
  const hasLunchTarget = (arrivalMin !== null && arrivalMin > 900) ? 0 : 0.9;

  // Dinner/evening blocked by early departure OR extremely late arrival (> 17:00)
  const mealAndEveningBlocked =
    (departureMin !== null && departureMin < 1020) ||
    (arrivalMin !== null && arrivalMin > 1020);

  const baseDinnerTarget   = w.w_food_density * 0.8 + 0.2;
  const baseEveningTarget  = w.w_nightlife;

  // Density: scale by fraction of day available (baseline = 14h)
  const BASE_DAY_HOURS = 14;
  let densityMult = 1;
  if (arrivalMin !== null) {
    const availHours = Math.max(0, (22 * 60 - arrivalMin)) / 60;
    densityMult = Math.min(1, availHours / BASE_DAY_HOURS);
  }
  if (departureMin !== null) {
    const availHours = Math.max(0, (departureMin - 9 * 60)) / 60;
    densityMult = Math.min(densityMult, availHours / BASE_DAY_HOURS);
  }

  const baseDensity = pace === 'slow' ? 0.35 : pace === 'fast' ? 0.75 : 0.55;

  return {
    hasLunch:           hasLunchTarget,
    hasDinner:          mealAndEveningBlocked ? 0 : baseDinnerTarget,
    hasEveningActivity: mealAndEveningBlocked ? 0 : baseEveningTarget,
    hasCulture:         w.w_culture_depth,
    hasOutdoor:         w.w_scenic * 0.7 + (isFamily ? 0.3 : 0),
    hasRest:            Math.min(1, w.w_rest_need * 0.7 + (pace === 'slow' ? 0.3 : 0)),
    hasSocialStop:      signal.social === 'solo' ? 0.2 : 0.6,
    hasHiddenGem:       signal.spontaneityBias * 0.6,
    densityScore:       baseDensity * densityMult,
    walkIntensity:      w.w_walk_affinity * 0.7,
    categoryDiversity:  signal.spontaneityBias * 0.5 + 0.3,
    timeBalance:        pace === 'slow' ? 0.5 : 0.7,
    geoEfficiency:      w.w_efficiency * 0.6 + 0.2,
    weatherAlignment:   signal.weather?.isOutdoorFriendly ? w.w_scenic * 0.7 + 0.3 : (1 - w.w_scenic) * 0.8,
    crowdOptimization:  w.w_crowd_aversion,
    budgetAlignment:    1 - w.w_budget_sensitivity * 0.8,
    liveEventOverlap:   signal.savedEvents.length > 0 || signal.dismissedPinIds.size > 0 ? signal.spontaneityBias : null,
    trendAlignment: null, localVelocity: null, curatedCoverage: null, routeScenicity: null,
  };
}

export function computeActualProfile(
  stops: EngineItineraryStop[],
  signal: RecoSignal,
): ItineraryProfile {
  if (stops.length === 0) {
    return {
      hasLunch: 0, hasDinner: 0, hasEveningActivity: 0,
      hasCulture: 0, hasOutdoor: 0, hasRest: 0, hasSocialStop: 0, hasHiddenGem: 0,
      densityScore: null, walkIntensity: null, categoryDiversity: null,
      timeBalance: null, geoEfficiency: null, weatherAlignment: null,
      crowdOptimization: null, budgetAlignment: null, liveEventOverlap: computeLiveEvent(stops, signal),
      trendAlignment: null, localVelocity: null, curatedCoverage: null, routeScenicity: null,
    };
  }

  const sorted = [...stops].sort((a, b) => timeToMin(a.time) - timeToMin(b.time));
  const roles = sorted.map(s => computeStopSemantics(s, sorted, signal));

  // Lunch: food category in 11:00–15:00 window (660–900 min)
  const hasLunch = sorted.some((s) => {
    const m = timeToMin(s.time);
    return m >= 660 && m <= 900 && FOOD_CATS.has(s.category);
  }) ? 1 : 0;

  // Dinner: food category after 17:00 (1020 min)
  const hasDinner = sorted.some((s) => {
    const m = timeToMin(s.time);
    return m >= 1020 && FOOD_CATS.has(s.category);
  }) ? 1 : 0;

  // Evening activity: any stop after 20:00
  const hasEveningActivity = sorted.some(s => timeToMin(s.time) >= 1200) ? 1 : 0;

  // Culture
  const hasCulture = sorted.some(s => CULTURE_CATS.has(s.category)) ? 1 : 0;

  // Outdoor
  const hasOutdoor = sorted.some(s => OUTDOOR_CATS.has(s.category)) ? 1 : 0;

  // Rest: any cafe or park in the schedule counts, regardless of weather or neighbours
  const hasRest = sorted.some(s => REST_CATS.has(s.category)) ? 1 : 0;

  // Social stop
  const hasSocialStop = sorted.some(s => SOCIAL_CATS.has(s.category)) ? 1 : 0;

  // Hidden gem: use server-computed stage if available, else fall back to heuristic
  const hasHiddenGem = sorted.some(s =>
    s.stage === 'hidden_gem' ||
    (s.stage == null && !(['museum', 'historic', 'viewpoint', 'beach'] as string[]).includes(s.category) && (s.rating ?? 0) >= 4.3 && (s.rating ?? 0) > 0)
  ) ? 1 : 0;

  // Density: scheduled time / day span
  const firstStart = timeToMin(sorted[0].time);
  const lastStop = sorted.at(-1)!;
  const lastEnd = timeToMin(lastStop.time) + lastStop.durationMin;
  const totalScheduled = sorted.reduce((sum, s) => sum + s.durationMin, 0);
  const daySpan = lastEnd - firstStart;
  const densityScore = daySpan > 0 ? Math.min(1, totalScheduled / daySpan) : null;

  // Walk intensity: total geo distance normalized to 10km = 1.0
  let walkIntensity: number | null = null;
  if (sorted.length >= 2) {
    const totalKm = sorted.slice(0, -1).reduce((sum, s, i) =>
      sum + haversineKm(s.lat, s.lon, sorted[i + 1].lat, sorted[i + 1].lon), 0);
    walkIntensity = Math.min(1, totalKm / 10);
  }

  // Category diversity: Shannon entropy of semantic roles
  const roleCounts = new Map<string, number>();
  for (const r of roles) roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  const total = roles.length;
  const entropy = -Array.from(roleCounts.values())
    .map(c => (c / total) * Math.log2(c / total))
    .reduce((a, b) => a + b, 0);
  const maxEntropy = Math.log2(7);
  const categoryDiversity = Math.min(1, entropy / maxEntropy);

  // Time balance: variance from ideal 1/3 morning / 1/3 afternoon / 1/3 evening
  const morning   = sorted.filter(s => timeToMin(s.time) < 720).length / total;
  const afternoon = sorted.filter(s => { const m = timeToMin(s.time); return m >= 720 && m < 1080; }).length / total;
  const evening   = sorted.filter(s => timeToMin(s.time) >= 1080).length / total;
  const ideal = 1 / 3;
  const variance = ((morning - ideal) ** 2 + (afternoon - ideal) ** 2 + (evening - ideal) ** 2) / 3;
  const timeBalance = Math.max(0, 1 - variance * 9);

  // Geo efficiency: direct / route ratio
  let geoEfficiency: number | null = null;
  if (sorted.length >= 2) {
    const totalRoute = sorted.slice(0, -1).reduce((sum, s, i) =>
      sum + haversineKm(s.lat, s.lon, sorted[i + 1].lat, sorted[i + 1].lon), 0);
    const direct = haversineKm(sorted[0].lat, sorted[0].lon, sorted.at(-1)!.lat, sorted.at(-1)!.lon);
    geoEfficiency = totalRoute > 0 ? Math.min(1, direct / totalRoute) : 1;
  }

  // Weather alignment: outdoor ratio vs forecast
  const outdoorRatio = sorted.filter(s => OUTDOOR_CATS.has(s.category)).length / sorted.length;
  const weatherAlignment = signal.weather
    ? (signal.weather.isOutdoorFriendly ? outdoorRatio : 1 - outdoorRatio)
    : null;

  // Crowd optimization: crowd-sensitive stops outside peak hours
  const crowdSensitive = sorted.filter(s => !!CROWD_PEAK[s.category]);
  const crowdOptimization: number | null = crowdSensitive.length === 0 ? null : (() => {
    const atPeak = crowdSensitive.filter(s => {
      const [lo, hi] = CROWD_PEAK[s.category]!;
      const m = timeToMin(s.time);
      return m >= lo && m <= hi;
    }).length;
    return 1 - atPeak / crowdSensitive.length;
  })();

  // Budget alignment: avg priceLevel / 4
  const withPrice = sorted.filter(s => s.priceLevel !== null);
  const budgetAlignment = withPrice.length === 0 ? null
    : withPrice.reduce((sum, s) => sum + (s.priceLevel ?? 0), 0) / withPrice.length / 4;

  // Live event overlap
  const liveEventOverlap = computeLiveEvent(stops, signal);

  return {
    hasLunch, hasDinner, hasEveningActivity, hasCulture, hasOutdoor, hasRest,
    hasSocialStop, hasHiddenGem, densityScore, walkIntensity, categoryDiversity,
    timeBalance, geoEfficiency, weatherAlignment, crowdOptimization, budgetAlignment,
    liveEventOverlap,
    trendAlignment: null, localVelocity: null, curatedCoverage: null, routeScenicity: null,
  };
}

function computeLiveEvent(stops: EngineItineraryStop[], signal: RecoSignal): number | null {
  const { savedEvents, trip } = signal;
  if (savedEvents.length === 0 && signal.dismissedPinIds.size === 0) return null;

  const stopTitles = new Set(stops.map(s => s.title.toLowerCase()));
  const unadded = savedEvents.filter(e => {
    const dateMatch = e.date === trip.currentDayDate ||
      (e.isAnnual && e.date?.slice(5) === trip.currentDayDate?.slice(5));
    return dateMatch && !stopTitles.has(e.title.toLowerCase());
  });

  return unadded.length === 0 ? null : Math.min(1, unadded.length * 0.5);
}
