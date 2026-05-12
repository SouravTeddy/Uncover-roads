import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../../shared/store';
import type { ReferencePin, FavouritedPin, CityFootprint } from '../../shared/types';

const mockPin: ReferencePin = {
  id: 'ref-1',
  title: 'Senso-ji',
  lat: 35.71,
  lon: 139.79,
  category: 'historic',
  whyRec: 'Matches your cultural pace',
  localTip: 'Arrive before 8am to beat crowds',
};

const mockFav: FavouritedPin = {
  placeId: 'p-1',
  title: 'Senso-ji',
  lat: 35.71,
  lon: 139.79,
  city: 'Tokyo',
};

const mockFootprint: CityFootprint = {
  city: 'Tokyo',
  emoji: '🗼',
  pinCount: 4,
  lat: 35.68,
  lon: 139.69,
};

describe('referencePins', () => {
  it('defaults to empty array', () => {
    expect(initialState.referencePins).toEqual([]);
  });

  it('SET_REFERENCE_PINS replaces the array', () => {
    const next = reducer(initialState, { type: 'SET_REFERENCE_PINS', pins: [mockPin] });
    expect(next.referencePins).toEqual([mockPin]);
  });
});

describe('favouritedPins', () => {
  it('defaults to empty array', () => {
    expect(initialState.favouritedPins).toEqual([]);
  });

  it('TOGGLE_FAVOURITE adds a pin not yet in list', () => {
    const next = reducer(initialState, { type: 'TOGGLE_FAVOURITE', pin: mockFav });
    expect(next.favouritedPins).toEqual([mockFav]);
  });

  it('TOGGLE_FAVOURITE removes a pin already in list', () => {
    const withFav = reducer(initialState, { type: 'TOGGLE_FAVOURITE', pin: mockFav });
    const removed = reducer(withFav, { type: 'TOGGLE_FAVOURITE', pin: mockFav });
    expect(removed.favouritedPins).toEqual([]);
  });
});

describe('cityFootprints', () => {
  it('defaults to empty array', () => {
    expect(initialState.cityFootprints).toEqual([]);
  });

  it('ADD_CITY_FOOTPRINT appends if city not present', () => {
    const next = reducer(initialState, { type: 'ADD_CITY_FOOTPRINT', footprint: mockFootprint });
    expect(next.cityFootprints).toHaveLength(1);
    expect(next.cityFootprints[0].city).toBe('Tokyo');
  });

  it('ADD_CITY_FOOTPRINT updates pinCount if city already present', () => {
    const withCity = reducer(initialState, { type: 'ADD_CITY_FOOTPRINT', footprint: mockFootprint });
    const updated = reducer(withCity, {
      type: 'ADD_CITY_FOOTPRINT',
      footprint: { ...mockFootprint, pinCount: 7 },
    });
    expect(updated.cityFootprints).toHaveLength(1);
    expect(updated.cityFootprints[0].pinCount).toBe(7);
  });
});

describe('similarPinsState', () => {
  it('defaults to null', () => {
    expect(initialState.similarPinsState).toBeNull();
  });

  it('SET_SIMILAR_PINS sets the state', () => {
    const next = reducer(initialState, {
      type: 'SET_SIMILAR_PINS',
      state: { sourcePlaceId: 'p-1', similarIds: ['ref-2', 'ref-3'] },
    });
    expect(next.similarPinsState?.sourcePlaceId).toBe('p-1');
  });

  it('SET_SIMILAR_PINS with null clears the state', () => {
    const withSimilar = reducer(initialState, {
      type: 'SET_SIMILAR_PINS',
      state: { sourcePlaceId: 'p-1', similarIds: ['ref-2'] },
    });
    const cleared = reducer(withSimilar, { type: 'SET_SIMILAR_PINS', state: null });
    expect(cleared.similarPinsState).toBeNull();
  });
});
