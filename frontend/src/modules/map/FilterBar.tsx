import { useState } from 'react';
import type { MapFilter } from '../../shared/types';
import { FILTER_CHIPS } from './types';

interface Props {
  active: MapFilter;
  counts: Partial<Record<string, number>>;
  onSelect: (filter: MapFilter) => void;
}

export function FilterBar({ active, counts, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);

  function handleSelect(key: MapFilter) {
    onSelect(key);
    setExpanded(false);
  }

  const activeChip = FILTER_CHIPS.find(c => c.key === active) ?? FILTER_CHIPS[0];
  const activeCount = counts[active];

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 px-3 h-7 rounded-full bg-primary text-white text-[11px] font-medium"
      >
        {activeChip.label}
        {activeCount !== undefined && (
          <span className="text-white/65 text-[10px]">{activeCount}</span>
        )}
        <span className="ms text-[13px] text-white/60">chevron_right</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setExpanded(false)}
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-text-3"
        style={{ background: 'rgba(15,20,30,.8)', border: '1px solid rgba(255,255,255,.1)' }}
      >
        <span className="ms text-sm">chevron_left</span>
      </button>

      <div className="relative flex-1 overflow-hidden">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {FILTER_CHIPS.map(chip => {
            const isActive = active === chip.key;
            const count = counts[chip.key];

            let cls = 'flex-shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ';
            let style: React.CSSProperties = {};

            if (isActive) {
              cls += 'bg-primary text-white';
            } else if (chip.key === 'recommended') {
              cls += 'text-amber-400';
              style = { background: 'rgba(35,22,4,.88)', border: '1px solid rgba(245,158,11,.35)' };
            } else if (chip.key === 'event') {
              cls += 'text-violet-400';
              style = { background: 'rgba(22,14,38,.88)', border: '1px solid rgba(167,139,250,.35)' };
            } else {
              cls += 'text-text-2';
              style = { background: 'rgba(15,20,30,.8)', border: '1px solid rgba(255,255,255,.1)' };
            }

            return (
              <button
                key={chip.key}
                onClick={() => handleSelect(chip.key as MapFilter)}
                className={cls}
                style={style}
              >
                {chip.label}
                {count !== undefined && (
                  <span className="text-[10px] opacity-55">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Fade indicator — signals more chips off-screen */}
        <div
          className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent, rgba(13,17,23,.88))' }}
        />
      </div>
    </div>
  );
}
