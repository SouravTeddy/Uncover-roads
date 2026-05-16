// frontend/src/modules/route/rec-rules.ts
type MealWindow   = { start: string; end: string; type: 'lunch' | 'dinner' };
type CoffeeWindow = { start: string; end: string };
type PaceName     = 'walker' | 'relaxed' | 'active' | 'default';
type PersonaName  =
  | 'flaneur' | 'gastronaut' | 'slowScholar' | 'neighbourhoodLocal'
  | 'efficientExplorer' | 'aesthete' | 'nightCreature' | 'ritualSeeker'
  // legacy keys kept for stored personas
  | 'epicurean' | 'explorer' | 'slowtraveller' | 'historian' | 'voyager' | 'wanderer' | 'pulse';

export const REC_RULES = {
  MEAL_WINDOWS: [
    { start: '11:30', end: '14:00', type: 'lunch'  },
    { start: '18:00', end: '21:00', type: 'dinner' },
  ] as MealWindow[],

  COFFEE_WINDOWS: [
    { start: '08:00', end: '11:00' },
    { start: '14:30', end: '17:00' },
  ] as CoffeeWindow[],

  MAX_DETOUR_METRES: {
    walker:  500, relaxed: 800, active: 1200, default: 600,
  } as Record<PaceName, number>,

  PERSONA_REC_MAP: {
    // ── New personas ──────────────────────────────────────────────────────────
    flaneur:            ['neighbourhood', 'park', 'hidden_gem', 'local_cafe'],
    gastronaut:         ['restaurant', 'food_market', 'street_food', 'wine_bar'],
    slowScholar:        ['museum', 'heritage', 'gallery', 'bookshop'],
    neighbourhoodLocal: ['cafe', 'local_bar', 'neighbourhood', 'bakery'],
    efficientExplorer:  ['viewpoint', 'landmark', 'park', 'hidden_gem'],
    aesthete:           ['gallery', 'architecture', 'design_museum', 'rooftop'],
    nightCreature:      ['bar', 'rooftop', 'live_music', 'night_market'],
    ritualSeeker:       ['cafe', 'market', 'cultural_event', 'local_institution'],
    // ── Legacy keys (fallback for stored personas) ────────────────────────────
    epicurean:          ['restaurant', 'food_market'],
    explorer:           ['viewpoint', 'park', 'hidden_gem'],
    slowtraveller:      ['cafe', 'bookshop', 'garden'],
    historian:          ['monument', 'museum', 'gallery'],
    voyager:            ['viewpoint', 'landmark', 'hidden_gem'],
    wanderer:           ['neighbourhood', 'park', 'local_cafe'],
    pulse:              ['bar', 'rooftop', 'live_music'],
  } as Record<PersonaName, string[]>,

  MIN_GAP_MINUTES:      30,
  MAX_BRANCHES_VISIBLE: 2,
} as const;
