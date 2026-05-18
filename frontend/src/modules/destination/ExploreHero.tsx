import { useState } from 'react';
import { getCityPhotoUrl } from '../../shared/cityPhoto';
import type { Persona } from '../../shared/types';

interface ExploreHeroProps {
  city: string | null;
  persona: Persona | null;
  savedTripCity?: string | null;
  userName: string;
}

const ARCHETYPE_KEYWORDS: Record<string, string> = {
  historian:     'rome,colosseum',
  epicurean:     'tokyo,food',
  wanderer:      'lisbon,portugal',
  voyager:       'london,bigben',
  explorer:      'kyoto,japan',
  slowtraveller: 'amsterdam,canals',
  pulse:         'istanbul,turkey',
};

const FALLBACK_PHOTO = 'https://source.unsplash.com/featured/800x600?travel,city';

export function ExploreHero({ city, persona, savedTripCity, userName }: ExploreHeroProps) {
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Good morning'
    : hour >= 12 && hour < 17 ? 'Good afternoon'
    : hour >= 17 && hour < 21 ? 'Good evening'
    : 'Good night';

  let initialPhoto: string;
  if (city) {
    initialPhoto = getCityPhotoUrl(city);
  } else if (savedTripCity) {
    initialPhoto = getCityPhotoUrl(savedTripCity);
  } else if (persona?.archetype && ARCHETYPE_KEYWORDS[persona.archetype]) {
    initialPhoto = `https://source.unsplash.com/featured/800x600?${ARCHETYPE_KEYWORDS[persona.archetype]}`;
  } else {
    initialPhoto = FALLBACK_PHOTO;
  }

  const [photoUrl, setPhotoUrl] = useState(initialPhoto);

  const watermarkLabel = city ? city.toUpperCase() : 'EXPLORE';

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden"
      style={{
        height: 236,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0px)',
      }}
    >
      {/* Background image with Ken Burns animation */}
      <img
        src={photoUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{ animation: 'heroKenBurns 12s ease-in-out infinite alternate' }}
        onError={() => setPhotoUrl(FALLBACK_PHOTO)}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,.3) 0%, rgba(0,0,0,.1) 50%, rgba(0,0,0,.55) 100%)',
        }}
      />

      {/* Watermark text */}
      <div
        className="absolute bottom-0 left-0 font-[family-name:var(--font-heading)] select-none pointer-events-none leading-none"
        style={{
          fontSize: 96,
          color: 'rgba(255,255,255,.04)',
        }}
      >
        {watermarkLabel}
      </div>

      {/* Greeting + name overlay */}
      <div
        className="absolute bottom-3 left-4"
        style={{
          color: 'rgba(255,255,255,.9)',
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        {greeting}, {userName}
      </div>

      {/* App icon tile */}
      <div
        className="absolute bottom-3 right-4 flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(255,255,255,.15)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ color: 'var(--color-primary)', fontSize: 22 }}
        >
          explore
        </span>
      </div>
    </div>
  );
}
