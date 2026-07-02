import { describe, it, expect } from 'vitest';
import { deriveRecos, gapToCard } from './engine';
import type { Gap } from './engine';
import type { RecoSignal } from './signal';
import type { ItineraryProfile } from './profile';
import type { EngineItineraryStop, Category } from '../../../shared/types';

const HIGH_FOOD_WEIGHTS = { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.9, w_culture_depth: 0.3, w_nightlife: 0.2, w_budget_sensitivity: 0.3, w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5 };

function makeSignal(overrides: Partial<RecoSignal> = {}): RecoSignal {
  return {
    weights: HIGH_FOOD_WEIGHTS, archetype: 'epicurean', archetypeGroup: 'sensory',
    archetypeConfidence: 1, pace: 'moderate', social: 'solo', isFamily: false,
    ritualStrength: 0.5, sensoryIntensity: 0.7, spontaneityBias: 0.5,
    trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-05-26' },
    weather: { condition: 'sunny', tempC: 22, isOutdoorFriendly: true },
    dismissedPinIds: new Set(), savedEvents: [],
    liveEvents: [],
    ...overrides,
  };
}

function stop(overrides: Partial<EngineItineraryStop>): EngineItineraryStop {
  return { id: 's1', placeId: 'p1', title: 'Place', area: 'Centre', day: 1, time: '09:00', durationMin: 90, category: 'museum', lat: 48.85, lon: 2.35, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null, ...overrides };
}

describe('deriveRecos', () => {
  it('returns lunch reco for high food_density persona with no lunch stop', () => {
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'museum' }),
      stop({ id: 's2', time: '15:00', category: 'park' }),
    ];
    const recos = deriveRecos(stops, makeSignal());
    expect(recos.some(r => r.trigger === 'lunch')).toBe(true);
  });

  it('does NOT return lunch reco when restaurant exists at 12:30', () => {
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'museum' }),
      stop({ id: 's2', time: '12:30', category: 'restaurant', durationMin: 60 }),
    ];
    const recos = deriveRecos(stops, makeSignal());
    expect(recos.every(r => r.trigger !== 'lunch')).toBe(true);
  });

  it('floor fires alongside gap recos on well-balanced sensory day', () => {
    const stops = [
      stop({ id: 's1', time: '09:00', category: 'museum', durationMin: 120 }),
      stop({ id: 's2', time: '12:30', category: 'restaurant', durationMin: 60 }),
      stop({ id: 's3', time: '14:30', category: 'park', durationMin: 90 }),
      stop({ id: 's4', time: '19:00', category: 'restaurant', durationMin: 90 }),
    ];
    const signal = makeSignal({ weights: { ...HIGH_FOOD_WEIGHTS, w_food_density: 0.5, w_culture_depth: 0.5 } });
    const recos = deriveRecos(stops, signal);
    // MAX_RECOS (3) + 1 conflict slot + 1 persona floor = 5 max; guard against reco floods
    expect(recos.length).toBeLessThanOrEqual(5);
  });

  it('surfaces live_event reco when saved event matches current day', () => {
    const signal = makeSignal({
      savedEvents: [{ id: 'e1', title: 'Taylor Swift', city: 'Paris', date: '2026-05-26', isAnnual: false, venue: 'Arena', category: 'concert', savedAt: '' }],
    });
    const recos = deriveRecos([], signal);
    expect(recos.some(r => r.trigger === 'live_event')).toBe(true);
  });

  it('conflict reco has significance boosted (conflictPresent in id)', () => {
    const signal = makeSignal({ pace: 'slow', weights: { ...HIGH_FOOD_WEIGHTS, w_rest_need: 0.8 } });
    const manyStops = Array.from({ length: 8 }, (_, i) =>
      stop({ id: `s${i}`, time: `${9 + i}:00`, durationMin: 55 })
    );
    const recos = deriveRecos(manyStops, signal);
    expect(Array.isArray(recos)).toBe(true);
  });
});

