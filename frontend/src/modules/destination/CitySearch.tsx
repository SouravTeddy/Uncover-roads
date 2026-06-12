import { useState, useRef } from 'react';
import { useGoogleCitySearch } from './useGoogleCitySearch';
import type { AutocompleteResult } from '../../shared/types';

interface GeoResult {
  lat: number;
  lon: number;
  name: string;
  address: string;
  countryCode?: string;
}

interface Props {
  onSelect: (city: string, geo?: GeoResult | null) => void;
}

export function CitySearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const { results, loading, search, selectResult, clear } = useGoogleCitySearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  function handleInput(value: string) {
    setQuery(value);
    setBlocked(false);
    search(value);
  }

  async function handleSelect(result: AutocompleteResult) {
    const geo = await selectResult(result);
    if (geo === 'blocked') {
      setBlocked(true);
      setQuery('');
      clear();
      return;
    }
    const name = geo?.name ?? result.main_text;
    setQuery('');
    setBlocked(false);
    onSelect(name, geo);
  }

  async function handleEnter() {
    if (results.length > 0) {
      await handleSelect(results[0]);
    } else if (query.trim().length >= 2) {
      const q = query.trim();
      setQuery('');
      clear();
      onSelect(q, null);
    }
  }

  function handleClear() {
    setQuery('');
    clear();
  }

  const showResults = focused && results.length > 0;
  const showEmpty = focused && query.length >= 2 && !loading && results.length === 0;

  return (
    <div ref={containerRef} className="relative" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div
        className={`bg-[var(--color-surface)] h-[50px] rounded-[18px] flex items-center px-4 gap-2 border transition-all ${
          focused ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'
        }`}
        style={focused ? { animation: 'wiggleFocus 0.35s ease' } : undefined}
      >
        <span className="ms text-text-3 text-xl">search</span>
        <input
          type="text"
          value={query}
          placeholder="Search a city to explore..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          onChange={e => handleInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleEnter(); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="flex-1 min-w-0 bg-transparent text-text-1 text-base outline-none placeholder:text-text-3"
        />
        {loading && <span className="ms text-text-3 text-base animate-spin">autorenew</span>}
        {query && !loading && (
          <button onClick={handleClear} className="ms text-text-3 text-base">close</button>
        )}
      </div>

      {blocked && (
        <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(232,97,90,.08)', border: '1px solid rgba(232,97,90,.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ms fill" style={{ fontSize: 14, color: '#e8615a', flexShrink: 0 }}>block</span>
          <span style={{ fontSize: 12, color: 'rgba(242,237,230,0.7)', lineHeight: 1.4 }}>
            Travel planning is not available for this destination.
          </span>
        </div>
      )}

      {(showResults || showEmpty) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'var(--color-surface)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
            border: '1px solid rgba(255,255,255,.08)',
          }}
        >
          {showResults ? results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(r)}
              onTouchStart={e => { touchStartY.current = e.touches[0].clientY; }}
              onTouchEnd={e => {
                const delta = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
                if (delta < 6) handleSelect(r);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
              }}
            >
              <span className="ms text-text-3 text-base flex-shrink-0">location_on</span>
              <div className="min-w-0">
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, color: 'var(--color-text-1)', lineHeight: 1.3 }}>
                  {r.main_text}
                </div>
                {r.secondary_text && (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.3 }}>
                    {r.secondary_text}
                  </div>
                )}
              </div>
            </button>
          )) : (
            <div style={{ padding: '14px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5 }}>
              No cities found — try searching by city name, e.g. "Kyoto" or "Lisbon"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
