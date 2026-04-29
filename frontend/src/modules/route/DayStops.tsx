import type { ItineraryStop } from '../../shared/types';

export function DayStops({ stops }: { stops: ItineraryStop[] }) {
  return (
    <>
      {stops.map((stop, stopIdx) => (
        <div
          key={stopIdx}
          style={{
            background: '#141921',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(59,130,246,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms" style={{ fontSize: 17, color: '#3b82f6' }}>place</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2,
              }}>
                {stop.time && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#93c5fd',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {stop.time}
                  </span>
                )}
              </div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 15, fontWeight: 700, color: '#f1f5f9',
                marginBottom: stop.tip ? 4 : 0,
              }}>
                {stop.place}
              </div>
              {stop.tip && (
                <div style={{
                  fontSize: 12, color: '#8e9099',
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
