import { render, within, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReelStopCard } from '../ReelStopCard';

// Minimal mock stop
const mockStop = {
  id: 'stop-1', placeId: 'place-1', title: 'Senso-ji Temple',
  area: 'Asakusa', day: 1, time: '10:00', durationMin: 90,
  category: 'temple' as const, lat: 35.71, lon: 139.79,
  priceLevel: null, rating: 4.5, weekdayText: null,
  whyForYou: 'Perfect for your interest in culture.',
  localTip: null, googleMapsUrl: 'https://www.google.com/maps/place/?q=35.71,139.79',
  website: null, photoRef: null,
};
const mockCard = {
  type: 'stop' as const, stop: mockStop,
  stopNumber: 1, totalStops: 3, day: 1, totalDays: 1,
  orderReason: null, orderConsequence: null, movedFrom: null,
  weather: null, nextLeg: null, visitDate: '2026-07-10',
  timingAdjustment: null,
};

// Mock engine-added stop with localTip for all-6-groups test
const mockEngineAddedCardWithLocalTip = {
  type: 'stop' as const,
  stop: {
    ...mockStop,
    isEngineAdded: true,
    localTip: 'A great local tip',
  },
  stopNumber: 1, totalStops: 3, day: 1, totalDays: 1,
  orderReason: 'It complements your itinerary',
  orderConsequence: null,
  movedFrom: null,
  weather: null,
  nextLeg: null,
  visitDate: '2026-07-10',
  timingAdjustment: null,
};

// Suppress React act warnings for async state
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReelStopCard — Maps CTA removal', () => {
  it('does not render any maps.google.com links', () => {
    // @ts-ignore minimal mock
    const { container } = render(<ReelStopCard card={mockCard} active={true} />);
    const mapLinks = container.querySelectorAll('a[href*="maps.google"]');
    expect(mapLinks.length).toBe(0);
  });
});

describe('ReelStopCard — provenance label', () => {
  it('shows "You added this" for isUserAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: true, isEngineAdded: false } };
    // @ts-ignore
    const { getAllByText } = render(<ReelStopCard card={card} active={true} />);
    // Component renders "You added this" in both the badge row and the card section
    const matches = getAllByText(/you added this/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows "We added this" for isEngineAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: false, isEngineAdded: true } };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} active={true} />);
    // Use exact match to avoid matching "Why we added this" group label
    expect(getByText('We added this', { exact: true })).toBeInTheDocument();
  });

  it('does not show provenance for stops with neither flag', () => {
    // @ts-ignore
    const { queryByText } = render(<ReelStopCard card={mockCard} active={true} />);
    expect(queryByText(/you added this/i)).not.toBeInTheDocument();
    expect(queryByText(/we added this/i)).not.toBeInTheDocument();
  });
});

describe('ReelStopCard — group structure', () => {
  it('renders Getting here group', () => {
    // @ts-ignore
    const { container } = render(<ReelStopCard card={mockCard} active={true} />);
    expect(container.querySelector('[data-group="getting-here"]')).not.toBeNull();
  });

  it('hides Why we added this group for isUserAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: true, isEngineAdded: false } };
    // @ts-ignore
    const { container } = render(<ReelStopCard card={card} active={true} />);
    expect(container.querySelector('[data-group="why-added"]')).toBeNull();
  });

  it('shows Why we added this group for isEngineAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: false, isEngineAdded: true } };
    // @ts-ignore
    const { container } = render(<ReelStopCard card={card} active={true} />);
    expect(container.querySelector('[data-group="why-added"]')).not.toBeNull();
  });

  it('displays "Why we added this" label within the group', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: false, isEngineAdded: true } };
    // @ts-ignore
    const { container } = render(<ReelStopCard card={card} active={true} />);
    const group = container.querySelector('[data-group="why-added"]');
    expect(group).toBeTruthy();
    const label = group?.firstElementChild;
    expect(label?.textContent).toContain('Why we added this');
  });

  it('renders statically-present groups for an engine-added stop with localTip', () => {
    // @ts-ignore
    const { container } = render(<ReelStopCard card={mockEngineAddedCardWithLocalTip} active={true} />);
    // about-this-place requires async Wikipedia/content data so is absent in unit tests.
    // The other 5 groups are always rendered when the required stop data is present.
    const groups = ['getting-here', 'at-this-stop', 'local-insight', 'why-added', 'next-stop'];
    groups.forEach(g => {
      expect(container.querySelector(`[data-group="${g}"]`)).toBeTruthy();
    });
  });
});

