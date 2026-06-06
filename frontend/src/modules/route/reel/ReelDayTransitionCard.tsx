import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../../shared/store';
import type { ReelDayTransitionCard as ReelDayTransitionCardType } from './types';

interface Props {
  card: ReelDayTransitionCardType;
  active: boolean;
}

// ── Tokens ────────────────────────────────────────────────────
const T = {
  bg:       '#0f0d0c',
  gold:     '#d4a853',
  goldBg:   'rgba(212,168,83,0.10)',
  goldBdr:  'rgba(212,168,83,0.22)',
  sky:      '#4f8fab',
  skyBg:    'rgba(79,143,171,0.10)',
  skyBdr:   'rgba(79,143,171,0.22)',
  text1:    '#f5f0ea',
  text2:    'rgba(255,255,255,0.68)',
  text3:    'rgba(255,255,255,0.40)',
  line:     'rgba(255,255,255,0.10)',
};

const MODE_ICON: Record<string, string> = {
  flight: 'flight',
  train:  'train',
  drive:  'directions_car',
  bus:    'directions_bus',
  ferry:  'directions_boat',
};
const MODE_LABEL: Record<string, string> = {
  flight: 'Flight',
  train:  'Train',
  drive:  'Drive',
  bus:    'Coach',
  ferry:  'Ferry',
};

