// modules/map/FootprintChips.tsx
import type { CityFootprint } from '../../shared/types';

interface Props {
  footprints: CityFootprint[];
  activeCityIdx: number;
  onChipTap: (footprint: CityFootprint) => void;
}

export function FootprintChips({ footprints, activeCityIdx, onChipTap }: Props) {
  if (footprints.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      left: 12, right: 12,
      zIndex: 20,
      display: 'flex', gap: 8, overflowX: 'auto',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
    }}>
      {footprints.map((f, idx) => {
        const isActive = idx === activeCityIdx;
        return (
          <button
            key={f.city}
            onClick={() => onChipTap(f)}
            style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 14px',
              borderRadius: 999,
              background: isActive ? 'rgba(99,102,241,.25)' : 'rgba(15,20,30,.75)',
              border: isActive
                ? '1px solid rgba(99,102,241,.5)'
                : '1px solid rgba(255,255,255,.12)',
              backdropFilter: 'blur(12px)',
              color: isActive ? '#c7d2fe' : 'rgba(193,198,215,.8)',
              fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 16 }}>{f.emoji}</span>
            <span>{f.city}</span>
            <span style={{ color: isActive ? '#818cf8' : 'rgba(148,163,184,.6)', fontWeight: 400 }}>
              · {f.pinCount} {f.pinCount === 1 ? 'pin' : 'pins'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
