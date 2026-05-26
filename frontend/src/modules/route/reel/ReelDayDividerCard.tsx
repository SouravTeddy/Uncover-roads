import type { ReelDayDividerCard as ReelDayDividerCardType } from './types';
import {
  DIVIDER_BG, DIVIDER_GHOST_FS, DIVIDER_CITY_FS, DIVIDER_DATE_FS, DIVIDER_LINE_W,
  todGradient,
} from './reel-constants';

interface Props {
  card: ReelDayDividerCardType;
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
  const hour = new Date().getHours();

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: DIVIDER_BG }}>

      {/* City texture overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 200px 300px at 50% 40%,rgba(79,143,171,.07),transparent)', pointerEvents: 'none' }} />

      {/* Top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom,rgba(0,0,0,.5),transparent)', pointerEvents: 'none' }} />

      {/* ToD gradient z-index:4 */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGradient(hour), pointerEvents: 'none' }} />

      {/* Horizon scrim z-index:4 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top,rgba(0,0,0,.88),transparent)', zIndex: 4, pointerEvents: 'none' }} />

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
      </div>

      {/* Swipe hint */}
      <div style={{ position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center', zIndex: 8 }}>
        <span className="ms" style={{ fontSize: 17, color: 'rgba(255,255,255,.18)' }}>swipe_up</span>
      </div>
    </div>
  );
}
