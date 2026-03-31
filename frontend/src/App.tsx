import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { AppProvider, useAppStore } from './shared/store';
import { BottomNav } from './shared/ui';
import { supabase } from './shared/supabase';
import { syncProfile, loadSavedItineraries } from './shared/userSync';

import { LoginScreen, WelcomeBackScreen } from './modules/login';
import { OB1Ritual, OB2Motivation, OB3Style, OB4LocationType, OB5Pace } from './modules/onboarding';
import { PersonaScreen } from './modules/persona';
import { DestinationScreen } from './modules/destination';
import { MapScreen } from './modules/map';
import { RouteScreen } from './modules/route';
import { NavScreen } from './modules/navigation';
import { ProfileScreen } from './modules/profile';

function ScreenRouter() {
  const { state, dispatch } = useAppStore();

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

    const hasPersona = Boolean(localStorage.getItem('ur_persona'));
    dispatch({ type: 'GO_TO', screen: hasPersona ? 'destination' : 'ob1' });
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
      // Only handle fresh sign-ins (not session restores on app open)
      if (event === 'SIGNED_IN' && session?.user && initialScreen === 'login') {
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
      {currentScreen === 'login'       && <LoginScreen />}
      {currentScreen === 'welcome'     && <WelcomeBackScreen />}
      {currentScreen === 'ob1'         && <OB1Ritual />}
      {currentScreen === 'ob2'         && <OB2Motivation />}
      {currentScreen === 'ob3'         && <OB3Style />}
      {currentScreen === 'ob4'         && <OB4LocationType />}
      {currentScreen === 'ob5'         && <OB5Pace />}
      {currentScreen === 'persona'     && <PersonaScreen />}
      {currentScreen === 'destination' && <DestinationScreen />}
      {currentScreen === 'map'         && <MapScreen />}
      {currentScreen === 'route'       && <RouteScreen />}
      {currentScreen === 'nav'         && <NavScreen />}
      {currentScreen === 'profile'     && <ProfileScreen />}

      <BottomNav />
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
