import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TripDetails, JourneyLeg, AutocompleteResult } from '../../../shared/types';
import { useSheetDismiss } from '../../../shared/useSheetDismiss';
import { DateRangeCalendar } from '../../destination/DateRangeCalendar';
import { placesAutocomplete, fetchPlaceDetails } from '../../../shared/api';
import { formatCityLabel } from '../../../shared/cityPhoto';

interface Props {
  cities: string[];
  journeyLegs?: JourneyLeg[] | null;
  existingDetails: TripDetails | null;
  onSave: (details: TripDetails) => void;
  onClose: () => void;
  firstDayDate?: string | null;
  lastDayDate?: string | null;
}

function displayDate(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function displayTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function transitLabel(legs: JourneyLeg[] | null | undefined, from: string, to: string): string | null {
  if (!legs) return null;
  const leg = legs.find(l => l.type === 'transit' && l.from === from && l.to === to);
  if (!leg || leg.type !== 'transit') return null;
  const mode = leg.mode.charAt(0).toUpperCase() + leg.mode.slice(1);
  if (leg.durationMinutes) {
    const h = Math.floor(leg.durationMinutes / 60);
    const m = leg.durationMinutes % 60;
    const dur = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
    return `${from} → ${to} · ${mode} · ~${dur}`;
  }
  return `${from} → ${to} · ${mode}`;
}

function ProgressStrip({
  datesSet, timesSet, hotelSet,
}: { datesSet: boolean; timesSet: boolean; hotelSet: boolean }) {
  const dots = [
    { filled: datesSet, label: 'dates' },
    { filled: timesSet, label: 'times' },
    { filled: hotelSet, label: 'base' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {dots.map(({ filled, label }) => (
          <div
            key={label}
            title={`${label}: ${filled ? 'complete' : 'incomplete'}`}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: filled ? 'var(--color-primary)' : 'var(--color-border-m)',
              transition: 'background .25s',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.4 }}>
        Fill in what you have — we'll build with whatever you add
      </span>
    </div>
  );
}

function TimeStepper({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const raw = value ?? '09:00';
  const rawH = parseInt(raw.split(':')[0]);
  const rawM = Math.round(parseInt(raw.split(':')[1]) / 15) * 15 % 60;
  const [hour12, setHour12] = useState(rawH % 12 || 12);
  const [minute, setMinute]  = useState(rawM);
  const [isPM, setIsPM]      = useState(rawH >= 12);

  function emit(h12: number, m: number, pm: boolean) {
    const h24 = pm ? (h12 % 12) + 12 : h12 % 12;
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  function incH() { const h = (hour12 % 12) + 1; setHour12(h); emit(h, minute, isPM); }
  function decH() { const h = hour12 === 1 ? 12 : hour12 - 1; setHour12(h); emit(h, minute, isPM); }
  function incM() { const m = (minute + 15) % 60; setMinute(m); emit(hour12, m, isPM); }
  function decM() { const m = (minute - 15 + 60) % 60; setMinute(m); emit(hour12, m, isPM); }
  function togglePM() { const pm = !isPM; setIsPM(pm); emit(hour12, minute, pm); }

  const col = (label: string, onUp: () => void, onDown: () => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <button onClick={onUp} style={{ width: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}>
        <span className="ms" style={{ fontSize: 18, color: 'var(--color-text-3)' }}>expand_less</span>
      </button>
      <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1, minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {label}
      </span>
      <button onClick={onDown} style={{ width: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}>
        <span className="ms" style={{ fontSize: 18, color: 'var(--color-text-3)' }}>expand_more</span>
      </button>
    </div>
  );

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 8 }}>
        Time <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '4px 12px', borderRadius: 14,
        background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
      }}>
        {col(String(hour12), incH, decH)}
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-3)', marginBottom: 2, lineHeight: 1 }}>:</span>
        {col(String(minute).padStart(2, '0'), incM, decM)}
        <button
          onClick={togglePM}
          style={{
            marginLeft: 8, padding: '5px 10px', borderRadius: 8,
            background: isPM ? 'var(--color-primary)' : 'var(--color-surface)',
            border: `1px solid ${isPM ? 'var(--color-primary)' : 'var(--color-border)'}`,
            color: isPM ? '#fff' : 'var(--color-text-2)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'center',
            fontFamily: 'inherit', transition: 'background .15s, color .15s',
          }}
        >
          {isPM ? 'PM' : 'AM'}
        </button>
      </div>
    </div>
  );
}

function DateTimeCard({
  label, icon, city, date, time,
  expanded, phase,
  onExpand, onDateSelect, onTimeChange,
  minDate, maxDate, tripStart, tripEnd, calInitialMonth,
}: {
  label: string; icon: string; city: string;
  date: string | null; time: string | null;
  expanded: boolean; phase: 'cal' | 'time';
  onExpand: () => void;
  onDateSelect: (iso: string) => void;
  onTimeChange: (hhmm: string) => void;
  minDate?: string; maxDate?: string;
  tripStart?: string | null; tripEnd?: string | null;
  calInitialMonth?: string | null;
}) {
  const filled = !!date;

  // Expanded — calendar phase
  if (expanded && phase === 'cal') {
    return (
      <div style={{
        borderRadius: 13, overflow: 'hidden',
        border: '1.5px solid var(--color-amber-bdr)',
        marginBottom: 8,
      }}>
        <div style={{
          padding: '10px 13px',
          background: 'var(--color-primary-bg)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-primary)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)' }}>{label} · {city}</span>
        </div>
        <div style={{ background: 'var(--color-surface)' }}>
          <DateRangeCalendar
            singleDate
            minDate={minDate}
            maxDate={maxDate}
            initialMonth={calInitialMonth ?? date ?? tripStart ?? undefined}
            tripStart={tripStart}
            tripEnd={tripEnd}
            onSelect={(iso) => onDateSelect(iso)}
          />
        </div>
      </div>
    );
  }

  // Expanded — time phase
  if (expanded && phase === 'time') {
    return (
      <div style={{
        padding: '12px 13px', borderRadius: 13, marginBottom: 8,
        background: 'var(--color-primary-bg)', border: '1.5px solid var(--color-amber-bdr)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-primary)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)' }}>{label} · {city}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 2 }}>
          {displayDate(date!)}
        </div>
        <TimeStepper value={time} onChange={onTimeChange} />
      </div>
    );
  }

  // Collapsed — filled
  if (filled) {
    return (
      <button
        onClick={onExpand}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
          padding: '12px 13px', borderRadius: 13,
          background: 'var(--color-sage-bg)', border: '1px solid var(--color-sage-bdr)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sage)' }}>{label}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-1)' }}>
          {displayDate(date)}
        </div>
        {time && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', marginTop: 2 }}>
            {displayTime12(time)}
          </div>
        )}
      </button>
    );
  }

  // Collapsed — unfilled
  return (
    <button
      onClick={onExpand}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
        padding: '12px 13px', borderRadius: 13,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-primary)' }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--color-text-4)',
          border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>
          optional
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-border-m)' }}>—</div>
    </button>
  );
}

