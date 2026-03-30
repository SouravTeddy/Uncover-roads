import { useAppStore } from '../store';
import type { Screen } from '../types';

const NAV_ITEMS: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'destination', icon: 'explore',  label: 'Explore' },
  { screen: 'map',         icon: 'map',      label: 'Map' },
  { screen: 'route',       icon: 'route',    label: 'Itinerary' },
  { screen: 'profile',     icon: 'person',   label: 'Profile' },
];

const OB_SCREENS = new Set<Screen>(['login', 'ob1', 'ob2', 'ob3', 'ob4', 'ob5']);

export function BottomNav() {
  const { state, dispatch } = useAppStore();
  const { currentScreen } = state;

  if (OB_SCREENS.has(currentScreen)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 bg-bg/95 border-t border-white/8 flex items-center justify-around"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)',
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        zIndex: 30,
        backdropFilter: 'blur(12px)',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = currentScreen === item.screen;
        return (
          <button
            key={item.screen}
            onClick={() => dispatch({ type: 'GO_TO', screen: item.screen })}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
              isActive ? 'text-primary' : 'text-text-3'
            }`}
          >
            <span className={`ms ${isActive ? 'fill' : ''} text-2xl`}>{item.icon}</span>
            <span className="text-[0.65rem] font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
