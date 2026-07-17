import { useEffect, useRef } from 'react';
import { useAppStore } from './store';
import { api } from './api';
import { loadUserProfile, syncSavedItinerary } from './userSync';
import { supabase } from './supabase';

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
        if (res.status === 'done') {
          const itinerary = res.result as import('./types').EngineItinerary | null;
          if (itinerary) {
            dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary });
            // Auto-save: clear stale reel reference, then save new trip immediately
            dispatch({ type: 'SET_REEL_SAVED_ID', id: null });
            const savedId = `reel-${Date.now()}`;
            const savedEntry: import('./types').SavedItinerary = {
              id: savedId,
              city: itinerary.city ?? itinerary.cities?.[0] ?? state.city ?? activeBuild.cityName ?? '',
              date: new Date().toISOString(),
              travelDate: state.travelStartDate ?? null,
              cityLat: state.cityGeo?.lat ?? null,
              cityLon: state.cityGeo?.lon ?? null,
              selectedPlaces: state.selectedPlaces,
              itinerary: itinerary as unknown as import('./types').Itinerary,
              persona: state.persona ?? { archetype: 'explorer', archetype_name: 'Explorer' } as import('./types').Persona,
              lastUpdateCheck: null,
              pendingSwapCards: [],
              journeyLegs: state.journey ?? null,
              tripDetails: state.pendingTripDetails ?? null,
            };
            dispatch({ type: 'SAVE_ITINERARY', saved: savedEntry });
            dispatch({ type: 'SET_REEL_SAVED_ID', id: savedId });
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) syncSavedItinerary(user.id, savedEntry).catch(() => {});
            });
          }
          dispatch({ type: 'CLEAR_ACTIVE_BUILD' });
          // Re-read generation count so profile screen stays in sync.
          // Small delay ensures the increment RPC has propagated before we read.
          setTimeout(() => {
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (!user) return;
              loadUserProfile(user.id).then(profile => {
                if (profile) {
                  dispatch({ type: 'SET_GENERATION_COUNT', count: profile.generationCount });
                  dispatch({ type: 'SET_USER_TIER', tier: profile.tier });
                }
              }).catch(() => {});
            });
          }, 1500);
        } else if (res.status === 'failed') {
          dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'failed' } });
        } else {
          // Check for stale running build (dyno may have restarted mid-build)
          const updatedAt = new Date(res.updatedAt).getTime();
          if (Date.now() - updatedAt > STALE_MS && res.status === 'running') {
            // Mark failed so user sees a clear signal and can retry
            // Backend /start will clean up the orphaned DB row on next attempt
            dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'failed' } });
          }
        }
      } catch (err: unknown) {
        // 404 means build row gone (server restart wiped memory or wrong ID) — treat as failed
        if ((err as { status?: number }).status === 404) {
          dispatch({ type: 'SET_ACTIVE_BUILD', build: { ...activeBuild, status: 'failed' } });
        }
        // Other errors: transient network — keep polling
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
