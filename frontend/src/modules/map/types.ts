import type { MapFilter } from '../../shared/types';

export interface FilterChip {
  key: MapFilter;
  label: string;
  icon: string;
}

export const FILTER_CHIPS: FilterChip[] = [
  { key: 'all',         label: 'All',          icon: 'layers' },
  { key: 'trending',    label: 'Trending',      icon: 'trending_up' },
  { key: 'hidden_gems', label: 'Hidden Gems',   icon: 'diamond' },
  { key: 'event',       label: 'Events',        icon: 'celebration' },
  { key: 'picks',       label: 'Picks',         icon: 'auto_awesome' },
];

export const CATEGORY_ICONS: Record<string, string> = {
  restaurant: 'restaurant',
  cafe:       'local_cafe',
  park:       'park',
  museum:     'museum',
  historic:   'account_balance',
  tourism:    'photo_camera',
  place:      'location_on',
  event:      'celebration',
};

export const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Dining',
  cafe:       'Cafe',
  park:       'Park',
  museum:     'Museum',
  historic:   'Historic',
  tourism:    'Tourism',
  place:      'Place',
  event:      'Event',
};
