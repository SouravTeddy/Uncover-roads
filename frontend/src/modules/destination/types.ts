export interface TrendingCity {
  name: string;
  description: string;
  imageUrl: string;
  badge?: string;
  size: 'lg' | 'md' | 'sm';
}

export const TRENDING_CITIES: TrendingCity[] = [
  {
    name: 'Tokyo',
    description: 'The neon-lit future of tradition.',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
    badge: 'Most Searched',
    size: 'lg',
  },
  {
    name: 'Paris',
    description: 'Romance in every cobblestone.',
    imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
    size: 'md',
  },
  {
    name: 'New York',
    description: '',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80',
    size: 'sm',
  },
  {
    name: 'Kyoto',
    description: '',
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
    size: 'sm',
  },
  {
    name: 'London',
    description: '',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
    size: 'sm',
  },
  {
    name: 'Bangalore',
    description: '',
    imageUrl: 'https://images.unsplash.com/photo-1566552881560-0be862a7c445?w=600&q=80',
    size: 'sm',
  },
];
