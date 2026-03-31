import { useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { usePersona } from './usePersona';
import {
  ARCHETYPE_EMOJI,
  ARCHETYPE_COLORS,
  VENUE_ICONS,
  BIAS_ICONS,
} from './types';

export function PersonaScreen() {
  const { dispatch } = useAppStore();
  const { buildPersona, loading, error, persona } = usePersona();

  useEffect(() => {
    if (!persona) buildPersona('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center gap-4" style={{ zIndex: 20 }}>
        <span className="ms text-primary text-5xl animate-spin">autorenew</span>
        <p className="text-text-2 text-sm">Crafting your travel persona…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center gap-5 px-8" style={{ zIndex: 20 }}>
        <span className="ms text-text-3 text-4xl">sentiment_dissatisfied</span>
        <p className="text-red-400 text-sm text-center">{error}</p>
        <button
          onClick={() => buildPersona('')}
          className="px-6 py-3 bg-primary text-white rounded-xl font-heading font-bold text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!persona) return null;

  const color = ARCHETYPE_COLORS[persona.archetype] ?? { primary: '#3b82f6', glow: 'rgba(59,130,246,.22)' };
  const emoji = ARCHETYPE_EMOJI[persona.archetype] ?? '◆';

  return (
    <div className="fixed inset-0 bg-bg overflow-y-auto" style={{ zIndex: 20 }}>

      {/* Top bar */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
        <span className="ms text-text-2 text-xl">explore</span>
        <span className="font-heading font-semibold text-text-1 text-sm">Uncover Roads</span>
      </div>

      {/* Hero card */}
      <div
        className="relative mx-4 mt-5 rounded-3xl overflow-hidden text-center"
        style={{
          background: `linear-gradient(160deg, ${color.glow}, rgba(255,255,255,.02))`,
          border: `1px solid ${color.primary}28`,
        }}
      >
        {/* Radial glow at top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${color.glow} 0%, transparent 70%)`,
          }}
        />
        <div className="relative px-6 pt-8 pb-7">
          {/* Symbol */}
          <div
            className="text-7xl leading-none mb-4"
            style={{ filter: `drop-shadow(0 0 28px ${color.primary}80)` }}
          >
            {emoji}
          </div>
          {/* Archetype name */}
          <h1 className="font-heading font-extrabold text-2xl text-white tracking-tight mb-2">
            {persona.archetype_name}
          </h1>
          {/* One-liner */}
          <p className="text-white/60 text-sm leading-relaxed max-w-[260px] mx-auto">
            {persona.archetype_desc}
          </p>
        </div>
      </div>

      {/* Trip focus */}
      {persona.itinerary_bias && persona.itinerary_bias.length > 0 && (
        <div className="px-5 mt-6">
          <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">
            Your trips will lean towards
          </p>
          <div className="flex flex-wrap gap-2">
            {persona.itinerary_bias.map(bias => (
              <div
                key={bias}
                className="flex items-center gap-1.5 px-3 h-8 rounded-full"
                style={{
                  background: `${color.primary}18`,
                  border: `1px solid ${color.primary}35`,
                }}
              >
                <span
                  className="ms fill text-xs"
                  style={{ color: color.primary }}
                >
                  {BIAS_ICONS[bias] ?? 'label'}
                </span>
                <span className="text-white text-xs font-semibold capitalize">{bias}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Venue priorities */}
      {persona.venue_filters && persona.venue_filters.length > 0 && (
        <div className="px-5 mt-5">
          <p className="text-text-3 text-[10px] font-bold uppercase tracking-widest mb-3">
            Places we'll surface for you
          </p>
          <div className="flex flex-wrap gap-2">
            {persona.venue_filters.map(v => (
              <div
                key={v}
                className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-surface border border-white/10"
              >
                <span className="ms text-xs text-text-3">{VENUE_ICONS[v] ?? 'place'}</span>
                <span className="text-text-2 text-xs font-medium capitalize">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="px-5 mt-8 pb-14">
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
          className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2 mb-3"
          style={{ background: `linear-gradient(135deg, ${color.primary}, ${color.primary}bb)` }}
        >
          Start Planning
          <span className="ms text-sm">arrow_forward</span>
        </button>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'ob1' })}
          className="w-full h-11 rounded-2xl bg-transparent text-text-3 text-sm flex items-center justify-center gap-1.5 border border-white/8"
        >
          <span className="ms text-sm">refresh</span>
          Retake Assessment
        </button>
      </div>
    </div>
  );
}
