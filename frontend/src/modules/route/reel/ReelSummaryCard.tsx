import type { ReelSummaryCard } from './types';

interface Props {
  card: ReelSummaryCard;
  active: boolean;
}

const CHANGE_LABELS: Record<string, string> = {
  swap:        'Swapped something out for you',
  insert:      'Slipped something in',
  resequence:  'Rearranged the order',
  weather:     'Worked around the weather',
  transit:     'Accounted for getting around',
  advisory:    'Noted something important',
  event:       'Worked around a local event',
};

const CHANGE_ICONS: Record<string, string> = {
  swap:        'swap_horiz',
  insert:      'add_circle',
  resequence:  'swap_vert',
  weather:     'wb_cloudy',
  transit:     'directions_transit',
  advisory:    'info',
  event:       'event',
};

export function ReelSummaryCard({ card }: Props) {
  const { totalDays, totalStops, engineChanges } = card;

  return (
    <div
      className="reel-card"
      style={{
        position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden',
        background: 'var(--color-bg)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {/* Subtle texture */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 20%, rgba(212,168,83,.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(212,168,83,.04) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '0 28px 88px', position: 'relative' }}>

        {/* Label */}
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--color-primary)', marginBottom: 14,
        }}>
          Before you go
        </p>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 28,
        }}>
          {[
            { value: totalDays, label: totalDays === 1 ? 'day' : 'days' },
            { value: totalStops, label: totalStops === 1 ? 'stop' : 'stops' },
          ].map(({ value, label }) => (
            <div key={label} style={{
              flex: 1, background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 16, padding: '16px 18px',
            }}>
              <div style={{
                fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 500,
                color: 'var(--color-text-1)', lineHeight: 1,
              }}>
                {value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Engine changes */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-3)', letterSpacing: '.04em' }}>
              We shaped a few things to fit you better
            </p>
            <span className="ms" style={{ fontSize: 14, color: 'var(--color-primary)', opacity: .7 }}>auto_fix_high</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {engineChanges.map(({ type, count }) => (
              <div key={type} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <span className="ms" style={{ fontSize: 16, color: 'var(--color-primary)', opacity: .75 }}>
                  {CHANGE_ICONS[type] ?? 'tune'}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-2)' }}>
                  {CHANGE_LABELS[type] ?? type}
                </span>
                {count > 1 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: 'var(--color-primary)', background: 'rgba(212,168,83,.1)',
                    borderRadius: 99, padding: '2px 7px',
                  }}>
                    ×{count}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Swipe hint */}
        <p style={{
          fontSize: 11, color: 'var(--color-text-4)', textAlign: 'center',
          marginTop: 20,
        }}>
          It's ready when you are
        </p>
      </div>
    </div>
  );
}
