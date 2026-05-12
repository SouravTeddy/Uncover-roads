import { describe, it, expect } from 'vitest';
import { buildReelCards } from './reel-builder';
import type { EngineItinerary, WeatherData, JourneyLeg, EngineItineraryStop } from '../../../shared/types';

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
  ...overrides,
});

const WEATHER: WeatherData = { temp: 22, condition: 'sunny', icon: 'wb_sunny' };

const ITIN = (stops: EngineItineraryStop[]): EngineItinerary => ({
  id: 'itin-1',
  city: 'Paris',
  days: [{ city: 'Paris', date: '2026-05-20', stops }],
  summary: { pro_tip: '', total_places: stops.length },
  weights: {},
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
      city: 'Paris · Lyon',
      days: [
        { city: 'Paris', date: '2026-05-20', stops: [STOP({ id: 's1' })] },
        { city: 'Lyon', date: '2026-05-21', stops: [STOP({ id: 's2', day: 2 })] },
      ],
      summary: { pro_tip: '', total_places: 2 },
      weights: {},
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
      city: 'Paris · Lyon',
      days: [
        { city: 'Paris', date: '2026-05-20', stops: [STOP({ id: 's1' })] },
        { city: 'Lyon', date: '2026-05-21', stops: [STOP({ id: 's2', day: 2 })] },
      ],
      summary: { pro_tip: '', total_places: 2 },
      weights: {},
    };
    // Empty legs array (non-null) — no matching leg exists
    const cards = buildReelCards(multiItin, [], null, WEATHER, 'explorer');
    const transit = cards.find(c => c.type === 'transit');
    expect(transit).toBeUndefined();
  });
});
