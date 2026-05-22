import { useEffect, useState } from 'react';
import type { ReelIntroCard } from './types';

interface Props {
  card: ReelIntroCard;
  active: boolean;
}

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.5) 62%, rgba(0,0,0,.88) 82%, rgba(0,0,0,.97) 100%)';

export function ReelIntroCard({ card, active }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
  }, [active]);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      {card.imageUrl
        ? <img src={card.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0c0c0e, #1a1420)' }} />
      }
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 88px' }}>
        <p style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.55)', marginBottom: 8,
          animation: visible ? 'fadeUp .5s .05s both' : 'none',
        }}>Your day</p>

        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 48, fontWeight: 700,
          color: '#fff', lineHeight: 1, marginBottom: 16,
          animation: visible ? 'fadeUp .5s .15s both' : 'none',
        }}>{card.city}</h1>

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
          animation: visible ? 'fadeUp .5s .28s both' : 'none',
        }}>
          {[
            { icon: 'place', label: `${card.totalStops} stops` },
            { icon: 'wb_sunny', label: card.weather?.condition ?? 'Weather loading' },
            { icon: 'person', label: card.persona },
          ].map(pill => (
            <span key={pill.label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999,
              border: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.08)',
            }}>
              <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{pill.icon}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{pill.label}</span>
            </span>
          ))}
        </div>

        {card.proTip && (
          <p style={{
            fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6,
            animation: visible ? 'fadeUp .5s .38s both' : 'none',
          }}>{card.proTip}</p>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <span className="ms" style={{ fontSize: 20, color: 'rgba(255,255,255,.35)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
