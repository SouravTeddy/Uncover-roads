import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TripDetails, JourneyLeg } from '../../../shared/types';

interface Props {
  cities: string[];
  journeyLegs?: JourneyLeg[] | null;
  existingDetails: TripDetails | null;
  travelDate: string | null;
  onSave: (details: TripDetails) => void;
  onClose: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function generateDates(anchorIso: string): string[] {
  const dates: string[] = [];
  const anchor = new Date(anchorIso + 'T12:00:00');
  anchor.setDate(anchor.getDate() - 3);
  for (let i = 0; i < 14; i++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function displayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function displayDateTime(date: string | null, time: string | null): string {
  if (!date) return '--';
  const d = displayDate(date);
  if (!time) return d;
  const t = displayTime12(time);
  return `${d} · ${t}`;
}

function displayTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function to24h(h12: number, m: number, ampm: 'AM' | 'PM'): string {
  let h = h12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (ampm === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function from24h(hhmm: string | null): { h12: number; m: number; ampm: 'AM' | 'PM' } {
  if (!hhmm) return { h12: 10, m: 0, ampm: 'AM' };
  const [h, m] = hhmm.split(':').map(Number);
  return { h12: h % 12 || 12, m, ampm: h >= 12 ? 'PM' : 'AM' };
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

function DayChip({ iso, selected, onSelect }: { iso: string; selected: boolean; onSelect: () => void }) {
  const d = new Date(iso + 'T12:00:00');
  const day = String(d.getDate());
  const dow = d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3);
  return (
    <button
      onClick={onSelect}
      style={{
        flexShrink: 0, padding: '5px 8px', borderRadius: 8, cursor: 'pointer',
        border: selected ? '1.5px solid var(--color-sky)' : '1px solid var(--color-border)',
        background: selected ? 'rgba(79,143,171,.28)' : 'rgba(255,255,255,.04)',
        textAlign: 'center', minWidth: 36,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: selected ? '#fff' : 'var(--color-text-4)' }}>{day}</div>
      <div style={{ fontSize: 9, color: selected ? 'var(--color-sky)' : 'var(--color-text-4)', opacity: selected ? 0.85 : 0.7 }}>{dow}</div>
    </button>
  );
}

function TimeEditor({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const { h12, m, ampm } = from24h(value);
  const [hours, setHours] = useState(h12);
  const [mins, setMins] = useState(m);
  const [period, setPeriod] = useState<'AM' | 'PM'>(ampm);

  useEffect(() => {
    const { h12: h, m: mn, ampm: ap } = from24h(value);
    setHours(h); setMins(mn); setPeriod(ap);
  }, [value]);

  function emit(h: number, mn: number, ap: 'AM' | 'PM') {
    onChange(to24h(h, mn, ap));
  }

  function handleHourBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = Math.max(1, Math.min(12, parseInt(e.target.value) || 1));
    setHours(v); emit(v, mins, period);
  }

  function handleMinBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
    setMins(v); emit(hours, v, period);
  }

  function togglePeriod(p: 'AM' | 'PM') {
    setPeriod(p); emit(hours, mins, p);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)' }}>
        <input
          type="number" min={1} max={12} value={hours}
          onChange={e => setHours(parseInt(e.target.value) || 1)}
          onBlur={handleHourBlur}
          style={{ width: 30, background: 'none', border: 'none', outline: 'none', fontSize: 22, fontWeight: 700, color: '#fff', textAlign: 'center' }}
        />
        <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,.35)', userSelect: 'none' }}>:</span>
        <input
          type="number" min={0} max={59} value={String(mins).padStart(2, '0')}
          onChange={e => setMins(parseInt(e.target.value) || 0)}
          onBlur={handleMinBlur}
          style={{ width: 30, background: 'none', border: 'none', outline: 'none', fontSize: 22, fontWeight: 700, color: '#fff', textAlign: 'center' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(['AM', 'PM'] as const).map(p => (
          <button key={p} onClick={() => togglePeriod(p)} style={{
            padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
            background: period === p ? 'rgba(79,143,171,.18)' : 'transparent',
            border: period === p ? '1px solid var(--color-sky-bdr)' : '1px solid transparent',
            fontSize: 11, fontWeight: 700,
            color: period === p ? 'var(--color-sky)' : 'var(--color-text-4)',
          }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

function DateTimeExpanded({
  label, icon, city, date, time, dates,
  onDateSelect, onTimeChange,
}: {
  label: string; icon: string; city: string;
  date: string | null; time: string | null;
  dates: string[];
  onDateSelect: (iso: string) => void;
  onTimeChange: (hhmm: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current || !date) return;
    const idx = dates.indexOf(date);
    if (idx >= 0) {
      const el = scrollRef.current.children[idx] as HTMLElement;
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [date, dates]);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        padding: '11px 13px', borderRadius: '13px 13px 0 0',
        background: 'rgba(79,143,171,.10)', border: '1.5px solid var(--color-sky-bdr)', borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sky)' }}>{label} · {city}</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>
          {displayDateTime(date, time)}
        </div>
      </div>
      <div style={{
        padding: '10px 13px', borderRadius: '0 0 13px 13px',
        background: 'rgba(79,143,171,.06)', border: '1.5px solid var(--color-sky-bdr)', borderTop: '1px solid rgba(79,143,171,.18)',
      }}>
        <div ref={scrollRef} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 0 }} className="no-scrollbar">
          {dates.map(iso => (
            <DayChip key={iso} iso={iso} selected={iso === date} onSelect={() => onDateSelect(iso)} />
          ))}
        </div>
        <TimeEditor value={time} onChange={onTimeChange} />
      </div>
    </div>
  );
}

function DateTimeCollapsed({
  label, icon, date, time, onExpand,
}: {
  label: string; icon: string; date: string | null; time: string | null; onExpand: () => void;
}) {
  const filled = !!date;
  return (
    <button
      onClick={onExpand}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
        padding: '10px 13px', borderRadius: 13,
        background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 8, opacity: 0.65,
      }}
    >
      <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)' }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: filled ? 'var(--color-text-2)' : 'var(--color-text-4)' }}>
        {filled ? displayDateTime(date, time) : '--'}
      </span>
    </button>
  );
}

function DateTimeCard({
  label, icon, city, date, time, dates, expanded,
  onExpand, onDateSelect, onTimeChange,
}: {
  label: string; icon: string; city: string;
  date: string | null; time: string | null;
  dates: string[]; expanded: boolean;
  onExpand: () => void;
  onDateSelect: (iso: string) => void;
  onTimeChange: (hhmm: string) => void;
}) {
  const filled = !!date;

  if (expanded) {
    return (
      <DateTimeExpanded
        label={label} icon={icon} city={city}
        date={date} time={time} dates={dates}
        onDateSelect={onDateSelect} onTimeChange={onTimeChange}
      />
    );
  }

  if (filled) {
    return (
      <button
        onClick={onExpand}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '12px 13px', borderRadius: 13,
          background: 'var(--color-sage-bg)', border: '1px solid var(--color-sage-bdr)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sage)' }}>{label}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{displayDate(date!)}</div>
        {time && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)', marginTop: 2 }}>{displayTime12(time)}</div>}
      </button>
    );
  }

  return (
    <button
      onClick={onExpand}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '12px 13px', borderRadius: 13,
        background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
        <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.22)' }}>--</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.18)', marginTop: 3 }}>Date · Time</div>
    </button>
  );
}

