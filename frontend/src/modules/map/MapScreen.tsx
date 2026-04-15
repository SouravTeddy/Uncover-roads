import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter, Category } from '../../shared/types';
import { TripPlanningCard } from './TripPlanningCard';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { useMapMove } from './useMapMove';
import { MapStatusIndicator } from './MapStatusIndicator';
import { MapLoadingOverlay } from './MapLoadingOverlay';
import { usePlaceDetails } from './usePlaceDetails';
import { mapData, api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { MapLibreMap } from './MapLibreMap';
import { JourneyBreadcrumb } from './JourneyBreadcrumb';
import { getJourneyCities, isJourneyMode } from './journey-utils';
import { TravelDateBar } from './TravelDateBar';
import { JourneyStrip } from '../journey';

// ── Nominatim place search ──────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  class: string;
  type: string;
}

async function nominatimSearch(
  query: string,
  bbox: [number, number, number, number] | null,
  signal: AbortSignal,
): Promise<NominatimResult[]> {
  const [south, north, west, east] = bbox ?? [0, 0, 0, 0];
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': 'en',
  });
  if (bbox) {
    params.set('viewbox', `${west},${north},${east},${south}`);
    params.set('bounded', '1');
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
    signal,
  });
  const data = await res.json();
  // If bounded search returns nothing, retry without bounded
  if (Array.isArray(data) && data.length === 0 && bbox) {
    params.delete('bounded');
    const res2 = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en' },
      signal,
    });
    return res2.json();
  }
  return Array.isArray(data) ? data : [];
}

function nominatimToCategory(cls: string, type: string): Category {
  if (cls === 'amenity') {
    if (['restaurant', 'bar', 'fast_food', 'food_court', 'biergarten'].includes(type)) return 'restaurant';
    if (type === 'cafe') return 'cafe';
    if (type === 'museum') return 'museum';
  }
  if (cls === 'tourism') {
    if (['museum', 'gallery', 'artwork'].includes(type)) return 'museum';
    if (['attraction', 'viewpoint', 'theme_park'].includes(type)) return 'tourism';
  }
  if (cls === 'historic') return 'historic';
  if (cls === 'leisure' || ['park', 'garden', 'nature_reserve'].includes(type)) return 'park';
  return 'place';
}

// ── Main screen ─────────────────────────────────────────────────

