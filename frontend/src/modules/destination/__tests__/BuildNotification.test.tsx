import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BuildNotification } from '../BuildNotification';

const mockDispatch = vi.fn();

vi.mock('../../../shared/store', () => ({
  useAppStore: () => ({ state: {}, dispatch: mockDispatch }),
}));

describe('BuildNotification', () => {
  it('renders building state', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'pending' }} />
    );
    expect(getByText(/Building your Tokyo plan/)).toBeInTheDocument();
  });

  it('renders ready state', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'done' }} />
    );
    expect(getByText(/Your Tokyo plan is ready/)).toBeInTheDocument();
  });

  it('dispatches GO_TO and CLEAR_ACTIVE_BUILD on done state click', () => {
    mockDispatch.mockClear();
    const { getByRole } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'done' }} />
    );

    const button = getByRole('button');
    fireEvent.click(button);

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenNthCalledWith(1, { type: 'GO_TO', screen: 'itinerary-reel' });
    expect(mockDispatch).toHaveBeenNthCalledWith(2, { type: 'CLEAR_ACTIVE_BUILD' });
  });

  it('renders failed state', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'failed' }} />
    );
    expect(getByText(/Plan build failed/)).toBeInTheDocument();
  });

  it('renders nothing when activeBuild is null', () => {
    const { container } = render(
      <BuildNotification activeBuild={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});
