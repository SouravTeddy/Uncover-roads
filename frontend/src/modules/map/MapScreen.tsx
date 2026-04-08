import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap as useLeafletMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter, Category } from '../../shared/types';
import { TripSheet } from './TripSheet';
import { makeIcon, makeRecommendedIcon, makeSelectedIcon } from './icons';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { useMapMove } from './useMapMove';
import { SearchHereButton } from './SearchHereButton';
import { MapLoadingOverlay } from './MapLoadingOverlay';
import { usePlaceDetails } from './usePlaceDetails';
import { mapData, api } from '../../shared/api';
import type { BBox } from '../../shared/api';
import { useAppStore } from '../../shared/store';

// Fix Leaflet default icon URLs broken by Vite bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
      const dx = pt.x - op.x; const dy = pt.y - op.y;
      if (Math.sqrt(dx * dx + dy * dy) < gridSize) { group.push(other); assigned.add(j); }
    });
    clusters.push(group);
  });
  return clusters;
}

function panToPinAboveCard(map: L.Map, lat: number, lon: number) {
  const pt = map.project([lat, lon], map.getZoom());
  pt.y += 90;
  map.panTo(map.unproject(pt, map.getZoom()), { animate: true, duration: 0.3 });
}

function makeClusterIcon(count: number, hasRecommended: boolean, hasSelected: boolean) {
  // Our Picks clusters get an orange ring; selected-only clusters get a white ring; plain = no ring
  const bg     = hasSelected ? '#ffffff' : '#1c2230';
  const ring   = hasSelected ? 'rgba(255,255,255,.18)' : hasRecommended ? 'rgba(249,115,22,.22)' : 'rgba(255,255,255,.07)';
  const color  = hasSelected ? '#0f141e' : '#fff';
  const border = hasSelected ? '2px solid rgba(0,0,0,.10)' : '2px solid rgba(255,255,255,.18)';
  const inner  = count >= 10 ? 44 : count >= 5 ? 38 : 32;
  const outer  = inner + 10;
  const fs     = count >= 10 ? 14 : 13;
  return L.divIcon({
    className: '',
    html: `<div style="width:${outer}px;height:${outer}px;border-radius:50%;background:${ring};display:flex;align-items:center;justify-content:center">
      <div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,.55);border:${border}">
        <span style="font-weight:700;color:${color};font-size:${fs}px;font-family:system-ui,sans-serif;letter-spacing:-0.5px;line-height:1">${count}</span>
      </div>
    </div>`,
    iconSize: [outer, outer],
    iconAnchor: [outer / 2, outer / 2],
  });
}

// ── Map sub-components ──────────────────────────────────────────

function MapPins({
  places, selectedIds, recommendedIds, onPinClick, onClusterExpand,
}: {
  places: Place[]; selectedIds: Set<string>; recommendedIds: Set<string>;
  onPinClick: (place: Place) => void;
  onClusterExpand: (group: Place[], lat: number, lon: number) => void;
}) {
  const map = useLeafletMap();
  const pinMarkersRef = useRef<Map<string, L.Marker>>(new Map());
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
        const icon = selectedIds.has(place.id) ? makeSelectedIcon(place.category)
          : recommendedIds.has(place.id) ? makeRecommendedIcon(place.category) : makeIcon(place.category);
        const marker = L.marker([place.lat, place.lon], { icon });
        marker.on('click', () => { panToPinAboveCard(map, place.lat, place.lon); onPinClick(place); });
        marker.addTo(map);
        pinMarkersRef.current.set(place.id, marker);
      } else {
        const hasRec = group.some(p => recommendedIds.has(p.id));
        const hasSel = group.some(p => selectedIds.has(p.id));
        const clat = group.reduce((s, p) => s + p.lat, 0) / group.length;
        const clon = group.reduce((s, p) => s + p.lon, 0) / group.length;
        const marker = L.marker([clat, clon], { icon: makeClusterIcon(group.length, hasRec, hasSel) });
        marker.on('click', () => {
          const bounds = L.latLngBounds(group.map(p => [p.lat, p.lon] as [number, number]));
          // Check if zooming in would actually help (i.e. map isn't already at max zoom)
          const targetZoom = map.getBoundsZoom(bounds, false, L.point(72, 72));
          const atMaxZoom  = map.getZoom() >= map.getMaxZoom();
          const wouldHelp  = targetZoom > map.getZoom() && !atMaxZoom;
          if (wouldHelp) {
            map.flyToBounds(bounds, { padding: [72, 72], duration: 0.4 });
          } else {
            // Already at max zoom or places too close to separate — show picker
            onClusterExpand(group, clat, clon);
          }
        });
        marker.addTo(map);
        clusterMarkersRef.current.push({ marker, group });
      }
    });
  }, [places, selectedIds, recommendedIds, map, onPinClick, onClusterExpand]);

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

  useEffect(() => {
    pinMarkersRef.current.forEach((marker, id) => {
      const place = places.find(p => p.id === id);
      if (!place) return;
      const icon = selectedIds.has(id) ? makeSelectedIcon(place.category)
        : recommendedIds.has(id) ? makeRecommendedIcon(place.category) : makeIcon(place.category);
      marker.setIcon(icon);
    });
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
  const initialFitDone = useRef(false);
  useEffect(() => {
    if (initialFitDone.current) return;   // only auto-fit once — user controls view after that
    if (places.length > 0) {
      const valid = places.filter(p => p.lat && p.lon);
      if (valid.length > 0) {
        map.fitBounds(L.latLngBounds(valid.map(p => [p.lat, p.lon])), { padding: [48, 48] });
        initialFitDone.current = true;
      }
    } else if (cityGeo) {
      map.setView([cityGeo.lat, cityGeo.lon], 13);
    }
  }, [places, cityGeo, map]);
  return null;
}

function MapMoveListener({
  cityCenter, onMove,
}: {
  cityCenter: { lat: number; lon: number } | null;
  onMove: (show: boolean, bbox: [number, number, number, number] | null, reset: () => void) => void;
}) {
  const { showSearchHere, currentBbox, resetSearchHere } = useMapMove(cityCenter);
  useEffect(() => { onMove(showSearchHere, currentBbox, resetSearchHere); }, [showSearchHere, currentBbox, resetSearchHere, onMove]);
  return null;
}

function PinDropListener({ active, onDrop }: { active: boolean; onDrop: (latlng: { lat: number; lon: number }) => void }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (!active) return;
    const handler = (e: L.LeafletMouseEvent) => onDrop({ lat: e.latlng.lat, lon: e.latlng.lng });
    map.once('click', handler);
    return () => { map.off('click', handler); };
  }, [active, map, onDrop]);
  return null;
}

