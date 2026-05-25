import type { TripUpdateCard } from '../../shared/types';

const KIND_CONFIG: Record<string, { emoji: string; borderColour: string; bgColour: string }> = {
  event:        { emoji: '🎉', borderColour: 'var(--color-sky-bdr)',   bgColour: 'var(--color-sky-bg)'   },
  hours_change: { emoji: '⚠️', borderColour: 'var(--color-amber-bdr)', bgColour: 'var(--color-amber-bg)' },
  weather:      { emoji: '🌧', borderColour: 'var(--color-sky-bdr)',   bgColour: 'var(--color-sky-bg)'   },
};

interface Props {
  card: TripUpdateCard;
  onAction: (card: TripUpdateCard) => void;
  onDismiss: (id: string) => void;
}

export function UpdateCard({ card, onAction, onDismiss }: Props) {
  const cfg = KIND_CONFIG[card.kind] ?? KIND_CONFIG.event;

  return (
    <div
      className="flex-shrink-0 rounded-2xl p-3.5 border flex flex-col gap-2"
      style={{
        width: 180,
        background: cfg.bgColour,
        borderColor: cfg.borderColour,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-base leading-none">{cfg.emoji}</span>
        <button
          onClick={() => onDismiss(card.id)}
          className="text-[var(--color-text-4)] text-xs leading-none"
        >✕</button>
      </div>

      <div>
        <p className="text-[var(--color-text-1)] text-xs font-semibold leading-snug">{card.title}</p>
        {card.detail && (
          <p className="text-[var(--color-text-3)] text-[10px] mt-1 leading-snug">{card.detail}</p>
        )}
        {card.affectedStop && (
          <p className="text-[var(--color-text-4)] text-[10px] mt-1">Near: {card.affectedStop}</p>
        )}
      </div>

      {card.actionLabel && (
        <button
          onClick={() => onAction(card)}
          className="w-full py-1.5 rounded-xl text-[10px] font-bold text-white"
          style={{ background: 'var(--color-sky-bg)', border: '1px solid var(--color-sky-bdr)' }}
        >
          {card.actionLabel}
        </button>
      )}
    </div>
  );
}
