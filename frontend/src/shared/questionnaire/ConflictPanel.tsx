interface SuggestionOption {
  key:        string;
  label:      string;
  imageUrl:   string;
  whyLabel:   string;  // e.g. "Relax mood · solo → 0.82"
}

interface ConflictPanelProps {
  visible:         boolean;
  suggestion:      SuggestionOption;
  onUseSuggestion: () => void;
  onAutoBlend:     () => void;
}

export function ConflictPanel({ visible, suggestion, onUseSuggestion, onAutoBlend }: ConflictPanelProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'rounded-2xl overflow-hidden transition-all duration-400',
        'bg-blue-900/10 border border-primary/12',
        visible ? 'max-h-80 opacity-100 mb-2 p-3' : 'max-h-0 opacity-0 mb-0 p-0',
      ].join(' ')}
    >
      {/* Conflict copy */}
      <p className="text-[13px] text-text-2 leading-relaxed mb-3">
        These two shape your day differently — pick one to lead, or let us blend them.
      </p>

      {/* Suggestion */}
      <span className="block text-[10px] font-bold uppercase tracking-widest text-text-3 mb-2">
        Best fit for your profile
      </span>
      <div className="flex items-center gap-3 bg-bg/50 border border-primary/20 rounded-xl p-2.5 mb-2">
        <img src={suggestion.imageUrl} alt="" aria-hidden="true"
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="block font-heading font-bold text-[13px] text-text-1">{suggestion.label}</span>
          <span className="block text-[11px] text-primary/80 mt-0.5">{suggestion.whyLabel}</span>
        </div>
        <button
          type="button"
          onClick={onUseSuggestion}
          className="flex-shrink-0 bg-primary text-white font-heading font-bold text-[12px]
            px-3 py-1.5 rounded-lg transition-all hover:bg-primary-c hover:scale-105 active:scale-95"
        >
          Use this
        </button>
      </div>

      {/* Auto-blend */}
      <button
        type="button"
        onClick={onAutoBlend}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
          border border-white/7 bg-transparent transition-all
          hover:border-white/15 hover:bg-white/3 group"
      >
        <div className="text-left">
          <span className="block font-heading font-bold text-[13px] text-text-2">Let the app decide</span>
          <span className="block text-[11px] text-text-3 mt-0.5">
            We'll read your full profile and shape the day around both.
          </span>
        </div>
        <span className="flex-shrink-0 text-[10px] font-semibold text-primary
          bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1
          group-hover:bg-primary/18 transition-colors">
          Auto
        </span>
      </button>
    </div>
  );
}
