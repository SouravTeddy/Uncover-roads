import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppProvider, useAppStore } from '../store';
import { BottomNav } from './BottomNav';

// A wrapper that navigates to destination so BottomNav renders
function TestWrapper() {
  const { state, dispatch } = useAppStore();

  React.useEffect(() => {
    if (state.currentScreen === 'login') {
      dispatch({ type: 'GO_TO', screen: 'destination' });
    }
  }, [state.currentScreen, dispatch]);

  return <BottomNav />;
}

function renderInProvider() {
  return render(
    <AppProvider>
      <TestWrapper />
    </AppProvider>
  );
}

describe('BottomNav', () => {
  it('renders 3 tabs: Explore, Itinerary, Profile', async () => {
    renderInProvider();
    await waitFor(() => {
      expect(screen.getByText('Explore')).toBeTruthy();
    });
    expect(screen.getByText('Itinerary')).toBeTruthy();
    expect(screen.queryByText('Community')).toBeNull();
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('renders Explore tab as active when on destination screen', async () => {
    renderInProvider();
    await waitFor(() => {
      expect(screen.getByText('Explore')).toBeTruthy();
    });
    // The Explore button should have aria-current="page"
    const buttons = screen.getAllByRole('button');
    const exploreBtn = buttons.find(b => b.textContent?.includes('Explore'));
    expect(exploreBtn?.getAttribute('aria-current')).toBe('page');
  });

});
