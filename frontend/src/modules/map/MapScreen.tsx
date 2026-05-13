import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter, Category, DiscoveryMode } from '../../shared/types';
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
import { FamousPinsLayer } from './FamousPinsLayer';
import { ReferencePinsLayer } from './ReferencePinsLayer';
import { UserPinsLayer } from './UserPinsLayer';
import { DiscoveryModeToggle } from './DiscoveryModeToggle';
import { SurpriseMeButton } from './SurpriseMeButton';
import { BuildItineraryBar } from './BuildItineraryBar';
import { usePinCityDetector } from './usePinCityDetector';
import type { DetectedTransit } from './usePinCityDetector';
import { MultiCityHeader } from './MultiCityHeader';
import { CityArcLayer } from './CityArcLayer';
import { CityHopOverlay } from './CityHopOverlay';
import type { TransitMode } from '../../shared/types';
import { TravelDateBar } from './TravelDateBar'
import { OurPicksPinsLayer } from './OurPicksPinsLayer'
import type { PlacePickFE } from './OurPicksPinsLayer'
import { LiveEventPinsLayer } from './LiveEventPinsLayer'
import type { LiveEvent } from '../../shared/types'
import { NumberedPinsLayer } from './NumberedPinsLayer'
import type { SearchResultPin } from './NumberedPinsLayer'
import { SearchResultsStrip } from './SearchResultsStrip'

// ── Module-level utilities ───────────────────────────────────────

function buildTransitSummary(transit: DetectedTransit | null): string {
  if (!transit) return '';
  const icon: Record<TransitMode, string> = { flight: '✈️', train: '🚄', drive: '🚗', bus: '🚌' };
  const label: Record<TransitMode, string> = { flight: 'flight', train: 'train', drive: 'drive', bus: 'bus' };
  const hours = transit.durationMinutes
    ? `~${Math.round(transit.durationMinutes / 60)}h `
    : '';
  return `${transit.from} → ${transit.to} · ${icon[transit.mode]} ${hours}${label[transit.mode]}`;
}

// ── Main screen ─────────────────────────────────────────────────

const PLACEHOLDER_EXAMPLES = [
  'temples in the area…',
  'best dinner spots…',
  'hidden gems nearby…',
  'live events this weekend…',
  'things to do tomorrow…',
];

