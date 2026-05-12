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
  it('wraps stops in intro + stops + finale for single city', () => {
    const cards = buildReelCards(ITIN([STOP()]), null, null, WEATHER, 'explorer');
    expect(cards[0].type).toBe('intro');
    expect(cards[1].type).toBe('stop');
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

  it('does not inject a reco card when a restaurant stop exists in lunch window', () => {
    const stops = [
      STOP({ id: 's1', time: '09:00', category: 'museum' }),
      STOP({ id: 's2', time: '12:30', category: 'restaurant' }),
    ];
    const cards = buildReelCards(ITIN(stops), null, null, WEATHER, 'epicurean');
    const recos = cards.filter(c => c.type === 'reco');
    expect(recos.length).toBe(0);
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
});
