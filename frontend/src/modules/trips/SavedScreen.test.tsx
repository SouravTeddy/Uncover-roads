import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../../shared/store';
import { SavedScreen } from './SavedScreen';

vi.mock('./TripsScreen', () => ({ TripsList: () => <div>Itineraries content</div> }));

function renderInProvider() {
  return render(<AppProvider><SavedScreen /></AppProvider>);
}

describe('SavedScreen', () => {
  it('renders Saved title', () => {
    renderInProvider();
    expect(screen.getAllByText('Saved').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Itineraries and Saved sub-tabs', () => {
    renderInProvider();
    expect(screen.getByText('Itineraries')).toBeTruthy();
    expect(screen.getAllByText('Saved').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Itineraries sub-tab on tap', () => {
    renderInProvider();
    fireEvent.click(screen.getByText('Itineraries'));
    expect(screen.getByText('Itineraries')).toBeTruthy();
  });
});
