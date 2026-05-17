import type { ItineraryStop } from '../../shared/types';

export function DayStops({ stops }: { stops: ItineraryStop[] }) {
  return (
    <>
      {stops.map((stop, stopIdx) => (
        <div
          key={stopIdx}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms" style={{ fontSize: 17, color: 'var(--color-primary)' }}>place</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2,
              }}>
                {stop.time && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--color-sky)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {stop.time}
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)',
                marginBottom: stop.tip ? 4 : 0,
              }}>
                {stop.place}
              </div>
              {stop.tip && (
                <div style={{
                  fontSize: 12, color: 'var(--color-text-3)',
                  fontFamily: 'var(--font-sans)', lineHeight: 1.5,
                }}>
                  {stop.tip}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