export function TripDetailsSheet({ cities, journeyLegs, existingDetails, travelDate, onSave, onClose }: Props) {
  const anchor = travelDate ?? todayIso();
  const dates = generateDates(anchor);
  const isMultiCity = cities.length > 1;

  const [arrivalDate, setArrivalDate] = useState<string | null>(existingDetails?.arrivalDate ?? null);
  const [arrivalTime, setArrivalTime] = useState<string | null>(existingDetails?.arrivalTime ?? null);
  const [departureDate, setDepartureDate] = useState<string | null>(existingDetails?.departureDate ?? null);
  const [departureTime, setDepartureTime] = useState<string | null>(existingDetails?.departureTime ?? null);
  const [hotels, setHotels] = useState<{ city: string; name: string | null }[]>(() => {
    if (existingDetails?.hotels?.length) return existingDetails.hotels;
    return cities.map(c => ({ city: c, name: null }));
  });
  const [expanded, setExpanded] = useState<'arrival' | 'departure' | null>(null);

  const firstCity = cities[0] ?? '';
  const lastCity = cities[cities.length - 1] ?? '';

  const titleCities = isMultiCity
    ? cities.slice(0, 3).join(' · ').toUpperCase()
    : firstCity.toUpperCase();

  const allFilled = !!arrivalDate && !!departureDate;

  function handleHotelChange(city: string, name: string) {
    setHotels(prev => prev.map(h => h.city === city ? { ...h, name: name || null } : h));
  }

  function handleSave() {
    onSave({ arrivalDate, arrivalTime, departureDate, departureTime, hotels });
    onClose();
  }

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 66 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(14,12,10,.97)', borderRadius: '24px 24px 0 0',
        borderTop: '1px solid var(--color-border)', backdropFilter: 'blur(20px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        animation: 'sheet-in .35s cubic-bezier(.25,0,0,1) both',
        maxHeight: '92dvh', overflowY: 'auto',
      }} className="no-scrollbar">
        {/* Drag handle */}
        <div style={{ width: 32, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.16)', margin: '11px auto 18px' }} />

        <div style={{ padding: '0 16px' }}>
          {/* Title */}
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: allFilled ? 'var(--color-sage)' : 'var(--color-sky)',
            opacity: allFilled ? 0.85 : 0.75,
            marginBottom: 14,
          }}>
            TRIP DETAILS · {titleCities}
          </p>

          {/* Arrival + Departure */}
          {expanded ? (
            <>
              {expanded === 'arrival' ? (
                <DateTimeExpanded
                  label="Arrival" icon="flight_land" city={firstCity}
                  date={arrivalDate} time={arrivalTime} dates={dates}
                  onDateSelect={setArrivalDate}
                  onTimeChange={setArrivalTime}
                />
              ) : (
                <DateTimeCollapsed
                  label="Arrival" icon="flight_land"
                  date={arrivalDate} time={arrivalTime}
                  onExpand={() => setExpanded('arrival')}
                />
              )}
              {expanded === 'departure' ? (
                <DateTimeExpanded
                  label="Departure" icon="flight_takeoff" city={lastCity}
                  date={departureDate} time={departureTime} dates={dates}
                  onDateSelect={setDepartureDate}
                  onTimeChange={setDepartureTime}
                />
              ) : (
                <DateTimeCollapsed
                  label="Departure" icon="flight_takeoff"
                  date={departureDate} time={departureTime}
                  onExpand={() => setExpanded('departure')}
                />
              )}
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <DateTimeCard
                label="Arrival" icon="flight_land" city={firstCity}
                date={arrivalDate} time={arrivalTime} dates={dates}
                expanded={false}
                onExpand={() => setExpanded('arrival')}
                onDateSelect={setArrivalDate}
                onTimeChange={setArrivalTime}
              />
              <DateTimeCard
                label="Departure" icon="flight_takeoff" city={lastCity}
                date={departureDate} time={departureTime} dates={dates}
                expanded={false}
                onExpand={() => setExpanded('departure')}
                onDateSelect={setDepartureDate}
                onTimeChange={setDepartureTime}
              />
            </div>
          )}

          {/* Hotel rows — single or per-city for multi */}
          {isMultiCity ? (
            hotels.map((hotel, i) => (
              <div key={hotel.city}>
                {/* Transit divider between cities */}
                {i > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, margin: '6px 0',
                    padding: '7px 10px', borderRadius: 9,
                    background: 'rgba(79,143,171,.07)', border: '1px solid rgba(79,143,171,.16)',
                  }}>
                    <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sky)' }}>train</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sky)' }}>
                        {transitLabel(journeyLegs, hotels[i - 1].city, hotel.city) ?? `${hotels[i - 1].city} → ${hotel.city}`}
                      </div>
                    </div>
                  </div>
                )}
                <HotelRow
                  city={hotel.city} name={hotel.name}
                  onChange={n => handleHotelChange(hotel.city, n)}
                />
              </div>
            ))
          ) : (
            <HotelRow
              city={firstCity} name={hotels[0]?.name ?? null}
              onChange={n => handleHotelChange(firstCity, n)}
            />
          )}

          {/* Hint */}
          <p style={{ fontSize: 10, color: 'var(--color-text-4)', lineHeight: 1.6, textAlign: 'center', marginTop: isMultiCity ? 10 : 12, marginBottom: 16 }}>
            {isMultiCity
              ? 'Days per city are calculated after you set arrival date'
              : 'Add what you know — come back anytime to update'}
          </p>

          {/* Save button */}
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: '#0f0d0c',
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

