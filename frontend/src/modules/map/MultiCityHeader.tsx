import type { CityFootprint } from '../../shared/types';

interface Props {
  cityFootprints: CityFootprint[];
  activeCityIdx: number;
  transitSummary: string;   // e.g. "Tokyo → Sydney · ✈️ ~9h flight" — empty string hides row
  onCityTap: (idx: number) => void;
  onAddCity: () => void;
}

export function MultiCityHeader({ cityFootprints, activeCityIdx, transitSummary, onCityTap, onAddCity }: Props) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15,20,30,.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* City tab strip */}
      <div
        className="flex items-center gap-2 px-3 pt-3 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {cityFootprints.map((f, idx) => {
          const isActive = idx === activeCityIdx;
          return (
            <button
              key={f.city}
              onClick={() => onCityTap(idx)}
              className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isActive ? 'var(--color-primary)' : 'var(--color-surface2)',
                border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: isActive ? '#fff' : 'var(--color-text-2)',
              }}
            >
              <span style={{ fontSize: 14 }}>{f.emoji}</span>
              <span>{f.city}</span>
              <span style={{ opacity: 0.65, fontWeight: 400 }}>· {f.pinCount}</span>
            </button>
          );
        })}
        {/* + city chip */}
        <button
          onClick={onAddCity}
          className="flex-shrink-0 flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold"
          style={{
            border: '1.5px dashed var(--color-text-3)',
            color: 'var(--color-text-3)',
            background: 'transparent',
          }}
        >
          <span className="ms" style={{ fontSize: 14 }}>add</span>
          city
        </button>
      </div>

      {/* Breadcrumb row — transit summary */}
      {transitSummary && (
        <div
          className="px-3 pb-2.5 text-[11px] font-medium"
          style={{ color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {transitSummary}
        </div>
      )}
    </div>
  );
}
