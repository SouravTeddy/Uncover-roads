import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReelRecommendations } from './useReelRecommendations';
import type { ReelRecoCard } from './types';
import * as apiModule from '../../../shared/api';

const CARD: ReelRecoCard = {
  type: 'reco', id: 'c1', trigger: 'lunch', label: 'Lunch', consequence: 'x',
  nearbyCity: 'Bangalore', persona: 'explorer', afterStopId: 's1',
  stopLat: 12.97, stopLon: 77.59,
};

describe('useReelRecommendations', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns error=true when api throws', async () => {
    vi.spyOn(apiModule.api, 'reelReco').mockRejectedValue(new Error('timeout'));
    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));
    await waitFor(() => {
      expect(result.current.error).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns loading=false and error=false when api resolves empty', async () => {
    vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([]);
    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(false);
    });
    expect(result.current.places).toEqual([]);
  });
});
