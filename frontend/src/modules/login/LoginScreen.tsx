import { useState, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { supabase } from '../../shared/supabase';

type AuthMode = 'options' | 'email-signin' | 'email-signup';

export function LoginScreen() {
  const { dispatch } = useAppStore();
  const [checking, setChecking]       = useState(true);
  const [firstName, setFirstName]     = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [mode, setMode]               = useState<AuthMode>('options');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [name, setName]               = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signUpDone, setSignUpDone]   = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error_description') ?? params.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
      window.history.replaceState({}, '', window.location.pathname);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata ?? {};
        const n =
          meta.given_name ??
          meta.full_name?.split(' ')[0] ??
          meta.name?.split(' ')[0] ??
          null;
        setFirstName(n);
      }
      setChecking(false);
    });
  }, []);

  // Reset authLoading if in-app browser closes without completing sign-in
  useEffect(() => {
    let removeBrowserListener: (() => void) | undefined;
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor/browser').then(({ Browser }) => {
        Browser.addListener('browserFinished', () => {
          setAuthLoading(false);
        }).then((handle: { remove: () => void }) => {
          removeBrowserListener = handle.remove;
        });
      });
    });
    return () => { removeBrowserListener?.(); };
  }, []);

  function continueToOnboarding() {
    const seen = Boolean(localStorage.getItem('ur_walkthrough_seen'));
    dispatch({ type: 'GO_TO', screen: seen ? 'ob1' : 'walkthrough' });
  }

  async function signInWithGoogle() {
    setAuthLoading(true);
    setError(null);

    const { Capacitor } = await import('@capacitor/core');
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'uncoverroads://login-callback', skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        setError(error?.message ?? 'OAuth failed');
        setAuthLoading(false);
        return;
      }
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: data.url });
    } else {
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
  }

  async function signInWithApple() {
    setAuthLoading(true);
    setError(null);

    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.getPlatform() === 'ios') {
      try {
        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
        const result = await SignInWithApple.authorize({
          clientId: 'com.uncoverroadsapp.travel',
          redirectURI: 'uncoverroads://login-callback',
          scopes: 'email name',
        });
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.response.identityToken,
        });
        if (error || !data.session?.user) {
          setError(error?.message ?? 'Apple sign-in failed');
          setAuthLoading(false);
          return;
        }
        // handleSignedIn is called via onAuthStateChange in App.tsx
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('cancel') && !msg.includes('Cancel')) setError('Apple sign-in failed');
        setAuthLoading(false);
      }
    } else {
      // Web / Android — OAuth redirect
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setError(error.message);
        setAuthLoading(false);
      }
    }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setAuthLoading(false);
    }
    // On success, onAuthStateChange in App.tsx handles navigation
  }

  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, given_name: name.split(' ')[0] } },
    });
    if (error) {
      setError(error.message);
      setAuthLoading(false);
    } else {
      setSignUpDone(true);
      setAuthLoading(false);
    }
  }

  if (checking) {
    return (
      <div data-theme="dark" className="min-h-screen w-full flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <span className="ms text-primary text-3xl animate-spin">autorenew</span>
      </div>
    );
  }

  const FLOAT_ICONS = ['explore', 'restaurant', 'directions_car', 'photo_camera', 'hotel', 'map', 'flight', 'local_cafe', 'luggage'];

  const inputClass = `
    w-full h-12 rounded-xl px-4 text-sm font-sans outline-none
    bg-white/6 border border-white/10 text-white placeholder:text-white/30
    focus:border-[var(--color-primary)] focus:bg-white/8 transition-colors
  `.trim();

  return (
    <div
      data-theme="dark"
      className="min-h-screen w-full flex items-center justify-center px-6 py-8"
      style={{
        background: "linear-gradient(rgba(15,12,10,.55), rgba(15,12,10,.96)), url('https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80') center/cover no-repeat",
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Floating background icons */}
      {FLOAT_ICONS.map((icon, i) => (
        <span
          key={icon}
          className="ms"
          style={{
            position: 'absolute',
            bottom: '-10%',
            left: `${8 + i * 10}%`,
            fontSize: 28,
            color: 'rgba(255,255,255,0.07)',
            animation: `floatUp ${7 + (i % 3)}s ease-in-out ${i * 0.9}s infinite`,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {icon}
        </span>
      ))}

      <div className="w-full max-w-[380px]" style={{ animation: 'cardEntry 0.6s ease both' }}>

        {/* Brand mark */}
        <div className="text-center mb-10">
          <div className="w-[68px] h-[68px] rounded-[22px] bg-white/10 [backdrop-filter:blur(8px)] flex items-center justify-center mx-auto mb-4">
            <span className="ms text-primary text-3xl">explore</span>
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-white text-4xl font-bold tracking-tight mb-1">
            Uncover Roads
          </h1>
          <p className="text-white/50 text-base">Your AI travel companion</p>
        </div>

        {/* Card */}
        <div className="bg-black/40 backdrop-blur-2xl rounded-3xl px-8 py-8 border border-white/6">

          {firstName ? (
            /* ── Already signed in, no persona yet ── */
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
                style={{ background: 'linear-gradient(135deg, #d4a853, #b8893a)', boxShadow: '0 8px 32px rgba(212,168,83,.3)' }}
              >
                Continue
                <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span>
              </button>
            </>

          ) : signUpDone ? (
            /* ── Email verification sent ── */
            <div className="text-center py-4">
              <span className="ms fill text-primary text-5xl mb-4 block">mark_email_read</span>
              <h2 className="font-heading font-bold text-white text-2xl mb-2">Check your inbox</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                We sent a confirmation link to <span className="text-white/80">{email}</span>. Click it to activate your account.
              </p>
              <button
                onClick={() => { setSignUpDone(false); setMode('options'); }}
                className="text-[var(--color-primary)] text-sm font-semibold"
              >
                Back to sign in
              </button>
            </div>

          ) : mode === 'email-signin' ? (
            /* ── Email sign-in form ── */
            <>
              <button
                onClick={() => { setMode('options'); setError(null); }}
                className="flex items-center gap-1 text-white/40 text-xs mb-5 hover:text-white/60 transition-colors"
              >
                <span className="ms" style={{ fontSize: 16 }}>arrow_back</span>
                Back
              </button>
              <h2 className="font-heading font-bold text-white text-2xl mb-1">Sign in</h2>
              <p className="text-white/40 text-sm mb-6">Welcome back</p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={inputClass + ' pr-12'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    tabIndex={-1}
                  >
                    <span className="ms" style={{ fontSize: 18 }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2 mt-1 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #d4a853, #b8893a)', boxShadow: '0 8px 32px rgba(212,168,83,.3)' }}
                >
                  {authLoading
                    ? <span className="ms text-white animate-spin text-lg">autorenew</span>
                    : <>Sign in <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span></>
                  }
                </button>
              </form>

              <p className="text-center text-white/30 text-xs mt-5">
                No account?{' '}
                <button onClick={() => { setMode('email-signup'); setError(null); }} className="text-[var(--color-primary)] font-semibold">
                  Create one
                </button>
              </p>
            </>

          ) : mode === 'email-signup' ? (
            /* ── Email sign-up form ── */
            <>
              <button
                onClick={() => { setMode('options'); setError(null); }}
                className="flex items-center gap-1 text-white/40 text-xs mb-5 hover:text-white/60 transition-colors"
              >
                <span className="ms" style={{ fontSize: 16 }}>arrow_back</span>
                Back
              </button>
              <h2 className="font-heading font-bold text-white text-2xl mb-1">Create account</h2>
              <p className="text-white/40 text-sm mb-6">Start your journey</p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <form onSubmit={signUpWithEmail} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className={inputClass}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (min 8 characters)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={inputClass + ' pr-12'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    tabIndex={-1}
                  >
                    <span className="ms" style={{ fontSize: 18 }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2 mt-1 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #d4a853, #b8893a)', boxShadow: '0 8px 32px rgba(212,168,83,.3)' }}
                >
                  {authLoading
                    ? <span className="ms text-white animate-spin text-lg">autorenew</span>
                    : <>Create account <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span></>
                  }
                </button>
              </form>

              <p className="text-center text-white/30 text-xs mt-5">
                Already have an account?{' '}
                <button onClick={() => { setMode('email-signin'); setError(null); }} className="text-[var(--color-primary)] font-semibold">
                  Sign in
                </button>
              </p>
            </>

          ) : (
            /* ── Default: sign-in options ── */
            <>
              <h2 className="font-heading font-bold text-white text-2xl mb-1">Welcome</h2>
              <p className="text-white/40 text-sm mb-7">Sign in to start your journey</p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              {/* Google */}
              <button
                onClick={signInWithGoogle}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-white font-heading font-bold text-[0.95rem] disabled:opacity-60 mb-3 active:border-[var(--color-primary)]"
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

              {/* Apple */}
              <button
                onClick={signInWithApple}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-white text-[#1a1a1a] font-heading font-bold text-[0.95rem] disabled:opacity-60 mb-3"
              >
                {authLoading ? (
                  <span className="ms text-[#1a1a1a] animate-spin text-lg">autorenew</span>
                ) : (
                  <>
                    <svg width="18" height="22" viewBox="0 0 814 1000" fill="#1a1a1a">
                      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.5 268.5-317.5 96.9 0 174.4 64.4 220.4 64.4 43.9 0 130.1-68.8 244.6-68.8l-19.3 25.2zm-97.4-174.8c43.9-52.7 75.2-126.1 75.2-199.5 0-10.2-1-20.3-2.6-29.3-71.9 2.6-156.7 48-206.4 109.4-39.5 47.1-75.8 120.4-75.8 194.6 0 11.6 2 23.1 2.6 26.7 3.9.6 10.2 1.3 16.5 1.3 64.4 0 146.8-43.9 190.5-102.9v-.3z"/>
                    </svg>
                    Continue with Apple
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-white/25 text-xs">or</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* Email */}
              <button
                onClick={() => setMode('email-signin')}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-white font-heading font-bold text-[0.95rem] disabled:opacity-60 active:border-[var(--color-primary)]"
              >
                <span className="ms" style={{ fontSize: 20 }}>mail</span>
                Continue with Email
              </button>

              <p className="text-center text-[0.68rem] text-white/20 leading-relaxed mt-5">
                By continuing, you agree to our{' '}
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-white/40 underline">Terms</a> and{' '}
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-white/40 underline">Privacy Policy</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
