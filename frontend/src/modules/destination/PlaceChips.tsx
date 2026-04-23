import type { Place } from '../../shared/types';

interface Props {
  places: Place[];
  onChipTap: (place: Place) => void;
}

export function PlaceChips({ places, onChipTap }: Props) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-2 px-3"
      style={{ scrollbarWidth: 'none' }}
    >
      {places.map(place => (
        <button
          key={place.id}
          onClick={() => onChipTap(place)}
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium active:scale-95 transition-transform"
          style={{
            background: 'rgba(176,108,255,0.10)',
            border: '1px solid rgba(176,108,255,0.18)',
            color: '#c088ff',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: '#4ade80' }}
          />
          {place.name}
        </button>
      ))}
    </div>
  );
}
