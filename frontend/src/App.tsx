import { useEffect } from 'react';
import { AppProvider, useAppStore } from './shared/store';
import { BottomNav } from './shared/ui';
import { supabase } from './shared/supabase';
import { syncProfile, loadSavedItineraries } from './shared/userSync';

import { LoginScreen } from './modules/login';
import { OB1Ritual, OB2Motivation, OB3Style, OB4LocationType, OB5Pace } from './modules/onboarding';
import { PersonaScreen } from './modules/persona';
import { DestinationScreen } from './modules/destination';
import { MapScreen } from './modules/map';
import { RouteScreen } from './modules/route';
import { NavScreen } from './modules/navigation';
import { ProfileScreen } from './modules/profile';

function ScreenRouter() {
  const { state, dispatch } = useAppStore();

  // Handle Supabase OAuth redirect: sync profile + itineraries, then navigate.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;

        // Sync Google profile data to Supabase
        syncProfile(user).catch(console.warn);

        // Load their saved itineraries from Supabase and merge into app state
        loadSavedItineraries(user.id).then(items => {
          if (items.length > 0) {
            dispatch({ type: 'SET_SAVED_ITINERARIES', items });
          }
        }).catch(console.warn);

        const hasPersona = Boolean(localStorage.getItem('ur_persona'));
        dispatch({ type: 'GO_TO', screen: hasPersona ? 'destination' : 'ob1' });
      }
    });
    return () => subscription.unsubscribe();
  }, [dispatch]);
  const { currentScreen } = state;

  return (
    <div
      className="relative w-full"
      style={{ background: '#0f172a', minHeight: '100dvh' }}
    >
      {currentScreen === 'login'       && <LoginScreen />}
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
      {/* Profile accessible from bottom nav via persona screen slot */}
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