function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch { return iso; }
}

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
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function ReelDayTransitionCard({ card, active }: Props) {
  const { dispatch } = useAppStore();
  const [on, setOn]             = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dep, setDep]           = useState('');
  const [arr, setArr]           = useState('');
  const [ref, setRef]           = useState('');

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setOn(true), 80);
      return () => clearTimeout(t);
    } else {
      setOn(false);
    }
  }, [active]);

  const handleSaveDetails = useCallback(() => {
    const dur = parseDepArr(dep, arr);
    if (!dur || !card.isCityChange) return;
    dispatch({
      type: 'SET_TRANSIT_DETAILS',
      from: card.prevCity,
      to: card.nextCity,
      departureTime: dep,
      arrivalTime: arr,
      durationMinutes: dur,
      transitRef: ref || undefined,
    });
    setSheetOpen(false);
  }, [dep, arr, ref, card, dispatch]);

  const fade = (delay: string): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : 'translateY(8px)',
    transition: `opacity .45s ${delay} ease, transform .45s ${delay} ease`,
  });

  const modeIcon  = card.transitMode ? MODE_ICON[card.transitMode]  ?? 'directions_car' : null;
  const modeLabel = card.transitMode ? MODE_LABEL[card.transitMode] ?? 'Transit'        : null;
  const hasTimes  = !!(card.transitDepartureTime && card.transitArrivalTime);
  const durLabel  = card.transitDurationMin ? fmtDur(card.transitDurationMin) : null;
  const distLabel = card.transitDistanceKm  ? `${card.transitDistanceKm} km` : null;

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: T.bg }}>

      {/* Radial ambient glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 360px 500px at 50% 55%, rgba(79,143,171,.07), transparent)', pointerEvents: 'none' }} />

      {/* Vertical centre layout */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', gap: 0 }}>

        {/* ── PREVIOUS DAY recap ─────────────────────────── */}
        <div style={{ width: '100%', textAlign: 'center', ...fade('0s') }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: T.text3, marginBottom: 8 }}>
            Day {card.prevDay} · {fmtDate(card.prevDate)}
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 600, color: T.text1, lineHeight: 1.05, marginBottom: 6 }}>
            {card.prevCity}
          </p>
          <p style={{ fontSize: 12, color: T.text3, marginBottom: 0 }}>
            {card.prevStopCount} stop{card.prevStopCount !== 1 ? 's' : ''}
            {card.prevStartTime && card.prevEndTime
              ? ` · ${fmt12h(card.prevStartTime)} → ${fmt12h(card.prevEndTime)}`
              : card.prevStartTime ? ` · from ${fmt12h(card.prevStartTime)}` : ''}
          </p>
        </div>

        {/* ── TRANSIT connector ──────────────────────────── */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '28px 0', ...fade('.1s') }}>
          {card.isCityChange && modeIcon ? (
            <>
              {/* Line above */}
              <div style={{ width: 1, height: 20, background: T.line, marginBottom: 10 }} />
              {/* Mode chip */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 20,
                background: T.skyBg, border: `1px solid ${T.skyBdr}`,
              }}>
                <span className="ms" style={{ fontSize: 15, color: T.sky }}>{modeIcon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text1 }}>{modeLabel}</span>
                {(durLabel || distLabel) && (
                  <span style={{ fontSize: 11, color: T.text3 }}>
                    {[card.transitIsEstimated ? '~' : '', durLabel, distLabel].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              {/* Actual times */}
              {hasTimes && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: T.sky }}>{fmt12h(card.transitDepartureTime!)}</span>
                  <span className="ms" style={{ fontSize: 11, color: T.text3 }}>arrow_forward</span>
                  <span style={{ fontSize: 12, color: T.sky }}>{fmt12h(card.transitArrivalTime!)}</span>
                </div>
              )}
              {/* Ref */}
              {card.transitRef && (
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: 'rgba(0,0,0,.35)', border: `1px solid ${T.line}` }}>
                  <span className="ms" style={{ fontSize: 11, color: T.text3 }}>confirmation_number</span>
                  <span style={{ fontSize: 11, color: T.text2 }}>{card.transitRef}</span>
                </div>
              )}
              {/* Add details CTA (estimated + no times yet) */}
              {card.transitIsEstimated && !hasTimes && (
                <button
                  onClick={() => setSheetOpen(true)}
                  style={{
                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 99, border: `1px solid ${T.line}`,
                    background: 'rgba(0,0,0,.30)', cursor: 'pointer',
                    fontSize: 11, color: T.text3,
                  }}
                >
                  <span className="ms" style={{ fontSize: 12 }}>add</span>
                  Add journey details
                </button>
              )}
              {/* Line below */}
              <div style={{ width: 1, height: 20, background: T.line, marginTop: 10 }} />
            </>
          ) : (
            /* Same city — simple divider */
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              <div style={{ flex: 1, height: 1, background: T.line }} />
              <span className="ms" style={{ fontSize: 15, color: T.text3 }}>bedtime</span>
              <div style={{ flex: 1, height: 1, background: T.line }} />
            </div>
          )}
        </div>

        {/* ── NEXT DAY preview ───────────────────────────── */}
        <div style={{ width: '100%', textAlign: 'center', ...fade('.2s') }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: T.sky, opacity: 0.8, marginBottom: 8 }}>
            Day {card.nextDay} · {fmtDate(card.nextDate)}
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 600, color: T.text1, lineHeight: 1.0, marginBottom: 8 }}>
            {card.nextCity}
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}>
            <span className="ms" style={{ fontSize: 12, color: T.gold }}>schedule</span>
            <span style={{ fontSize: 11, color: T.gold }}>
              {card.nextStopCount} stop{card.nextStopCount !== 1 ? 's' : ''}
              {card.nextStartTime ? ` · starts ${fmt12h(card.nextStartTime)}` : ''}
            </span>
          </div>
        </div>

      </div>

      {/* Swipe hint */}
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', zIndex: 8 }}>
        <span className="ms" style={{ fontSize: 16, color: 'rgba(255,255,255,.15)' }}>swipe_up</span>
      </div>

      {/* Journey details sheet */}
      {sheetOpen && card.isCityChange && (
        <div
          onClick={() => setSheetOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', borderRadius: '20px 20px 0 0', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderBottom: 'none', padding: '20px 20px 40px' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-m)', margin: '0 auto 20px' }} />
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>
              {card.prevCity} → {card.nextCity}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 20 }}>
              Add your {modeLabel?.toLowerCase() ?? 'travel'} details
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {(['Departure', 'Arrival'] as const).map((label, i) => (
                <div key={label} style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>{label}</label>
                  <input type="time" value={i === 0 ? dep : arr} onChange={e => i === 0 ? setDep(e.target.value) : setArr(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border-m)', color: 'var(--color-text-1)', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
                {card.transitMode === 'flight' ? 'Flight number' : card.transitMode === 'train' ? 'Train / service' : 'Reference'} (optional)
              </label>
              <input type="text" value={ref} onChange={e => setRef(e.target.value)}
                placeholder={card.transitMode === 'flight' ? 'e.g. BA2551' : card.transitMode === 'train' ? 'e.g. Eurostar' : 'e.g. Reference'}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border-m)', color: 'var(--color-text-1)', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
            </div>
            <button
              onClick={handleSaveDetails}
              disabled={!dep || !arr}
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: dep && arr ? 'var(--color-primary)' : 'var(--color-surface2)', color: dep && arr ? '#0f0d0c' : 'var(--color-text-4)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, cursor: dep && arr ? 'pointer' : 'default', transition: 'background .2s ease, color .2s ease' }}
            >
              Save details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
