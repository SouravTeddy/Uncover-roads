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
    // Click day 10 then day 14
    const buttons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent ?? ''));
    const day10 = buttons.find(b => b.textContent === '10');
    const day14 = buttons.find(b => b.textContent === '14');
    if (day10 && day14) {
      fireEvent.click(day10);
      fireEvent.click(day14);
      expect(onSelect).toHaveBeenCalledOnce();
      const [start, end] = onSelect.mock.calls[0];
      expect(start).toMatch(/^\d{4}-\d{2}-10$/);
      expect(end).toMatch(/^\d{4}-\d{2}-14$/);
    }
  });
});