describe('ReelStopCard — Group 1: Getting here', () => {
  it('shows prevStopTitle in walk row after transit fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({
        walk_distance_m: 1400, walk_duration_min: 18,
        walk_via: ['Takeshita Street'], has_transit: false,
        transit_type: null, departure_stop: null, duration_min: null,
      }),
    }));
    const card = {
      ...mockCard,
      prevStopLat: 35.68, prevStopLon: 139.68, prevStopTitle: 'Harajuku Station',
      stop: { ...mockStop, lat: 35.69, lon: 139.70 },
    };
    // @ts-ignore
    const { container, findByText } = render(<ReelStopCard card={card} active={true} />);
    // Click the drag handle to expand the panel (triggers transit fetch)
    const panel = container.querySelector('[data-panel="true"]') as HTMLElement;
    const dragHandle = panel?.firstElementChild as HTMLElement;
    await act(async () => { fireEvent.click(dragHandle); });
    expect(await findByText(/harajuku station/i)).toBeInTheDocument();
  });

  it('shows off-route note for engine-added stop', () => {
    const card = {
      ...mockCard,
      detourKm: 1.2,
      prevStopTitle: 'Shinjuku Station',
      stop: { ...mockStop, isEngineAdded: true },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} active={true} />);
    expect(getByText(/1\.2 km off your direct route/i)).toBeInTheDocument();
  });

  it('shows "Starting point" when no prevStopTitle', () => {
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={mockCard} active={true} />);
    expect(getByText(/starting point for this day/i)).toBeInTheDocument();
  });
});

describe('ReelStopCard — Group 3b: Local insight', () => {
  it('shows localTip text', () => {
    const card = { ...mockCard, stop: { ...mockStop, localTip: 'Best visited at dusk.' } };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} active={true} />);
    // localTip appears only in Group 3b (local insight) — not duplicated in Group 3a
    expect(getByText('Best visited at dusk.')).toBeInTheDocument();
  });

  it('shows hotelAnchor text in local insight when localTip is present', () => {
    const card = {
      ...mockCard,
      stop: { ...mockStop, localTip: 'Great spot.' },
      hotelAnchor: { text: '0.4 km from your hotel', isWarning: false, isBlue: true, icon: 'hotel' },
    };
    // @ts-ignore
    const { getAllByText } = render(<ReelStopCard card={card} active={true} />);
    // The hotel anchor text appears in local-insight group (and possibly about-this-place too)
    const matches = getAllByText('0.4 km from your hotel');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('hides localTip section when localTip is null', () => {
    // @ts-ignore
    const { queryByText } = render(<ReelStopCard card={mockCard} active={true} />);
    expect(queryByText(/local insight/i)).not.toBeInTheDocument();
  });
});

describe('ReelStopCard — Group 3c: Why we added this', () => {
  it('shows orderConsequence for engine-added stop', () => {
    const card = {
      ...mockCard,
      orderConsequence: 'Balances your afternoon with a cultural break.',
      stop: { ...mockStop, isEngineAdded: true },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} active={true} />);
    // orderConsequence (with no orderReason) surfaces via reasonText in the collapsed view only
    expect(getByText('Balances your afternoon with a cultural break.')).toBeInTheDocument();
  });

  it('falls back to whyForYou when no orderConsequence', () => {
    const card = {
      ...mockCard,
      orderConsequence: null,
      stop: { ...mockStop, isEngineAdded: true, whyForYou: 'Great for slow mornings.' },
    };
    // @ts-ignore
    const { container } = render(<ReelStopCard card={card} active={true} />);
    // whyForYou appears in both collapsed view and Group 3c; scope to Group 3c as regression guard
    const group = container.querySelector('[data-group="why-added"]') as HTMLElement;
    expect(within(group).getByText('Great for slow mornings.')).toBeInTheDocument();
  });

  it('shows timingAdjustment consequenceNote', () => {
    const card = {
      ...mockCard,
      timingAdjustment: { originalTime: '14:00', consequenceNote: 'Moved to leave time for hotel check-in at 5 PM', isClosingConflict: false },
      stop: { ...mockStop, isEngineAdded: true },
    };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} active={true} />);
    expect(getByText(/moved to leave time for hotel check-in at 5 PM/i)).toBeInTheDocument();
  });
});

