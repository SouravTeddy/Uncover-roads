import { useEffect } from 'react';
import { AppProvider, useAppStore } from './shared/store';
import { BottomNav } from './shared/ui';
import { supabase } from './shared/supabase';

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

  // Handle Supabase OAuth redirect: on SIGNED_IN, send new users to onboarding
  // and returning users (who already have a persona) to the destination screen.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
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
