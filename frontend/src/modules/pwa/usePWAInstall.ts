import { useEffect, useRef, useState } from 'react';

export const VISIT_KEY = 'ur_install_visits';
export const DISMISSED_KEY = 'ur_install_dismissed';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_VISITS = 3;

export function recordVisit() {
  const count = Number(localStorage.getItem(VISIT_KEY) ?? '0');
  localStorage.setItem(VISIT_KEY, String(count + 1));
}

export function shouldShowInstallPrompt(): boolean {
  const count = Number(localStorage.getItem(VISIT_KEY) ?? '0');
  if (count < MIN_VISITS) return false;

  const dismissed = localStorage.getItem(DISMISSED_KEY);
  if (dismissed && Date.now() - Number(dismissed) < SEVEN_DAYS_MS) return false;

  return true;
}

export function dismissInstallPrompt() {
  localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Only on Android/Chrome — no iOS
    if (!('onbeforeinstallprompt' in window)) return;

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    recordVisit();

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (shouldShowInstallPrompt()) {
        setCanPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function triggerInstall() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setCanPrompt(false);
    deferredPrompt.current = null;
  }

  function dismiss() {
    dismissInstallPrompt();
    setCanPrompt(false);
  }

  return { canPrompt, isInstalled, triggerInstall, dismiss };
}
