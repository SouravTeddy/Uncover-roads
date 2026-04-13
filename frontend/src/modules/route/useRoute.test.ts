import { describe, it, expect, vi, afterEach } from 'vitest';
import { retryDay } from './useRoute';
import type { ItineraryRequest } from '../../shared/api';
import type { Itinerary } from '../../shared/types';

const mockItinerary: Itinerary = {
  itinerary: [{ day: 2, time: '9:00 AM', place: 'Park', duration: '1h', tip: 'Go early', transit_to_next: '5 min walk', tags: [] }],
  summary: { total_places: 1, best_transport: 'walk', pro_tip: 'tip', conflict_notes: '', suggested_start_time: '9:00 AM', day_narrative: 'Outdoor day' },
};

const baseRequest: ItineraryRequest = {
  city: 'Tokyo',
  lat: 35.6762,
  lon: 139.6503,
  days: 3,
  day_number: 1,
  pace: 'moderate',
  persona: 'explorer',
  persona_archetype: 'Explorer',
  persona_context: '',
  trip_context: {
    start_type: 'hotel',
    arrival_time: '10:00',
    travel_date: '2026-05-01',
    total_days: 3,
    flight_time: null,
    is_long_haul: false,
    location_lat: null,
    location_lon: null,
    location_name: null,
  },
};

afterEach(() => vi.restoreAllMocks());

describe('retryDay', () => {
  it('returns null when api.aiItinerary fails both attempts', async () => {
    const { api } = await import('../../shared/api');
    vi.spyOn(api, 'aiItinerary').mockRejectedValue(new Error('network error'));

    const result = await retryDay(2, 3, '2026-05-01', baseRequest, 0);
    expect(result).toBeNull();
    expect(api.aiItinerary).toHaveBeenCalledTimes(2);
  });

  it('returns null when api.aiItinerary returns error object', async () => {
    const { api } = await import('../../shared/api');
    vi.spyOn(api, 'aiItinerary').mockResolvedValue({ error: 'Bad request' } as unknown as Itinerary);

    const result = await retryDay(2, 3, '2026-05-01', baseRequest, 0);
    expect(result).toBeNull();
  });

  it('returns itinerary when api.aiItinerary succeeds on second attempt', async () => {
    const { api } = await import('../../shared/api');
    vi.spyOn(api, 'aiItinerary')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(mockItinerary);

    const result = await retryDay(2, 3, '2026-05-01', baseRequest, 0);
    expect(result).toEqual(mockItinerary);
  });

  it('uses correct day_number and travel_date in the request', async () => {
    const { api } = await import('../../shared/api');
    const spy = vi.spyOn(api, 'aiItinerary').mockResolvedValue(mockItinerary);

    await retryDay(3, 3, '2026-05-01', baseRequest, 0);
    const calledBody = spy.mock.calls[0][0];
    expect(calledBody.day_number).toBe(3);
    expect(calledBody.trip_context.travel_date).toBe('2026-05-03'); // +2 days from start
  });
});
