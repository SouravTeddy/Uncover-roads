import { useState, useRef, useEffect } from 'react';
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
  const { results, loading, search, selectResult, clear } = useGoogleCitySearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  // Update position on each render when results are shown
  useEffect(() => {
    if (results.length > 0 && containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  }, [results.length]);

  function handleInput(value: string) {
    setQuery(value);
    search(value);
    if (containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  }

  async function handleSelect(result: AutocompleteResult) {
    const geo = await selectResult(result);
    const name = geo?.name ?? result.main_text;
    setQuery('');
    setDropdownRect(null);
    onSelect(name, geo);
  }

  function handleClear() {
    setQuery('');
    clear();
  }

  const dropdown =
    results.length > 0 && dropdownRect
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 4,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
              background: 'var(--color-surface, #1e293b)',
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
                  <div className="text-text-1 text-sm font-medium">{r.main_text}</div>
                  {r.secondary_text && (
                    <div className="text-text-3 text-xs">{r.secondary_text}</div>
                  )}
                </div>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={containerRef} className="relative">
        <div className="flex items-center gap-3 bg-surface rounded-2xl px-4 h-14 border border-white/8">
          <span className="ms text-text-3 text-xl">search</span>
          <input
            type="text"
            value={query}
            placeholder="Destinations, cities, vibes..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            onChange={e => handleInput(e.target.value)}
            className="flex-1 bg-transparent text-text-1 text-base outline-none placeholder:text-text-3"
          />
          {loading && <span className="ms text-text-3 text-base animate-spin">autorenew</span>}
          {query && !loading && (
            <button onClick={handleClear} className="ms text-text-3 text-base">close</button>
          )}
        </div>
      </div>
      {dropdown}
    </>
  );
}
