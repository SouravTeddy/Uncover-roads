interface Props {
  status: 'idle' | 'loading' | 'zoomed-out';
}

export function MapStatusIndicator({ status }: Props) {
  if (status === 'idle') return null;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 h-8 rounded-full"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 7.5rem)',
        zIndex: 1000,
        background: 'rgba(15,20,30,.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,.14)',
        pointerEvents: 'none',
      }}
    >
      {status === 'loading' ? (
        <>
          <span
            className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white/90 animate-spin"
            style={{ flexShrink: 0 }}
          />
          <span className="text-white/80 text-xs font-semibold">Loading places…</span>
        </>
      ) : (
        <>
          <span className="ms fill text-white/50" style={{ fontSize: 14 }}>zoom_in</span>
          <span className="text-white/60 text-xs font-semibold">Zoom in to see places</span>
        </>
      )}
    </div>
  );
}
