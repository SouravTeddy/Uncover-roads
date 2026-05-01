import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SubscriptionScreen } from './SubscriptionScreen';
import * as storeModule from '../../shared/store';
import type { AppState } from '../../shared/store';

// Build a minimal state helper
function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    currentScreen: 'subscription',
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
    itineraryHistory: [],
    activePinId: null,
    mapFilter: 'all',
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

  it('renders "Current Plan" disabled button for Free user on the Free column', () => {
    renderWithState(makeState({ userTier: 'free' }));
    // Find the "Current Plan" button within the Free column context
    const buttons = screen.getAllByText('Current Plan');
    // At least one Current Plan button should exist and be disabled
    const disabledBtn = buttons.find(btn => (btn as HTMLButtonElement).disabled);
    expect(disabledBtn).toBeTruthy();
  });

  it('renders "Go Pro" CTA for Free user on the Pro column', () => {
    renderWithState(makeState({ userTier: 'free' }));
    const getProButtons = screen.getAllByText('Go Pro · $9.99/mo');
    expect(getProButtons.length).toBeGreaterThan(0);
  });

  it('renders conversion nudge when packPurchaseCount >= 2', () => {
    renderWithState(makeState({ packPurchaseCount: 2 }));
    expect(screen.getByText(/You've spent/)).toBeTruthy();
    expect(screen.getByText(/Switch to Pro/)).toBeTruthy();
  });

  it('does NOT render conversion nudge when packPurchaseCount < 2', () => {
    renderWithState(makeState({ packPurchaseCount: 1 }));
    expect(screen.queryByText(/You've spent/)).toBeNull();
    expect(screen.queryByText(/Switch to Pro/)).toBeNull();
  });

  it('Apply button shows inline "coming soon" feedback instead of alert', () => {
    renderWithState(makeState());

    const input = screen.getByPlaceholderText('Enter coupon code');
    fireEvent.change(input, { target: { value: 'LAUNCH50' } });

    const applyBtn = screen.getByText('Apply');
    fireEvent.click(applyBtn);

    expect(screen.getByText('Coupon validation coming soon.')).toBeTruthy();
  });

  it('Apply button shows inline feedback for any coupon code (no client-side validation)', () => {
    renderWithState(makeState());

    const input = screen.getByPlaceholderText('Enter coupon code');
    fireEvent.change(input, { target: { value: 'BADCODE' } });

    const applyBtn = screen.getByText('Apply');
    fireEvent.click(applyBtn);

    expect(screen.getByText('Coupon validation coming soon.')).toBeTruthy();
  });
});
