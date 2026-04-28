// modules/map/SimilarPins.tsx
import { useCallback } from 'react';
import type { ReferencePin } from '../../shared/types';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';

// ── Pure helper (exported for testing) ─────────────────────────────────────

export function buildConnectorLines(
  source: { lat: number; lon: number },
  targets: { id: string; lat: number; lon: number }[],
): { id: string; from: { lat: number; lon: number }; to: { lat: number; lon: number } }[] {
  return targets.map(t => ({ id: t.id, from: source, to: { lat: t.lat, lon: t.lon } }));
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSimilarPins() {
  const { state, dispatch } = useAppStore();

  const triggerSimilar = useCallback(
    async (place: { id: string; title: string; lat: number; lon: number; category: string }) => {
      const city      = state.city;
      const archetype = state.persona?.archetype ?? 'Explorer';

      dispatch({
        type: 'SET_SIMILAR_PINS',
        state: { sourcePlaceId: place.id, similarIds: [] },
      });

      try {
        const result = await api.similarPlaces({
          placeName: place.title,
          city,
          personaArchetype: archetype,
          category: place.category,
        });

        if (result.places?.length) {
          const ids = result.places.map((p: ReferencePin) => p.id);
          dispatch({ type: 'SET_SIMILAR_PINS', state: { sourcePlaceId: place.id, similarIds: ids } });
          const existing = new Set(state.referencePins.map(p => p.id));
          const newPins = result.places.filter((p: ReferencePin) => !existing.has(p.id));
          dispatch({ type: 'SET_REFERENCE_PINS', pins: [...state.referencePins, ...newPins] });
        }
      } catch (err) {
        console.error('SIMILAR PLACES ERROR:', err);
        dispatch({ type: 'SET_SIMILAR_PINS', state: null });
      }
    },
    [state.city, state.persona, state.referencePins, dispatch],
  );

  const clearSimilar = useCallback(() => {
    dispatch({ type: 'SET_SIMILAR_PINS', state: null });
  }, [dispatch]);

  return { triggerSimilar, clearSimilar, similarPinsState: state.similarPinsState };
}

// ── Banner ──────────────────────────────────────────────────────────────────

interface BannerProps {
  category: string;
  onClear: () => void;
}

export function SimilarPinsBanner({ category, onClear }: BannerProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
      left: 12, right: 12,
      zIndex: 25,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderRadius: 14,
      background: 'rgba(20,184,166,.15)',
      border: '1px solid rgba(20,184,166,.3)',
      backdropFilter: 'blur(12px)',
    }}>
      <span style={{ flex: 1, fontSize: '0.78rem', color: '#5eead4', fontWeight: 600 }}>
        Similar {category} nearby · Tap to explore
      </span>
      <button
        onClick={onClear}
        style={{
          background: 'none', border: 'none',
          color: 'rgba(94,234,212,.6)', fontSize: '0.72rem',
          cursor: 'pointer', padding: '0 4px', fontWeight: 600,
        }}
      >
        Clear ✕
      </button>
    </div>
  );
}
