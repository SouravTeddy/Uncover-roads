import type { FavouritedPin } from '../../shared/types';

// Gradient backgrounds per category spec
const CATEGORY_GRADIENT: Record<string, string> = {
  historic:    'linear-gradient(135deg, #2d1f18, #1a130e)',
  museum:      'linear-gradient(135deg, #2d1f18, #1a130e)',
  park:        'linear-gradient(135deg, #1a2018, #111a0e)',
  restaurant:  'linear-gradient(135deg, #201818, #150f0f)',
  cafe:        'linear-gradient(135deg, #201818, #150f0f)',
  tourism:     'linear-gradient(135deg, #182028, #0f1620)',
};

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
  tall?: boolean;     // first card in group spans 2 rows
  onRemove: (placeId: string) => void;
}

export function SavedPlaceCard({ pin, category, tall = false, onRemove }: Props) {
  const gradient = CATEGORY_GRADIENT[category] ?? 'linear-gradient(135deg, var(--color-surface2), var(--color-bg2))';
  const emoji = CATEGORY_EMOJI[category] ?? '📍';

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: gradient,
        gridRow: tall ? 'span 2' : 'span 1',
        minHeight: tall ? 180 : 88,
      }}
    >
      {/* Emoji placeholder */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: tall ? 40 : 28, opacity: 0.18 }}
      >
        {emoji}
      </div>

      {/* Heart badge — top right */}
      <button
        onClick={() => onRemove(pin.placeId)}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }}
        aria-label="Remove from saved"
      >
        <span style={{ fontSize: 14 }}>❤️</span>
      </button>

      {/* Label bottom */}
      <div
        className="absolute bottom-0 inset-x-0 px-3 pb-3 pt-6"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.65), transparent)' }}
      >
        <p className="text-xs font-bold text-white leading-snug line-clamp-2">{pin.title}</p>
        <p className="text-[10px] mt-0.5 capitalize"
          style={{ color: 'var(--color-text-3)' }}
        >
          {category}
        </p>
      </div>
    </div>
  );
}
