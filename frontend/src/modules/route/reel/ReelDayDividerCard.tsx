import type { ReelDayDividerCard as ReelDayDividerCardType } from './types';
import {
  DIVIDER_BG, DIVIDER_GHOST_FS, DIVIDER_CITY_FS, DIVIDER_DATE_FS, DIVIDER_LINE_W,
} from './reel-constants';

interface Props {
  card: ReelDayDividerCardType;
}

function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDividerDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return isoDate;
  }
}

export function ReelDayDividerCard({ card }: Props) {
  if (card.isWrapUp) {
    return (
      <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: DIVIDER_BG }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 300px 400px at 50% 60%, rgba(120,80,200,.1), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(0,0,0,.6), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', zIndex: 5 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 16 }}>
            Day {card.day} · {card.city}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 44, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: 14, textAlign: 'center' }}>
            That's a wrap.
          </div>
          <div style={{ height: 1, width: DIVIDER_LINE_W, background: 'rgba(255,255,255,.12)', marginBottom: 14 }} />
          <div style={{ fontSize: 12, color: 'var(--color-text-3)', textAlign: 'center' }}>
            {card.stopCount} stop{card.stopCount !== 1 ? 's' : ''} · {card.startTime && fmt12h(card.startTime)}{card.startTime && card.endTime ? ' → ' : ''}{card.endTime && fmt12h(card.endTime)}
          </div>
          {card.nextCity && (
            <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="ms" style={{ fontSize: 13 }}>flight_takeoff</span>
              Next up: {card.nextCity}
            </div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', zIndex: 8 }}>
          <span className="ms" style={{ fontSize: 17, color: 'rgba(255,255,255,.18)' }}>swipe_up</span>
        </div>
      </div>
    );
  }

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: DIVIDER_BG }}>

      {/* Subtle radial accent */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 300px 400px at 50% 40%, rgba(79,143,171,.12), transparent)', pointerEvents: 'none' }} />

      {/* Top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, rgba(0,0,0,.4), transparent)', pointerEvents: 'none' }} />

      {/* Bottom scrim */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(0,0,0,.6), transparent)', pointerEvents: 'none' }} />

      {/* Centered content */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', zIndex: 5 }}>
        <div style={{ fontSize: DIVIDER_DATE_FS, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--color-sky, #4f8fab)', opacity: 0.7, marginBottom: 12 }}>
          {formatDividerDate(card.date)}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: DIVIDER_GHOST_FS, fontWeight: 700, color: 'rgba(255,255,255,.06)', lineHeight: 1, marginBottom: -8 }}>
          {card.day}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: DIVIDER_CITY_FS, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 10 }}>
          {card.city}
        </div>
        <div style={{ height: 1, width: DIVIDER_LINE_W, background: 'rgba(79,143,171,.4)', marginBottom: 10 }} />
        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
          {card.stopCount} stops
        </div>
        {(card.startTime || card.endTime) && (
          <div style={{ fontSize: 10, color: 'var(--color-text-4)', marginTop: 4 }}>
            {card.startTime && fmt12h(card.startTime)}
            {card.startTime && card.endTime && ' → '}
            {card.endTime && fmt12h(card.endTime)}
          </div>
        )}
      </div>

      {/* Swipe hint */}
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', zIndex: 8 }}>
        <span className="ms" style={{ fontSize: 17, color: 'rgba(255,255,255,.18)' }}>swipe_up</span>
      </div>
    </div>
  );
}
