import { useState, useEffect, useRef, useCallback } from 'react';
import { placesAutocomplete, api, geocodePlace } from '../../shared/api';
import type { AutocompleteResult, CityResult } from '../../shared/types';
import type { Place, Category } from '../../shared/types';

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
  // Non-null when this result matches a pin already loaded on the map (fast
  // path — used as-is). Null means no local pin matched; its real location is
  // resolved on demand when the user selects it (see resolvePlace below).
  place: Place | null;
}

function categoryFromTypes(types: string[]): Category {
  if (types.some(t => ['restaurant', 'food', 'meal_takeaway'].includes(t))) return 'restaurant';
  if (types.some(t => ['bakery'].includes(t))) return 'bakery';
  if (types.some(t => ['cafe', 'coffee_shop'].includes(t))) return 'cafe';
  if (types.some(t => ['bar', 'night_club'].includes(t))) return 'bar';
  if (types.some(t => ['museum'].includes(t))) return 'museum';
  if (types.some(t => ['art_gallery'].includes(t))) return 'gallery';
  if (types.some(t => ['park', 'natural_feature', 'campground'].includes(t))) return 'park';
  if (types.some(t => ['zoo'].includes(t))) return 'zoo';
  if (types.some(t => ['aquarium'].includes(t))) return 'aquarium';
  if (types.some(t => ['stadium'].includes(t))) return 'stadium';
  if (types.some(t => ['library'].includes(t))) return 'library';
  if (types.some(t => ['movie_theater'].includes(t))) return 'cinema';
  if (types.some(t => ['amusement_park'].includes(t))) return 'amusement_park';
  if (types.some(t => ['spa'].includes(t))) return 'spa';
  if (types.some(t => ['place_of_worship'].includes(t))) return 'spiritual';
  if (types.some(t => ['tourist_attraction', 'point_of_interest'].includes(t))) return 'tourism';
  return 'place';
}

const SESSION_ID = crypto.randomUUID();

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function distSq(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = aLat - bLat, dLon = aLon - bLon;
  return dLat * dLat + dLon * dLon;
}

// When a name-based rule matches more than one pin (e.g. two "Starbucks" in the
// same city), array order alone shouldn't decide the winner. Prefer whichever
// candidate is closest to the current map view.
function pickClosest(candidates: Place[], nearLat?: number, nearLon?: number): Place | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1 || nearLat == null || nearLon == null) return candidates[0];
  return candidates.reduce((best, p) =>
    distSq(p.lat, p.lon, nearLat, nearLon) < distSq(best.lat, best.lon, nearLat, nearLon) ? p : best
  );
}

function findMatchingPlace(
  mainText: string,
  placeId: string,
  places: Place[],
  nearLat?: number,
  nearLon?: number,
): Place | null {
  // Direct Google place_id match — most reliable, avoids false city-prefix matches
  if (placeId) {
    const byId = places.find(p => p.place_id === placeId);
    if (byId) return byId;
  }
  const g = normalize(mainText);
  // Exact name match
  let candidates = places.filter(p => normalize(p.title) === g);
  if (candidates.length) return pickClosest(candidates, nearLat, nearLon);
  // Substring (one contains the other)
  candidates = places.filter(p => {
    const pn = normalize(p.title);
    return g.includes(pn) || pn.includes(g);
  });
  if (candidates.length) return pickClosest(candidates, nearLat, nearLon);
  // Word overlap — use Math.max (not min) so short place names don't over-match
  // e.g. "Hong Kong Cafe" must not match query "Hong Kong Disneyland"
  candidates = places.filter(p => {
    const pWords = normalize(p.title).split(' ').filter(w => w.length > 2);
    const gWords = g.split(' ').filter(w => w.length > 2);
    if (!pWords.length || !gWords.length) return false;
    const pSet = new Set(pWords);
    const common = gWords.filter(w => pSet.has(w)).length;
    return common / Math.min(pWords.length, gWords.length) >= 0.6;
  });
  return pickClosest(candidates, nearLat, nearLon);
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
  padding: '5px 11px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '.03em',
  whiteSpace: 'nowrap',
  background: 'var(--color-surface2)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-3)',
};

const GROUP_BOX: React.CSSProperties = {
  margin: '12px 16px 0',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 16,
  overflow: 'hidden',
};

const GROUP_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.10em',
  textTransform: 'uppercase',
  color: 'var(--color-text-4)',
  padding: '11px 16px 7px',
};

const ROW: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 13,
  padding: '15px 16px', background: 'none', border: 'none',
  borderTop: '1px solid var(--color-divider)',
  cursor: 'pointer', textAlign: 'left',
};

