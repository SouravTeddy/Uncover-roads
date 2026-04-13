export function DayShimmer() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: 'rgba(255,255,255,.06)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 10,
            height: 76,
            animation: 'dayShimmerPulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,.06)',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                width: '60%', height: 14, borderRadius: 6,
                background: 'rgba(255,255,255,.08)', marginBottom: 6,
              }} />
              <div style={{
                width: '40%', height: 11, borderRadius: 6,
                background: 'rgba(255,255,255,.06)',
              }} />
            </div>
            <div style={{
              width: 48, height: 24, borderRadius: 6,
              background: 'rgba(255,255,255,.06)',
            }} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes dayShimmerPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}
