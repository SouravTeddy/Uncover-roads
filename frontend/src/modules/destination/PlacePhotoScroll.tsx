import { useState, useEffect } from 'react';
import { getPlacePhotoUrl } from '../../shared/api';
import type { Place } from '../../shared/types';

interface PlaceCardProps {
  place: Place;
  onTap: () => void;
}

function PlaceCard({ place, onTap }: PlaceCardProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!place.photo_ref) return;
    const url = getPlacePhotoUrl(place.photo_ref, 200);
    const img = new Image();
    img.onload = () => setImgSrc(url);
    img.onerror = () => setImgSrc(null);
    img.src = url;
  }, [place.photo_ref]);

  return (
    <button
      onClick={onTap}
      className="flex-shrink-0 rounded-xl overflow-hidden relative active:scale-95 transition-transform"
      style={{ width: 70, height: 84 }}
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: imgSrc ? `url(${imgSrc})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: imgSrc ? undefined : 'rgba(176,108,255,0.12)',
          opacity: 0.72,
        }}
      />
      {/* Gradient */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.05) 55%)' }}
      />
      {/* Check badge */}
      <div
        className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
        style={{ background: '#4ade80' }}
      >
        <span className="ms text-[8px] font-bold" style={{ color: '#000' }}>check</span>
      </div>
      {/* Name */}
      <p className="absolute bottom-1.5 left-1.5 right-1.5 text-white text-[8px] font-semibold leading-tight z-10">
        {place.title}
      </p>
    </button>
  );
}

interface Props {
  places: Place[];
  onPlaceTap: (place: Place) => void;
  onAddTap: () => void;
}

export function PlacePhotoScroll({ places, onPlaceTap, onAddTap }: Props) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-3 pb-3"
      style={{ scrollbarWidth: 'none' }}
    >
      {places.map(place => (
        <PlaceCard key={place.id} place={place} onTap={() => onPlaceTap(place)} />
      ))}
      {/* Add more card */}
      <button
        onClick={onAddTap}
        className="flex-shrink-0 rounded-xl flex flex-col items-center justify-center gap-1"
        style={{
          width: 70,
          height: 84,
          background: 'rgba(176,108,255,0.05)',
          border: '1px dashed rgba(176,108,255,0.18)',
        }}
      >
        <span className="ms text-lg" style={{ opacity: 0.3, color: '#b06cff' }}>add</span>
        <span className="text-[8px]" style={{ color: '#555' }}>Add place</span>
      </button>
    </div>
  );
}
