import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import { supabase } from '../../shared/supabase';
import { syncPersona } from '../../shared/userSync';

export function usePersona() {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buildPersona(city = '') {
    setLoading(true);
    setError(null);
    try {
      const result = await api.persona(state.obAnswers, city);
      if (result.persona) {
        const personaWithData = {
          ...result.persona,
          archetypeData: {
            name: result.persona.archetype_name,
            desc: result.persona.archetype_desc,
            venue_filters: result.persona.venue_filters ?? [],
            itinerary_bias: result.persona.itinerary_bias ?? [],
          },
        };
        dispatch({ type: 'SET_PERSONA', persona: personaWithData });
        // Sync to Supabase if signed in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) syncPersona(user.id, personaWithData).catch(console.warn);
      }
    } catch (err) {
      setError('Could not build your persona. Please try again.');
      console.warn('Persona API error:', err);
    } finally {
      setLoading(false);
    }
  }

  return { buildPersona, loading, error, persona: state.persona };
}
