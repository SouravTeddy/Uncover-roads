import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap as useLeafletMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter } from '../../shared/types';
import { TripSheet } from './TripSheet';
import { makeIcon, makeRecommendedIcon, makeSelectedIcon } from './icons';
import { useMapMove } from './useMapMove';
import { SearchHereButton } from './SearchHereButton';
import { mapData } from '../../shared/api';
import type { BBox } from '../../shared/api';
import { useAppStore } from '../../shared/store';

// Fix Leaflet default icon URLs broken by Vite bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Clustering helpers ──────────────────────────────────────────

function buildClusters(places: Place[], map: L.Map, gridSize = 38): Place[][] {
  const clusters: Place[][] = [];
  const assigned = new Set<number>();

  places.forEach((place, i) => {
    if (assigned.has(i)) return;
    const pt = map.latLngToContainerPoint([place.lat, place.lon]);
    const group: Place[] = [place];
    assigned.add(i);

    places.forEach((other, j) => {
      if (i === j || assigned.has(j)) return;
      const op = map.latLngToContainerPoint([other.lat, other.lon]);
      const dx = pt.x - op.x;
      const dy = pt.y - op.y;
      if (Math.sqrt(dx * dx + dy * dy) < gridSize) {
        group.push(other);
        assigned.add(j);
      }
    });

    clusters.push(group);
  });

  return clusters;
}

/** Pan map so a tapped pin sits in the upper-center, clear of the card at the bottom */
function panToPinAboveCard(map: L.Map, lat: number, lon: number) {
  // Card + bottom nav ≈ 230px. Shift the center down 90px so the pin ends up ~90px above center.
  const pt = map.project([lat, lon], map.getZoom());
  pt.y += 90;
  map.panTo(map.unproject(pt, map.getZoom()), { animate: true, duration: 0.3 });
}

function makeClusterIcon(count: number, hasRecommended: boolean, hasSelected: boolean) {
  const accent = (hasSelected || hasRecommended) ? '#f97316' : '#374151';
  const ring   = (hasSelected || hasRecommended) ? 'rgba(249,115,22,.25)' : 'rgba(255,255,255,.07)';
  const inner  = count >= 10 ? 44 : count >= 5 ? 38 : 32;
  const outer  = inner + 10;
  const fs     = count >= 10 ? 14 : 13;
  return L.divIcon({
    className: '',
    html: `<div style="width:${outer}px;height:${outer}px;border-radius:50%;background:${ring};display:flex;align-items:center;justify-content:center">
      <div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.22)">
        <span style="font-weight:700;color:#fff;font-size:${fs}px;font-family:system-ui,sans-serif;letter-spacing:-0.5px;line-height:1">${count}</span>
      </div>
    </div>`,
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer / 2],
  });
}

