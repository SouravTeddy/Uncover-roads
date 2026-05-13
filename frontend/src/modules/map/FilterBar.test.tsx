import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import type { MapFilter } from '../../shared/types';

afterEach(() => cleanup());

const defaultProps = {
  active: 'all' as MapFilter,
  activeCategory: null,
  allCount: 10,
  curatedCount: 3,
  curatedLocked: false,
  onSelect: vi.fn(),
  onCategorySelect: vi.fn(),
  onLockedTap: vi.fn(),
};

describe('FilterBar', () => {
  it('renders the All chip', () => {
    const { container } = render(<FilterBar {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    const allBtn = Array.from(buttons).find(b => b.textContent?.includes('All'));
    expect(allBtn).toBeDefined();
  });

  it('renders the Curated chip', () => {
    const { container } = render(<FilterBar {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    const curatedBtn = Array.from(buttons).find(b => b.textContent?.includes('Curated'));
    expect(curatedBtn).toBeDefined();
  });

  it('clicking All from curated mode calls onSelect("all")', () => {
    const onSelect = vi.fn();
    const { container } = render(<FilterBar {...defaultProps} active={'curated' as MapFilter} onSelect={onSelect} />);
    const buttons = container.querySelectorAll('button');
    const allBtn = Array.from(buttons).find(b => b.textContent?.includes('All'))!;
    fireEvent.click(allBtn);
    expect(onSelect).toHaveBeenCalledWith('all');
  });

  it('clicking All in all mode expands sub-category chips', () => {
    const onCategorySelect = vi.fn();
    const { container } = render(<FilterBar {...defaultProps} onCategorySelect={onCategorySelect} />);
    const buttons = container.querySelectorAll('button');
    const allBtn = Array.from(buttons).find(b => b.textContent?.includes('All'))!;
    fireEvent.click(allBtn);
    // Sub-chips should appear (at least 'Landmarks')
    const landmarksBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Landmarks'));
    expect(landmarksBtn).toBeDefined();
  });

  it('clicking Curated calls onSelect("curated") when not locked', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <FilterBar {...defaultProps} onSelect={onSelect} curatedLocked={false} />
    );
    const buttons = container.querySelectorAll('button');
    const curatedBtn = Array.from(buttons).find(b => b.textContent?.includes('Curated'))!;
    fireEvent.click(curatedBtn);
    expect(onSelect).toHaveBeenCalledWith('curated');
  });

  it('clicking Curated calls onLockedTap (not onSelect) when curatedLocked=true', () => {
    const onSelect = vi.fn();
    const onLockedTap = vi.fn();
    const { container } = render(
      <FilterBar {...defaultProps} onSelect={onSelect} onLockedTap={onLockedTap} curatedLocked={true} />
    );
    const buttons = container.querySelectorAll('button');
    const curatedBtn = Array.from(buttons).find(b => b.textContent?.includes('Curated'))!;
    fireEvent.click(curatedBtn);
    expect(onLockedTap).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('displays allCount in the All chip', () => {
    const { container } = render(<FilterBar {...defaultProps} allCount={42} />);
    const buttons = container.querySelectorAll('button');
    const allBtn = Array.from(buttons).find(b => b.textContent?.includes('All'))!;
    expect(allBtn.textContent).toContain('42');
  });

  it('displays curatedCount in the Curated chip when not locked', () => {
    const { container } = render(
      <FilterBar {...defaultProps} curatedCount={7} curatedLocked={false} />
    );
    const buttons = container.querySelectorAll('button');
    const curatedBtn = Array.from(buttons).find(b => b.textContent?.includes('Curated'))!;
    expect(curatedBtn.textContent).toContain('7');
  });

  it('shows a lock icon in the Curated chip when curatedLocked=true', () => {
    const { container } = render(<FilterBar {...defaultProps} curatedLocked={true} />);
    const buttons = container.querySelectorAll('button');
    const curatedBtn = Array.from(buttons).find(b => b.textContent?.includes('Curated'))!;
    expect(curatedBtn.textContent).toContain('lock');
  });

  it('does not show a lock icon in the Curated chip when curatedLocked=false', () => {
    const { container } = render(<FilterBar {...defaultProps} curatedLocked={false} />);
    const buttons = container.querySelectorAll('button');
    const curatedBtn = Array.from(buttons).find(b => b.textContent?.includes('Curated'))!;
    expect(curatedBtn.textContent).not.toContain('lock');
  });
});
