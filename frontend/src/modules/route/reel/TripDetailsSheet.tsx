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

// ── Slot definitions ─────────────────────────────────────────

type ArrivalSlot = 'morning' | 'afternoon' | 'evening' | 'night'
type DepartureSlot = 'morning' | 'midday' | 'afternoon'

const ARRIVAL_SLOTS: { value: ArrivalSlot; label: string; time: string; note: string }[] = [
  { value: 'morning',   label: 'Morning',   time: '09:00', note: 'Suggested start: ~9 AM on arrival day.' },
  { value: 'afternoon', label: 'Afternoon', time: '14:00', note: 'Suggested start: ~2 PM on arrival day.' },
  { value: 'evening',   label: 'Evening',   time: '19:00', note: 'Suggested start: ~7 PM on arrival day.' },
  { value: 'night',     label: 'Night',     time: '22:00', note: 'Suggested start: ~10 PM on arrival day.' },
]

const DEPARTURE_SLOTS: { value: DepartureSlot; label: string; time: string; note: string }[] = [
  { value: 'morning',   label: 'Morning',   time: '09:00', note: 'Suggested: plan winds down around 9 AM.' },
  { value: 'midday',    label: 'Midday',    time: '12:00', note: 'Suggested: plan winds down around noon.' },
  { value: 'afternoon', label: 'Afternoon', time: '15:00', note: 'Suggested: plan winds down around 3 PM.' },
]

function timeToArrivalSlot(t: string | null): ArrivalSlot | null {
  if (!t) return null
  const h = parseInt(t.split(':')[0], 10)
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

function timeToDepartureSlot(t: string | null): DepartureSlot | null {
  if (!t) return null
  const h = parseInt(t.split(':')[0], 10)
  if (h < 11) return 'morning'
  if (h < 14) return 'midday'
  return 'afternoon'
}

// ── Slot chips ───────────────────────────────────────────────

function SlotChips<T extends string>({
  label, slots, value, onChange,
}: {
  label: string
  slots: { value: T; label: string; time: string; note: string }[]
  value: T | null
  onChange: (v: { slot: T; time: string } | null) => void
}) {
  const selected = slots.find(s => s.value === value)
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {slots.map(s => {
          const isActive = s.value === value
          return (
            <button
              key={s.value}
              onClick={() => onChange(isActive ? null : { slot: s.value, time: s.time })}
              style={{
                padding: '5px 13px', borderRadius: 999,
                fontSize: 12, fontWeight: 600,
                border: isActive ? '1px solid var(--color-amber-bdr)' : '1px solid var(--color-border-m)',
                background: isActive ? 'var(--color-primary-bg)' : 'var(--color-surface2)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-3)',
                cursor: 'pointer', transition: 'all .15s ease',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>
      {selected && (
        <div style={{
          marginTop: 7, fontSize: 11, color: 'var(--color-text-4)', lineHeight: 1.45,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,.03)', borderLeft: '2px solid var(--color-border-m)',
        }}>
          {selected.note}
        </div>
      )}
    </div>
  )
}

// ── Hotel row ────────────────────────────────────────────────

function HotelRow({ city, name, placeId, checkInTime, onChange }: {
  city: string
  name: string | null
  placeId?: string | null
  checkInTime?: string | null
  onChange: (v: { name: string; placeId: string | null; lat?: number | null; lon?: number | null; checkInTime?: string | null }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(name ?? '')
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [inputRect, setInputRect] = useState<DOMRect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef(Math.random().toString(36).slice(2))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setVal(name ?? '') }, [name])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => {
    if (suggestions.length > 0 && inputRef.current) {
      setInputRect(inputRef.current.getBoundingClientRect())
    }
  }, [suggestions.length])

  function handleInput(q: string) {
    setVal(q)
    setFetchError(false)
    setNoResults(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSuggestions([])
    if (q.trim().length < 2) return
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await placesAutocomplete(q + ' ' + city, sessionRef.current, 'lodging')
        if (results.length === 0) {
          const fallback = await placesAutocomplete(q + ' ' + city, sessionRef.current, '')
          if (fallback.length === 0) {
            setNoResults(true)
          } else {
            setSuggestions(fallback.slice(0, 5))
          }
        } else {
          setSuggestions(results.slice(0, 5))
        }
      } catch {
        setFetchError(true)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function handleSelect(result: AutocompleteResult) {
    const selected = result.main_text
    setVal(selected)
    setSuggestions([])
    setEditing(false)
    setNoResults(false)
    sessionRef.current = Math.random().toString(36).slice(2)
    fetchPlaceDetails(result.place_id).then(details => {
      onChange({ name: selected, placeId: result.place_id, lat: details?.lat ?? null, lon: details?.lon ?? null, checkInTime: checkInTime ?? null })
    }).catch(() => {
      onChange({ name: selected, placeId: result.place_id, lat: null, lon: null, checkInTime: checkInTime ?? null })
    })
  }

  function handleBlur() {
    setTimeout(() => {
      setSuggestions([])
      setEditing(false)
      setNoResults(false)
      onChange({ name: val, placeId: placeId ?? null, checkInTime: checkInTime ?? null })
    }, 150)
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
          style={{ padding: '10px 13px', borderTop: i > 0 ? '1px solid var(--color-divider)' : 'none', cursor: 'pointer' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)' }}>{s.main_text}</div>
          {s.secondary_text && <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 1 }}>{s.secondary_text}</div>}
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 7 }}>
        Hotel / area <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 9, border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>optional</span>
      </div>
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

      {/* No results message */}
      {noResults && editing && (
        <div style={{
          padding: '9px 13px', fontSize: 12, lineHeight: 1.4,
          color: 'var(--color-text-4)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderTop: 'none', borderRadius: '0 0 13px 13px',
        }}>
          No hotels found in {city}. Type a name and tap away to save it, or leave blank to skip routing.
        </div>
      )}
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
                fontFamily: 'var(--font-sans)', outline: 'none', colorScheme: 'dark',
              }}
            />
          </div>
        </div>
      )}

      {suggestionsPortal}
    </div>
  )
}

