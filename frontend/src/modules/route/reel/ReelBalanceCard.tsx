import type { ReelBalanceCard as ReelBalanceCardData } from './types';

interface Props {
  card: ReelBalanceCardData;
  active: boolean;
}

export function ReelBalanceCard({ card, active }: Props) {
  return (
    <div
      className="reel-card"
      style={{
        position: 'relative', width: '100%', height: '100dvh',
        background: 'linear-gradient(160deg, #0d1117 0%, #111820 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px',
        opacity: active ? 1 : 0.85,
        transition: 'opacity .3s ease',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(107,148,112,.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <span className="ms fill" style={{ fontSize: 48, color: '#6b9470', marginBottom: 20 }}>
        check_circle
      </span>

      <p style={{
        fontSize: 22, fontWeight: 700, color: '#fff',
        textAlign: 'center', lineHeight: 1.3, marginBottom: 12,
      }}>
        {card.message}
      </p>

      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,.45)',
        textAlign: 'center', lineHeight: 1.6,
      }}>
        No gaps worth flagging for a {card.persona} today.
      </p>
    </div>
  );
}
