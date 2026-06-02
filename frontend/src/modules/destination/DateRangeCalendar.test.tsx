import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeCalendar } from './DateRangeCalendar';

describe('DateRangeCalendar', () => {
  it('renders the reason copy', () => {
    render(<DateRangeCalendar onSelect={vi.fn()} />);
    expect(screen.getByText(/check events, weather and opening days/i)).toBeTruthy();
  });

  it('shows current month days', () => {
    render(<DateRangeCalendar onSelect={vi.fn()} />);
    // Day "1" through at least "28" should be present
    expect(screen.getAllByRole('button').length).toBeGreaterThan(28);
  });

  it('calls onSelect with ISO dates when range is picked', () => {
    const onSelect = vi.fn();
    render(<DateRangeCalendar onSelect={onSelect} />);

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

  it('singleDate: calls onSelect immediately on first tap', () => {
    const onSelect = vi.fn();
    render(<DateRangeCalendar singleDate onSelect={onSelect} />);
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'chevron_right');
    if (nextBtn) fireEvent.click(nextBtn);
    const dayButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
    const day15 = dayButtons.find(b => b.textContent?.trim() === '15');
    expect(day15).toBeTruthy();
    fireEvent.click(day15!);
    // Called after ONE tap, not two
    expect(onSelect).toHaveBeenCalledOnce();
    const [start, end] = onSelect.mock.calls[0];
    expect(start).toMatch(/^\d{4}-\d{2}-15$/);
    expect(start).toBe(end);
  });

  it('minDate: disables days before the given date', () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const year = nextMonth.getFullYear();
    const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const minDate = `${year}-${month}-15`;
    render(<DateRangeCalendar minDate={minDate} onSelect={vi.fn()} />);
    // Navigate to that month
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'chevron_right');
    if (nextBtn) fireEvent.click(nextBtn);
    const dayButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
    const day10 = dayButtons.find(b => b.textContent?.trim() === '10');
    expect(day10).toHaveAttribute('disabled');
    const day20 = dayButtons.find(b => b.textContent?.trim() === '20');
    expect(day20).not.toHaveAttribute('disabled');
  });

  it('maxDate: disables days after the given date', () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const year = nextMonth.getFullYear();
    const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const maxDate = `${year}-${month}-15`;
    render(<DateRangeCalendar maxDate={maxDate} onSelect={vi.fn()} />);
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'chevron_right');
    if (nextBtn) fireEvent.click(nextBtn);
    const dayButtons = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
    const day20 = dayButtons.find(b => b.textContent?.trim() === '20');
    expect(day20).toHaveAttribute('disabled');
    const day10 = dayButtons.find(b => b.textContent?.trim() === '10');
    expect(day10).not.toHaveAttribute('disabled');
  });
});
