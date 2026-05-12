import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SavedPlacesTab } from './SavedPlacesTab';
import type { FavouritedPin, SavedEvent } from '../../shared/types';

const pins: FavouritedPin[] = [
  { placeId: 'p1', title: 'Senso-ji Temple', lat: 35.71, lon: 139.79, city: 'Tokyo' },
  { placeId: 'p2', title: 'Shinjuku Gyoen', lat: 35.68, lon: 139.71, city: 'Tokyo' },
  { placeId: 'p3', title: 'Opera House', lat: -33.86, lon: 151.21, city: 'Sydney' },
];

const events: SavedEvent[] = [
  {
    id: 'e1', title: 'Sumida Fireworks', city: 'Tokyo', date: '2026-07-26',
    isAnnual: true, venue: 'Asakusa', category: 'festival', savedAt: '2026-05-06T00:00:00Z',
  },
];

describe('SavedPlacesTab', () => {
  it('renders city group headers', () => {
    render(
      <SavedPlacesTab
        favouritedPins={pins}
        savedEvents={events}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    const tokyoTexts = screen.getAllByText(/Tokyo/);
    const sydneyTexts = screen.getAllByText(/Sydney/);
    expect(tokyoTexts.length).toBeGreaterThan(0);
    expect(sydneyTexts.length).toBeGreaterThan(0);
  });

  it('renders correct place counts in city header', () => {
    render(
      <SavedPlacesTab
        favouritedPins={pins}
        savedEvents={events}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    expect(screen.getByText(/2 places/)).toBeTruthy();
    expect(screen.getByText(/1 place/)).toBeTruthy();
  });

  it('renders saved events under correct city', () => {
    render(
      <SavedPlacesTab
        favouritedPins={pins}
        savedEvents={events}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    expect(screen.getByText('Sumida Fireworks')).toBeTruthy();
  });

  it('shows empty state when no pins saved', () => {
    render(
      <SavedPlacesTab
        favouritedPins={[]}
        savedEvents={[]}
        onOpenMap={vi.fn()}
        onRemovePin={vi.fn()}
        onRemoveEvent={vi.fn()}
      />
    );
    expect(screen.getByText(/no saved places/i)).toBeTruthy();
  });
});
