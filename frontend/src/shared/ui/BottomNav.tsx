import { useState } from 'react';
import { useAppStore } from '../store';
import type { Screen } from '../types';

const NAV_ITEMS: { screen: Screen | 'community'; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore',   label: 'Explore'   },
  { screen: 'trips',       icon: 'route',     label: 'Itinerary' },
  { screen: 'community',   icon: 'diversity_3', label: 'Community' },
  { screen: 'profile',     icon: 'person',    label: 'Profile'   },
];

const OB_SCREENS = new Set<Screen>(['login', 'welcome', 'walkthrough', 'ob1', 'ob2', 'ob3', 'ob4', 'ob5']);

// Screens that should highlight the Explore tab (map is part of the explore flow)
const EXPLORE_SCREENS = new Set<Screen>(['destination', 'map']);

export function BottomNav() {
  const { state, dispatch } = useAppStore();
  const { currentScreen } = state;
  const [showCommunity, setShowCommunity] = useState(false);

  if (OB_SCREENS.has(currentScreen)) return null;

  function isActive(screen: Screen | 'community'): boolean {
    if (screen === 'community') return false;
    if (screen === 'destination') return EXPLORE_SCREENS.has(currentScreen);
    return currentScreen === screen;
  }

  function handleTap(screen: Screen | 'community') {
    if (screen === 'community') {
      setShowCommunity(true);
      return;
    }
    dispatch({ type: 'GO_TO', screen });
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 border-t border-white/8 flex items-center justify-around"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)',
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          zIndex: 30,
          background: 'rgba(10,14,20,.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {NAV_ITEMS.map(item => {
          const active = isActive(item.screen);
          return (
            <button
              key={item.screen}
              onClick={() => handleTap(item.screen)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                active ? 'text-primary' : 'text-text-3'
              }`}
            >
              <span className={`ms ${active ? 'fill' : ''} text-2xl`}>{item.icon}</span>
              <span className="text-[0.65rem] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Community coming-soon popup */}
      {showCommunity && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 50 }}
          onClick={() => setShowCommunity(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} />

          {/* Sheet */}
          <div
            className="relative w-full max-w-md rounded-t-3xl px-6 pt-6 pb-10"
            style={{ background: '#111827', border: '1px solid rgba(255,255,255,.08)', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />

            {/* Icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              <span className="ms fill text-white text-2xl">diversity_3</span>
            </div>

            {/* Text */}
            <div className="text-center mb-6">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                style={{ background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.25)' }}
              >
                <span className="ms fill text-purple-400" style={{ fontSize: 11 }}>schedule</span>
                <span className="text-purple-400 font-semibold" style={{ fontSize: 11 }}>Coming Soon</span>
              </div>
              <h2 className="font-heading font-bold text-white text-xl mb-2">Community</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Connect with fellow travelers, share your routes, and discover hidden gems from people who explore like you do.
              </p>
            </div>

            <button
              onClick={() => setShowCommunity(false)}
              className="w-full h-12 rounded-2xl font-semibold text-sm text-white/70 border border-white/10"
              style={{ background: 'rgba(255,255,255,.05)' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
