import { useAppStore } from '../store';
import type { Screen } from '../types';

const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore', label: 'Explore'   },
  { screen: 'trips',       icon: 'route',    label: 'Itinerary' },
  { screen: 'profile',     icon: 'person',  label: 'Profile'   },
];

const OB_SCREENS = new Set<Screen>(['login', 'welcome', 'walkthrough', 'ob1', 'ob2', 'ob3', 'ob4', 'ob5', 'ob6', 'ob7', 'ob8', 'ob9', 'persona', 'route', 'nav']);

const EXPLORE_SCREENS    = new Set<Screen>(['destination', 'map']);
const ITINERARY_SCREENS  = new Set<Screen>(['trips', 'itinerary-reel']);

export function BottomNav() {
  const { state, dispatch } = useAppStore();
  const { currentScreen } = state;
  if (OB_SCREENS.has(currentScreen)) return null;

  function isActive(screen: Screen): boolean {
    if (screen === 'destination') return EXPLORE_SCREENS.has(currentScreen);
    if (screen === 'trips')       return ITINERARY_SCREENS.has(currentScreen);
    return currentScreen === screen;
  }

  function handleTap(screen: Screen) {
    dispatch({ type: 'NAV_TAB', screen });
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
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--color-divider)',
        borderRadius: 999,
        padding: '6px 8px',
        width: 'max-content',
        pointerEvents: 'none',
      }}
    >
      {NAV_ITEMS.map(item => {
        const active = isActive(item.screen);

        return (
          <button
            key={item.screen}
            onClick={() => handleTap(item.screen)}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 14px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--color-primary-bg)' : 'transparent',
              transition: 'background 0.15s',
              pointerEvents: 'auto',
            }}
          >
            <span
              className={`ms${active ? ' fill' : ''}`}
              style={{
                fontSize: 20,
                color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
                lineHeight: 1,
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
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
