import type { MapFilter } from '../../shared/types';
import { FILTER_CHIPS } from './types';

interface Props {
  active: MapFilter;
  counts: Partial<Record<string, number>>;
  onSelect: (filter: MapFilter) => void;
}

export function FilterBar({ active, counts, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {FILTER_CHIPS.map(chip => {
        const isActive = active === chip.key;
        const count = counts[chip.key];
        return (
          <button
            key={chip.key}
            onClick={() => onSelect(chip.key as MapFilter)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold transition-all ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-surface text-text-2 border border-white/10'
            }`}
          >
            <span className="ms fill text-sm">{chip.icon}</span>
            {chip.label}
            {count !== undefined && (
              <span className={`text-xs ${isActive ? 'text-white/80' : 'text-text-3'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
