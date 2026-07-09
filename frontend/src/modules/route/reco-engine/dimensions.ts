import type { RecoSignal } from './signal';
import type { ItineraryProfile } from './profile';

export function getDimensionWeight(
  dim: keyof ItineraryProfile,
  signal: RecoSignal,
): number {
  const w = signal.weights;
  const map: Partial<Record<keyof ItineraryProfile, number>> = {
    hasLunch:           Math.max(0.3, w.w_food_density * 0.7 + 0.3),
    hasDinner:          Math.max(0.25, w.w_food_density * 0.6),
    hasEveningActivity: w.w_nightlife,
    hasCulture:         w.w_culture_depth,
    hasOutdoor:         w.w_scenic,
    hasRest:            Math.max(0.2, w.w_rest_need * 0.6 + (signal.pace === 'slow' ? 0.4 : 0)),
    hasSocialStop:      signal.social === 'solo' ? 0.2 : 0.5,
    hasHiddenGem:       signal.spontaneityBias * 0.5,
    densityScore:       Math.max(w.w_efficiency, 1 - w.w_rest_need),
    walkIntensity:      w.w_walk_affinity,
    categoryDiversity:  signal.spontaneityBias * 0.4 + 0.2,
    timeBalance:        0.4,
    geoEfficiency:      w.w_efficiency,
    weatherAlignment:   w.w_scenic * 0.5 + 0.5,
    crowdOptimization:  w.w_crowd_aversion,
    budgetAlignment:    w.w_budget_sensitivity,
    liveEventOverlap:   signal.spontaneityBias,
  };
  return map[dim] ?? 0.3;
}

// Pairs of dimension keys that are logically incompatible — keep only the higher-scoring one
export const CONFLICT_PAIRS: Array<[keyof ItineraryProfile, keyof ItineraryProfile]> = [
  ['densityScore', 'walkIntensity'],
];
