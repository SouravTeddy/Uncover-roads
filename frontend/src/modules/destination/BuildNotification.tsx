import { useAppStore } from '../../shared/store';
import type { ActiveBuild } from '../../shared/types';

interface Props { activeBuild: ActiveBuild | null }

export function BuildNotification({ activeBuild }: Props) {
  const { dispatch } = useAppStore();

  if (!activeBuild) return null;

  const isActive  = activeBuild.status === 'pending' || activeBuild.status === 'running';
  const isDone    = activeBuild.status === 'done';
  const isFailed  = activeBuild.status === 'failed';

  const base: React.CSSProperties = {
    margin: '0 16px 12px',
    borderRadius: 14,
    padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
  };

  if (isActive) {
    return (
      <>
        <style>{`@keyframes buildPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }`}</style>
        <div style={{ ...base, background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', animation: 'buildPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
              Building your {activeBuild.cityName} plan
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Explore while we work — we'll notify you when done
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isDone) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => dispatch({ type: 'GO_TO', screen: 'itinerary-reel' })}
        onKeyDown={e => e.key === 'Enter' && dispatch({ type: 'GO_TO', screen: 'itinerary-reel' })}
        style={{
          ...base,
          background: 'linear-gradient(135deg, rgba(107,148,112,0.12), rgba(79,143,171,0.08))',
          border: '1px solid rgba(107,148,112,0.3)',
          cursor: 'pointer',
        }}
      >
        <span className="material-symbols-outlined" style={{ color: '#6b9470', fontSize: 20, flexShrink: 0 }}>auto_awesome</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            Your {activeBuild.cityName} plan is ready ✦
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Tap to open
          </div>
        </div>
        <span className="material-symbols-outlined" style={{ color: '#6b9470', fontSize: 18 }}>chevron_right</span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
        onKeyDown={e => e.key === 'Enter' && dispatch({ type: 'CLEAR_ACTIVE_BUILD' })}
        style={{ ...base, background: 'rgba(180,60,60,0.06)', border: '1px solid rgba(180,60,60,0.2)', cursor: 'pointer' }}
      >
        <span className="material-symbols-outlined" style={{ color: '#c87070', fontSize: 20, flexShrink: 0 }}>error_outline</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#c87070' }}>Plan build failed</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>Tap to dismiss, then retry from Map</div>
        </div>
      </div>
    );
  }

  return null;
}
