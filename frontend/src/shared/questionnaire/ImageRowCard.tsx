interface ImageRowCardProps {
  label:       string;
  description: string;
  imageUrl?:   string;
  selected:    boolean;
  onSelect:    () => void;
  hidden?:     boolean;   // "less common for your trip type" badge
  disabled?:   boolean;
  dimmed?:     boolean;   // conflict state
}

export function ImageRowCard({
  label, description, imageUrl, selected, onSelect,
  hidden = false, disabled = false, dimmed = false,
}: ImageRowCardProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        touchAction: 'manipulation',
        ...(selected ? { animation: 'glowPulse 0.45s ease-out' } : {}),
      }}
      className={[
        'w-full flex items-center gap-4 p-4 rounded-2xl border text-left',
        'transition-all duration-200 active:scale-[.98]',
        selected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg)]'
          : dimmed
          ? 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-65'
          : hidden
          ? 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-80'
          : 'bg-[var(--color-surface)] border-[var(--color-border)]',
        !disabled && !dimmed && 'hover:translate-x-0.5 cursor-pointer',
      ].filter(Boolean).join(' ')}
    >
      {/* Thumbnail */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className={[
            'w-16 h-16 rounded-xl object-cover flex-shrink-0 transition-transform duration-300',
            selected ? 'scale-105' : '',
            hidden ? 'saturate-50 brightness-75' : '',
            dimmed ? 'saturate-50 brightness-75' : '',
          ].filter(Boolean).join(' ')}
        />
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        {hidden && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400
            bg-orange-400/10 border border-orange-400/20 rounded-full px-2 py-0.5 mb-1">
            less common for your trip type
          </span>
        )}
        <span className="block font-heading font-bold text-[15px] text-[var(--color-text-1)]">
          {label}
        </span>
        <span className="block text-[13px] text-text-2 mt-0.5 leading-snug">{description}</span>
      </div>

      {/* Checkbox */}
      <span
        aria-hidden="true"
        className={[
          'w-[22px] h-[22px] rounded-md border flex-shrink-0 flex items-center justify-center',
          'transition-all duration-200',
          selected
            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] scale-110'
            : 'border-[var(--color-border)]',
        ].join(' ')}
      >
        {selected && (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <polyline points="2,7 5,10 11,3" stroke="white" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}
