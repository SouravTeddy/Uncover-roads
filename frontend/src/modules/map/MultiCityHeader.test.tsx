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
        transitSummary="Tokyo → Sydney · ✈️ ~9h flight"
        onCityTap={vi.fn()}
        onAddCity={vi.fn()}
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
        transitSummary=""
        onCityTap={onCityTap}
        onAddCity={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Sydney'));
    expect(onCityTap).toHaveBeenCalledWith(1);
  });

  it('renders transit breadcrumb when provided', () => {
    render(
      <MultiCityHeader
        cityFootprints={footprints}
        activeCityIdx={0}
        transitSummary="Tokyo → Sydney · ✈️ ~9h flight"
        onCityTap={vi.fn()}
        onAddCity={vi.fn()}
      />
    );
    expect(screen.getByText('Tokyo → Sydney · ✈️ ~9h flight')).toBeTruthy();
  });
});
