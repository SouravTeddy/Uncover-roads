import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';

export function LoginScreen() {
  const { dispatch } = useAppStore();
  const [checking, setChecking]     = useState(true);
  const [firstName, setFirstName]   = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('beta_closed') === '1') {
      setError('Beta is currently closed. Stay tuned for the public launch.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    // Show any OAuth error returned in the URL (e.g. provider not configured)
    const urlError = params.get('error_description') ?? params.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
      window.history.replaceState({}, '', window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata ?? {};
        // Google provides given_name, name, or full_name
        const name =
          meta.given_name ??
          meta.full_name?.split(' ')[0] ??
          meta.name?.split(' ')[0] ??
          null;
        setFirstName(name);
      }
      setChecking(false);
    });
  }, []);

  function continueToOnboarding() {
    const seen = Boolean(localStorage.getItem('ur_walkthrough_seen'));
    dispatch({ type: 'GO_TO', screen: seen ? 'ob1' : 'walkthrough' });
  }

  async function signInWithGoogle() {
    setAuthLoading(true);
    setError(null);
    // Set a flag before the redirect. Session storage survives OAuth redirects
    // in the same tab, so getInitialScreen() can detect a fresh sign-in
    // reliably — regardless of URL param stripping or auth event timing.
    sessionStorage.setItem('ur_auth_pending', '1');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      sessionStorage.removeItem('ur_auth_pending');
      setError(error.message);
      setAuthLoading(false);
    }
  }

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
          "linear-gradient(rgba(15,23,42,.65),rgba(10,14,20,.95)), url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80') center/cover no-repeat",
      }}
    >
      <div className="w-full max-w-[380px]">

        {/* Brand mark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white/5 border border-white/10 mb-4">
            <span className="ms text-primary text-3xl">explore</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-1 font-heading">
            Uncover Roads
          </h1>
          <p className="text-white/50 text-base">Your AI travel companion</p>
        </div>

        {/* Card */}
        <div className="bg-black/40 backdrop-blur-2xl rounded-3xl px-8 py-8 border border-white/6">

          {firstName ? (
            /* ── Signed in, no persona yet ── */
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="ms fill text-primary" style={{ fontSize: 22 }}>waving_hand</span>
                <h2 className="font-heading font-bold text-white text-2xl">Hi, {firstName}</h2>
              </div>
              <p className="text-white/40 text-sm mb-8 leading-relaxed">
                Let's set up your travel persona so we can craft the perfect itinerary for you.
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
                <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span>
              </button>
            </>
          ) : (
            /* ── Not signed in ── */
            <>
              <h2 className="font-heading font-bold text-white text-2xl mb-1">Welcome</h2>
              <p className="text-white/40 text-sm mb-7">Sign in to start your journey</p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <button
                onClick={signInWithGoogle}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-white/6 text-white font-heading font-semibold text-[0.95rem] border border-white/12 disabled:opacity-60 mb-4"
              >
                {authLoading ? (
                  <span className="ms text-white animate-spin text-lg">autorenew</span>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path fill="#4285F4" d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.2-1 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.3z"/>
                      <path fill="#34A853" d="M10 20c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H1.1v2.6C2.8 17.7 6.2 20 10 20z"/>
                      <path fill="#FBBC05" d="M4.4 11.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V5.5H1.1C.4 6.9 0 8.4 0 10s.4 3.1 1.1 4.5l3.3-2.6z"/>
                      <path fill="#EA4335" d="M10 3.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C14.9.9 12.7 0 10 0 6.2 0 2.8 2.3 1.1 5.5l3.3 2.6c.8-2.4 3-4.2 5.6-4.2z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <p className="text-center text-[0.68rem] text-white/20 leading-relaxed mt-5">
                By continuing, you agree to our{' '}
                <span className="text-white/40 cursor-pointer">Terms</span> and{' '}
                <span className="text-white/40 cursor-pointer">Privacy Policy</span>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
