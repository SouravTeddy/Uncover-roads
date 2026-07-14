import { describe, it, expect } from 'vitest';
import { buildReelCards, buildWalkableDetourObservations } from './reel-builder';
import type { EngineItinerary, EngineItineraryDay, WeatherData, JourneyLeg, EngineItineraryStop } from '../../../shared/types';

const DEFAULT_WEIGHTS = {
  w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5,
  w_food_density: 0.5, w_culture_depth: 0.5, w_nightlife: 0.2,
  w_budget_sensitivity: 0.4, w_crowd_aversion: 0.5,
  w_spontaneity: 0.5, w_rest_need: 0.5,
};

const STOP = (overrides: Partial<EngineItineraryStop> = {}): EngineItineraryStop => ({
  id: 'stop-1',
  placeId: 'place-1',
  title: 'Test Place',
  area: 'Centre',
  day: 1,
  time: '09:00',
  durationMin: 90,
  category: 'museum',
  lat: 0,
  lon: 0,
  whyForYou: 'Matches your historian archetype',
  localTip: 'Go early',
  imageUrl: null,
  rating: null,
  priceLevel: null,
  openNow: null,
  weekdayText: null,
  orderReason: null,
  orderConsequence: null,
  movedFrom: null,
  googleMapsUrl: null,
  website: null,
  photoRef: null,
  ...overrides,
});

const DAY = (city: string, date: string, stops: EngineItineraryStop[], day = 1): EngineItineraryDay => ({
  day,
  date,
  city,
  isTravel: false,
  stops,
  messages: [],
});

const WEATHER: WeatherData = { temp: 22, condition: 'sunny', icon: 'wb_sunny' };
const WEATHER_MAP = new Map<string, WeatherData>([['paris', WEATHER], ['lyon', WEATHER]]);

const ITIN = (stops: EngineItineraryStop[]): EngineItinerary => ({
  id: 'itin-1',
  generatedAt: '2026-05-20T00:00:00Z',
  cities: ['Paris'],
  days: [DAY('Paris', '2026-05-20', stops)],
  personaSnapshot: DEFAULT_WEIGHTS,
  archetypeSnapshot: 'explorer',
});

