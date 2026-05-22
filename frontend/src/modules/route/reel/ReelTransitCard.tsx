import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../../shared/store';
import type { ReelTransitCard } from './types';

interface Props { card: ReelTransitCard; active: boolean }

const MODE_CFG: Record<string, { icon: string; label: string; color: string; glow: string }> = {
  flight: { icon: 'flight',          label: 'Flying',   color: '#4a7fa0', glow: 'rgba(74,127,160,.13)' },
  train:  { icon: 'train',           label: 'By train', color: '#7c6f9f', glow: 'rgba(124,111,159,.13)' },
  drive:  { icon: 'directions_car',  label: 'Driving',  color: '#8b9e6a', glow: 'rgba(139,158,106,.13)' },
  bus:    { icon: 'directions_bus',  label: 'By bus',   color: '#c27c4a', glow: 'rgba(194,124,74,.13)' },
};

function fmtDur(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function parseDepArr(dep: string, arr: string): number | null {
  const [dh, dm] = dep.split(':').map(Number);
  const [ah, am] = arr.split(':').map(Number);
  if ([dh, dm, ah, am].some(isNaN)) return null;
  let diff = (ah * 60 + am) - (dh * 60 + dm);
  if (diff < 0) diff += 24 * 60; // next-day arrival
  return diff;
}

export function ReelTransitCard({ card, active }: Props) {
  const { dispatch } = useAppStore();
  const [on, setOn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dep, setDep] = useState('');
  const [arr, setArr] = useState('');
  const [ref, setRef] = useState('');
  const cfg = MODE_CFG[card.mode] ?? MODE_CFG.flight;
  const PATH_LEN = 200;

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setOn(true), 100);
      return () => clearTimeout(t);
    } else {
      setOn(false);
    }
  }, [active]);

  const handleSaveDetails = useCallback(() => {
    const dur = parseDepArr(dep, arr);
    if (!dur) return;
    dispatch({
      type: 'SET_TRANSIT_DETAILS',
      from: card.from,
      to: card.to,
      departureTime: dep,
      arrivalTime: arr,
      durationMinutes: dur,
      transitRef: ref || undefined,
    });
    setSheetOpen(false);
  }, [dep, arr, ref, card.from, card.to, dispatch]);

  const fade = (delay: string, extra?: React.CSSProperties): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity .5s ${delay} ease`,
    ...extra,
  });

  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', padding: '0 32px',
    }}>

      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        pointerEvents: 'none',
      }} />

      {/* Radial glow centred on mode icon */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 68%)`,
        ...fade('0s'),
        pointerEvents: 'none',
      }} />

      {/* FROM → animated path → TO */}
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center',
        marginBottom: 38,
        opacity: on ? 1 : 0,
        transform: on ? 'translateY(0)' : 'translateY(-10px)',
        transition: 'opacity .55s .1s ease, transform .55s .1s ease',
      }}>
        {/* FROM city */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 3 }}>From</p>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1.1 }}>{card.from}</p>
        </div>

        {/* SVG path */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px', position: 'relative' }}>
          <svg width="100%" height="38" viewBox="0 0 100 38" preserveAspectRatio="none" overflow="visible">
            {/* base dashed */}
            <line x1="0" y1="19" x2="100" y2="19"
              stroke="rgba(255,255,255,.07)" strokeWidth="1.5" strokeDasharray="4 4" />
            {/* animated draw */}
            <line x1="0" y1="19" x2="100" y2="19"
              stroke={cfg.color} strokeWidth="1.5"
              strokeDasharray={PATH_LEN}
              strokeDashoffset={on ? 0 : PATH_LEN}
              style={{ transition: `stroke-dashoffset 1.2s .3s cubic-bezier(.4,0,.2,1)` }}
            />
            {/* centre badge */}
            <circle cx="50" cy="19" r="12"
              fill="var(--color-bg)" stroke={cfg.color} strokeWidth="1.5"
              opacity={on ? 1 : 0}
              style={{ transition: 'opacity .35s .85s ease' }}
            />
          </svg>
          {/* Mode icon overlaid on badge */}
          <span className="ms fill" style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 13, color: cfg.color,
            ...fade('.9s'),
          }}>{cfg.icon}</span>
        </div>

        {/* TO city */}
        <div style={{ flex: 1, textAlign: 'right' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 3 }}>To</p>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1.1 }}>{card.to}</p>
        </div>
      </div>

      {/* Departure → Arrival (actual only) */}
      {!card.isEstimated && card.departureTime && card.arrivalTime && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 20,
          ...fade('.72s'),
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 2 }}>Departs</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--color-text-1)' }}>{card.departureTime}</p>
          </div>
          <div style={{ width: 28, height: 1, background: 'var(--color-border-m)', position: 'relative' }}>
            <div style={{ position: 'absolute', right: -4, top: -3, width: 7, height: 7, borderTop: '1px solid var(--color-border-m)', borderRight: '1px solid var(--color-border-m)', transform: 'rotate(45deg)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 2 }}>Arrives</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--color-text-1)' }}>{card.arrivalTime}</p>
          </div>
        </div>
      )}

      {/* Duration */}
      <div style={{
        textAlign: 'center', marginBottom: 24,
        opacity: on ? 1 : 0,
        transform: on ? 'scale(1)' : 'scale(.86)',
        transition: 'opacity .5s .68s ease, transform .5s .68s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-4)', marginBottom: 8 }}>
          {card.isEstimated ? 'Estimated journey' : 'Journey time'}
        </p>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 54, fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1 }}>
          {card.isEstimated && (
            <span style={{ fontSize: 26, color: 'var(--color-primary)', opacity: 0.65, verticalAlign: 'super', marginRight: 2 }}>~</span>
          )}
          {card.durationMinutes != null ? fmtDur(card.durationMinutes) : '—'}
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: cfg.color, marginTop: 6 }}>
          {cfg.label}
          {card.ref && <span style={{ color: 'var(--color-text-3)', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>{card.ref}</span>}
        </p>
      </div>

      {/* Pills */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center', ...fade('1s') }}>
        {card.distanceKm != null && (
          <span style={{ padding: '5px 13px', borderRadius: 999, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)' }}>
            {card.distanceKm} km
          </span>
        )}
        {card.isEstimated ? (
          <span style={{ padding: '5px 13px', borderRadius: 999, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary-glow)', fontSize: 11, fontWeight: 600, color: 'var(--color-primary-text)' }}>
            Add trip details for exact times
          </span>
        ) : (
          <span style={{ padding: '5px 13px', borderRadius: 999, background: 'rgba(74,210,149,.07)', border: '1px solid rgba(74,210,149,.18)', fontSize: 11, fontWeight: 600, color: 'rgba(74,210,149,.85)' }}>
            From your trip details
          </span>
        )}
      </div>

      {/* Add details CTA (estimated only) */}
      {card.isEstimated && (
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            position: 'absolute', bottom: 72,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 999,
            background: 'var(--color-surface)', border: '1px solid var(--color-border-m)',
            cursor: 'pointer', pointerEvents: 'all',
            ...fade('1.1s'),
          }}
        >
          <span className="ms" style={{ fontSize: 15, color: 'var(--color-primary)' }}>add</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>Add {card.from} → {card.to} details</span>
        </button>
      )}

      {/* Swipe hint */}
      <p style={{ position: 'absolute', bottom: 36, fontSize: 11, color: 'var(--color-text-4)', fontStyle: 'italic', ...fade('1.2s') }}>
        Swipe to start {card.to}
      </p>

      {/* Transit details sheet */}
      {sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', borderRadius: '20px 20px 0 0',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderBottom: 'none',
              padding: '20px 20px 40px',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-m)', margin: '0 auto 20px' }} />
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>
              {card.from} → {card.to}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 20 }}>
              Add your actual {card.mode === 'flight' ? 'flight' : card.mode === 'train' ? 'train' : 'travel'} details
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
                  Departure
                </label>
                <input
                  type="time"
                  value={dep}
                  onChange={e => setDep(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--color-bg)', border: '1px solid var(--color-border-m)',
                    color: 'var(--color-text-1)', fontSize: 15, fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
                  Arrival
                </label>
                <input
                  type="time"
                  value={arr}
                  onChange={e => setArr(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'var(--color-bg)', border: '1px solid var(--color-border-m)',
                    color: 'var(--color-text-1)', fontSize: 15, fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
                {card.mode === 'flight' ? 'Flight number' : card.mode === 'train' ? 'Train / service' : 'Reference'} (optional)
              </label>
              <input
                type="text"
                value={ref}
                onChange={e => setRef(e.target.value)}
                placeholder={card.mode === 'flight' ? 'e.g. BA2551' : card.mode === 'train' ? 'e.g. Eurostar' : 'e.g. Your rental'}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  background: 'var(--color-bg)', border: '1px solid var(--color-border-m)',
                  color: 'var(--color-text-1)', fontSize: 14, fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleSaveDetails}
              disabled={!dep || !arr}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: dep && arr ? 'var(--color-primary)' : 'var(--color-surface2)',
                color: dep && arr ? '#0f0d0c' : 'var(--color-text-4)',
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                cursor: dep && arr ? 'pointer' : 'default',
                transition: 'background .2s ease, color .2s ease',
              }}
            >
              Save details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
