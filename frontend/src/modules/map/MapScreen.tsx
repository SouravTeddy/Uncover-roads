import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiDisclaimerSheet } from './AiDisclaimerSheet';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter, Category } from '../../shared/types';
import type { MapHandle } from './MapLibreMap';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { useMapMove } from './useMapMove';
import { MapStatusIndicator } from './MapStatusIndicator';
import { MapLoadingOverlay } from './MapLoadingOverlay';
import { usePlaceDetails } from './usePlaceDetails';
import { mapData, api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { saveSessionMulti } from '../destination/useRecentSessions';
import { MapLibreMap } from './MapLibreMap';
import { JourneyBreadcrumb } from './JourneyBreadcrumb';
import { getJourneyCities, isJourneyMode } from './journey-utils';
import { FamousPinsLayer } from './FamousPinsLayer';
import { ReferencePinsLayer } from './ReferencePinsLayer';
import { UserPinsLayer } from './UserPinsLayer';
import { BottomActionTray } from './BottomActionTray';
import { usePinCityDetector, findNearestCity } from './usePinCityDetector';
import type { DetectedTransit } from './usePinCityDetector';
import { MultiCityHeader } from './MultiCityHeader';
import { CityArcLayer } from './CityArcLayer';
import { CityHopOverlay } from './CityHopOverlay';
import { OurPicksPinsLayer } from './OurPicksPinsLayer'
import type { PlacePickFE } from './OurPicksPinsLayer'
import { LiveEventPinsLayer } from './LiveEventPinsLayer'
import { RecoPlacesPinsLayer } from './RecoPlacesPinsLayer'
import type { LiveEvent } from '../../shared/types'
import { NumberedPinsLayer } from './NumberedPinsLayer'
import type { SearchResultPin } from './NumberedPinsLayer'
import { SearchResultsStrip } from './SearchResultsStrip'
import { GuideBulb } from './GuideBulb'
import { useGuideMessages } from './useGuideMessages'
import { shouldShowPaywall } from '../../shared/tier'
import { useNeighborhoods } from './useNeighborhoods'
import { useHeatmapSeed } from './useHeatmapSeed'
import { AreaBlobLayer } from './AreaBlobLayer'
import { AreaPillsOverlay } from './AreaPillsOverlay'

// ── Main screen ─────────────────────────────────────────────────

export function MapScreen() {
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeQuickPickLabel, setActiveQuickPickLabel] = useState<string | null>(null)
  const [mapZoom, setMapZoom] = useState(13)
  const [mapBbox, setMapBbox] = useState<[number,number,number,number] | null>(null)
  const [mapCenter, setMapCenter] = useState<{lat: number; lon: number} | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)

  const {
    city, cityGeo, filteredPlaces, places, selectedPlaces,
    activeFilter, loading, error, activePlace, setActivePlace,
    togglePlace, setFilter, trackViewedCategory, recommendedPlaces,
  } = useMap(activeCategories);

  const { state, dispatch } = useAppStore();
  const { pendingActivePlace } = state;
  const personaProfile = state.personaProfile ?? null;

  // New store state for phase 4
  const { activePinId, cityContexts, activeCityIndex, favouritedPins, cityFootprints, theme } = state;
  const isDark = theme !== 'light'
  const activeCityDays = cityContexts[activeCityIndex]?.days ?? 0;

  // Keep refs current so the unmount cleanup can read latest values
  const selectedPlacesRef = useRef(selectedPlaces);
  const cityRef = useRef(city);
  useEffect(() => { selectedPlacesRef.current = selectedPlaces; }, [selectedPlaces]);
  useEffect(() => { cityRef.current = city; }, [city]);

  // Guard: if city was lost (fresh tab, cleared session), kick back to destination
  useEffect(() => {
    if (!city) dispatch({ type: 'GO_TO', screen: 'destination' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save session on unmount — the previous effect-based approach never fired because
  // MapScreen unmounts the moment currentScreen changes, before the effect could re-run.
  useEffect(() => {
    return () => {
      if (selectedPlacesRef.current.length > 0 && cityRef.current) {
        saveSessionMulti(selectedPlacesRef.current, cityRef.current);
      }
    };
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

  const handleNewCity = useCallback((newCity: string, lat: number, lon: number, transit: DetectedTransit | null, country: string | null) => {
    if (cityFootprints.some(f => f.city === newCity)) return;
    setPendingNewCity({ city: newCity, lat, lon, transit });
    const emoji = '🌍';
    dispatch({
      type: 'ADD_CITY_FOOTPRINT',
      footprint: { city: newCity, emoji, pinCount: 1, lat, lon, transitMode: transit?.mode },
    });
    if (country) dispatch({ type: 'SET_CITY_COUNTRY', city: newCity, country });
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

  const categoryCounts = useMemo(() =>
    places.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] ?? 0) + 1;
      return acc;
    }, {}),
  [places]);

  const neighborhoods = useNeighborhoods(city, places)
  const cityCenter = cityGeo ? { lat: cityGeo.lat, lon: cityGeo.lon } : null
  const heatmapSeeds = useHeatmapSeed(cityCenter, mapCenter)

  // Empty area detection
  const isFilterActive = activeCategories.length > 0
  const activeCategoryLabel = (() => {
    if (activeQuickPickLabel) {
      return activeQuickPickLabel.replace(/^(Best |Top )/, '').toLowerCase()
    }
    const SUB_CHIP_LABELS: Record<string, string> = {
      restaurant: 'eateries', cafe: 'cafés', park: 'parks', museum: 'museums',
      historic: 'landmarks', tourism: 'attractions', viewpoint: 'viewpoints',
      bar: 'bars', nightlife: 'nightlife spots',
    }
    return activeCategories.length === 1 ? (SUB_CHIP_LABELS[activeCategories[0]] ?? activeCategories[0]) : 'spots'
  })()
  const matchingInView = isFilterActive && mapBbox
    ? filteredPlaces.filter(p =>
        p.lat >= mapBbox[0] && p.lat <= mapBbox[1] &&
        p.lon >= mapBbox[2] && p.lon <= mapBbox[3]
      ).length
    : 1  // non-zero default when no filter
  const emptyArea = isFilterActive && matchingInView === 0

  const selectedIds = useMemo(() => new Set(selectedPlaces.map(p => p.id)), [selectedPlaces]);
  const favouritedIds = useMemo(
    () => new Set(favouritedPins.map(f => f.placeId)),
    [favouritedPins],
  );
  const citySavedCount = useMemo(
    () => favouritedPins.filter(p => p.city === city).length,
    [favouritedPins, city],
  );
  const { details, fetchDetails, clearDetails } = usePlaceDetails();

  const [clusterGroup, setClusterGroup] = useState<{ places: Place[]; lat: number; lon: number } | null>(null);
  const clusterSheetRef    = useRef<HTMLDivElement>(null);
  const clusterTouchStartY = useRef(0);
  const clusterDragY       = useRef(0);

  const [initialLoading, setInitialLoading] = useState(true);

  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'zoomed-out'>('idle');

  // Events
  const [eventsLoading, setEventsLoading]       = useState(false);
  const [eventsNoDate, setEventsNoDate]         = useState(false);
  const [eventsError, setEventsError]           = useState<string | null>(null);

  const mapHandleRef = useRef<MapHandle>(null);

  // Phase 11: Our Picks layer
  const [ourPicks, setOurPicks] = useState<PlacePickFE[]>([])
  const [ourPicksLoaded, setOurPicksLoaded] = useState(false)

  // Phase 11: Live events layer
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])

  // Phase 11: Search result pins (numbered)
  const [searchPins, setSearchPins] = useState<SearchResultPin[]>([])
  const [showSearchStrip, setShowSearchStrip] = useState(false)

  // Build Itinerary loading + error state
  const [buildLoading, setBuildLoading] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [pendingBuild, setPendingBuild] = useState(false)

  const { messages: guideMessages, hasUnread: guideHasUnread, markRead: markGuideRead } = useGuideMessages(
    selectedPlaces, city, state.persona ?? null, personaProfile,
    places, activePlace, liveEvents,
    state.travelStartDate, state.travelEndDate, activeCityDays,
  )

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

  // Trigger initial load when city or cityGeo changes. Tracks last loaded city
  // so that changing the city mid-session always fires a fresh load.
  const lastLoadedCity = useRef<string | null>(null);
  useEffect(() => {
    if (!cityGeo || !city) return;
    if (lastLoadedCity.current === city) return;
    lastLoadedCity.current = city;
    setLastFetch([cityGeo.lat, cityGeo.lon]);
    // Reset filter to 'all' so stale category filters don't hide fresh pins
    if (activeFilter !== 'all') setFilter('all');
    handleAreaLoad(cityGeo.lat, cityGeo.lon, 5000, true);
  }, [city, cityGeo, handleAreaLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  const { handleMoveEnd, setLastFetch } = useMapMove({
    onFetch: useCallback((center: [number, number]) => {
      handleAreaLoad(center[0], center[1], 3000, false);
    }, [handleAreaLoad]),
    onZoomedOut: useCallback(() => {
      setMapStatus('zoomed-out');
    }, []),
  });

  const handleMapMoveEnd = useCallback((center: [number, number], zoom: number, bbox: [number, number, number, number]) => {
    handleMoveEnd(center, zoom);
    setMapZoom(zoom)
    setMapBbox(bbox)
    setMapCenter({ lat: center[0], lon: center[1] })
  }, [handleMoveEnd]);

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
    if (!city || activeFilter !== 'curated') { setOurPicks([]); setOurPicksLoaded(false); return }
    const activeCityContext = cityContexts[activeCityIndex]
    const cityId = activeCityContext?.city ?? city
    setOurPicksLoaded(false)
    fetch(`/api/cities/picks?city_id=${encodeURIComponent(cityId)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: PlacePickFE[]) => {
        setOurPicks(data)
        setOurPicksLoaded(true)
        if (data.length === 0) console.warn('[MapScreen] ourPicks resolved empty for city:', cityId)
      })
      .catch(() => { setOurPicks([]); setOurPicksLoaded(true) })
  }, [city, activeFilter, activeCityIndex, cityContexts])

  useEffect(() => {
    if (!city || activeFilter !== 'curated') { setLiveEvents([]); return }

    const startDate = state.travelStartDate
    const endDate   = state.travelEndDate

    if (!startDate || !endDate) {
      setEventsNoDate(true)
      return
    }
    setEventsNoDate(false)

    setEventsLoading(true)
    api.events(city, startDate, endDate, cityGeo?.lat, cityGeo?.lon)
      .then((places) => {
        const mapped = places.map(p => ({
          id:        p.id,
          title:     p.title,
          lat:       p.lat,
          lon:       p.lon,
          venueName: p.tags?.venue      ?? '',
          date:      p.tags?.event_date ?? '',
          time:      p.tags?.event_time ?? '',
          genre:     p.tags?.genre      ?? '',
          url:       p.tags?.website    ?? '',
          imageUrl:  (p as Place & { imageUrl?: string | null }).imageUrl ?? null,
        }))
        setLiveEvents(mapped)
        setEventsError(null)
      })
      .catch(() => {
        setEventsError('Events unavailable — check back later')
        setLiveEvents([])
      })
      .finally(() => setEventsLoading(false))
  }, [city, activeFilter, state.travelStartDate, state.travelEndDate, cityGeo])

  function handleFilterSelect(f: MapFilter) {
    setFilter(f);
    if (f !== 'all') { setActiveCategories([]); setActiveQuickPickLabel(null); }
  }

  function handleQuickPickSelect(label: string | null, cats: string[]) {
    setActiveQuickPickLabel(label)
    setActiveCategories(cats)
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

  const handlePicksPinClick = useCallback((placeId: string) => {
    // Prefer an existing place entry so all fields are present
    const existing = places.find(p => p.id === placeId || p.place_id === placeId)
    if (existing) { handlePinClick(existing.id); return }
    const pick = ourPicks.find(p => p.place_id === placeId)
    if (!pick) return
    const synthetic: Place = {
      id: pick.place_id,
      title: pick.name,
      lat: pick.lat,
      lon: pick.lon,
      category: pick.category as Category,
      rating: pick.rating ?? undefined,
      place_id: pick.place_id,
    }
    setActivePlace(synthetic)
    fetchDetails(synthetic)
    trackViewedCategory(pick.category)
    dispatch({ type: 'SET_ACTIVE_PIN_ID', id: placeId })
  }, [places, ourPicks, handlePinClick, setActivePlace, fetchDetails, trackViewedCategory, dispatch])

  const handleEventPinClick = useCallback((eventId: string) => {
    const ev = liveEvents.find(e => e.id === eventId)
    if (!ev) return
    const synthetic: Place = {
      id: ev.id,
      title: ev.title,
      lat: ev.lat,
      lon: ev.lon,
      category: 'event' as Category,
      tags: { genre: ev.genre, event_date: ev.date, event_time: ev.time, venue: ev.venueName, website: ev.url },
    }
    setActivePlace(synthetic)
    fetchDetails(synthetic)
    trackViewedCategory('event')
    dispatch({ type: 'SET_ACTIVE_PIN_ID', id: eventId })
  }, [liveEvents, setActivePlace, fetchDetails, trackViewedCategory, dispatch])

  const executeBuild = useCallback(async () => {
    if (buildLoading || selectedPlaces.length === 0) return
    setBuildLoading(true)
    setBuildError(null)
    try {
      const startDate = state.travelStartDate ?? new Date().toISOString().split('T')[0]
      const days = (state.tripContext?.days ?? 0) > 0 ? state.tripContext.days : 1

      // Re-derive city per place at build time using cityFootprints centroids.
      // Fixes the case where a place was fetched while the map was still labeled
      // with the previous city (e.g., Melbourne places with _city="Sydney").
      const cityLookup = cityFootprints.length > 0
        ? cityFootprints.map(f => ({ city: f.city, lat: f.lat, lon: f.lon }))
        : [{ city: city ?? '', lat: cityGeo?.lat ?? 0, lon: cityGeo?.lon ?? 0 }];

      const resolvedPlaces = selectedPlaces.map(p => ({
        id: p.id,
        place_id: p.place_id,
        title: p.title,
        lat: p.lat,
        lon: p.lon,
        category: p.category,
        rating: p.rating,
        photo_ref: p.photo_ref,
        city: findNearestCity(p.lat, p.lon, cityLookup, 80) ?? p._city ?? city ?? '',
      }));

      const uniqueCities = [...new Set(resolvedPlaces.map(p => p.city).filter(Boolean))];
      const orderedCities = cityFootprints.length > 0
        ? cityFootprints.map(f => f.city).filter(c => uniqueCities.includes(c))
        : uniqueCities;

      const result = await api.engineItinerary({
        city: city ?? '',
        lat: cityGeo?.lat ?? 0,
        lon: cityGeo?.lon ?? 0,
        days,
        startDate,
        selectedPlaces: resolvedPlaces,
        personaArchetype: personaProfile?.archetype ?? 'explorer',
        engineWeights: null,
        cities: orderedCities.length > 1 ? orderedCities : undefined,
        arrivalTime: state.pendingTripDetails?.arrivalTime ?? null,
      })
      dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: result })
      dispatch({ type: 'GO_TO', screen: 'itinerary-reel' })
    } catch (err) {
      console.error('[MapScreen] executeBuild failed:', err)
      setBuildError('Could not build itinerary — try again')
      setTimeout(() => setBuildError(null), 4000)
    } finally {
      setBuildLoading(false)
    }
  }, [buildLoading, selectedPlaces, state, city, cityGeo, personaProfile, dispatch])

  const handleBuild = useCallback(async () => {
    if (buildLoading || selectedPlaces.length === 0) return;
    if (shouldShowPaywall(state)) {
      dispatch({ type: 'GO_TO', screen: 'subscription' });
      return;
    }
    if (!localStorage.getItem('ur_ai_disclaimer_shown')) {
      setPendingBuild(true);
      setShowDisclaimer(true);
      return;
    }
    await executeBuild();
  }, [buildLoading, selectedPlaces, state, dispatch, executeBuild])

  const isFavourited = activePlace
    ? favouritedIds.has(activePlace.id)
    : false;

  const activeOurPickMatch = activePlace
    ? ourPicks.find(p => p.place_id === activePlace.id) ?? null
    : null
  const activeOurPickBadge = activeOurPickMatch?.badge ?? null
  const activeOurPickBadgeReason = activeOurPickMatch?.badge_reason ?? null

  const badgedPicks = ourPicks.filter(p => p.badge !== null)

  const curatedCount = ourPicksLoaded
    ? badgedPicks.length + liveEvents.length + recommendedPlaces.length
    : 0

  const displayCount = activeCategories.length > 0 ? filteredPlaces.length : places.length

  const center: [number, number] = cityGeo ? [cityGeo.lat, cityGeo.lon] : [20, 0];

  const routeGeojson = state.route?.geojson
    ? ({
        type: 'Feature',
        properties: {},
        geometry: state.route.geojson,
      } as GeoJSON.Feature<GeoJSON.LineString>)
    : null;

  return (
    <>
    <div className="fixed inset-0" style={{ zIndex: !!activePlace ? 35 : 10 }}>

      {/* Map — full screen */}
      <MapLibreMap
        ref={mapHandleRef}
        center={center}
        zoom={cityGeo ? 13 : 2}
        places={[]}
        selectedPlace={null}
        selectedPlaces={selectedPlaces}
        onPlaceClick={() => {}}
        onMoveEnd={handleMapMoveEnd}
        routeGeojson={routeGeojson}
      >
        {activeFilter !== 'curated' && (
          <FamousPinsLayer
            places={filteredPlaces.filter(p =>
              !selectedIds.has(p.id) &&
              !ourPicks.some(pick =>
                pick.place_id === p.id ||
                pick.place_id === p.place_id ||
                pick.name.toLowerCase() === p.title.toLowerCase()
              )
            )}
            activePlaceId={activePinId}
            discoveryMode="anchor"
            isDark={isDark}
            onPinClick={handlePinClick}
          />
        )}
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
        {/* Reco Places layer */}
        {activeFilter === 'curated' && (
          <RecoPlacesPinsLayer
            places={recommendedPlaces}
            activePinId={activePinId ?? null}
            onPinClick={(id) => {
              const p = recommendedPlaces.find(r => r.id === id)
              if (p) {
                setActivePlace(p)
                fetchDetails(p)
                trackViewedCategory(p.category)
                dispatch({ type: 'SET_ACTIVE_PIN_ID', id })
              }
            }}
          />
        )}

        {/* Our Picks layer — only show badge-bearing picks (trending/hidden_gem/getting_busy) */}
        {activeFilter === 'curated' && (
          <OurPicksPinsLayer
            picks={badgedPicks}
            activePinId={activePinId ?? null}
            onPinClick={handlePicksPinClick}
          />
        )}

        {/* Live Events layer */}
        {activeFilter === 'curated' && (
          <LiveEventPinsLayer
            events={liveEvents}
            activePinId={activePinId ?? null}
            onPinClick={handleEventPinClick}
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

        <AreaBlobLayer
          places={places}
          neighborhoods={neighborhoods}
          heatmapSeeds={heatmapSeeds}
          visible={activeFilter === 'all' && activeCategories.length === 0}
          bbox={mapBbox}
          mapCenter={mapCenter}
        />
        <AreaPillsOverlay
          neighborhoods={neighborhoods}
          mapZoom={mapZoom}
          selectedAreaId={selectedAreaId}
          onSelectArea={setSelectedAreaId}
          activeFilter={activeFilter}
        />
      </MapLibreMap>

      {/* Area result strip — screen-level so position: absolute works correctly */}
      {(() => {
        const selArea = neighborhoods.find(n => n.id === selectedAreaId) ?? null
        if (!selArea || emptyArea) return null
        return (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 92,
              transform: 'translateX(-50%)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 16px 9px 13px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              background: 'rgba(12,13,17,.92)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,.09)',
              boxShadow: '0 10px 32px rgba(0,0,0,.5)',
              animation: 'stripIn .4s cubic-bezier(.25,0,0,1) both',
              pointerEvents: 'none',
            }}
          >
            <span className="ms fill" style={{ fontSize: 16, color: selArea.park ? '#5fa570' : '#d6aa56' }}>place</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 17, color: '#f2ede6' }}>
              {selArea.name}
            </span>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#6b6a72', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#a3a0a8' }}>{selArea.spotCount} spots</span>
          </div>
        )
      })()}

      {/* Empty area banner — screen-level so position: absolute works correctly */}
      {emptyArea && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 92,
            zIndex: 55,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 16px',
            borderRadius: 16,
            background: 'rgba(12,13,17,.94)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(232,97,90,.6)',
            boxShadow: '0 12px 36px rgba(0,0,0,.6), 0 0 22px rgba(232,97,90,.16)',
            animation: 'bannerIn .4s cubic-bezier(.25,0,0,1) both',
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,97,90,.16)', border: '1px solid rgba(232,97,90,.4)' }}>
            <span className="ms" style={{ fontSize: 19, color: '#e8615a' }}>search</span>
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#e8615a' }}>No {activeCategoryLabel ?? 'spots'} here</div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(242,237,230,.6)', marginTop: 1 }}>Pan back toward the city to populate spots</div>
          </div>
        </div>
      )}

      {/* Initial load overlay — hide if we already have cached places */}
      <MapLoadingOverlay visible={initialLoading && places.length === 0} />

      {/* Map status — loading / zoomed-out indicator (hidden during initial overlay) */}
      <MapStatusIndicator status={initialLoading ? 'idle' : mapStatus} />

      {/* ── Top overlay ── */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col gap-2 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', paddingBottom: '0.5rem', zIndex: 20, pointerEvents: 'none' }}
      >
        {/* Row 1: multi-city tab header only; single-city has no back button */}
        {isMultiCity && (
          <div style={{ pointerEvents: 'auto' }}>
            <MultiCityHeader
              cityFootprints={cityFootprints}
              activeCityIdx={activeCityIndex}
              travelStartDate={state.travelStartDate}
              travelEndDate={state.travelEndDate}
              onCityTap={(idx) => {
                dispatch({ type: 'SET_ACTIVE_CITY_INDEX', index: idx })
                const f = cityFootprints[idx]
                if (f) mapHandleRef.current?.flyTo(f.lat, f.lon, 12)
              }}
              onDateTap={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
            />
          </div>
        )}

        {/* Filter bar */}
        <div style={{ pointerEvents: 'auto' }}>
          <FilterBar
            active={activeFilter as MapFilter}
            activeCategories={activeCategories}
            displayCount={displayCount}
            curatedCount={curatedCount}
            categoryCounts={categoryCounts}
            activeQuickPickLabel={activeQuickPickLabel}
            onSelect={handleFilterSelect}
            onCategoriesSelect={(cats) => { setActiveCategories(cats); setActiveQuickPickLabel(null) }}
            onQuickPickSelect={handleQuickPickSelect}
            empty={emptyArea && activeCategories.length > 0}
          />
        </div>

        {/* Saved filter chip — appears when places are hearted */}
        {citySavedCount > 0 && (
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
              <span style={{ opacity: 0.7 }}>{citySavedCount}</span>
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

      {/* Right column — single-city only */}
      {!isMultiCity && city && (
        <span
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
            right: '1rem',
            zIndex: 25,
            fontFamily: 'var(--font-heading)',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          {city}
        </span>
      )}
      {!isMultiCity && state.travelStartDate && state.travelEndDate && (
        <span
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 2.25rem)',
            right: '1rem',
            zIndex: 25,
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-3)',
            lineHeight: 1,
          }}
        >
          {new Date(state.travelStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {new Date(state.travelEndDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      <div
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          right: '1rem',
          zIndex: 26,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
          marginTop: isMultiCity ? 0 : '3.5rem',
        }}
      >
        <GuideBulb
          messages={guideMessages}
          hasUnread={guideHasUnread}
          onRead={markGuideRead}
          onPlaceAction={(id) => {
            const place = places.find(p => p.id === id)
            if (place) {
              mapHandleRef.current?.flyTo(place.lat, place.lon, 15)
              dispatch({ type: 'SET_ACTIVE_PIN_ID', id: place.id })
            }
          }}
        />
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

      {/* Events error — small muted notice, only in curated tab, doesn't block OurPicks */}
      {eventsError && activeFilter === 'curated' && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)', zIndex: 25, background: 'rgba(15,20,30,.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <span className="ms fill text-text-3" style={{ fontSize: 13 }}>event_busy</span>
          <span className="text-text-3" style={{ fontSize: '0.68rem' }}>Events unavailable</span>
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

      {/* Build error toast — always visible (not scoped to curated tab) */}
      {buildError && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)', zIndex: 25, background: 'rgba(239,68,68,.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(239,68,68,.3)' }}
        >
          <span className="ms fill text-red-400" style={{ fontSize: 15 }}>error</span>
          <span className="text-red-300 text-xs font-medium">{buildError}</span>
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
                photoRef: activePlace.photo_ref ?? null,
                travelDate: state.travelStartDate ?? null,
              },
            });
          }}
          travelDate={state.tripContext.date}
          travelStartDate={state.travelStartDate}
          travelEndDate={state.travelEndDate}
          ourPickBadge={activeOurPickBadge}
          badgeReason={activeOurPickBadgeReason}
          userTier={state.userTier}
        />
      )}


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

      {/* BottomActionTray — lifted outside the stacking-context div so it renders above BottomNav (zIndex 30) */}
      {city && !activePinId && (
        <BottomActionTray
          itineraryPlaces={selectedPlaces}
          days={activeCityDays}
          buildLoading={buildLoading}
          onBuild={handleBuild}
        />
      )}

      {showDisclaimer && (
        <AiDisclaimerSheet
          onContinue={async () => { setShowDisclaimer(false); if (pendingBuild) { setPendingBuild(false); await executeBuild(); } }}
        />
      )}

    </>
  );
}
