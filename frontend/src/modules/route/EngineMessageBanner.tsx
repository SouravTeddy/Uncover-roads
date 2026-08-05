import type { EngineMessage } from '../../shared/types'

const TYPE_ICON: Record<EngineMessage['type'], string> = {
  swap:        'swap_horiz',
  insert:      'add_circle',
  resequence:  'reorder',
  weather:     'cloud',
  transit:     'directions_transit',
  advisory:    'info',
  event:       'event',
  alcohol:     'wine_bar',
  ramadan:     'nights_stay',
  nightlife:   'nightlife',
  walkability: 'directions_walk',
}

interface Props {
  message: EngineMessage
  onDismiss: (id: string) => void
  onUndo: (action: string) => void
}

export function EngineMessageBanner({ message, onDismiss, onUndo }: Props) {
  return (
    <div className="mx-4 my-2 rounded-[14px] bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-3 flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <span className="ms text-[var(--color-primary)] text-[18px]">
          {TYPE_ICON[message.type]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--color-text-1)] leading-snug">
          {message.what}
        </p>
        <p className="text-[12px] text-[var(--color-text-3)] mt-0.5 leading-snug">
          {message.why}
        </p>
        <p className="text-[12px] text-[var(--color-text-2)] mt-0.5 leading-snug">
          {message.consequence}
        </p>
        {message.undo_action && (
          <button
            onClick={() => onUndo(message.undo_action!)}
            className="mt-2 text-[12px] font-semibold text-[var(--color-primary)]"
          >
            Undo
          </button>
        )}
      </div>
      {message.dismissable && (
        <button
          aria-label="Dismiss"
          onClick={() => onDismiss(message.id)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[var(--color-text-3)]"
        >
          <span className="ms text-[16px]">close</span>
        </button>
      )}
    </div>
  )
}
