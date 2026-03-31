import { useEffect, useState } from 'react';
import type { Place } from '../../shared/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { api } from '../../shared/api';

interface Props {
  place: Place;
  city: string;
  isSelected: boolean;
  onAdd: () => void;
  onClose: () => void;
}

export function PinCard({ place, city, isSelected, onAdd, onClose }: Props) {
  const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
  const label = CATEGORY_LABELS[place.category] ?? 'Place';

  const [imageUrl, setImageUrl] = useState<string | null>(place.imageUrl ?? null);
  const [imageLoading, setImageLoading] = useState(!place.imageUrl);

  useEffect(() => {
    if (place.imageUrl) {
      setImageUrl(place.imageUrl);
      setImageLoading(false);
      return;
    }
    let cancelled = false;
    setImageLoading(true);
    setImageUrl(null);
    api.placeImage(place.title, city)
      .then(url => { if (!cancelled) { setImageUrl(url); setImageLoading(false); } })
      .catch(() => { if (!cancelled) setImageLoading(false); });
    return () => { cancelled = true; };
  }, [place.id, place.imageUrl, place.title, city]);

  function handleExplore() {
    const q = encodeURIComponent(`${place.title} ${city}`);
    window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="bg-surface rounded-2xl shadow-2xl border border-white/8 overflow-hidden relative"
      style={{ maxWidth: 380, margin: '0 auto' }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
      >
        <span className="ms text-white/80" style={{ fontSize: 14 }}>close</span>
      </button>

      {/* Main row: image + info */}
      <div className="flex gap-3 p-3 pr-10">
        {/* Thumbnail */}
        <div className="w-[72px] h-[72px] flex-shrink-0 rounded-xl overflow-hidden bg-bg/60 flex items-center justify-center">
          {imageLoading ? (
            <span className="w-4 h-4 border-2 border-text-3 border-t-transparent rounded-full animate-spin" />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={place.title}
              className="w-full h-full object-cover"
              onError={() => setImageUrl(null)}
            />
          ) : (
            <span className="ms text-text-3 text-2xl">{icon}</span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="ms text-primary" style={{ fontSize: 13 }}>{icon}</span>
            <span className="text-text-3 text-[10px] font-bold uppercase tracking-wider">{label}</span>
          </div>
          <div className="font-heading font-bold text-text-1 text-sm leading-snug line-clamp-2">
            {place.title}
          </div>
          {place.reason && (
            <div className="flex items-start gap-1 mt-0.5">
              <span className="ms text-primary flex-shrink-0" style={{ fontSize: 11 }}>auto_awesome</span>
              <span className="text-primary/90 leading-snug line-clamp-2" style={{ fontSize: 10 }}>
                {place.reason}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={onAdd}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl font-semibold text-xs transition-all ${
            isSelected
              ? 'bg-primary/15 text-primary border border-primary/25'
              : 'bg-primary text-white'
          }`}
        >
          <span className="ms fill" style={{ fontSize: 15 }}>
            {isSelected ? 'check_circle' : 'add_circle'}
          </span>
          {isSelected ? 'Added' : 'Add to Itinerary'}
        </button>
        <button
          onClick={handleExplore}
          className="flex items-center gap-1 px-3 h-9 rounded-xl border border-white/10 text-text-2 text-xs font-medium"
          style={{ background: 'rgba(255,255,255,.04)' }}
        >
          More
          <span className="ms" style={{ fontSize: 13 }}>open_in_new</span>
        </button>
      </div>
    </div>
  );
}
