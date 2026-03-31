import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';

export function LoginScreen() {
  const { dispatch } = useAppStore();
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [checking, setChecking]   = useState(true);
  const [signedInName, setSignedInName] = useState<string | null>(null);

  // On mount: check if user already has a Supabase session
  // (signed in but hasn't completed onboarding yet)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata ?? {};
        const name = meta.full_name ?? meta.name ?? session.user.email ?? null;
        setSignedInName(name ? name.split(' ')[0] : null);
      }
      setChecking(false);
    });
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  function continueToOnboarding() {
    dispatch({ type: 'GO_TO', screen: 'ob1' });
  }

  // Loading spinner while checking session
  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: '#0a0e14' }}>
        <span className="ms text-primary text-3xl animate-spin">autorenew</span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-6 py-8"
      style={{
        background:
          "linear-gradient(rgba(15,23,42,.7),rgba(15,23,42,.92)), url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80') center/cover no-repeat",
      }}
    >
      <div className="w-full max-w-[420px]">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/5 border border-white/10 mb-4">
            <span className="ms text-primary text-3xl">explore</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-1 font-heading">
            Uncover Roads
          </h1>
          <p className="text-white/60 text-base">Your AI travel companion</p>
        </div>

        {/* Glass card */}
        <div className="bg-black/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/5">

          {signedInName ? (
            /* ── Already signed in, no persona yet ── */
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="ms fill text-primary text-lg">waving_hand</span>
                <h2 className="text-2xl font-bold text-white font-heading">
                  Hi, {signedInName}
                </h2>
              </div>
              <p className="text-white/40 text-sm mb-8">
                Welcome back! Let's set up your travel persona so we can build the perfect itinerary for you.
              </p>

              <button
                onClick={continueToOnboarding}
                className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  boxShadow: '0 8px 32px rgba(99,102,241,.3)',
                }}
              >
                Continue
                <span className="ms fill text-white text-xl">arrow_forward</span>
              </button>
            </>
          ) : (
            /* ── Not signed in ── */
            <>
              <h2 className="text-2xl font-bold text-white mb-1 font-heading">Welcome</h2>
              <p className="text-white/40 text-sm mb-6">Sign in to start your journey</p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-white/6 text-white font-heading font-semibold text-[0.95rem] border border-white/12 disabled:opacity-60"
              >
                {loading ? (
                  <span className="ms text-white animate-spin text-lg">autorenew</span>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path fill="#4285F4" d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.2-1 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.3z"/>
                      <path fill="#34A853" d="M10 20c2.7 0 5-0.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H1.1v2.6C2.8 17.7 6.2 20 10 20z"/>
                      <path fill="#FBBC05" d="M4.4 11.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V5.5H1.1C.4 6.9 0 8.4 0 10s.4 3.1 1.1 4.5l3.3-2.6z"/>
                      <path fill="#EA4335" d="M10 3.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C14.9.9 12.7 0 10 0 6.2 0 2.8 2.3 1.1 5.5l3.3 2.6c.8-2.4 3-4.2 5.6-4.2z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <p className="text-center text-[0.72rem] text-white/30 leading-relaxed mt-5">
                By continuing, you agree to our{' '}
                <span className="text-white/50 cursor-pointer">Terms</span> and{' '}
                <span className="text-white/50 cursor-pointer">Privacy Policy</span>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
