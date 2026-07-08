import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import { api } from './api';

const POLL_MS = 5_000;
const STALE_MS = 10 * 60 * 1000; // 10 minutes — consider build stalled

export function useBuildStatus(): void {
  const { state, dispatch } = useAppStore();
  const { activeBuild } = state;
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const isActive = activeBuild?.status === 'pending' || activeBuild?.status === 'running';
    if (!activeBuild || !isActive) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await api.engineItinerary.status(activeBuild.id);
        if (res.status === 'done' && res.result) {
          dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: res.result });
          dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'done' } });
        } else if (res.status === 'failed') {
          dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'failed' } });
        } else {
          // Check for stale running build (dyno may have restarted)
          const updatedAt = new Date(res.updatedAt).getTime();
          if (Date.now() - updatedAt > STALE_MS && res.status === 'running') {
            dispatch({ type: 'CLEAR_ACTIVE_BUILD' });
          }
        }
      } catch {
        // Ignore transient network errors — keep polling
      }
    };

    poll(); // Immediate first poll (catches app-reopen case)
    intervalRef.current = window.setInterval(poll, POLL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeBuild?.id, activeBuild?.status]); // eslint-disable-line react-hooks/exhaustive-deps
}
