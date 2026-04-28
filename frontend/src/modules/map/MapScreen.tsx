import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter, Category } from '../../shared/types';
import { isCurationLocked } from '../../shared/tier';
import { SearchResultRow } from './SearchResultRow';
import { SearchNudge } from './SearchNudge';
import {
  nominatimToCategory,
  multiTypeNominatimSearch,
  extractSearchIntent,
  bboxDiagonalKm,
} from './useSmartSearch';
import type { NominatimResult, SuggestedChip } from './useSmartSearch';
import type { MapHandle } from './MapLibreMap';
import { TripPlanningCard } from './TripPlanningCard';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { useMapMove } from './useMapMove';
import { MapStatusIndicator } from './MapStatusIndicator';
import { MapLoadingOverlay } from './MapLoadingOverlay';
import { usePlaceDetails } from './usePlaceDetails';
import { useSimilarPins } from './SimilarPins';
import { mapData, api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { MapLibreMap } from './MapLibreMap';
import { JourneyBreadcrumb } from './JourneyBreadcrumb';
import { getJourneyCities, isJourneyMode } from './journey-utils';
import { JourneyStrip } from '../journey';
import { FavoritesMarker, FavoritesSheet } from './FavoritesLayer';

// ── Main screen ─────────────────────────────────────────────────

const PLACEHOLDER_EXAMPLES = [
  'Museums in this area…',
  'Hotels nearby…',
  'Parks to explore…',
  'Restaurants around here…',
  'Historic sites nearby…',
  'Cafes to discover…',
  'Galleries in this area…',
];

export function MapScreen() {
  const {
    city, cityGeo, filteredPlaces, recommendedPlaces, places, selectedPlaces,
    activeFilter, loading, error, activePlace, setActivePlace,
    togglePlace, setFilter, trackViewedCategory, goBack,
  } = useMap();

  const { state, dispatch } = useAppStore();
  const { pendingActivePlace } = state;
  const personaProfile = state.personaProfile ?? null;

  // Session cache for PinCard persona insights
  const insightCacheRef = useRef(new Map<string, string>());

  // Guard: if city was lost (fresh tab, cleared session), kick back to destination
  useEffect(() => {
    if (!city) dispatch({ type: 'GO_TO', screen: 'destination' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consume a place requested from the Explore tab — open its PinCard then clear
  useEffect(() => {
    if (pendingActivePlace) {
      setActivePlace(pendingActivePlace);
      dispatch({ type: 'CLEAR_PENDING_PLACE' });
    }
  }, [pendingActivePlace, setActivePlace, dispatch]);

  // Auto-navigate to journey screen when multi-city places are detected
  useEffect(() => {
    if (isJourneyMode(selectedPlaces)) {
      dispatch({ type: 'GO_TO', screen: 'journey' });
    }
  }, [selectedPlaces, dispatch]);

  const selectedIds = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);
  const favouritedIds = useMemo(
    () => new Set(state.favouritedPins.map(f => f.placeId)),
    [state.favouritedPins],
  );
  const { details, fetchDetails, clearDetails } = usePlaceDetails();
  const { triggerSimilar } = useSimilarPins();
  const handlePinClick = useCallback((p: Place) => {
    setClusterGroup(null);
    setActivePlace(p);
    fetchDetails(p);
    trackViewedCategory(p.category);
  }, [setActivePlace, fetchDetails, trackViewedCategory]);
  const [clusterGroup, setClusterGroup] = useState<{ places: Place[]; lat: number; lon: number } | null>(null);
  const clusterSheetRef    = useRef<HTMLDivElement>(null);
  const clusterTouchStartY = useRef(0);
  const clusterDragY       = useRef(0);

  const [initialLoading, setInitialLoading] = useState(true);
  const [showTripSheet, setShowTripSheet] = useState(false);
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false);

  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'zoomed-out'>('idle');

  // Events
  const [eventsLoaded, setEventsLoaded]         = useState(false);
  const [eventsLoading, setEventsLoading]       = useState(false);
  const [eventsNoDate, setEventsNoDate]         = useState(false);
  const [eventsError, setEventsError]           = useState<string | null>(null);

  // Place search
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<NominatimResult[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [searchOpen, setSearchOpen]         = useState(false);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapHandleRef = useRef<MapHandle>(null);
  const [currentBbox, setCurrentBbox] = useState<[number, number, number, number] | null>(null);
  const [activeSearchTypes, setActiveSearchTypes] = useState<{ types: Category[]; label: string } | null>(null);
  const [suggestedChips, setSuggestedChips] = useState<SuggestedChip[]>([]);
  const [showZoomNudge, setShowZoomNudge] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // Rotating placeholder
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  useEffect(() => {
    if (searchQuery) return;
    let fadeTimer: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setPlaceholderVisible(false);
      fadeTimer = setTimeout(() => {
        setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_EXAMPLES.length);
        setPlaceholderVisible(true);
      }, 200);
    }, 1500);
    return () => {
      clearInterval(id);
      clearTimeout(fadeTimer);
    };
  }, [searchQuery]);

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
    if (cityGeo.bbox) setCurrentBbox(cityGeo.bbox);
    // Reset filter to 'all' so stale category filters don't hide fresh pins
    if (activeFilter !== 'all') setFilter('all');
    handleAreaLoad(cityGeo.lat, cityGeo.lon, 5000, true);
    if (state.tripContext.date) {
      loadEvents();
    }
  }, [cityGeo, handleAreaLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  const { handleMoveEnd, setLastFetch } = useMapMove({
    onFetch: useCallback((center: [number, number]) => {
      handleAreaLoad(center[0], center[1], 3000, true);
    }, [handleAreaLoad]),
    onZoomedOut: useCallback(() => {
      setMapStatus('zoomed-out');
    }, []),
  });

  const handleMapMoveEnd = useCallback((center: [number, number], zoom: number, bbox: [number, number, number, number]) => {
    setCurrentBbox(bbox);
    handleMoveEnd(center, zoom);

    // Re-run area search if there's an active type-only search
    if (activeSearchTypes && searchQuery) {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      multiTypeNominatimSearch(activeSearchTypes.types, searchQuery, bbox, abortRef.current.signal)
        .then(results => {
          if (!abortRef.current?.signal.aborted) {
            const newIds = new Set(results.map(r => `nominatim-${r.place_id}`));
            setHighlightIds(newIds);
            if (glowTimerRef.current !== null) clearTimeout(glowTimerRef.current);
            glowTimerRef.current = setTimeout(() => {
              setHighlightIds(new Set());
              glowTimerRef.current = null;
            }, 800);
            setSearchResults(results.slice(0, 10));
            setShowZoomNudge(bboxDiagonalKm(bbox) > 15);
          }
        })
        .catch(() => {});
    }
  }, [handleMoveEnd, activeSearchTypes, searchQuery]);

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
      // Backend returns {"error": "..."} when API key is missing
      if (!Array.isArray(data)) {
        setEventsError('Events unavailable right now');
        setTimeout(() => setEventsError(null), 4000);
        return;
      }
      const withIds = data.map((p, i) => ({ ...p, id: p.id ?? `event-${i}` }));
      if (withIds.length === 0) {
        setEventsError(`No events found in ${city} for your dates`);
        setTimeout(() => setEventsError(null), 4000);
      } else {
        setEventsError(null);
      }
      dispatch({ type: 'MERGE_PLACES', places: withIds });
      setEventsLoaded(true);
    } catch (e) {
      console.error('[MapScreen] loadEvents failed:', e);
      setEventsError('Events unavailable right now');
      setTimeout(() => setEventsError(null), 4000);
    } finally {
      setEventsLoading(false);
    }
  }

  // Swipe-to-close for cluster picker — mirrors PinCard gesture logic
  useEffect(() => {
    const el = clusterSheetRef.current;
    if (!el || !clusterGroup) return;

    let dismissTimer: ReturnType<typeof setTimeout> | null = null;

    const onStart = (e: TouchEvent) => {
      clusterTouchStartY.current = e.touches[0].clientY;
      clusterDragY.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - clusterTouchStartY.current;
      if (dy > 0 && el) {
        if (e.cancelable) e.preventDefault();
        el.style.transition = 'none';
        el.style.transform  = `translateY(${dy}px)`;
        clusterDragY.current = dy;
      }
    };
    const onEnd = () => {
      if (!el) return;
      el.style.transition = '';
      if (clusterDragY.current > 80) {
        el.style.transform = 'translateY(100%)';
        dismissTimer = setTimeout(() => setClusterGroup(null), 220);
      } else {
        el.style.transform = 'translateY(0)';
      }
      clusterDragY.current = 0;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
      if (dismissTimer !== null) clearTimeout(dismissTimer);
    };
  }, [clusterGroup]);

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
    setSuggestedChips([]);
    setShowZoomNudge(false);
    setActiveSearchTypes(null);

    if (!val.trim()) { setSearchResults([]); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setSearchLoading(true);

      const intent = extractSearchIntent(val);

      if (intent.types.length === 0 && intent.locationQuery === null) {
        setSuggestedChips(intent.chips);
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }

      try {
        const bbox = intent.locationQuery === null ? currentBbox : null;
        const results = await multiTypeNominatimSearch(intent.types, val, bbox, abortRef.current.signal);
        if (!abortRef.current.signal.aborted) {
          setSearchResults(results.slice(0, 10));
          if (intent.types.length > 0 && intent.locationQuery === null && bbox && bboxDiagonalKm(bbox) > 15) {
            setShowZoomNudge(true);
            setActiveSearchTypes({ types: intent.types, label: intent.types[0] });
          }
        }
      } catch {
        // aborted or network error — ignore
      } finally {
        setSearchLoading(false);
      }
    }, 320);
  }

  function navigateToResult(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const name = r.name || r.display_name.split(',')[0];
    const category = nominatimToCategory(r.class, r.type);
    const place: Place = { id: `nominatim-${r.place_id}`, title: name, category, lat, lon, _city: city };
    dispatch({ type: 'MERGE_PLACES', places: [place] });
    mapHandleRef.current?.flyTo(lat, lon);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setSuggestedChips([]);
    searchInputRef.current?.blur();
  }

  function openCardFromResult(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const name = r.name || r.display_name.split(',')[0];
    const category = nominatimToCategory(r.class, r.type);
    const place: Place = { id: `nominatim-${r.place_id}`, title: name, category, lat, lon, _city: city };
    dispatch({ type: 'MERGE_PLACES', places: [place] });
    setActivePlace(place);
    fetchDetails(place);
    mapHandleRef.current?.flyTo(lat, lon);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setSuggestedChips([]);
    searchInputRef.current?.blur();
  }

  function handleChipTap(chip: SuggestedChip) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchQuery(chip.label);
    setSuggestedChips([]);
    setShowZoomNudge(false);
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setSearchLoading(true);
    const bbox = currentBbox;
    multiTypeNominatimSearch([chip.type], chip.label, bbox, abortRef.current.signal)
      .then(results => {
        if (!abortRef.current?.signal.aborted) {
          setSearchResults(results.slice(0, 10));
          setSearchOpen(true);
          setActiveSearchTypes({ types: [chip.type], label: chip.label });
          if (bbox && bboxDiagonalKm(bbox) > 15) setShowZoomNudge(true);
        }
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false));
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setSuggestedChips([]);
    setShowZoomNudge(false);
    setActiveSearchTypes(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (glowTimerRef.current !== null) { clearTimeout(glowTimerRef.current); glowTimerRef.current = null; }
  }

  const eventPlaces = places.filter(p => p.category === 'event');
  const counts: Partial<Record<string, number>> = {
    all:         places.length,
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
    <div className="fixed inset-0" style={{ zIndex: !!activePlace ? 35 : 10 }}>

      {/* Map — full screen */}
      <MapLibreMap
        ref={mapHandleRef}
        center={center}
        zoom={cityGeo ? 13 : 2}
        places={filteredPlaces}
        selectedPlace={activePlace}
        highlightIds={highlightIds}
        onPlaceClick={handlePinClick}
        onMoveEnd={handleMapMoveEnd}
        routeGeojson={routeGeojson}
      >
        {!activePlace && state.favouritedPins.length > 0 && (
          <FavoritesMarker
            pins={state.favouritedPins}
            onClick={() => setShowFavoritesSheet(true)}
          />
        )}
      </MapLibreMap>

      {/* Initial load overlay */}
      <MapLoadingOverlay visible={initialLoading} />

      {/* Map status — loading / zoomed-out indicator */}
      <MapStatusIndicator status={mapStatus} />

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

          {state.favouritedPins.length > 0 && (
            <button
              onClick={() => setShowFavoritesSheet(true)}
              className="w-10 h-10 rounded-full backdrop-blur flex items-center justify-center border border-white/10 flex-shrink-0"
              style={{ background: 'rgba(15,20,30,.82)', fontSize: 16, lineHeight: 1 }}
              aria-label="View saved places"
            >
              ❤️
            </button>
          )}

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
              placeholder=""
              className="w-full h-10 rounded-full pl-9 pr-9 text-sm text-white outline-none"
              style={{
                background: 'rgba(15,20,30,.82)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,.1)',
              }}
            />
            {/* Rotating placeholder overlay — only visible when input is empty */}
            {!searchQuery && (
              <span
                className="absolute left-9 top-1/2 -translate-y-1/2 text-sm pointer-events-none truncate"
                style={{
                  color: 'rgba(255,255,255,0.3)',
                  opacity: placeholderVisible ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                  maxWidth: 'calc(100% - 72px)',
                }}
              >
                {PLACEHOLDER_EXAMPLES[placeholderIdx]}
              </span>
            )}
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
              <SearchResultRow
                key={r.place_id}
                result={r}
                isLast={i === searchResults.length - 1}
                onNavigate={() => navigateToResult(r)}
                onOpenCard={() => openCardFromResult(r)}
              />
            ))}
          </div>
        )}

        {/* Smart search nudge — chips or zoom nudge */}
        {searchOpen && (suggestedChips.length > 0 || showZoomNudge) && (
          <SearchNudge
            chips={suggestedChips}
            showZoomNudge={showZoomNudge}
            activeTypeLabel={activeSearchTypes?.label ?? ''}
            onChipTap={handleChipTap}
          />
        )}

        {/* Journey strip — only visible in multi-city mode */}
        <div style={{ pointerEvents: 'auto' }}>
          <JourneyStrip />
        </div>

        {/* Filter bar */}
        <div style={{ pointerEvents: 'auto' }}>
          <FilterBar
            active={activeFilter as MapFilter}
            counts={counts}
            onSelect={handleFilterSelect}
            lockedFilters={isCurationLocked(state) ? ['recommended', 'event'] : []}
            onLockedTap={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
          />
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

      {/* Events error toast */}
      {eventsError && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)', zIndex: 25, background: 'rgba(245,158,11,.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,158,11,.3)' }}
        >
          <span className="ms fill text-amber-400" style={{ fontSize: 15 }}>event_busy</span>
          <span className="text-amber-300 text-xs font-medium">{eventsError}</span>
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
            ref={clusterSheetRef}
            className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ background: 'rgba(15,20,30,.96)', backdropFilter: 'blur(16px)', transition: 'transform 0.22s ease' }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px', touchAction: 'none' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)' }} />
            </div>
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

      {/* Favorites sheet */}
      {showFavoritesSheet && !activePlace && (
        <FavoritesSheet
          pins={state.favouritedPins}
          onClose={() => setShowFavoritesSheet(false)}
          onSelect={(pin) => {
            setShowFavoritesSheet(false);
            const place: Place = {
              id: pin.placeId,
              title: pin.title,
              lat: pin.lat,
              lon: pin.lon,
              category: 'place',
              _city: pin.city,
            };
            mapHandleRef.current?.flyTo(pin.lat, pin.lon);
            handlePinClick(place);
          }}
        />
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
          isFavourited={activePlace ? favouritedIds.has(activePlace.id) : false}
          onSimilar={() => {
            if (!activePlace) return;
            triggerSimilar({
              id: activePlace.id,
              title: activePlace.title,
              lat: activePlace.lat,
              lon: activePlace.lon,
              category: activePlace.category,
            });
            dispatch({ type: 'GO_TO', screen: 'route' });
          }}
          onFavourite={() => {
            if (!activePlace) return;
            dispatch({
              type: 'TOGGLE_FAVOURITE',
              pin: {
                placeId: activePlace.id,
                title: activePlace.title,
                lat: activePlace.lat,
                lon: activePlace.lon,
                city,
              },
            });
          }}
          travelDate={state.tripContext.date}
          persona={state.persona ?? null}
          personaProfile={personaProfile}
          insightCache={insightCacheRef}
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
        />
      )}
    </div>
  );
}
