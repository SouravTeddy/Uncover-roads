import { useState, useEffect } from 'react';
import { CITY_PHOTO_FALLBACK_GRADIENT } from '../../shared/cityPhoto';
import { useCityPhoto } from './useCityPhoto';
import { preloadImages } from '../../shared/imagePreloader';
import type { Persona } from '../../shared/types';

interface ExploreHeroProps {
  city: string | null;
  persona: Persona | null;
  savedTripCity?: string | null;
  userName: string;
}

const ARCHETYPE_PHOTOS: Record<string, string> = {
  historian:     'photo-1552832230-c0197dd311b5',  // Rome
  epicurean:     'photo-1540959733332-eab4deabeeaf', // Tokyo food
  wanderer:      'photo-1585208798174-6cedd4b9b6e5', // Lisbon
  voyager:       'photo-1520986606214-8b456906c813', // London
  explorer:      'photo-1528360983277-13d401cdc186', // Kyoto
  slowtraveller: 'photo-1534351590666-13e3e96b5017', // Amsterdam
  pulse:         'photo-1524231757912-21f4fe3a7200', // Istanbul night
};

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80';

export function ExploreHero({ city, persona, savedTripCity, userName }: ExploreHeroProps) {
  const [imgFailed, setImgFailed] = useState(false);


  // DB-backed photo for the active or last-visited city
  const primaryCity = city ?? savedTripCity ?? null;
  const dbPhotoUrl = useCityPhoto(primaryCity);

  let photoUrl: string;
  if ((city || savedTripCity) && dbPhotoUrl) {
    photoUrl = dbPhotoUrl;
  } else if (persona?.archetype && ARCHETYPE_PHOTOS[persona.archetype]) {
    photoUrl = `https://images.unsplash.com/${ARCHETYPE_PHOTOS[persona.archetype]}?w=800&q=80`;
  } else {
    photoUrl = FALLBACK_PHOTO;
  }

  const [activeSrc, setActiveSrc] = useState(photoUrl);
  useEffect(() => {
    setActiveSrc(photoUrl);
    setImgFailed(false);
    preloadImages([photoUrl]);
  }, [photoUrl]);

  const handleError = () => {
    if (activeSrc !== FALLBACK_PHOTO) {
      setActiveSrc(FALLBACK_PHOTO);
    } else {
      setImgFailed(true);
    }
  };

  const watermarkLabel = city ? city.toUpperCase() : null;

  return (
    <div
      className="relative flex-shrink-0 overflow-hidden"
      style={{
        height: 236,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0px)',
        background: imgFailed ? CITY_PHOTO_FALLBACK_GRADIENT : undefined,
      }}
    >
      {/* Background image with Ken Burns animation */}
      {!imgFailed && (
        <img
          key={activeSrc}
          src={activeSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ animation: 'heroKenBurns 12s ease-in-out infinite alternate' }}
          onError={handleError}
        />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,.3) 0%, rgba(0,0,0,.1) 50%, rgba(0,0,0,.55) 100%)',
        }}
      />

      {/* Watermark text — only when a city is set */}
      {watermarkLabel && (
        <div
          className="absolute bottom-0 left-0 font-[family-name:var(--font-heading)] select-none pointer-events-none leading-none"
          style={{
            fontSize: 96,
            color: 'rgba(255,255,255,.04)',
          }}
        >
          {watermarkLabel}
        </div>
      )}

      {/* Greeting + quote overlay */}
      <div
        className="absolute bottom-3 left-4"
        style={{
          maxWidth: '75%',
          background: 'rgba(0,0,0,0.28)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '10px 14px',
        }}
      >
        <div style={{ color: 'rgba(255,255,255,.95)', fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>
          The world won't wait, {userName}.
        </div>
        <div style={{ color: 'rgba(255,255,255,.82)', fontSize: 12, fontWeight: 400, marginTop: 4, fontStyle: 'italic' }}>
          "To travel is to live." — H.C. Andersen
        </div>
      </div>

    </div>
  );
}
