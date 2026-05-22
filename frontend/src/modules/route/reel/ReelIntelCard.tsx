import type { ReelIntelCard } from './types';

interface Props { card: ReelIntelCard; active: boolean }

const TYPE_CFG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  swap:       { icon: 'compare_arrows', color: '#4a7fa0', bg: 'rgba(74,127,160,.1)',   label: 'Changed for you' },
  insert:     { icon: 'add_circle',     color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', label: 'Added for you' },
  resequence: { icon: 'sort',           color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', label: 'Rearranged' },
  weather:    { icon: 'wb_sunny',       color: '#d4a853', bg: 'rgba(212,168,83,.1)',  label: 'Weather' },
  transit:    { icon: 'directions_transit', color: '#4a7fa0', bg: 'rgba(74,127,160,.1)', label: 'Getting there' },
  advisory:   { icon: 'info',           color: '#a08d80', bg: 'rgba(160,141,128,.1)', label: 'Heads up' },
  evening:    { icon: 'nightlight',     color: '#7c6f9f', bg: 'rgba(124,111,159,.1)', label: 'Evening' },
  culture:    { icon: 'museum',         color: '#8b9e6a', bg: 'rgba(139,158,106,.1)', label: 'Culture' },
  event:      { icon: 'event',          color: '#d4a853', bg: 'rgba(212,168,83,.1)',  label: 'Local event' },
};

export function ReelIntelCard({ card, active }: Props) {
  const cfg = TYPE_CFG[card.messageType] ?? TYPE_CFG.advisory;

  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '0 22px 88px',
      overflow: 'hidden',
    }}>

      {/* Subtle top-left glow */}
      <div style={{
        position: 'absolute', top: -60, left: -60,
        width: 300, height: 300, borderRadius: '50%',
        background: `radial-gradient(circle, ${cfg.bg} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Type badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '6px 12px', borderRadius: 10,
        background: cfg.bg,
        border: `1px solid ${cfg.color}28`,
        marginBottom: 18, alignSelf: 'flex-start',
        animation: active ? 'fadeUp .45s .05s both' : 'none',
      }}>
        <span className="ms fill" style={{ fontSize: 14, color: cfg.color }}>{cfg.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: cfg.color }}>{cfg.label}</span>
      </div>

      {/* Headline */}
      <p style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 28, fontWeight: 600,
        color: 'var(--color-text-1)',
        lineHeight: 1.2, marginBottom: 10,
        animation: active ? 'fadeUp .45s .12s both' : 'none',
      }}>
        {card.headline}
      </p>

      {/* Detail */}
      <p style={{
        fontSize: 14, color: 'var(--color-text-2)',
        lineHeight: 1.6, marginBottom: 20,
        animation: active ? 'fadeUp .45s .2s both' : 'none',
      }}>
        {card.detail}
      </p>

      {/* Divider line */}
      <div style={{
        height: 1, background: 'var(--color-border)',
        animation: active ? 'fadeUp .45s .28s both' : 'none',
      }} />
    </div>
  );
}
