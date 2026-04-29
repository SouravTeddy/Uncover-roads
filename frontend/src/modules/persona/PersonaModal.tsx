import { useAppStore } from '../../shared/store';
import { ARCHETYPE_COLORS, ARCHETYPE_EMOJI } from './types';

interface Props {
  onClose: () => void;
}

export function PersonaModal({ onClose }: Props) {
  const { state } = useAppStore();
  const persona = state.persona;

  if (!persona) return null;

  const emoji = ARCHETYPE_EMOJI[persona.archetype] ?? '◆';
  const color = ARCHETYPE_COLORS[persona.archetype] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' };

  return (
    <div
      className="fixed inset-0 flex items-end z-50"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full bg-surface rounded-t-3xl p-6 pb-safe"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

        {/* Hero card */}
        <div
          className="rounded-[20px] p-5 relative overflow-hidden mb-5"
          style={{
            background: `linear-gradient(150deg, ${color.glow}, rgba(255,255,255,.02))`,
            border: `1px solid ${color.primary}28`,
          }}
        >
          {/* Radial glow — left edge */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1/2 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at left, ${color.primary}18, transparent 70%)` }}
          />

          {/* Emoji */}
          <span
            className="text-[42px] relative"
            style={{ filter: `drop-shadow(0 0 16px ${color.primary}70)` }}
          >
            {emoji}
          </span>

          {/* Name */}
          <div className="font-[family-name:var(--font-heading)] text-[17px] font-semibold text-[var(--color-text-1)] mt-2">
            {persona.archetype_name}
          </div>

          {/* Tagline */}
          <div className="text-[12px] text-[var(--color-text-3)] mt-0.5">{persona.archetype_desc}</div>
        </div>

        {persona.venue_filters && persona.venue_filters.length > 0 && (
          <div className="mb-5">
            <p className="text-text-3 text-xs uppercase tracking-wide mb-2">Venues you'll love</p>
            <div className="flex flex-wrap gap-2">
              {persona.venue_filters.map(f => (
                <span
                  key={f}
                  className="px-3 py-1 rounded-full bg-bg text-text-2 text-xs capitalize"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-primary/15 text-primary font-bold text-sm border border-primary/25"
        >
          Close
        </button>
      </div>
    </div>
  );
}
