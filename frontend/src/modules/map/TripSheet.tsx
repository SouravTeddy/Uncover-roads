import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import type { CityResult, GeoData, StartType } from '../../shared/types';

interface Props {
  onClose: () => void;
  onRequestPinDrop: () => void;
  onClearPin: () => void;
  pinDropResult: { lat: number; lon: number } | null;
  cityGeo: GeoData | null;
}

const LOCATION_TYPES: { value: StartType; label: string; icon: string }[] = [
  { value: 'hotel',   label: 'Hotel',   icon: 'hotel' },
  { value: 'airport', label: 'Airport', icon: 'flight_land' },
];

async function nominatimSearch(
  query: string,
  cityGeo: GeoData | null,
  signal?: AbortSignal,
): Promise<CityResult[]> {
  const params = new URLSearchParams({ q: query, format: 'json', limit: '6' });
  if (cityGeo) {
    const [south, north, west, east] = cityGeo.bbox;
    params.set('viewbox', `${west},${north},${east},${south}`);
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

const GENERATION_LIMIT = 5;

export function TripSheet({ onClose, onRequestPinDrop, onClearPin, pinDropResult, cityGeo }: Props) {
  const { state, dispatch } = useAppStore();
  const ctx = state.tripContext;
  const placesCount = state.selectedPlaces.length;
  const [showLimitModal, setShowLimitModal] = useState(false);

  const [date, setDate]               = useState(ctx.date);
  const [startType, setStartType]     = useState<StartType>(ctx.startType === 'pin' ? 'hotel' : ctx.startType);
  const [arrivalTime, setArrivalTime] = useState(ctx.arrivalTime ?? '');
  const [days, setDays]               = useState(Math.max(1, ctx.days));

  // Location search
  const [locationQuery, setLocationQuery]       = useState(ctx.locationName ?? '');
  const [searchResults, setSearchResults]       = useState<CityResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<CityResult | null>(
    ctx.locationLat != null && ctx.locationLon != null && ctx.locationName != null
      ? { name: ctx.locationName, country: ctx.locationName, lat: ctx.locationLat, lon: ctx.locationLon }
      : null,
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const resultsRef  = useRef<HTMLDivElement | null>(null);

  // needsArrival only applies when hotel/airport chip is active (not drop pin)
  const needsArrival = !pinDropResult && (startType === 'airport' || startType === 'hotel');
  // Drop pin has its own "start time" field
  const showTimeField = needsArrival || !!pinDropResult;
  const timeLabel = pinDropResult
    ? 'What time do you start?'
    : startType === 'hotel' ? 'What time do you check in?' : 'What time do you land?';
  const timeIcon = pinDropResult ? 'schedule' : startType === 'hotel' ? 'meeting_room' : 'flight_land';
  const canGenerate  = !!date;

  // Smart hints
  const estimatedDays   = Math.ceil(placesCount / 4);
  const tooManyPlaces   = days < estimatedDays && placesCount > 4;
  const arrivalHour     = arrivalTime ? parseInt(arrivalTime.split(':')[0], 10) : null;
  const isLateArrival   = needsArrival && arrivalHour !== null && arrivalHour >= 17;
  const isVeryLate      = needsArrival && arrivalHour !== null && arrivalHour >= 20;

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
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
      } catch {
        if (!signal.aborted) setSearchResults([]);
      } finally {
        if (!signal.aborted) setSearchLoading(false);
      }
    }, 300);
  }, [cityGeo]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
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
    // Enforce generation limit for non-admin users
    if (state.userRole !== 'admin' && state.generationCount >= GENERATION_LIMIT) {
      setShowLimitModal(true);
      return;
    }

    const locationLat  = pinDropResult?.lat ?? selectedLocation?.lat ?? null;
    const locationLon  = pinDropResult?.lon ?? selectedLocation?.lon ?? null;
    const locationName = pinDropResult
      ? 'Custom pin'
      : (selectedLocation?.name ?? (locationQuery.trim() || null));

    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date,
        startType:   pinDropResult ? 'pin' : startType,
        arrivalTime: showTimeField && arrivalTime ? arrivalTime : null,
        days,
        dayNumber:   1,
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
        style={{ zIndex: 50, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-3xl flex flex-col"
        style={{
          zIndex: 51,
          maxHeight: 'min(86dvh, 86vh)',
          overflow: 'hidden',
          background: 'rgb(18,22,30)',
          borderTop: '1px solid rgba(255,255,255,.08)',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-3 pb-5">
          {/* Drag handle */}
          <div className="flex justify-center mb-4">
            <div className="w-9 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="ms fill text-primary" style={{ fontSize: 18 }}>auto_fix</span>
                <h2 className="font-heading font-bold text-white text-lg">Plan your day</h2>
              </div>
              <p className="text-white/45 text-sm">
                {placesCount} place{placesCount !== 1 ? 's' : ''} ready to explore
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,.07)' }}
            >
              <span className="ms text-white/50" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex-shrink-0 h-px mx-5" style={{ background: 'rgba(255,255,255,.06)' }} />

        {/* Scrollable body */}
        <div
          className="flex-1 min-h-0 px-5 py-5"
          style={{ overflowY: 'scroll', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <div className="space-y-6 pb-2">

            {/* ── Travel date ── */}
            <Field icon="calendar_today" label="When are you heading out?">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-11 rounded-2xl text-white text-sm px-4"
                style={{
                  colorScheme: 'dark',
                  background: 'rgba(255,255,255,.05)',
                  border: '1px solid rgba(255,255,255,.09)',
                }}
              />
            </Field>

            {/* ── Starting point ── */}
            <Field icon="near_me" label="Where do you start from?">
              {/* Type chips: Hotel | Airport | Drop a Pin */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {LOCATION_TYPES.map(t => {
                  const active = startType === t.value && !pinDropResult;
                  return (
                    <button
                      key={t.value}
                      onClick={() => {
                        setStartType(t.value);
                        setLocationQuery('');
                        setSelectedLocation(null);
                        setSearchResults([]);
                        if (pinDropResult) onClearPin();
                      }}
                      className="flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all"
                      style={{
                        background: active ? 'rgba(59,130,246,.18)' : 'rgba(255,255,255,.04)',
                        border: active ? '1px solid rgba(59,130,246,.4)' : '1px solid rgba(255,255,255,.07)',
                      }}
                    >
                      <span className="ms fill" style={{ fontSize: 18, color: active ? '#3b82f6' : 'rgba(255,255,255,.35)' }}>
                        {t.icon}
                      </span>
                      <span className="font-medium" style={{ fontSize: 10, color: active ? '#93c5fd' : 'rgba(255,255,255,.4)' }}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
                {/* Drop a pin chip */}
                <button
                  onClick={handleDropPin}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all"
                  style={{
                    background: pinDropResult ? 'rgba(20,184,166,.15)' : 'rgba(255,255,255,.04)',
                    border: pinDropResult ? '1px solid rgba(20,184,166,.35)' : '1px solid rgba(255,255,255,.07)',
                  }}
                >
                  <span className="ms fill" style={{ fontSize: 18, color: pinDropResult ? '#2dd4bf' : 'rgba(255,255,255,.35)' }}>
                    my_location
                  </span>
                  <span className="font-medium" style={{ fontSize: 10, color: pinDropResult ? '#5eead4' : 'rgba(255,255,255,.4)' }}>
                    {pinDropResult ? 'Pin set' : 'Drop pin'}
                  </span>
                </button>
              </div>

              {/* Location search — only when not using drop pin */}
              {!pinDropResult && (
                <>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 ms text-white/30" style={{ fontSize: 16 }}>
                      search
                    </span>
                    <input
                      type="text"
                      value={locationQuery}
                      onChange={e => handleLocationInput(e.target.value)}
                      placeholder={`Name of your ${startType}…`}
                      className="w-full h-11 rounded-2xl text-white text-sm pl-9 pr-9"
                      style={{
                        background: 'rgba(255,255,255,.05)',
                        border: '1px solid rgba(255,255,255,.09)',
                      }}
                    />
                    {searchLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-white/30 text-base animate-spin">autorenew</span>
                    )}
                    {selectedLocation && !searchLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-primary text-base">check_circle</span>
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div
                      ref={resultsRef}
                      className="mt-1.5 rounded-2xl overflow-hidden"
                      style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}
                    >
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectLocation(r)}
                          className="w-full text-left px-4 py-3 transition-colors active:bg-white/5"
                          style={{ borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}
                        >
                          <div className="text-white text-sm font-medium truncate">{r.name}</div>
                          <div className="text-white/35 text-xs truncate mt-0.5">{r.country}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Pin coordinates confirmation */}
              {pinDropResult && (
                <div className="flex items-center gap-2 mt-2 px-1">
                  <span className="ms fill text-teal-400" style={{ fontSize: 13 }}>check_circle</span>
                  <span className="text-teal-300/70 text-xs">
                    {pinDropResult.lat.toFixed(4)}, {pinDropResult.lon.toFixed(4)}
                  </span>
                </div>
              )}
            </Field>

            {/* ── Check-in / arrival / start time ── */}
            {showTimeField && (
              <Field icon={timeIcon} label={timeLabel}>
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={e => setArrivalTime(e.target.value)}
                  className="w-full h-11 rounded-2xl text-white text-sm px-4"
                  style={{
                    colorScheme: 'dark',
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid rgba(255,255,255,.09)',
                  }}
                />
                {isVeryLate && startType === 'hotel' && (
                  <Hint icon="bedtime" color="rgba(167,139,250,1)" bg="rgba(139,92,246,.1)" border="rgba(139,92,246,.2)">
                    Late check-in — by then you'll be ready to rest. We'll plan a fresh start for tomorrow morning.
                  </Hint>
                )}
                {isLateArrival && !isVeryLate && startType === 'hotel' && (
                  <Hint icon="nights_stay" color="rgba(94,234,212,1)" bg="rgba(20,184,166,.08)" border="rgba(20,184,166,.2)">
                    Evening check-in — perfect time to settle in and enjoy a quiet dinner nearby. Your adventure begins tomorrow.
                  </Hint>
                )}
                {isVeryLate && startType === 'airport' && (
                  <Hint icon="bedtime" color="rgba(167,139,250,1)" bg="rgba(139,92,246,.1)" border="rgba(139,92,246,.2)">
                    Arriving that late, your body will thank you for a proper rest. We'll have everything ready for a fresh start tomorrow morning.
                  </Hint>
                )}
                {isLateArrival && !isVeryLate && startType === 'airport' && (
                  <Hint icon="nights_stay" color="rgba(94,234,212,1)" bg="rgba(20,184,166,.08)" border="rgba(20,184,166,.2)">
                    Evening arrival — perfect time to settle in and grab a quiet dinner. Your full adventure starts tomorrow.
                  </Hint>
                )}
              </Field>
            )}

            {/* ── Days ── */}
            <Field icon="wb_sunny" label={`How many days for these ${placesCount} places?`}>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setDays(d => Math.max(1, d - 1))}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,.07)', color: days <= 1 ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.8)' }}
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="font-heading font-bold text-white text-xl">{days}</span>
                  <span className="text-white/40 text-sm ml-1.5">{days === 1 ? 'day' : 'days'}</span>
                </div>
                <button
                  onClick={() => setDays(d => Math.min(14, d + 1))}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.8)' }}
                >
                  +
                </button>
              </div>

              {tooManyPlaces && (
                <Hint icon="auto_awesome" color="rgba(251,191,36,1)" bg="rgba(245,158,11,.08)" border="rgba(245,158,11,.2)">
                  {placesCount} spots is a wonderful list — they'd fill {estimatedDays} days at a relaxed pace. We'll do our best with {days} {days === 1 ? 'day' : 'days'}, and note where you might want to linger longer.
                </Hint>
              )}

            </Field>

          </div>
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-5 pt-4"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
            borderTop: '1px solid rgba(255,255,255,.06)',
          }}
        >
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2.5 transition-all active:scale-[.98] disabled:opacity-30"
            style={{
              background: canGenerate
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : 'rgba(255,255,255,.08)',
            }}
          >
            <span className="ms fill" style={{ fontSize: 18 }}>auto_fix</span>
            Build my itinerary
            <span className="ms" style={{ fontSize: 16 }}>arrow_forward</span>
          </button>
        </div>
      </div>

      {/* ── Generation limit modal ── */}
      {showLimitModal && (
        <div
          className="fixed inset-0 flex items-end justify-center pb-10 px-5"
          style={{ zIndex: 60, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowLimitModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl px-6 py-7 text-center"
            style={{ background: 'rgb(18,22,30)', border: '1px solid rgba(255,255,255,.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.2)' }}
            >
              <span className="ms fill text-amber-400 text-3xl">workspace_premium</span>
            </div>
            <h3 className="font-heading font-bold text-white text-xl mb-2">Beta limit reached</h3>
            <p className="text-white/45 text-sm leading-relaxed mb-6">
              You've used all {GENERATION_LIMIT} itinerary generations in the beta.
              More slots are coming — stay tuned!
            </p>
            <button
              onClick={() => setShowLimitModal(false)}
              className="w-full h-12 rounded-2xl font-semibold text-sm border border-white/10"
              style={{ background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

// ── Small composable pieces ────────────────────────────────────

function Field({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="ms fill text-primary" style={{ fontSize: 15 }}>{icon}</span>
        <p className="text-white/60 text-sm font-medium">{label}</p>
      </div>
      {children}
    </div>
  );
}

function Hint({
  icon,
  color,
  bg,
  border,
  children,
}: {
  icon: string;
  color: string;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-3 rounded-2xl mt-3"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span className="ms fill flex-shrink-0 mt-0.5" style={{ fontSize: 15, color }}>{icon}</span>
      <p className="text-sm leading-relaxed" style={{ color: `${color}cc` }}>{children}</p>
    </div>
  );
}
