import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { generateDateStrip } from './trip-utils';
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

function formatDateShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  }); // "Apr 10"
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
  const dates = useMemo(() => generateDateStrip(21), []); // 3 weeks
  const [localStart, setLocalStart] = useState(initialStart ?? dates[0].isoDate);
  const [localEnd,   setLocalEnd]   = useState(initialEnd   ?? dates[0].isoDate);

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleStartPick(iso: string) {
    setLocalStart(iso);
    // If new start is after end, move end to match
    if (iso > localEnd) setLocalEnd(iso);
  }

  function handleEndPick(iso: string) {
    // Ignore dates before start
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
          zIndex: 56,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          position: 'relative',
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${BORDER}`,
          background: 'linear-gradient(135deg, rgba(59,130,246,.08) 0%, rgba(15,23,42,0) 60%)',
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
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Departure */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Departure
            </div>
            <DateStrip
              dates={dates}
              selected={localStart}
              disabledBefore={null}
              onSelect={handleStartPick}
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
            <DateStrip
              dates={dates}
              selected={localEnd}
              disabledBefore={localStart}
              onSelect={handleEndPick}
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

// ── DateStrip sub-component ────────────────────────────────────

interface DateStripProps {
  dates:          ReturnType<typeof generateDateStrip>;
  selected:       string;
  disabledBefore: string | null;
  onSelect:       (iso: string) => void;
}

function DateStrip({ dates, selected, disabledBefore, onSelect }: DateStripProps) {
  return (
    <div style={{
      display: 'flex', gap: 6,
      overflowX: 'auto', paddingBottom: 4,
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
    } as React.CSSProperties}>
      {dates.map((d) => {
        const active   = d.isoDate === selected;
        const disabled = disabledBefore !== null && d.isoDate < disabledBefore;
        return (
          <button
            key={d.isoDate}
            onClick={() => !disabled && onSelect(d.isoDate)}
            aria-label={`Select ${d.dayAbbr} ${d.dayNum}`}
            aria-pressed={active}
            disabled={disabled}
            style={{
              flexShrink: 0, width: 52,
              padding: '10px 4px 8px',
              background: active ? PRIMARY_BG : 'rgba(255,255,255,.04)',
              border: `1.5px solid ${active ? PRIMARY_BORDER : BORDER}`,
              borderRadius: 14, textAlign: 'center', cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.3 : 1,
              transition: 'all .15s ease',
            }}
          >
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: active ? '#93c5fd' : TEXT3,
              fontFamily: 'Inter, sans-serif', marginBottom: 4,
            }}>
              {d.dayAbbr.toUpperCase()}
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800, lineHeight: 1,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              color: active ? TEXT1 : 'rgba(255,255,255,.45)',
            }}>
              {d.dayNum}
            </div>
          </button>
        );
      })}
    </div>
  );
}
