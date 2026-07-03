import { describe, it, expect } from 'vitest';
import { getDimensionWeight } from './dimensions';
import type { RecoSignal } from './signal';

const BASE: RecoSignal = {
  weights: { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.8, w_culture_depth: 0.6, w_nightlife: 0.3, w_budget_sensitivity: 0.7, w_crowd_aversion: 0.4, w_spontaneity: 0.5, w_rest_need: 0.5 },
  archetype: 'explorer', archetypeGroup: 'explorer', archetypeConfidence: 1,
  pace: 'moderate', social: 'solo', isFamily: false, ritualStrength: 0.5,
  sensoryIntensity: 0.5, spontaneityBias: 0.5,
  trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-05-26' },
  weather: null, dismissedPinIds: new Set(), savedEvents: [], liveEvents: [],
};

describe('getDimensionWeight', () => {
  it('hasLunch has a floor of 0.3 regardless of w_food_density', () => {
    const w = getDimensionWeight('hasLunch', { ...BASE, weights: { ...BASE.weights, w_food_density: 0 } });
    expect(w).toBeGreaterThanOrEqual(0.3);
  });

  it('hasCulture weight equals w_culture_depth', () => {
    expect(getDimensionWeight('hasCulture', BASE)).toBeCloseTo(0.6);
  });

  it('budgetAlignment weight equals w_budget_sensitivity', () => {
    expect(getDimensionWeight('budgetAlignment', BASE)).toBeCloseTo(0.7);
  });

  it('crowdOptimization weight equals w_crowd_aversion', () => {
    expect(getDimensionWeight('crowdOptimization', BASE)).toBeCloseTo(0.4);
  });

  it('returns 0.3 for unknown dimension', () => {
    expect(getDimensionWeight('trendAlignment' as any, BASE)).toBeCloseTo(0.3);
  });
});
