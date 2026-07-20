import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SubscriptionScreen } from './SubscriptionScreen';
import * as storeModule from '../../shared/store';
import type { AppState } from '../../shared/store';

// Build a minimal state helper
function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    currentScreen: 'subscription',
    screenStack: ['subscription'],
    obAnswers: { ritual: null, sensory: null, style: null, attractions: [], pace: null, social: null },
    rawOBAnswers: null,
    personaProfile: null,
    obPreResolved: [],
    persona: null,
    city: '',
    cityGeo: null,
    places: [],
    selectedPlaces: [],
    activeFilter: 'all',
    tripContext: {
      startType: 'hotel', arrivalTime: null,
      date: new Date().toISOString().split('T')[0],
      days: 1, dayNumber: 1, flightTime: null,
      isLongHaul: false, locationLat: null, locationLon: null, locationName: null,
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
    profileLoaded: false,
    userTier: 'free',
    packTripsRemaining: 0,
    autoReplenish: false,
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
    referencePins: [],
    favouritedPins: [],
    cityFootprints: [],
    similarPinsState: null,
    theme: 'dark',
    cityContexts: [],
    activeCityIndex: 0,
    engineMessages: [],
    engineItinerary: null,
    hasBuiltThisSession: false,
    itineraryHistory: [],
    activePinId: null,
    mapFilter: 'all',
    savedEvents: [],
    reelSavedId: null,
    tripsActiveTab: 'saved' as const,
    pendingTripDetails: null,
    dismissedPinIds: [],
    recoInteractions: [],
    cityCountries: {},
    recoFocusPlaces: null,
    liveEvents: [],
    activeBuild: null,
    ...overrides,
  };
}

describe('SubscriptionScreen', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    mockDispatch.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function renderWithState(state: AppState) {
    vi.spyOn(storeModule, 'useAppStore').mockReturnValue({ state, dispatch: mockDispatch });
    return render(<SubscriptionScreen />);
  }

  it('renders "Current plan" pill for Pro user', () => {
    renderWithState(makeState({ userTier: 'pro' }));
    expect(screen.getByText(/Current plan/i)).toBeTruthy();
  });

  it('renders "Go Pro" CTA for Free user', () => {
    renderWithState(makeState({ userTier: 'free' }));
    const getProButtons = screen.getAllByText(/Go Pro/);
    expect(getProButtons.length).toBeGreaterThan(0);
  });
});
