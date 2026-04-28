import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Screen } from './shared/types';
import { AppProvider, useAppStore } from './shared/store';
import { BottomNav } from './shared/ui';
import { supabase } from './shared/supabase';
import { syncProfile, loadSavedItineraries, loadUserProfile } from './shared/userSync';

import { LoginScreen, WelcomeBackScreen, WalkthroughScreen } from './modules/login';
import {
  OB1Group, OB2Mood, OB3Pace, OB4DayOpen, OB5Dietary,
  OB6Budget, OB7Evening, OB8KidFocus, OB9BudgetProtect,
} from './modules/onboarding';
import { PersonaScreen } from './modules/persona';
import { DestinationScreen } from './modules/destination';
import { MapScreen } from './modules/map';
import { JourneyScreen } from './modules/journey';
import { RouteScreen } from './modules/route';
import { NavScreen } from './modules/navigation';
import { ProfileScreen } from './modules/profile';
import { TripsScreen } from './modules/trips';
import { SubscriptionScreen } from './modules/subscription/SubscriptionScreen';

const BETA_ALLOWLIST = ['sourav.bis93@gmail.com'];

function ScreenRouter() {
  const { state, dispatch } = useAppStore();
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (isDesktop && state.currentScreen !== 'trips') return <DesktopGate />;

  async function handleSignedIn(user: User) {
    if (!BETA_ALLOWLIST.includes(user.email ?? '')) {
      await supabase.auth.signOut();
      window.history.replaceState({}, '', '?beta_closed=1');
      dispatch({ type: 'GO_TO', screen: 'login' });
      return;
    }
    // Persist user info for the welcome back screen
    localStorage.setItem('ur_user', JSON.stringify({
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? '',
      avatar: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      email: user.email ?? '',
    }));

    syncProfile(user).catch(console.warn);
    loadSavedItineraries(user.id).then(items => {
      if (items.length > 0) dispatch({ type: 'SET_SAVED_ITINERARIES', items });
    }).catch(console.warn);
    loadUserProfile(user.id).then(profile => {
      if (profile) {
        dispatch({ type: 'SET_USER_ROLE', role: profile.role });
        dispatch({ type: 'SET_GENERATION_COUNT', count: profile.generationCount });
      }
      dispatch({ type: 'PROFILE_LOADED' });
    }).catch(() => { dispatch({ type: 'PROFILE_LOADED' }); });

    const hasPersona = Boolean(localStorage.getItem('ur_persona'));
    const hasSeenWalkthrough = Boolean(localStorage.getItem('ur_walkthrough_seen'));
    if (hasPersona) {
      // If the user had an active session in progress, restore them directly to
      // that screen instead of the welcome screen. This handles iOS PWA restarts,
      // session refreshes, and returning from external apps like Google Maps.
      try {
        const raw = localStorage.getItem('ur_ss_screen');
        const savedScreen = raw ? (JSON.parse(raw) as string) : null;
        const midSessionScreens = ['map', 'route', 'destination', 'journey'];
        if (savedScreen && midSessionScreens.includes(savedScreen)) {
          dispatch({ type: 'GO_TO', screen: savedScreen as Screen });
          return;
        }
      } catch { /* ignore */ }
      dispatch({ type: 'GO_TO', screen: 'welcome' });
    } else if (hasSeenWalkthrough) {
      dispatch({ type: 'GO_TO', screen: 'ob1' });
    } else {
      dispatch({ type: 'GO_TO', screen: 'walkthrough' });
    }
  }

  useEffect(() => {
    const initialScreen = state.currentScreen;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      if (initialScreen === 'login') {
        // Just came back from OAuth redirect — navigate the user in
        handleSignedIn(session.user);
      } else {
        // Returning user opened the app — sync data in background, don't navigate
        syncProfile(session.user).catch(console.warn);
        loadSavedItineraries(session.user.id).then(items => {
          if (items.length > 0) dispatch({ type: 'SET_SAVED_ITINERARIES', items });
        }).catch(console.warn);
        // Always load role + generation count so admin bypass works without re-login
        loadUserProfile(session.user.id).then(profile => {
          if (profile) {
            dispatch({ type: 'SET_USER_ROLE', role: profile.role });
            dispatch({ type: 'SET_GENERATION_COUNT', count: profile.generationCount });
          }
          dispatch({ type: 'PROFILE_LOADED' });
        }).catch(() => { dispatch({ type: 'PROFILE_LOADED' }); });
      }
    });

    // Screens that represent an active in-progress session — if the user is
    // already on one of these, a spurious SIGNED_IN event (e.g. token refresh
    // on Android app resume) must NOT kick them back to the welcome screen.
    const activeMidSessionScreens = new Set([
      'map', 'route', 'destination', 'journey', 'persona', 'nav', 'trips', 'profile', 'subscription',
    ]);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) return;
      if (event === 'SIGNED_IN') {
        if (activeMidSessionScreens.has(initialScreen)) {
          // Already on an active screen (e.g. restored from localStorage after
          // Android app-resume or opening Google Maps). Just sync data silently.
          loadUserProfile(session.user.id).then(profile => {
            if (profile) {
              dispatch({ type: 'SET_USER_ROLE', role: profile.role });
              dispatch({ type: 'SET_GENERATION_COUNT', count: profile.generationCount });
            }
            dispatch({ type: 'PROFILE_LOADED' });
          }).catch(() => { dispatch({ type: 'PROFILE_LOADED' }); });
        } else {
          handleSignedIn(session.user);
        }
      } else if (event === 'INITIAL_SESSION' && initialScreen === 'login') {
        handleSignedIn(session.user);
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { currentScreen } = state;

  return (
    <div
      className="relative w-full"
      style={{ background: '#0f172a', minHeight: '100dvh' }}
    >
      {currentScreen === 'login'        && <LoginScreen />}
      {currentScreen === 'welcome'      && <WelcomeBackScreen />}
      {currentScreen === 'walkthrough'  && <WalkthroughScreen />}
      {currentScreen === 'ob1'          && <OB1Group />}
      {currentScreen === 'ob2'          && <OB2Mood />}
      {currentScreen === 'ob3'          && <OB3Pace />}
      {currentScreen === 'ob4'          && <OB4DayOpen />}
      {currentScreen === 'ob5'          && <OB5Dietary />}
      {currentScreen === 'ob6'          && <OB6Budget />}
      {currentScreen === 'ob7'          && <OB7Evening />}
      {currentScreen === 'ob8'          && <OB8KidFocus />}
      {currentScreen === 'ob9'          && <OB9BudgetProtect />}
      {currentScreen === 'persona'     && <PersonaScreen />}
      {currentScreen === 'destination' && <DestinationScreen />}
      {currentScreen === 'map'         && <MapScreen />}
      {currentScreen === 'journey'     && <JourneyScreen />}
      {currentScreen === 'route'       && <RouteScreen />}
      {currentScreen === 'trips'       && <TripsScreen />}
      {currentScreen === 'nav'         && <NavScreen />}
      {currentScreen === 'profile'     && <ProfileScreen />}
      {currentScreen === 'subscription' && <SubscriptionScreen />}

      <BottomNav />
    </div>
  );
}

