// Unsplash source keywords — used with source.unsplash.com (no API key required)
const CITY_KEYWORDS: Record<string, string> = {
  'paris':       'paris,eiffel',
  'tokyo':       'tokyo,japan',
  'rome':        'rome,colosseum',
  'barcelona':   'barcelona,spain',
  'lisbon':      'lisbon,portugal',
  'london':      'london,bigben',
  'amsterdam':   'amsterdam,canals',
  'kyoto':       'kyoto,japan',
  'new york':    'newyork,manhattan',
  'istanbul':    'istanbul,turkey',
  'singapore':   'singapore,marinabay',
  'dubai':       'dubai,burjkhalifa',
  'bangkok':     'bangkok,thailand',
  'bali':        'bali,indonesia',
  'prague':      'prague,czech',
  'vienna':      'vienna,austria',
  'berlin':      'berlin,germany',
  'sydney':      'sydney,australia',
  'florence':    'florence,tuscany',
  'marrakech':   'marrakech,morocco',
};

const DEFAULT_KEYWORD = 'travel,city';

export function getCityPhotoUrl(cityName: string): string {
  const key = cityName.toLowerCase();
  const keyword = Object.entries(CITY_KEYWORDS).find(([k]) => key.includes(k))?.[1] ?? DEFAULT_KEYWORD;
  return `https://source.unsplash.com/featured/800x600?${keyword}`;
}
