import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap as useLeafletMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter } from '../../shared/types';
import { CATEGORY_ICONS } from './types';
import { TripSheet } from './TripSheet';

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
    error,
    loadPlaces,
    activePlace,
    setActivePlace,
    togglePlace,
    setFilter,
    goBack,
  } = useMap();

  const selectedIds = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);
  const handlePinClick = useCallback((p: Place) => setActivePlace(p), [setActivePlace]);
  const [showTripSheet, setShowTripSheet] = useState(false);

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
      {/* Map — full screen, no sibling overlays on top */}
      <MapContainer
        center={center}
        zoom={cityGeo ? 13 : 2}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
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
          onPinClick={handlePinClick}
        />
      </MapContainer>

      {/* ── Each UI element positioned independently ── */}

      {/* Header row: back + city chip */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col gap-3 px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', zIndex: 20, pointerEvents: 'none' }}
      >
        <div className="flex items-center gap-3" style={{ pointerEvents: 'auto' }}>
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
        <div style={{ pointerEvents: 'auto' }}>
          <FilterBar
            active={activeFilter as MapFilter}
            counts={counts}
            onSelect={setFilter}
          />
        </div>
      </div>

      {/* Live / Loading indicator — top-right */}
      <div
        className="absolute flex items-center gap-2 px-3 py-2 rounded-full border border-white/10"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 5.5rem)',
          right: '1.25rem',
          zIndex: 20,
          pointerEvents: 'none',
          background: 'rgba(29,33,41,.6)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {loading
          ? <span className="ms text-primary text-base animate-spin">autorenew</span>
          : <div className="w-2 h-2 rounded-full bg-[#70F8E8] animate-pulse" />
        }
        <span className="text-white text-xs font-bold tracking-widest uppercase">
          {loading ? 'Loading' : 'Exploring'}
        </span>
      </div>

      {/* Pin card */}
      {activePlace && (
        <div
          className="absolute inset-x-4 bottom-40"
          style={{ zIndex: 20 }}
        >
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
          className="absolute inset-x-4 flex gap-3"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', zIndex: 20 }}
        >
          <button
            onClick={() => setShowTripSheet(true)}
            className="flex-1 h-14 rounded-2xl bg-orange font-heading font-bold text-white text-base flex items-center justify-center gap-2 shadow-lg"
          >
            <span className="ms fill text-base">auto_fix</span>
            Create Itinerary ({selectedPlaces.length})
          </button>
        </div>
      )}

      {/* Empty / error state */}
      {!loading && error && (
        <div
          className="absolute flex flex-col items-center gap-3 px-6 py-5 rounded-2xl text-center"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            background: 'rgba(15,23,42,.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)',
            minWidth: '220px',
          }}
        >
          <span className="ms text-text-3 text-3xl">location_off</span>
          <div>
            <p className="text-text-1 font-semibold text-sm mb-1">
              {places.length === 0 ? 'No places found' : 'Could not load places'}
            </p>
            <p className="text-text-3 text-xs">
              {city ? `Nothing came back for "${city}"` : 'Please select a city first'}
            </p>
          </div>
          {city && (
            <button
              onClick={() => loadPlaces()}
              className="mt-1 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {showTripSheet && <TripSheet onClose={() => setShowTripSheet(false)} />}
    </div>
  );
}
