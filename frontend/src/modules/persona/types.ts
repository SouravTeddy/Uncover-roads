// frontend/src/modules/persona/types.ts

export type PersonaKey =
  | 'flaneur'
  | 'gastronaut'
  | 'slowScholar'
  | 'neighbourhoodLocal'
  | 'efficientExplorer'
  | 'aesthete'
  | 'nightCreature'
  | 'ritualSeeker';

export interface PersonaDefinition {
  key: PersonaKey;
  /** Short all-caps display label (used in Beat 3 statement prefix) */
  name: string;
  /** Cinematic Beat 3 statement — newline-separated, 3 lines */
  statement: string;
  /** Which line (0-indexed) gets the gradient color treatment */
  gradientLine: number;
  /** Hero card headline — one punchy sentence, no label */
  headline: string;
  /** Hero card subtext template — use {{social}} placeholder replaced per-context */
  heroEmoji: string;
  /** 3 short instinct chips, max 3 words each */
  chips: [string, string, string];
  /** Plain-language route style description */
  route: string;
  /** What the itinerary will surface */
  prioritise: string;
  /** What the itinerary will avoid */
  skip: string;
  /** 5 place tag labels */
  placeTags: [string, string, string, string, string];
  /** Beat 2 trait lines — 3 sentences */
  traits: [string, string, string];
  /** Accent (primary) color */
  primary: string;
  /** Secondary accent color */
  secondary: string;
  /** Background gradient dark from-color */
  bgFrom: string;
  /** Background gradient dark to-color */
  bgTo: string;
  /** Unsplash image URL for header */
  image: string;
  /** Social context messaging — short, punchy, 1–2 sentences */
  social: {
    solo: string;
    couple: string;
    family: string;
    group: string;
  };
}

