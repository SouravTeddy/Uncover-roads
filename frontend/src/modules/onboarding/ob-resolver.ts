import type {
  RawOBAnswers, PersonaProfile, ResolvedConflict,
  SocialFlag, DietaryFlag, VenueType, OBDayOpen, OBEvening,
} from '../../shared/types';
import {
  detectHardConflict, ANSWER_WEIGHTS, DIETARY_FLAG_MAP,
} from './ob-conflict-map';

// ── Venue weights per mood ────────────────────────────────────
const MOOD_VENUE_WEIGHTS: Record<string, Partial<Record<VenueType, number>>> = {
  explore:   { neighbourhood: 0.4, landmark: 0.3, viewpoint: 0.3 },
  relax:     { park: 0.4, spa: 0.3, cafe: 0.3 },
  eat_drink: { restaurant: 0.5, market: 0.4, street_food: 0.3 },
  culture:   { museum: 0.5, heritage: 0.4, gallery: 0.3 },
};

// ── Social flags per group ────────────────────────────────────
const GROUP_SOCIAL_FLAGS: Record<string, SocialFlag[]> = {
  solo:    ['solo'],
  couple:  ['couple'],
  family:  ['family', 'kids'],
  friends: ['group'],
};

// ── Stage 2: merge venue weights across multi-choice moods ────
export function mergeVenueWeights(moods: string[]): Partial<Record<VenueType, number>> {
  const decay = [1.0, 0.4, 0.2];
  const result: Record<string, number> = {};
  for (let i = 0; i < moods.length; i++) {
    const w = decay[Math.min(i, 2)];
    const weights = MOOD_VENUE_WEIGHTS[moods[i]] ?? {};
    for (const [vtype, base] of Object.entries(weights)) {
      result[vtype] = (result[vtype] ?? 0) + (base as number) * w;
    }
  }
  // Initialise absent VenueType entries to 0 for single-mood case
  const allVenueTypes: VenueType[] = [
    'neighbourhood', 'landmark', 'viewpoint', 'park', 'spa', 'cafe', 'restaurant',
    'market', 'street_food', 'museum', 'heritage', 'gallery', 'romantic',
    'table_for_2', 'family', 'communal', 'social', 'group_booking',
  ];
  for (const vt of allVenueTypes) {
    if (!(vt in result)) result[vt] = 0;
  }
  const maxW = Math.max(...Object.values(result), 0.001);
  return Object.fromEntries(
    Object.entries(result).map(([k, v]) => [k, v / maxW])
  ) as Partial<Record<VenueType, number>>;
}

// ── Stage 1: resolve hard conflicts ──────────────────────────
function resolveConflicts(
  pace: string[],
  preResolved: ResolvedConflict[]
): { resolvedPace: string; conflicts: ResolvedConflict[]; autoBlend: boolean } {
  const conflicts: ResolvedConflict[] = [];
  let autoBlend = false;

  if (pace.length < 2) {
    return { resolvedPace: pace[0] ?? 'balanced', conflicts, autoBlend };
  }

  const conflict = detectHardConflict(pace[0], pace[1]);
  if (!conflict) {
    return { resolvedPace: pace[0], conflicts, autoBlend };
  }

  // Check if user already resolved this
  const existing = preResolved.find(r => r.conflict_id === conflict.id);
  if (existing) {
    conflicts.push(existing);
    return {
      resolvedPace: existing.method === 'auto_blend' ? pace[0] : (existing.winner ?? pace[0]),
      conflicts,
      autoBlend: existing.method === 'auto_blend',
    };
  }

  // Auto-blend: keep both, flag for itinerary engine
  autoBlend = true;
  const resolved: ResolvedConflict = { conflict_id: conflict.id, method: 'auto_blend' };
  conflicts.push(resolved);
  return { resolvedPace: pace[0], conflicts, autoBlend };
}

// ── Stage 3: assemble PersonaProfile ─────────────────────────
export function resolveOBAnswers(
  raw: RawOBAnswers,
  preResolved: ResolvedConflict[] = []
): PersonaProfile {
  // Stage 1 — conflict resolution (pace only; budget/evening are single-choice)
  const { resolvedPace, conflicts, autoBlend } = resolveConflicts(raw.pace, preResolved);

  // Stage 2 — compute derived values
  const paceWeights = ANSWER_WEIGHTS.pace[resolvedPace as keyof typeof ANSWER_WEIGHTS.pace]
    ?? ANSWER_WEIGHTS.pace.balanced;
  const budgetWeights = ANSWER_WEIGHTS.budget[raw.budget ?? 'mid_range'];
  const eveningWeights = ANSWER_WEIGHTS.evening[raw.evening ?? 'dinner_wind'];
  const dayOpenWeights = ANSWER_WEIGHTS.day_open[raw.day_open ?? 'coffee'];

  const venue_weights = mergeVenueWeights(raw.mood);

  const dietary: DietaryFlag[] = raw.dietary.flatMap(
    d => (DIETARY_FLAG_MAP[d] ?? []) as DietaryFlag[]
  );

  const social_flags: SocialFlag[] = GROUP_SOCIAL_FLAGS[raw.group ?? 'solo'] ?? ['solo'];

  // Stage 3 — assemble
  const profile: PersonaProfile = {
    stops_per_day:    paceWeights.stops_per_day,
    time_per_stop:    paceWeights.time_per_stop,
    venue_weights,
    price_min:        budgetWeights.price_min,
    price_max:        budgetWeights.price_max,
    flexibility:      paceWeights.flexibility,
    day_open:         (raw.day_open ?? 'coffee') as OBDayOpen,
    day_buffer_min:   dayOpenWeights.day_buffer_min,
    evening_type:     (raw.evening ?? 'dinner_wind') as OBEvening,
    evening_end_time: eveningWeights.evening_end_time,
    social_flags,
    dietary,
    archetype:        'wanderer', // resolved server-side; placeholder for client
    resolved_conflicts: conflicts,
    auto_blend:       autoBlend,
  };

  // Conditional fields
  if (raw.kid_focus)       profile.kid_focus       = raw.kid_focus;
  if (raw.budget_protect)  profile.budget_protect  = raw.budget_protect;
  if (raw.food_scene)      profile.food_scene      = raw.food_scene;

  return profile;
}
