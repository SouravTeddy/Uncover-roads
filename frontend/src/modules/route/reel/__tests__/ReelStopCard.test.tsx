import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Suppress React act warnings for async state
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
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
    const { getByText } = render(<ReelStopCard card={card} active={true} />);
    expect(getByText(/you added this/i)).toBeInTheDocument();
  });

  it('shows "We added this" for isEngineAdded stops', () => {
    const card = { ...mockCard, stop: { ...mockStop, isUserAdded: false, isEngineAdded: true } };
    // @ts-ignore
    const { getByText } = render(<ReelStopCard card={card} active={true} />);
    expect(getByText(/we added this/i)).toBeInTheDocument();
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
});
