export function DayShimmer() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="shimmer"
          style={{
            background: 'var(--color-surface)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
            height: 76,
            animationDelay: `${i * 0.2}s`,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              className="shimmer"
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'var(--color-surface2)',
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                className="shimmer"
                style={{
                  width: '60%', height: 14, borderRadius: 6,
                  background: 'var(--color-surface2)', marginBottom: 6,
                }}
              />
              <div
                className="shimmer"
                style={{
                  width: '40%', height: 11, borderRadius: 6,
                  background: 'var(--color-surface2)',
                }}
              />
            </div>
            <div
              className="shimmer"
              style={{
                width: 48, height: 24, borderRadius: 6,
                background: 'var(--color-surface2)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
