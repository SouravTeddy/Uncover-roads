import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reducer, initialState } from './store';
import type { AppState } from './store';
import type { Itinerary } from './types';

const mockDay1: Itinerary = {
  itinerary: [{ day: 1, time: '9:00 AM', place: 'Museum', duration: '2h', tip: 'Go early', transit_to_next: '10 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip', conflict_notes: '', suggested_start_time: '9:00 AM', day_narrative: 'Calm day' },
};
const mockDay2: Itinerary = {
  itinerary: [{ day: 2, time: '10:00 AM', place: 'Park', duration: '1h', tip: 'Bring water', transit_to_next: '5 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip2', conflict_notes: '', suggested_start_time: '10:00 AM', day_narrative: 'Outdoor day' },
};

describe('APPEND_ITINERARY_DAY reducer', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('appends a real day to empty array', () => {
    const state: AppState = { ...initialState, itineraryDays: [] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay1 });
    expect(next.itineraryDays).toEqual([mockDay1]);
  });

  it('appends a second real day', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay2 });
    expect(next.itineraryDays).toEqual([mockDay1, mockDay2]);
  });

  it('appends null (exhausted retry)', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'APPEND_ITINERARY_DAY', day: null });
    expect(next.itineraryDays).toEqual([mockDay1, null]);
  });

  it('calls sessionStorage.setItem with updated array', () => {
    const state: AppState = { ...initialState, itineraryDays: [] };
    reducer(state, { type: 'APPEND_ITINERARY_DAY', day: mockDay1 });
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'ur_ss_itin_days',
      JSON.stringify([mockDay1]),
    );
  });

  it('SET_ITINERARY_DAYS still resets to provided array', () => {
    const state: AppState = { ...initialState, itineraryDays: [mockDay1] };
    const next = reducer(state, { type: 'SET_ITINERARY_DAYS', days: [] });
    expect(next.itineraryDays).toEqual([]);
  });
});
