import { useEffect, useRef, useState } from 'react';
import type { ReelFinaleCard } from './types';

interface Props {
  card: ReelFinaleCard;
  active: boolean;
  onSave: () => void;
  saved: boolean;
}

const CONFETTI_COLORS = ['#e07854', '#5a8a60', '#4a7fa0', '#8878b8', '#a06070'];

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

      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 8, animation: active ? 'fadeUp .5s .15s both' : 'none' }}>
        {card.city}, done.
      </h2>

      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 40, animation: active ? 'fadeUp .5s .25s both' : 'none' }}>
        {card.totalStops} stops · Saved to your trips
      </p>

      <button
        onClick={onSave}
        style={{
          width: '100%', height: 54, borderRadius: 16, border: 'none', cursor: 'pointer',
          background: saved ? '#16a34a' : 'linear-gradient(135deg, #e07854, #c4613d)',
          color: '#fff',
          fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: saved ? '0 4px 20px rgba(22,163,74,.3)' : '0 6px 28px rgba(224,120,84,.25)',
          transition: 'background .3s ease, box-shadow .3s ease',
          marginBottom: 12,
          animation: active ? 'fadeUp .5s .35s both' : 'none',
        }}
      >
        <span className="ms fill" style={{ fontSize: 18 }}>{saved ? 'check_circle' : 'bookmark_add'}</span>
        {saved ? 'Saved to trips' : 'Save trip'}
      </button>

      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>
        Find it in Saved Trips · Tap play to relive it
      </p>
    </div>
  );
}
