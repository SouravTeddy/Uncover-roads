import type { MapFilter } from '../../shared/types';

export interface FilterChip {
  key: MapFilter;
  label: string;
  icon: string;
}

export const FILTER_CHIPS: FilterChip[] = [
  { key: 'all',     label: 'All',     icon: 'layers' },
  { key: 'curated', label: 'Curated', icon: 'auto_awesome' },
];

export const CATEGORY_ICONS: Record<string, string> = {
  restaurant:    'restaurant',
  cafe:          'local_cafe',
  park:          'park',
  museum:        'museum',
  historic:      'account_balance',
  tourism:       'photo_camera',
  place:         'location_on',
  event:         'celebration',
  bar:           'local_bar',
  nightlife:     'nightlife',
  viewpoint:     'landscape',
  gallery:       'palette',
  street_art:    'brush',
  bakery:        'bakery_dining',
  spa:           'spa',
  spiritual:     'temple_buddhist',
  stadium:       'stadium',
  zoo:           'pets',
  aquarium:      'water',
  library:       'local_library',
  cinema:        'theaters',
  amusement_park:'attractions',
  beach:         'beach_access',
  market:        'storefront',
  // seed_builder types
  coffee:        'local_cafe',
  lunch:         'restaurant',
  dinner:        'restaurant',
  breakfast:     'local_cafe',
  scenic_walk:   'park',
  rest:          'spa',
  micro:         'photo_camera',
};

export const CATEGORY_LABELS: Record<string, string> = {
  restaurant:    'Dining',
  cafe:          'Cafe',
  park:          'Park',
  museum:        'Museum',
  historic:      'Historic',
  tourism:       'Tourism',
  place:         'Place',
  event:         'Event',
  bar:           'Bar',
  nightlife:     'Nightlife',
  viewpoint:     'Viewpoint',
  gallery:       'Gallery',
  street_art:    'Street Art',
  bakery:        'Bakery',
  spa:           'Spa',
  spiritual:     'Spiritual',
  stadium:       'Stadium',
  zoo:           'Zoo',
  aquarium:      'Aquarium',
  library:       'Library',
  cinema:        'Cinema',
  amusement_park:'Theme Park',
  beach:         'Beach',
  market:        'Market',
};
