import { useAppStore } from '../../shared/store';

export function LoginScreen() {
  const { dispatch } = useAppStore();

  function proceed() {
    dispatch({ type: 'GO_TO', screen: 'ob1' });
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
          <h2 className="text-2xl font-bold text-white mb-1 font-heading">Welcome back</h2>
          <p className="text-white/40 text-sm mb-6">Sign in to continue your journey</p>

          {/* Auth buttons */}
          <div className="flex flex-col gap-3 mb-5">
            <button
              onClick={proceed}
              className="flex items-center justify-center gap-3 h-13 rounded-2xl bg-white text-black font-heading font-semibold text-[0.95rem] cursor-pointer border-none"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M14.5 2.5c.8 1 1.3 2.3 1.2 3.6-1.2.1-2.5-.7-3.3-1.6-.8-.9-1.3-2.2-1.1-3.5 1.3-.1 2.5.6 3.2 1.5zm4.5 12.8c-.7 1.4-1 2-1.8 3.2-.9 1.4-2.2 3.5-3.8 3.5-1.4 0-1.8-.9-3.7-.9s-2.4.9-3.8.9c-1.5 0-2.8-2-3.7-3.4C.4 16.2 0 12.9 1.2 10.7c.9-1.5 2.4-2.5 4-2.5 1.6 0 2.6.9 3.9.9 1.3 0 2.1-.9 3.9-.9 1.4 0 2.8.8 3.7 2.1z"/>
              </svg>
              Continue with Apple
            </button>

            <button
              onClick={proceed}
              className="flex items-center justify-center gap-3 h-13 rounded-2xl bg-white/6 text-white font-heading font-semibold text-[0.95rem] cursor-pointer border border-white/12"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path fill="#4285F4" d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.2-1 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.3z"/>
                <path fill="#34A853" d="M10 20c2.7 0 5-0.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H1.1v2.6C2.8 17.7 6.2 20 10 20z"/>
                <path fill="#FBBC05" d="M4.4 11.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V5.5H1.1C.4 6.9 0 8.4 0 10s.4 3.1 1.1 4.5l3.3-2.6z"/>
                <path fill="#EA4335" d="M10 3.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C14.9.9 12.7 0 10 0 6.2 0 2.8 2.3 1.1 5.5l3.3 2.6c.8-2.4 3-4.2 5.6-4.2z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5 text-white/20 text-[0.7rem] uppercase tracking-widest">
            <span className="flex-1 h-px bg-white/6" />
            or
            <span className="flex-1 h-px bg-white/6" />
          </div>

          {/* Sign in */}
          <button
            onClick={proceed}
            className="w-full h-13 rounded-2xl bg-[#864f00] text-white font-heading font-bold text-base mb-4 border-none cursor-pointer"
          >
            Sign In
          </button>

          <p className="text-center text-[0.72rem] text-white/30 leading-relaxed">
            By continuing, you agree to our{' '}
            <span className="text-white/50 cursor-pointer">Terms</span> and{' '}
            <span className="text-white/50 cursor-pointer">Privacy Policy</span>.
          </p>
        </div>

        <div className="text-center mt-6 text-white/40 text-sm">
          Don&apos;t have an account?{' '}
          <button
            onClick={proceed}
            className="text-primary font-bold bg-none border-none cursor-pointer text-sm"
          >
            Start Explorer Trial
          </button>
        </div>
      </div>
    </div>
  );
}
