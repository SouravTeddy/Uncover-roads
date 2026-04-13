// ── Hard conflict pairs ───────────────────────────────────────
export interface HardConflict {
  id:        'C1' | 'C2' | 'C3' | 'C4';
  a:         string;
  b:         string;
  dimension: string;
}

export const HARD_CONFLICTS: HardConflict[] = [
  { id: 'C1', a: 'slow',   b: 'pack',        dimension: 'stops_per_day' },
  { id: 'C2', a: 'budget', b: 'luxury',       dimension: 'price_level' },
  { id: 'C3', a: 'early',  b: 'bars',         dimension: 'evening_type' },
  { id: 'C4', a: 'budget', b: 'comfortable',  dimension: 'price_level' },
];

export function detectHardConflict(a: string, b: string): HardConflict | null {
  return HARD_CONFLICTS.find(
    c => (c.a === a && c.b === b) || (c.a === b && c.b === a)
  ) ?? null;
}

// ── Soft conflict pairs ────────────────────────────────────────
export const SOFT_CONFLICTS = [
  { a: 'slow',        b: 'balanced',   strategy: 'split_day' },
  { a: 'relax',       b: 'pack',       strategy: 'anchor_filler' },
  { a: 'family',      b: 'bars',       strategy: 'force_dinner' },
  { a: 'plant_based', b: 'grab_go',    strategy: 'badge_only' },
  { a: 'halal',       b: 'bars',       strategy: 'disclaimer' },
] as const;

// ── Alignment tables ───────────────────────────────────────────
export const PACE_ALIGNMENT: Record<string, Record<string, number>> = {
  slow:        { slow: 1.0, balanced: 0.6, pack: 0.0, spontaneous: 0.5 },
  balanced:    { slow: 0.6, balanced: 1.0, pack: 0.4, spontaneous: 0.7 },
  pack:        { slow: 0.0, balanced: 0.4, pack: 1.0, spontaneous: 0.3 },
  spontaneous: { slow: 0.5, balanced: 0.7, pack: 0.3, spontaneous: 1.0 },
};

export const PRICE_ALIGNMENT: Record<string, Record<string, number>> = {
  budget:      { budget: 1.0, mid_range: 0.5, comfortable: 0.1, luxury: 0.0 },
  mid_range:   { budget: 0.5, mid_range: 1.0, comfortable: 0.6, luxury: 0.2 },
  comfortable: { budget: 0.1, mid_range: 0.6, comfortable: 1.0, luxury: 0.7 },
  luxury:      { budget: 0.0, mid_range: 0.2, comfortable: 0.7, luxury: 1.0 },
};

export const EVENING_ALIGNMENT: Record<string, Record<string, number>> = {
  bars:        { bars: 1.0, dinner_wind: 0.3, markets: 0.5, early: 0.0 },
  dinner_wind: { bars: 0.3, dinner_wind: 1.0, markets: 0.6, early: 0.5 },
  markets:     { bars: 0.5, markets: 1.0, dinner_wind: 0.6, early: 0.4 },
  early:       { bars: 0.0, dinner_wind: 0.5, markets: 0.4, early: 1.0 },
};

// ── Score options against accumulated weights ──────────────────
export function scoreOptions(
  candidates: string[],
  accumulatedWeights: Record<string, number>,
  alignmentTable: Record<string, Record<string, number>>
): Record<string, number> {
  const scores: Record<string, number> = {};
  const dims = Object.keys(accumulatedWeights);
  if (dims.length === 0) {
    candidates.forEach(c => { scores[c] = 0; });
    return scores;
  }
  for (const candidate of candidates) {
    const row = alignmentTable[candidate] ?? {};
    let sum = 0;
    for (const [dim, weight] of Object.entries(accumulatedWeights)) {
      const alignment = row[dim] ?? row[candidate] ?? 0;
      sum += weight * alignment;
    }
    scores[candidate] = sum / dims.length;
  }
  return scores;
}

// ── Answer weight vectors ──────────────────────────────────────
export const ANSWER_WEIGHTS = {
  pace: {
    slow:        { stops_per_day: 2.5, time_per_stop: 105, flexibility: 0.3 },
    balanced:    { stops_per_day: 4.5, time_per_stop: 52,  flexibility: 0.5 },
    pack:        { stops_per_day: 7.0, time_per_stop: 32,  flexibility: 0.2 },
    spontaneous: { stops_per_day: 3.0, time_per_stop: 60,  flexibility: 1.0 },
  },
  budget: {
    budget:      { price_min: 1 as const, price_max: 1 as const },
    mid_range:   { price_min: 1 as const, price_max: 3 as const },
    comfortable: { price_min: 2 as const, price_max: 4 as const },
    luxury:      { price_min: 3 as const, price_max: 4 as const },
  },
  evening: {
    bars:        { evening_end_time: '02:00' },
    dinner_wind: { evening_end_time: '22:00' },
    markets:     { evening_end_time: '23:00' },
    early:       { evening_end_time: '20:00' },
  },
  day_open: {
    coffee:    { day_buffer_min: 30 },
    breakfast: { day_buffer_min: 45 },
    straight:  { day_buffer_min: 0 },
    grab_go:   { day_buffer_min: 0 },
  },
} as const;

// ── Dietary flag mapping ───────────────────────────────────────
export const DIETARY_FLAG_MAP: Record<string, string[]> = {
  none:        [],
  plant_based: ['vegan_boost', 'meat_flag'],
  halal:       ['halal_certified_only'],
  kosher:      ['kosher_certified_only'],
  allergy:     ['allergy_warning'],
};
