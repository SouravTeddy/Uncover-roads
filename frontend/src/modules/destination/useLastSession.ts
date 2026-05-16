import { useState } from 'react';
import type { Place } from '../../shared/types';

export interface LastSession {
  places: Place[];
  city: string;
  savedAt: string;
}

const STORAGE_KEY = 'uncover:lastSession';
const MAX_AGE_DAYS = 30;

function readSession(): LastSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: LastSession = JSON.parse(raw);
    const savedAt = new Date(data.savedAt).getTime();
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (savedAt < cutoff) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(places: Place[], city: string): void {
  const data: LastSession = { places, city, savedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useLastSession() {
  const [session, setSession] = useState<LastSession | null>(() => readSession());

  function saveSessionHook(places: Place[], city: string): void {
    saveSession(places, city);
    setSession(readSession());
  }

  function clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }

  return { session, saveSession: saveSessionHook, clearSession };
}
