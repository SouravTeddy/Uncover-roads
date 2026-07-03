import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { shouldShowInstallPrompt, recordVisit, dismissInstallPrompt, VISIT_KEY, DISMISSED_KEY } from './usePWAInstall';

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { store = {}; },
};

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', localStorageMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('recordVisit', () => {
  it('increments visit count in localStorage', () => {
    recordVisit();
    recordVisit();
    expect(Number(localStorage.getItem(VISIT_KEY))).toBe(2);
  });

  it('starts at 1 from zero', () => {
    recordVisit();
    expect(Number(localStorage.getItem(VISIT_KEY))).toBe(1);
  });
});

describe('shouldShowInstallPrompt', () => {
  it('returns false when visit count < 3', () => {
    localStorage.setItem(VISIT_KEY, '2');
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it('returns true when visit count >= 3 and not dismissed', () => {
    localStorage.setItem(VISIT_KEY, '3');
    expect(shouldShowInstallPrompt()).toBe(true);
  });

  it('returns false when dismissed timestamp is within 7 days', () => {
    localStorage.setItem(VISIT_KEY, '5');
    const sevenDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000; // 6 days ago
    localStorage.setItem(DISMISSED_KEY, String(sevenDaysAgo));
    expect(shouldShowInstallPrompt()).toBe(false);
  });

  it('returns true when dismissed timestamp is older than 7 days', () => {
    localStorage.setItem(VISIT_KEY, '5');
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(eightDaysAgo));
    expect(shouldShowInstallPrompt()).toBe(true);
  });
});

describe('dismissInstallPrompt', () => {
  it('stores the current timestamp under DISMISSED_KEY', () => {
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);
    dismissInstallPrompt();
    expect(Number(localStorage.getItem(DISMISSED_KEY))).toBe(now);
  });
});
