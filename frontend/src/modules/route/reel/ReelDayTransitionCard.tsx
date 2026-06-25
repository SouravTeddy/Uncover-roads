import { useEffect, useState } from 'react';
import type { ReelDayTransitionCard as ReelDayTransitionCardType } from './types';

interface Props {
  card: ReelDayTransitionCardType;
  active: boolean;
}

// ── Tokens ────────────────────────────────────────────────────
const T = {
  bg:       'var(--color-bg)',
  gold:     'var(--color-primary)',
  goldBg:   'var(--color-primary-bg)',
  goldBdr:  'var(--color-primary-glow)',
  sky:      '#4f8fab',
  skyBg:    'rgba(79,143,171,0.10)',
  skyBdr:   'rgba(79,143,171,0.22)',
  text1:    'var(--color-text-1)',
  text2:    'var(--color-text-2)',
  text3:    'var(--color-text-3)',
  line:     'var(--color-border)',
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

function dayNarrative(prevCity: string, prevStopCount: number, prevStartTime: string | null, prevEndTime: string | null): string {
  const stops = `${prevStopCount} stop${prevStopCount !== 1 ? 's' : ''}`;
  if (prevStartTime && prevEndTime) {
    const [sh, sm] = prevStartTime.split(':').map(Number);
    const [eh, em] = prevEndTime.split(':').map(Number);
    const durMin = (eh * 60 + em) - (sh * 60 + sm);
    if (durMin > 0) {
      const h = Math.floor(durMin / 60);
      const m = durMin % 60;
      const durStr = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
      return `${stops} across ${prevCity} — ${durStr} on the ground.`;
    }
  }
  return `${stops} across ${prevCity}.`;
}

function fmtDur(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}


export function ReelDayTransitionCard({ card, active }: Props) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setOn(true), 80);
      return () => clearTimeout(t);
    } else {
      setOn(false);
    }
  }, [active]);

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

  // Compact same-day city hop card — no full-screen day recap
  if (card.sameDay) {
    return (
      <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: T.bg }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 300px 400px at 50% 50%, rgba(79,143,171,.06), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', gap: 0 }}>

          <div style={{ ...fade('0s'), textAlign: 'center', marginBottom: 28 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: T.text3, marginBottom: 4 }}>
              Continuing today →
            </p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 600, color: T.text1, lineHeight: 1.0, margin: 0 }}>
              {card.nextCity}
            </p>
          </div>

          {/* Transit pill */}
          <div style={{ ...fade('.1s'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {modeIcon && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 24,
                background: T.skyBg, border: `1px solid ${T.skyBdr}`,
              }}>
                <span className="ms" style={{ fontSize: 16, color: T.sky }}>{modeIcon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text1 }}>{modeLabel}</span>
                {(durLabel || distLabel) && (
                  <span style={{ fontSize: 12, color: T.text3 }}>
                    {[card.transitIsEstimated ? '~' : '', durLabel, distLabel].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            )}
            {hasTimes && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.sky }}>{fmt12h(card.transitDepartureTime!)}</span>
                <span className="ms" style={{ fontSize: 12, color: T.text3 }}>arrow_forward</span>
                <span style={{ fontSize: 13, color: T.sky }}>{fmt12h(card.transitArrivalTime!)}</span>
              </div>
            )}
            {card.transitRef && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 8, background: 'rgba(0,0,0,.35)', border: `1px solid ${T.line}` }}>
                <span className="ms" style={{ fontSize: 11, color: T.text3 }}>confirmation_number</span>
                <span style={{ fontSize: 11, color: T.text2 }}>{card.transitRef}</span>
              </div>
            )}
          </div>

          <div style={{ ...fade('.2s'), marginTop: 28, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: T.goldBg, border: `1px solid ${T.goldBdr}` }}>
              <span className="ms" style={{ fontSize: 12, color: T.gold }}>schedule</span>
              <span style={{ fontSize: 11, color: T.gold }}>
                {card.nextStopCount} stop{card.nextStopCount !== 1 ? 's' : ''}
                {card.nextStartTime ? ` · arrives ${fmt12h(card.nextStartTime)}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', zIndex: 8 }}>
          <span className="ms" style={{ fontSize: 16, color: 'rgba(255,255,255,.15)' }}>swipe_up</span>
        </div>
      </div>
    );
  }

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
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 600, color: T.text1, lineHeight: 1.05, marginBottom: 8 }}>
            {card.prevCity}
          </p>
          <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.5, marginBottom: 0 }}>
            {dayNarrative(card.prevCity, card.prevStopCount, card.prevStartTime, card.prevEndTime)}
          </p>
        </div>

        {/* ── TRANSIT connector ──────────────────────────── */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '28px 0', ...fade('.1s') }}>
          {card.isCityChange ? (
            <>
              {/* Line above */}
              <div style={{ width: 1, height: 20, background: T.line, marginBottom: 10 }} />
              {/* Mode chip — only when transit mode is known */}
              {modeIcon && (
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
              )}
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

          {/* Day distance bar */}
          {(card.nextDayWalkKm > 0 || card.nextDayRideKm > 0) && (
            <div style={{ display: 'flex', marginTop: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.07)', width: '100%', maxWidth: 280 }}>
              {card.nextDayWalkKm > 0 && (
                <div style={{ flex: 1, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(79,143,171,.06)', borderRight: card.nextDayRideKm > 0 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(79,143,171,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="ms fill" style={{ fontSize: 13, color: T.sky }}>directions_walk</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: T.text3, marginBottom: 1 }}>On foot</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>{card.nextDayWalkKm} km</div>
                  </div>
                </div>
              )}
              {card.nextDayRideKm > 0 && (
                <div style={{ flex: 1, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(180,180,220,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="ms fill" style={{ fontSize: 13, color: 'rgba(180,180,220,.55)' }}>directions_car</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: T.text3, marginBottom: 1 }}>By ride</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>{card.nextDayRideKm} km</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Swipe hint */}
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', zIndex: 8 }}>
        <span className="ms" style={{ fontSize: 16, color: 'rgba(255,255,255,.15)' }}>swipe_up</span>
      </div>

    </div>
  );
}
