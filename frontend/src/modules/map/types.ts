import type { Category } from '../../shared/types';

export interface FilterChip {
  key: Category | 'all' | 'recommended';
  label: string;
  icon: string;
}

export const FILTER_CHIPS: FilterChip[] = [
  { key: 'all',         label: 'All',       icon: 'layers' },
  { key: 'recommended', label: 'Our Picks', icon: 'auto_awesome' },
  { key: 'event',       label: 'Events',    icon: 'celebration' },
  { key: 'museum',      label: 'Museums',   icon: 'museum' },
  { key: 'park',        label: 'Parks',     icon: 'park' },
  { key: 'restaurant',  label: 'Dining',    icon: 'restaurant' },
  { key: 'historic',    label: 'Historic',  icon: 'account_balance' },
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
