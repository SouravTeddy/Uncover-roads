import { describe, it, expect } from 'vitest';
import { detectIconicGap } from './iconic';
import type { EngineItineraryStop } from '../../../shared/types';

function stop(name: string, category = 'tourism'): EngineItineraryStop {
  return {
    id: name, placeId: name, title: name, area: 'Centre', day: 1,
    time: '10:00', durationMin: 90, category, lat: 0, lon: 0,
    priceLevel: null, rating: null, weekdayText: null,
    whyForYou: '', localTip: null, googleMapsUrl: null,
    website: null, photoRef: null,
    name,
  } as unknown as EngineItineraryStop;
}

describe('detectIconicGap', () => {
  it('returns null when city has no table entry', () => {
    expect(detectIconicGap([stop('Noma Restaurant')], 'Copenhagen')).toBeNull();
  });

  it('returns the first missing iconic for a known city', () => {
    const gap = detectIconicGap([stop('Random Café')], 'Paris');
    expect(gap).not.toBeNull();
    expect(gap?.name).toBe('Eiffel Tower');
  });

  it('returns null when all iconics are covered', () => {
    const stops = [stop('Eiffel Tower Terrace'), stop('Louvre Museum')];
    expect(detectIconicGap(stops, 'Paris')).toBeNull();
  });

  it('skips covered iconics and returns the next missing one', () => {
    const stops = [stop('Eiffel Tower')];
    const gap = detectIconicGap(stops, 'Paris');
    expect(gap?.name).toBe('The Louvre');
  });

  it('matches case-insensitively', () => {
    const stops = [stop('EIFFEL TOWER observation deck'), stop('Musée du Louvre')];
    expect(detectIconicGap(stops, 'Paris')).toBeNull();
  });

  it('normalises city name with spaces', () => {
    const gap = detectIconicGap([stop('Zara')], 'New York');
    expect(gap?.name).toBe('Central Park');
  });

  it('returns null when iconic appears in a different day stop (cross-day coverage)', () => {
    // All stops passed — iconics from day2 should count
    const allStops = [stop('Some Bar'), stop('Eiffel Tower'), stop('Louvre Museum')];
    expect(detectIconicGap(allStops, 'Paris')).toBeNull();
  });

  it('returns gap for kyoto when fushimi inari is missing', () => {
    const gap = detectIconicGap([stop('Nishiki Market')], 'Kyoto');
    expect(gap?.name).toBe('Fushimi Inari Shrine');
  });
});
