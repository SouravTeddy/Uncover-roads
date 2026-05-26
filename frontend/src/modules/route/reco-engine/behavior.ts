import type { ReelRecoCard } from '../reel/types';
import { supabase } from '../../../shared/supabase';

export interface RecoInteraction {
  recoId: string;
  dimension: string;
  archetype: string;
  action: 'viewed' | 'tapped' | 'dismissed' | 'lingered' | 'added_to_plan';
  conflictPresent: boolean;
  significance: number;
  signalSnapshot: {
    archetype: string;
    pace: string;
    densityScore: number | null;
    dayNumber: number;
    weather: string | null;
  };
  timestamp: string;
}

export function buildInteraction(
  card: ReelRecoCard,
  action: RecoInteraction['action'],
  conflictPresent: boolean,
  archetype: string,
  pace: string,
  densityScore: number | null,
  dayNumber: number,
  weather: string | null,
): RecoInteraction {
  // Dimension is the first segment of the card id (before the first hyphen)
  // Card id format: {dimension}-{stopId} or {dimension}-{stopId}-conflict
  const dimension = card.id.split('-')[0];

  return {
    recoId: card.id,
    dimension,
    archetype,
    action,
    conflictPresent,
    significance: card.weightScore ?? 0,
    signalSnapshot: { archetype, pace, densityScore, dayNumber, weather },
    timestamp: new Date().toISOString(),
  };
}

export async function syncRecoInteractions(
  userId: string,
  interactions: RecoInteraction[],
): Promise<void> {
  if (interactions.length === 0) return;
  const rows = interactions.map(i => ({
    user_id: userId,
    reco_id: i.recoId,
    dimension: i.dimension,
    archetype: i.archetype,
    action: i.action,
    conflict_present: i.conflictPresent,
    significance: i.significance,
    signal_snapshot: i.signalSnapshot,
    created_at: i.timestamp,
  }));
  await supabase.from('reco_interactions').insert(rows);
}