/** Fires once after the map settles on its initial position (after FitBounds) */
function MapReadyTrigger({ onReady }: { onReady: (bbox: BBox) => void }) {
  const map = useLeafletMap();
  const firedRef = useRef(false);
  useEffect(() => {
    function fire() {
      if (firedRef.current) return;
      firedRef.current = true;
      const b = map.getBounds();
      if (b.isValid()) onReady([b.getSouth(), b.getNorth(), b.getWest(), b.getEast()]);
    }
    // moveend fires if FitBounds animates the view (async)
    map.once('moveend', fire);
    // Timeout fallback: FitBounds sometimes fires moveend synchronously before
    // this listener registers — the timeout catches that case
    const t = setTimeout(fire, 600);
    return () => { map.off('moveend', fire); clearTimeout(t); };
  }, [map, onReady]);
  return null;
}

/** Pans the map to a target when it changes */
function MapPanner({ target }: { target: { lat: number; lon: number } | null }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (!target) return;
    panToPinAboveCard(map, target.lat, target.lon);
  }, [target, map]);
  return null;
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

  const selectedIds    = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);
  const recommendedIds = useMemo(() => new Set(recommendedPlaces.map(p => p.id)), [recommendedPlaces]);
  const { details, loading: detailsLoading, fetchDetails, clearDetails } = usePlaceDetails();
  const handlePinClick = useCallback((p: Place) => { setClusterGroup(null); setActivePlace(p); fetchDetails(p); }, [setActivePlace, fetchDetails]);
  const [clusterGroup, setClusterGroup] = useState<{ places: Place[]; lat: number; lon: number } | null>(null);
  const handleClusterExpand = useCallback((group: Place[], lat: number, lon: number) => {
    setClusterGroup({ places: group, lat, lon });
  }, []);

  const [initialLoading, setInitialLoading] = useState(true);
  const [showTripSheet, setShowTripSheet] = useState(false);

  // Search Here — bbox stored in ref so handleSearchHere always reads the latest value
  // without needing to be recreated (eliminates stale-closure silent-fail on click)
  const [showSearchHere, setShowSearchHere]       = useState(false);
  const searchBboxRef                             = useRef<BBox | null>(null);
  const [searchHereLoading, setSearchHereLoading] = useState(false);
  const [searchHereEmpty, setSearchHereEmpty]     = useState(false);
  const resetSearchHereRef = useRef<() => void>(() => {});

  // Events
  const [eventsLoaded, setEventsLoaded]         = useState(false);
  const [eventsLoading, setEventsLoading]       = useState(false);
  const [eventsNoDate, setEventsNoDate]         = useState(false);

  // Pin drop
  const [awaitingPinDrop, setAwaitingPinDrop]   = useState(false);
  const [pinDropResult, setPinDropResult]         = useState<{ lat: number; lon: number } | null>(null);

  // Pan target (set when user picks a search result)
  const [panTarget, setPanTarget] = useState<{ lat: number; lon: number } | null>(null);

  // Place search
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<NominatimResult[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchOpen, setSearchOpen]         = useState(false);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cityCenter = cityGeo ? { lat: cityGeo.lat, lon: cityGeo.lon } : null;

  const handleMapMove = useCallback(
    (show: boolean, bbox: BBox | null, reset: () => void) => {
      setShowSearchHere(show);
      searchBboxRef.current = bbox;          // always up-to-date, no re-render needed
      resetSearchHereRef.current = reset;
    }, [],
  );

  const handleSearchHere = useCallback(async (overrideBbox?: BBox) => {
    const bbox = overrideBbox ?? searchBboxRef.current;
    if (!bbox || !city) {
      if (overrideBbox) setInitialLoading(false);
      return;
    }
    setSearchHereLoading(true);
    setSearchHereEmpty(false);
    try {
      let raw: Place[];

      if (overrideBbox) {
        // Initial city load — use the full city-level bbox from geocode so cities
        // with lower OSM density (Montreal, Toronto, etc.) still return results.
        // The zoom-13 viewport bbox is too small for anything outside dense European cores.
        if (cityGeo?.bbox) {
          raw = await mapData(city, cityGeo.lat, cityGeo.lon, [], cityGeo.bbox);
        } else {
          // cityGeo missing (geocode failed earlier) — let the backend geocode by name
          raw = await api.mapData(city);
        }
      } else {
        // User-triggered "Search Here" — use the viewport bbox as-is
        if (!cityGeo) { setSearchHereLoading(false); return; }
        raw = await mapData(city, cityGeo.lat, cityGeo.lon, [], bbox);
      }

      const withIds = (Array.isArray(raw) ? raw : []).map((p, i) => ({ ...p, id: p.id ?? `${p.title}-${i}` }));
      if (withIds.length === 0 && !overrideBbox) {
        setSearchHereEmpty(true);
        setTimeout(() => setSearchHereEmpty(false), 2500);
      }
      dispatch(overrideBbox
        ? { type: 'SET_PLACES', places: withIds }
        : { type: 'MERGE_PLACES', places: withIds },
      );
    } catch (e) {
      console.error('[MapScreen] searchHere failed:', e);
      if (overrideBbox) {
        // Initial load failed — retry with city-name fallback (backend geocodes for us)
        try {
          const fallback = await api.mapData(city);
          const withIds = (Array.isArray(fallback) ? fallback : []).map((p, i) => ({ ...p, id: p.id ?? `${p.title}-${i}` }));
          dispatch({ type: 'SET_PLACES', places: withIds });
        } catch {
          // both paths failed — leave map empty, user can Search Here manually
        }
      } else {
        setSearchHereEmpty(true);
        setTimeout(() => setSearchHereEmpty(false), 2500);
      }
    } finally {
      setSearchHereLoading(false);
      if (!overrideBbox) resetSearchHereRef.current();
      else setInitialLoading(false);
    }
  }, [city, cityGeo, dispatch]);

  const handlePinDrop = useCallback((latlng: { lat: number; lon: number }) => {
    setPinDropResult(latlng); setAwaitingPinDrop(false); setShowTripSheet(true);
  }, []);

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
    };
    dispatch({ type: 'MERGE_PLACES', places: [place] });
    setActivePlace(place);
    setPanTarget({ lat, lon });
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

  return (
    <div className="fixed inset-0" style={{ zIndex: awaitingPinDrop ? 35 : 10 }}>

      {/* Map — full screen */}
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
        <MapPins places={filteredPlaces} selectedIds={selectedIds} recommendedIds={recommendedIds} onPinClick={handlePinClick} onClusterExpand={handleClusterExpand} />
        <MapMoveListener cityCenter={cityCenter} onMove={handleMapMove} />
        <PinDropListener active={awaitingPinDrop} onDrop={handlePinDrop} />
        <MapPanner target={panTarget} />
        <MapReadyTrigger onReady={bbox => handleSearchHere(bbox)} />
      </MapContainer>

      {/* Initial load overlay */}
      <MapLoadingOverlay visible={initialLoading} />

      {/* Search Here */}
      {showSearchHere && <SearchHereButton onSearch={handleSearchHere} loading={searchHereLoading} empty={searchHereEmpty} />}

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

        {/* Filter bar */}
        <div style={{ pointerEvents: 'auto' }}>
          <FilterBar active={activeFilter as MapFilter} counts={counts} onSelect={handleFilterSelect} />
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

      {/* Pin card + itinerary bar */}
      {(activePlace || selectedPlaces.length >= 2) && (
        <div
          className="absolute inset-x-4 flex flex-col gap-2"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', zIndex: 20 }}
        >
          {activePlace && (
            <PinCard
              place={activePlace}
              city={city}
              isSelected={selectedIds.has(activePlace.id)}
              onAdd={() => togglePlace(activePlace)}
              onClose={() => { setActivePlace(null); clearDetails(); }}
              details={details}
              detailsLoading={detailsLoading}
            />
          )}
          {selectedPlaces.length >= 2 && (
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
          )}
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
          {city && <button onClick={() => handleSearchHere()} className="mt-1 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold">Try again</button>}
        </div>
      )}

      {showTripSheet && (
        <TripSheet
          onClose={() => setShowTripSheet(false)}
          onRequestPinDrop={() => { setAwaitingPinDrop(true); }}
          onClearPin={() => setPinDropResult(null)}
          pinDropResult={pinDropResult}
          cityGeo={cityGeo}
        />
      )}
    </div>
  );
}
