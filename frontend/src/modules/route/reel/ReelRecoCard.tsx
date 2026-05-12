import type { ReelRecoCard } from './types';

interface Props {
  card: ReelRecoCard;
  active: boolean;
}

export function ReelRecoCard({ card }: Props) {
  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0c0c0e, #0c1020)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '0 22px 88px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.18)', padding: '7px 12px', borderRadius: 10 }}>
        <span className="ms" style={{ fontSize: 15, color: '#38bdf8' }}>near_me</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>Near your next stop</span>
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>
        While you&apos;re here
      </p>
      <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{card.label}</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 20 }}>{card.consequence}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['Best match', 'Near route', 'Open now'].map(tag => (
          <span key={tag} style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(167,139,250,.12)', border: '1px solid rgba(167,139,250,.22)', fontSize: 12, fontWeight: 600, color: 'rgba(167,139,250,.9)' }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
