import type { ReelSummaryCard } from './types';

interface Props {
  card: ReelSummaryCard;
  active: boolean;
}

export function ReelSummaryCard({ card }: Props) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#0f0d0c', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ color: '#a09880', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
          Trip Summary
        </div>
        <div style={{ color: '#f5f0ea', fontSize: 38, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, lineHeight: 1.1 }}>
          {card.totalDays} Day{card.totalDays !== 1 ? 's' : ''} Planned
        </div>
        <div style={{ color: '#a09880', fontSize: 14, marginTop: 8 }}>
          {card.totalStops} stops · {card.persona.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
        </div>
      </div>

      {/* Intelligence items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {card.intelItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
              {item.icon}
            </div>
            <div style={{ paddingTop: 6 }}>
              <span style={{ color: '#f5f0ea', fontSize: 15, lineHeight: 1.4 }}>
                <span style={{ color: '#d4a853', fontWeight: 700 }}>{item.count} {item.label}</span>
                {' '}{item.detail}
              </span>
            </div>
          </div>
        ))}
        {card.intelItems.length === 0 && (
          <div style={{ color: '#a09880', fontSize: 14, fontStyle: 'italic' }}>
            Route optimized for your travel style.
          </div>
        )}
      </div>
    </div>
  );
}
