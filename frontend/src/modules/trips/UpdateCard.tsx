import type { TripUpdateCard } from '../../shared/types';

const KIND_CONFIG: Record<string, { emoji: string; borderColour: string; bgColour: string }> = {
  event:        { emoji: '🎉', borderColour: 'rgba(99,102,241,.3)',  bgColour: 'rgba(99,102,241,.06)'  },
  hours_change: { emoji: '⚠️', borderColour: 'rgba(245,158,11,.3)',  bgColour: 'rgba(245,158,11,.06)'  },
  weather:      { emoji: '🌧', borderColour: 'rgba(96,165,250,.3)',  bgColour: 'rgba(96,165,250,.06)'  },
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
          className="text-white/25 text-xs leading-none"
        >✕</button>
      </div>

      <div>
        <p className="text-white/80 text-xs font-semibold leading-snug">{card.title}</p>
        {card.detail && (
          <p className="text-white/40 text-[10px] mt-1 leading-snug">{card.detail}</p>
        )}
        {card.affectedStop && (
          <p className="text-white/30 text-[10px] mt-1">Near: {card.affectedStop}</p>
        )}
      </div>

      {card.actionLabel && (
        <button
          onClick={() => onAction(card)}
          className="w-full py-1.5 rounded-xl text-[10px] font-bold text-white"
          style={{ background: 'rgba(99,102,241,.3)', border: '1px solid rgba(99,102,241,.4)' }}
        >
          {card.actionLabel}
        </button>
      )}
    </div>
  );
}