describe('ReelStopCard — Group 4: Next stop', () => {
  it('shows next stop title and duration', () => {
    const card = {
      ...mockCard,
      nextLeg: { distKm: 0.8, durationMin: 11, mode: 'walk' as const, nextStopTitle: 'Yoyogi Park' },
    };
    // @ts-ignore
    const { getAllByText } = render(<ReelStopCard card={card} active={true} />);
    // Title appears in expanded Group 4, duration text appears in both collapsed and expanded views
    expect(getAllByText('Yoyogi Park').length).toBeGreaterThan(0);
    expect(getAllByText(/11 min/i).length).toBeGreaterThan(0);
  });

  it('shows hotel anchor as fallback when no nextLeg on last stop', () => {
    const card = {
      ...mockCard,
      nextLeg: null,
      hotelAnchor: { text: 'Hotel check-in at 5 PM', isWarning: false, isBlue: true, icon: 'hotel' },
    };
    // @ts-ignore
    const { getAllByText } = render(<ReelStopCard card={card} active={true} />);
    // hotelAnchor.text appears in Group 3a and Group 4
    const matches = getAllByText('Hotel check-in at 5 PM');
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('ReelStopCard — crowdNote hyphen stripping', () => {
  it('renders crowd note without em-dash separators', () => {
    // Use a museum category at peak hours (10–15) to trigger the crowd note
    const card = {
      ...mockCard,
      stop: { ...mockStop, category: 'museum' as const, time: '11:00' },
    };
    // @ts-ignore
    const { container } = render(<ReelStopCard card={card} active={true} />);
    // The crowd note div should not contain raw em-dash surrounded by spaces
    const crowdEl = container.querySelector('.crowd-note');
    expect(crowdEl).toBeTruthy();
    expect(crowdEl?.textContent).not.toMatch(/ — /);
  });
});

describe('ReelStopCard — advisory pills', () => {
  it('shows a Weather advisory pill when stop.advisories has one weather entry', async () => {
    const card = {
      ...mockCard,
      stop: {
        ...mockStop,
        advisories: [{
          type: 'weather',
          what: 'Senso-ji Temple is an outdoor stop during a hot spell.',
          why: 'Forecast high is above the comfortable outdoor threshold for this city.',
          consequence: 'Consider visiting before 11am or after 5pm, with a shade/water break nearby.',
        }],
      },
    };
    // @ts-ignore
    const { container, findByText } = render(<ReelStopCard card={card} active={true} />);
    const panel = container.querySelector('[data-panel="true"]') as HTMLElement;
    const dragHandle = panel?.firstElementChild as HTMLElement;
    await act(async () => { fireEvent.click(dragHandle); });
    expect(await findByText(/weather advisory/i)).toBeInTheDocument();
  });

  it('does not show an advisory pill when advisories is absent', async () => {
    // @ts-ignore
    const { container, queryByText } = render(<ReelStopCard card={mockCard} active={true} />);
    const panel = container.querySelector('[data-panel="true"]') as HTMLElement;
    const dragHandle = panel?.firstElementChild as HTMLElement;
    await act(async () => { fireEvent.click(dragHandle); });
    expect(queryByText(/weather advisory/i)).not.toBeInTheDocument();
    expect(queryByText(/multiple advisories/i)).not.toBeInTheDocument();
  });

  it('shows one "Multiple advisories" pill — not one pill per type — when 2+ advisories are present', async () => {
    const card = {
      ...mockCard,
      stop: {
        ...mockStop,
        advisories: [
          { type: 'weather', what: 'Hot spell', why: 'Forecast high is above threshold.', consequence: 'Visit before 11am or after 5pm.' },
          { type: 'alcohol', what: 'Dry city', why: 'Alcohol restricted here.', consequence: 'Only served in licensed hotel venues.' },
        ],
      },
    };
    // @ts-ignore
    const { container, findByText, queryByText } = render(<ReelStopCard card={card} active={true} />);
    const panel = container.querySelector('[data-panel="true"]') as HTMLElement;
    const dragHandle = panel?.firstElementChild as HTMLElement;
    await act(async () => { fireEvent.click(dragHandle); });
    expect(await findByText(/multiple advisories/i)).toBeInTheDocument();
    expect(queryByText('Weather advisory')).not.toBeInTheDocument();
    expect(queryByText('Alcohol advisory')).not.toBeInTheDocument();
  });

  it('expands the "Multiple advisories" pill into a row per advisory', async () => {
    const card = {
      ...mockCard,
      stop: {
        ...mockStop,
        advisories: [
          { type: 'weather', what: 'Hot spell', why: 'Forecast high is above threshold.', consequence: 'Visit before 11am or after 5pm.' },
          { type: 'ramadan', what: 'Ramadan hours', why: 'Daytime dining restricted.', consequence: 'Kitchen closed until sunset.' },
        ],
      },
    };
    // @ts-ignore
    const { container, findByText } = render(<ReelStopCard card={card} active={true} />);
    const panel = container.querySelector('[data-panel="true"]') as HTMLElement;
    const dragHandle = panel?.firstElementChild as HTMLElement;
    await act(async () => { fireEvent.click(dragHandle); });
    const pill = await findByText(/multiple advisories/i);
    await act(async () => { fireEvent.click(pill); });
    expect(await findByText('Weather advisory')).toBeInTheDocument();
    expect(await findByText('Ramadan hours')).toBeInTheDocument();
    expect(await findByText('Visit before 11am or after 5pm.')).toBeInTheDocument();
    expect(await findByText('Kitchen closed until sunset.')).toBeInTheDocument();
  });
});
