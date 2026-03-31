import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AppProvider, useAppStore } from './shared/store';
import { BottomNav } from './shared/ui';
import { supabase } from './shared/supabase';
import { syncProfile, loadSavedItineraries, loadUserProfile } from './shared/userSync';

import { LoginScreen, WelcomeBackScreen, WalkthroughScreen } from './modules/login';
import { OB1Ritual, OB2Motivation, OB3Style, OB4LocationType, OB5Pace } from './modules/onboarding';
import { PersonaScreen } from './modules/persona';
import { DestinationScreen } from './modules/destination';
import { MapScreen } from './modules/map';
import { RouteScreen } from './modules/route';
import { NavScreen } from './modules/navigation';
import { ProfileScreen } from './modules/profile';
import { TripsScreen } from './modules/trips';

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
    loadUserProfile(user.id).then(({ role, generationCount }) => {
      dispatch({ type: 'SET_USER_ROLE', role });
      dispatch({ type: 'SET_GENERATION_COUNT', count: generationCount });
    }).catch(console.warn);

    const hasPersona = Boolean(localStorage.getItem('ur_persona'));
    const hasSeenWalkthrough = Boolean(localStorage.getItem('ur_walkthrough_seen'));
    if (hasPersona) {
      dispatch({ type: 'GO_TO', screen: 'destination' });
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
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle fresh sign-ins AND initial session from OAuth code exchange
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && initialScreen === 'login') {
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
      {currentScreen === 'ob1'          && <OB1Ritual />}
      {currentScreen === 'ob2'         && <OB2Motivation />}
      {currentScreen === 'ob3'         && <OB3Style />}
      {currentScreen === 'ob4'         && <OB4LocationType />}
      {currentScreen === 'ob5'         && <OB5Pace />}
      {currentScreen === 'persona'     && <PersonaScreen />}
      {currentScreen === 'destination' && <DestinationScreen />}
      {currentScreen === 'map'         && <MapScreen />}
      {currentScreen === 'route'       && <RouteScreen />}
      {currentScreen === 'trips'       && <TripsScreen />}
      {currentScreen === 'nav'         && <NavScreen />}
      {currentScreen === 'profile'     && <ProfileScreen />}

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

        {/* QR hint */}
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-white/8 w-full justify-center"
          style={{ background: 'rgba(255,255,255,.03)' }}
        >
          <span className="ms fill text-white/30 text-xl">qr_code</span>
          <p className="text-white/35 text-xs">Scan the QR code on your phone or visit this URL directly</p>
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
