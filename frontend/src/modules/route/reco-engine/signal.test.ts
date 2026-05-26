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
    rawOBAnswers: {
      group: 'solo',
      mood: ['explore', 'culture'],
      pace: ['slow'],
      day_open: 'coffee',
      dietary: [],
      budget: 'mid_range',
      evening: 'dinner_wind',
    },
    persona: { archetype: 'explorer', archetype_name: 'Explorer', archetype_desc: '', ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null, archetypeData: { name: 'Explorer', desc: '', venue_filters: [], itinerary_bias: [] }, venue_filters: [], itinerary_bias: [] },
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
  it('maps pace slow → slow', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.pace).toBe('slow');
  });

  it('maps pace pack → fast', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, pace: ['pack'] } }), 0, BASE_ITIN);
    expect(signal.pace).toBe('fast');
  });

  it('maps pace balanced → moderate', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, pace: ['balanced'] } }), 0, BASE_ITIN);
    expect(signal.pace).toBe('moderate');
  });

  it('maps group solo → solo', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.social).toBe('solo');
  });

  it('maps group family → group and sets isFamily true', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, group: 'family' } }), 0, BASE_ITIN);
    expect(signal.social).toBe('group');
    expect(signal.isFamily).toBe(true);
  });

  it('maps group couple → duo', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, group: 'couple' } }), 0, BASE_ITIN);
    expect(signal.social).toBe('duo');
  });

  it('sets archetypeConfidence to 1.0 (mandatory OB)', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.archetypeConfidence).toBe(1.0);
  });

  it('maps day_open coffee → ritualStrength 0.8', () => {
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.ritualStrength).toBe(0.8);
  });

  it('maps day_open straight → ritualStrength 0.1', () => {
    const signal = computeRecoSignal(makeState({ rawOBAnswers: { ...makeState().rawOBAnswers!, day_open: 'straight' } }), 0, BASE_ITIN);
    expect(signal.ritualStrength).toBe(0.1);
  });

  it('sets sensoryIntensity from mood max', () => {
    // culture → 0.7, explore → 0.6 — max = 0.7
    const signal = computeRecoSignal(makeState(), 0, BASE_ITIN);
    expect(signal.sensoryIntensity).toBe(0.7);
  });

  it('sets weather.isOutdoorFriendly true for sunny above 10°', () => {
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

  it('defaults all signals when rawOBAnswers is null', () => {
    const signal = computeRecoSignal({ ...makeState(), rawOBAnswers: null }, 0, BASE_ITIN);
    expect(signal.pace).toBe('moderate');
    expect(signal.social).toBe('solo');
    expect(signal.ritualStrength).toBe(0.4);
    expect(signal.sensoryIntensity).toBe(0.4);
    expect(signal.isFamily).toBe(false);
  });
});
