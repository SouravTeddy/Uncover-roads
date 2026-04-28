import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { retryDay, useRoute } from './useRoute';
import type { ItineraryRequest } from '../../shared/api';
import type { AppState } from '../../shared/store';
import type { Itinerary } from '../../shared/types';
import type { Action } from '../../shared/store';

const mockItinerary: Itinerary = {
  itinerary: [{ day: 2, time: '9:00 AM', place: 'Park', duration: '1h', category: 'park', tip: 'Go early', transit_to_next: '5 min walk', tags: [] }],
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

// ---------------------------------------------------------------------------
// Helpers for paywall tests
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<AppState>): AppState {
  return {
    currentScreen: 'route',
    obAnswers: { ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null },
    rawOBAnswers: null,
    personaProfile: null,
    obPreResolved: [],
    persona: null,
    city: 'Paris',
    cityGeo: { lat: 48.8566, lon: 2.3522 },
    places: [],
    selectedPlaces: [],
    activeFilter: 'all',
    tripContext: {
      startType: 'hotel',
      arrivalTime: null,
      date: '2026-04-24',
      days: 1,
      dayNumber: 1,
      flightTime: null,
      isLongHaul: false,
      locationLat: null,
      locationLon: null,
      locationName: null,
    },
    itinerary: null,
    itineraryDays: [],
    travelStartDate: null,
    travelEndDate: null,
    weather: null,
    route: null,
    savedItineraries: [],
    userRole: 'user',
    generationCount: 0,
    profileLoaded: true,
    userTier: 'free',
    tripPacks: [],
    packPurchaseCount: 0,
    notifPrefs: {
      tripReminders: true,
      destinationSuggestions: true,
      liveEventAlerts: false,
      appUpdates: true,
    },
    units: 'km',
    journey: null,
    journeyBudgetDays: null,
    advisorMessages: [],
    pendingActivePlace: null,
    ...overrides,
  } as AppState;
}

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

// ---------------------------------------------------------------------------
// shouldShowPaywall pure-function tests live in shared/tier.test.ts.
// Paywall gate logic (the dispatch branch at the top of buildItinerary) is
// covered by the integration test below.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// buildItinerary paywall gate — real integration test
// ---------------------------------------------------------------------------
// Verifies that the actual buildItinerary() implementation dispatches
// GO_TO subscription and makes no network call when shouldShowPaywall is true.
// ---------------------------------------------------------------------------

vi.mock('../../shared/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/store')>();
  return { ...actual, useAppStore: vi.fn() };
});

vi.mock('../../shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/api')>();
  return {
    ...actual,
    aiItineraryStream: vi.fn(async function* () { /* never yields */ }),
  };
});

vi.mock('../../shared/supabase', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}));

vi.mock('../../shared/userSync', () => ({
  syncSavedItinerary: vi.fn(),
  incrementGenerationCount: vi.fn(),
}));

describe('buildItinerary paywall gate (real integration)', () => {
  let dispatch: (action: Action) => void;

  beforeEach(async () => {
    dispatch = vi.fn() as unknown as (action: Action) => void;
    const { useAppStore } = await import('../../shared/store');
    vi.mocked(useAppStore).mockReturnValue({
      state: makeState({ userTier: 'free', generationCount: 3, tripPacks: [] }),
      dispatch,
    });
  });

  it('dispatches GO_TO subscription and does not call aiItineraryStream when paywall condition is met', async () => {
    const { aiItineraryStream } = await import('../../shared/api');

    const { result } = renderHook(() => useRoute());

    await act(async () => {
      await result.current.buildItinerary();
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'GO_TO', screen: 'subscription' });
    expect(aiItineraryStream).not.toHaveBeenCalled();
  });
});
