import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import type { ActiveBuild } from '../../shared/types';

interface Props { activeBuild: ActiveBuild | null }

function useCountdown(startedAt: number | null): string {
  const TOTAL_MS = 3 * 60 * 1000;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (startedAt == null) return;
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const id = window.setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (startedAt == null) return '';
  const remaining = Math.max(0, TOTAL_MS - elapsed);
  if (remaining <= 60_000) return 'Finishing up';
  const mins = Math.ceil(remaining / 60_000);
  return `~${mins}m`;
}

export function BuildNotification({ activeBuild }: Props) {
  const { dispatch } = useAppStore();
  const countdown = useCountdown(activeBuild?.startedAt ?? null);

  if (!activeBuild) return null;

  const isActive = activeBuild.status === 'pending' || activeBuild.status === 'running';
  const isDone   = activeBuild.status === 'done';
  const isFailed = activeBuild.status === 'failed';

  const outer: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 55,
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
    paddingBottom: '6px',
    paddingLeft: '14px',
    paddingRight: '14px',
    pointerEvents: 'none',
  };

  const card: React.CSSProperties = {
    borderRadius: 20,
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'auto',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  };

  if (isActive) {
    return (
      <>
        <style>{`@keyframes buildPulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
        <div style={outer}>
          <div style={{ ...card, background: 'rgba(14,18,28,0.88)', border: '1px solid rgba(212,168,83,0.28)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-primary)', animation: 'buildPulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Building your plan{countdown ? ` · ${countdown}` : ''}
            </span>
            <button
              onClick={() => dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 17, lineHeight: 1, padding: '2px 6px', flexShrink: 0 }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      </>
    );
  }

  if (isDone) {
    return (
      <div style={outer}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
            dispatch({ type: 'CLEAR_ACTIVE_BUILD' });
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
              dispatch({ type: 'CLEAR_ACTIVE_BUILD' });
            }
          }}
          style={{ ...card, background: 'rgba(14,18,28,0.88)', border: '1px solid rgba(107,148,112,0.4)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>✦</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#8fc49a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Your plan is ready
          </span>
          <span style={{ fontSize: 14, color: '#6b9470', flexShrink: 0 }}>→</span>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div style={outer}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
          onKeyDown={e => e.key === 'Enter' && dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
          style={{ ...card, background: 'rgba(14,18,28,0.88)', border: '1px solid rgba(180,60,60,0.3)', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 13, flexShrink: 0 }}>⚠</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#c87070' }}>Build failed · tap to dismiss</span>
        </div>
      </div>
    );
  }

  return null;
}
