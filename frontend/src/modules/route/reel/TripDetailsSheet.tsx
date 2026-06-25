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
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Date + time card (compact) ──────────────────────────────
function DateCard({
  label, icon,
  date, time,
  expanded,
  onExpand, onDateSelect, onTimeChange,
  minDate, maxDate, tripStart, tripEnd, calInitialMonth,
}: {
  label: string; icon: string;
  date: string | null; time: string | null;
  expanded: boolean;
  onExpand: () => void;
  onDateSelect: (iso: string) => void;
  onTimeChange: (hhmm: string) => void;
  minDate?: string; maxDate?: string;
  tripStart?: string | null; tripEnd?: string | null;
  calInitialMonth?: string | null;
}) {
  if (expanded) {
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
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)' }}>{label}</span>
        </div>
        <div style={{ background: 'var(--color-surface)' }}>
          <DateRangeCalendar
            singleDate
            minDate={minDate}
            maxDate={maxDate}
            initialMonth={calInitialMonth ?? date ?? tripStart ?? undefined}
            tripStart={tripStart}
            tripEnd={tripEnd}
            onSelect={onDateSelect}
          />
        </div>
      </div>
    );
  }

  if (date) {
    return (
      <div style={{
        marginBottom: 8, padding: '10px 13px', borderRadius: 13,
        background: 'var(--color-sage-bg)', border: '1px solid var(--color-sage-bdr)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sage)' }}>{label}</span>
          <button
            onClick={onExpand}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 10, color: 'var(--color-text-4)' }}
          >
            {displayDate(date)}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-4)' }}>schedule</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>Time (optional)</span>
          <input
            type="time"
            value={time ?? ''}
            onChange={e => onTimeChange(e.target.value)}
            style={{
              marginLeft: 'auto',
              background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
              borderRadius: 8, padding: '5px 9px',
              fontSize: 13, color: 'var(--color-text-1)',
              fontFamily: 'var(--font-sans)', outline: 'none',
              colorScheme: 'dark',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onExpand}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
        padding: '10px 13px', borderRadius: 13,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-primary)' }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--color-text-4)',
          border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>
          optional
        </span>
      </div>
    </button>
  );
}

// ── Hotel row ───────────────────────────────────────────────
function HotelRow({ city, name, placeId, checkInTime, onChange }: {
  city: string;
  name: string | null;
  placeId?: string | null;
  checkInTime?: string | null;
  onChange: (v: { name: string; placeId: string | null; lat?: number | null; lon?: number | null; checkInTime?: string | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name ?? '');
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef(Math.random().toString(36).slice(2));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setVal(name ?? ''); }, [name]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

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
    fetchPlaceDetails(result.place_id).then(details => {
      onChange({ name: selected, placeId: result.place_id, lat: details?.lat ?? null, lon: details?.lon ?? null, checkInTime: checkInTime ?? null });
    }).catch(() => {
      onChange({ name: selected, placeId: result.place_id, lat: null, lon: null, checkInTime: checkInTime ?? null });
    });
  }

  function handleBlur() {
    setTimeout(() => {
      setSuggestions([]);
      setEditing(false);
      onChange({ name: val, placeId: placeId ?? null, checkInTime: checkInTime ?? null });
    }, 150);
  }

  const suggestionsPortal = suggestions.length > 0 && inputRect ? createPortal(
    <div style={{
      position: 'fixed', top: inputRect.bottom, left: inputRect.left, width: inputRect.width,
      zIndex: 999, borderRadius: '0 0 13px 13px',
      border: '1px solid var(--color-amber-bdr)', borderTop: 'none',
      background: 'var(--color-surface2)', overflow: 'hidden',
    }}>
      {suggestions.map((s, i) => (
        <div key={s.place_id} onMouseDown={() => handleSelect(s)} onTouchStart={() => handleSelect(s)}
          style={{ padding: '10px 13px', borderTop: i > 0 ? '1px solid var(--color-divider)' : 'none', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>{s.main_text}</div>
          {s.secondary_text && <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 1 }}>{s.secondary_text}</div>}
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
          padding: '10px 13px', borderRadius: suggestions.length > 0 ? '13px 13px 0 0' : 13,
          cursor: 'text',
          background: name && !editing ? 'var(--color-sage-bg)' : 'var(--color-surface)',
          border: `1px solid ${name && !editing ? 'var(--color-sage-bdr)' : editing ? 'var(--color-amber-bdr)' : 'var(--color-border)'}`,
        }}
      >
        <span className="ms fill" style={{ fontSize: 15, color: name && !editing ? 'var(--color-sage)' : 'var(--color-primary)', flexShrink: 0 }}>
          hotel
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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
              style={{ width: '100%', background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)' }}
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

      {fetchError && editing && (
        <div style={{ padding: '8px 13px', fontSize: 12, color: 'var(--color-text-4)' }}>
          Can't load suggestions — type the name and tap away to save
        </div>
      )}

      {/* Check-in time row */}
      {name && !editing && (
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
          <span className="ms" style={{ fontSize: 12, color: 'var(--color-text-4)' }}>key</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-4)' }}>Check-in from</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {checkInTime && (
              <button
                onClick={() => onChange({ name: name!, placeId: placeId ?? null, checkInTime: null })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1 }}
              >×</button>
            )}
            <input
              type="time"
              value={checkInTime ?? ''}
              onChange={e => onChange({ name: name!, placeId: placeId ?? null, checkInTime: e.target.value || null })}
              style={{
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: '4px 8px',
                fontSize: 12, color: checkInTime ? 'var(--color-text-1)' : 'var(--color-text-4)',
                fontFamily: 'var(--font-sans)', outline: 'none',
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>
      )}

      {suggestionsPortal}
    </div>
  );
}

