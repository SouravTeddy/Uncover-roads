import { describe, it, expect } from 'vitest';
import { computeStopSemantics } from './semantics';
import type { EngineItineraryStop } from '../../../shared/types';
import type { RecoSignal } from './signal';

const SIGNAL = { weather: { isOutdoorFriendly: true } } as RecoSignal;
const SIGNAL_BAD_WX = { weather: { isOutdoorFriendly: false } } as RecoSignal;

function stop(overrides: Partial<EngineItineraryStop>): EngineItineraryStop {
  return { id: 's1', placeId: 'p1', title: 'Place', area: 'Centre', day: 1, time: '09:00', durationMin: 90, category: 'museum', lat: 0, lon: 0, priceLevel: null, rating: null, weekdayText: null, whyForYou: '', localTip: null, googleMapsUrl: null, website: null, photoRef: null, ...overrides };
}

describe('computeStopSemantics', () => {
  it('cafe at 14:00 after beach → scenic_rest', () => {
    const beach = stop({ id: 'b', time: '11:00', category: 'beach', durationMin: 120 });
    const cafe = stop({ id: 'c', time: '14:00', category: 'cafe', durationMin: 60 });
    expect(computeStopSemantics(cafe, [beach, cafe], SIGNAL)).toBe('scenic_rest');
  });

  it('cafe at 09:30 in dense urban (no scenic neighbors) → fuel_stop', () => {
    const museum = stop({ id: 'm', time: '08:00', category: 'museum' });
    const cafe = stop({ id: 'c', time: '09:30', category: 'cafe', durationMin: 20 });
    expect(computeStopSemantics(cafe, [museum, cafe], SIGNAL)).toBe('fuel_stop');
  });

  it('restaurant at 19:30 → evening_wind', () => {
    const s = stop({ time: '19:30', category: 'restaurant', durationMin: 90 });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('evening_wind');
  });

  it('museum with durationMin >= 120 → cultural_deep', () => {
    const s = stop({ category: 'museum', durationMin: 120 });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('cultural_deep');
  });

  it('museum with durationMin < 120 → anchor', () => {
    const s = stop({ category: 'museum', durationMin: 60 });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('anchor');
  });

  it('bar/nightlife → social_hub', () => {
    const s = stop({ category: 'bar', time: '21:00' });
    expect(computeStopSemantics(s, [s], SIGNAL)).toBe('social_hub');
  });

  it('park at 15:00 with scenic neighbor → scenic_rest', () => {
    const viewpoint = stop({ id: 'v', time: '13:00', category: 'viewpoint' });
    const park = stop({ id: 'p', time: '15:00', category: 'park', durationMin: 60 });
    expect(computeStopSemantics(park, [viewpoint, park], SIGNAL)).toBe('scenic_rest');
  });

  it('cafe after scenic stop but bad weather → fuel_stop (outdoor scenic suppressed)', () => {
    const beach = stop({ id: 'b', time: '11:00', category: 'beach', durationMin: 120 });
    const cafe = stop({ id: 'c', time: '14:00', category: 'cafe', durationMin: 60 });
    expect(computeStopSemantics(cafe, [beach, cafe], SIGNAL_BAD_WX)).toBe('fuel_stop');
  });
});
