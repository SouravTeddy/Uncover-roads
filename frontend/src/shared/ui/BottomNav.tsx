import { useAppStore } from '../store';
import type { Screen } from '../types';

const NAV_ITEMS: { screen: Screen | 'community'; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore',   label: 'Explore'   },
  { screen: 'trips',       icon: 'route',     label: 'Itinerary' },
  { screen: 'community',   icon: 'diversity_3', label: 'Community' },
  { screen: 'profile',     icon: 'person',    label: 'Profile'   },
];

const OB_SCREENS = new Set<Screen>(['login', 'welcome', 'walkthrough', 'ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7', 'ob8', 'ob9', 'persona', 'route', 'nav']);

// Screens that should highlight the Explore tab (map is part of the explore flow)
const EXPLORE_SCREENS = new Set<Screen>(['destination', 'map']);

export function BottomNav() {
  const { state, dispatch } = useAppStore();
  const { currentScreen } = state;
  if (OB_SCREENS.has(currentScreen)) return null;

  function isActive(screen: Screen | 'community'): boolean {
    if (screen === 'community') return false;
    if (screen === 'destination') return EXPLORE_SCREENS.has(currentScreen);
    return currentScreen === screen;
  }

  function handleTap(screen: Screen | 'community') {
    if (screen === 'community') return; // muted — no interaction
    dispatch({ type: 'GO_TO', screen });
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 bg-[var(--nav-bg)] [backdrop-filter:blur(12px)] border-t border-[var(--color-divider)] flex items-center justify-around"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)',
          height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
          zIndex: 30,
        }}
      >
        {NAV_ITEMS.map(item => {
          const active = isActive(item.screen);
          const muted = item.screen === 'community';
          return (
            <button
              key={item.screen}
              onClick={() => handleTap(item.screen)}
              disabled={muted}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                muted ? 'text-[var(--color-text-3)] opacity-35' : ''
              }`}
            >
              <span className={`ms ${active && !muted ? 'fill text-[var(--color-primary)]' : 'text-[var(--color-text-3)]'} text-2xl`}>{item.icon}</span>
              <span className={`text-[10px] mt-0.5 font-semibold ${active && !muted ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-3)]'}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
