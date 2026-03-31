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

/** Per-archetype accent color + glow */
export const ARCHETYPE_COLORS: Record<string, { primary: string; glow: string }> = {
  voyager:       { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)'  },
  wanderer:      { primary: '#14b8a6', glow: 'rgba(20,184,166,.22)'  },
  epicurean:     { primary: '#f97316', glow: 'rgba(249,115,22,.22)'  },
  historian:     { primary: '#d97706', glow: 'rgba(217,119,6,.22)'   },
  pulse:         { primary: '#ec4899', glow: 'rgba(236,72,153,.22)'  },
  slowtraveller: { primary: '#22c55e', glow: 'rgba(34,197,94,.22)'   },
  explorer:      { primary: '#0ea5e9', glow: 'rgba(14,165,233,.22)'  },
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
