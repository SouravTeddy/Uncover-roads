import type { ReelTransitCard } from './types';

interface Props { card: ReelTransitCard; active: boolean; }

const MODE_ICONS: Record<string, string> = {
  flight: 'flight', train: 'train', drive: 'directions_car', bus: 'directions_bus',
};

export function ReelTransitCard({ card }: Props) {
  const icon = MODE_ICONS[card.mode] ?? 'directions_transit';

  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh',
      background: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 32px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, width: '100%', maxWidth: 280 }}>
        <div style={{ flex: 1, height: 1, borderTop: '1.5px dashed rgba(212,168,83,.35)' }} />
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(74,127,160,.12)', border: '1px solid rgba(74,127,160,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms fill" style={{ fontSize: 22, color: '#4a7fa0' }}>{icon}</span>
        </div>
        <div style={{ flex: 1, height: 1, borderTop: '1.5px dashed rgba(212,168,83,.35)' }} />
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 8 }}>
        Now travelling to
      </p>

      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--color-text-1)', textAlign: 'center', marginBottom: 20 }}>
        {card.to}
      </h2>

      <div style={{ display: 'flex', gap: 10 }}>
        {card.durationMinutes != null && (
          <span style={{ padding: '5px 12px', borderRadius: 999, background: 'rgba(74,127,160,.12)', border: '1px solid rgba(74,127,160,.28)', fontSize: 12, color: '#4a7fa0', fontWeight: 600 }}>
            {card.durationMinutes >= 60
              ? `${Math.floor(card.durationMinutes / 60)}h ${card.durationMinutes % 60}m`
              : `${card.durationMinutes}m`}
          </span>
        )}
        {card.distanceKm != null && (
          <span style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-2)', fontWeight: 600 }}>
            {card.distanceKm} km
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 16, fontStyle: 'italic' }}>
        Swipe to continue to {card.to}
      </p>
    </div>
  );
}
