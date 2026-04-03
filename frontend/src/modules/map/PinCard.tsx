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
  const tags = place.tags ?? {};

  const [imageUrl, setImageUrl] = useState<string | null>(place.imageUrl ?? null);
  const [imageLoading, setImageLoading] = useState(!place.imageUrl);

  useEffect(() => {
    if (place.imageUrl) {
      setImageUrl(place.imageUrl);
      setImageLoading(false);
      return;
    }
    // Events already carry their image from Ticketmaster — no Wikipedia lookup needed
    if (place.category === 'event') {
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
  }, [place.id, place.imageUrl, place.title, city, place.category]);


  const isEvent = place.category === 'event';

  // Format event date + time
  const eventDateLabel = (() => {
    if (!tags.event_date) return null;
    const d = new Date(`${tags.event_date}T00:00:00`);
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!tags.event_time) return date;
    const [h, m] = tags.event_time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${date} · ${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  })();

  // Compact info pills from OSM tags
  const infoPills: { icon: string; text: string }[] = [];
  if (isEvent) {
    if (eventDateLabel) infoPills.push({ icon: 'event', text: eventDateLabel });
    if (tags.venue)     infoPills.push({ icon: 'location_on', text: tags.venue });
    if (tags.genre)     infoPills.push({ icon: 'sell', text: tags.genre });
  } else {
    if (tags.opening_hours) infoPills.push({ icon: 'schedule', text: tags.opening_hours });
    if (tags.cuisine) infoPills.push({ icon: 'restaurant_menu', text: tags.cuisine.replace(/_/g, ' ') });
    if (tags.website) infoPills.push({ icon: 'language', text: 'Website' });
  }

  return (
    <div
      className="bg-surface rounded-2xl shadow-2xl border border-white/8 overflow-hidden relative"
      style={{ maxWidth: 400, margin: '0 auto' }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
      >
        <span className="ms text-white/70" style={{ fontSize: 14 }}>close</span>
      </button>

      {/* Main row: image + text */}
      <div className="flex gap-3 p-3 pr-10">
        {/* Thumbnail */}
        <div
          className="w-[72px] flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ height: 72, background: 'rgba(255,255,255,.05)' }}
        >
          {imageLoading ? (
            <span
              className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(255,255,255,.25)', borderTopColor: 'transparent' }}
            />
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={place.title}
              className="w-full h-full object-cover"
              onError={() => setImageUrl(null)}
            />
          ) : (
            // Category-icon fallback with subtle gradient
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(140deg, rgba(59,130,246,.15), rgba(59,130,246,.05))' }}
            >
              <span className="ms fill text-primary" style={{ fontSize: 26 }}>{icon}</span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="ms text-primary" style={{ fontSize: 12 }}>{icon}</span>
            <span className="text-text-3 font-bold uppercase tracking-wider" style={{ fontSize: 10 }}>{label}</span>
          </div>
          <div className="font-heading font-bold text-text-1 leading-snug line-clamp-2" style={{ fontSize: 14 }}>
            {place.title}
          </div>
        </div>
      </div>

      {/* Info pills row — hours, cuisine, etc. */}
      {infoPills.length > 0 && (
        <div className="flex gap-2 px-3 pb-2 flex-wrap">
          {infoPills.map((pill, i) => (
            pill.icon === 'language' ? (
              <button
                key={i}
                onClick={() => window.open(tags.website, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-1 px-2 h-6 rounded-full border border-white/10"
                style={{ background: 'rgba(255,255,255,.04)', fontSize: 10 }}
              >
                <span className="ms text-text-3" style={{ fontSize: 11 }}>{pill.icon}</span>
                <span className="text-text-3">{pill.text}</span>
              </button>
            ) : (
              <div key={i} className="flex items-center gap-1 px-2 h-6 rounded-full border border-white/10"
                   style={{ background: 'rgba(255,255,255,.04)' }}>
                <span className="ms text-text-3" style={{ fontSize: 11 }}>{pill.icon}</span>
                <span className="text-text-3 line-clamp-1" style={{ fontSize: 10, maxWidth: 140 }}>{pill.text}</span>
              </div>
            )
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={onAdd}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl font-heading font-bold transition-all ${
            isSelected
              ? 'bg-primary/15 text-primary border border-primary/25'
              : 'bg-primary text-white'
          }`}
          style={{ fontSize: 12 }}
        >
          <span className="ms fill" style={{ fontSize: 15 }}>
            {isSelected ? 'check_circle' : 'add_circle'}
          </span>
          {isSelected ? 'Added' : 'Add to Itinerary'}
        </button>
        <button
          onClick={() => {
            const url = isEvent && tags.website
              ? tags.website
              : `https://www.google.com/search?q=${encodeURIComponent(`${place.title} ${city}`)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          className="flex items-center gap-1 px-3 h-9 rounded-xl border border-white/10 text-text-2 font-medium"
          style={{ background: 'rgba(255,255,255,.04)', fontSize: 12 }}
        >
          {isEvent ? 'Tickets' : 'More'}
          <span className="ms" style={{ fontSize: 13 }}>open_in_new</span>
        </button>
      </div>
    </div>
  );
}