function HotelRow({ city, name, placeId, checkInTime, onChange }: {
  city: string;
  name: string | null;
  placeId?: string | null;
  checkInTime?: string | null;
  onChange: (v: { name: string; placeId: string | null; lat: number | null; lon: number | null; checkInTime?: string | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name ?? '');
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef(Math.random().toString(36).slice(2));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setVal(name ?? ''); }, [name]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  // Capture input rect when suggestions open (for portal positioning)
  useEffect(() => {
    if (suggestions.length > 0 && inputRef.current) {
      setInputRect(inputRef.current.getBoundingClientRect());
    }
  }, [suggestions.length]);

  function handleInput(q: string) {
    setVal(q);
    setFetchError(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSuggestions([]);
    if (q.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await placesAutocomplete(q + ' ' + city, sessionRef.current, 'lodging');
        if (results.length === 0) {
          // Retry without type restriction — hotel may be listed under a different category
          const fallback = await placesAutocomplete(q + ' ' + city, sessionRef.current, '');
          setSuggestions(fallback.slice(0, 5));
        } else {
          setSuggestions(results.slice(0, 5));
        }
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(result: AutocompleteResult) {
    const selected = result.main_text;
    setVal(selected);
    setSuggestions([]);
    setEditing(false);
    sessionRef.current = Math.random().toString(36).slice(2);
    // Fetch coords in background
    fetchPlaceDetails(result.place_id).then(details => {
      onChange({
        name: selected,
        placeId: result.place_id,
        lat: details?.lat ?? null,
        lon: details?.lon ?? null,
        checkInTime: checkInTime ?? null,
      });
    }).catch(() => {
      onChange({ name: selected, placeId: result.place_id, lat: null, lon: null, checkInTime: checkInTime ?? null });
    });
  }

  function handleBlur() {
    // Delay so a tap on a suggestion row fires before blur clears it
    setTimeout(() => {
      setSuggestions([]);
      setEditing(false);
      onChange({ name: val, placeId: placeId ?? null, lat: null, lon: null, checkInTime: checkInTime ?? null });
    }, 150);
  }

  // Portal for suggestions — escapes the sheet's overflow:auto container
  const suggestionsPortal = suggestions.length > 0 && inputRect ? createPortal(
    <div style={{
      position: 'fixed',
      top: inputRect.bottom,
      left: inputRect.left,
      width: inputRect.width,
      zIndex: 999,
      borderRadius: '0 0 13px 13px',
      border: '1px solid var(--color-amber-bdr)',
      borderTop: 'none',
      background: 'var(--color-surface2)',
      overflow: 'hidden',
    }}>
      {suggestions.map((s, i) => (
        <div
          key={s.place_id}
          onMouseDown={() => handleSelect(s)}
          onTouchStart={() => handleSelect(s)}
          style={{
            padding: '10px 13px',
            borderTop: i > 0 ? '1px solid var(--color-divider)' : 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>{s.main_text}</div>
          {s.secondary_text && (
            <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 1 }}>{s.secondary_text}</div>
          )}
        </div>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={() => setEditing(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 13px', borderRadius: suggestions.length > 0 ? '13px 13px 0 0' : 13,
          cursor: 'text',
          background: name && !editing ? 'var(--color-sage-bg)' : 'var(--color-surface)',
          borderTopWidth: 1, borderTopStyle: 'solid',
          borderRightWidth: 1, borderRightStyle: 'solid',
          borderLeftWidth: 1, borderLeftStyle: 'solid',
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderTopColor: name && !editing ? 'var(--color-sage-bdr)' : editing ? 'var(--color-amber-bdr)' : 'var(--color-border)',
          borderRightColor: name && !editing ? 'var(--color-sage-bdr)' : editing ? 'var(--color-amber-bdr)' : 'var(--color-border)',
          borderLeftColor: name && !editing ? 'var(--color-sage-bdr)' : editing ? 'var(--color-amber-bdr)' : 'var(--color-border)',
          borderBottomColor: name && !editing ? 'var(--color-sage-bdr)' : editing ? 'var(--color-amber-bdr)' : 'var(--color-border)',
        }}
      >
        <span className="ms fill" style={{ fontSize: 15, color: name && !editing ? 'var(--color-sage)' : 'var(--color-primary)', flexShrink: 0 }}>
          hotel
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: name && !editing ? 'var(--color-sage)' : 'var(--color-text-4)' }}>
              Your base · {city}
            </span>
            {!name && !editing && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                color: 'var(--color-text-4)', border: '1px solid var(--color-border)',
                borderRadius: 4, padding: '1px 5px' }}>
                optional
              </span>
            )}
          </div>
          {editing ? (
            <input
              ref={inputRef}
              value={val}
              onChange={e => handleInput(e.target.value)}
              onFocus={() => setEditing(true)}
              onBlur={handleBlur}
              placeholder="Where are you staying?"
              style={{
                width: '100%', background: 'none', border: 'none', outline: 'none',
                fontSize: 13, color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
              }}
            />
          ) : (
            <div style={{ fontSize: 13, color: name ? 'var(--color-text-1)' : 'var(--color-text-4)', fontWeight: name ? 600 : 400 }}>
              {name || 'Where are you staying?'}
            </div>
          )}
        </div>
        {loading && <span className="ms" style={{ fontSize: 15, color: 'var(--color-text-4)', animation: 'spin 1s linear infinite' }}>progress_activity</span>}
        {name && !editing && <span className="ms fill" style={{ fontSize: 15, color: 'var(--color-sage)' }}>check_circle</span>}
      </div>

      {/* Autocomplete error fallback */}
      {fetchError && editing && (
        <div style={{ padding: '8px 13px', fontSize: 12, color: 'var(--color-text-4)' }}>
          Can't load suggestions — type the name and tap away to save
        </div>
      )}

      {/* Check-in time row — shown when a hotel name is set */}
      {name && !editing && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-4)' }}>key</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>Check-in from</span>
          <div
            onClick={() => setShowCheckIn(v => !v)}
            style={{
              marginLeft: 'auto', fontSize: 12, color: checkInTime ? 'var(--color-text-2)' : 'var(--color-text-4)',
              fontStyle: checkInTime ? 'normal' : 'italic', cursor: 'pointer',
              padding: '3px 8px', borderRadius: 7,
              background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
            }}
          >
            {checkInTime ? displayTime12(checkInTime) : 'Add time'}
          </div>
        </div>
      )}
      {name && !editing && showCheckIn && (
        <TimeStepper value={checkInTime ?? '15:00'} onChange={t => {
          setShowCheckIn(false);
          onChange({ name: name!, placeId: placeId ?? null, lat: null, lon: null, checkInTime: t });
        }} />
      )}

      {/* Suggestions rendered via portal to escape sheet overflow:auto */}
      {suggestionsPortal}
    </div>
  );
}

