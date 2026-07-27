import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import type { Screen } from './shared/types';
import { AppProvider, useAppStore } from './shared/store';
import { BottomNav } from './shared/ui';
import { supabase } from './shared/supabase';
import { syncProfile, loadSavedItineraries, loadUserProfile, loadFavouritedPins, loadSavedEvents } from './shared/userSync';
import { initRevenueCat } from './shared/purchases';
import { useBuildStatus } from './shared/useBuildStatus';

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
import { TripsScreen, SavedScreen } from './modules/trips';
import { SubscriptionScreen } from './modules/subscription/SubscriptionScreen';

function ScreenRouter() {
  useBuildStatus();
  const { state, dispatch } = useAppStore();
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const stackRef = React.useRef(state.screenStack);
  stackRef.current = state.screenStack;
  const [desktopBypassed, setDesktopBypassed] = useState(() => {
    try { return localStorage.getItem('ur_desktop_bypass') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Intercept the browser/OS back button
  useEffect(() => {
    window.history.pushState({ ur: true }, '');
    function onPopState() {
      window.history.pushState({ ur: true }, ''); // re-arm the trap
      if (stackRef.current.length > 1) {
        dispatch({ type: 'GO_BACK' });
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignedIn(user: User) {
    // Block email/password users who haven't confirmed their email yet
    const isEmailProvider = (user.app_metadata?.provider ?? 'email') === 'email';
    if (isEmailProvider && !user.email_confirmed_at) {
      await supabase.auth.signOut();
      dispatch({ type: 'GO_TO', screen: 'login' });
      return;
    }

    // Init RevenueCat with the user's ID
    initRevenueCat(user.id).catch(console.warn);

    // Persist user info for the welcome back screen
    const rawName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const resolvedName = typeof rawName === 'object' && rawName !== null
      ? `${(rawName as Record<string,string>).firstName ?? ''} ${(rawName as Record<string,string>).lastName ?? ''}`.trim()
      : rawName;
    localStorage.setItem('ur_user', JSON.stringify({
      name: resolvedName || user.email || 'Explorer',
      avatar: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      email: user.email ?? '',
    }));

    syncProfile(user).catch(console.warn);
    loadSavedItineraries(user.id).then(items => {
      if (items.length > 0) dispatch({ type: 'SET_SAVED_ITINERARIES', items });
    }).catch(console.warn);
    loadFavouritedPins(user.id).then(pins => {
      if (pins.length > 0) dispatch({ type: 'SET_FAVOURITED_PINS', pins });
    }).catch(console.warn);
    loadSavedEvents(user.id).then(events => {
      if (events.length > 0) dispatch({ type: 'SET_SAVED_EVENTS', events });
    }).catch(console.warn);
    loadUserProfile(user.id).then(profile => {
      if (profile) {
        dispatch({ type: 'SET_USER_ROLE', role: profile.role });
        dispatch({ type: 'SET_GENERATION_COUNT', count: profile.generationCount });
        dispatch({ type: 'SET_USER_TIER', tier: profile.tier });
        dispatch({ type: 'SET_PACK_TRIPS', count: profile.packTripsRemaining });
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
        const midSessionScreens = ['map', 'route', 'destination', 'journey', 'saved', 'trips'];
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

  // Handle OAuth deep-link callback on native (Android/iOS).
  // When the in-app browser completes Google sign-in, the OS fires appUrlOpen
  // with the redirect URL containing ?code=. We exchange it for a session here.
  useEffect(() => {
    let removeListener: (() => void) | undefined;
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor/app').then(({ App: CapApp }) => {
        import('@capacitor/browser').then(({ Browser }) => {
          CapApp.addListener('appUrlOpen', async ({ url }: { url: string }) => {
            console.log('[appUrlOpen] received url:', url);
            if (url.startsWith('uncoverroads://') || url.includes('uncover-roads.vercel.app')) {
              await Browser.close();
              if (url.includes('#access_token=')) {
                // Implicit flow — token is in the URL hash fragment
                const hash = url.split('#')[1] ?? '';
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token') ?? '';
                const refreshToken = params.get('refresh_token') ?? '';
                const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                if (!error && data.session?.user) {
                  handleSignedIn(data.session.user);
                } else {
                  console.error('[OAuth] setSession failed:', error?.message);
                }
              } else if (url.includes('error=') || url.includes('error_description=')) {
                const params = new URLSearchParams(url.split('?')[1] ?? url.split('#')[1] ?? '');
                const errDesc = params.get('error_description') ?? params.get('error') ?? 'Unknown error';
                console.error('[OAuth] callback error:', errDesc);
              } else {
                // PKCE flow — exchange code for session
                console.log('[OAuth] attempting exchangeCodeForSession');
                const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(url);
                console.log('[OAuth] exchange result — session:', !!session, 'error:', error?.message);
                if (error) {
                  console.error('[OAuth] exchangeCodeForSession failed:', error.message, 'url:', url);
                  const { data: { session: fallback } } = await supabase.auth.getSession();
                  console.log('[OAuth] fallback session:', !!fallback);
                  if (fallback?.user) handleSignedIn(fallback.user);
                } else if (session?.user) {
                  handleSignedIn(session.user);
                }
              }
            } else {
              console.log('[appUrlOpen] url not matched, ignoring');
            }
          }).then((handle: { remove: () => void }) => {
            removeListener = handle.remove;
          });
        });
      });
    });
    return () => { removeListener?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // Always load role + generation count + tier so values can't be spoofed via localStorage
        loadUserProfile(session.user.id).then(profile => {
          if (profile) {
            dispatch({ type: 'SET_USER_ROLE', role: profile.role });
            dispatch({ type: 'SET_GENERATION_COUNT', count: profile.generationCount });
            dispatch({ type: 'SET_USER_TIER', tier: profile.tier });
            dispatch({ type: 'SET_PACK_TRIPS', count: profile.packTripsRemaining });
          }
          dispatch({ type: 'PROFILE_LOADED' });
        }).catch(() => { dispatch({ type: 'PROFILE_LOADED' }); });
      }
    });

    // Screens that represent an active in-progress session — if the user is
    // already on one of these, a spurious SIGNED_IN event (e.g. token refresh
    // on Android app resume) must NOT kick them back to the welcome screen.
    const activeMidSessionScreens = new Set([
      'map', 'route', 'destination', 'journey', 'persona', 'nav', 'trips', 'saved', 'profile', 'subscription', 'itinerary-reel',
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
              dispatch({ type: 'SET_USER_TIER', tier: profile.tier });
              dispatch({ type: 'SET_PACK_TRIPS', count: profile.packTripsRemaining });
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

  // Once the map has been visited, keep it mounted forever so MapLibre state survives tab switches.
  const mapEverVisited = React.useRef(false);
  if (currentScreen === 'map') mapEverVisited.current = true;

  if (isDesktop && !desktopBypassed && state.currentScreen !== 'trips') {
    return <DesktopGate onBypass={() => {
      try { localStorage.setItem('ur_desktop_bypass', '1'); } catch { /* ignore */ }
      setDesktopBypassed(true);
    }} />;
  }

  return (
    <div
      className="relative w-full"
      style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}
    >
      {/* MapScreen lives outside AnimatePresence so the MapLibre instance (tiles, viewport,
          pins) survives tab switches. Mounted on first visit, then toggled via display. */}
      {mapEverVisited.current && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          display: currentScreen === 'map' ? undefined : 'none',
        }}>
          <MapScreen />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          style={{ position: 'absolute', inset: 0, minHeight: '100dvh' }}
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
          {currentScreen === 'journey'     && <JourneyScreen />}
          {currentScreen === 'route'          && <RouteScreen />}
          {/* itinerary-reel is now embedded inside TripsScreen (Current tab) */}
          {currentScreen === 'trips'       && <TripsScreen />}
          {currentScreen === 'saved'       && <SavedScreen />}
          {currentScreen === 'nav'         && <NavScreen />}
          {currentScreen === 'profile'     && <ProfileScreen />}
          {currentScreen === 'subscription' && <SubscriptionScreen />}
        </motion.div>
      </AnimatePresence>

      <BottomNav />

    </div>
  );
}

function DesktopGate({ onBypass }: { onBypass: () => void }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-8"
      style={{ background: 'var(--color-bg2)' }}
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
          <p className="text-[var(--color-text-4)] text-xs font-medium uppercase tracking-widest">Travel Planner</p>
        </div>

        {/* Message */}
        <div className="flex flex-col gap-2">
          <p className="text-[var(--color-text-1)] text-base font-semibold leading-snug">
            Built for the road, not the desk.
          </p>
          <p className="text-[var(--color-text-3)] text-sm leading-relaxed">
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
          <p className="text-[var(--color-text-4)] text-xs">Scan to open on your phone</p>
        </div>

        {/* Desktop bypass */}
        <button
          onClick={onBypass}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-4)', fontSize: 12,
            padding: '4px 8px', borderRadius: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-2)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-4)')}
        >
          Continue on desktop anyway →
        </button>
      </div>
    </div>
  );
}

// ── Dev-only scenic test harness ─────────────────────────────────────────────
let ScenicDevPreview: React.ComponentType | null = null;
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('scenic') === '1') {
  const { default: ReelScenicCard } = await import('./modules/route/reel/ReelScenicCard');
  const CARDS = [
    { type: 'scenic' as const, sceneType: 'walk' as const, accent: '#c4b5fd', cardType: 'WALK SPINE', pos: 1, total: 6, timing: 'Evening · 8:00 PM', metaRight: 'Shibuya Ward', place: 'Omotesando Boulevard', from: 'Harajuku', to: 'Omotesando Hills', modeIcon: 'walk' as const, tag: 'Walk', vizType: 'corridor' as const, persona: 'Walk-lover', personaDisplay: 'Walk Lover', personaIcon: 'walk', why: 'Slotted in because you walk between consecutive stops — no transit gap to bridge.', sensory: 'Boutique-lined and at its quietest after 8 PM — none of the daytime crowds.', sensoryIcon: 'store', reelPos: 'Between Stop 2 and Stop 3', photoUrl: null, detourKm: 0, detourMin: 0 },
    { type: 'scenic' as const, sceneType: 'drive' as const, accent: '#f4c478', cardType: 'SELF-DRIVE DAY', pos: 2, total: 6, timing: 'Afternoon · 3:30 PM', metaRight: '2h 30m', place: 'Coastal Highway 17', from: 'Panaji', to: 'Baga', modeIcon: 'car' as const, tag: 'Self-drive', vizType: 'route' as const, persona: 'Self-drive', personaDisplay: 'Self-Drive', personaIcon: 'car', why: 'Framed as your Day 2 intro — built for self-drive, with zero transit dependencies.', sensory: 'Hits all 3 coastal viewpoints without the NH-66 toll detour.', sensoryIcon: 'camera', reelPos: 'Day 2 intro card variant', photoUrl: null, detourKm: 0, detourMin: 0 },
    { type: 'scenic' as const, sceneType: 'coastal' as const, accent: '#f0a06a', cardType: 'COASTAL ROAD', pos: 3, total: 6, timing: 'Sunset window · 6:10 PM', metaRight: '18 km', place: 'Marine Drive, Calangute', from: 'Calangute', to: 'Sinquerim', modeIcon: 'car' as const, tag: 'Coastal', vizType: 'sunset' as const, persona: 'Light-chaser', personaDisplay: 'Light Chaser', personaIcon: 'twilight', why: 'Timed to your eye for light — golden hour lands on the water at the exact midpoint.', sensory: 'Road sits within 80 m of the sea the entire 18 km — no inland detours.', sensoryIcon: 'waves', reelPos: 'Between Stop 4 and Stop 5 · evening', photoUrl: null, detourKm: 0, detourMin: 0 },
    { type: 'scenic' as const, sceneType: 'ridge' as const, accent: '#9ec5ff', cardType: 'RIDGE ROAD', pos: 4, total: 6, timing: 'Morning · 7:30 AM', metaRight: 'Murree Hills', place: 'Nathia Gali Pass', from: 'Murree', to: 'Nathia Gali', modeIcon: 'car' as const, tag: 'Mountain', vizType: 'elevation' as const, persona: 'Peak-seeker', personaDisplay: 'Peak Seeker', personaIcon: 'terrain', why: 'Picked for the elevation change you favour — a 270° panorama opens at the saddle.', sensory: 'Start before 8 AM — cloud closes in from the west by noon and blocks the views.', sensoryIcon: 'cloud', reelPos: 'Day 1 morning connector', photoUrl: null, detourKm: 0, detourMin: 0 },
    { type: 'scenic' as const, sceneType: 'crowd' as const, accent: '#5cd97a', cardType: 'CROWD-FREE', pos: 5, total: 6, timing: 'Pre-dawn · 6:00 AM', metaRight: '9 km', place: 'Sal Forest Bypass', from: 'Palolem', to: 'Agonda Beach', modeIcon: 'car' as const, tag: 'Quiet', vizType: 'quiet' as const, persona: 'Crowd-averse', personaDisplay: 'Crowd Averse', personaIcon: 'person_off', why: 'Your crowd score is high — this road was effectively built for you. No coaches, no tags.', sensory: 'Untagged on Google Maps. 9 km of Sal canopy in full silence, except birdsong.', sensoryIcon: 'eq', reelPos: 'Day 3 dawn connector', photoUrl: null, detourKm: 0, detourMin: 0 },
    { type: 'scenic' as const, sceneType: 'forest' as const, accent: '#86efac', cardType: 'FOREST CANOPY', pos: 6, total: 6, timing: 'Morning · 9:00 AM', metaRight: 'Central Goa', place: 'Spice Plantation Trail', from: 'Ponda', to: 'Savoi Plantation', modeIcon: 'car' as const, tag: 'Canopy', vizType: 'canopy' as const, persona: 'Nature-lover', personaDisplay: 'Nature Lover', personaIcon: 'forest', why: 'A nature-archetype match — runs straight into the Savoi spice estate you saved.', sensory: 'Full overhead canopy the entire 8 km drops the temperature 4–5 °C inside.', sensoryIcon: 'thermostat', reelPos: 'Day 2 morning slow road', photoUrl: null, detourKm: 0, detourMin: 0 },
  ];
  ScenicDevPreview = () => (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'scroll', scrollSnapType: 'y mandatory' }} className="no-scrollbar">
      {CARDS.map((card) => (
        <div key={card.pos} style={{ height: '100dvh', scrollSnapAlign: 'start' }}>
          <ReelScenicCard card={card} active />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  React.useEffect(() => {
    const saved = localStorage.getItem('ur_theme') as 'dark' | 'light' | null;
    if (saved) {
      document.documentElement.dataset.theme = saved;
      useAppStore.getState().dispatch({ type: 'SET_THEME', theme: saved });
    }
  }, []);

  if (ScenicDevPreview) return <ScenicDevPreview />;

  return (
    <AppProvider>
      <ScreenRouter />
    </AppProvider>
  );
}
