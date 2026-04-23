import { useState, useEffect } from 'react';
import { getPlacePhotoUrl } from '../../shared/api';
import type { Place } from '../../shared/types';

interface Props {
  city: string;
  selectedPlaces: Place[];
  startDate: string | null;
  endDate: string | null;
  onResume: () => void;
}

function useHeroImage(places: Place[]): string | null {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    const photoRef = places.find(p => p.photo_ref)?.photo_ref ?? null;
    if (!photoRef) { setImgSrc(null); return; }
    const url = getPlacePhotoUrl(photoRef, 600);
    const img = new Image();
    img.onload = () => setImgSrc(url);
    img.onerror = () => setImgSrc(null);
    img.src = url;
  }, [places]);

  return imgSrc;
}

function dateLabel(start: string | null, end: string | null): string {
  if (!start) return 'no dates set';
  const s = new Date(start).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  if (!end) return s;
  const e = new Date(end).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  return `${s} – ${e}`;
}

export function CityHeroCard({ city, selectedPlaces, startDate, endDate, onResume }: Props) {
  const imgSrc = useHeroImage(selectedPlaces);

  return (
    <div
      className="mx-3 mb-2 rounded-2xl overflow-hidden relative cursor-pointer active:scale-[.99] transition-transform"
      style={{ height: 86 }}
      onClick={onResume}
    >
      {/* Background image */}
      {imgSrc && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imgSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: imgSrc
            ? 'linear-gradient(135deg, rgba(10,10,20,0.76) 0%, rgba(30,20,60,0.52) 100%)'
            : 'linear-gradient(135deg, rgba(108,143,255,0.2), rgba(176,108,255,0.15))',
        }}
      />
      {/* Content */}
      <div className="relative z-10 p-3 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-heading font-bold text-white text-base leading-tight">{city}</p>
            <p className="text-white/45 text-[10px] mt-0.5">
              {selectedPlaces.length} place{selectedPlaces.length !== 1 ? 's' : ''} · {dateLabel(startDate, endDate)}
            </p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onResume(); }}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] text-white font-medium"
            style={{
              background: 'rgba(255,255,255,0.13)',
              border: '1px solid rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
            }}
          >
            Resume <span className="ms text-xs">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
