import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap as useLeafletMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

// Fix Leaflet default icon URLs broken by Vite bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(category: string, selected: boolean) {
  const color = selected ? '#f97316' : '#3b82f6';
  const icon = CATEGORY_ICONS[category] ?? 'location_on';
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);border:2px solid rgba(255,255,255,.3)">
      <span class="ms fill" style="transform:rotate(45deg);color:#fff;font-size:16px;font-family:'Material Symbols Outlined'">${icon}</span>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function MapPins({
  places,
  selectedIds,
  onPinClick,
}: {
  places: Place[];
  selectedIds: Set<string>;
  onPinClick: (place: Place) => void;
}) {
  const map = useLeafletMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    places.forEach(place => {
      if (!place.lat || !place.lon) return;
      const selected = selectedIds.has(place.id);
      const marker = L.marker([place.lat, place.lon], {
        icon: makeIcon(place.category, selected),
      });
      marker.on('click', () => onPinClick(place));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [places, selectedIds, map, onPinClick]);

  return null;
}

function FitBounds({ places, cityGeo }: { places: Place[]; cityGeo: { lat: number; lon: number } | null }) {
  const map = useLeafletMap();

  useEffect(() => {
    if (places.length > 0) {
      const validPlaces = places.filter(p => p.lat && p.lon);
      if (validPlaces.length > 0) {
        const bounds = L.latLngBounds(validPlaces.map(p => [p.lat, p.lon]));
        map.fitBounds(bounds, { padding: [48, 48] });
      }
    } else if (cityGeo) {
      map.setView([cityGeo.lat, cityGeo.lon], 13);
    }
  }, [places, cityGeo, map]);

  return null;
}

export function MapScreen() {
  const {
    city,
    cityGeo,
    filteredPlaces,
    places,
    selectedPlaces,
    activeFilter,
    loading,
    activePlace,
    setActivePlace,
    togglePlace,
    setFilter,
    goToRoute,
    goBack,
  } = useMap();

  const selectedIds = new Set(selectedPlaces.map(p => p.id));

  const counts: Partial<Record<string, number>> = {
    all: places.length,
    museum: places.filter(p => p.category === 'museum').length,
    park: places.filter(p => p.category === 'park').length,
    restaurant: places.filter(p => p.category === 'restaurant').length,
    historic: places.filter(p => p.category === 'historic').length,
  };

  const center: [number, number] = cityGeo
    ? [cityGeo.lat, cityGeo.lon]
    : [20, 0];

  return (
    <div className="fixed inset-0" style={{ zIndex: 10 }}>
      {/* Map */}
      <MapContainer
        center={center}
        zoom={cityGeo ? 13 : 2}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds places={filteredPlaces} cityGeo={cityGeo} />
        <MapPins
          places={filteredPlaces}
          selectedIds={selectedIds}
          onPinClick={p => setActivePlace(p)}
        />
      </MapContainer>

      {/* UI overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
        {/* Header */}
        <div
          className="pointer-events-auto flex flex-col gap-3 px-4 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-bg/80 backdrop-blur flex items-center justify-center border border-white/10"
            >
              <span className="ms text-text-2 text-base">arrow_back</span>
            </button>
            <div className="flex items-center gap-2 px-4 h-10 rounded-full bg-bg/80 backdrop-blur border border-white/10">
              <span className="ms text-text-3 text-base">location_on</span>
              <span className="text-text-1 font-semibold text-sm">{city || '—'}</span>
              {places.length > 0 && (
                <span className="text-text-3 text-xs">{places.length} places</span>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <FilterBar
            active={activeFilter as MapFilter}
            counts={counts}
            onSelect={setFilter}
          />
        </div>

        {/* Live indicator */}
        <div
          className="pointer-events-none absolute flex items-center gap-2 px-3 py-2 rounded-full border border-white/10"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 5.5rem)',
            right: '1.25rem',
            background: 'rgba(29,33,41,.6)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="w-2 h-2 rounded-full bg-[#70F8E8] animate-pulse" />
          <span className="text-white text-xs font-bold tracking-widest uppercase">
            {loading ? 'Loading' : 'Exploring'}
          </span>
        </div>

        {/* Pin card */}
        {activePlace && (
          <div className="pointer-events-auto absolute inset-x-4 bottom-40">
            <PinCard
              place={activePlace}
              isSelected={selectedIds.has(activePlace.id)}
              onAdd={() => togglePlace(activePlace)}
              onClose={() => setActivePlace(null)}
            />
          </div>
        )}

        {/* Create itinerary CTA */}
        {selectedPlaces.length >= 2 && (
          <div
            className="pointer-events-auto absolute inset-x-4 flex gap-3"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
          >
            <button
              onClick={goToRoute}
              className="flex-1 h-14 rounded-2xl bg-orange font-heading font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg"
            >
              <span className="ms fill text-base">auto_fix</span>
              Create Itinerary ({selectedPlaces.length})
            </button>
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/60 z-30">
          <div className="flex flex-col items-center gap-3">
            <span className="ms text-primary text-4xl animate-spin">autorenew</span>
            <span className="text-text-2 text-sm">Loading places…</span>
          </div>
        </div>
      )}
    </div>
  );
}
