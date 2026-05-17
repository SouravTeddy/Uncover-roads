import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLastSession } from './useLastSession';
import type { Place } from '../../shared/types';

const STORAGE_KEY = 'uncover:lastSession';

const mockPlace: Place = {
  id: 'p1',
  title: 'Test Place',
  category: 'museum',
  lat: 48.85,
  lon: 2.35,
};

describe('useLastSession', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns null when localStorage is empty', () => {
    const { result } = renderHook(() => useLastSession());
    expect(result.current.session).toBeNull();
  });

  it('returns session data when a valid entry exists', () => {
    const data = { places: [mockPlace], city: 'Paris', savedAt: new Date().toISOString() };
    store[STORAGE_KEY] = JSON.stringify(data);
    const { result } = renderHook(() => useLastSession());
    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.city).toBe('Paris');
    expect(result.current.session?.places).toHaveLength(1);
  });

  it('returns null when savedAt is older than 30 days', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    store[STORAGE_KEY] = JSON.stringify({ places: [mockPlace], city: 'London', savedAt: old });
    const { result } = renderHook(() => useLastSession());
    expect(result.current.session).toBeNull();
  });

  it('saveSession writes to localStorage and hook returns the new data', () => {
    const { result } = renderHook(() => useLastSession());
    expect(result.current.session).toBeNull();

    act(() => {
      result.current.saveSession([mockPlace], 'Tokyo');
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.stringContaining('Tokyo'));
    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.city).toBe('Tokyo');
    expect(result.current.session?.places).toHaveLength(1);
  });
});
