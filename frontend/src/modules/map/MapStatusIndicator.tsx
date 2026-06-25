interface Props {
  status: 'idle' | 'loading' | 'zoomed-out';
}

export function MapStatusIndicator({ status }: Props) {
  if (status === 'idle') return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%', transform: 'translateX(-50%)',
        top: 'calc(env(safe-area-inset-top, 0px) + 7.5rem)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', height: 32, borderRadius: 999,
        background: 'var(--color-surface)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--color-border-m)',
        boxShadow: '0 2px 12px rgba(0,0,0,.12)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {status === 'loading' ? (
        <>
          <span
            style={{
              width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
              border: '2px solid var(--color-border-m)',
              borderTopColor: 'var(--color-primary)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>Loading places…</span>
        </>
      ) : (
        <>
          <span className="ms fill" style={{ fontSize: 14, color: 'var(--color-text-3)' }}>zoom_in</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)' }}>Zoom in to see places</span>
        </>
      )}
    </div>
  );
}
