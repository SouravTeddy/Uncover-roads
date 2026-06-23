const CITY_PHOTOS: Record<string, string> = {
  'paris':      'photo-1499856871958-5b9627545d1a',
  'tokyo':      'photo-1540959733332-eab4deabeeaf',
  'rome':       'photo-1552832230-c0197dd311b5',
  'barcelona':  'photo-1583422409516-2895a77efded',
  'lisbon':     'photo-1585208798174-6cedd4b9b6e5',
  'london':     'photo-1520986606214-8b456906c813',
  'amsterdam':  'photo-1534351590666-13e3e96b5017',
  'kyoto':      'photo-1528360983277-13d401cdc186',
  'new york':   'photo-1496442226666-8d4d0e62e6e9',
  'istanbul':   'photo-1524231757912-21f4fe3a7200',
  'bangalore':  'photo-1596176530529-78163a4f7af2',
  'bengaluru':  'photo-1596176530529-78163a4f7af2',
  'mumbai':     'photo-1529253355930-ddbe423a2ac7',
  'delhi':      'photo-1587474260584-136574528ed5',
  'kolkata':    'photo-1558431382-27e303142255',
  'chennai':    'photo-1582510003544-4d00b7f74220',
  'hyderabad':  'photo-1600077106724-946750eeaf3c',
  'mysore':     'photo-1590050752117-238cb0fb12b1',
  'mysuru':     'photo-1590050752117-238cb0fb12b1',
  'jaipur':     'photo-1477587458883-47145ed6979e',
  'goa':        'photo-1512343879784-a960bf40e7f2',
  'sydney':     'photo-1506973035872-a4ec16b8e8d9',
  'melbourne':  'photo-1514395462421-da574b686dd2',
  'dubai':      'photo-1512453979798-5ea266f8880c',
  'singapore':  'photo-1525625293386-3f8f99389edd',
  'bangkok':    'photo-1563492065599-3520f775eeed',
  'bali':       'photo-1537996194471-e657df975ab4',
  'seoul':      'photo-1538485399081-7191377e8241',
  'berlin':     'photo-1560969184-10fe8719e047',
  'vienna':     'photo-1516550135131-fe3dcdd4bc96',
  'prague':     'photo-1519677100203-a0e668c92439',
  'budapest':   'photo-1549144511-f099e773c147',
};

const DEFAULT_CITY_PHOTO = 'photo-1488646953014-85cb44e25828';

export function getCityPhotoUrl(cityName: string): string {
  const key = cityName.toLowerCase();
  const id = Object.entries(CITY_PHOTOS).find(([k]) => key.includes(k))?.[1] ?? DEFAULT_CITY_PHOTO;
  return `https://images.unsplash.com/${id}?w=600&q=75`;
}

/** Gradient shown when image fails to load — matches the app's dark theme. */
export const CITY_PHOTO_FALLBACK_GRADIENT =
  'linear-gradient(135deg, #1a1f2e 0%, #0f141e 100%)';

/**
 * Consistent city label for both reel intro and trip cards.
 *   1 city  → "Paris"
 *   2 cities → "Paris +1"
 *   3 cities → "Paris +2"
 */
export function formatCityLabel(cities: string[]): string {
  const unique = [...new Set(cities.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? '';
  return `${unique[0]} +${unique.length - 1}`;
}