export const PERSONA_DEFINITIONS: Record<PersonaKey, PersonaDefinition> = {
  flaneur: {
    key: 'flaneur',
    name: 'FLANEUR',
    statement: 'YOU FOLLOW\nWHAT LOOKS\nINTERESTING.',
    gradientLine: 1,
    headline: 'No plan. No problem.',
    heroEmoji: '🚶',
    chips: ['One neighbourhood', 'No fixed route', 'Follow curiosity'],
    route: 'Two or three spots, all walkable. No rush, no backtracking.',
    prioritise: 'Side streets, local cafés, hidden courtyards, accidental finds.',
    skip: 'Tourist clusters, timed entries, anything with a queue.',
    placeTags: ['Side Streets', 'Courtyards', 'Local Cafés', 'Markets', 'Parks'],
    traits: [
      'Instinct over itinerary.',
      'The street is the map.',
      'A detour is just the route.',
    ],
    primary: '#E07040',
    secondary: '#F0B060',
    bgFrom: '#1C0E04',
    bgTo: '#3A1C08',
    image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'No one to check with. You go where the street takes you.',
      couple: 'You wander together, meet at the café you both spotted.',
      family: 'The city is your kids\' classroom today.',
      group:  'Split up at the corner. Compare notes over lunch.',
    },
  },

  gastronaut: {
    key: 'gastronaut',
    name: 'GASTRONAUT',
    statement: 'YOU EAT YOUR\nWAY THROUGH\nCITIES.',
    gradientLine: 1,
    headline: 'The itinerary is the food.',
    heroEmoji: '🍜',
    chips: ['Market first', 'No tourist menus', 'Ask locals'],
    route: 'Built around meal times. Market in the morning, lunch, then wherever the food takes you.',
    prioritise: 'Street food stalls, local markets, neighbourhood restaurants, wine bars.',
    skip: 'Hotel restaurants, tourist menus, anything with photos on the menu.',
    placeTags: ['Street Food', 'Local Markets', 'Wine Bars', 'Chef\'s Tables', 'Food Halls'],
    traits: [
      'The best meal won\'t be in a guidebook.',
      'You know a good market from a great one.',
      'Food is never just food.',
    ],
    primary: '#E84A2A',
    secondary: '#F09030',
    bgFrom: '#1A0804',
    bgTo: '#380E06',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You eat at the bar. One dish, full attention.',
      couple: 'Long lunches. Wine you didn\'t plan to order.',
      family: 'The market stall your kids will still talk about.',
      group:  'You\'ve already sent the restaurant shortlist.',
    },
  },

  slowScholar: {
    key: 'slowScholar',
    name: 'SLOW SCHOLAR',
    statement: 'EVERY CITY\nHAS LAYERS.\nYOU FIND THEM.',
    gradientLine: 1,
    headline: 'You leave with context, not just photos.',
    heroEmoji: '🏛️',
    chips: ['Few stops', 'Long visits', 'Read everything'],
    route: 'Two, maybe three stops. You spend proper time at each one.',
    prioritise: 'Museums, archaeological sites, heritage districts, specialist bookshops.',
    skip: 'Rush-through highlights, Instagram stops, anything timed to 20 minutes.',
    placeTags: ['Heritage Sites', 'Museums', 'Old Quarters', 'Historic Squares', 'Bookshops'],
    traits: [
      'You read the plaques everyone else walks past.',
      'A place means more when you know what stood here before.',
      'You leave knowing the story behind the sign.',
    ],
    primary: '#7880D8',
    secondary: '#A8B0F0',
    bgFrom: '#080A1C',
    bgTo: '#141830',
    image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'Take as long as you need. Nobody\'s waiting.',
      couple: 'You read the same plaque and argue about what it means.',
      family: 'History as a story. Your kids actually listen.',
      group:  'You knew about this place before anyone else did.',
    },
  },

  neighbourhoodLocal: {
    key: 'neighbourhoodLocal',
    name: 'NEIGHBOURHOOD LOCAL',
    statement: 'YOU COULD\nALMOST\nLIVE HERE.',
    gradientLine: 2,
    headline: 'Zero tourist traps. All texture.',
    heroEmoji: '☕',
    chips: ['Stay local', 'Skip the centre', 'Return visits'],
    route: 'One neighbourhood, half a day. You go back to places you liked.',
    prioritise: 'Neighbourhood bars, local bakeries, residential parks, corner cafés.',
    skip: 'Landmark clusters, anything on TripAdvisor\'s front page, hotel picks.',
    placeTags: ['Local Cafés', 'Residential Streets', 'Corner Bars', 'Neighbourhood Parks', 'Bakeries'],
    traits: [
      'You\'ve sat at the same café table twice.',
      'The neighbourhood matters more than the sights.',
      'A good trip feels like you almost lived there.',
    ],
    primary: '#3AB898',
    secondary: '#6AD4B8',
    bgFrom: '#04181A',
    bgTo: '#083028',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You blend in. That\'s the point.',
      couple: 'You find your neighbourhood. You\'ll talk about it for years.',
      family: 'Kids in the park. You find the café the locals use.',
      group:  'You convince everyone the centre is overrated. You\'re right.',
    },
  },

  efficientExplorer: {
    key: 'efficientExplorer',
    name: 'EFFICIENT EXPLORER',
    statement: 'YOU PACK MORE\nINTO A DAY\nTHAN MOST.',
    gradientLine: 2,
    headline: 'Cover ground. Miss nothing.',
    heroEmoji: '🧭',
    chips: ['Early start', 'Nearby stops', 'No backtracking'],
    route: 'Six to eight stops, close together. Early start, everything fits.',
    prioritise: 'A curated mix of must-sees and hidden gems, all within walking range.',
    skip: 'Anything that adds more than 20 minutes of travel between stops.',
    placeTags: ['Viewpoints', 'Key Landmarks', 'Local Finds', 'Parks', 'Neighbourhood Gems'],
    traits: [
      'You fit more into a morning than most do in a day.',
      'No wasted walks. No backtracking.',
      'Efficient isn\'t rushed — it\'s deliberate.',
    ],
    primary: '#3A90D8',
    secondary: '#6AB8F0',
    bgFrom: '#04101C',
    bgTo: '#081C34',
    image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You move fast. Nobody needs to keep up.',
      couple: 'See more, rush nothing. Somehow it works.',
      family: 'Pre-booked, well-planned. The kids are impressed.',
      group:  'You sent the itinerary three days ago.',
    },
  },

  aesthete: {
    key: 'aesthete',
    name: 'AESTHETE',
    statement: 'YOU TRAVEL\nTHROUGH\nYOUR EYES.',
    gradientLine: 2,
    headline: 'Beautiful cities, beautifully spent.',
    heroEmoji: '🎨',
    chips: ['Design first', 'Beautiful spaces', 'Slow looking'],
    route: 'Gallery, then a beautiful walk, then a café worth sitting in.',
    prioritise: 'Design museums, contemporary galleries, architectural landmarks, beautiful interiors.',
    skip: 'Purely historical sites without visual interest, crowded viewpoints, anything ugly.',
    placeTags: ['Galleries', 'Architecture', 'Design Districts', 'Beautiful Cafés', 'Rooftops'],
    traits: [
      'You spend an hour in a room most people walk through in three minutes.',
      'Architecture, light, texture — you notice what others walk past.',
      'Beauty is never shallow when you really look.',
    ],
    primary: '#C870B8',
    secondary: '#E8A8D8',
    bgFrom: '#180A18',
    bgTo: '#2C1028',
    image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'An hour in a room most people walk through in three minutes.',
      couple: 'You find the most beautiful place in the city. You both know why.',
      family: 'You show your kids what good design actually feels like.',
      group:  'You found the rooftop nobody else knew about.',
    },
  },

  nightCreature: {
    key: 'nightCreature',
    name: 'NIGHT CREATURE',
    statement: 'YOUR CITY\nSTARTS AT\nSUNDOWN.',
    gradientLine: 2,
    headline: 'The night is the plan.',
    heroEmoji: '🌆',
    chips: ['Late start', 'Bar hop', 'Follow the energy'],
    route: 'Easy afternoon, then the city wakes up and so do you.',
    prioritise: 'Bars, rooftop terraces, late restaurants, live music, night markets.',
    skip: 'Morning-only museums, early closings, anything that needs a 6pm reservation.',
    placeTags: ['Rooftop Bars', 'Late Restaurants', 'Live Music', 'Night Markets', 'Cocktail Bars'],
    traits: [
      'The city comes alive after 9pm and so do you.',
      'Best nights have no ending time.',
      'Sleep is negotiable. Energy isn\'t.',
    ],
    primary: '#8A50D8',
    secondary: '#C888F0',
    bgFrom: '#0A0414',
    bgTo: '#180828',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You end up talking to strangers. That\'s half the point.',
      couple: 'No end time. No plan. That\'s the plan.',
      family: 'Daytime done early. The evenings are yours.',
      group:  'No itinerary needed. Everyone just follows.',
    },
  },

  ritualSeeker: {
    key: 'ritualSeeker',
    name: 'RITUAL SEEKER',
    statement: 'YOU SEEK THE\nRHYTHMS LOCALS\nLIVE BY.',
    gradientLine: 1,
    headline: 'The city\'s rituals become yours.',
    heroEmoji: '🌅',
    chips: ['Local rituals', 'Morning coffee', 'Cultural immersion'],
    route: 'You follow the city\'s rhythm — morning coffee, lunch, the afternoon slow-down.',
    prioritise: 'Traditional cafés, local institutions, Sunday markets, cultural events.',
    skip: 'Trendy spots, anything that opened recently, tourist-facing experiences.',
    placeTags: ['Morning Cafés', 'Sunday Markets', 'Local Institutions', 'Cultural Spots', 'Old Bars'],
    traits: [
      'The 7am coffee bar. The Sunday market. The afternoon that slows down.',
      'You find the rhythm before you find the sights.',
      'You leave knowing how the city actually works.',
    ],
    primary: '#D4A030',
    secondary: '#F0C860',
    bgFrom: '#141004',
    bgTo: '#281E08',
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=390&h=260&fit=crop&q=80',
    social: {
      solo:   'You sit at the counter and order what the person next to you has.',
      couple: 'You find your morning ritual. You do it every day of the trip.',
      family: 'Your kids learn how a city actually works.',
      group:  'The thing that becomes the trip\'s running joke and best memory.',
    },
  },
};

