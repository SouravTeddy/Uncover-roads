// frontend/src/modules/map/SearchNudge.tsx
import type { SuggestedChip } from './useSmartSearch';

interface Props {
  chips: SuggestedChip[];
  showZoomNudge: boolean;
  activeTypeLabel: string;
  onChipTap: (chip: SuggestedChip) => void;
}

export function SearchNudge({ chips, showZoomNudge, activeTypeLabel, onChipTap }: Props) {
  if (showZoomNudge) {
    return (
      <div
        className="mx-12 px-4 py-2 rounded-2xl text-xs flex items-center gap-2"
        style={{
          background: 'rgba(15,20,30,.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.08)',
          pointerEvents: 'auto',
        }}
      >
        <span className="ms text-primary flex-shrink-0" style={{ fontSize: 14 }}>zoom_in</span>
        <span className="text-white/60">
          Showing <span className="text-white/80">{activeTypeLabel}s</span> in this area.{' '}
          <span className="text-primary">Zoom in</span> for more accurate results.
        </span>
      </div>
    );
  }

  if (chips.length === 0) return null;

  return (
    <div
      className="mx-12 px-4 py-3 rounded-2xl"
      style={{
        background: 'rgba(15,20,30,.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.08)',
        pointerEvents: 'auto',
      }}
    >
      <p className="text-white/40 text-xs mb-2">We're still learning — try one of these</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.type + chip.label}
            type="button"
            onMouseDown={() => onChipTap(chip)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:opacity-70"
            style={{
              background: 'rgba(124,140,248,.15)',
              border: '1px solid rgba(124,140,248,.3)',
              color: '#9aa0f5',
            }}
          >
            <span>{chip.emoji}</span>
            <span>{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