describe('buildReelCards', () => {
  it('wraps stops in intro + summary + stops + finale for single city', () => {
    const cards = buildReelCards(ITIN([STOP()]), null, null, WEATHER_MAP, 'explorer');
    expect(cards[0].type).toBe('intro');
    expect(cards[1].type).toBe('stop');
    expect(cards.some(c => c.type === 'stop')).toBe(true);
    expect(cards[cards.length - 1].type).toBe('finale');
  });

  it('inserts transit card between cities in multi-city journey', () => {
    const legs: JourneyLeg[] = [
      { type: 'transit', mode: 'train', from: 'Paris', to: 'Lyon', fromCoords: [0, 0], toCoords: [0, 0], durationMinutes: 120, distanceKm: 460 },
    ];
    const multiItin: EngineItinerary = {
      id: 'multi',
      generatedAt: '2026-05-20T00:00:00Z',
      cities: ['Paris', 'Lyon'],
      days: [
        DAY('Paris', '2026-05-20', [STOP({ id: 's1' })], 1),
        DAY('Lyon', '2026-05-21', [STOP({ id: 's2', day: 2 })], 2),
      ],
      personaSnapshot: DEFAULT_WEIGHTS,
      archetypeSnapshot: 'explorer',
    };
    const cards = buildReelCards(multiItin, legs, null, WEATHER_MAP, 'explorer');
    // Inter-city transitions are now emitted as 'day_transition' cards (not 'transit')
    const transit = cards.find(c => c.type === 'day_transition') as any;
    expect(transit).toBeDefined();
    expect(transit.isCityChange).toBe(true);
    expect(transit.prevCity).toBe('Paris');
    expect(transit.nextCity).toBe('Lyon');
    expect(transit.transitMode).toBe('train');
  });

  it('inserts placeholder transit card when journeyLegs is empty but cities differ', () => {
    const multiItin: EngineItinerary = {
      id: 'multi2',
      generatedAt: '2026-05-20T00:00:00Z',
      cities: ['Paris', 'Lyon'],
      days: [
        DAY('Paris', '2026-05-20', [STOP({ id: 's1' })], 1),
        DAY('Lyon', '2026-05-21', [STOP({ id: 's2', day: 2 })], 2),
      ],
      personaSnapshot: DEFAULT_WEIGHTS,
      archetypeSnapshot: 'explorer',
    };
    const cards = buildReelCards(multiItin, [], null, WEATHER_MAP, 'explorer');
    // Placeholder inserted as 'day_transition' even without leg data
    const transit = cards.find(c => c.type === 'day_transition') as any;
    expect(transit).toBeDefined();
    if (transit) {
      expect(transit.transitIsEstimated).toBe(true);
      expect(transit.transitDurationMin).toBeNull();
    }
  });

  it('intel card with stopId is anchored to matching stop, not title-matched', () => {
    const s1 = STOP({ id: 'stop-1', placeId: 'place-abc', title: 'Museum of Art', time: '09:00', durationMin: 90 });
    const s2 = STOP({ id: 'stop-2', placeId: 'place-xyz', title: 'City Cafe', time: '12:00', durationMin: 60 });
    const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
    // Use 'resequence' type — 'insert' type is filtered out of the card stream
    day.messages = [{
      id: 'msg-1', type: 'resequence' as const, what: 'Reordered for better flow',
      why: 'Museum is better visited first', consequence: 'Saves 20 min travel',
      dismissable: true, stopId: 'place-abc',
    }];
    const itin = { ...ITIN([s1, s2]), days: [day] };
    const cards = buildReelCards(itin, null, null, new Map(), 'explorer');
    const intelIdx = cards.findIndex(c => c.type === 'intel');
    const s1Idx = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-1');
    const s2Idx = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-2');
    expect(intelIdx).toBeGreaterThan(s1Idx);
    expect(intelIdx).toBeLessThan(s2Idx);
  });

  it('generates scenic walk card between close stops when w_scenic is high', () => {
    const s1 = STOP({ id: 'stop-1', lat: 12.97, lon: 77.59, time: '09:00', durationMin: 60 });
    const s2 = STOP({ id: 'stop-2', lat: 12.972, lon: 77.591, time: '11:00', durationMin: 60 });
    const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
    const itin = {
      ...ITIN([s1, s2]),
      days: [day],
      personaSnapshot: { ...DEFAULT_WEIGHTS, w_scenic: 0.7 },
    };
    const cards = buildReelCards(itin, null, null, new Map(), 'explorer');
    const scenicCards = cards.filter(c => c.type === 'scenic');
    expect(scenicCards.length).toBeGreaterThanOrEqual(1);
    const s1Idx = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-1');
    const scenicIdx = cards.findIndex(c => c.type === 'scenic');
    const s2Idx = cards.findIndex(c => c.type === 'stop' && (c as any).stop.id === 'stop-2');
    expect(scenicIdx).toBeGreaterThan(s1Idx);
    expect(scenicIdx).toBeLessThan(s2Idx);
  });

  it('does not generate scenic cards when w_scenic is low', () => {
    const s1 = STOP({ id: 'stop-1', lat: 12.97, lon: 77.59, time: '09:00' });
    const s2 = STOP({ id: 'stop-2', lat: 12.972, lon: 77.591, time: '11:00' });
    const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
    const itin = {
      ...ITIN([s1, s2]),
      days: [day],
      personaSnapshot: { ...DEFAULT_WEIGHTS, w_scenic: 0.2 },
    };
    const cards = buildReelCards(itin, null, null, new Map(), 'explorer');
    expect(cards.filter(c => c.type === 'scenic').length).toBe(0);
  });

  it('does not generate scenic cards between stops more than 2km apart', () => {
    const s1 = STOP({ id: 'stop-1', lat: 12.97, lon: 77.59, time: '09:00' });
    const s2 = STOP({ id: 'stop-2', lat: 13.02, lon: 77.59, time: '11:00' });
    const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
    const itin = {
      ...ITIN([s1, s2]),
      days: [day],
      personaSnapshot: { ...DEFAULT_WEIGHTS, w_scenic: 0.9 },
    };
    const cards = buildReelCards(itin, null, null, new Map(), 'explorer');
    expect(cards.filter(c => c.type === 'scenic').length).toBe(0);
  });

  it('day divider card includes startTime and endTime for multi-day itinerary', () => {
    const day1Stops = [STOP({ id: 's1', time: '09:00', durationMin: 90 })];
    const day2Stops = [
      STOP({ id: 's2', time: '10:00', durationMin: 120, day: 2 }),
      STOP({ id: 's3', time: '14:00', durationMin: 60, day: 2 }),
    ];
    const day1 = DAY('Bangalore', '2026-06-10', day1Stops, 1);
    const day2 = DAY('Bangalore', '2026-06-11', day2Stops, 2);
    const itin = {
      ...ITIN([...day1Stops, ...day2Stops]),
      days: [day1, day2],
    };
    const cards = buildReelCards(itin, null, null, new Map(), 'explorer');
    // Day dividers are now emitted as 'day_transition' cards
    const divider = cards.find(c => c.type === 'day_transition') as any;
    expect(divider).toBeDefined();
    expect(divider.nextStartTime).toBe('10:00');   // first stop time on day 2
    expect(divider.prevEndTime).toBe('10:30');     // day 1 last stop end: 09:00 + 90min
  });

  it('balance card message varies by category mix', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' as any }),
      STOP({ id: 's2', time: '11:00', category: 'restaurant' as any }),
      STOP({ id: 's3', time: '14:00', category: 'park' as any }),
    ];
    const day = DAY('Bangalore', '2026-06-10', stops);
    const itin = { ...ITIN(stops), days: [day] };
    const cards = buildReelCards(itin, null, null, new Map(), 'explorer', new Map([[0, []]]));
    const balance = cards.find(c => c.type === 'balance') as any;
    expect(balance).toBeDefined();
    expect(balance.message).not.toBe('Your day looks well-balanced for your style.');
    expect(typeof balance.message).toBe('string');
    expect(balance.message.length).toBeGreaterThan(5);
  });
});

