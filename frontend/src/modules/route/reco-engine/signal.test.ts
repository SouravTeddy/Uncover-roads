import { describe, it, expect } from 'vitest';
import { computeRecoSignal } from './signal';
import type { AppState } from '../../../shared/store';
import type { EngineItinerary } from '../../../shared/types';

const BASE_WEIGHTS = {
  w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5, w_food_density: 0.5,
  w_culture_depth: 0.5, w_nightlife: 0.5, w_budget_sensitivity: 0.5,
  w_crowd_aversion: 0.5, w_spontaneity: 0.5, w_rest_need: 0.5,
};

const BASE_ITIN: EngineItinerary = {
  id: 'i1', generatedAt: '2026-05-26T00:00:00Z',
  cities: ['Paris'],
  days: [{ day: 1, date: '2026-05-26', city: 'Paris', isTravel: false, stops: [], messages: [] }],
  personaSnapshot: BASE_WEIGHTS,
  archetypeSnapshot: 'explorer',
};

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    obAnswers: { ritual: 'coffee', sensory: 'visual', style: 'spontaneous', attractions: ['historic'], pace: 'walking', social: 'solo' },
    persona: { archetype: 'explorer', archetype_name: 'Explorer', archetype_desc: '', ritual: 'coffee', sensory: 'visual', style: 'spontaneous', attractions: ['historic'], pace: 'walking', social: 'solo', archetypeData: { name: 'Explorer', desc: '', venue_filters: [], itinerary_bias: [] }, venue_filters: [], itinerary_bias: [] },
    travelStartDate: '2026-05-26',
    travelEndDate: null,
    tripContext: { startType: 'hotel', arrivalTime: null, date: '2026-05-26', days: 1, dayNumber: 1, flightTime: null, isLongHaul: false, locationLat: null, locationLon: null, locationName: null },
    weather: { temp: 22, condition: 'sunny', icon: 'wb_sunny' },
    savedEvents: [],
    dismissedPinIds: [],
    pendingTripDetails: null,
    journey: null,
    ...overrides,
  } as AppState;
}

describe('computeRecoSignal', () => {
  it('maps pace walking → slow', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.pace).toBe('slow');
  });

  it('maps social solo → solo', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.social).toBe('solo');
  });

  it('maps social family → group and sets isFamily true', () => {
    const signal = computeRecoSignal(makeState({ obAnswers: { ritual: null, sensory: null, style: null, attractions: [], pace: null, social: 'family' } }), 0, BASE_ITIN);
    expect(signal.social).toBe('group');
    expect(signal.isFamily).toBe(true);
  });

  it('computes archetypeConfidence from answered OB questions', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.archetypeConfidence).toBeCloseTo(1.0);
  });

  it('sets archetypeConfidence to 0 when no OB answers', () => {
    const signal = computeRecoSignal(makeState({ obAnswers: { ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null } }), 0, BASE_ITIN);
    expect(signal.archetypeConfidence).toBe(0);
  });

  it('sets weather.isOutdoorFriendly true for sunny weather above 10°', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.weather?.isOutdoorFriendly).toBe(true);
  });

  it('sets weather.isOutdoorFriendly false for rain', () => {
    const signal = computeRecoSignal(makeState({ weather: { temp: 15, condition: 'rain', icon: 'umbrella' } }), 0, BASE_ITIN);
    expect(signal.weather?.isOutdoorFriendly).toBe(false);
  });

  it('trip.isFirstDay true for dayIdx 0', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.trip.isFirstDay).toBe(true);
    expect(signal.trip.isLastDay).toBe(true);
  });
});
