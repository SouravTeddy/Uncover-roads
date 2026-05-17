import type { SavedEvent } from '../../shared/types';

const CATEGORY_EMOJI: Record<SavedEvent['category'], string> = {
  festival: '🎆',
  concert: '🎵',
  market: '🛍',
  sport: '⚽',
  exhibition: '🖼',
  other: '📅',
};

interface Props {
  event: SavedEvent;
  onRemove: (id: string) => void;
}

export function SavedEventCard({ event, onRemove }: Props) {
  const dateLabel = event.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: 'var(--color-amber-bg, rgba(196,152,64,.08))',
        border: '1px solid var(--color-amber-bdr, rgba(196,152,64,.2))',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{CATEGORY_EMOJI[event.category]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-1)] truncate">{event.title}</p>
        <p className="text-[11px] text-[var(--color-text-3)] truncate mt-0.5">
          {[dateLabel, event.isAnnual ? 'Annual' : null, event.venue].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ background: 'rgba(196,152,64,.15)', color: '#c49840' }}
        >
          Event
        </span>
        <button
          onClick={() => onRemove(event.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-surface2)' }}
          aria-label="Remove event"
        >
          <span className="ms text-[var(--color-text-3)]" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
    </div>
  );
}
