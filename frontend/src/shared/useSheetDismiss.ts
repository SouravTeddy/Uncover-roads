import { useEffect } from 'react';

// Priority 10 beats the default app-exit handler (priority 1).
// Works on Android hardware back button via Capacitor.
// On iOS there is no hardware back button, so this is a no-op there.
export function useSheetDismiss(onClose: () => void, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    let removeListener: (() => void) | null = null;

    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', onClose).then(handle => {
        removeListener = () => handle.remove();
      });
    }).catch(() => {
      // Not running in Capacitor (web dev) — fall back to browser History API
      window.history.pushState({ sheet: true }, '');
      const handler = (e: PopStateEvent) => {
        if (e.state?.sheet) return;
        onClose();
      };
      window.addEventListener('popstate', handler);
      removeListener = () => window.removeEventListener('popstate', handler);
    });

    return () => { removeListener?.(); };
  }, [isOpen, onClose]);
}
