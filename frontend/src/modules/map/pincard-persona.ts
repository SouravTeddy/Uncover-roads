import { useState, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { api } from '../../shared/api';
import type { Place, Persona, PersonaProfile } from '../../shared/types';

export interface PersonaBadge {
  text: string;
  color: string;
  bg: string;
  border: string;
}

/**
 * Compute persona-match badges from place + persona data.
 * Pure — no side effects, no API calls.
 * @param mode 'map' limits to 2 badges; 'itinerary' returns all.
 */
export function computePersonaBadges(
  place: Place,
  persona: Persona,
  profile: PersonaProfile | null,
  mode: 'map' | 'itinerary' = 'map',
): PersonaBadge[] {
  const badges: PersonaBadge[] = [];

  const green  = { color: '#4ade80', bg: 'rgba(74,222,128,.1)',  border: 'rgba(74,222,128,.25)' };
  const amber  = { color: '#fbbf24', bg: 'rgba(251,191,36,.1)',  border: 'rgba(251,191,36,.25)' };
  const blue   = { color: '#60a5fa', bg: 'rgba(96,165,250,.1)',  border: 'rgba(96,165,250,.25)' };
  const indigo = { color: '#a5b4fc', bg: 'rgba(165,180,252,.1)', border: 'rgba(165,180,252,.25)' };

  // 1. Category matches persona venue_filters
  const venueFilters = persona.venue_filters ?? [];
  if (venueFilters.some(f => f.toLowerCase() === place.category)) {
    badges.push({ text: '✓ Matches your taste', ...green });
  }

  if (profile) {
    // 2. Price level checks
    if (place.price_level != null && place.price_level > 0) {
      if (place.price_level > profile.price_max) {
        badges.push({ text: '⚠ Above your budget', ...amber });
      } else if (place.price_level <= profile.price_min) {
        badges.push({ text: '✓ Budget-friendly', ...green });
      }
    }

    // 3. Dietary: halal
    if (profile.dietary.includes('halal_certified_only')) {
      const tags = place.tags ?? {};
      const isHalal =
        tags.diet_halal === 'yes' ||
        tags.cuisine?.toLowerCase().includes('halal') ||
        tags.amenity?.toLowerCase().includes('halal');
      if (!isHalal) {
        badges.push({ text: '⚠ Halal not confirmed', ...amber });
      }
    }

    // 4. Dietary: vegan-friendly
    if (profile.dietary.includes('vegan_boost')) {
      const cuisine = (place.tags?.cuisine ?? '').toLowerCase();
      if (cuisine.includes('vegan') || cuisine.includes('vegetarian')) {
        badges.push({ text: '✓ Vegan-friendly', ...green });
      }
    }

    // 5. Family-friendly
    const hasFamilyFlag = profile.social_flags.includes('family') || profile.social_flags.includes('kids' as never);
    if (hasFamilyFlag && (place.category === 'park' || place.category === 'museum')) {
      badges.push({ text: '✓ Family-friendly', ...blue });
    }

    // 6. Slow pace + museum/historic
    if (profile.pace === 'slow' && (place.category === 'museum' || place.category === 'historic')) {
      badges.push({ text: '✓ Good for slow exploration', ...indigo });
    }
  }

  return mode === 'map' ? badges.slice(0, 2) : badges;
}

/**
 * Lazy LLM insight hook. Fires once per (placeId + mode), caches result in caller's ref.
 * Returns existing place.reason immediately if present — skips the API call.
 */
export function usePersonaInsight(
  place: Place,
  persona: Persona | null,
  mode: 'map' | 'itinerary',
  insightCache: MutableRefObject<Map<string, string>>,
): { insight: string | null; loading: boolean } {
  const cacheKey = `${place.id}:${mode}`;

  // If place already has a reason (Our Picks), use it directly
  if (place.reason) {
    return { insight: place.reason, loading: false };
  }

  const cached = insightCache.current.get(cacheKey);
  const [insight, setInsight] = useState<string | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached && !!persona);

  useEffect(() => {
    if (!persona) return;
    const hit = insightCache.current.get(cacheKey);
    if (hit) { setInsight(hit); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    (api as unknown as Record<string, (args: unknown) => Promise<{ insight?: string | null }>>)
      .personaInsight?.({
        placeTitle: place.title,
        placeCategory: place.category,
        city: place._city ?? '',
        personaArchetype: persona.archetype_name ?? persona.archetype,
        personaDesc: persona.archetype_desc ?? '',
        mode,
        tags: place.tags ?? {},
        priceLevel: place.price_level,
      })
      .then((res: { insight?: string | null }) => {
        if (cancelled) return;
        const text = res.insight ?? null;
        if (text) insightCache.current.set(cacheKey, text);
        setInsight(text);
      })
      .catch(() => {
        if (!cancelled) setInsight(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, mode]);

  return { insight, loading };
}