export function MapScreen() {
  const {
    city, cityGeo, filteredPlaces, recommendedPlaces, places, selectedPlaces,
    activeFilter, loading, error, activePlace, setActivePlace,
    togglePlace, setFilter, goBack,
  } = useMap();

  const { state, dispatch } = useAppStore();

  // Guard: if city was lost (fresh tab, cleared session), kick back to destination
  useEffect(() => {
    if (!city) dispatch({ type: 'GO_TO', screen: 'destination' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-navigate to journey screen when multi-city places are detected
  useEffect(() => {
    if (isJourneyMode(selectedPlaces)) {
      dispatch({ type: 'GO_TO', screen: 'journey' });
    }
  }, [selectedPlaces, dispatch]);

  const selectedIds = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);
  const { details, fetchDetails, clearDetails } = usePlaceDetails();
  const handlePinClick = useCallback((p: Place) => { setClusterGroup(null); setActivePlace(p); fetchDetails(p); }, [setActivePlace, fetchDetails]);
  const [clusterGroup, setClusterGroup] = useState<{ places: Place[]; lat: number; lon: number } | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [showTripSheet, setShowTripSheet] = useState(false);

  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'zoomed-out'>('idle');

  // Events
  const [eventsLoaded, setEventsLoaded]         = useState(false);
  const [eventsLoading, setEventsLoading]       = useState(false);
  const [eventsNoDate, setEventsNoDate]         = useState(false);

  // Pin drop
  const [awaitingPinDrop, setAwaitingPinDrop]   = useState(false);
  const [pinDropResult, setPinDropResult]         = useState<{ lat: number; lon: number } | null>(null);
  const [pinPlaceName, setPinPlaceName]           = useState<string | null>(null);

  // Place search
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<NominatimResult[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchOpen, setSearchOpen]         = useState(false);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleAreaLoad = useCallback(async (
    centerLat: number,
    centerLon: number,
    radiusM = 3000,
    replace = false,
  ) => {
    if (!city) return;
    setMapStatus('loading');
    try {
      const raw = await mapData(city, centerLat, centerLon, radiusM);
      const withIds = (Array.isArray(raw) ? raw : []).map((p, i) => ({
        ...p,
        id: p.id ?? `${p.title}-${i}`,
      }));
      dispatch(replace
        ? { type: 'SET_PLACES', places: withIds }
        : { type: 'MERGE_PLACES', places: withIds },
      );
    } catch (e) {
      console.error('[MapScreen] handleAreaLoad failed:', e);
    } finally {
      setMapStatus('idle');
      setInitialLoading(false);
    }
  }, [city, dispatch]);

  // Trigger initial load once cityGeo is available
  const initialLoadFired = useRef(false);
  useEffect(() => {
    if (initialLoadFired.current) return;
    if (!cityGeo) return;
    initialLoadFired.current = true;
    setLastFetch([cityGeo.lat, cityGeo.lon]);
    // Reset filter to 'all' so stale category filters don't hide fresh pins
    if (activeFilter !== 'all') setFilter('all');
    handleAreaLoad(cityGeo.lat, cityGeo.lon, 5000, true);
    if (state.tripContext.date) {
      loadEvents();
    }
  }, [cityGeo, handleAreaLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pin drop click handler — sets pin then reverse geocodes for a street name
  const handleMapClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      if (!awaitingPinDrop) return;
      setPinDropResult({ lat, lon: lng });
      setPinPlaceName(null);
      setAwaitingPinDrop(false);
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } },
      )
        .then(r => r.json())
        .then(d => {
          const name =
            d.address?.road ??
            d.address?.neighbourhood ??
            d.address?.suburb ??
            d.display_name?.split(',')[0] ??
            null;
          setPinPlaceName(name);
        })
        .catch(() => { /* leave null — coordinates shown as fallback */ });
    },
    [awaitingPinDrop],
  );

  const { handleMoveEnd, setLastFetch } = useMapMove({
    onFetch: useCallback((center: [number, number]) => {
      handleAreaLoad(center[0], center[1], 3000, true);
    }, [handleAreaLoad]),
    onZoomedOut: useCallback(() => {
      setMapStatus('zoomed-out');
    }, []),
  });

  const handleMapMoveEnd = useCallback((center: [number, number], zoom: number) => {
    handleMoveEnd(center, zoom);
  }, [handleMoveEnd]);

  async function loadEvents() {
    const date = state.tripContext.date;
    if (!date || !city) return;
    // Compute end date = start + (days - 1)
    const days    = Math.max(1, state.tripContext.days ?? 1);
    const start   = new Date(date);
    const end     = new Date(start);
    end.setDate(end.getDate() + days - 1);
    const endDate = end.toISOString().slice(0, 10);
    setEventsLoading(true);
    try {
      const data = await api.events(city, date, endDate, cityGeo?.lat, cityGeo?.lon);
      const withIds = (Array.isArray(data) ? data : []).map((p, i) => ({
        ...p,
        id: p.id ?? `event-${i}`,
      }));
      dispatch({ type: 'MERGE_PLACES', places: withIds });
      setEventsLoaded(true);
    } catch (e) {
      console.error('[MapScreen] loadEvents failed:', e);
    } finally {
      setEventsLoading(false);
    }
  }

  function handleFilterSelect(f: MapFilter) {
    setFilter(f);
    if (f === 'event' && !eventsLoaded) {
      if (!state.tripContext.date) {
        setEventsNoDate(true);
        setTimeout(() => setEventsNoDate(false), 3000);
        return;
      }
      loadEvents();
    }
  }

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    setSearchOpen(true);
    if (!val.trim()) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setSearchLoading(true);
      try {
        const bbox = cityGeo?.bbox ?? null;
        const results = await nominatimSearch(val, bbox, abortRef.current.signal);
        if (!abortRef.current.signal.aborted) setSearchResults(results.slice(0, 5));
      } catch {
        // aborted or network error — ignore
      } finally {
        setSearchLoading(false);
      }
    }, 320);
  }

  function handleSelectResult(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const name = r.name || r.display_name.split(',')[0];
    const category = nominatimToCategory(r.class, r.type);
    const place: Place = {
      id: `nominatim-${r.place_id}`,
      title: name,
      category,
      lat,
      lon,
      _city: city,
    };
    dispatch({ type: 'MERGE_PLACES', places: [place] });
    setActivePlace(place);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    searchInputRef.current?.blur();
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }

  const eventPlaces = places.filter(p => p.category === 'event');
  const counts: Partial<Record<string, number>> = {
    all:         places.filter(p => p.category !== 'event').length,
    recommended: recommendedPlaces.length,
    event:       eventsLoaded ? eventPlaces.length : undefined,
    museum:      places.filter(p => p.category === 'museum').length,
    park:        places.filter(p => p.category === 'park').length,
    restaurant:  places.filter(p => p.category === 'restaurant').length,
    historic:    places.filter(p => p.category === 'historic').length,
  };

  const center: [number, number] = cityGeo ? [cityGeo.lat, cityGeo.lon] : [20, 0];

  const routeGeojson = state.route?.geojson
    ? ({
        type: 'Feature',
        properties: {},
        geometry: state.route.geojson,
      } as GeoJSON.Feature<GeoJSON.LineString>)
    : null;

  return (
    <div className="fixed inset-0" style={{ zIndex: (awaitingPinDrop || !!activePlace) ? 35 : 10 }}>

      {/* Map — full screen */}
      <MapLibreMap
        center={center}
        zoom={cityGeo ? 13 : 2}
        places={filteredPlaces}
        selectedPlace={activePlace}
        onPlaceClick={handlePinClick}
        onMoveEnd={handleMapMoveEnd}
        onClick={handleMapClick}
        routeGeojson={routeGeojson}
        pinDropResult={pinDropResult}
      />

      {/* Initial load overlay */}
      <MapLoadingOverlay visible={initialLoading} />

      {/* Map status — loading / zoomed-out indicator */}
      <MapStatusIndicator status={mapStatus} />

      {/* Drop pin strip */}
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
          <button onClick={() => setAwaitingPinDrop(false)} className="ml-auto text-white/70 text-xs underline underline-offset-2">Cancel</button>
        </div>
      )}

      {/* ── Top overlay ── */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col gap-2 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', paddingBottom: '0.5rem', zIndex: 20, pointerEvents: 'none' }}
      >
        {/* Row 1: back + search input */}
        <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full backdrop-blur flex items-center justify-center border border-white/10 flex-shrink-0"
            style={{ background: 'rgba(15,20,30,.82)' }}
          >
            <span className="ms text-text-2 text-base">arrow_back</span>
          </button>

          {/* Search input */}
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 ms text-white/35 text-base pointer-events-none">search</span>
            <input
              ref={searchInputRef}
              type="text"
              lang="en"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder={`Search places in ${city || 'city'}…`}
              className="w-full h-10 rounded-full pl-9 pr-9 text-sm text-white placeholder-white/30 outline-none"
              style={{
                background: 'rgba(15,20,30,.82)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,.1)',
              }}
            />
            {searchLoading ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 ms text-white/30 text-sm animate-spin pointer-events-none">autorenew</span>
            ) : searchQuery ? (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 ms text-white/30 text-sm">close</button>
            ) : null}
          </div>
        </div>

        {/* Search results dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div
            className="mx-12 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(15,20,30,.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,.1)',
              pointerEvents: 'auto',
            }}
          >
            {searchResults.map((r, i) => (
              <button
                key={r.place_id}
                onMouseDown={() => handleSelectResult(r)}
                className="w-full text-left px-4 py-3 transition-colors active:bg-white/5"
                style={{ borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}
              >
                <p className="text-white text-sm font-medium truncate">{r.name || r.display_name.split(',')[0]}</p>
                <p className="text-white/35 text-xs truncate mt-0.5">{r.display_name.split(',').slice(1, 3).join(',').trim()}</p>
              </button>
            ))}
          </div>
        )}

        {/* Travel date bar */}
        <div style={{ pointerEvents: 'auto' }}>
          <TravelDateBar />
        </div>

        {/* Journey strip — only visible in multi-city mode */}
        <div style={{ pointerEvents: 'auto' }}>
          <JourneyStrip />
        </div>

        {/* Filter bar */}
        <div style={{ pointerEvents: 'auto' }}>
          <FilterBar active={activeFilter as MapFilter} counts={counts} onSelect={handleFilterSelect} />
        </div>

        {/* Journey breadcrumb */}
        <div style={{ pointerEvents: 'auto' }}>
          <JourneyBreadcrumb cities={getJourneyCities(selectedPlaces)} />
        </div>
      </div>

      {/* Events loading spinner */}
      {eventsLoading && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)', zIndex: 25, background: 'rgba(15,20,30,.88)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.1)' }}
        >
          <span className="ms text-primary animate-spin" style={{ fontSize: 15 }}>autorenew</span>
          <span className="text-white/70 text-xs font-medium">Loading events…</span>
        </div>
      )}

      {/* Events no-date toast */}
      {eventsNoDate && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)', zIndex: 25, background: 'rgba(245,158,11,.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,158,11,.3)' }}
        >
          <span className="ms fill text-amber-400" style={{ fontSize: 15 }}>calendar_today</span>
          <span className="text-amber-300 text-xs font-medium">Set a travel date to see events</span>
        </div>
      )}

      {/* Loading — tiny spinner, corner, barely visible */}
      {loading && (
        <div
          className="absolute"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 0.6rem)',
            right: '1rem',
            zIndex: 25,
            pointerEvents: 'none',
          }}
        >
          <span className="ms text-white/25 animate-spin" style={{ fontSize: 16 }}>autorenew</span>
        </div>
      )}

      {/* Cluster picker — shown when cluster can't zoom in further */}
      {clusterGroup && !activePlace && (
        <div
          className="absolute inset-x-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', zIndex: 20 }}
        >
          <div
            className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ background: 'rgba(15,20,30,.96)', backdropFilter: 'blur(16px)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className="ms fill text-primary" style={{ fontSize: 14 }}>layers</span>
                <span className="text-text-2 font-semibold" style={{ fontSize: 12 }}>
                  {clusterGroup.places.length} places here
                </span>
              </div>
              <button onClick={() => setClusterGroup(null)}>
                <span className="ms text-text-3" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
            {clusterGroup.places.map((place, i) => {
              const icon  = CATEGORY_ICONS[place.category] ?? 'location_on';
              const label = CATEGORY_LABELS[place.category] ?? 'Place';
              return (
                <button
                  key={place.id}
                  onClick={() => { setClusterGroup(null); handlePinClick(place); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                  style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : undefined }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(59,130,246,.12)' }}
                  >
                    <span className="ms fill text-primary" style={{ fontSize: 14 }}>{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-1 font-semibold text-sm truncate">{place.title}</p>
                    <p className="text-text-3" style={{ fontSize: 10 }}>{label}</p>
                  </div>
                  <span className="ms text-text-3" style={{ fontSize: 14 }}>chevron_right</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pin card — fixed bottom sheet, handles its own positioning + backdrop */}
      {activePlace && (
        <PinCard
          place={activePlace}
          city={city}
          isSelected={selectedIds.has(activePlace.id)}
          onAdd={() => togglePlace(activePlace)}
          onClose={() => { setActivePlace(null); clearDetails(); }}
          details={details}
        />
      )}

      {/* Itinerary bar — shown only when no pin sheet is open */}
      {!activePlace && selectedPlaces.length >= 2 && (
        <div
          className="absolute inset-x-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', zIndex: 20 }}
        >
          <div
            className="flex items-center gap-3 px-3 h-12 rounded-2xl border border-white/10 shadow-xl"
            style={{ background: 'rgba(15,20,30,.92)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex -space-x-1.5">
                {selectedPlaces.slice(0, 5).map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border-2"
                    style={{ background: '#ffffff', borderColor: 'rgba(15,20,30,1)', opacity: 1 - i * 0.14, zIndex: 5 - i }}
                  />
                ))}
              </div>
              <span className="text-text-1 text-sm font-semibold">{selectedPlaces.length} place{selectedPlaces.length !== 1 ? 's' : ''}</span>
              <span className="text-text-3 text-xs">added</span>
            </div>
            <button
              onClick={() => setShowTripSheet(true)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-primary text-white font-heading font-bold"
              style={{ fontSize: 12 }}
            >
              <span className="ms fill" style={{ fontSize: 14 }}>auto_fix</span>
              Build Itinerary
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          className="absolute flex flex-col items-center gap-3 px-6 py-5 rounded-2xl text-center"
          style={{
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 20, background: 'rgba(15,23,42,.92)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)', minWidth: '220px',
          }}
        >
          <span className="ms text-text-3 text-3xl">location_off</span>
          <div>
            <p className="text-text-1 font-semibold text-sm mb-1">{places.length === 0 ? 'No places found' : 'Could not load places'}</p>
            <p className="text-text-3 text-xs">{city ? `Nothing came back for "${city}"` : 'Please select a city first'}</p>
          </div>
          {city && <button onClick={() => handleAreaLoad(cityGeo?.lat ?? 0, cityGeo?.lon ?? 0, 5000, true)} className="mt-1 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold">Try again</button>}
        </div>
      )}

      {showTripSheet && (
        <TripPlanningCard
          onClose={() => setShowTripSheet(false)}
          onRequestPinDrop={() => { setAwaitingPinDrop(true); }}
          onClearPin={() => { setPinDropResult(null); setPinPlaceName(null); }}
          pinDropResult={pinDropResult}
          pinPlaceName={pinPlaceName}
        />
      )}
    </div>
  );
}
