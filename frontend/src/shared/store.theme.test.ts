import { describe, it, expect, beforeEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const datasetMock: Record<string, string> = {};
Object.defineProperty(document.documentElement, 'dataset', { value: datasetMock, writable: true });

describe('theme store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    delete datasetMock.theme;
  });

  it('defaults to dark theme', async () => {
    const { useAppStore } = await import('./store');
    expect(useAppStore.getState().theme).toBe('dark');
  });

  it('SET_THEME updates state, localStorage, and data-theme', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.getState().dispatch({ type: 'SET_THEME', theme: 'light' });
    expect(useAppStore.getState().theme).toBe('light');
    expect(localStorageMock.getItem('ur_theme')).toBe('light');
    expect(datasetMock.theme).toBe('light');
  });

  it('SET_THEME back to dark restores dark token', async () => {
    const { useAppStore } = await import('./store');
    useAppStore.getState().dispatch({ type: 'SET_THEME', theme: 'light' });
    useAppStore.getState().dispatch({ type: 'SET_THEME', theme: 'dark' });
    expect(useAppStore.getState().theme).toBe('dark');
    expect(localStorageMock.getItem('ur_theme')).toBe('dark');
    expect(datasetMock.theme).toBe('dark');
  });
});
