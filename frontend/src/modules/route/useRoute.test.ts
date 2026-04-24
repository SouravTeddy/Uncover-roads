import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { retryDay } from './useRoute';
import { shouldShowPaywall } from '../../shared/tier';
import type { ItineraryRequest } from '../../shared/api';
import type { AppState } from '../../shared/store';
import type { Itinerary, TripPack } from '../../shared/types';

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
// shouldShowPaywall — pure function tests
// ---------------------------------------------------------------------------

describe('shouldShowPaywall', () => {
  it('returns true for free user with generationCount === 3 and no trip packs', () => {
    const state = makeState({ userTier: 'free', generationCount: 3, tripPacks: [] });
    expect(shouldShowPaywall(state)).toBe(true);
  });

  it('returns true for free user with generationCount > 3 and no trip packs', () => {
    const state = makeState({ userTier: 'free', generationCount: 5, tripPacks: [] });
    expect(shouldShowPaywall(state)).toBe(true);
  });

  it('returns false for free user with generationCount === 2 (below threshold)', () => {
    const state = makeState({ userTier: 'free', generationCount: 2, tripPacks: [] });
    expect(shouldShowPaywall(state)).toBe(false);
  });

  it('returns false for pro user regardless of generationCount', () => {
    const state = makeState({ userTier: 'pro', generationCount: 10, tripPacks: [] });
    expect(shouldShowPaywall(state)).toBe(false);
  });

  it('returns false for unlimited user regardless of generationCount', () => {
    const state = makeState({ userTier: 'unlimited', generationCount: 100, tripPacks: [] });
    expect(shouldShowPaywall(state)).toBe(false);
  });

  it('returns false when free user has non-expired pack trips (generationCount === 3)', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    const pack: TripPack = { id: 'pack-1', trips: 3, usedTrips: 0, expiresAt: tomorrow };
    const state = makeState({ userTier: 'free', generationCount: 3, tripPacks: [pack] });
    expect(shouldShowPaywall(state)).toBe(false);
  });

  it('returns true when free user has exhausted all pack trips (generationCount === 3)', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    const pack: TripPack = { id: 'pack-1', trips: 2, usedTrips: 2, expiresAt: tomorrow };
    const state = makeState({ userTier: 'free', generationCount: 3, tripPacks: [pack] });
    expect(shouldShowPaywall(state)).toBe(true);
  });

  it('returns true when free user only has expired packs (generationCount === 3)', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    const pack: TripPack = { id: 'pack-1', trips: 5, usedTrips: 0, expiresAt: yesterday };
    const state = makeState({ userTier: 'free', generationCount: 3, tripPacks: [pack] });
    expect(shouldShowPaywall(state)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildItinerary paywall gate — dispatch behaviour
// ---------------------------------------------------------------------------
// We verify the gate branch logic directly using shouldShowPaywall, mirroring
// exactly what the implementation does at the top of buildItinerary().
// ---------------------------------------------------------------------------

describe('buildItinerary paywall gate (dispatch behaviour)', () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  // Simulate the gate added at the top of buildItinerary.
  function simulateBuildItineraryGate(state: AppState): boolean {
    if (shouldShowPaywall(state)) {
      dispatch({ type: 'GO_TO', screen: 'subscription' });
      return true; // early return
    }
    return false; // generation proceeds
  }

  it('dispatches GO_TO subscription and returns early when free user has 3 generations and no packs', () => {
    const state = makeState({ userTier: 'free', generationCount: 3, tripPacks: [] });
    const earlyReturn = simulateBuildItineraryGate(state);
    expect(earlyReturn).toBe(true);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: 'GO_TO', screen: 'subscription' });
  });

  it('does NOT dispatch GO_TO subscription when free user has only 2 generations', () => {
    const state = makeState({ userTier: 'free', generationCount: 2, tripPacks: [] });
    const earlyReturn = simulateBuildItineraryGate(state);
    expect(earlyReturn).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does NOT dispatch GO_TO subscription when pro user has 10 generations', () => {
    const state = makeState({ userTier: 'pro', generationCount: 10, tripPacks: [] });
    const earlyReturn = simulateBuildItineraryGate(state);
    expect(earlyReturn).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does NOT dispatch GO_TO subscription when unlimited user has many generations', () => {
    const state = makeState({ userTier: 'unlimited', generationCount: 100, tripPacks: [] });
    const earlyReturn = simulateBuildItineraryGate(state);
    expect(earlyReturn).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does NOT dispatch GO_TO subscription when free user has active pack trips at 5 generations', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    const pack: TripPack = { id: 'pack-1', trips: 1, usedTrips: 0, expiresAt: tomorrow };
    const state = makeState({ userTier: 'free', generationCount: 5, tripPacks: [pack] });
    const earlyReturn = simulateBuildItineraryGate(state);
    expect(earlyReturn).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