// ── Compact city time row ───────────────────────────────────
function CityTimeRow({ icon, label, value, onChange }: {
  icon: string; label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
      <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-4)', width: 16 }}>{icon}</span>
      <span style={{ fontSize: 12, color: 'var(--color-text-3)', flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {value && (
          <button
            onClick={() => onChange(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1 }}
          >×</button>
        )}
        <input
          type="time"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          style={{
            background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '5px 9px',
            fontSize: 12, color: value ? 'var(--color-text-1)' : 'var(--color-text-4)',
            fontFamily: 'var(--font-sans)', outline: 'none',
            colorScheme: 'dark',
          }}
        />
      </div>
    </div>
  );
}

export function TripDetailsSheet({ cities, existingDetails, onSave, onClose, firstDayDate = null, lastDayDate = null }: Props) {
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
  const [cityArrivals, setCityArrivals] = useState<{
    city: string;
    arrivalTime: string | null;
    arrivalVia: string | null;
    departureTime: string | null;
  }[]>(() => {
    if (existingDetails?.cityArrivals?.length) return existingDetails.cityArrivals;
    return cities.map(c => ({ city: c, arrivalTime: null, arrivalVia: null, departureTime: null }));
  });

  const [expanded, setExpanded] = useState<'arrival' | 'departure' | null>(null);

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

  useSheetDismiss(onClose, true);

  const firstCity = cities[0] ?? '';
  const lastCity = cities[cities.length - 1] ?? '';
  const titleCities = formatCityLabel(cities).toUpperCase();

  function handleHotelChange(city: string, v: { name: string; placeId: string | null; lat?: number | null; lon?: number | null; checkInTime?: string | null }) {
    setHotels(prev => prev.map(h =>
      h.city === city
        ? { ...h, name: v.name || null, placeId: v.placeId, lat: v.lat !== undefined ? v.lat : h.lat, lon: v.lon !== undefined ? v.lon : h.lon, checkInTime: v.checkInTime ?? h.checkInTime }
        : h
    ));
  }

  function handleCityArrivalChange(city: string, field: 'arrivalTime' | 'departureTime', value: string | null) {
    setCityArrivals(prev => prev.map(c => c.city === city ? { ...c, [field]: value } : c));
  }

  function handleSave() {
    onSave({ arrivalDate, arrivalTime, departureDate, departureTime, hotels, cityArrivals });
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
          borderTop: '1px solid var(--color-border-m)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          animation: 'sheet-in .35s cubic-bezier(.25,0,0,1) both',
          maxHeight: '92dvh', overflowY: 'auto',
        }}
        className="no-scrollbar"
      >
        <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--color-border-m)', margin: '11px auto 16px' }} />

        <div style={{ padding: '0 16px' }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--color-primary)', marginBottom: 16,
          }}>
            TRIP DETAILS · {titleCities}
          </p>

          {/* Single-city: arrival + departure date/time cards + hotel */}
          {!isMultiCity && (
            <>
              <DateCard
                label="Arrival" icon="flight_land"
                date={arrivalDate} time={arrivalTime}
                expanded={expanded === 'arrival'}
                onExpand={() => setExpanded(expanded === 'arrival' ? null : 'arrival')}
                onDateSelect={iso => { setArrivalDate(iso); setExpanded(null); }}
                onTimeChange={setArrivalTime}
                maxDate={[departureDate, firstDayDate].filter(Boolean).sort()[0] ?? undefined}
                tripStart={firstDayDate} tripEnd={lastDayDate}
              />

              <DateCard
                label="Departure" icon="flight_takeoff"
                date={departureDate} time={departureTime}
                expanded={expanded === 'departure'}
                onExpand={() => setExpanded(expanded === 'departure' ? null : 'departure')}
                onDateSelect={iso => { setDepartureDate(iso); setExpanded(null); }}
                onTimeChange={setDepartureTime}
                minDate={arrivalDate ?? undefined}
                calInitialMonth={lastDayDate}
              />

              <HotelRow city={firstCity} name={hotels[0]?.name ?? null} placeId={hotels[0]?.placeId} checkInTime={hotels[0]?.checkInTime} onChange={v => handleHotelChange(firstCity, v)} />
            </>
          )}

          {/* Multi-city: per-city compact blocks */}
          {isMultiCity && cities.map((city, i) => {
            const hotelEntry = hotels.find(h => h.city === city);
            const arrivalEntry = cityArrivals.find(c => c.city === city);
            const prevCity = i > 0 ? cities[i - 1] : null;

            return (
              <div key={city} style={{ marginBottom: 10 }}>
                {/* City header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                  padding: '7px 12px', borderRadius: 10,
                  background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-primary-bg)', border: '1px solid var(--color-amber-bdr)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)' }}>{city}</span>
                </div>

                {/* Arriving time */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 11, marginBottom: 6 }}>
                  <CityTimeRow
                    icon="flight_land"
                    label={prevCity ? `Arriving from ${prevCity}` : 'Arriving at'}
                    value={arrivalEntry?.arrivalTime ?? null}
                    onChange={v => handleCityArrivalChange(city, 'arrivalTime', v)}
                  />
                </div>

                {/* Hotel */}
                <HotelRow
                  city={city}
                  name={hotelEntry?.name ?? null}
                  placeId={hotelEntry?.placeId ?? null}
                  checkInTime={hotelEntry?.checkInTime ?? null}
                  onChange={v => handleHotelChange(city, v)}
                />

                {/* Departure time */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 11, marginTop: 6 }}>
                  <CityTimeRow
                    icon="flight_takeoff"
                    label="Leaving by"
                    value={arrivalEntry?.departureTime ?? null}
                    onChange={v => handleCityArrivalChange(city, 'departureTime', v)}
                  />
                </div>
              </div>
            );
          })}

          {/* For multi-city: overall arrival + departure times for first/last city */}
          {isMultiCity && (
            <div style={{ marginTop: 6, marginBottom: 8, padding: '10px 12px', borderRadius: 11, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 8 }}>
                Trip dates (optional)
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: 'var(--color-text-4)', marginBottom: 4 }}>Arrival</p>
                  <input
                    type="date"
                    value={arrivalDate ?? ''}
                    onChange={e => setArrivalDate(e.target.value || null)}
                    style={{
                      width: '100%', background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                      borderRadius: 8, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-1)',
                      fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: 'var(--color-text-4)', marginBottom: 4 }}>Departure</p>
                  <input
                    type="date"
                    value={departureDate ?? ''}
                    onChange={e => setDepartureDate(e.target.value || null)}
                    style={{
                      width: '100%', background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                      borderRadius: 8, padding: '6px 8px', fontSize: 12, color: 'var(--color-text-1)',
                      fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, marginTop: 4,
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
