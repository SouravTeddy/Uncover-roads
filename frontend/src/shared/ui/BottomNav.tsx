import { useAppStore } from '../store';
import type { Screen } from '../types';

const NAV_ITEMS: { screen: Screen | 'community'; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore',     label: 'Explore'   },
  { screen: 'trips',       icon: 'route',       label: 'Itinerary' },
  { screen: 'community',   icon: 'diversity_3', label: 'Community' },
  { screen: 'profile',     icon: 'person',      label: 'Profile'   },
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
    if (screen === 'community') return;
    dispatch({ type: 'GO_TO', screen });
  }

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: 'rgba(12,12,14,.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(242,237,230,.08)',
        borderRadius: 999,
        padding: '6px 8px',
        width: 'max-content',
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 14px',
              borderRadius: 999,
              border: 'none',
              cursor: muted ? 'default' : 'pointer',
              background: active && !muted ? 'var(--color-primary-bg)' : 'transparent',
              opacity: muted ? 0.35 : 1,
              transition: 'background 0.15s',
            }}
          >
            <span
              className={`ms${active && !muted ? ' fill' : ''}`}
              style={{
                fontSize: 20,
                color: active && !muted ? 'var(--color-primary)' : 'var(--color-text-3)',
                lineHeight: 1,
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: active && !muted ? 700 : 500,
                color: active && !muted ? 'var(--color-primary)' : 'var(--color-text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
