import { describe, it, expect } from 'vitest';
import { computeTargetProfile, computeActualProfile } from './profile';
import type { RecoSignal } from './signal';
import type { EngineItineraryStop } from '../../../shared/types';

const BASE_WEIGHTS = { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.8, w_culture_depth: 0.5, w_nightlife: 0.5, w_budget_sensitivity: 0.5, w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5 };

function makeSignal(overrides: Partial<RecoSignal> = {}): RecoSignal {
  return {
    weights: BASE_WEIGHTS, archetype: 'explorer', archetypeGroup: 'explorer',
    archetypeConfidence: 1.0, pace: 'moderate', social: 'solo', isFamily: false,
    ritualStrength: 0.5, sensoryIntensity: 0.5, spontaneityBias: 0.5,
    trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-05-26' },
    weather: { condition: 'sunny', tempC: 22, isOutdoorFriendly: true },
    dismissedPinIds: new Set(), savedEvents: [],
    ...overrides,
  };
}

function stop(overrides: Partial<EngineItineraryStop>): EngineItineraryStop {
  return { id: 's1', placeId: 'p1', title: 'Place', area: 'Centre', day: 1, time: '09:00', durationMin: 90, category: 'museum', lat: 0, lon: 0, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null, ...overrides };
}

describe('computeTargetProfile', () => {
  it('hasLunch target is always 0.9', () => {
    const t = computeTargetProfile(makeSignal());
    expect(t.hasLunch).toBeCloseTo(0.9);
  });

  it('hasCulture target equals w_culture_depth', () => {
    const t = computeTargetProfile(makeSignal({ weights: { ...BASE_WEIGHTS, w_culture_depth: 0.8 } }));
    expect(t.hasCulture).toBeCloseTo(0.8);
  });

  it('densityScore target = 0.35 for slow pace', () => {
    const t = computeTargetProfile(makeSignal({ pace: 'slow' }));
    expect(t.densityScore).toBeCloseTo(0.35);
  });

  it('densityScore target = 0.75 for fast pace', () => {
    const t = computeTargetProfile(makeSignal({ pace: 'fast' }));
    expect(t.densityScore).toBeCloseTo(0.75);
  });
});

describe('computeActualProfile', () => {
  it('hasLunch = 1 when restaurant stop at 12:30', () => {
    const stops = [stop({ id: 's1', time: '12:30', category: 'restaurant', durationMin: 60 })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasLunch).toBe(1);
  });

  it('hasLunch = 0 when no food stop in lunch window', () => {
    const stops = [stop({ id: 's1', time: '09:00', category: 'museum' })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasLunch).toBe(0);
  });

  it('hasCulture = 1 when museum present', () => {
    const stops = [stop({ category: 'museum' })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasCulture).toBe(1);
  });

  it('hasCulture = 0 when only restaurants', () => {
    const stops = [stop({ category: 'restaurant' })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.hasCulture).toBe(0);
  });

  it('densityScore = null for empty stops', () => {
    const actual = computeActualProfile([], makeSignal());
    expect(actual.densityScore).toBeNull();
  });

  it('budgetAlignment = null when no priceLevel data', () => {
    const stops = [stop({ priceLevel: null })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.budgetAlignment).toBeNull();
  });

  it('budgetAlignment computed from priceLevel when available', () => {
    const stops = [stop({ priceLevel: 4 })];
    const actual = computeActualProfile(stops, makeSignal());
    expect(actual.budgetAlignment).toBeCloseTo(1.0);
  });

  it('liveEventOverlap = null when no saved events', () => {
    const actual = computeActualProfile([], makeSignal());
    expect(actual.liveEventOverlap).toBeNull();
  });

  it('liveEventOverlap > 0 when saved event date matches current day', () => {
    const signal = makeSignal({ savedEvents: [{ id: 'e1', title: 'Taylor Swift', city: 'Paris', date: '2026-05-26', isAnnual: false, venue: 'Arena', category: 'concert', savedAt: '2026-05-01T00:00:00Z' }] });
    const actual = computeActualProfile([], signal);
    expect(actual.liveEventOverlap).toBeGreaterThan(0);
  });
});

// --- Task 1 regression tests ---

it('hasLunch = 1 when restaurant at 11:00 (below old 690 floor)', () => {
  const stops = [stop({ id: 's1', time: '11:00', category: 'restaurant', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasLunch).toBe(1);
});

it('hasLunch = 1 when cafe at 15:00 (above old 870 ceiling)', () => {
  const stops = [stop({ id: 's1', time: '15:00', category: 'cafe', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasLunch).toBe(1);
});

it('hasLunch = 0 when no food stop between 11:00–15:00', () => {
  const stops = [stop({ id: 's1', time: '10:30', category: 'restaurant', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasLunch).toBe(0);
});

it('hasDinner = 1 when restaurant at 17:30', () => {
  const stops = [stop({ id: 's1', time: '17:30', category: 'restaurant', durationMin: 90 })];
  expect(computeActualProfile(stops, makeSignal()).hasDinner).toBe(1);
});

it('hasDinner = 0 when no food stop after 17:00', () => {
  const stops = [stop({ id: 's1', time: '16:30', category: 'restaurant', durationMin: 60 })];
  expect(computeActualProfile(stops, makeSignal()).hasDinner).toBe(0);
});

it('hasRest = 1 when cafe present regardless of weather', () => {
  const signal = makeSignal({ weather: { condition: 'rain', tempC: 12, isOutdoorFriendly: false } });
  const stops = [stop({ id: 's1', time: '11:00', category: 'cafe', durationMin: 30 })];
  expect(computeActualProfile(stops, signal).hasRest).toBe(1);
});

it('hasRest = 0 when only museums and restaurants', () => {
  const stops = [
    stop({ id: 's1', time: '09:00', category: 'museum', durationMin: 90 }),
    stop({ id: 's2', time: '12:00', category: 'restaurant', durationMin: 60 }),
  ];
  expect(computeActualProfile(stops, makeSignal()).hasRest).toBe(0);
});
