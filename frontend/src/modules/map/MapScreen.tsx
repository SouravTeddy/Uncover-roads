import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from './useMap';
import { FilterBar } from './FilterBar';
import { PinCard } from './PinCard';
import type { Place, MapFilter } from '../../shared/types';
import type { MapHandle } from './MapLibreMap';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { useMapMove } from './useMapMove';
import { MapStatusIndicator } from './MapStatusIndicator';
import { MapLoadingOverlay } from './MapLoadingOverlay';
import { usePlaceDetails } from './usePlaceDetails';
import { mapData, api } from '../../shared/api';
import { useAppStore } from '../../shared/store';
import { saveSession } from '../destination/useLastSession';
import { MapLibreMap } from './MapLibreMap';
import { JourneyBreadcrumb } from './JourneyBreadcrumb';
import { getJourneyCities, isJourneyMode } from './journey-utils';
import { FamousPinsLayer } from './FamousPinsLayer';
import { ReferencePinsLayer } from './ReferencePinsLayer';
import { UserPinsLayer } from './UserPinsLayer';
import { BottomActionTray } from './BottomActionTray';
import { usePinCityDetector } from './usePinCityDetector';
import type { DetectedTransit } from './usePinCityDetector';
import { MultiCityHeader } from './MultiCityHeader';
import { CityArcLayer } from './CityArcLayer';
import { CityHopOverlay } from './CityHopOverlay';
import type { TransitMode } from '../../shared/types';
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

export function MapScreen() {
  const [activeCategories, setActiveCategories] = useState<string[]>([]);

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
        saveSession(selectedPlacesRef.current, cityRef.current);
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

  const categoryCounts = useMemo(() =>
    places.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] ?? 0) + 1;
      return acc;
    }, {}),
  [places]);

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
  const [eventsLoading, setEventsLoading]       = useState(false);
  const [eventsNoDate, setEventsNoDate]         = useState(false);
  const [eventsError, setEventsError]           = useState<string | null>(null);

  const mapHandleRef = useRef<MapHandle>(null);

  // Phase 11: Our Picks layer
  const [ourPicks, setOurPicks] = useState<PlacePickFE[]>([])

  // Phase 11: Live events layer
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])

  // Phase 11: Search result pins (numbered)
  const [searchPins, setSearchPins] = useState<SearchResultPin[]>([])
  const [showSearchStrip, setShowSearchStrip] = useState(false)

  // Build Itinerary loading state
  const [buildLoading, setBuildLoading] = useState(false)

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
  }, [cityGeo, handleAreaLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  const { handleMoveEnd, setLastFetch } = useMapMove({
    onFetch: useCallback((center: [number, number]) => {
      handleAreaLoad(center[0], center[1], 3000, true);
    }, [handleAreaLoad]),
    onZoomedOut: useCallback(() => {
      setMapStatus('zoomed-out');
    }, []),
  });

  const handleMapMoveEnd = useCallback((center: [number, number], zoom: number, _bbox: [number, number, number, number]) => {
    handleMoveEnd(center, zoom);
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
    if (!city || activeFilter !== 'curated') { setOurPicks([]); return }
    const activeCityContext = cityContexts[activeCityIndex]
    const cityId = activeCityContext?.city ?? city
    fetch(`/api/cities/picks?city_id=${encodeURIComponent(cityId)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: PlacePickFE[]) => setOurPicks(data))
      .catch(() => setOurPicks([]))
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
    if (f !== 'all') setActiveCategories([]);
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

  const curatedCount = ourPicks.length + liveEvents.length + recommendedPlaces.length;

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
        <FamousPinsLayer
          places={filteredPlaces.filter(p => !selectedIds.has(p.id))}
          activePlaceId={activePinId}
          discoveryMode="anchor"
          isDark={isDark}
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
        {/* Reco Places layer */}
        {activeFilter === 'curated' && (
          <RecoPlacesPinsLayer
            places={recommendedPlaces}
            activePinId={activePinId ?? null}
            onPinClick={(id) => {
              const p = recommendedPlaces.find(r => r.id === id)
              if (p) {
                setActivePlace(p)
                dispatch({ type: 'SET_ACTIVE_PIN_ID', id })
              }
            }}
          />
        )}

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
        {/* Row 1: multi-city tab header only; single-city has no back button */}
        {isMultiCity && (
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
        )}

        {/* Filter bar */}
        <div style={{ pointerEvents: 'auto' }}>
          <FilterBar
            active={activeFilter as MapFilter}
            activeCategories={activeCategories}
            allCount={places.length}
            curatedCount={curatedCount}
            categoryCounts={categoryCounts}
            onSelect={handleFilterSelect}
            onCategoriesSelect={setActiveCategories}
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

      {/* GuideBulb — top-right, same level as FilterBar */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          right: '1rem',
          zIndex: 25,
          pointerEvents: 'auto',
        }}
      >
        <GuideBulb
          messages={guideMessages}
          hasUnread={guideHasUnread}
          onRead={markGuideRead}
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
              },
            });
          }}
          travelDate={state.tripContext.date}
          persona={state.persona ?? null}
          personaProfile={personaProfile}
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
      {city && (
        <BottomActionTray
          startDate={state.travelStartDate}
          endDate={state.travelEndDate}
          cities={cityContexts.map(c => c.city)}
          onDateTap={() => {}}
          itineraryPlaces={selectedPlaces}
          days={activeCityDays}
          buildLoading={buildLoading}
          onBuild={handleBuild}
        />
      )}

    </>
  );
}
