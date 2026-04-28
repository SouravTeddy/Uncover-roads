import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import {
  getTripCapacityStatus,
  computeTotalDays,
  type CapacityStatus,
} from './trip-capacity-utils';

// ── Design tokens ────────────────────────────────────────────
const PRIMARY        = '#3b82f6';
const PRIMARY_BG     = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1          = '#f1f5f9';
const TEXT3          = '#8e9099';
const BORDER         = 'rgba(255,255,255,.08)';
const SURFACE        = '#141921';

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayIso(): string {
  const t = new Date();
  return toIso(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

function statusConfig(status: CapacityStatus): { label: string; color: string } | null {
  switch (status) {
    case 'overflow':  return { label: '⚠ may overflow', color: '#fbbf24' };
    case 'shortage':  return { label: '◎ add more?',    color: '#60a5fa' };
    case 'ok':        return { label: '✓ looks good',   color: '#4ade80' };
    default:          return null;
  }
}

// ── Main component ────────────────────────────────────────────

export function TravelDateBar() {
  const { state, dispatch } = useAppStore();
  const { travelStartDate, travelEndDate, selectedPlaces } = state;
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalDays = computeTotalDays(travelStartDate, travelEndDate);
  const status    = getTripCapacityStatus(selectedPlaces.length, totalDays);
  const indicator = statusConfig(status);
  const isSet     = !!(travelStartDate && travelEndDate);

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        style={{
          width: '100%', height: 40,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,.04)',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '0 14px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          className="ms"
          style={{ fontSize: 16, color: isSet ? PRIMARY : TEXT3, flexShrink: 0 }}
        >
          calendar_month
        </span>

        {isSet ? (
          <>
            <span style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 13, fontWeight: 700, color: TEXT1, flex: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {formatDateShort(travelStartDate!)} → {formatDateShort(travelEndDate!)}
            </span>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12, fontWeight: 600, color: '#93c5fd', flexShrink: 0,
            }}>
              · {totalDays} day{totalDays !== 1 ? 's' : ''}
            </span>
            {indicator && (
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11, fontWeight: 600, color: indicator.color,
                flexShrink: 0, marginLeft: 4,
              }}>
                {indicator.label}
              </span>
            )}
          </>
        ) : (
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13, fontWeight: 500, color: TEXT3, flex: 1,
          }}>
            Set travel dates
          </span>
        )}

        <span className="ms" style={{ fontSize: 14, color: TEXT3, flexShrink: 0 }}>
          chevron_right
        </span>
      </button>

      {sheetOpen && (
        <DateRangeSheet
          initialStart={travelStartDate}
          initialEnd={travelEndDate}
          onDone={(start, end) => {
            dispatch({ type: 'SET_TRAVEL_DATES', startDate: start, endDate: end });
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

// ── DateRangeSheet ────────────────────────────────────────────

export interface SheetProps {
  initialStart: string | null;
  initialEnd:   string | null;
  onDone:  (start: string, end: string) => void;
  onClose: () => void;
}

export function DateRangeSheet({ initialStart, initialEnd, onDone, onClose }: SheetProps) {
  const today = new Date();
  const todayStr = todayIso();

  // Default to tomorrow for start if none set
  const defaultStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [localStart, setLocalStart] = useState(initialStart ?? defaultStart);
  const [localEnd,   setLocalEnd]   = useState(initialEnd   ?? defaultStart);

  // Calendar view state — which month is currently shown (for departure vs return)
  const parseMonth = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  };

  const [startView, setStartView] = useState(() => parseMonth(initialStart ?? defaultStart));
  const [endView,   setEndView]   = useState(() => parseMonth(initialEnd   ?? defaultStart));

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleStartPick(iso: string) {
    setLocalStart(iso);
    if (iso > localEnd) {
      setLocalEnd(iso);
      setEndView(parseMonth(iso));
    }
  }

  function handleEndPick(iso: string) {
    if (iso < localStart) return;
    setLocalEnd(iso);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 55,
          background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      />

      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 16, right: 16,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
          maxHeight: 'calc(100dvh - 80px)',
          overflowY: 'auto',
          zIndex: 56,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s ease',
        }}
      >
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${BORDER}`,
          background: 'linear-gradient(135deg, rgba(59,130,246,.08) 0%, rgba(15,23,42,0) 60%)',
          backgroundColor: SURFACE,
        }}>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: PRIMARY, marginBottom: 4,
            fontFamily: 'Inter, sans-serif',
          }}>
            Travel dates
          </div>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 18, fontWeight: 800, color: TEXT1,
          }}>
            {formatDateShort(localStart)} → {formatDateShort(localEnd)}
            <span style={{
              fontSize: 13, fontWeight: 600, color: '#93c5fd', marginLeft: 8,
              fontFamily: 'Inter, sans-serif',
            }}>
              {computeTotalDays(localStart, localEnd)} day{computeTotalDays(localStart, localEnd) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Departure */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Departure
            </div>
            <MonthCalendar
              year={startView.year}
              month={startView.month}
              selected={localStart}
              disabledBefore={todayStr}
              onSelect={handleStartPick}
              onPrev={() => {
                const d = new Date(startView.year, startView.month - 1, 1);
                setStartView({ year: d.getFullYear(), month: d.getMonth() });
              }}
              onNext={() => {
                const d = new Date(startView.year, startView.month + 1, 1);
                setStartView({ year: d.getFullYear(), month: d.getMonth() });
              }}
              onMonthSelect={(y, m) => setStartView({ year: y, month: m })}
            />
          </div>

          {/* Return */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Return
            </div>
            <MonthCalendar
              year={endView.year}
              month={endView.month}
              selected={localEnd}
              disabledBefore={localStart}
              onSelect={handleEndPick}
              onPrev={() => {
                const d = new Date(endView.year, endView.month - 1, 1);
                setEndView({ year: d.getFullYear(), month: d.getMonth() });
              }}
              onNext={() => {
                const d = new Date(endView.year, endView.month + 1, 1);
                setEndView({ year: d.getFullYear(), month: d.getMonth() });
              }}
              onMonthSelect={(y, m) => setEndView({ year: y, month: m })}
            />
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: 20 }}>
          <button
            onClick={() => onDone(localStart, localEnd)}
            style={{
              width: '100%', height: 54,
              background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`,
              border: 'none', borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 0.2,
              boxShadow: '0 4px 24px rgba(59,130,246,.35)',
            }}
          >
            <span className="ms" style={{ fontSize: 20 }}>check</span>
            Done
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ── MonthCalendar ─────────────────────────────────────────────

interface MonthCalendarProps {
  year: number;
  month: number;       // 0-indexed
  selected: string;    // ISO "YYYY-MM-DD"
  disabledBefore: string | null;
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onMonthSelect: (year: number, month: number) => void;
}

function MonthCalendar({
  year, month, selected, disabledBefore,
  onSelect, onPrev, onNext, onMonthSelect,
}: MonthCalendarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayIso();

  // Build cells: nulls for empty leading slots, then day numbers
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  // Build dropdown months: current month up to 18 months ahead
  const today = new Date();
  const dropdownOptions: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    dropdownOptions.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  const isPrevDisabled = (() => {
    const prevMonth = new Date(year, month - 1, 1);
    return prevMonth < new Date(today.getFullYear(), today.getMonth(), 1);
  })();

  return (
    <div>
      {/* Month navigation header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, position: 'relative',
      }}>
        {/* Prev arrow */}
        <button
          onClick={onPrev}
          disabled={isPrevDisabled}
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(255,255,255,.05)',
            border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isPrevDisabled ? 'default' : 'pointer',
            opacity: isPrevDisabled ? 0.3 : 1,
          }}
        >
          <span className="ms" style={{ fontSize: 18, color: TEXT3 }}>chevron_left</span>
        </button>

        {/* Month/year label — clickable to open dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: dropdownOpen ? PRIMARY_BG : 'rgba(255,255,255,.05)',
              border: `1px solid ${dropdownOpen ? PRIMARY_BORDER : BORDER}`,
              borderRadius: 10, padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            <span style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 14, fontWeight: 700, color: TEXT1,
            }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <span className="ms" style={{
              fontSize: 16, color: TEXT3,
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform .2s ease',
            }}>
              expand_more
            </span>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              background: '#1a2133',
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              boxShadow: '0 8px 32px rgba(0,0,0,.6)',
              minWidth: 180,
              maxHeight: 220,
              overflowY: 'auto',
              padding: '6px 0',
            }}>
              {dropdownOptions.map(opt => {
                const isActive = opt.year === year && opt.month === month;
                return (
                  <button
                    key={`${opt.year}-${opt.month}`}
                    onClick={() => {
                      onMonthSelect(opt.year, opt.month);
                      setDropdownOpen(false);
                    }}
                    style={{
                      width: '100%', padding: '9px 16px',
                      textAlign: 'left',
                      background: isActive ? PRIMARY_BG : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13, fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#93c5fd' : TEXT1,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Next arrow */}
        <button
          onClick={onNext}
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(255,255,255,.05)',
            border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span className="ms" style={{ fontSize: 18, color: TEXT3 }}>chevron_right</span>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        marginBottom: 6,
      }}>
        {DAY_HEADERS.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontSize: 11, fontWeight: 700, color: TEXT3,
            fontFamily: 'Inter, sans-serif',
            padding: '4px 0',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3,
      }}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} />;
          }

          const iso = toIso(year, month, day);
          const isSelected = iso === selected;
          const isToday = iso === todayStr;
          const isDisabled = disabledBefore !== null && iso < disabledBefore;

          return (
            <button
              key={iso}
              onClick={() => !isDisabled && onSelect(iso)}
              disabled={isDisabled}
              style={{
                aspectRatio: '1',
                borderRadius: 10,
                background: isSelected ? PRIMARY_BG : 'transparent',
                border: isSelected
                  ? `1.5px solid ${PRIMARY_BORDER}`
                  : isToday
                    ? `1px dashed rgba(255,255,255,.2)`
                    : '1.5px solid transparent',
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: isDisabled ? 0.25 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .12s ease',
              }}
            >
              <span style={{
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: 14, fontWeight: isSelected ? 800 : 500,
                color: isSelected ? TEXT1 : isToday ? '#93c5fd' : 'rgba(255,255,255,.6)',
                lineHeight: 1,
              }}>
                {day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
