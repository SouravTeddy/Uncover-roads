import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppProvider, useAppStore } from '../store';
import { BottomNav } from './BottomNav';

// A wrapper that navigates to destination
function TestWrapper() {
  const { state, dispatch } = useAppStore();

  // If we're on a screen where nav shouldn't render, dispatch to destination
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
  it('renders 3 tabs: Explore, Saved, Profile', async () => {
    renderInProvider();
    await waitFor(() => {
      expect(screen.getByText('Explore')).toBeTruthy();
    });
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
  });

  it('does not render Community tab', async () => {
    renderInProvider();
    await waitFor(() => {
      expect(screen.getByText('Explore')).toBeTruthy();
    });
    expect(screen.queryByText('Community')).toBeNull();
  });

  it('does not render Itinerary tab', async () => {
    renderInProvider();
    await waitFor(() => {
      expect(screen.getByText('Explore')).toBeTruthy();
    });
    expect(screen.queryByText('Itinerary')).toBeNull();
  });
});
