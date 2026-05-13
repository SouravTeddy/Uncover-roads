export const ARCHETYPE_EMOJI: Record<string, string> = {
  voyager:       '✦',
  wanderer:      '◈',
  epicurean:     '◉',
  historian:     '◎',
  pulse:         '◈',
  slowtraveller: '◇',
  explorer:      '◆',
};

export const TRAIT_COLORS = {
  artistic:   '#47A1FF',
  culinary:   '#70F8E8',
  efficiency: '#FFB86B',
  urban:      '#C1C6D7',
} as const;

/** Per-archetype accent color + glow — warm editorial palette */
export const ARCHETYPE_COLORS: Record<string, { primary: string; glow: string }> = {
  voyager:       { primary: '#4f8fab', glow: 'rgba(79,143,171,.22)'   },  // sky
  wanderer:      { primary: '#d4a853', glow: 'rgba(212,168,83,.22)'   },  // amber/gold primary
  epicurean:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)'   },  // amber
  historian:     { primary: '#c49840', glow: 'rgba(196,152,64,.22)'   },  // amber
  pulse:         { primary: '#d4a853', glow: 'rgba(212,168,83,.22)'   },  // amber/gold primary
  slowtraveller: { primary: '#6b9470', glow: 'rgba(107,148,112,.22)'  },  // sage
  explorer:      { primary: '#6b9470', glow: 'rgba(107,148,112,.22)'  },  // sage
};

export const ARCHETYPE_SHORT: Record<string, string> = {
  voyager:       'Voyager',
  wanderer:      'Wanderer',
  epicurean:     'Epicurean',
  historian:     'Historian',
  pulse:         'Pulse Seeker',
  slowtraveller: 'Slow Traveller',
  explorer:      'Explorer',
};

export const VENUE_ICONS: Record<string, string> = {
  restaurant: 'restaurant',
  museum:     'museum',
  historic:   'account_balance',
  gallery:    'palette',
  market:     'storefront',
  park:       'park',
  local:      'home_pin',
  cafe:       'local_cafe',
  bar:        'local_bar',
  club:       'nightlife',
  rooftop:    'balcony',
  tourism:    'photo_camera',
  outdoor:    'landscape',
  monument:   'account_balance',
};

export const BIAS_ICONS: Record<string, string> = {
  design:        'architecture',
  heritage:      'account_balance',
  gastronomy:    'restaurant',
  neighbourhood: 'home_pin',
  markets:       'storefront',
  local:         'people',
  food:          'ramen_dining',
  wine:          'wine_bar',
  nightlife:     'nightlife',
  events:        'event',
  museum:        'museum',
  culture:       'palette',
  varied:        'grid_view',
  outdoor:       'landscape',
  adventure:     'hiking',
  'café':        'local_cafe',
};
