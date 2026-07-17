import { useState, useEffect, useRef, useCallback } from 'react';
import { placesAutocomplete } from '../../shared/api';
import type { AutocompleteResult } from '../../shared/types';
import type { Place } from '../../shared/types';

interface Props {
  city: string;
  cityLat: number | null;
  cityLon: number | null;
  places: Place[];
  onSelect: (place: Place) => void;
  onClear: () => void;
}

interface MatchedResult {
  autocomplete: AutocompleteResult;
  place: Place;
}

const SESSION_ID = crypto.randomUUID();

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findMatchingPlace(mainText: string, places: Place[]): Place | null {
  const g = normalize(mainText);
  // Exact match
  let m = places.find(p => normalize(p.title) === g);
  if (m) return m;
  // Substring (one contains the other)
  m = places.find(p => {
    const pn = normalize(p.title);
    return g.includes(pn) || pn.includes(g);
  });
  if (m) return m;
  // Word overlap — 60% of the shorter string's significant words must match
  m = places.find(p => {
    const pWords = normalize(p.title).split(' ').filter(w => w.length > 2);
    const gWords = g.split(' ').filter(w => w.length > 2);
    if (!pWords.length || !gWords.length) return false;
    const pSet = new Set(pWords);
    const common = gWords.filter(w => pSet.has(w)).length;
    return common / Math.min(pWords.length, gWords.length) >= 0.6;
  });
  return m ?? null;
}

function placeIcon(types: string[]): string {
  if (types.some(t => ['restaurant', 'food', 'meal_takeaway', 'cafe', 'bakery', 'bar'].includes(t))) return 'restaurant';
  if (types.some(t => ['museum', 'art_gallery'].includes(t))) return 'museum';
  if (types.some(t => ['park', 'natural_feature', 'campground'].includes(t))) return 'park';
  if (types.some(t => ['lodging'].includes(t))) return 'hotel';
  if (types.some(t => ['transit_station', 'subway_station', 'bus_station', 'train_station'].includes(t))) return 'directions_subway';
  if (types.some(t => ['shopping_mall', 'store', 'clothing_store'].includes(t))) return 'shopping_bag';
  return 'place';
}

export function MapPlaceSearch({ city, cityLat, cityLon, places, onSelect, onClear }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    setIsOpen(true);
    setIsClosing(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const close = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setQuery('');
      setResults([]);
      setNoResults(false);
    }, 240);
  }, []);

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedName(null);
    onClear();
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResults([]);
      setNoResults(false);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const raw = await placesAutocomplete(
          query,
          SESSION_ID,
          'establishment',
          cityLat ?? undefined,
          cityLon ?? undefined,
        );
        // Only keep results that have a matching pin in our places array
        const matched: MatchedResult[] = [];
        for (const r of raw) {
          const place = findMatchingPlace(r.main_text, places);
          if (place) matched.push({ autocomplete: r, place });
        }
        setResults(matched);
        setNoResults(matched.length === 0);
      } catch {
        setResults([]);
        setNoResults(true);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isOpen, cityLat, cityLon, places]);

  const pick = (item: MatchedResult) => {
    setSelectedName(item.autocomplete.main_text);
    onSelect(item.place);
    close();
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 40,
    background: 'var(--color-bg, #0d0e14)',
    display: 'flex',
    flexDirection: 'column',
    transition: isClosing
      ? 'opacity 0.24s ease, transform 0.24s ease'
      : 'opacity 0.32s cubic-bezier(.25,0,0,1), transform 0.32s cubic-bezier(.25,0,0,1)',
    opacity: isOpen && !isClosing ? 1 : 0,
    transform: isOpen && !isClosing ? 'translateY(0)' : isClosing ? 'translateY(60px)' : 'translateY(100%)',
    pointerEvents: isOpen ? 'auto' : 'none',
  };

  const safeTop = 'env(safe-area-inset-top, 0px)';

  return (
    <>
      {/* Compact pill */}
      <div
        onClick={selectedName ? undefined : open}
        style={{
          position: 'absolute',
          top: `calc(${safeTop} + 12px)`,
          left: 64,
          right: 92,
          height: 40,
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px 0 10px',
          borderRadius: 20,
          background: 'rgba(15,20,30,.82)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,.1)',
          cursor: selectedName ? 'default' : 'pointer',
          overflow: 'hidden',
        }}
      >
        <span className="ms" style={{ fontSize: 17, color: 'var(--color-text-3)', flexShrink: 0, lineHeight: 1 }}>search</span>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: selectedName ? 'var(--color-text-1)' : 'var(--color-text-4)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {selectedName ?? `Search in ${city}…`}
        </span>
        {selectedName && (
          <button
            onClick={clear}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-text-4)', flexShrink: 0 }}
          >
            <span className="ms" style={{ fontSize: 16, lineHeight: 1 }}>close</span>
          </button>
        )}
      </div>

      {/* Full-screen overlay */}
      {(isOpen || isClosing) && (
        <div style={overlayStyle}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `calc(${safeTop} + 12px) 16px 0`, flexShrink: 0 }}>
            <button
              onClick={close}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, padding: 0,
              }}
            >
              <span className="ms" style={{ fontSize: 18, color: 'var(--color-text-2)', lineHeight: 1 }}>arrow_back</span>
            </button>
            <div
              style={{
                flex: 1, height: 40, display: 'flex', alignItems: 'center', gap: 8,
                padding: '0 10px', borderRadius: 20,
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
              }}
            >
              <span className="ms" style={{ fontSize: 17, color: 'var(--color-text-3)', lineHeight: 1, flexShrink: 0 }}>search</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search in ${city}…`}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--color-text-1)', caretColor: 'var(--color-primary)' }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-4)', lineHeight: 1 }}>close</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginTop: 16 }} />

          {loading && (
            <div style={{ padding: '20px 16px', color: 'var(--color-text-4)', fontSize: 13, textAlign: 'center' }}>Searching…</div>
          )}

          {!loading && results.length > 0 && (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {results.map((item, i) => (
                <button
                  key={item.autocomplete.place_id}
                  onClick={() => pick(item)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 16px', background: 'none', border: 'none',
                    borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(255,255,255,.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <span className="ms" style={{ fontSize: 17, color: 'var(--color-text-3)', lineHeight: 1 }}>
                      {placeIcon(item.autocomplete.types ?? [])}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.autocomplete.main_text}
                    </div>
                    {item.autocomplete.secondary_text && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.autocomplete.secondary_text}
                      </div>
                    )}
                  </div>
                  <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-4)', lineHeight: 1, flexShrink: 0 }}>chevron_right</span>
                </button>
              ))}
            </div>
          )}

          {!loading && noResults && query.trim() && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 32px', textAlign: 'center' }}>
              <span className="ms" style={{ fontSize: 40, color: 'var(--color-text-4)', lineHeight: 1 }}>search_off</span>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-2)' }}>No results in {city}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-4)', lineHeight: 1.5 }}>Try a different name or check the spelling.</p>
            </div>
          )}

          {!loading && !noResults && results.length === 0 && !query.trim() && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 32px', textAlign: 'center' }}>
              <span className="ms" style={{ fontSize: 40, color: 'rgba(255,255,255,.1)', lineHeight: 1 }}>travel_explore</span>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-4)', lineHeight: 1.5 }}>Type a place name to find it on the map</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
