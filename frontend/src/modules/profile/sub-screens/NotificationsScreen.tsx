import { useAppStore } from '../../../shared/store';
import type { NotifPrefs } from '../../../shared/types';

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
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={onBack}><span className="ms text-xl text-text-3">arrow_back</span></button>
        <span className="font-heading font-bold text-text-1 text-lg">Notifications</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        <div className="rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,.03)' }}>
          {rows.map((row, i) => (
            <div
              key={row.key}
              className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-white/6' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white/70 text-sm font-medium">{row.label}</p>
                  {row.locked && <span className="ms fill text-white/30 text-sm">lock</span>}
                </div>
                <p className="text-white/25 text-xs mt-0.5">{row.sublabel}</p>
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
                  style={{ left: notifPrefs[row.key] && !row.locked ? '22px' : '2px' }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
