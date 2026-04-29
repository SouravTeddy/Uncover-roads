import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGoogleCitySearch } from './useGoogleCitySearch';
import type { AutocompleteResult } from '../../shared/types';

interface GeoResult {
  lat: number;
  lon: number;
  name: string;
  address: string;
}

interface Props {
  onSelect: (city: string, geo?: GeoResult | null) => void;
}

export function CitySearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const { results, loading, search, selectResult, clear } = useGoogleCitySearch();
  const containerRef = useRef<HTMLDivElement>(null);

  function handleInput(value: string) {
    setQuery(value);
    search(value);
  }

  async function handleSelect(result: AutocompleteResult) {
    const geo = await selectResult(result);
    const name = geo?.name ?? result.main_text;
    setQuery('');
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

  // Compute rect inline — avoids state timing issues
  const rect = results.length > 0 ? containerRef.current?.getBoundingClientRect() : null;

  return (
    <>
      <div ref={containerRef}>
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
            placeholder="Destinations, cities, vibes..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            onChange={e => handleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEnter(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="flex-1 min-w-0 bg-transparent text-text-1 text-base outline-none placeholder:text-text-3"
          />
          {loading && <span className="ms text-text-3 text-base animate-spin">autorenew</span>}
          {query && !loading && (
            <button onClick={handleClear} className="ms text-text-3 text-base">close</button>
          )}
        </div>
      </div>

      {rect && createPortal(
        <div
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
            background: 'var(--color-surface)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,.6)',
            border: '1px solid rgba(255,255,255,.08)',
          }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(r)}
              onTouchStart={() => handleSelect(r)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none',
                cursor: 'pointer', color: 'inherit',
                borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
              }}
            >
              <span className="ms text-text-3 text-base">location_on</span>
              <div>
                <div className="font-[family-name:var(--font-heading)] text-white text-[22px] font-bold">{r.main_text}</div>
                {r.secondary_text && (
                  <div className="text-[11px] text-white/70">{r.secondary_text}</div>
                )}
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
