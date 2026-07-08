import { useAppStore } from '../../shared/store';
import type { ActiveBuild } from '../../shared/types';

interface Props { activeBuild: ActiveBuild | null }

export function BuildNotification({ activeBuild }: Props) {
  const { dispatch } = useAppStore();

  if (!activeBuild) return null;

  const isActive  = activeBuild.status === 'pending' || activeBuild.status === 'running';
  const isDone    = activeBuild.status === 'done';
  const isFailed  = activeBuild.status === 'failed';

  const outer: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '8px 16px',
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
    pointerEvents: 'none',
  };

  const card: React.CSSProperties = {
    borderRadius: 14,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    pointerEvents: 'auto',
    backdropFilter: 'blur(12px)',
  };

  if (isActive) {
    return (
      <>
        <style>{`@keyframes buildPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }`}</style>
        <div style={outer}>
          <div style={{ ...card, background: 'rgba(18,22,34,0.92)', border: '1px solid rgba(212,168,83,0.25)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', animation: 'buildPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', lineHeight: 1.3 }}>
                Building your {activeBuild.cityName} plan
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Explore while we work
              </div>
            </div>
            <button
              onClick={() => dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-secondary)', fontSize: 18, lineHeight: 1,
                padding: '4px 6px', borderRadius: 6, flexShrink: 0,
              }}
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
          onKeyDown={e => e.key === 'Enter' && (() => {
            dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
            dispatch({ type: 'CLEAR_ACTIVE_BUILD' });
          })()}
          style={{
            ...card,
            background: 'rgba(18,22,34,0.92)',
            border: '1px solid rgba(107,148,112,0.35)',
            cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ color: '#6b9470', fontSize: 18, flexShrink: 0 }}>auto_awesome</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              Your {activeBuild.cityName} plan is ready ✦
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Tap to open
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ color: '#6b9470', fontSize: 16 }}>chevron_right</span>
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
          style={{ ...card, background: 'rgba(18,22,34,0.92)', border: '1px solid rgba(180,60,60,0.3)', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ color: '#c87070', fontSize: 18, flexShrink: 0 }}>error_outline</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c87070', lineHeight: 1.3 }}>Plan build failed</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>Tap to dismiss, then retry from Map</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