function MapPins({
  places,
  selectedIds,
  recommendedIds,
  onPinClick,
}: {
  places: Place[];
  selectedIds: Set<string>;
  recommendedIds: Set<string>;
  onPinClick: (place: Place) => void;
}) {
  const map = useLeafletMap();
  // Individual (non-clustered) place markers keyed by id — allows in-place icon updates
  const pinMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  // Cluster markers with their member groups — allows in-place cluster icon updates
  const clusterMarkersRef = useRef<Array<{ marker: L.Marker; group: Place[] }>>([]);

  const rebuild = useCallback(() => {
    pinMarkersRef.current.forEach(m => m.remove());
    pinMarkersRef.current = new Map();
    clusterMarkersRef.current.forEach(({ marker }) => marker.remove());
    clusterMarkersRef.current = [];

    const valid = places.filter(p => p.lat && p.lon);
    if (valid.length === 0) return;

    buildClusters(valid, map).forEach(group => {
      if (group.length === 1) {
        const place = group[0];
        const icon = selectedIds.has(place.id)
          ? makeSelectedIcon(place.category)
          : recommendedIds.has(place.id)
            ? makeRecommendedIcon(place.category)
            : makeIcon(place.category);
        const marker = L.marker([place.lat, place.lon], { icon });
        marker.on('click', () => {
          panToPinAboveCard(map, place.lat, place.lon);
          onPinClick(place);
        });
        marker.addTo(map);
        pinMarkersRef.current.set(place.id, marker);
      } else {
        const hasRec = group.some(p => recommendedIds.has(p.id));
        const hasSel = group.some(p => selectedIds.has(p.id));
        const clat = group.reduce((s, p) => s + p.lat, 0) / group.length;
        const clon = group.reduce((s, p) => s + p.lon, 0) / group.length;
        const marker = L.marker([clat, clon], {
          icon: makeClusterIcon(group.length, hasRec, hasSel),
        });
        marker.on('click', () => {
          const bounds = L.latLngBounds(group.map(p => [p.lat, p.lon] as [number, number]));
          map.flyToBounds(bounds, { padding: [72, 72], maxZoom: map.getZoom() + 3, duration: 0.4 });
        });
        marker.addTo(map);
        clusterMarkersRef.current.push({ marker, group });
      }
    });
  }, [places, selectedIds, recommendedIds, map, onPinClick]);

  // Rebuild on place list change and on every zoom/pan (clusters are zoom-dependent)
  useEffect(() => {
    rebuild();
    map.on('zoomend moveend', rebuild);
    return () => {
      map.off('zoomend moveend', rebuild);
      pinMarkersRef.current.forEach(m => m.remove());
      pinMarkersRef.current = new Map();
      clusterMarkersRef.current.forEach(({ marker }) => marker.remove());
      clusterMarkersRef.current = [];
    };
  }, [rebuild, map]);

  // Update individual pin icons in-place when selection changes — no flicker for non-clustered pins
  useEffect(() => {
    pinMarkersRef.current.forEach((marker, id) => {
      const place = places.find(p => p.id === id);
      if (!place) return;
      const icon = selectedIds.has(id)
        ? makeSelectedIcon(place.category)
        : recommendedIds.has(id)
          ? makeRecommendedIcon(place.category)
          : makeIcon(place.category);
      marker.setIcon(icon);
    });
    // Update cluster icons in-place when a clustered place gets selected/deselected
    clusterMarkersRef.current.forEach(({ marker, group }) => {
      const hasRec = group.some(p => recommendedIds.has(p.id));
      const hasSel = group.some(p => selectedIds.has(p.id));
      marker.setIcon(makeClusterIcon(group.length, hasRec, hasSel));
    });
  }, [selectedIds, places, recommendedIds]);

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

function MapMoveListener({
  cityCenter,
  onMove,
}: {
  cityCenter: { lat: number; lon: number } | null;
  onMove: (show: boolean, bbox: [number, number, number, number] | null, reset: () => void) => void;
}) {
  const { showSearchHere, currentBbox, resetSearchHere } = useMapMove(cityCenter);

  useEffect(() => {
    onMove(showSearchHere, currentBbox, resetSearchHere);
  }, [showSearchHere, currentBbox, resetSearchHere, onMove]);

  return null;
}

function PinDropListener({
  active,
  onDrop,
}: {
  active: boolean;
  onDrop: (latlng: { lat: number; lon: number }) => void;
}) {
  const map = useLeafletMap();
  useEffect(() => {
    if (!active) return;
    const handler = (e: L.LeafletMouseEvent) => {
      onDrop({ lat: e.latlng.lat, lon: e.latlng.lng });
    };
    map.once('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [active, map, onDrop]);
  return null;
}

export function MapScreen() {
  const {
    city,
    cityGeo,
    filteredPlaces,
    recommendedPlaces,
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

  const { dispatch } = useAppStore();

  const selectedIds = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);
  const recommendedIds = useMemo(
    () => new Set(recommendedPlaces.map(p => p.id)),
    [recommendedPlaces]
  );
  const handlePinClick = useCallback((p: Place) => setActivePlace(p), [setActivePlace]);
  const [showTripSheet, setShowTripSheet] = useState(false);

  // Search Here state
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [searchBbox, setSearchBbox] = useState<BBox | null>(null);
  const [searchHereLoading, setSearchHereLoading] = useState(false);
  const resetSearchHereRef = useRef<() => void>(() => {});

  // Drop pin state
  const [awaitingPinDrop, setAwaitingPinDrop] = useState(false);
  const [pinDropResult, setPinDropResult] = useState<{ lat: number; lon: number } | null>(null);

  const cityCenter = cityGeo ? { lat: cityGeo.lat, lon: cityGeo.lon } : null;

  const handleMapMove = useCallback(
    (show: boolean, bbox: BBox | null, reset: () => void) => {
      setShowSearchHere(show);
      setSearchBbox(bbox);
      resetSearchHereRef.current = reset;
    },
    [],
  );

  const handleSearchHere = useCallback(async () => {
    if (!searchBbox || !city || !cityGeo) return;
    setSearchHereLoading(true);
    try {
      const data = await mapData(city, cityGeo.lat, cityGeo.lon, [], searchBbox);
      const withIds = (Array.isArray(data) ? data : []).map((p, i) => ({
        ...p,
        id: p.id ?? `${p.title}-${i}`,
      }));
      dispatch({ type: 'MERGE_PLACES', places: withIds });
    } catch (e) {
      console.error('[MapScreen] searchHere failed:', e);
    } finally {
      setSearchHereLoading(false);
      resetSearchHereRef.current();
    }
  }, [searchBbox, city, cityGeo, dispatch]);

  // When pin is dropped: store result, re-open sheet so user can continue
  const handlePinDrop = useCallback(
    (latlng: { lat: number; lon: number }) => {
      setPinDropResult(latlng);
      setAwaitingPinDrop(false);
      setShowTripSheet(true);
    },
    [],
  );

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
    <div className="fixed inset-0" style={{ zIndex: awaitingPinDrop ? 35 : 10 }}>
      {/* Map — full screen, no sibling overlays on top */}
      <MapContainer
        center={center}
        zoom={cityGeo ? 13 : 2}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitBounds places={filteredPlaces} cityGeo={cityGeo} />
        <MapPins
          places={filteredPlaces}
          selectedIds={selectedIds}
          recommendedIds={recommendedIds}
          onPinClick={handlePinClick}
        />
        <MapMoveListener cityCenter={cityCenter} onMove={handleMapMove} />
        <PinDropListener active={awaitingPinDrop} onDrop={handlePinDrop} />
      </MapContainer>

      {/* Search Here button — shown after panning */}
      {showSearchHere && (
        <SearchHereButton onSearch={handleSearchHere} loading={searchHereLoading} />
      )}

      {/* Drop pin instructional strip */}
      {awaitingPinDrop && (
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-5 py-4"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
            zIndex: 20,
            background: 'linear-gradient(to top, rgba(20,184,166,.9), rgba(20,184,166,.7))',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span className="text-xl">📍</span>
          <p className="text-white font-semibold text-sm">Tap the map to drop your starting pin</p>
          <button
            onClick={() => setAwaitingPinDrop(false)}
            className="ml-auto text-white/70 text-xs underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}

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

      {/* Loading spinner — only shown while fetching */}
      {loading && (
        <div
          className="absolute flex items-center gap-2 px-3 h-8 rounded-full"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 5.5rem)',
            right: '1rem',
            zIndex: 20,
            pointerEvents: 'none',
            background: 'rgba(15,20,30,.75)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <span className="ms text-primary text-sm animate-spin">autorenew</span>
          <span className="text-white/70 text-xs font-medium">Loading</span>
        </div>
      )}

      {/* Pin card */}
      {activePlace && (
        <div
          className="absolute inset-x-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)', zIndex: 20 }}
        >
          <PinCard
            place={activePlace}
            city={city}
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

      {showTripSheet && (
        <TripSheet
          onClose={() => setShowTripSheet(false)}
          onRequestPinDrop={() => { setAwaitingPinDrop(true); }}
          pinDropResult={pinDropResult}
          cityGeo={cityGeo}
        />
      )}
    </div>
  );
}
