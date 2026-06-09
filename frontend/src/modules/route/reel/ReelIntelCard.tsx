import { useEffect, useState } from 'react';
import type { ReelIntelCard } from './types';
import { ReelImg } from './ReelImg';

interface Props { card: ReelIntelCard; active: boolean }

const TYPE_CFG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  swap:       { icon: 'compare_arrows', color: '#4a7fa0', bg: 'rgba(74,127,160,.15)',   label: 'Changed for you' },
  insert:     { icon: 'add_circle',     color: '#8b9e6a', bg: 'rgba(139,158,106,.15)', label: 'Added for you' },
  resequence: { icon: 'sort',           color: '#b59fe0', bg: 'rgba(181,159,224,.15)', label: 'Rearranged' },
  weather:    { icon: 'wb_sunny',       color: '#d4a853', bg: 'rgba(212,168,83,.15)',  label: 'Weather' },
  transit:    { icon: 'directions_transit', color: '#4a7fa0', bg: 'rgba(74,127,160,.15)', label: 'Getting there' },
  advisory:   { icon: 'info',           color: '#c0a080', bg: 'rgba(192,160,128,.15)', label: 'Heads up' },
  evening:    { icon: 'nightlight',     color: '#b59fe0', bg: 'rgba(181,159,224,.15)', label: 'Evening' },
  culture:    { icon: 'museum',         color: '#8b9e6a', bg: 'rgba(139,158,106,.15)', label: 'Culture' },
  event:      { icon: 'event',          color: '#d4a853', bg: 'rgba(212,168,83,.15)',  label: 'Local event' },
};

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,.12) 0%, rgba(0,0,0,.55) 40%, rgba(0,0,0,.92) 75%, rgba(0,0,0,.98) 100%)';

export function ReelIntelCard({ card, active }: Props) {
  const cfg = TYPE_CFG[card.messageType] ?? TYPE_CFG.advisory;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [active]);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      {card.imageUrl
        ? <ReelImg src={card.imageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.5) saturate(0.65)' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg, #0e0c14, #121820)' }} />
      }
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      {/* Coloured glow accent */}
      <div style={{
        position: 'absolute', top: -80, left: -80,
        width: 320, height: 320, borderRadius: '50%',
        background: `radial-gradient(circle, ${cfg.bg} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px calc(88px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', borderRadius: 10,
          background: cfg.bg, border: `1px solid ${cfg.color}44`,
          backdropFilter: 'blur(8px)', marginBottom: 18,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity .4s .05s, transform .4s .05s',
        }}>
          <span className="ms fill" style={{ fontSize: 14, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: cfg.color }}>{cfg.label}</span>
        </div>

        <p className="reel-h2" style={{
          fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 700,
          color: '#fff', lineHeight: 1.2, marginBottom: 12,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity .4s .12s, transform .4s .12s',
        }}>
          {card.headline}
        </p>

        <p className="reel-meta" style={{
          fontSize: 14, color: 'rgba(255,255,255,.72)', lineHeight: 1.65,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity .4s .2s, transform .4s .2s',
        }}>
          {card.detail}
        </p>
      </div>
    </div>
  );
}
