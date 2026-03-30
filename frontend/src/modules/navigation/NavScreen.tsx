import { useAppStore } from '../../shared/store';

export function NavScreen() {
  const { state, dispatch } = useAppStore();
  const { city, weather } = state;

  return (
    <div className="fixed inset-0 bg-bg overflow-hidden" style={{ zIndex: 20 }}>
      {/* Decorative background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, rgba(59,130,246,.15) 0%, transparent 60%)',
        }}
      />
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,.03) 40px, rgba(255,255,255,.03) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,.03) 40px, rgba(255,255,255,.03) 41px)',
          }}
        />
      </div>

      {/* Route SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 400 800"
        preserveAspectRatio="none"
        style={{ opacity: 0.6 }}
      >
        <path
          d="M 200 750 Q 150 550 250 420 T 200 120"
          fill="none"
          stroke="#47a1ff"
          strokeLinecap="round"
          strokeWidth="5"
          opacity=".7"
        />
        <path
          d="M 200 120 L 185 50"
          fill="none"
          stroke="#47a1ff"
          strokeDasharray="8 8"
          strokeLinecap="round"
          strokeWidth="3"
          opacity=".5"
        />
      </svg>

      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'route' })}
            className="w-10 h-10 rounded-full bg-bg/60 backdrop-blur flex items-center justify-center border border-white/10"
          >
            <span className="ms text-primary text-base">arrow_back</span>
          </button>
          <span className="font-heading font-semibold text-text-1 text-sm">Active Journey</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-text-2 text-sm">{city}</span>
          {weather && (
            <span className="text-text-3 text-sm">{weather.temp}°</span>
          )}
        </div>
      </div>

      {/* Current location dot */}
      <div className="absolute" style={{ bottom: '35%', left: '50%', transform: 'translateX(-50%)' }}>
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-40" />
          <div className="absolute inset-1 rounded-full bg-white" />
        </div>
      </div>

      {/* Journey summary card */}
      <div
        className="absolute inset-x-4 bottom-0 bg-surface rounded-t-3xl px-5 pt-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
        <div className="text-text-3 text-xs uppercase tracking-wide mb-2">Active Journey</div>
        <div className="font-heading font-bold text-text-1 text-xl mb-4">{city || 'Your City'}</div>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
          className="w-full h-12 rounded-2xl bg-primary/10 text-primary font-bold text-sm border border-primary/20"
        >
          End Journey
        </button>
      </div>
    </div>
  );
}