export function TripDetailsSheet({ cities, journeyLegs, existingDetails, onSave, onClose, firstDayDate = null, lastDayDate = null }: Props) {
  const isMultiCity = cities.length > 1;

  const [arrivalDate, setArrivalDate] = useState<string | null>(existingDetails?.arrivalDate ?? null);
  const [arrivalTime, setArrivalTime] = useState<string | null>(existingDetails?.arrivalTime ?? null);
  const [departureDate, setDepartureDate] = useState<string | null>(existingDetails?.departureDate ?? null);
  const [departureTime, setDepartureTime] = useState<string | null>(existingDetails?.departureTime ?? null);
  const [hotels, setHotels] = useState<{
    city: string;
    name: string | null;
    placeId?: string | null;
    lat?: number | null;
    lon?: number | null;
    checkInTime?: string | null;
  }[]>(() => {
    if (existingDetails?.hotels?.length) return existingDetails.hotels;
    return cities.map(c => ({ city: c, name: null }));
  });
  const [expanded, setExpanded] = useState<'arrival' | 'departure' | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<'cal' | 'time'>('cal');

  // Swipe-to-close
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    function onTouchStart(e: TouchEvent) { touchStartY.current = e.touches[0].clientY; }
    function onTouchMove(e: TouchEvent) {
      if (touchStartY.current === null) return;
      if (e.touches[0].clientY - touchStartY.current > 0) e.preventDefault();
    }
    function onTouchEnd(e: TouchEvent) {
      if (touchStartY.current === null) return;
      if (e.changedTouches[0].clientY - touchStartY.current > 80) onClose();
      touchStartY.current = null;
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onClose]);

  // Hardware back button
  useSheetDismiss(onClose, true);

  const firstCity = cities[0] ?? '';
  const lastCity = cities[cities.length - 1] ?? '';
  const titleCities = formatCityLabel(cities).toUpperCase();

  const datesSet = !!arrivalDate && !!departureDate;
  const timesSet = !!arrivalTime || !!departureTime;
  const hotelSet = hotels.some(h => !!h.name);

  function handleHotelChange(city: string, v: { name: string; placeId: string | null; lat: number | null; lon: number | null; checkInTime?: string | null }) {
    setHotels(prev => prev.map(h =>
      h.city === city
        ? { ...h, name: v.name || null, placeId: v.placeId, lat: v.lat, lon: v.lon, checkInTime: v.checkInTime ?? h.checkInTime }
        : h
    ));
  }

  function handleArrivalDateSelect(iso: string) {
    setArrivalDate(iso);
    setExpandedPhase('time');
  }

  function handleDepartureDateSelect(iso: string) {
    setDepartureDate(iso);
    setExpandedPhase('time');
  }

  function handleExpand(field: 'arrival' | 'departure') {
    setExpanded(field);
    setExpandedPhase('cal');
  }

  function handleSave() {
    onSave({ arrivalDate, arrivalTime, departureDate, departureTime, hotels, cityArrivals: existingDetails?.cityArrivals });
    onClose();
  }

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 66 }}>
      <div
        role="button"
        aria-label="Close"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      />
      <div
        ref={sheetRef}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--color-bg)', borderRadius: '24px 24px 0 0',
          borderTop: '1px solid var(--color-border-m)', backdropFilter: 'blur(20px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          animation: 'sheet-in .35s cubic-bezier(.25,0,0,1) both',
          maxHeight: '92dvh', overflowY: 'auto',
        }}
        className="no-scrollbar"
      >
        {/* Drag handle */}
        <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--color-border-m)', margin: '11px auto 18px' }} />

        <div style={{ padding: '0 16px' }}>
          {/* Title */}
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: datesSet ? 'var(--color-sage)' : 'var(--color-primary)',
            marginBottom: 10,
          }}>
            TRIP DETAILS · {titleCities}
          </p>

          <ProgressStrip datesSet={datesSet} timesSet={timesSet} hotelSet={hotelSet} />

          {/* Arrival */}
          <DateTimeCard
            label="Arrival" icon="flight_land" city={firstCity}
            date={arrivalDate} time={arrivalTime}
            expanded={expanded === 'arrival'}
            phase={expandedPhase}
            onExpand={() => handleExpand('arrival')}
            onDateSelect={handleArrivalDateSelect}
            onTimeChange={setArrivalTime}
            maxDate={[departureDate, firstDayDate].filter(Boolean).sort()[0] ?? undefined}
            tripStart={firstDayDate}
            tripEnd={lastDayDate}
          />

          {/* Departure */}
          <DateTimeCard
            label="Departure" icon="flight_takeoff" city={lastCity}
            date={departureDate} time={departureTime}
            expanded={expanded === 'departure'}
            phase={expandedPhase}
            onExpand={() => handleExpand('departure')}
            onDateSelect={handleDepartureDateSelect}
            onTimeChange={setDepartureTime}
            minDate={arrivalDate ?? undefined}
            calInitialMonth={lastDayDate}
          />

          {/* Hotel rows */}
          {isMultiCity ? (
            hotels.map((hotel, i) => (
              <div key={hotel.city}>
                {i > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, margin: '6px 0',
                    padding: '7px 10px', borderRadius: 9,
                    background: 'var(--color-primary-bg)', border: '1px solid var(--color-amber-bdr)',
                  }}>
                    <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-primary)' }}>train</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)' }}>
                        {transitLabel(journeyLegs, hotels[i - 1].city, hotel.city) ?? `${hotels[i - 1].city} → ${hotel.city}`}
                      </div>
                    </div>
                  </div>
                )}
                <HotelRow city={hotel.city} name={hotel.name} placeId={hotel.placeId} checkInTime={hotel.checkInTime} onChange={v => handleHotelChange(hotel.city, v)} />
              </div>
            ))
          ) : (
            <HotelRow city={firstCity} name={hotels[0]?.name ?? null} placeId={hotels[0]?.placeId} checkInTime={hotels[0]?.checkInTime} onChange={v => handleHotelChange(firstCity, v)} />
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, marginTop: 8,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: 'var(--color-bg)',
            }}
          >
            Save trip details
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