function HotelRow({ city, name, onChange }: { city: string; name: string | null; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(name ?? ''); }, [name]);

  function handleFocus() { setEditing(true); }
  function handleBlur() { setEditing(false); onChange(val); }

  return (
    <div
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 13px', borderRadius: 13, marginBottom: 8, cursor: 'text',
        background: name ? 'var(--color-sage-bg)' : 'rgba(255,255,255,.05)',
        border: `1px solid ${name ? 'var(--color-sage-bdr)' : 'var(--color-border)'}`,
      }}
    >
      <span className="ms fill" style={{ fontSize: 15, color: name ? 'var(--color-sage)' : 'var(--color-sky)', flexShrink: 0 }}>hotel</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: name ? 'var(--color-sage)' : 'var(--color-text-4)', marginBottom: 3 }}>
          Hotel · {city}
        </div>
        {editing ? (
          <input
            ref={inputRef}
            value={val}
            onChange={e => setVal(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search hotel or starting point"
            style={{
              width: '100%', background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: '#fff', fontFamily: 'var(--font-sans)',
            }}
          />
        ) : (
          <div style={{ fontSize: 13, color: name ? '#fff' : 'rgba(255,255,255,.22)', fontWeight: name ? 600 : 400 }}>
            {name || 'Search hotel or starting point'}
          </div>
        )}
      </div>
      {name && <span className="ms fill" style={{ fontSize: 15, color: 'var(--color-sage)' }}>check_circle</span>}
    </div>
  );
}
