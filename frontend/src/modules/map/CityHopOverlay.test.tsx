import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CityHopOverlay } from './CityHopOverlay';

describe('CityHopOverlay', () => {
  it('renders fromCity and toCity labels', () => {
    render(
      <CityHopOverlay
        fromCity="Tokyo"
        toCity="Sydney"
        storyCards={[]}
        onDone={() => {}}
      />
    );
    expect(screen.getByText('Tokyo')).toBeTruthy();
    expect(screen.getByText('Sydney')).toBeTruthy();
  });

  it('renders Skip button', () => {
    render(
      <CityHopOverlay
        fromCity="Tokyo"
        toCity="Sydney"
        storyCards={[]}
        onDone={() => {}}
      />
    );
    expect(screen.getByText(/skip/i)).toBeTruthy();
  });
});
