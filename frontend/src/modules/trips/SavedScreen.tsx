import { useState } from 'react';
import { useAppStore } from '../../shared/store';
import { TripsList } from './TripsScreen';
import { SavedPlacesTab } from './SavedPlacesTab';

type SubTab = 'itineraries' | 'saved';

export function SavedScreen() {
  const { state, dispatch } = useAppStore();
  const { favouritedPins, savedEvents, savedItineraries } = state;

  const defaultTab: SubTab = favouritedPins.length > 0 ? 'saved' : 'itineraries';
  const [activeTab, setActiveTab] = useState<SubTab>(defaultTab);

  function handleOpenMap(city: string) {
    const pin = favouritedPins.find(p => p.city === city);
    dispatch({ type: 'SET_CITY', city });
    if (pin) {
      dispatch({
        type: 'SET_CITY_GEO',
        geo: {
          lat: pin.lat,
          lon: pin.lon,
          bbox: [pin.lat - 0.15, pin.lat + 0.15, pin.lon - 0.15, pin.lon + 0.15],
        },
      });
    }
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  function handleRemovePin(placeId: string) {
    const pin = favouritedPins.find(p => p.placeId === placeId);
    if (pin) dispatch({ type: 'TOGGLE_FAVOURITE', pin });
  }

  function handleRemoveEvent(id: string) {
    dispatch({ type: 'REMOVE_EVENT', id });
  }

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: 'saved', label: 'Saved' },
    { key: 'itineraries', label: 'Itineraries' },
  ];

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)] flex flex-col overflow-hidden" style={{ zIndex: 10 }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '0.5rem' }}
      >
        <h1
          className="font-[family-name:var(--font-heading)] font-bold"
          style={{ fontSize: 22, color: 'var(--color-text-1)' }}
        >
          Saved
        </h1>

        {/* Sub-tabs */}
        <div className="flex gap-2 mt-3">
          {SUB_TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: isActive ? 'var(--color-primary)' : 'var(--color-surface2)',
                  color: isActive ? '#fff' : 'var(--color-text-3)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--color-border)'}`,
                }}
              >
                {tab.label}
                {tab.key === 'saved' && favouritedPins.length > 0 && (
                  <span className="ml-1.5 opacity-70">{favouritedPins.length}</span>
                )}
                {tab.key === 'itineraries' && savedItineraries.length > 0 && (
                  <span className="ml-1.5 opacity-70">{savedItineraries.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-28" style={{ scrollbarWidth: 'none' }}>
        {activeTab === 'saved' && (
          <SavedPlacesTab
            favouritedPins={favouritedPins}
            savedEvents={savedEvents}
            onOpenMap={handleOpenMap}
            onRemovePin={handleRemovePin}
            onRemoveEvent={handleRemoveEvent}
          />
        )}
        {activeTab === 'itineraries' && <TripsList />}
      </div>
    </div>
  );
}
