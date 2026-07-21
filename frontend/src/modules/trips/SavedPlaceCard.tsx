import { useState, useEffect, useRef } from 'react';
import type { FavouritedPin } from '../../shared/types';
import { getPlacePhotoUrl, api } from '../../shared/api';

const CATEGORY_EMOJI: Record<string, string> = {
  historic: '🏛',
  museum:   '🏛',
  park:     '🌿',
  restaurant: '🍴',
  cafe:     '☕',
  tourism:  '🌊',
  place:    '📍',
  event:    '🎉',
};

interface Props {
  pin: FavouritedPin;
  category: string;
  tall?: boolean;
  onRemove: (placeId: string) => void;
  onClick: () => void;
}

export function SavedPlaceCard({ pin, category, tall = false, onRemove, onClick }: Props) {
  const emoji = CATEGORY_EMOJI[category] ?? '📍';
  const [imgSrc, setImgSrc] = useState<string | null>(
    pin.photoRef ? getPlacePhotoUrl(pin.photoRef, 600) : null
  );
  const fetchedFallback = useRef(false);

  async function fetchFallback() {
    if (fetchedFallback.current) return;
    fetchedFallback.current = true;
    const url = await api.placeImage(pin.title, pin.city, pin.placeId);
    if (url) setImgSrc(url);
    else setImgSrc(null);
  }

  // If photoRef was null at mount, try api.placeImage after 1.5s
  useEffect(() => {
    if (pin.photoRef) return;
    const timer = setTimeout(fetchFallback, 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      className="relative rounded-2xl overflow-hidden w-full text-left active:opacity-80"
      style={{
        background: 'var(--color-surface2)',
        gridRow: tall ? 'span 2' : 'span 1',
        minHeight: tall ? 180 : 88,
      }}
      onClick={onClick}
    >
      {/* Photo or emoji placeholder */}
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={pin.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={fetchFallback}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: tall ? 40 : 28, opacity: 0.18 }}
        >
          {emoji}
        </div>
      )}

      {/* Heart badge — top right */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(pin.placeId); }}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }}
        aria-label="Remove from saved"
      >
        <span style={{ fontSize: 14 }}>❤️</span>
      </button>

      {/* Label bottom */}
      <div
        className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-6"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.75), transparent)' }}
      >
        <p className="text-xs font-bold text-white leading-snug line-clamp-2">{pin.title}</p>
        <p className="text-[10px] mt-0.5 capitalize" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {category}
        </p>
      </div>
    </button>
  );
}