// ── Legacy compat — kept for any downstream that reads ARCHETYPE_COLORS ─────
/** @deprecated Use PERSONA_DEFINITIONS[key].primary instead */
export const ARCHETYPE_COLORS: Record<string, { primary: string; glow: string }> = {
  flaneur:            { primary: '#E07040', glow: 'rgba(224,112,64,.22)' },
  gastronaut:         { primary: '#E84A2A', glow: 'rgba(232,74,42,.22)' },
  slowScholar:        { primary: '#7880D8', glow: 'rgba(120,128,216,.22)' },
  neighbourhoodLocal: { primary: '#3AB898', glow: 'rgba(58,184,152,.22)' },
  efficientExplorer:  { primary: '#3A90D8', glow: 'rgba(58,144,216,.22)' },
  aesthete:           { primary: '#C870B8', glow: 'rgba(200,112,184,.22)' },
  nightCreature:      { primary: '#8A50D8', glow: 'rgba(138,80,216,.22)' },
  ritualSeeker:       { primary: '#D4A030', glow: 'rgba(212,160,48,.22)' },
  // legacy keys (kept for stored personas)
  voyager:       { primary: '#4f8fab', glow: 'rgba(79,143,171,.22)' },
  wanderer:      { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' },
  epicurean:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)' },
  historian:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)' },
  pulse:         { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' },
  slowtraveller: { primary: '#6b9470', glow: 'rgba(107,148,112,.22)' },
  explorer:      { primary: '#6b9470', glow: 'rgba(107,148,112,.22)' },
};
