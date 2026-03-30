import { useAppStore } from '../../shared/store';
import { ARCHETYPE_EMOJI } from './types';

interface Props {
  onClose: () => void;
}

export function PersonaModal({ onClose }: Props) {
  const { state } = useAppStore();
  const persona = state.persona;

  if (!persona) return null;

  const emoji = ARCHETYPE_EMOJI[persona.archetype] ?? '◆';

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

        <div className="font-heading font-bold text-2xl text-text-1 mb-1">
          {emoji} {persona.archetype_name}
        </div>
        <p className="text-text-2 text-sm mb-5">{persona.archetype_desc}</p>

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
