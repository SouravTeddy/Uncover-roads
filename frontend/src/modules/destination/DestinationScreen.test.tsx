import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '../../shared/store';
import { DestinationScreen } from './DestinationScreen';

function renderInProvider() {
  return render(<AppProvider><DestinationScreen /></AppProvider>);
}

describe('DestinationScreen', () => {
  it('renders the explore hero section', () => {
    renderInProvider();
    // ExploreHero renders "The world won't wait, {userName}." with default userName = 'Traveller'
    expect(screen.getByText(/The world won't wait/i)).toBeTruthy();
  });

  it('does not show calendar initially', () => {
    renderInProvider();
    expect(screen.queryByText(/check events, weather and opening days/i)).toBeNull();
  });
});
