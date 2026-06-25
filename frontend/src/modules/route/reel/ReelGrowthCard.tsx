import { useEffect, useRef } from 'react';
import type { ReelGrowthCard as ReelGrowthCardType } from './types';

interface Props {
  card: ReelGrowthCardType;
  active: boolean;
  onBrowse: () => void;
}

export function ReelGrowthCard({ card, active, onBrowse }: Props) {
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      lingerTimer.current = setTimeout(() => {}, 3000);
    } else {
      if (lingerTimer.current) clearTimeout(lingerTimer.current);
    }
    return () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); };
  }, [active]);

  return (
    <div className="reel-card" style={{
      width: '100%', height: '100dvh',
      background: '#0f0d0c',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(212,168,83,0.07) 0%, transparent 65%)',
      }} />

      {/* Icon */}
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(212,168,83,0.12)',
        border: '1px solid rgba(212,168,83,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
        opacity: active ? 1 : 0,
        transform: active ? 'scale(1)' : 'scale(0.85)',
        transition: 'opacity .45s .1s ease, transform .45s .1s ease',
      }}>
        <span className="ms fill" style={{ fontSize: 26, color: '#d4a853' }}>explore</span>
      </div>

      {/* Headline */}
      <h2 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 36, fontWeight: 600,
        color: '#f5f0ea', textAlign: 'center',
        lineHeight: 1.1, margin: 0, marginBottom: 14,
        textShadow: '0 1px 8px rgba(0,0,0,.6)',
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity .45s .2s ease, transform .45s .2s ease',
      }}>
        Room to grow
      </h2>

      {/* Body */}
      <p style={{
        fontSize: 15, color: 'rgba(255,255,255,0.55)',
        textAlign: 'center', lineHeight: 1.6,
        margin: 0, marginBottom: 36,
        maxWidth: 280,
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity .45s .3s ease, transform .45s .3s ease',
      }}>
        Your plan looks solid. Want to browse nearby places and fill any gaps?
      </p>

      {/* CTA */}
      <button
        onClick={onBrowse}
        style={{
          background: 'rgba(212,168,83,0.15)',
          border: '1px solid rgba(212,168,83,0.45)',
          borderRadius: 10,
          padding: '15px 32px',
          color: '#d4a853',
          fontSize: 15, fontWeight: 600,
          letterSpacing: '0.03em',
          cursor: 'pointer',
          opacity: active ? 1 : 0,
          transform: active ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity .45s .4s ease, transform .45s .4s ease',
        }}
      >
        Browse {card.lastCity} →
      </button>

      {/* Footer */}
      <p style={{
        position: 'absolute', bottom: 'calc(88px + env(safe-area-inset-bottom, 0px) + 12px)',
        fontSize: 11, color: 'rgba(255,255,255,0.18)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        margin: 0,
      }}>
        Opens map · {card.lastCity}
      </p>
    </div>
  );
}
