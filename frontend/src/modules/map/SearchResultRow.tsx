// modules/map/SearchResultRow.tsx
import type { NominatimResult } from './useSmartSearch';
import { CATEGORY_ICONS } from './types';
import { nominatimToCategory } from './useSmartSearch';

interface Props {
  result: NominatimResult;
  isLast: boolean;
  onNavigate: () => void;
  onOpenCard: () => void;
}

export function SearchResultRow({ result, isLast, onNavigate, onOpenCard }: Props) {
  const name    = result.name || result.display_name.split(',')[0];
  const address = result.display_name.split(',').slice(1, 3).join(',').trim();
  const category = nominatimToCategory(result.class, result.type);
  const icon     = CATEGORY_ICONS[category] ?? 'location_on';

  return (
    <div
      className="flex items-center"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,.05)' }}
    >
      {/* Left zone — navigate to pin */}
      <button
        onMouseDown={onNavigate}
        className="flex-1 flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 min-w-0"
      >
        <span className="ms fill text-primary flex-shrink-0" style={{ fontSize: 16 }}>{icon}</span>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          {address && <p className="text-white/35 text-xs truncate mt-0.5">{address}</p>}
        </div>
      </button>

      {/* Right zone — open PinCard */}
      <button
        onMouseDown={onOpenCard}
        className="flex-shrink-0 px-4 py-3 active:bg-white/5"
        aria-label="View details"
      >
        <span className="ms text-primary" style={{ fontSize: 20 }}>info</span>
      </button>
    </div>
  );
}
