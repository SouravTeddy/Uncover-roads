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

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="ms text-text-3 text-sm flex-shrink-0 mt-0.5">{icon}</span>
      <span className="text-text-2 text-xs leading-relaxed">{text}</span>
    </div>
  );
}

export function PinCard({ place, city, isSelected, onAdd, onClose }: Props) {
  const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
  const label = CATEGORY_LABELS[place.category] ?? 'Place';

  const [imageUrl, setImageUrl] = useState<string | null>(place.imageUrl ?? null);
  const [imageLoading, setImageLoading] = useState(!place.imageUrl);

  useEffect(() => {
    if (place.imageUrl) return;
    let cancelled = false;
    setImageLoading(true);
    api.placeImage(place.title, city).then(url => {
      if (!cancelled) {
        setImageUrl(url);
        setImageLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [place.title, place.imageUrl, city]);

  const tags = place.tags ?? {};
  const infoRows: { icon: string; text: string }[] = [];
  if (tags.opening_hours) infoRows.push({ icon: 'schedule', text: tags.opening_hours });
  if (tags.cuisine) infoRows.push({ icon: 'restaurant_menu', text: `Cuisine: ${tags.cuisine}` });
  if (tags.fee && tags.fee !== 'no') infoRows.push({ icon: 'confirmation_number', text: `Entry: ${tags.fee}` });
  if (tags.description) infoRows.push({ icon: 'info', text: tags.description });

  function handleExplore() {
    const q = encodeURIComponent(`${place.title} ${city}`);
    window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="bg-surface rounded-2xl shadow-2xl border border-white/8 overflow-hidden"
      style={{ maxWidth: 360, margin: '0 auto' }}
    >
      {/* Image */}
      <div className="relative w-full h-32">
        {imageLoading && (
          <div className="absolute inset-0 bg-bg flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-text-3 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {imageUrl && !imageLoading ? (
          <img src={imageUrl} alt={place.title} className="w-full h-full object-cover" />
        ) : !imageLoading ? (
          <div className="w-full h-full bg-bg flex items-center justify-center">
            <span className="ms text-text-3 text-4xl">image</span>
          </div>
        ) : null}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
        >
          <span className="ms text-white text-base">close</span>
        </button>
      </div>

      <div className="p-4">
        {/* Category + title */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
            <span className="ms text-primary text-sm">{icon}</span>
          </div>
          <span className="text-text-3 text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <div className="font-heading font-bold text-text-1 text-base mb-2">{place.title}</div>

        {/* AI reason */}
        {place.reason && (
          <div className="flex items-start gap-1.5 mb-3 px-2 py-1.5 rounded-lg bg-primary/8 border border-primary/15">
            <span className="ms text-primary text-sm flex-shrink-0">auto_awesome</span>
            <span className="text-primary text-xs leading-relaxed">{place.reason}</span>
          </div>
        )}

        {/* OSM info rows */}
        {infoRows.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3 px-1">
            {infoRows.map((r, i) => <InfoRow key={i} icon={r.icon} text={r.text} />)}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-semibold text-sm transition-all ${
              isSelected
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-primary text-white'
            }`}
          >
            <span className="ms fill text-base">{isSelected ? 'check_circle' : 'add_circle'}</span>
            {isSelected ? 'Added' : 'Add to Itinerary'}
          </button>
          <button
            onClick={handleExplore}
            className="flex items-center gap-1 px-3 h-10 rounded-xl bg-surface border border-white/10 text-text-2 text-sm font-medium"
          >
            Explore <span className="ms text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