// ── Date card (single-city only) ─────────────────────────────

function displayDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function DateCard({
  label, icon, date, expanded,
  onExpand, onDateSelect,
  minDate, maxDate, tripStart, tripEnd, calInitialMonth,
}: {
  label: string; icon: string
  date: string | null; expanded: boolean
  onExpand: () => void
  onDateSelect: (iso: string) => void
  minDate?: string; maxDate?: string
  tripStart?: string | null; tripEnd?: string | null
  calInitialMonth?: string | null
}) {
  if (expanded) {
    return (
      <div style={{ borderRadius: 13, overflow: 'hidden', border: '1.5px solid var(--color-amber-bdr)', marginBottom: 8 }}>
        <div style={{ padding: '10px 13px', background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
    )
  }

  if (date) {
    return (
      <div style={{ marginBottom: 8, padding: '10px 13px', borderRadius: 13, background: 'var(--color-sage-bg)', border: '1px solid var(--color-sage-bdr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="ms fill" style={{ fontSize: 13, color: 'var(--color-sage)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-sage)' }}>{label}</span>
          <button
            onClick={onExpand}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-2)' }}
          >
            {displayDate(date)}
          </button>
        </div>
      </div>
    )
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
        <span style={{
          marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--color-text-4)',
          border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px',
        }}>optional</span>
      </div>
    </button>
  )
}

// ── Collapsible city row (multi-city) ────────────────────────

function CityRow({
  city, index, isLast, prevCity,
  hotelEntry, arrivalEntry,
  onHotelChange, onArrivalChange, onDepartureChange,
  defaultExpanded,
}: {
  city: string; index: number; isLast: boolean; prevCity: string | null
  hotelEntry: { name: string | null; placeId?: string | null; lat?: number | null; lon?: number | null; checkInTime?: string | null }
  arrivalEntry: { arrivalTime: string | null; departureTime: string | null }
  onHotelChange: (v: { name: string; placeId: string | null; lat?: number | null; lon?: number | null; checkInTime?: string | null }) => void
  onArrivalChange: (time: string | null) => void
  onDepartureChange: (time: string | null) => void
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const arrivalSlot = timeToArrivalSlot(arrivalEntry.arrivalTime)
  const departureSlot = timeToDepartureSlot(arrivalEntry.departureTime)

  // Status tags for the collapsed header
  const tags: { label: string; type: 'warn' | 'ok' | 'neutral' }[] = []
  if (hotelEntry.name) {
    tags.push({ label: hotelEntry.name.split(',')[0].slice(0, 22), type: 'ok' })
  }
  if (arrivalSlot) {
    tags.push({ label: arrivalSlot === 'morning' ? 'full day' : `${arrivalSlot} arrival`, type: 'neutral' })
  }

  const tagColors = {
    warn:    { color: '#e8615a', bg: 'rgba(232,97,90,.08)', border: 'rgba(232,97,90,.2)' },
    ok:      { color: 'var(--color-sage)',    bg: 'var(--color-sage-bg)',    border: 'var(--color-sage-bdr)' },
    neutral: { color: 'var(--color-text-4)', bg: 'var(--color-surface2)',   border: 'var(--color-border)' },
  }

  return (
    <div>
      {/* Connector from previous city */}
      {index > 0 && (
        <div style={{ width: 2, height: 18, background: 'var(--color-border-m)', marginLeft: 17, marginTop: -2, marginBottom: -2 }} />
      )}

      {/* City header row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 10px',
          borderRadius: expanded ? '12px 12px 0 0' : 12,
          background: expanded ? 'var(--color-surface)' : 'transparent',
          border: expanded ? '1px solid var(--color-border-m)' : '1px solid transparent',
          cursor: 'pointer', transition: 'background .15s ease, border-color .15s ease',
        }}
      >
        {/* Dot */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${hotelEntry.name ? 'var(--color-sage)' : 'var(--color-primary)'}`,
          background: hotelEntry.name ? 'var(--color-sage)' : 'transparent',
        }} />

        {/* Name + tags */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {city}
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
              {tags.map(t => (
                <span key={t.label} style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                  color: tagColors[t.type].color,
                  background: tagColors[t.type].bg,
                  border: `1px solid ${tagColors[t.type].border}`,
                  whiteSpace: 'nowrap',
                }}>
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <span
          className="ms"
          style={{
            fontSize: 16, color: 'var(--color-text-4)', flexShrink: 0,
            transition: 'transform .2s ease',
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}
        >
          chevron_right
        </span>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            padding: '14px 13px 14px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-m)', borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 7 }}>
              {prevCity ? `Arriving from ${prevCity}` : 'Arriving'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {arrivalEntry.arrivalTime && (
                <button
                  onClick={() => onArrivalChange(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1 }}
                >×</button>
              )}
              <input
                type="time"
                value={arrivalEntry.arrivalTime ?? ''}
                onChange={e => onArrivalChange(e.target.value || null)}
                style={{
                  background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '4px 8px',
                  fontSize: 12, color: arrivalEntry.arrivalTime ? 'var(--color-text-1)' : 'var(--color-text-4)',
                  fontFamily: 'var(--font-sans)', outline: 'none', colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          <HotelRow
            city={city}
            name={hotelEntry.name}
            placeId={hotelEntry.placeId}
            checkInTime={hotelEntry.checkInTime}
            onChange={onHotelChange}
          />

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-4)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 7 }}>
              {isLast ? 'Departing (heading home)' : 'Departing'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {arrivalEntry.departureTime && (
                <button
                  onClick={() => onDepartureChange(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--color-text-4)', fontSize: 13, lineHeight: 1 }}
                >×</button>
              )}
              <input
                type="time"
                value={arrivalEntry.departureTime ?? ''}
                onChange={e => onDepartureChange(e.target.value || null)}
                style={{
                  background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '4px 8px',
                  fontSize: 12, color: arrivalEntry.departureTime ? 'var(--color-text-1)' : 'var(--color-text-4)',
                  fontFamily: 'var(--font-sans)', outline: 'none', colorScheme: 'dark',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main sheet ───────────────────────────────────────────────

export function TripDetailsSheet({ cities, existingDetails, onSave, onClose, firstDayDate = null, lastDayDate = null }: Props) {
  const isMultiCity = cities.length > 1

  const [arrivalDate, setArrivalDate] = useState<string | null>(existingDetails?.arrivalDate ?? null)
  const [arrivalTime, setArrivalTime] = useState<string | null>(existingDetails?.arrivalTime ?? null)
  const [departureDate, setDepartureDate] = useState<string | null>(existingDetails?.departureDate ?? null)
  const [departureTime, setDepartureTime] = useState<string | null>(existingDetails?.departureTime ?? null)

  const [hotels, setHotels] = useState<{
    city: string; name: string | null; placeId?: string | null
    lat?: number | null; lon?: number | null; checkInTime?: string | null
  }[]>(() => {
    if (existingDetails?.hotels?.length) return existingDetails.hotels
    return cities.map(c => ({ city: c, name: null }))
  })

  const [cityArrivals, setCityArrivals] = useState<{
    city: string; arrivalTime: string | null; arrivalVia: string | null; departureTime: string | null
  }[]>(() => {
    if (existingDetails?.cityArrivals?.length) return existingDetails.cityArrivals
    return cities.map(c => ({ city: c, arrivalTime: null, arrivalVia: null, departureTime: null }))
  })

  const [expanded, setExpanded] = useState<'arrival' | 'departure' | null>(null)

  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    function onTouchStart(e: TouchEvent) { touchStartY.current = e.touches[0].clientY }
    function onTouchMove(e: TouchEvent) {
      if (touchStartY.current === null) return
      if (e.touches[0].clientY - touchStartY.current > 0) e.preventDefault()
    }
    function onTouchEnd(e: TouchEvent) {
      if (touchStartY.current === null) return
      if (e.changedTouches[0].clientY - touchStartY.current > 80) onClose()
      touchStartY.current = null
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onClose])

  useSheetDismiss(onClose, true)

  const firstCity = cities[0] ?? ''
  const titleCities = formatCityLabel(cities).toUpperCase()

  function handleHotelChange(city: string, v: { name: string; placeId: string | null; lat?: number | null; lon?: number | null; checkInTime?: string | null }) {
    setHotels(prev => prev.map(h =>
      h.city === city
        ? { ...h, name: v.name || null, placeId: v.placeId, lat: v.lat !== undefined ? v.lat : h.lat, lon: v.lon !== undefined ? v.lon : h.lon, checkInTime: v.checkInTime ?? h.checkInTime }
        : h
    ))
  }

  function handleCityArrivalChange(city: string, field: 'arrivalTime' | 'departureTime', value: string | null) {
    setCityArrivals(prev => prev.map(c => c.city === city ? { ...c, [field]: value } : c))
  }

  function handleSave() {
    onSave({ arrivalDate, arrivalTime, departureDate, departureTime, hotels, cityArrivals })
    onClose()
  }

  // Count cities missing hotels or arrival info (for CTA badge)
  const needsAttention = isMultiCity
    ? cities.filter(c => !hotels.find(h => h.city === c)?.name).length
    : 0

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
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-primary)', marginBottom: 16 }}>
            TRIP DETAILS · {titleCities}
          </p>

          {/* ── Single city ── */}
          {!isMultiCity && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <DateCard
                label="Arrival date" icon="flight_land"
                date={arrivalDate}
                expanded={expanded === 'arrival'}
                onExpand={() => setExpanded(expanded === 'arrival' ? null : 'arrival')}
                onDateSelect={iso => { setArrivalDate(iso); setExpanded(null) }}
                maxDate={[departureDate, firstDayDate].filter(Boolean).sort()[0] ?? undefined}
                tripStart={firstDayDate} tripEnd={lastDayDate}
              />
              {arrivalDate && (
                <SlotChips
                  label="Arriving"
                  slots={ARRIVAL_SLOTS}
                  value={timeToArrivalSlot(arrivalTime)}
                  onChange={v => setArrivalTime(v?.time ?? null)}
                />
              )}

              <DateCard
                label="Departure date" icon="flight_takeoff"
                date={departureDate}
                expanded={expanded === 'departure'}
                onExpand={() => setExpanded(expanded === 'departure' ? null : 'departure')}
                onDateSelect={iso => { setDepartureDate(iso); setExpanded(null) }}
                minDate={arrivalDate ?? undefined}
                calInitialMonth={lastDayDate}
              />
              {departureDate && (
                <SlotChips
                  label="Departing"
                  slots={DEPARTURE_SLOTS}
                  value={timeToDepartureSlot(departureTime)}
                  onChange={v => setDepartureTime(v?.time ?? null)}
                />
              )}

              <HotelRow
                city={firstCity}
                name={hotels[0]?.name ?? null}
                placeId={hotels[0]?.placeId}
                checkInTime={hotels[0]?.checkInTime}
                onChange={v => handleHotelChange(firstCity, v)}
              />
            </div>
          )}

          {/* ── Multi-city: collapsible rows ── */}
          {isMultiCity && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {cities.map((city, i) => {
                const hotelEntry = hotels.find(h => h.city === city) ?? { name: null }
                const arrivalEntry = cityArrivals.find(c => c.city === city) ?? { arrivalTime: null, departureTime: null }
                const prevCity = i > 0 ? cities[i - 1] : null

                return (
                  <CityRow
                    key={city}
                    city={city}
                    index={i}
                    isLast={i === cities.length - 1}
                    prevCity={prevCity}
                    hotelEntry={hotelEntry}
                    arrivalEntry={arrivalEntry}
                    onHotelChange={v => handleHotelChange(city, v)}
                    onArrivalChange={v => handleCityArrivalChange(city, 'arrivalTime', v)}
                    onDepartureChange={v => handleCityArrivalChange(city, 'departureTime', v)}
                    defaultExpanded={i === 0}
                  />
                )
              })}
            </div>
          )}

          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, marginTop: 16,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
              border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: 'var(--color-bg)',
            }}
          >
            {needsAttention > 0
              ? `Save · ${needsAttention} city${needsAttention > 1 ? ' hotels' : ' hotel'} not set`
              : 'Save trip details'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
