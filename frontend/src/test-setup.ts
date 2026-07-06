import '@testing-library/jest-dom';

// Polyfill localStorage for test environments that don't expose it globally
if (typeof globalThis.localStorage === 'undefined') {
  const _store: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string): string | null => _store[key] ?? null,
      setItem: (key: string, val: string) => { _store[key] = String(val); },
      removeItem: (key: string) => { delete _store[key]; },
      clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
      get length() { return Object.keys(_store).length; },
      key: (index: number): string | null => Object.keys(_store)[index] ?? null,
    },
    writable: true,
  });
}
