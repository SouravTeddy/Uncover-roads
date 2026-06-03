import { describe, it, expect } from 'vitest';
import { buildReelCards } from './reel-builder';
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
    const cards = buildReelCards(ITIN([STOP()]), null, null, WEATHER, 'explorer');
    expect(cards[0].type).toBe('intro');
    expect(cards[1].type).toBe('summary');
    expect(cards.some(c => c.type === 'stop')).toBe(true);
    expect(cards[cards.length - 1].type).toBe('finale');
  });

  it('injects a reco card at lunch window when no lunch stop exists', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' }),
      STOP({ id: 's2', time: '14:30', category: 'park' }),
    ];
    const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'epicurean');
    const recos = cards.filter(c => c.type === 'reco');
    expect(recos.length).toBeGreaterThan(0);
  });

  it('does not inject a lunch reco when a restaurant stop exists in lunch window', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' }),
      STOP({ id: 's2', time: '12:30', category: 'restaurant' }),
    ];
    const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'epicurean');
    const recos = cards.filter(c => c.type === 'reco');
    expect(recos.every(c => c.type === 'reco' && (c as import('./types').ReelRecoCard).trigger !== 'lunch')).toBe(true);
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
    const cards = buildReelCards(multiItin, legs, null, WEATHER, 'explorer');
    const transit = cards.find(c => c.type === 'transit');
    expect(transit).toBeDefined();
    expect(transit?.type).toBe('transit');
    if (transit?.type === 'transit') {
      expect(transit.from).toBe('Paris');
      expect(transit.to).toBe('Lyon');
    }
  });

  it('does not insert transit card when journeyLegs is empty', () => {
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
    const cards = buildReelCards(multiItin, [], null, WEATHER, 'explorer');
    const transit = cards.find(c => c.type === 'transit');
    expect(transit).toBeUndefined();
  });

  it('uses pre-computed recos when recosByDayIdx is provided', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' }),
      STOP({ id: 's2', time: '15:00', category: 'park' }),
    ];
    const fakeReco: import('./types').ReelRecoCard = {
      type: 'reco', id: 'hasLunch-s1', trigger: 'lunch',
      label: 'No lunch', consequence: 'Find something nearby',
      nearbyCity: 'Paris', persona: 'explorer', afterStopId: 's1', weightScore: 0.5,
    };
    const recosByDayIdx = new Map([[0, [fakeReco]]]);
    const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'explorer', recosByDayIdx);
    expect(cards.some(c => c.type === 'reco')).toBe(true);
  });

  it('injects balance card when engine returns empty recos map', () => {
    const stops = [STOP()];
    const recosByDayIdx = new Map([[0, []]]);
    const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'explorer', recosByDayIdx);
    expect(cards.some(c => c.type === 'balance')).toBe(true);
  });

  it('intel card with stopId is anchored to matching stop, not title-matched', () => {
    const s1 = STOP({ id: 'stop-1', placeId: 'place-abc', title: 'Museum of Art', time: '09:00', durationMin: 90 });
    const s2 = STOP({ id: 'stop-2', placeId: 'place-xyz', title: 'City Cafe', time: '12:00', durationMin: 60 });
    const day = DAY('Bangalore', '2026-06-10', [s1, s2]);
    // Message anchored to s1's placeId — headline does NOT contain "Museum of Art"
    day.messages = [{
      id: 'msg-1', type: 'insert' as const, what: 'Added a rest break',
      why: 'Long gap between stops', consequence: '30 min added',
      dismissable: true, stopId: 'place-abc',
    }];
    const itin = { ...ITIN([s1, s2]), days: [day] };
    const cards = buildReelCards(itin, null, null, null, 'explorer');
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
    const cards = buildReelCards(itin, null, null, null, 'explorer');
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
    const cards = buildReelCards(itin, null, null, null, 'explorer');
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
    const cards = buildReelCards(itin, null, null, null, 'explorer');
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
    const cards = buildReelCards(itin, null, null, null, 'explorer');
    const divider = cards.find(c => c.type === 'day_divider') as any;
    expect(divider).toBeDefined();
    expect(divider.startTime).toBe('10:00');   // first stop time on day 2
    expect(divider.endTime).toBe('15:00');     // last stop time + duration on day 2
  });

  it('balance card message varies by category mix', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' as any }),
      STOP({ id: 's2', time: '11:00', category: 'restaurant' as any }),
      STOP({ id: 's3', time: '14:00', category: 'park' as any }),
    ];
    const day = DAY('Bangalore', '2026-06-10', stops);
    const itin = { ...ITIN(stops), days: [day] };
    const cards = buildReelCards(itin, null, null, null, 'explorer', new Map([[0, []]]));
    const balance = cards.find(c => c.type === 'balance') as any;
    expect(balance).toBeDefined();
    expect(balance.message).not.toBe('Your day looks well-balanced for your style.');
    expect(typeof balance.message).toBe('string');
    expect(balance.message.length).toBeGreaterThan(5);
  });
});
