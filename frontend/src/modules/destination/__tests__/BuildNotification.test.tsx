import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BuildNotification } from '../BuildNotification';

vi.mock('../../../shared/store', () => ({
  useAppStore: () => ({ state: {}, dispatch: vi.fn() }),
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
