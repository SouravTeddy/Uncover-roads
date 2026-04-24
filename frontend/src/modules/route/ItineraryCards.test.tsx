import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Action } from '../../shared/store';

// ── Mock store ────────────────────────────────────────────────────

vi.mock('../../shared/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/store')>();
  return { ...actual, useAppStore: vi.fn() };
});

// ── Mock isCurationLocked ─────────────────────────────────────────

vi.mock('../../shared/tier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/tier')>();
  return { ...actual, isCurationLocked: vi.fn() };
});

// ── Helpers ───────────────────────────────────────────────────────

import type { AppState } from '../../shared/store';
import type { TripPack } from '../../shared/types';

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
    tripPacks: [] as TripPack[],
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

const BASE_TRIP_CONTEXT = {
  startType: 'hotel' as const,
  arrivalTime: null,
  date: '2026-04-24',
  days: 1,
  dayNumber: 1,
  flightTime: null,
  isLongHaul: false,
  locationLat: null,
  locationLon: null,
  locationName: null,
};

// ── Tests ─────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LockedCurationCard', () => {
  it('renders title, description, and upgrade button', async () => {
    const { LockedCurationCard } = await import('./ItineraryCards');
    const onUpgrade = vi.fn();

    render(
      <LockedCurationCard
        title="Our Picks"
        description="Curated local spots for your travel persona"
        onUpgrade={onUpgrade}
      />,
    );

    expect(screen.getByText('Our Picks')).toBeTruthy();
    expect(screen.getByText('Curated local spots for your travel persona')).toBeTruthy();
    expect(screen.getByText('Upgrade to unlock')).toBeTruthy();
  });

  it('calls onUpgrade when button is clicked', async () => {
    const { LockedCurationCard } = await import('./ItineraryCards');
    const onUpgrade = vi.fn();

    render(
      <LockedCurationCard
        title="Live Events"
        description="Events happening during your trip"
        onUpgrade={onUpgrade}
      />,
    );

    fireEvent.click(screen.getByText('Upgrade to unlock'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});

describe('IntroCard curation lock', () => {
  let dispatch: (action: Action) => void;

  beforeEach(async () => {
    dispatch = vi.fn() as unknown as (action: Action) => void;
    const { useAppStore } = await import('../../shared/store');
    vi.mocked(useAppStore).mockReturnValue({
      state: makeState({ userTier: 'free', generationCount: 2, tripPacks: [] }),
      dispatch,
    });
  });

  it('renders locked cards for Our Picks and Live Events when curation is locked', async () => {
    const { isCurationLocked } = await import('../../shared/tier');
    vi.mocked(isCurationLocked).mockReturnValue(true);

    const { IntroCard } = await import('./ItineraryCards');

    render(
      <IntroCard
        city="Paris"
        tripContext={BASE_TRIP_CONTEXT}
        stops={[]}
        summary={undefined}
        weather={null}
        persona={null}
        onUpgrade={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
        curationLocked={true}
      />,
    );

    expect(screen.getByText('Our Picks')).toBeTruthy();
    expect(screen.getByText('Live Events')).toBeTruthy();
    // Both "Upgrade to unlock" buttons should be present
    expect(screen.getAllByText('Upgrade to unlock')).toHaveLength(2);
  });

  it('does not render locked cards when curation is not locked', async () => {
    const { isCurationLocked } = await import('../../shared/tier');
    vi.mocked(isCurationLocked).mockReturnValue(false);

    const { IntroCard } = await import('./ItineraryCards');

    render(
      <IntroCard
        city="Paris"
        tripContext={BASE_TRIP_CONTEXT}
        stops={[]}
        summary={undefined}
        weather={null}
        persona={null}
        onUpgrade={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
        curationLocked={false}
      />,
    );

    expect(screen.queryAllByText('Upgrade to unlock')).toHaveLength(0);
  });

  it('"Upgrade to unlock" dispatches GO_TO subscription', async () => {
    // Locked state is controlled via the curationLocked prop directly.
    // If IntroCard is ever refactored to read from store, add:
    //   vi.mocked(isCurationLocked).mockReturnValue(true);
    const { IntroCard } = await import('./ItineraryCards');

    render(
      <IntroCard
        city="Paris"
        tripContext={BASE_TRIP_CONTEXT}
        stops={[]}
        summary={undefined}
        weather={null}
        persona={null}
        onUpgrade={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
        curationLocked={true}
      />,
    );

    fireEvent.click(screen.getAllByText('Upgrade to unlock')[0]);
    expect(dispatch).toHaveBeenCalledWith({ type: 'GO_TO', screen: 'subscription' });
  });
});
