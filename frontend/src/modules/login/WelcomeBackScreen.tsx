import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';
import type { Persona } from '../../shared/types';

const ARCHETYPE_ICONS: Record<string, string> = {
  historian:     'account_balance',
  epicurean:     'restaurant',
  wanderer:      'explore',
  voyager:       'flight',
  explorer:      'terrain',
  slowtraveller: 'spa',
  pulse:         'nightlife',
};

const ARCHETYPE_COLORS: Record<string, { from: string; to: string; text: string }> = {
  historian:     { from: '#78350f', to: '#92400e', text: '#fbbf24' },
  epicurean:     { from: '#7f1d1d', to: '#991b1b', text: '#fca5a5' },
  wanderer:      { from: '#064e3b', to: '#065f46', text: '#6ee7b7' },
  voyager:       { from: '#1e3a8a', to: '#1d4ed8', text: '#93c5fd' },
  explorer:      { from: '#14532d', to: '#166534', text: '#86efac' },
  slowtraveller: { from: '#4a1d96', to: '#6d28d9', text: '#c4b5fd' },
  pulse:         { from: '#831843', to: '#9d174d', text: '#f9a8d4' },
};

export function WelcomeBackScreen() {
  const { dispatch } = useAppStore();

  const rawUser   = localStorage.getItem('ur_user');
  const rawPersona = localStorage.getItem('ur_persona');

  const user: { name: string; avatar: string | null; email: string } | null =
    rawUser ? JSON.parse(rawUser) : null;
  const persona: Persona | null = rawPersona ? JSON.parse(rawPersona) : null;

  const firstName   = (user?.name ?? 'Explorer').split(' ')[0];
  const archetype   = persona?.archetype ?? '';
  const archetypeName = persona?.archetype_name ?? 'Traveller';
  const archetypeDesc = persona?.archetype_desc ?? 'Ready for your next adventure';
  const icon        = ARCHETYPE_ICONS[archetype] ?? 'explore';
  const colors      = ARCHETYPE_COLORS[archetype] ?? { from: '#1e3a8a', to: '#1d4ed8', text: '#93c5fd' };

  function continueJourney() {
    dispatch({ type: 'GO_TO', screen: 'destination' });
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem('ur_persona');
    localStorage.removeItem('ur_user');
    dispatch({ type: 'GO_TO', screen: 'login' });
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between px-6 pt-12 pb-8"
      style={{
        background:
          "linear-gradient(rgba(10,14,20,.6) 0%, rgba(10,14,20,.85) 50%, rgba(10,14,20,1) 100%), url('https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80') center/cover no-repeat",
      }}
    >
      {/* Top: logo */}
      <div className="flex items-center gap-2 self-start">
        <span className="ms text-primary text-xl">explore</span>
        <span className="text-white/40 text-sm font-semibold tracking-wide">Uncover Roads</span>
      </div>

      {/* Center content */}
      <div className="flex flex-col items-center gap-6 w-full max-w-[340px]">

        {/* Avatar */}
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,.3), rgba(99,102,241,.3))',
              boxShadow: '0 0 0 2px rgba(99,130,246,.25), 0 0 0 4px rgba(59,130,246,.1)',
            }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={firstName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-2xl">
                {firstName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          {/* Archetype badge */}
          <div
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
          >
            <span className="ms fill text-white" style={{ fontSize: 14 }}>{icon}</span>
          </div>
        </div>

        {/* Greeting */}
        <div className="text-center">
          <p className="text-white/50 text-sm mb-1">Welcome back</p>
          <h1 className="text-white font-heading font-extrabold text-3xl tracking-tight">
            {firstName}
          </h1>
        </div>

        {/* Persona card */}
        <div
          className="w-full rounded-2xl p-4 border border-white/8"
          style={{
            background: `linear-gradient(135deg, ${colors.from}33, ${colors.to}22)`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
            >
              <span className="ms fill text-white" style={{ fontSize: 18 }}>{icon}</span>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">Your travel persona</p>
              <p className="font-heading font-bold text-white text-sm">{archetypeName}</p>
            </div>
          </div>
          <p className="text-white/55 text-xs leading-relaxed">{archetypeDesc}</p>
        </div>

        {/* CTA */}
        <button
          onClick={continueJourney}
          className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            boxShadow: '0 8px 32px rgba(99,102,241,.35)',
          }}
        >
          <span>Continue your journey</span>
          <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span>
        </button>
      </div>

      {/* Bottom: sign out */}
      <button
        onClick={signOut}
        className="text-white/30 text-sm hover:text-white/50 transition-colors text-center px-6 leading-relaxed"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        Not {firstName}?{' '}
        <span className="underline underline-offset-2">Sign in with a different account</span>
      </button>
    </div>
  );
}