describe('walkable detour card', () => {
  function makeStop(id: string, lat: number, lon: number, time = '09:00'): EngineItineraryStop {
    return {
      id, placeId: id, title: `Stop ${id}`, area: 'Centre', day: 1,
      time, durationMin: 90, category: 'museum', lat, lon,
      priceLevel: null, rating: null, weekdayText: null, whyForYou: '',
      localTip: null, googleMapsUrl: null, website: null, photoRef: null,
    };
  }

  it('emits a scenic card for a walkable leg when persona is non-walk', () => {
    const weights = { w_walk_affinity: 0.3, w_scenic: 0.2, w_efficiency: 0.5, w_food_density: 0.5, w_culture_depth: 0.5, w_nightlife: 0.3, w_budget_sensitivity: 0.3, w_crowd_aversion: 0.3, w_spontaneity: 0.3, w_rest_need: 0.3 };
    // Use the existing DAY and ITIN helpers defined at the top of this test file.
    const stops = [
      makeStop('s1', 48.860, 2.350, '09:00'),  // ~300m apart — walkable
      makeStop('s2', 48.863, 2.350, '11:00'),
    ];
    const day = { ...DAY('Paris', '2026-06-20', stops), walkBaseKm: 2.0 };
    const itinerary: EngineItinerary = {
      id: 'itin-test', generatedAt: '2026-06-20T00:00:00Z',
      city: 'Paris', cities: ['Paris'],
      personaSnapshot: weights,
      archetypeSnapshot: 'explorer',
      days: [day],
    };
    const cards = buildReelCards(itinerary, null, null, new Map(), 'explorer');
    const scenicCards = cards.filter(c => c.type === 'scenic');
    // Detour card for non-walk persona on a 0.33 km leg should appear
    expect(scenicCards.length).toBe(1);
    expect((scenicCards[0] as any).cardType).toBe('WALKABLE DETOUR');
  });
});

import type { EngineWeights } from '../../../shared/types';

const BASE_WEIGHTS: EngineWeights = {
  w_walk_affinity: 0.5, w_scenic: 0.5, w_efficiency: 0.5,
  w_food_density: 0.5, w_culture_depth: 0.5, w_nightlife: 0.3,
  w_budget_sensitivity: 0.5, w_crowd_aversion: 0.4, w_spontaneity: 0.5, w_rest_need: 0.5,
};

function makeDetourStop(id: string, lat: number, lon: number) {
  return {
    id, placeId: id, title: `Stop ${id}`, area: 'Centre', day: 1,
    time: '10:00', durationMin: 60, category: 'museum' as const,
    lat, lon, priceLevel: null, rating: null, weekdayText: null,
    whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null,
  };
}

// Two stops ~0.75 km apart (Paris centre)
const STOP_A = makeDetourStop('a', 48.8566, 2.3522);
const STOP_B = makeDetourStop('b', 48.8566, 2.3630);

describe('buildWalkableDetourObservations — L1/L2 thresholds', () => {
  it('fires for w_walk_affinity 0.70 (L1 gate raised to 0.80)', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.70 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0);
    expect(obs.length).toBeGreaterThan(0);
  });

  it('does NOT fire for w_walk_affinity 0.85 (above L1 gate)', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.85 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0);
    expect(obs.length).toBe(0);
  });

  it('old gate 0.55 — still fires at 0.50 (backward compat)', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.50 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0);
    expect(obs.length).toBeGreaterThan(0);
  });

  it('L2 explorer path: fires for stops > 2km when persona is explorer and walk_affinity < 0.35', () => {
    // Two stops ~2.95 km apart
    const FAR_A = makeDetourStop('fa', 48.8566, 2.3522);
    const FAR_B = makeDetourStop('fb', 48.8566, 2.3926);  // ~2.95 km east
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.30 };
    const obs = buildWalkableDetourObservations([FAR_A, FAR_B], 'Paris', weights, 2.0, 'wanderer');
    expect(obs.length).toBeGreaterThan(0);
  });

  it('L2 explorer copy is bolder than L1', () => {
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.25 };
    const obs = buildWalkableDetourObservations([STOP_A, STOP_B], 'Paris', weights, 2.0, 'wanderer');
    expect(obs[0]?.consequence.toLowerCase()).toMatch(/wander|detour|remember|yours/);
  });

  it('non-explorer persona does NOT get extended L2 range', () => {
    const FAR_A = makeDetourStop('fa', 48.8566, 2.3522);
    const FAR_B = makeDetourStop('fb', 48.8566, 2.3926);  // ~2.95 km — beyond L1 maxKm of 2.0
    const weights = { ...BASE_WEIGHTS, w_walk_affinity: 0.30 };
    const obs = buildWalkableDetourObservations([FAR_A, FAR_B], 'Paris', weights, 2.0, 'epicurean');
    expect(obs.length).toBe(0);  // 2.95km > 2km walkBaseKm, no L2 extension for epicurean
  });
});
