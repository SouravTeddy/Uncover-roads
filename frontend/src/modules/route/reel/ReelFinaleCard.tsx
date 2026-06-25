import { useEffect, useRef, useState } from 'react';
import type { ReelFinaleCard } from './types';

interface Props {
  card: ReelFinaleCard;
  active: boolean;
  onSave: () => void;
  saved: boolean;
}

const CONFETTI_COLORS = ['#d4a853', '#5a8a60', '#4a7fa0', '#8878b8', '#a06070'];

export function ReelFinaleCard({ card, active, onSave, saved }: Props) {
  const confettiRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!active || animating) return;
    setAnimating(true);
    if (!confettiRef.current) return;
    const wrap = confettiRef.current;
    wrap.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div');
      const size = 6 + Math.random() * 8;
      el.style.cssText = `
        position:absolute; top:-20px;
        left:${Math.random() * 100}%;
        width:${size}px; height:${size}px;
        background:${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
        border-radius:${Math.random() > .5 ? '50%' : '2px'};
        opacity:${0.7 + Math.random() * .3};
        animation: confetti ${1.2 + Math.random() * 1.5}s ${Math.random() * .5}s linear forwards;
      `;
      wrap.appendChild(el);
    }
  }, [active]);

  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
    }}>
      <div ref={confettiRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />

      <span className="ms fill" style={{ fontSize: 64, color: '#facc15', filter: 'drop-shadow(0 0 20px rgba(250,204,21,.5))', animation: active ? 'bounceIn .5s cubic-bezier(.16,1,.3,1) both' : 'none', marginBottom: 16 }}>
        star
      </span>

      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 700, color: 'var(--color-text-1)', textAlign: 'center', marginBottom: 8, animation: active ? 'fadeUp .5s .15s both' : 'none' }}>
        {card.city ?? 'Your trip'} awaits
      </h2>

      <p style={{ fontSize: 15, color: 'var(--color-text-3)', marginBottom: 40, animation: active ? 'fadeUp .5s .25s both' : 'none' }}>
        {card.totalStops} stops, all yours
      </p>

      {saved ? (
        <div
          style={{
            width: '100%', padding: '16px 20px', borderRadius: 16,
            background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.3)',
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            animation: active ? 'fadeUp .5s .35s both' : 'none',
          }}
        >
          <span className="ms fill" style={{ fontSize: 30, color: '#4ade80', flexShrink: 0 }}>check_circle</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', margin: 0, marginBottom: 2 }}>Saved to trips</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0 }}>Come back to it any time</p>
          </div>
        </div>
      ) : (
        <button
          onClick={onSave}
          style={{
            width: '100%', height: 54, borderRadius: 16, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #d4a853, #b8893a)',
            color: '#fff',
            fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 6px 28px rgba(212,168,83,.25)',
            marginBottom: 16,
            animation: active ? 'fadeUp .5s .35s both' : 'none',
          }}
        >
          <span className="ms fill" style={{ fontSize: 18 }}>bookmark_add</span>
          Save trip
        </button>
      )}

      {card.googleMapsUrl && (
        <a
          href={card.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '100%', padding: '12px 0', borderRadius: 14,
            border: '1px solid var(--color-border-m)',
            background: 'var(--color-surface)',
            fontSize: 15, fontWeight: 600, color: 'var(--color-text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            textDecoration: 'none',
            animation: active ? 'fadeUp .5s .45s both' : 'none',
          }}
        >
          <span className="ms" style={{ fontSize: 17, color: '#4285f4' }}>map</span>
          Open all stops in Google Maps
        </a>
      )}
    </div>
  );
}
