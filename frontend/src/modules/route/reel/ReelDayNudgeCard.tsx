import type { ReelDayNudgeCard as ReelDayNudgeCardType } from './types';

interface Props {
  card: ReelDayNudgeCardType;
  onExplore: () => void;
}

export function ReelDayNudgeCard({ card, onExplore }: Props) {
  return (
    <div
      className="reel-card"
      style={{
        width: '100%',
        height: '100dvh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0c0d0e',
        overflow: 'hidden',
      }}
    >
      {/* Soft ambient glow */}
      <div style={{
        position: 'absolute',
        width: 320,
        height: 320,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', padding: '0 40px', maxWidth: 320 }}>
        <span className="ms fill" style={{ fontSize: 36, color: 'rgba(212,168,83,0.5)', display: 'block', marginBottom: 20 }}>
          add_circle
        </span>

        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 22,
          fontWeight: 600,
          color: 'rgba(245,240,234,0.85)',
          margin: '0 0 10px',
          lineHeight: 1.3,
        }}>
          Your day has room
        </p>

        <p style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.4)',
          margin: '0 0 32px',
          lineHeight: 1.5,
        }}>
          Tap to add more places in {card.city}
        </p>

        <button
          onClick={onExplore}
          style={{
            padding: '13px 28px',
            borderRadius: 12,
            border: '1px solid rgba(212,168,83,0.35)',
            background: 'rgba(212,168,83,0.1)',
            color: '#d4a853',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
        >
          Explore map →
        </button>
      </div>
    </div>
  );
}
