import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '../../shared/store';
import { DestinationScreen } from './DestinationScreen';

function renderInProvider() {
  return render(<AppProvider><DestinationScreen /></AppProvider>);
}

describe('DestinationScreen', () => {
  it('renders the app title', () => {
    renderInProvider();
    expect(screen.getByText('uncover roads')).toBeTruthy();
  });

  it('does not show calendar initially', () => {
    renderInProvider();
    expect(screen.queryByText(/check events, weather and opening days/i)).toBeNull();
  });
});