export function MapScreen() {
  const {
    city, cityGeo, filteredPlaces, places, selectedPlaces,
    activeFilter, loading, error, activePlace, setActivePlace,
    togglePlace, setFilter, trackViewedCategory, goBack,
  } = useMap();

  const { state, dispatch } = useAppStore();
  const { pendingActivePlace } = state;
  const personaProfile = state.personaProfile ?? null;

  // New store state for phase 4
  const { activePinId, cityContexts, activeCityIndex, favouritedPins, cityFootprints } = state;
  const activeDiscoveryMode: DiscoveryMode = cityContexts[activeCityIndex]?.discoveryMode ?? 'anchor';
  const activeCityDays = cityContexts[activeCityIndex]?.days ?? 0;

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

  // Multi-city overlay state
  const [pendingNewCity, setPendingNewCity] = useState<{ city: string; lat: number; lon: number; transit: DetectedTransit | null } | null>(null);

  const handleNewCity = useCallback((newCity: string, lat: number, lon: number, transit: DetectedTransit | null) => {
    if (cityFootprints.some(f => f.city === newCity)) return;
    setPendingNewCity({ city: newCity, lat, lon, transit });
    const emoji = '🌍';
    dispatch({
      type: 'ADD_CITY_FOOTPRINT',
      footprint: { city: newCity, emoji, pinCount: 1, lat, lon, transitMode: transit?.mode },
    });
  }, [cityFootprints, dispatch]);

  usePinCityDetector(
    selectedPlaces,
    cityFootprints,
    cityGeo?.lat ?? null,
    cityGeo?.lon ?? null,
    city,
    handleNewCity,
  );

  const isMultiCity = cityFootprints.length > 1 || isJourneyMode(selectedPlaces);

  const transitSummary = pendingNewCity?.transit
    ? buildTransitSummary(pendingNewCity.transit)
    : '';

  const selectedIds = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);
  const favouritedIds = useMemo(
    () => new Set(favouritedPins.map(f => f.placeId)),
    [favouritedPins],
  );
  const { details, fetchDetails, clearDetails } = usePlaceDetails();

  const [clusterGroup, setClusterGroup] = useState<{ places: Place[]; lat: number; lon: number } | null>(null);
  const clusterSheetRef    = useRef<HTMLDivElement>(null);
  const clusterTouchStartY = useRef(0);
  const clusterDragY       = useRef(0);

  const [initialLoading, setInitialLoading] = useState(true);

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

  // Phase 11: Our Picks layer
  const [ourPicks, setOurPicks] = useState<PlacePickFE[]>([])

  // Phase 11: Live events layer
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])

  // Phase 11: Search result pins (numbered)
  const [searchPins, setSearchPins] = useState<SearchResultPin[]>([])
  const [showSearchStrip, setShowSearchStrip] = useState(false)

  // Phase 11: Surprise Me confirmation
  const [surpriseConfirm, setSurpriseConfirm] = useState(false)

  // Build Itinerary loading state
  const [buildLoading, setBuildLoading] = useState(false)

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

  useEffect(() => {
    if (!city || activeFilter !== 'curated') { setOurPicks([]); return }
    const activeCityContext = cityContexts[activeCityIndex]
    const cityId = activeCityContext?.city ?? city
    fetch(`/api/cities/picks?city_id=${encodeURIComponent(cityId)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: PlacePickFE[]) => setOurPicks(data))
      .catch(() => setOurPicks([]))
  }, [city, activeFilter, activeCityIndex, cityContexts])

  useEffect(() => {
    if (!city || activeFilter !== 'curated') { setLiveEvents([]); setEventsLoaded(false); return }

    const startDate = state.travelStartDate
    const endDate   = state.travelEndDate

    if (!startDate || !endDate) {
      setEventsNoDate(true)
      return
    }
    setEventsNoDate(false)

    const params = new URLSearchParams({ city, start_date: startDate, end_date: endDate })
    if (cityGeo) {
      params.set('lat', String(cityGeo.lat))
      params.set('lon', String(cityGeo.lon))
    }

    setEventsLoading(true)
    fetch(`/events?${params}`)
      .then(r => r.ok ? r.json() : { places: [], error: 'unavailable' })
      .then((data: { places?: Array<{ id: string; title: string; lat: number; lon: number; tags: Record<string, string>; imageUrl: string | null }>; error?: string }) => {
        if (data.error || !data.places) {
          setEventsError('Events unavailable — check back later')
          setLiveEvents([])
          setEventsLoaded(false)
          return
        }
        const mapped = data.places.map(p => ({
          id:        p.id,
          title:     p.title,
          lat:       p.lat,
          lon:       p.lon,
          venueName: p.tags?.venue   ?? '',
          date:      p.tags?.event_date ?? '',
          time:      p.tags?.event_time ?? '',
          genre:     p.tags?.genre   ?? '',
          url:       p.tags?.website ?? '',
          imageUrl:  p.imageUrl ?? null,
        }))
        setLiveEvents(mapped)
        setEventsLoaded(true)
        setEventsError(null)
      })
      .catch(() => {
        setEventsError('Events unavailable — check back later')
        setEventsLoaded(false)
      })
      .finally(() => setEventsLoading(false))
  }, [city, activeFilter, state.travelStartDate, state.travelEndDate, cityGeo])

  function handleFilterSelect(f: MapFilter) {
    setFilter(f);
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

  // ── Phase 4: new pin click handler — updates both local and store state ──
  const handlePinClick = useCallback((placeId: string) => {
    setClusterGroup(null);
    const found =
      places.find(p => p.id === placeId) ??
      state.referencePins.find(p => p.id === placeId) ??
      selectedPlaces.find(p => p.id === placeId) ?? null;
    if (found) {
      setActivePlace(found as Place);
      fetchDetails(found as Place);
      trackViewedCategory((found as Place).category);
    }
    dispatch({ type: 'SET_ACTIVE_PIN_ID', id: placeId });
  }, [places, state.referencePins, selectedPlaces, setActivePlace, fetchDetails, trackViewedCategory, dispatch]);

  const handlePinCardClose = useCallback(() => {
    setActivePlace(null);
    clearDetails();
    dispatch({ type: 'SET_ACTIVE_PIN_ID', id: null });
  }, [setActivePlace, clearDetails, dispatch]);

  // Discovery mode toggle
  const handleDiscoveryModeChange = useCallback((mode: DiscoveryMode) => {
    dispatch({ type: 'SET_DISCOVERY_MODE', cityIndex: activeCityIndex, mode });
  }, [activeCityIndex, dispatch]);

  // Surprise Me — calls backend, navigates to route screen
  const handleSurprise = useCallback(async () => {
    if (!city) return
    if (!personaProfile) {
      setEventsError('Complete your persona first to use Surprise Me')
      setTimeout(() => setEventsError(null), 3500)
      return
    }
    if (state.engineItinerary) {
      setSurpriseConfirm(true)
      return
    }
    await _runSurprise()
  }, [city, personaProfile, state.engineItinerary])

  const _runSurprise = useCallback(async () => {
    if (!city || !personaProfile) return
    setSurpriseConfirm(false)
    dispatch({ type: 'INCREMENT_GENERATION_COUNT' })
    const startCityContext = cityContexts[0]
    const endCityContext   = cityContexts[cityContexts.length - 1]
    try {
      const result = await api.surpriseMe({
        start_city_id: startCityContext?.city ?? city,
        end_city_id:   endCityContext?.city ?? city,
        start_date:    state.travelStartDate ?? undefined,
        end_date:      state.travelEndDate ?? undefined,
        persona:       personaProfile.archetype ?? 'explorer',
      })
      dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: result })
      dispatch({ type: 'GO_TO', screen: 'route' })
    } catch (err) {
      console.error('[MapScreen] Surprise Me failed:', err)
      setEventsError('Surprise Me failed — try again')
      setTimeout(() => setEventsError(null), 4000)
    }
  }, [city, personaProfile, cityContexts, state.travelStartDate, state.travelEndDate, dispatch])

  const handleBuild = useCallback(async () => {
    if (buildLoading || selectedPlaces.length === 0) return
    setBuildLoading(true)
    try {
      const startDate = state.travelStartDate ?? new Date().toISOString().split('T')[0]
      const days = (state.tripContext?.days ?? 0) > 0 ? state.tripContext.days : 1
      const result = await api.engineItinerary({
        city: city ?? '',
        lat: cityGeo?.lat ?? 0,
        lon: cityGeo?.lon ?? 0,
        days,
        startDate,
        selectedPlaceIds: selectedPlaces.map(p => p.id),
        personaArchetype: personaProfile?.archetype ?? 'explorer',
        engineWeights: null,
      })
      dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: result })
      dispatch({ type: 'GO_TO', screen: 'route' })
    } catch (err) {
      console.error('[MapScreen] handleBuild failed:', err)
      setEventsError('Could not build itinerary — try again')
      setTimeout(() => setEventsError(null), 4000)
    } finally {
      setBuildLoading(false)
    }
  }, [buildLoading, selectedPlaces, state, city, cityGeo, personaProfile, dispatch])

  const isFavourited = activePlace
    ? favouritedIds.has(activePlace.id)
    : false;

  const curatedCount = ourPicks.length + liveEvents.length;

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
        places={[]}
        selectedPlace={null}
        highlightIds={highlightIds}
        onPlaceClick={() => {}}
        onMoveEnd={handleMapMoveEnd}
        routeGeojson={routeGeojson}
      >
        <FamousPinsLayer
          places={filteredPlaces}
          activePlaceId={activePinId}
          discoveryMode={activeDiscoveryMode}
          onPinClick={handlePinClick}
        />
        <ReferencePinsLayer
          pins={state.referencePins}
          activePinId={activePinId}
          onPinClick={handlePinClick}
        />
        <UserPinsLayer
          itineraryPlaces={selectedPlaces}
          favouritedPins={favouritedPins}
          activePinId={activePinId}
          onPinClick={handlePinClick}
        />
        {/* Our Picks layer */}
        {activeFilter === 'curated' && (
          <OurPicksPinsLayer
            picks={ourPicks}
            activePinId={activePinId ?? null}
            onPinClick={(id) => dispatch({ type: 'SET_ACTIVE_PIN_ID', id })}
          />
        )}

        {/* Live Events layer */}
        {activeFilter === 'curated' && (
          <LiveEventPinsLayer
            events={liveEvents}
            activePinId={activePinId ?? null}
            onPinClick={(id) => dispatch({ type: 'SET_ACTIVE_PIN_ID', id })}
          />
        )}

        {/* Numbered search result pins */}
        {showSearchStrip && searchPins.length > 0 && (
          <NumberedPinsLayer
            pins={searchPins}
            onPinClick={(pin) => {
              const match = places.find(p => p.id === pin.id)
              if (match) setActivePlace(match)
            }}
          />
        )}

        {isMultiCity && <CityArcLayer cityFootprints={cityFootprints} />}
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
        {/* Row 1: single-city search bar OR multi-city tab header */}
        {isMultiCity ? (
          <div style={{ pointerEvents: 'auto' }}>
            <MultiCityHeader
              cityFootprints={cityFootprints}
              activeCityIdx={activeCityIndex}
              transitSummary={transitSummary}
              onCityTap={(idx) => {
                dispatch({ type: 'SET_ACTIVE_CITY_INDEX', index: idx });
                const f = cityFootprints[idx];
                if (f) mapHandleRef.current?.flyTo(f.lat, f.lon, 12);
              }}
              onAddCity={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
            />
          </div>
        ) : (
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
                placeholder=""
                className="w-full h-10 rounded-full pl-9 pr-9 text-sm text-white outline-none"
                style={{
                  background: 'rgba(15,20,30,.82)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,.1)',
                }}
              />
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
        )}

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

        {/* Travel date bar */}
        {(state.travelStartDate || state.travelEndDate) && (
          <div style={{ pointerEvents: 'auto', display: 'flex', justifyContent: 'center' }}>
            <TravelDateBar
              startDate={state.travelStartDate}
              endDate={state.travelEndDate}
              cities={cityContexts.map(c => c.city)}
              onTap={() => {}}
            />
          </div>
        )}

        {/* Filter bar */}
        <div style={{ pointerEvents: 'auto' }}>
          <FilterBar
            active={activeFilter as MapFilter}
            allCount={places.length}
            curatedCount={curatedCount}
            curatedLocked={isCurationLocked(state)}
            onSelect={handleFilterSelect}
            onLockedTap={() => dispatch({ type: 'GO_TO', screen: 'subscription' })}
          />
        </div>

        {/* Saved filter chip — appears when places are hearted */}
        {favouritedPins.length > 0 && (
          <div style={{ pointerEvents: 'auto' }}>
            <button
              onClick={() => {
                if (activeFilter === 'saved') {
                  setFilter('all');
                } else {
                  setFilter('saved' as MapFilter);
                }
              }}
              className="flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-medium transition-all"
              style={{
                background: activeFilter === 'saved' ? 'var(--color-primary)' : 'rgba(224,120,84,.15)',
                color: activeFilter === 'saved' ? '#fff' : 'var(--color-primary)',
                border: `1px solid ${activeFilter === 'saved' ? 'var(--color-primary)' : 'rgba(224,120,84,.3)'}`,
              }}
            >
              <span className="ms" style={{ fontSize: 13 }}>bookmark</span>
              Saved
              <span style={{ opacity: 0.7 }}>{favouritedPins.length}</span>
              {activeFilter === 'saved' && (
                <span className="ms" style={{ fontSize: 12 }}>close</span>
              )}
            </button>
          </div>
        )}

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
                  onClick={() => handlePinClick(place.id)}
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

      {/* Discovery mode toggle (bottom-left) */}
      {city && (
        <div style={{ position: 'absolute', bottom: selectedPlaces.length > 0 ? 100 : 72, left: 12, zIndex: 19 }}>
          <DiscoveryModeToggle mode={activeDiscoveryMode} onChange={handleDiscoveryModeChange} />
        </div>
      )}

      {/* Surprise Me (bottom-right) */}
      {city && (
        <div style={{ position: 'absolute', bottom: selectedPlaces.length > 0 ? 100 : 72, right: 12, zIndex: 19 }}>
          <SurpriseMeButton onSurprise={handleSurprise} />
        </div>
      )}

      {/* Pin card — fixed bottom sheet, handles its own positioning + backdrop */}
      {activePlace && (
        <PinCard
          place={activePlace}
          city={city}
          isSelected={selectedIds.has(activePlace.id)}
          onAdd={() => togglePlace(activePlace)}
          onClose={handlePinCardClose}
          details={details}
          isFavourited={isFavourited}
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
                category: activePlace.category,
              },
            });
          }}
          travelDate={state.tripContext.date}
          persona={state.persona ?? null}
          personaProfile={personaProfile}
          insightCache={insightCacheRef}
        />
      )}

      {/* Build itinerary bar — uses portal, renders when places added */}
      <BuildItineraryBar
        itineraryPlaces={selectedPlaces}
        days={activeCityDays}
        onBuild={handleBuild}
        loading={buildLoading}
      />

      {/* Search results strip */}
      {showSearchStrip && searchPins.length > 0 && (
        <SearchResultsStrip
          results={searchPins}
          onSelect={(pin) => {
            const match = places.find(p => p.id === pin.id)
            if (match) setActivePlace(match)
          }}
          onDismiss={() => {
            setSearchPins([])
            setShowSearchStrip(false)
          }}
        />
      )}

      {/* Surprise Me confirmation */}
      {surpriseConfirm && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSurpriseConfirm(false)}
        >
          <div
            style={{ width: '100%', background: 'var(--color-surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
              Replace current itinerary?
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-3)', marginBottom: 20 }}>
              This will replace your current itinerary. Continue?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setSurpriseConfirm(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--color-surface2)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={_runSurprise}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#8b5cf6', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Yes, surprise me
              </button>
            </div>
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

      {/* CityHopOverlay — fires once per new city detected */}
      {pendingNewCity && (
        <CityHopOverlay
          fromCity={pendingNewCity.transit?.from ?? city}
          toCity={pendingNewCity.city}
          storyCards={[]}
          onDone={() => setPendingNewCity(null)}
        />
      )}
    </div>
  );
}
