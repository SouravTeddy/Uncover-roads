import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedPlaceCard } from './SavedPlaceCard';
import type { FavouritedPin } from '../../shared/types';

const pin: FavouritedPin = {
  placeId: 'p1',
  title: 'Senso-ji Temple',
  lat: 35.71,
  lon: 139.79,
  city: 'Tokyo',
};

describe('SavedPlaceCard', () => {
  it('renders place title', () => {
    render(<SavedPlaceCard pin={pin} category="historic" onRemove={vi.fn()} onClick={vi.fn()} />);
    expect(screen.getByText('Senso-ji Temple')).toBeTruthy();
  });

  it('renders heart badge', () => {
    render(<SavedPlaceCard pin={pin} category="historic" onRemove={vi.fn()} onClick={vi.fn()} />);
    expect(screen.getByText('❤️')).toBeTruthy();
  });

  it('calls onRemove when heart badge clicked', () => {
    const onRemove = vi.fn();
    render(<SavedPlaceCard pin={pin} category="historic" onRemove={onRemove} onClick={vi.fn()} />);
    fireEvent.click(screen.getByText('❤️'));
    expect(onRemove).toHaveBeenCalledWith('p1');
  });
});
