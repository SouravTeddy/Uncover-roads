import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedEventCard } from './SavedEventCard';
import type { SavedEvent } from '../../shared/types';

const mockEvent: SavedEvent = {
  id: 'evt-1',
  title: 'Sumida River Fireworks',
  city: 'Tokyo',
  date: '2026-07-26',
  isAnnual: true,
  venue: 'Asakusa',
  category: 'festival',
  savedAt: '2026-05-06T12:00:00Z',
};

describe('SavedEventCard', () => {
  it('renders event title', () => {
    render(<SavedEventCard event={mockEvent} onRemove={vi.fn()} />);
    expect(screen.getByText('Sumida River Fireworks')).toBeTruthy();
  });

  it('renders venue', () => {
    render(<SavedEventCard event={mockEvent} onRemove={vi.fn()} />);
    expect(screen.getByText(/Asakusa/)).toBeTruthy();
  });

  it('shows Annual badge when isAnnual', () => {
    render(<SavedEventCard event={mockEvent} onRemove={vi.fn()} />);
    expect(screen.getByText(/Annual/i)).toBeTruthy();
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(<SavedEventCard event={mockEvent} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onRemove).toHaveBeenCalledWith('evt-1');
  });
});
