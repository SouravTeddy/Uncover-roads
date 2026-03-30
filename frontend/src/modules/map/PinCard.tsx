import type { Place } from '../../shared/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';

interface Props {
  place: Place;
  isSelected: boolean;
  onAdd: () => void;
  onClose: () => void;
}

export function PinCard({ place, isSelected, onAdd, onClose }: Props) {
  const icon = CATEGORY_ICONS[place.category] ?? 'location_on';
  const label = CATEGORY_LABELS[place.category] ?? 'Place';

  return (
    <div
      className="absolute bottom-36 left-4 right-4 bg-surface rounded-2xl p-4 shadow-2xl z-20 border border-white/8"
      style={{ maxWidth: 360, margin: '0 auto' }}
    >
      {/* Image placeholder */}
      {place.imageUrl ? (
        <img
          src={place.imageUrl}
          alt={place.title}
          className="w-full h-28 object-cover rounded-xl mb-3"
        />
      ) : (
        <div className="w-full h-28 rounded-xl bg-bg mb-3 flex items-center justify-center">
          <span className="ms text-text-3 text-4xl">image</span>
        </div>
      )}

      {/* Top row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <span className="ms text-primary text-sm">{icon}</span>
          </div>
          <span className="text-text-3 text-xs font-semibold uppercase tracking-wide">{label}</span>
        </div>
        <button onClick={onClose} className="ms text-text-3 text-base">close</button>
      </div>

      <div className="font-heading font-bold text-text-1 text-base mb-1">{place.title}</div>

      {/* Actions */}
      <div className="flex gap-2 mt-3">
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
        <button className="flex items-center gap-1 px-3 h-10 rounded-xl bg-surface border border-white/10 text-text-2 text-sm font-medium">
          Explore <span className="ms text-sm">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
