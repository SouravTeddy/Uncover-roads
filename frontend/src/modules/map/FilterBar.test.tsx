import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import type { MapFilter } from '../../shared/types';

afterEach(() => cleanup());

const defaultProps = {
  active: 'all' as MapFilter,
  counts: { all: 10, recommended: 3, event: 2 },
  onSelect: vi.fn(),
};

// Helper: render FilterBar already in expanded state
// The component starts collapsed; click the collapsed pill to open the full chip list.
function renderExpanded(props: Parameters<typeof FilterBar>[0]) {
  const { container } = render(<FilterBar {...props} />);
  // The collapsed view shows a single button — click it to expand
  const buttons = container.querySelectorAll('button');
  // In collapsed state there should be one button (the pill)
  if (buttons.length === 1) {
    fireEvent.click(buttons[0]);
  }
  return within(container);
}

describe('FilterBar — locked filter chips', () => {
  it('shows lock icon on locked filter chips', () => {
    const q = renderExpanded({
      ...defaultProps,
      lockedFilters: ['recommended', 'event'],
    });

    // Both locked chips should render a lock icon
    const lockIcons = q.getAllByText('lock');
    expect(lockIcons.length).toBeGreaterThanOrEqual(2);
  });

  it('tapping a locked chip calls onLockedTap, NOT onSelect', () => {
    const onSelect = vi.fn();
    const onLockedTap = vi.fn();

    const q = renderExpanded({
      ...defaultProps,
      onSelect,
      lockedFilters: ['recommended'],
      onLockedTap,
    });

    // "Our Picks" chip is locked — find it among all buttons
    const allButtons = q.getAllByRole('button');
    const ourPicksBtn = allButtons.find(b => b.textContent?.includes('Our Picks'));
    expect(ourPicksBtn).toBeDefined();
    fireEvent.click(ourPicksBtn!);

    expect(onLockedTap).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('unlocked chips still call onSelect normally', () => {
    const onSelect = vi.fn();
    const onLockedTap = vi.fn();

    const q = renderExpanded({
      ...defaultProps,
      onSelect,
      lockedFilters: ['recommended'],
      onLockedTap,
    });

    // "All" is not locked — find it and click it
    const allButtons = q.getAllByRole('button');
    // The "All" chip text starts with "All" (may include count)
    const allChipBtn = allButtons.find(b => /^All/.test(b.textContent ?? ''));
    expect(allChipBtn).toBeDefined();
    fireEvent.click(allChipBtn!);

    expect(onSelect).toHaveBeenCalledWith('all');
    expect(onLockedTap).not.toHaveBeenCalled();
  });

  it('shows no lock icons when lockedFilters is empty', () => {
    const q = renderExpanded({
      ...defaultProps,
      lockedFilters: [],
    });

    const lockIcons = q.queryAllByText('lock');
    expect(lockIcons).toHaveLength(0);
  });

  it('shows no lock icons when lockedFilters prop is omitted', () => {
    const q = renderExpanded({ ...defaultProps });

    const lockIcons = q.queryAllByText('lock');
    expect(lockIcons).toHaveLength(0);
  });

  it('locked chip does not change active state when tapped', () => {
    const onSelect = vi.fn();
    const onLockedTap = vi.fn();

    const q = renderExpanded({
      ...defaultProps,
      active: 'all' as MapFilter,
      onSelect,
      lockedFilters: ['recommended'],
      onLockedTap,
    });

    const allButtons = q.getAllByRole('button');
    const ourPicksBtn = allButtons.find(b => b.textContent?.includes('Our Picks'));
    expect(ourPicksBtn).toBeDefined();
    fireEvent.click(ourPicksBtn!);

    // onSelect was not called, so active state remains 'all' (not 'recommended')
    expect(onSelect).not.toHaveBeenCalled();
  });
});
