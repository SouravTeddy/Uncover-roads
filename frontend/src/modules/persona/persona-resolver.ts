// frontend/src/modules/persona/persona-resolver.ts
import type { RawOBAnswers } from '../../shared/types';
import type { PersonaKey } from './types';

/**
 * Multi-signal persona scoring. Uses mood, pace, evening, day_open,
 * budget, and group to produce the best-matching PersonaKey.
 * Pure function — no side effects.
 */
export function resolvePersonaKey(raw: RawOBAnswers): PersonaKey {
  // Key order here is the intentional tiebreaker priority (flaneur = safe default)
  const scores: Record<PersonaKey, number> = {
    flaneur: 0, gastronaut: 0, slowScholar: 0, neighbourhoodLocal: 0,
    efficientExplorer: 0, aesthete: 0, nightCreature: 0, ritualSeeker: 0,
  };

  const mood    = raw.mood  ?? [];
  const pace    = raw.pace  ?? [];
  const evening = raw.evening  ?? null;
  const dayOpen = raw.day_open ?? null;
  const budget  = raw.budget   ?? null;
  const group   = raw.group    ?? null;

  // ── Mood (primary = full weight, secondary = 0.5, tertiary = 0.25) ─────────
  mood.forEach((m, i) => {
    const w = [1.0, 0.5, 0.25][i] ?? 0.1;
    if (m === 'explore') {
      scores.flaneur           += 3 * w;
      scores.efficientExplorer += 2 * w;
      scores.aesthete          += 1 * w;
    }
    if (m === 'relax') {
      scores.flaneur             += 1 * w;
      scores.slowScholar         += 1 * w;
      scores.neighbourhoodLocal  += 3 * w;
      scores.ritualSeeker        += 2 * w;
    }
    if (m === 'eat_drink') {
      scores.gastronaut         += 4 * w;
      scores.ritualSeeker       += 2 * w;
      scores.neighbourhoodLocal += 1 * w;
      scores.nightCreature      += 1 * w;
    }
    if (m === 'culture') {
      scores.slowScholar  += 3 * w;
      scores.aesthete     += 3 * w;
      scores.ritualSeeker += 1 * w;
    }
  });

  // ── Pace ───────────────────────────────────────────────────────────────────
  pace.forEach(p => {
    if (p === 'slow') {
      scores.flaneur            += 2;
      scores.slowScholar        += 3;
      scores.neighbourhoodLocal += 2;
      scores.ritualSeeker       += 2;
    }
    if (p === 'pack')        scores.efficientExplorer += 3;
    if (p === 'spontaneous') { scores.flaneur += 3; scores.nightCreature += 2; scores.neighbourhoodLocal += 1; }
    if (p === 'balanced')    { scores.efficientExplorer += 1; scores.aesthete += 1; }
  });

  // ── Evening ────────────────────────────────────────────────────────────────
  if (evening === 'bars')        scores.nightCreature += 4;
  if (evening === 'markets')     { scores.gastronaut += 2; scores.ritualSeeker += 2; scores.neighbourhoodLocal += 1; }
  if (evening === 'dinner_wind') { scores.gastronaut += 1; scores.aesthete += 1; }
  if (evening === 'early')       { scores.slowScholar += 1; scores.ritualSeeker += 2; scores.neighbourhoodLocal += 1; }

  // ── Day open ───────────────────────────────────────────────────────────────
  if (dayOpen === 'coffee')    { scores.ritualSeeker += 3; scores.flaneur += 1; scores.neighbourhoodLocal += 1; }
  if (dayOpen === 'breakfast') { scores.gastronaut += 2; scores.ritualSeeker += 1; scores.slowScholar += 1; }
  if (dayOpen === 'straight')  scores.efficientExplorer += 2;
  if (dayOpen === 'grab_go')   scores.efficientExplorer += 1;

  // ── Budget ─────────────────────────────────────────────────────────────────
  if (budget === 'budget')    scores.neighbourhoodLocal += 1;
  if (budget === 'mid_range') scores.efficientExplorer += 1;
  if (budget === 'luxury')    { scores.aesthete += 2; scores.gastronaut += 1; }
  if (budget === 'comfortable') scores.aesthete += 1;

  // ── Group ──────────────────────────────────────────────────────────────────
  if (group === 'solo')    { scores.flaneur += 1; scores.nightCreature += 1; scores.aesthete += 1; }
  if (group === 'couple')  { scores.aesthete += 1; scores.gastronaut += 1; }
  if (group === 'family')  { scores.neighbourhoodLocal += 1; scores.ritualSeeker += 1; scores.nightCreature -= 2; }
  if (group === 'friends') scores.nightCreature += 2;

  // ── Compound signals ───────────────────────────────────────────────────────
  // Strong night creature signal: bars evening + late start
  if (evening === 'bars' && dayOpen !== 'coffee' && dayOpen !== 'breakfast') {
    scores.nightCreature += 2;
  }
  // Aesthete vs slowScholar tiebreaker: culture + balanced pace, not food-focused
  if (mood.includes('culture') && pace.includes('balanced') && !mood.includes('eat_drink')) {
    scores.aesthete += 2;
  }
  // Strong gastronaut: food primary AND market evening
  if (mood[0] === 'eat_drink' && (evening === 'markets' || evening === 'dinner_wind')) {
    scores.gastronaut += 2;
  }

  return (Object.entries(scores) as [PersonaKey, number][])
    .sort(([, a], [, b]) => b - a)[0][0];
}

/**
 * Legacy archetype key → new PersonaKey fallback.
 * Used when a stored persona has an old archetype string.
 */
export function legacyArchetypeToPersonaKey(archetype: string): PersonaKey {
  const map: Record<string, PersonaKey> = {
    explorer:      'flaneur',
    wanderer:      'flaneur',
    slowtraveller: 'neighbourhoodLocal',
    epicurean:     'gastronaut',
    historian:     'slowScholar',
    voyager:       'efficientExplorer',
    pulse:         'nightCreature',
  };
  return map[archetype] ?? 'flaneur';
}