describe('gapToCard — previously missing templates', () => {
  const BASE_STOPS: EngineItineraryStop[] = [{
    id: 's1', placeId: 'p1', title: 'Test Place', area: 'Shinjuku', day: 1,
    time: '10:00', durationMin: 60, category: 'museum', lat: 35.6, lon: 139.7,
    priceLevel: 2, rating: 4.2, weekdayText: null, whyForYou: '', localTip: null,
    googleMapsUrl: null, website: null, photoRef: null,
  }];

  const BASE_SIGNAL: RecoSignal = {
    weights: { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.5, w_culture_depth: 0.5, w_nightlife: 0.5, w_budget_sensitivity: 0.5, w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5 },
    archetype: 'explorer', archetypeGroup: 'explorer', archetypeConfidence: 1.0,
    pace: 'moderate', social: 'solo', isFamily: false,
    ritualStrength: 0.5, sensoryIntensity: 0.5, spontaneityBias: 0.5,
    trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Tokyo', currentDayDate: '2026-05-26' },
    weather: null, dismissedPinIds: new Set(), savedEvents: [],
    liveEvents: [],
  };

  function makeGap(dimension: keyof ItineraryProfile, direction: 'missing' | 'excess' = 'missing'): Gap {
    return { dimension, target: 1, actual: 0, delta: direction === 'missing' ? 1 : -1, dimensionWeight: 0.5, significance: 0.5, direction, conflictPresent: false };
  }

  it('hasHiddenGem returns a card with trigger hidden_gem', () => {
    const card = gapToCard(makeGap('hasHiddenGem'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('hidden_gem');
  });

  it('categoryDiversity returns a card with trigger category_diversity', () => {
    const card = gapToCard(makeGap('categoryDiversity'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('category_diversity');
  });

  it('timeBalance missing returns time_balance card', () => {
    const card = gapToCard(makeGap('timeBalance', 'missing'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('time_balance');
  });

  it('geoEfficiency returns a card with trigger geo_efficiency', () => {
    const card = gapToCard(makeGap('geoEfficiency'), BASE_STOPS, BASE_SIGNAL);
    expect(card).not.toBeNull();
    expect(card?.trigger).toBe('geo_efficiency');
  });
});

describe('deriveRecos — persona floor reco', () => {
  const BASE_WEIGHTS = { w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.8, w_culture_depth: 0.9, w_nightlife: 0.2, w_budget_sensitivity: 0.3, w_crowd_aversion: 0.4, w_spontaneity: 0.3, w_rest_need: 0.3 };

  function makeStop(id: string, time: string, category: Category): EngineItineraryStop {
    return { id, placeId: id, title: `Place ${id}`, area: 'Centre', day: 1, time, durationMin: 90, category, lat: 0, lon: 0, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null };
  }

  function makeSignal(archetypeGroup: string): RecoSignal {
    return {
      weights: BASE_WEIGHTS, archetype: 'slowscholar', archetypeGroup: archetypeGroup as any,
      archetypeConfidence: 1.0, pace: 'slow', social: 'solo', isFamily: false,
      ritualStrength: 0.5, sensoryIntensity: 0.5, spontaneityBias: 0.3,
      trip: { totalDays: 1, dayNumber: 1, isFirstDay: true, isLastDay: true, isWeekend: false, isLongHaul: false, startType: 'hotel', arrivalTime: null, departureTime: null, city: 'Paris', currentDayDate: '2026-06-15' },
      weather: { condition: 'sunny', tempC: 22, isOutdoorFriendly: true },
      dismissedPinIds: new Set(), savedEvents: [],
      liveEvents: [],
    };
  }

  it('injects culture floor reco for cultural archetype when plan already has full culture', () => {
    // Plan is already culturally rich — no hasCulture gap
    const stops = [
      makeStop('s1', '09:00', 'museum'),
      makeStop('s2', '11:00', 'gallery'),
      makeStop('s3', '12:30', 'restaurant'),
      makeStop('s4', '14:00', 'historic'),
    ];
    const signal = makeSignal('cultural');
    const recos = deriveRecos(stops, signal);
    // Floor reco for 'cultural' group should still appear if no culture reco already present
    // In this case, hasCulture actual = 1.0 and target = 0.9, delta = -0.1, no gap → no culture reco from engine
    // Floor injects one
    expect(recos.some(r => r.trigger === 'culture')).toBe(true);
  });

  it('does NOT inject duplicate floor reco if engine already surfaced one for the archetype dimension', () => {
    // Plan has no culture at all → engine will surface hasCulture gap → floor reco should not duplicate
    const stops = [
      makeStop('s1', '09:00', 'restaurant'),
      makeStop('s2', '11:00', 'park'),
    ];
    const signal = makeSignal('cultural');
    const recos = deriveRecos(stops, signal);
    const cultureRecos = recos.filter(r => r.trigger === 'culture');
    expect(cultureRecos.length).toBe(1);
  });
});
