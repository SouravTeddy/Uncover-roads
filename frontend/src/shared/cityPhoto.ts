const CITY_PHOTOS: Record<string, string> = {
  'paris':     'photo-1499856871958-5b9627545d1a',
  'tokyo':     'photo-1540959733332-eab4deabeeaf',
  'rome':      'photo-1552832230-c0197dd311b5',
  'barcelona': 'photo-1583422409516-2895a77efded',
  'lisbon':    'photo-1585208798174-6cedd4b9b6e5',
  'london':    'photo-1520986606214-8b456906c813',
  'amsterdam': 'photo-1534351590666-13e3e96b5017',
  'kyoto':     'photo-1528360983277-13d401cdc186',
  'new york':  'photo-1496442226666-8d4d0e62e6e9',
  'istanbul':  'photo-1524231757912-21f4fe3a7200',
};

const DEFAULT_CITY_PHOTO = 'photo-1476514525405-09b77a9d1f66';

export function getCityPhotoUrl(cityName: string): string {
  const key = cityName.toLowerCase();
  const id = Object.entries(CITY_PHOTOS).find(([k]) => key.includes(k))?.[1] ?? DEFAULT_CITY_PHOTO;
  return `https://images.unsplash.com/${id}?w=600&q=75`;
}
