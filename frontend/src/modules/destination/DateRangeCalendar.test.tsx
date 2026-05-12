import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeCalendar } from './DateRangeCalendar';

describe('DateRangeCalendar', () => {
  it('renders the reason copy', () => {
    render(<DateRangeCalendar onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/check events, weather and opening days/i)).toBeTruthy();
  });

  it('shows current month days', () => {
    render(<DateRangeCalendar onSelect={vi.fn()} onClose={vi.fn()} />);
    // Day "1" through at least "28" should be present
    expect(screen.getAllByRole('button').length).toBeGreaterThan(28);
  });

  it('calls onSelect with ISO dates when range is picked', () => {
    const onSelect = vi.fn();
    render(<DateRangeCalendar onSelect={onSelect} onClose={vi.fn()} />);

    // Navigate forward one month to ensure days 10 and 14 are always in the future
    // The next-month button is the last nav button in the month header row
    // It appears between two other buttons (prev, label, next) — get the rightmost chevron
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'chevron_right');
    if (nextBtn) fireEvent.click(nextBtn);

    const dayButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
    const day10 = dayButtons.find(b => b.textContent?.trim() === '10');
    const day14 = dayButtons.find(b => b.textContent?.trim() === '14');

    expect(day10).toBeTruthy();
    expect(day14).toBeTruthy();
    fireEvent.click(day10!);
    fireEvent.click(day14!);
    expect(onSelect).toHaveBeenCalledOnce();
    const [start, end] = onSelect.mock.calls[0];
    expect(start).toMatch(/^\d{4}-\d{2}-10$/);
    expect(end).toMatch(/^\d{4}-\d{2}-14$/);
  });
});
