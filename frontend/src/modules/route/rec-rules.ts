type MealWindow   = { start: string; end: string; type: 'lunch' | 'dinner' };
type CoffeeWindow = { start: string; end: string };
type PaceName     = 'walker' | 'relaxed' | 'active' | 'default';
type PersonaName  = 'epicurean' | 'explorer' | 'slowtraveller' | 'historian';

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
    walker:  500,
    relaxed: 800,
    active:  1200,
    default: 600,
  } as Record<PaceName, number>,

  PERSONA_REC_MAP: {
    epicurean:     ['restaurant', 'food_market'],
    explorer:      ['viewpoint', 'park', 'hidden_gem'],
    slowtraveller: ['cafe', 'bookshop', 'garden'],
    historian:     ['monument', 'museum', 'gallery'],
  } as Record<PersonaName, string[]>,

  MIN_GAP_MINUTES:      30,
  MAX_BRANCHES_VISIBLE: 2,
} as const;