function DesktopGate() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-8"
      style={{ background: '#0f141e' }}
    >
      {/* Glow blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 480, height: 480,
          background: 'radial-gradient(ellipse, rgba(249,115,22,.10) 0%, transparent 70%)',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -60%)',
        }}
      />

      <div className="relative flex flex-col items-center text-center max-w-sm gap-6">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.2)' }}
        >
          <span className="ms fill text-orange-400" style={{ fontSize: 36 }}>smartphone</span>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col gap-1">
          <p className="font-heading font-bold text-white text-2xl tracking-tight">Uncover Roads</p>
          <p className="text-white/35 text-xs font-medium uppercase tracking-widest">Travel Planner</p>
        </div>

        {/* Message */}
        <div className="flex flex-col gap-2">
          <p className="text-white/80 text-base font-semibold leading-snug">
            Built for the road, not the desk.
          </p>
          <p className="text-white/40 text-sm leading-relaxed">
            Uncover Roads is designed for mobile. Open it on your phone for the full experience — maps, itineraries, and navigation the way they're meant to feel.
          </p>
        </div>

        {/* QR code */}
        <div
          className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl border border-white/8 w-full"
          style={{ background: 'rgba(255,255,255,.03)' }}
        >
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://uncover-roads.vercel.app/&bgcolor=151b26&color=f97316&margin=2&qzone=1"
            alt="Scan to open on mobile"
            width={160}
            height={160}
            className="rounded-xl"
          />
          <p className="text-white/30 text-xs">Scan to open on your phone</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ScreenRouter />
    </AppProvider>
  );
}