const ROW_ICON: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 13,
  background: 'var(--color-surface2)',
  border: '1px solid var(--color-border)',
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
  // place_id of a result currently being resolved to a real location via
  // geocodePlace() — used to show inline loading state on that row only.
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every debounced search fired; lets a resolving request check whether
  // it's still the latest one before writing results, discarding stale responses
  // that arrive out of order.
  const searchGenRef = useRef(0);

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
    const myGen = ++searchGenRef.current;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setResolveError(false);
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

        // A newer search has since started — this response is stale, discard it.
        if (searchGenRef.current !== myGen) return;

        // Filter city results — exclude the current city (already here)
        const filteredCities = cities.filter(
          c => c.name.toLowerCase() !== city.toLowerCase(),
        ).slice(0, 3);

        // Prefer a match against an already-loaded pin (fast, no extra fetch).
        // If none, still keep the result — its real location is resolved from
        // Google directly when the user selects it, rather than silently
        // dropping it or guessing a nearby pin with a similar name.
        const matched: MatchedResult[] = raw.map(r => ({
          autocomplete: r,
          place: findMatchingPlace(r.main_text, r.place_id, places, cityLat ?? undefined, cityLon ?? undefined),
        }));

        setResults(matched);
        setCityResults(filteredCities);
        setNoResults(matched.length === 0 && filteredCities.length === 0);
      } catch {
        if (searchGenRef.current !== myGen) return;
        setResults([]);
        setCityResults([]);
        setNoResults(true);
      } finally {
        if (searchGenRef.current === myGen) setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isOpen, cityLat, cityLon, places, city]);

  const pick = async (item: MatchedResult) => {
    // Fast path: result already matches a pin loaded on the map — unchanged
    // behavior, no network round-trip needed.
    if (item.place) {
      setSelectedName(item.autocomplete.main_text);
      onSelect(item.place);
      close();
      return;
    }

    // No local pin matched — resolve the real location from Google directly
    // rather than guessing. Keep the search open with a brief loading state
    // instead of closing on a request that might fail.
    setResolving(item.autocomplete.place_id);
    const geo = await geocodePlace(item.autocomplete.place_id, SESSION_ID);
    setResolving(null);
    if (!geo) {
      setResolveError(true);
      return;
    }
    const resolved: Place = {
      id: item.autocomplete.place_id,
      title: geo.name || item.autocomplete.main_text,
      category: categoryFromTypes(item.autocomplete.types ?? []),
      lat: geo.lat,
      lon: geo.lon,
      place_id: item.autocomplete.place_id,
    };
    setSelectedName(item.autocomplete.main_text);
    onSelect(resolved);
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
          background: 'rgba(var(--color-bg-raw, 15,13,12), 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--color-border)',
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
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
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
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
              }}
            >
              <span className="ms" style={{ fontSize: 17, color: 'var(--color-text-3)', lineHeight: 1, flexShrink: 0 }}>search</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search in ${city}…`}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 17, color: 'var(--color-text-1)', caretColor: 'var(--color-primary)' }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-4)', lineHeight: 1 }}>close</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--color-divider)', marginTop: 16 }} />

          {loading && (
            <div style={{ padding: '20px 16px', color: 'var(--color-text-4)', fontSize: 13, textAlign: 'center' }}>Searching…</div>
          )}

          {resolveError && (
            <div style={{ margin: '12px 16px 0', padding: '10px 14px', borderRadius: 12, background: 'var(--color-surface2)', border: '1px solid var(--color-border)', color: 'var(--color-text-3)', fontSize: 13, textAlign: 'center' }}>
              Couldn't locate that place — try again.
            </div>
          )}

          {!loading && (cityResults.length > 0 || results.length > 0) && (
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>

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
                        <span className="ms" style={{ fontSize: 20, color: 'var(--color-text-3)', lineHeight: 1 }}>travel_explore</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--color-text-4)', marginTop: 2 }}>{c.country}</div>
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
                    const isResolving = resolving === item.autocomplete.place_id;
                    return (
                      <button
                        key={item.autocomplete.place_id}
                        onClick={() => { setResolveError(false); pick(item); }}
                        disabled={resolving !== null}
                        style={{ ...ROW, borderTop: i === 0 ? 'none' : ROW.borderTop, opacity: resolving && !isResolving ? 0.5 : 1 }}
                      >
                        <div style={ROW_ICON}>
                          <span className="ms" style={{ fontSize: 20, color: 'var(--color-text-3)', lineHeight: 1 }}>
                            {isResolving ? 'sync' : placeIcon(types)}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.autocomplete.main_text}
                          </div>
                          {item.autocomplete.secondary_text && (
                            <div style={{ fontSize: 14, color: 'var(--color-text-4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isResolving ? 'Locating…' : item.autocomplete.secondary_text}
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
