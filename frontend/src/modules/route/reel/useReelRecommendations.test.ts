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

  it('photoUrl is set from first place when placeImage resolves', async () => {
    vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([
      { placeId: 'p1', name: 'Saravana Bhavan', lat: 12.97, lon: 77.59, category: 'restaurant', rating: 4.5, priceLevel: 1, distanceM: 120, affinityScore: 0.9, matchReasons: [] },
    ]);
    vi.spyOn(apiModule.api, 'placeImage').mockResolvedValue('https://example.com/photo.jpg');

    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.photoUrl).toBe('https://example.com/photo.jpg');
    });
  });

  it('photoUrl falls back to second place when first placeImage returns null', async () => {
    vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([
      { placeId: 'p1', name: 'Place One', lat: 12.97, lon: 77.59, category: 'restaurant', rating: 4.0, priceLevel: 1, distanceM: 100, affinityScore: 0.8, matchReasons: [] },
      { placeId: 'p2', name: 'Place Two', lat: 12.97, lon: 77.59, category: 'restaurant', rating: 4.3, priceLevel: 2, distanceM: 200, affinityScore: 0.7, matchReasons: [] },
    ]);
    vi.spyOn(apiModule.api, 'placeImage')
      .mockResolvedValueOnce(null)
      .mockResolvedValue('https://example.com/second.jpg');

    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));

    await waitFor(() => {
      expect(result.current.photoUrl).toBe('https://example.com/second.jpg');
    });
  });

  it('photoUrl is null when no places found', async () => {
    vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([]);

    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.photoUrl).toBeNull();
  });

  it('does not enter error state when placeImage throws', async () => {
    vi.spyOn(apiModule.api, 'reelReco').mockResolvedValue([
      { placeId: 'p1', name: 'Cafe Nero', lat: 12.97, lon: 77.59, category: 'restaurant', rating: 4.2, priceLevel: 1, distanceM: 150, affinityScore: 0.85, matchReasons: [] },
    ]);
    vi.spyOn(apiModule.api, 'placeImage').mockRejectedValue(new Error('CDN error'));

    const { result } = renderHook(() =>
      useReelRecommendations(CARD, 'explorer', [], true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe(false);
    expect(result.current.places).toHaveLength(1);
    expect(result.current.photoUrl).toBeNull();
  });
});
