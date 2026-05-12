import { useState, useEffect } from 'react';
import { getPlacePhotoUrl } from '../../shared/api';
import type { Place } from '../../shared/types';

const MAX_DOTS = 5;

interface Props {
  city: string;
  selectedPlaces: Place[];
  startDate: string | null;
  endDate: string | null;
  onTap: () => void;
}

export function DraftBanner({ city, selectedPlaces, startDate, onTap }: Props) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);

  useEffect(() => {
    const photoRef = selectedPlaces.find(p => p.photo_ref)?.photo_ref ?? null;
    if (!photoRef) { setThumbSrc(null); return; }
    const url = getPlacePhotoUrl(photoRef, 100);
    const img = new Image();
    img.onload = () => setThumbSrc(url);
    img.onerror = () => setThumbSrc(null);
    img.src = url;
  }, [selectedPlaces]);

  const filledDots = Math.min(selectedPlaces.length, MAX_DOTS);
  const dateLabel = startDate
    ? new Date(startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : 'No dates';

  return (
    <button
      onClick={onTap}
      className="mx-3 mb-2.5 flex items-center gap-2.5 px-3 py-2.5 rounded-xl active:scale-[.99] transition-transform"
      style={{
        width: 'calc(100% - 24px)',
        background: 'rgba(176,108,255,0.07)',
        border: '1px solid rgba(176,108,255,0.12)',
      }}
    >
      {/* Thumbnail */}
      <div
        className="w-8 h-8 rounded-lg flex-shrink-0"
        style={{
          backgroundImage: thumbSrc ? `url(${thumbSrc})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: thumbSrc ? undefined : 'rgba(176,108,255,0.15)',
        }}
      />
      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-white/85 text-[11px] font-semibold truncate">{city} draft</p>
        <p className="text-white/35 text-[9px] mt-0.5">
          {dateLabel} · {selectedPlaces.length} stop{selectedPlaces.length !== 1 ? 's' : ''}
        </p>
        {/* Progress dots */}
        <div className="flex gap-1 mt-1">
          {Array.from({ length: MAX_DOTS }).map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: i < filledDots ? '#b06cff' : 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>
      </div>
      <span className="ms text-white/20 text-base flex-shrink-0">chevron_right</span>
    </button>
  );
}
