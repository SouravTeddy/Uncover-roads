export interface CityCard {
  name: string;
  country: string;
  emoji: string;
}

export const ARCHETYPE_CITIES: Record<string, CityCard[]> = {
  historian: [
    { name: 'Rome',       country: 'Italy',          emoji: '🏛️' },
    { name: 'Athens',     country: 'Greece',         emoji: '⚡' },
    { name: 'Istanbul',   country: 'Turkey',         emoji: '🕌' },
    { name: 'Kyoto',      country: 'Japan',          emoji: '⛩️' },
    { name: 'Cairo',      country: 'Egypt',          emoji: '🏺' },
    { name: 'Prague',     country: 'Czech Republic', emoji: '🏰' },
  ],
  epicurean: [
    { name: 'Barcelona',    country: 'Spain',    emoji: '🥘' },
    { name: 'Tokyo',        country: 'Japan',    emoji: '🍜' },
    { name: 'Naples',       country: 'Italy',    emoji: '🍕' },
    { name: 'Bangkok',      country: 'Thailand', emoji: '🌶️' },
    { name: 'Lyon',         country: 'France',   emoji: '🥐' },
    { name: 'Mexico City',  country: 'Mexico',   emoji: '🌮' },
  ],
  wanderer: [
    { name: 'Lisbon',      country: 'Portugal',   emoji: '🌊' },
    { name: 'Tbilisi',     country: 'Georgia',    emoji: '🍷' },
    { name: 'Porto',       country: 'Portugal',   emoji: '🌉' },
    { name: 'Marrakech',   country: 'Morocco',    emoji: '🌴' },
    { name: 'Chiang Mai',  country: 'Thailand',   emoji: '🐘' },
    { name: 'Medellín',    country: 'Colombia',   emoji: '🌺' },
  ],
  voyager: [
    { name: 'Singapore',  country: 'Singapore',     emoji: '🦁' },
    { name: 'Dubai',      country: 'UAE',           emoji: '🏙️' },
    { name: 'Hong Kong',  country: 'China',         emoji: '🌃' },
    { name: 'Sydney',     country: 'Australia',     emoji: '🦘' },
    { name: 'Reykjavik',  country: 'Iceland',       emoji: '🌋' },
    { name: 'Cape Town',  country: 'South Africa',  emoji: '🌍' },
  ],
  explorer: [
    { name: 'Queenstown',  country: 'New Zealand',  emoji: '🏔️' },
    { name: 'Banff',       country: 'Canada',       emoji: '🦌' },
    { name: 'Reykjavik',   country: 'Iceland',      emoji: '🌋' },
    { name: 'Interlaken',  country: 'Switzerland',  emoji: '⛰️' },
    { name: 'Kathmandu',   country: 'Nepal',        emoji: '🏔️' },
    { name: 'Ushuaia',     country: 'Argentina',    emoji: '🦅' },
  ],
  slowtraveller: [
    { name: 'Kyoto',          country: 'Japan',   emoji: '🌸' },
    { name: 'Ubud',           country: 'Bali',    emoji: '🌿' },
    { name: 'Santorini',      country: 'Greece',  emoji: '🌅' },
    { name: 'Florence',       country: 'Italy',   emoji: '🎨' },
    { name: 'Oaxaca',         country: 'Mexico',  emoji: '🎭' },
    { name: 'Luang Prabang',  country: 'Laos',    emoji: '🙏' },
  ],
  pulse: [
    { name: 'Berlin',     country: 'Germany',      emoji: '🎵' },
    { name: 'Bangkok',    country: 'Thailand',     emoji: '🌆' },
    { name: 'Miami',      country: 'USA',          emoji: '🏖️' },
    { name: 'Amsterdam',  country: 'Netherlands',  emoji: '🚲' },
    { name: 'Seoul',      country: 'South Korea',  emoji: '✨' },
    { name: 'Ibiza',      country: 'Spain',        emoji: '🎉' },
  ],
};

// Fallback cities shown before persona is created
export const DEFAULT_CITIES: CityCard[] = [
  { name: 'Tokyo',     country: 'Japan',       emoji: '🌸' },
  { name: 'Paris',     country: 'France',      emoji: '🗼' },
  { name: 'New York',  country: 'USA',         emoji: '🗽' },
  { name: 'Lisbon',    country: 'Portugal',    emoji: '🌊' },
  { name: 'Bangkok',   country: 'Thailand',    emoji: '🌴' },
  { name: 'Rome',      country: 'Italy',       emoji: '🏛️' },
];
