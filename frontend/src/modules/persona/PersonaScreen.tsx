import { useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { usePersona } from './usePersona';
import { ARCHETYPE_EMOJI } from './types';

export function PersonaScreen() {
  const { dispatch } = useAppStore();
  const { buildPersona, loading, error, persona } = usePersona();

  useEffect(() => {
    if (!persona) {
      buildPersona('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPlanning() {
    dispatch({ type: 'GO_TO', screen: 'destination' });
  }

  function retake() {
    dispatch({ type: 'GO_TO', screen: 'ob1' });
  }

  const emoji = persona ? (ARCHETYPE_EMOJI[persona.archetype] ?? '◆') : '';

  return (
    <div className="fixed inset-0 bg-bg overflow-y-auto" style={{ zIndex: 20 }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
        <div className="flex items-center gap-2">
          <span className="ms text-text-2 text-xl">explore</span>
          <span className="font-heading font-semibold text-text-1 text-sm">Uncover Roads</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center">
          <span className="ms fill text-text-2 text-base">person</span>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <span className="ms text-primary text-5xl animate-spin">autorenew</span>
          <p className="text-text-2 text-sm">Building your travel persona…</p>
        </div>
      )}

      {error && (
        <div className="px-5 py-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => buildPersona('')} className="text-primary font-bold">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && persona && (
        <div className="px-5 pb-10">
          {/* Hero */}
          <div className="py-8 text-center relative">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,.25) 0%, transparent 70%)',
              }}
            />
            <div
              className="font-heading font-extrabold tracking-tight text-4xl mb-1"
              style={{
                background: 'linear-gradient(135deg, #f1f5f9 0%, #3b82f6 50%, #70f8e8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {emoji} {persona.archetype_name}
            </div>
          </div>

          {/* Persona description card */}
          <div className="bg-surface rounded-2xl p-5 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#70F8E8]" />
              <span className="text-[#70F8E8] text-xs font-semibold tracking-wide uppercase">
                Your travel persona
              </span>
            </div>
            <p className="text-text-1 text-base leading-relaxed">{persona.archetype_desc}</p>
          </div>

          {/* Bias card */}
          {persona.itinerary_bias && persona.itinerary_bias.length > 0 && (
            <div className="bg-surface rounded-2xl p-5 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-4 rounded-sm bg-primary" />
                <span className="text-primary text-xs font-semibold tracking-wide uppercase">
                  AI insight
                </span>
              </div>
              <p className="text-text-2 text-sm leading-relaxed">
                Your itineraries will lean towards{' '}
                {persona.itinerary_bias.join(', ')}.
              </p>
            </div>
          )}

          {/* Trait breakdown */}
          <div className="flex items-center justify-between mb-3 mt-5">
            <span className="font-heading font-semibold text-text-1 text-sm">Venue Preferences</span>
            <span className="text-text-3 text-xs">{persona.venue_filters?.length ?? 0} types</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {persona.venue_filters?.map(f => (
              <span
                key={f}
                className="px-3 py-1 rounded-full bg-surface text-text-2 text-xs font-medium capitalize"
              >
                {f}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <button
            onClick={startPlanning}
            className="w-full h-14 rounded-2xl bg-primary text-white font-heading font-bold text-base flex items-center justify-center gap-2 mb-3"
          >
            Start Planning
            <span className="ms text-sm">arrow_forward</span>
          </button>
          <button
            onClick={retake}
            className="w-full h-12 rounded-2xl bg-transparent text-text-2 font-medium text-sm flex items-center justify-center gap-2 border border-white/10"
          >
            <span className="ms text-sm text-text-2">refresh</span>
            Retake Persona Assessment
          </button>
        </div>
      )}
    </div>
  );
}
