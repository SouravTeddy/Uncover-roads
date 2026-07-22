import type { ReelFinaleCard } from './types';

interface Props {
  card: ReelFinaleCard;
  active: boolean;
}

export function ReelFinaleCard({ card, active }: Props) {
  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 36px 96px',
    }}>
      {/* Gold glow at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 280,
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,168,83,.07) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Check ring */}
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        border: '1px solid rgba(212,168,83,.3)',
        background: 'rgba(212,168,83,.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
        animation: active ? 'fadeUp .4s both' : 'none',
      }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
          stroke="#d4a853" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <p style={{
        fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase',
        color: 'var(--color-text-4)', fontWeight: 500, marginBottom: 12,
        animation: active ? 'fadeUp .4s .08s both' : 'none',
      }}>
        Your trip is saved
      </p>

      <h2 style={{
        fontFamily: 'var(--font-heading)', fontSize: 54, fontWeight: 700,
        color: 'var(--color-text-1)',
        textAlign: 'center', lineHeight: 1.0, marginBottom: 20,
        animation: active ? 'fadeUp .4s .16s both' : 'none',
      }}>
        {card.city ?? 'Your trip'}.
      </h2>

      <p style={{
        fontSize: 13, color: 'var(--color-text-3)', marginBottom: 48,
        animation: active ? 'fadeUp .4s .22s both' : 'none',
      }}>
        {card.totalStops} stops
      </p>

      {card.googleMapsUrl && (
        <a
          href={card.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%',
            background: 'var(--color-primary)',
            border: 'none', borderRadius: 14,
            padding: '17px 20px',
            fontSize: 14, fontWeight: 500,
            color: '#1a1209',
            textDecoration: 'none',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '.1px',
            animation: active ? 'fadeUp .4s .3s both' : 'none',
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke="#1a1209" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Open full route in Maps
        </a>
      )}
    </div>
  );
}
