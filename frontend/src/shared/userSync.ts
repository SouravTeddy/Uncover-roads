import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Persona, SavedItinerary } from './types';

// Called on SIGNED_IN — upserts the user's profile from their Google data
export async function syncProfile(user: User) {
  const meta = user.user_metadata ?? {};
  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
    full_name: meta.full_name ?? meta.name ?? null,
    avatar_url: meta.avatar_url ?? meta.picture ?? null,
  }, { onConflict: 'id', ignoreDuplicates: false });
}

// Called when persona is set (onboarding complete) — upserts so it stays in sync
export async function syncPersona(userId: string, persona: Persona) {
  await supabase.from('personas').upsert({
    user_id: userId,
    archetype: persona.archetype,
    archetype_name: persona.archetype_name,
    answers: {
      ritual: persona.ritual,
      sensory: persona.sensory,
      style: persona.style,
      attractions: persona.attractions,
      pace: persona.pace,
      social: persona.social,
    },
  }, { onConflict: 'user_id' });
}

// Called when user saves an itinerary
export async function syncSavedItinerary(userId: string, item: SavedItinerary) {
  await supabase.from('saved_itineraries').upsert({
    id: item.id,
    user_id: userId,
    city: item.city,
    date: item.date,
    itinerary: item.itinerary,
    persona: item.persona,
  });
}

// Check whether a user has completed onboarding (has a row in personas table).
// Used as a Supabase fallback when localStorage is cleared (e.g. after sign-out).
export async function checkPersonaExists(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('personas')
    .select('user_id')
    .eq('user_id', userId)
    .single();
  return !!data;
}

// Sync the new-style persona profile to Supabase personas table.
export async function syncPersonaProfile(
  userId: string,
  archetype: string,
  archetypeName: string,
  rawAnswers: unknown,
) {
  await supabase.from('personas').upsert({
    user_id: userId,
    archetype,
    archetype_name: archetypeName,
    answers: rawAnswers,
  }, { onConflict: 'user_id' });
}

// Load role + generation count for the signed-in user.
// Returns null on failure so callers never downgrade a cached role.
export async function loadUserProfile(userId: string): Promise<{ role: 'user' | 'admin'; generationCount: number } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, generation_count')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return {
    role: data.role === 'admin' ? 'admin' : 'user',
    generationCount: data.generation_count ?? 0,
  };
}

// Increment generation count in Supabase
export async function incrementGenerationCount(userId: string) {
  await supabase.rpc('increment_generation_count', { uid: userId });
}

// Load saved itineraries from Supabase for the signed-in user
export async function loadSavedItineraries(userId: string): Promise<SavedItinerary[]> {
  const { data, error } = await supabase
    .from('saved_itineraries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    city: row.city,
    date: row.date,
    itinerary: row.itinerary,
    persona: row.persona,
  }));
}
