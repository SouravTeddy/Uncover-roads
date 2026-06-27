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

      {/* Save action — icon tap, not a button */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', marginBottom: 36, animation: active ? 'fadeUp .5s .35s both' : 'none' }}>
        <button
          onClick={saved ? undefined : onSave}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: saved ? 'default' : 'pointer', padding: 0,
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: saved ? 'rgba(74,222,128,.12)' : 'rgba(212,168,83,.12)',
            border: `1px solid ${saved ? 'rgba(74,222,128,.28)' : 'rgba(212,168,83,.28)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="ms fill" style={{ fontSize: 22, color: saved ? '#4ade80' : '#d4a853' }}>
              {saved ? 'bookmark' : 'bookmark_add'}
            </span>
          </div>
          <span style={{ fontSize: 11, color: saved ? '#4ade80' : 'var(--color-text-3)', fontWeight: 500 }}>
            {saved ? 'Saved' : 'Save trip'}
          </span>
        </button>

        {card.googleMapsUrl && (
          <a
            href={card.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'rgba(66,133,244,.1)',
              border: '1px solid rgba(66,133,244,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms" style={{ fontSize: 22, color: '#4285f4' }}>map</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 500 }}>Open in Maps</span>
          </a>
        )}
      </div>
    </div>
  );
}
