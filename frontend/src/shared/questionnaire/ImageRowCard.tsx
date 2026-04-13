interface ImageRowCardProps {
  label:       string;
  description: string;
  imageUrl:    string;
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
      className={[
        'w-full flex items-center gap-3 p-3 rounded-2xl border text-left',
        'transition-all duration-200',
        selected
          ? 'bg-primary/8 border-primary'
          : dimmed
          ? 'bg-surface border-white/10 opacity-65'
          : hidden
          ? 'bg-surface/50 border-white/10'
          : 'bg-surface border-surf-hst',
        !disabled && !dimmed && 'hover:translate-x-0.5 cursor-pointer',
      ].filter(Boolean).join(' ')}
      style={selected ? { animation: 'glow-pulse 0.45s ease-out' } : undefined}
    >
      {/* Thumbnail */}
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className={[
          'w-12 h-12 rounded-xl object-cover flex-shrink-0 transition-transform duration-300',
          selected ? 'scale-105' : '',
          hidden ? 'saturate-50 brightness-75' : '',
          dimmed ? 'saturate-50 brightness-75' : '',
        ].filter(Boolean).join(' ')}
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        {hidden && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400
            bg-orange-400/10 border border-orange-400/20 rounded-full px-2 py-0.5 mb-1">
            less common for your trip type
          </span>
        )}
        <span className={[
          'block font-heading font-bold text-[15px]',
          hidden ? 'text-text-2' : 'text-text-1',
        ].join(' ')}>
          {label}
        </span>
        <span className="block text-[12px] text-text-3 mt-0.5">{description}</span>
      </div>

      {/* Checkbox */}
      <span
        aria-hidden="true"
        className={[
          'w-[22px] h-[22px] rounded-md border flex-shrink-0 flex items-center justify-center',
          'transition-all duration-200',
          selected
            ? 'bg-primary border-primary scale-110'
            : 'border-surf-hst',
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
