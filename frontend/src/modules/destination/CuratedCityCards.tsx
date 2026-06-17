import { useState, useEffect } from 'react';
import type { Persona } from '../../shared/types';
import { CITY_PHOTO_FALLBACK_GRADIENT } from '../../shared/cityPhoto';
import { useCityPhotoBatch } from './useCityPhoto';
import { ARCHETYPE_CITIES, DEFAULT_CITIES } from './types';

interface CuratedCityCardsProps {
  persona: Persona | null;
  onCitySelect: (city: string) => void;
}

export default function CuratedCityCards({ persona, onCitySelect }: CuratedCityCardsProps) {
  const archetype = persona?.archetype ?? null;
  const cities =
    archetype && ARCHETYPE_CITIES[archetype]
      ? ARCHETYPE_CITIES[archetype].slice(0, 6)
      : DEFAULT_CITIES;

  const cityNames = cities.map(c => c.name);
  const photoMap = useCityPhotoBatch(cityNames);

  const cardHeight = 188;

  return (
    <section className="px-4 pt-4 pb-2">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <h2
          style={{
            color: 'var(--color-text-2)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: 0,
            fontWeight: 600,
          }}
        >
          Destinations
        </h2>
      </div>

      {/* Horizontal scroll row */}
      <div
        className="flex gap-3 overflow-x-auto no-scrollbar"
        style={{ paddingBottom: 4 }}
      >
        {cities.map((city) => (
          <CityCard
            key={city.name}
            name={city.name}
            country={city.country}
            photoUrl={photoMap.get(city.name.toLowerCase()) ?? null}
            height={cardHeight}
            onSelect={() => onCitySelect(city.name)}
          />
        ))}
      </div>
    </section>
  );
}

interface CityCardProps {
  name: string;
  country: string;
  photoUrl: string | null;
  height: number;
  onSelect: () => void;
}

function CityCard({ name, country, photoUrl, height, onSelect }: CityCardProps) {
  const [activeSrc, setActiveSrc] = useState<string | null>(photoUrl);
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>(photoUrl ? 'loading' : 'error');

  useEffect(() => {
    setActiveSrc(photoUrl);
    setImgState(photoUrl ? 'loading' : 'error');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl]);

  const handleError = () => {
    setImgState('error');
  };

  const showShimmer = !activeSrc || imgState === 'loading';

  return (
    <button
      onClick={onSelect}
      className="flex-shrink-0 relative overflow-hidden rounded-2xl"
      style={{
        width: 136,
        height,
        padding: 0,
        border: 'none',
        cursor: 'pointer',
        background: imgState === 'error' ? CITY_PHOTO_FALLBACK_GRADIENT : '#1a1814',
      }}
    >
      {/* Shimmer while photo is loading or not yet available */}
      {showShimmer && (
        <div className="shimmer" style={{ position: 'absolute', inset: 0, background: '#1a1814', zIndex: 1 }} />
      )}

      {/* Background photo */}
      {activeSrc && imgState !== 'error' && (
        <img
          src={activeSrc}
          alt={name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            opacity: imgState === 'loaded' ? 1 : 0,
            transition: imgState === 'loaded' ? 'opacity 0.35s ease' : 'none',
            zIndex: 0,
          }}
          onLoad={() => setImgState('loaded')}
          onError={handleError}
        />
      )}

      {/* Dark gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.65) 100%)',
        }}
      />

      {/* Text content */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 10px 10px',
        }}
      >
        {/* City name */}
        <div
          style={{
            fontFamily: '"Cormorant Garamond", serif',
            color: '#ffffff',
            fontSize: 18,
            lineHeight: 1.15,
            fontWeight: 600,
          }}
        >
          {name}
        </div>

        {/* Country name */}
        <div
          style={{
            color: 'rgba(255,255,255,.7)',
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {country}
        </div>
      </div>
    </button>
  );
}
