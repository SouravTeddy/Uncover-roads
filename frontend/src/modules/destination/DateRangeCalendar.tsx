import { useState, useEffect, useRef } from 'react';

interface Props {
  city?: string | null;
  onSelect: (startDate: string, endDate: string) => void;
  onClose: () => void;
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start === end) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function DateRangeCalendar({ city, onSelect, onClose }: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endDate && footerRef.current) {
      footerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [endDate]);

  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function handleDayClick(day: number) {
    const iso = toIso(viewYear, viewMonth, day);
    if (iso < todayIso) return;
    if (!startDate || (startDate && endDate)) {
      setStartDate(iso);
      setEndDate(null);
    } else {
      const s = iso < startDate ? iso : startDate;
      const e = iso < startDate ? startDate : iso;
      setEndDate(e);
      setStartDate(s);
      // onSelect fires eagerly on second-date click (not Done tap).
      // Parent uses this to persist dates to state reactively;
      // onClose (called by Done) handles navigation/collapse.
      onSelect(s, e);
    }
  }

  function isInRange(iso: string): boolean {
    if (!startDate) return false;
    const ref = endDate ?? hoverDate;
    if (!ref) return false;
    const [lo, hi] = startDate < ref ? [startDate, ref] : [ref, startDate];
    return iso > lo && iso < hi;
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div
      className="mx-4 rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Prompt copy */}
      <div className="px-4 pt-4 pb-2">
        {city && (
          <p
            className="text-[var(--color-primary)] font-semibold mb-0.5"
            style={{ fontSize: 18, fontFamily: 'var(--font-heading, Georgia, serif)', animation: 'calCitySlide 0.35s cubic-bezier(.16,1,.3,1) both' }}
          >
            {city}
          </p>
        )}
        <style>{`@keyframes calCitySlide { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:none; } }`}</style>
        <p className="text-xs text-[var(--color-text-3)] leading-relaxed">
          {city ? `When are you heading there?` : 'When are you going?'}{' '}
          <span className="text-[var(--color-text-2)]">We use this to check events, weather and opening days.</span>
        </p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => {
            if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
            else setViewMonth(m => m - 1);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-3)]"
          style={{ background: 'var(--color-surface2)' }}
        >
          <span className="ms text-sm">chevron_left</span>
        </button>
        <span className="text-sm font-semibold text-[var(--color-text-1)]">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={() => {
            if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
            else setViewMonth(m => m + 1);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-3)]"
          style={{ background: 'var(--color-surface2)' }}
        >
          <span className="ms text-sm">chevron_right</span>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--color-text-4)] py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-3 pb-4 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const iso = toIso(viewYear, viewMonth, day);
          const isPast = iso < todayIso;
          const isStart = iso === startDate;
          const isEnd = iso === endDate;
          const inRange = isInRange(iso);
          return (
            <button
              key={iso}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoverDate(iso)}
              onMouseLeave={() => setHoverDate(null)}
              disabled={isPast}
              className="h-9 flex items-center justify-center text-sm font-medium rounded-full transition-colors"
              style={{
                background: (isStart || isEnd)
                  ? 'var(--color-primary)'
                  : inRange
                  ? 'var(--color-primary-bg)'
                  : 'transparent',
                color: (isStart || isEnd)
                  ? '#fff'
                  : isPast
                  ? 'var(--color-text-4)'
                  : 'var(--color-text-1)',
                opacity: isPast ? 0.4 : 1,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Range summary + Done */}
      {startDate && (
        <div ref={footerRef} className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-divider)]">
          <span className="text-sm text-[var(--color-text-2)]">
            {endDate ? formatRange(startDate, endDate) : formatRange(startDate, startDate)}
          </span>
          {endDate && (
            <button
              onClick={onClose}
              className="text-xs font-semibold text-[var(--color-primary)] px-3 py-1.5 rounded-full"
              style={{ background: 'var(--color-primary-bg)' }}
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
