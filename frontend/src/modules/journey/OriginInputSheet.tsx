import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { placesAutocomplete, geocodePlace, fetchPlaceDetails } from '../../shared/api';
import type { AutocompleteResult, OriginPlace, OriginType } from '../../shared/types';
import { generateAdvisorMessage } from '../map/advisor-utils';

const PRIMARY  = '#3b82f6';
const TEXT1    = '#f1f5f9';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';
const SURFACE  = '#141921';
const SURFACE2 = '#1A1F2B';

function newSessionId() { return Math.random().toString(36).slice(2); }

/** Classify a place's Google types array into our OriginType */
function classifyOriginType(types: string[] = []): OriginType | 'ask_home' {
  if (types.includes('lodging')) return 'hotel';
  if (types.includes('airport')) return 'airport';
  if (types.includes('street_address') || types.includes('premise')) return 'ask_home';
  return 'custom';
}

/** Parse "Check-in: 3:00 PM" or "Check-out: 11:00 AM" from weekday_text */
function parseCheckTime(weekdayText: string[], keyword: 'Check-in' | 'Check-out'): string | undefined {
  for (const line of weekdayText) {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      const match = line.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (match) {
        // Normalise to 24h HH:MM
        const [time, ampm] = match[1].split(' ');
        const [h, m] = time.split(':').map(Number);
        const hour24 = ampm?.toUpperCase() === 'PM' && h !== 12 ? h + 12 : ampm?.toUpperCase() === 'AM' && h === 12 ? 0 : h;
        return `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
  }
}

interface Props {
  onDone: (origin: OriginPlace) => void;
  onClose: () => void;
}

type Step = 'search' | 'ask_home' | 'departure_time' | 'landing_time';

export function OriginInputSheet({ onDone, onClose }: Props) {
  const { dispatch } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>('search');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef(newSessionId());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved place from search
  const [resolved, setResolved] = useState<{
    placeId: string; name: string; address: string; lat: number; lon: number;
    types: string[]; weekdayText?: string[];
  } | null>(null);

  const [time, setTime] = useState('09:00');

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await placesAutocomplete(val, sessionRef.current);
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  async function handleSelect(result: AutocompleteResult) {
    setLoading(true);
    setResults([]);
    try {
      const geo = await geocodePlace(result.place_id, sessionRef.current);
      sessionRef.current = newSessionId();
      if (!geo) return;

      // Fetch full place details to get types + hotel times
      const details = await fetchPlaceDetails(result.place_id);
      const types = details?.types ?? [];
      const weekdayText = details?.weekday_text ?? [];

      setQuery(geo.name);
      setResolved({ placeId: result.place_id, name: geo.name, address: result.secondary_text, lat: geo.lat, lon: geo.lon, types, weekdayText });

      const classification = classifyOriginType(types);

      if (classification === 'hotel') {
        const checkIn  = parseCheckTime(weekdayText, 'Check-in');
        const checkOut = parseCheckTime(weekdayText, 'Check-out');
        const origin: OriginPlace = {
          placeId: result.place_id, name: geo.name, address: result.secondary_text,
          lat: geo.lat, lon: geo.lon,
          originType: 'hotel',
          checkInTime: checkIn ?? '15:00',
          checkOutTime: checkOut ?? '11:00',
        };
        finishWithMessage(origin, undefined);
      } else if (classification === 'airport') {
        setStep('landing_time');
      } else if (classification === 'ask_home') {
        setStep('ask_home');
      } else {
        // custom
        const origin: OriginPlace = {
          placeId: result.place_id, name: geo.name, address: result.secondary_text,
          lat: geo.lat, lon: geo.lon, originType: 'custom',
        };
        finishWithMessage(origin, undefined);
      }
    } finally {
      setLoading(false);
    }
  }

  function finishWithMessage(origin: OriginPlace, advisorTrigger: string | undefined) {
    dispatch({ type: 'SET_JOURNEY_ORIGIN', place: origin });
    if (advisorTrigger) {
      const msg = advisorTrigger === 'home_departure'
        ? generateAdvisorMessage('home_departure', { departureTime: origin.departureTime })
        : undefined;
      if (msg) {
        dispatch({ type: 'ADD_ADVISOR_MESSAGE', message: { id: `origin-${Date.now()}`, trigger: advisorTrigger, message: msg, timestamp: Date.now() } });
      }
    }
    onDone(origin);
  }

  function confirmHome(isHome: boolean) {
    if (!resolved) return;
    if (isHome) {
      setStep('departure_time');
    } else {
      const origin: OriginPlace = {
        placeId: resolved.placeId, name: resolved.name, address: resolved.address,
        lat: resolved.lat, lon: resolved.lon, originType: 'custom',
      };
      finishWithMessage(origin, undefined);
    }
  }

  function confirmDepartureTime() {
    if (!resolved) return;
    const origin: OriginPlace = {
      placeId: resolved.placeId, name: resolved.name, address: resolved.address,
      lat: resolved.lat, lon: resolved.lon, originType: 'home', departureTime: time,
    };
    finishWithMessage(origin, 'home_departure');
  }

  function confirmLandingTime() {
    if (!resolved) return;
    const origin: OriginPlace = {
      placeId: resolved.placeId, name: resolved.name, address: resolved.address,
      lat: resolved.lat, lon: resolved.lon, originType: 'airport',
      departureTime: time,
      isLongHaul: false, // default to domestic; user can adjust
    };
    finishWithMessage(origin, undefined);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 65, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)', opacity: mounted ? 1 : 0, transition: 'opacity .3s' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: 16, right: 16,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          zIndex: 66, background: SURFACE,
          border: `1px solid ${BORDER}`, borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 20px 18px', borderBottom: `1px solid ${BORDER}`, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: PRIMARY, marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>Starting point</div>
          <div style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 20, fontWeight: 800, color: TEXT1 }}>
            {step === 'search' && 'Where are you starting from?'}
            {step === 'ask_home' && 'Is this your home?'}
            {step === 'departure_time' && 'When are you heading out?'}
            {step === 'landing_time' && 'What time do you land?'}
          </div>
        </div>

        <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* SEARCH step */}
          {step === 'search' && (
            <>
              <div style={{ background: SURFACE2, border: `1.5px solid ${BORDER}`, borderRadius: 14, height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px' }}>
                <span className="ms" style={{ fontSize: 20, color: TEXT3 }}>search</span>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => handleInput(e.target.value)}
                  placeholder="Hotel, airport, home address…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontWeight: 600, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif', caretColor: PRIMARY }}
                />
                {loading && <span className="ms animate-spin" style={{ fontSize: 16, color: TEXT3 }}>autorenew</span>}
              </div>
              {results.length > 0 && (
                <div style={{ background: '#1E2535', border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
                  {results.map((r, i) => (
                    <button
                      key={r.place_id}
                      onMouseDown={() => handleSelect(r)}
                      style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="ms" style={{ fontSize: 16, color: PRIMARY }}>location_on</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{r.main_text}</div>
                        <div style={{ fontSize: 11, color: TEXT3, marginTop: 2, fontFamily: 'Inter, sans-serif' }}>{r.secondary_text}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ASK HOME step */}
          {step === 'ask_home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: TEXT3, lineHeight: 1.5, margin: 0 }}>
                <strong style={{ color: TEXT1 }}>{resolved?.name}</strong> — is this your home?
              </p>
              <button onClick={() => confirmHome(true)} style={{ height: 52, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.3)', borderRadius: 14, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 800, color: '#93c5fd' }}>
                Yes, this is home
              </button>
              <button onClick={() => confirmHome(false)} style={{ height: 52, background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: TEXT3 }}>
                No, just a custom location
              </button>
            </div>
          )}

          {/* DEPARTURE TIME / LANDING TIME step */}
          {(step === 'departure_time' || step === 'landing_time') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT3, margin: 0 }}>
                {step === 'departure_time'
                  ? 'We\'ll build your first day\'s plan from this time.'
                  : 'We\'ll add customs time and adjust your first day\'s pace.'}
              </p>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{
                  width: '100%', height: 56, background: SURFACE2,
                  border: `1.5px solid rgba(59,130,246,.35)`, borderRadius: 14,
                  fontSize: 28, fontWeight: 800, color: TEXT1,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  textAlign: 'center', outline: 'none', cursor: 'pointer',
                  colorScheme: 'dark',
                }}
              />
              <button
                onClick={step === 'departure_time' ? confirmDepartureTime : confirmLandingTime}
                style={{ height: 54, background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`, border: 'none', borderRadius: 16, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 800, color: '#fff', boxShadow: '0 4px 24px rgba(59,130,246,.35)' }}
              >
                {step === 'departure_time' ? `Leaving at ${time}` : `Landing at ${time}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
