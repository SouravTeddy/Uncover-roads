import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../shared/store';
import type { CityResult, GeoData, StartType } from '../../shared/types';

interface Props {
  onClose: () => void;
  onRequestPinDrop: () => void;
  pinDropResult: { lat: number; lon: number } | null;
  cityGeo: GeoData | null;
}

const START_TYPES: { value: StartType; emoji: string; label: string }[] = [
  { value: 'hotel',   emoji: '🏨', label: 'Hotel' },
  { value: 'airport', emoji: '✈️', label: 'Airport' },
  { value: 'station', emoji: '🚉', label: 'Station' },
  { value: 'airbnb',  emoji: '🏠', label: 'Airbnb' },
  { value: 'pin',     emoji: '📍', label: 'Drop Pin' },
];

async function nominatimSearch(query: string, cityGeo: GeoData, signal?: AbortSignal): Promise<CityResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    viewbox: `${cityGeo.bbox[2]},${cityGeo.bbox[1]},${cityGeo.bbox[3]},${cityGeo.bbox[0]}`,
    bounded: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'uncover-roads/1.0' },
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

  const [date, setDate] = useState(ctx.date);
  const [startType, setStartType] = useState<StartType>(ctx.startType);
  const [arrivalTime, setArrivalTime] = useState(ctx.arrivalTime ?? '');
  const [days, setDays] = useState(ctx.days);
  const [dayNumber, setDayNumber] = useState(ctx.dayNumber);

  // Nominatim search state
  const [locationQuery, setLocationQuery] = useState(ctx.locationName ?? '');
  const [searchResults, setSearchResults] = useState<CityResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CityResult | null>(
    ctx.locationLat != null && ctx.locationLon != null && ctx.locationName != null
      ? { name: ctx.locationName, country: ctx.locationName, lat: ctx.locationLat, lon: ctx.locationLon }
      : null
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const needsArrival = startType === 'airport' || startType === 'station';
  const showNameSearch = startType !== 'pin';
  const canGenerate = date && startType;

  // Debounced Nominatim search
  const handleLocationInput = useCallback((query: string) => {
    setLocationQuery(query);
    setSelectedLocation(null);
    setSearchResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !cityGeo) return;
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;
      setSearchLoading(true);
      try {
        const results = await nominatimSearch(query, cityGeo, signal);
        if (!signal.aborted) setSearchResults(results);
      } catch {
        if (!signal.aborted) setSearchResults([]);
      } finally {
        if (!signal.aborted) setSearchLoading(false);
      }
    }, 300);
  }, [cityGeo]);

  // Cleanup debounce and abort on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Clear search when switching to pin mode
  useEffect(() => {
    if (startType === 'pin') {
      setSearchResults([]);
    }
  }, [startType]);

  // When pin drop result arrives, show it
  const pinDropLatLon = pinDropResult;

  function handleSelectLocation(result: CityResult) {
    setSelectedLocation(result);
    setLocationQuery(result.name);
    setSearchResults([]);
  }

  function handleGenerate() {
    const locationLat = pinDropLatLon
      ? pinDropLatLon.lat
      : selectedLocation?.lat ?? null;
    const locationLon = pinDropLatLon
      ? pinDropLatLon.lon
      : selectedLocation?.lon ?? null;
    const locationName = pinDropLatLon
      ? 'Custom pin'
      : selectedLocation?.name ?? (locationQuery.trim() || null);

    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date,
        startType,
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 25, background: 'rgba(0,0,0,.5)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-surface flex flex-col"
        style={{
          zIndex: 26,
          maxHeight: '85dvh',
        }}
      >
        {/* Handle + title — flex-shrink-0 */}
        <div className="flex-shrink-0 px-5 pt-3 pb-3">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <h2 className="font-heading font-bold text-text-1 text-lg mb-1">Trip details</h2>
          <p className="text-text-3 text-sm">Help us build the perfect itinerary for you</p>
        </div>

        {/* Scrollable body — flex-1 overflow-y-auto */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">

          {/* Travel date */}
          <label className="block mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Travel date
            </span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
              style={{ colorScheme: 'dark' }}
            />
          </label>

          {/* Starting point — 5-column grid */}
          <div className="mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Starting from
            </span>
            <div className="grid grid-cols-5 gap-2">
              {START_TYPES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStartType(s.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-all ${
                    startType === s.value
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-bg border-white/10 text-text-3'
                  }`}
                >
                  <span className="text-xl leading-none">{s.emoji}</span>
                  <span className="text-[10px] leading-tight text-center">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nominatim name search — shown for hotel/airport/station/airbnb */}
          {showNameSearch && (
            <div className="mb-4 relative">
              <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                Location name
              </span>
              <div className="relative">
                <input
                  type="text"
                  value={locationQuery}
                  onChange={e => handleLocationInput(e.target.value)}
                  placeholder={`Search for your ${startType}…`}
                  className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3 pr-9"
                />
                {searchLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-text-3 text-base animate-spin">
                    autorenew
                  </span>
                )}
                {selectedLocation && !searchLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-primary text-base">
                    check_circle
                  </span>
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-surface border border-white/10 overflow-hidden z-10 shadow-xl">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectLocation(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <div className="text-text-1 text-sm font-semibold truncate">{r.name}</div>
                      <div className="text-text-3 text-xs truncate">{r.country}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Drop pin UI */}
          {startType === 'pin' && (
            <div className="mb-4">
              {pinDropLatLon ? (
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-teal-500/10 border border-teal-500/30">
                  <span className="text-teal-400 text-xl">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-teal-300 text-sm font-semibold">Pin dropped</p>
                    <p className="text-teal-400/70 text-xs">
                      {pinDropLatLon.lat.toFixed(5)}, {pinDropLatLon.lon.toFixed(5)}
                    </p>
                  </div>
                  <button
                    onClick={onRequestPinDrop}
                    className="text-teal-400 text-xs font-semibold underline underline-offset-2 shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="px-3 py-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-center">
                  <p className="text-teal-300 text-sm font-semibold">Tap the map to drop your starting pin</p>
                  <button
                    onClick={onRequestPinDrop}
                    className="mt-2 px-4 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-semibold"
                  >
                    Start pin drop
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Arrival time — only for airport / station */}
          {needsArrival && (
            <label className="block mb-4">
              <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                Arrival time
              </span>
              <input
                type="time"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
                className="w-full h-11 rounded-xl bg-bg border border-white/10 text-text-1 text-sm px-3"
                style={{ colorScheme: 'dark' }}
              />
            </label>
          )}

          {/* Days */}
          <div className="mb-4">
            <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
              Trip length
            </span>
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

          {/* Day number */}
          {days > 1 && (
            <div className="mb-4">
              <span className="text-text-2 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                Planning for day
              </span>
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

        {/* CTA footer — flex-shrink-0, sticky at bottom */}
        <div
          className="flex-shrink-0 px-5 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
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
    </>
  );
}
