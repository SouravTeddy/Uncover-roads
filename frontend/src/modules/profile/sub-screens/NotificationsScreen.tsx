import { useAppStore } from '../../../shared/store';
import type { NotifPrefs } from '../../../shared/types';

const TOGGLE_ON_LEFT = '22px';
const TOGGLE_OFF_LEFT = '2px';

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useAppStore();
  const { notifPrefs, userTier } = state;

  function toggle(key: keyof NotifPrefs) {
    if (key === 'liveEventAlerts' && userTier === 'free') {
      dispatch({ type: 'GO_TO', screen: 'subscription' });
      return;
    }
    dispatch({ type: 'SET_NOTIF_PREFS', prefs: { [key]: !notifPrefs[key] } });
  }

  const rows: { key: keyof NotifPrefs; label: string; sublabel: string; locked?: boolean }[] = [
    { key: 'tripReminders', label: 'Trip reminders', sublabel: 'Day before a saved trip' },
    { key: 'destinationSuggestions', label: 'Destination suggestions', sublabel: 'New places matching your persona' },
    { key: 'liveEventAlerts', label: 'Live event alerts', sublabel: 'Events during your trip', locked: userTier === 'free' },
    { key: 'appUpdates', label: 'App updates', sublabel: 'Announcements & new features' },
  ];

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col" style={{ zIndex: 20 }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
        <button
          className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
          onClick={onBack}
        >
          <span className="ms text-[var(--color-text-2)]">arrow_back</span>
        </button>
        <h2 className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)]">
          Notifications
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        {/* Settings card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] overflow-hidden">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center gap-3 px-4 py-4 border-b border-[var(--color-divider)] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] text-[var(--color-text-1)] font-medium">{row.label}</p>
                  {row.locked && <span className="ms fill text-[var(--color-text-3)] text-sm">lock</span>}
                </div>
                <p className="text-[12px] text-[var(--color-text-3)] mt-0.5">{row.sublabel}</p>
              </div>
              <button
                onClick={() => toggle(row.key)}
                className="flex-shrink-0 w-11 h-6 rounded-full transition-all relative"
                style={{
                  background: row.locked
                    ? 'rgba(255,255,255,.08)'
                    : notifPrefs[row.key] ? '#f97316' : 'rgba(255,255,255,.12)',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: notifPrefs[row.key] && !row.locked ? TOGGLE_ON_LEFT : TOGGLE_OFF_LEFT }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
