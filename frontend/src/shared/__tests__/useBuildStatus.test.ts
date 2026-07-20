import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBuildStatus } from '../useBuildStatus';

vi.mock('../api', () => ({
  api: {
    engineItinerary: {
      status: vi.fn(),
    },
  },
}));

vi.mock('../store', () => ({
  useAppStore: vi.fn(),
}));

import { api } from '../api';
import { useAppStore } from '../store';

describe('useBuildStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('dispatches SET_ACTIVE_BUILD with status=done when API returns done', async () => {
    const dispatch = vi.fn();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      state: { activeBuild: { id: 'b1', cityName: 'Tokyo', status: 'pending' } },
      dispatch,
    });
    (api.engineItinerary.status as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      buildId: 'b1', status: 'done', result: { days: [] }, error: null, updatedAt: '2026-07-08T03:00Z',
    });

    renderHook(() => useBuildStatus());

    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => {});

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_ENGINE_ITINERARY' })
    );
    // Auto-save flow: clears stale reel ref, saves itinerary, sets new reel id, then clears build
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_REEL_SAVED_ID', id: null })
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SAVE_ITINERARY' })
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CLEAR_ACTIVE_BUILD' })
    );
  });

  it('does not poll when activeBuild is null', async () => {
    const dispatch = vi.fn();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      state: { activeBuild: null },
      dispatch,
    });

    renderHook(() => useBuildStatus());
    await act(async () => { vi.advanceTimersByTime(10000); });

    expect(api.engineItinerary.status).not.toHaveBeenCalled();
  });
});
