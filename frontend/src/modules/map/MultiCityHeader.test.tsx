import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiCityHeader } from './MultiCityHeader';
import type { CityFootprint } from '../../shared/types';

const footprints: CityFootprint[] = [
  { city: 'Tokyo', emoji: '🗼', pinCount: 4, lat: 35.68, lon: 139.69 },
  { city: 'Sydney', emoji: '🦘', pinCount: 2, lat: -33.87, lon: 151.21 },
];

describe('MultiCityHeader', () => {
  it('renders all city tabs', () => {
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        travelStartDate={null}
        travelEndDate={null}
        onCityTap={vi.fn()}
        onDateTap={vi.fn()}
      />
    );
    expect(screen.getByText('Tokyo')).toBeTruthy();
    expect(screen.getByText('Sydney')).toBeTruthy();
  });

  it('calls onCityTap with index when tab is clicked', () => {
    const onCityTap = vi.fn();
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        travelStartDate={null}
        travelEndDate={null}
        onCityTap={onCityTap}
        onDateTap={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Sydney'));
    expect(onCityTap).toHaveBeenCalledWith(1);
  });

  it('renders date line when start and end dates provided', () => {
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        travelStartDate="2025-06-01"
        travelEndDate="2025-06-07"
        onCityTap={vi.fn()}
        onDateTap={vi.fn()}
      />
    );
    // Should show formatted date range and day count (7 days)
    const dateLine = screen.getByText(/Jun 1.+Jun 7.+7 days/);
    expect(dateLine).toBeTruthy();
  });

  it('calls onDateTap when date line is clicked', () => {
    const onDateTap = vi.fn();
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        travelStartDate="2025-06-01"
        travelEndDate="2025-06-07"
        onCityTap={vi.fn()}
        onDateTap={onDateTap}
      />
    );
    fireEvent.click(screen.getByText(/Jun 1.+Jun 7.+7 days/));
    expect(onDateTap).toHaveBeenCalled();
  });
});
