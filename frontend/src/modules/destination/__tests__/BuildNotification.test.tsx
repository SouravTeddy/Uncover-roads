import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BuildNotification } from '../BuildNotification';

const mockDispatch = vi.fn();

vi.mock('../../../shared/store', () => ({
  useAppStore: () => ({ state: {}, dispatch: mockDispatch }),
}));

describe('BuildNotification', () => {
  it('renders building state without city name', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'pending' }} />
    );
    expect(getByText(/Building your plan/)).toBeInTheDocument();
  });

  it('renders nothing for done status (trip auto-saves and navigates)', () => {
    const { container } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'done' }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders failed state with dismiss CTA', () => {
    const { getByText } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'failed' }} />
    );
    expect(getByText(/Build failed/)).toBeInTheDocument();
  });

  it('dispatches CLEAR_ACTIVE_BUILD when failed banner is clicked', () => {
    mockDispatch.mockClear();
    const { getByRole } = render(
      <BuildNotification activeBuild={{ id: 'b1', cityName: 'Tokyo', status: 'failed' }} />
    );
    fireEvent.click(getByRole('button'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_ACTIVE_BUILD' });
  });

  it('renders nothing when activeBuild is null', () => {
    const { container } = render(
      <BuildNotification activeBuild={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});
