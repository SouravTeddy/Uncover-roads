import { useState, useEffect, useRef, useCallback } from 'react';
import { placesAutocomplete, api } from '../../shared/api';
import type { AutocompleteResult, CityResult } from '../../shared/types';
import type { Place } from '../../shared/types';

interface Props {
  city: string;
  cityLat: number | null;
  cityLon: number | null;
  places: Place[];
  onSelect: (place: Place) => void;
  onCitySelect: (name: string, lat: number, lon: number) => void;
  onClear: () => void;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
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
  if (types.some(t => ['restaurant', 'food', 'meal_takeaway', 'bakery'].includes(t))) return 'restaurant';
  if (types.some(t => ['cafe', 'coffee_shop'].includes(t))) return 'local_cafe';
  if (types.some(t => ['bar', 'night_club'].includes(t))) return 'local_bar';
  if (types.some(t => ['museum', 'art_gallery'].includes(t))) return 'museum';
  if (types.some(t => ['park', 'natural_feature', 'campground'].includes(t))) return 'park';
  if (types.some(t => ['lodging'].includes(t))) return 'hotel';
  if (types.some(t => ['transit_station', 'subway_station', 'bus_station', 'train_station'].includes(t))) return 'directions_subway';
  if (types.some(t => ['shopping_mall', 'store', 'clothing_store'].includes(t))) return 'shopping_bag';
  if (types.some(t => ['tourist_attraction', 'point_of_interest'].includes(t))) return 'photo_camera';
  return 'place';
}

function placeTypeLabel(types: string[]): string {
  if (types.some(t => ['restaurant', 'food', 'meal_takeaway', 'bakery'].includes(t))) return 'Restaurant';
  if (types.some(t => ['cafe', 'coffee_shop'].includes(t))) return 'Café';
  if (types.some(t => ['bar', 'night_club'].includes(t))) return 'Bar';
  if (types.some(t => ['museum'].includes(t))) return 'Museum';
  if (types.some(t => ['art_gallery'].includes(t))) return 'Gallery';
  if (types.some(t => ['park', 'natural_feature'].includes(t))) return 'Park';
  if (types.some(t => ['lodging'].includes(t))) return 'Hotel';
  if (types.some(t => ['transit_station', 'subway_station', 'train_station'].includes(t))) return 'Transit';
  if (types.some(t => ['shopping_mall', 'store'].includes(t))) return 'Shopping';
  if (types.some(t => ['tourist_attraction', 'point_of_interest'].includes(t))) return 'Attraction';
  if (types.some(t => ['establishment'].includes(t))) return 'Place';
  return 'Place';
}

const BADGE: React.CSSProperties = {
  flexShrink: 0,
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.04em',
  whiteSpace: 'nowrap',
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.12)',
  color: 'rgba(255,255,255,.45)',
};

const GROUP_BOX: React.CSSProperties = {
  margin: '12px 16px 0',
  background: 'rgba(255,255,255,.03)',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 16,
  overflow: 'hidden',
};

const GROUP_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.10em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.25)',
  padding: '10px 16px 6px',
};

const ROW: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 13,
  padding: '13px 16px', background: 'none', border: 'none',
  borderTop: '1px solid rgba(255,255,255,.05)',
  cursor: 'pointer', textAlign: 'left',
};

const ROW_ICON: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

