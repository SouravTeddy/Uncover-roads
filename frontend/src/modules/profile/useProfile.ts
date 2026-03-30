import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import type { OnboardingAnswers } from '../../shared/types';

export function useProfile() {
  const { state, dispatch } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { persona, city } = state;

  // Edit state mirrors current obAnswers; initialised from persona
  const [editAnswers, setEditAnswers] = useState<OnboardingAnswers>(() => ({
    ritual:      persona?.ritual ?? null,
    sensory:     persona?.sensory ?? null,
    style:       persona?.style ?? null,
    attractions: persona?.attractions ?? [],
    pace:        persona?.pace ?? null,
    social:      persona?.social ?? null,
  }));

  function updateAnswer<K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) {
    setEditAnswers(prev => ({ ...prev, [key]: value }));
  }

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await api.persona(editAnswers, city);
      if (result.persona) {
        const updated = {
          ...result.persona,
          archetypeData: {
            name: result.persona.archetype_name,
            desc: result.persona.archetype_desc,
            venue_filters: result.persona.venue_filters ?? [],
            itinerary_bias: result.persona.itinerary_bias ?? [],
          },
        };
        dispatch({ type: 'SET_PERSONA', persona: updated });
        // Sync obAnswers to store
        Object.entries(editAnswers).forEach(([k, v]) => {
          dispatch({ type: 'SET_OB_ANSWER', key: k as keyof OnboardingAnswers, value: v });
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError('Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return {
    persona,
    editAnswers,
    updateAnswer,
    saveProfile,
    saving,
    saved,
    error,
  };
}
