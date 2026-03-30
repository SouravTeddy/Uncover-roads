import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import type { CityResult, GeoData, StartType } from '../../shared/types';

interface Props {
  onClose: () => void;
  onRequestPinDrop: () => void;
  pinDropResult: { lat: number; lon: number } | null;
  cityGeo: GeoData | null;
}

const LOCATION_TYPES: { value: StartType; label: string }[] = [
  { value: 'hotel',   label: 'Hotel' },
  { value: 'airbnb',  label: 'Airbnb / Rental' },
  { value: 'airport', label: 'Airport' },
  { value: 'station', label: 'Train / Bus station' },
];

async function nominatimSearch(
  query: string,
  cityGeo: GeoData | null,
  signal?: AbortSignal,
): Promise<CityResult[]> {
  const params = new URLSearchParams({ q: query, format: 'json', limit: '6' });
  // Bias toward the city bbox when available, but don't hard-limit (bounded=0)
  if (cityGeo) {
    const [south, north, west, east] = cityGeo.bbox;
    params.set('viewbox', `${west},${north},${east},${south}`);
    // bounded=0 so results outside bbox still show if nothing local matches
    params.set('bounded', '0');
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
    signal,
  });
  const data = await res.json();
  return data.map((r: { display_name: string; lat: string; lon: string }) => ({
    name: r.display_name.split(',')[0],
    country: r.display_name,
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));
}