export function MapPlaceSearch({ city, cityLat, cityLon, places, onSelect, onCitySelect, onClear, onSearchOpen, onSearchClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchedResult[]>([]);
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = () => {
    setIsOpen(true);
    setIsClosing(false);
    onSearchOpen?.();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const close = useCallback(() => {
    setIsClosing(true);
    onSearchClose?.();
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setQuery('');
      setResults([]);
      setNoResults(false);
    }, 240);
  }, [onSearchClose]);

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedName(null);
    onClear();
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResults([]);
      setCityResults([]);
      setNoResults(false);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [raw, cities] = await Promise.all([
          placesAutocomplete(
            query,
            SESSION_ID,
            'establishment',
            cityLat ?? undefined,
            cityLon ?? undefined,
          ).catch(() => [] as AutocompleteResult[]),
          api.citySearch(query).catch(() => [] as CityResult[]),
        ]);

        // Filter city results — exclude the current city (already here)
        const filteredCities = cities.filter(
          c => c.name.toLowerCase() !== city.toLowerCase(),
        ).slice(0, 3);

        // Only keep place results that match an existing pin
        const matched: MatchedResult[] = [];
        for (const r of raw) {
          const place = findMatchingPlace(r.main_text, places);
          if (place) matched.push({ autocomplete: r, place });
        }

        setResults(matched);
        setCityResults(filteredCities);
        setNoResults(matched.length === 0 && filteredCities.length === 0);
      } catch {
        setResults([]);
        setCityResults([]);
        setNoResults(true);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isOpen, cityLat, cityLon, places, city]);

  const pick = (item: MatchedResult) => {
    setSelectedName(item.autocomplete.main_text);
    onSelect(item.place);
    close();
  };

  const pickCity = (c: CityResult) => {
    setSelectedName(null);
    onCitySelect(c.name, c.lat, c.lon);
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
      <button
        aria-label={selectedName ? undefined : `Search in ${city}`}
        onClick={selectedName ? undefined : open}
        style={{
          position: 'absolute',
          top: `calc(${safeTop} + 12px)`,
          left: 64,
          right: 92,
          height: 44,
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
            color: selectedName ? 'var(--color-text-1)' : 'var(--color-text-3)',
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
      </button>

      {/* Full-screen overlay */}
      {(isOpen || isClosing) && (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={`Search in ${city}`}>
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

          {!loading && (cityResults.length > 0 || results.length > 0) && (
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 24 }}>

              {/* Cities group — only rendered when city results exist */}
              {cityResults.length > 0 && (
                <div style={GROUP_BOX}>
                  <div style={GROUP_LABEL}>Cities</div>
                  {cityResults.map((c, i) => (
                    <button
                      key={`city-${c.name}-${i}`}
                      onClick={() => pickCity(c)}
                      style={{ ...ROW, borderTop: i === 0 ? 'none' : ROW.borderTop }}
                    >
                      <div style={ROW_ICON}>
                        <span className="ms" style={{ fontSize: 18, color: 'var(--color-text-3)', lineHeight: 1 }}>travel_explore</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-4)', marginTop: 2 }}>{c.country}</div>
                      </div>
                      <span style={BADGE}>City</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Places group — only rendered when place results exist */}
              {results.length > 0 && (
                <div style={{ ...GROUP_BOX, marginTop: cityResults.length > 0 ? 10 : 12 }}>
                  <div style={GROUP_LABEL}>Places</div>
                  {results.map((item, i) => {
                    const types = item.autocomplete.types ?? [];
                    return (
                      <button
                        key={item.autocomplete.place_id}
                        onClick={() => pick(item)}
                        style={{ ...ROW, borderTop: i === 0 ? 'none' : ROW.borderTop }}
                      >
                        <div style={ROW_ICON}>
                          <span className="ms" style={{ fontSize: 18, color: 'var(--color-text-3)', lineHeight: 1 }}>
                            {placeIcon(types)}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.autocomplete.main_text}
                          </div>
                          {item.autocomplete.secondary_text && (
                            <div style={{ fontSize: 13, color: 'var(--color-text-4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.autocomplete.secondary_text}
                            </div>
                          )}
                        </div>
                        <span style={BADGE}>{placeTypeLabel(types)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {!loading && noResults && query.trim() && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 32px', textAlign: 'center' }}>
              <span className="ms" style={{ fontSize: 40, color: 'var(--color-text-4)', lineHeight: 1 }}>search_off</span>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-2)' }}>No results in {city}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-4)', lineHeight: 1.5 }}>Try a different name or check the spelling.</p>
            </div>
          )}

          {!loading && !noResults && cityResults.length === 0 && results.length === 0 && !query.trim() && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 32px', textAlign: 'center' }}>
              <span className="ms" style={{ fontSize: 40, color: 'rgba(255,255,255,.1)', lineHeight: 1 }}>travel_explore</span>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-4)', lineHeight: 1.5 }}>Search a place or type a city name to jump there</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
