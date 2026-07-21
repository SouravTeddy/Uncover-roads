import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { FavouritedPin, Persona, SavedEvent, SavedItinerary } from './types';
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
    trip_details: item.tripDetails ?? null,
    travel_date: item.travelDate ?? null,
    city_lat: item.cityLat ?? null,
    city_lon: item.cityLon ?? null,
    selected_places: item.selectedPlaces ?? [],
    journey_legs: item.journeyLegs ?? null,
  });
}

// Fetch persona data for a user from Supabase.
// Returns the persona object if found, null if the user has not completed onboarding.
// Used as a fallback when localStorage is cleared (e.g. after sign-out).
export async function fetchPersonaForRestore(
  userId: string,
): Promise<{ archetype: string; archetype_name: string } | null> {
  const { data } = await supabase
    .from('personas')
    .select('archetype, archetype_name')
    .eq('user_id', userId)
    .single();
  return data ?? null;
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

// Load role, generation count, and tier for the signed-in user.
// Returns null on failure so callers never downgrade a cached role.
export async function loadUserProfile(userId: string): Promise<{
  role: 'user' | 'admin';
  generationCount: number;
  tier: 'free' | 'pack' | 'pro';
  packTripsRemaining: number;
} | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, generation_count, tier, pack_trips_remaining')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  const rawTier = data.tier;
  return {
    role: data.role === 'admin' ? 'admin' : 'user',
    generationCount: data.generation_count ?? 0,
    tier: rawTier === 'pro' || rawTier === 'pack' ? rawTier : 'free',
    packTripsRemaining: data.pack_trips_remaining ?? 0,
  };
}

// Increment generation count in Supabase
export async function incrementGenerationCount(userId: string) {
  await supabase.rpc('increment_generation_count', { uid: userId });
}

// ── Favourited pins ─────────────────────────────────────────────────────────

export async function syncFavouritePin(userId: string, pin: FavouritedPin) {
  await supabase.from('user_favourites').upsert({
    user_id: userId,
    place_id: pin.placeId,
    title: pin.title,
    lat: pin.lat,
    lon: pin.lon,
    city: pin.city,
    category: pin.category ?? null,
    photo_ref: pin.photoRef ?? null,
    travel_date: pin.travelDate ?? null,
  }, { onConflict: 'user_id,place_id' });
}

export async function deleteFavouritePin(userId: string, placeId: string) {
  await supabase.from('user_favourites')
    .delete()
    .eq('user_id', userId)
    .eq('place_id', placeId);
}

export async function loadFavouritedPins(userId: string): Promise<FavouritedPin[]> {
  const { data, error } = await supabase
    .from('user_favourites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(row => ({
    placeId: row.place_id,
    title: row.title,
    lat: row.lat,
    lon: row.lon,
    city: row.city,
    category: row.category ?? undefined,
    photoRef: row.photo_ref ?? null,
    travelDate: row.travel_date ?? null,
  }));
}

// ── Saved events ─────────────────────────────────────────────────────────────

export async function syncSavedEvent(userId: string, event: SavedEvent) {
  await supabase.from('user_saved_events').upsert({
    user_id: userId,
    id: event.id,
    title: event.title,
    city: event.city,
    date: event.date ?? null,
    is_annual: event.isAnnual,
    venue: event.venue ?? null,
    category: event.category,
    saved_at: event.savedAt,
  }, { onConflict: 'user_id,id' });
}

export async function deleteSavedEvent(userId: string, eventId: string) {
  await supabase.from('user_saved_events')
    .delete()
    .eq('user_id', userId)
    .eq('id', eventId);
}

export async function loadSavedEvents(userId: string): Promise<SavedEvent[]> {
  const { data, error } = await supabase
    .from('user_saved_events')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: true });
  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    title: row.title,
    city: row.city,
    date: row.date ?? null,
    isAnnual: row.is_annual,
    venue: row.venue ?? null,
    category: row.category,
    savedAt: row.saved_at,
  }));
}

// ── Saved itineraries ────────────────────────────────────────────────────────

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
    travelDate: row.travel_date ?? null,
    cityLat: row.city_lat ?? null,
    cityLon: row.city_lon ?? null,
    selectedPlaces: row.selected_places ?? [],
    lastUpdateCheck: null,
    pendingSwapCards: [],
    journeyLegs: row.journey_legs ?? null,
    tripDetails: row.trip_details ?? null,
  }));
}