export function TripSheet({ onClose, onRequestPinDrop, pinDropResult, cityGeo }: Props) {
  const { state, dispatch } = useAppStore();
  const ctx = state.tripContext;

  const [date, setDate]           = useState(ctx.date);
  const [startType, setStartType] = useState<StartType>(
    ctx.startType === 'pin' ? 'hotel' : ctx.startType,
  );
  const [arrivalTime, setArrivalTime] = useState(ctx.arrivalTime ?? '');
  const [days, setDays]         = useState(ctx.days);
  const [dayNumber, setDayNumber] = useState(ctx.dayNumber);

  // Location search
  const [locationQuery, setLocationQuery]       = useState(ctx.locationName ?? '');
  const [searchResults, setSearchResults]       = useState<CityResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CityResult | null>(
    ctx.locationLat != null && ctx.locationLon != null && ctx.locationName != null
      ? { name: ctx.locationName, country: ctx.locationName, lat: ctx.locationLat, lon: ctx.locationLon }
      : null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef      = useRef<AbortController | null>(null);
  const resultsRef    = useRef<HTMLDivElement | null>(null);

  const needsArrival = startType === 'airport' || startType === 'station';
  const canGenerate  = !!date;

  const handleLocationInput = useCallback((query: string) => {
    setLocationQuery(query);
    setSelectedLocation(null);
    setSearchResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;
      setSearchLoading(true);
      try {
        const results = await nominatimSearch(query, cityGeo, signal);
        if (!signal.aborted) {
          setSearchResults(results);
          // Scroll results into view after render
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
      } catch {
        if (!signal.aborted) setSearchResults([]);
      } finally {
        if (!signal.aborted) setSearchLoading(false);
      }
    }, 300);
  }, [cityGeo]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function handleSelectLocation(result: CityResult) {
    setSelectedLocation(result);
    setLocationQuery(result.name);
    setSearchResults([]);
  }

  function handleDropPin() {
    onRequestPinDrop();
    onClose();
  }

  function handleGenerate() {
    // Pin takes precedence for coordinates; fall back to searched location
    const locationLat  = pinDropResult?.lat ?? selectedLocation?.lat ?? null;
    const locationLon  = pinDropResult?.lon ?? selectedLocation?.lon ?? null;
    const locationName = pinDropResult
      ? 'Custom pin'
      : (selectedLocation?.name ?? (locationQuery.trim() || null));

    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date,
        startType: pinDropResult ? 'pin' : startType,
        arrivalTime: needsArrival && arrivalTime ? arrivalTime : null,
        days,
        dayNumber: Math.min(dayNumber, days),
        locationLat,
        locationLon,
        locationName,
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 50, background: 'rgba(0,0,0,.55)' }}
        onClick={onClose}
      />

      {/* Sheet — overflow:hidden makes maxHeight a hard flex boundary */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-surface flex flex-col"
        style={{ zIndex: 51, maxHeight: 'min(82dvh, 82vh)', overflow: 'hidden' }}
      >
        {/* Handle + title — never scrolls */}
        <div className="flex-shrink-0 px-5 pt-3 pb-4 border-b border-white/8">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-text-1 text-lg">Trip details</h2>
            <button onClick={onClose} className="ms text-text-3 text-xl">close</button>
          </div>
        </div>

        {/* Scrollable body — min-h-0 + overflow-y-scroll needed for iOS */}
        <div
          className="flex-1 min-h-0 px-5 py-4"
          style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <div className="space-y-5 pb-2">

            {/* Travel date */}
            <div>
              <p className="text-text-3 text-xs font-semibold uppercase tracking-wide mb-2">Travel date</p>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Starting from — always visible */}
            <div>
              <p className="text-text-3 text-xs font-semibold uppercase tracking-wide mb-2">Starting from</p>
              <div className="space-y-2">
                {/* Type dropdown */}
                <div className="relative">
                  <select
                    value={startType}
                    onChange={e => {
                      setStartType(e.target.value as StartType);
                      setLocationQuery('');
                      setSelectedLocation(null);
                      setSearchResults([]);
                    }}
                    className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3 pr-9 appearance-none"
                    style={{ colorScheme: 'dark' }}
                  >
                    {LOCATION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ms text-text-3 text-base">
                    expand_more
                  </span>
                </div>

                {/* Name search */}
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={locationQuery}
                      onChange={e => handleLocationInput(e.target.value)}
                      placeholder={`Search for your ${startType}…`}
                      className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3 pr-9"
                    />
                    {searchLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-text-3 text-base animate-spin">autorenew</span>
                    )}
                    {selectedLocation && !searchLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-primary text-base">check_circle</span>
                    )}
                  </div>

                  {/* Autocomplete results — IN FLOW, not absolute, so scroll container doesn't clip */}
                  {searchResults.length > 0 && (
                    <div ref={resultsRef} className="mt-1 rounded-xl bg-bg border border-white/10 overflow-hidden">
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectLocation(r)}
                          className="w-full text-left px-3 py-2.5 border-b border-white/5 last:border-0 active:bg-white/5"
                        >
                          <div className="text-text-1 text-sm font-medium truncate">{r.name}</div>
                          <div className="text-text-3 text-xs truncate mt-0.5">{r.country}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Drop pin — always available; shows confirmation if already dropped */}
                {pinDropResult ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30">
                    <span className="text-base">📍</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-teal-300 text-sm font-medium">Pin set </span>
                      <span className="text-text-3 text-xs">
                        {pinDropResult.lat.toFixed(4)}, {pinDropResult.lon.toFixed(4)}
                      </span>
                    </div>
                    <button onClick={handleDropPin} className="text-teal-400 text-xs underline underline-offset-2 shrink-0">
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDropPin}
                    className="w-full flex items-center gap-2 px-3 h-10 rounded-xl border border-white/10 text-text-3 text-sm"
                  >
                    <span className="ms text-base">location_on</span>
                    Or drop a pin on the map
                  </button>
                )}
              </div>
            </div>

            {/* Arrival time — airport / station only */}
            {needsArrival && (
              <div>
                <p className="text-text-3 text-xs font-semibold uppercase tracking-wide mb-2">Arrival time</p>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={e => setArrivalTime(e.target.value)}
                  className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            )}

            {/* Trip length */}
            <div>
              <p className="text-text-3 text-xs font-semibold uppercase tracking-wide mb-2">Trip length</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDays(d => Math.max(1, d - 1))}
                  className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                >−</button>
                <span className="text-text-1 font-semibold text-sm flex-1 text-center">
                  {days} {days === 1 ? 'day' : 'days'}
                </span>
                <button
                  onClick={() => setDays(d => Math.min(14, d + 1))}
                  className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                >+</button>
              </div>
            </div>

            {/* Day selector — multi-day trips only */}
            {days > 1 && (
              <div>
                <p className="text-text-3 text-xs font-semibold uppercase tracking-wide mb-2">Planning for day</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDayNumber(d => Math.max(1, d - 1))}
                    className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                  >−</button>
                  <span className="text-text-1 font-semibold text-sm flex-1 text-center">
                    Day {Math.min(dayNumber, days)} of {days}
                  </span>
                  <button
                    onClick={() => setDayNumber(d => Math.min(days, d + 1))}
                    className="w-10 h-10 rounded-xl bg-bg border border-white/10 text-text-1 font-bold text-lg flex items-center justify-center"
                  >+</button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer CTA — never scrolls */}
        <div
          className="flex-shrink-0 px-5 pt-3 border-t border-white/8"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
        >
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-14 rounded-2xl bg-orange font-heading font-bold text-white text-base flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <span className="ms fill text-base">auto_fix</span>
            Generate Itinerary
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
