import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../../shared/store';
import { api } from '../../shared/api';
import { useRoute } from './useRoute';
import { MapLibreMap } from '../map/MapLibreMap';
import type { MapHandle } from '../map/MapLibreMap';
import { ExploreMapMarkers } from '../map/ExploreMapMarkers';
import type { MarkerData } from '../map/ExploreMapMarkers';
import { FootprintChips } from '../map/FootprintChips';
import { PinCard } from '../map/PinCard';
import { SimilarPinsBanner, useSimilarPins } from '../map/SimilarPins';
import { usePlaceDetails } from '../map/usePlaceDetails';
import { FavoritesMarker, FavoritesSheet } from '../map/FavoritesLayer';
import { ItineraryMapCard } from './ItineraryMapCard';
import { ItineraryPlaceCard } from './ItineraryPlaceCard';
import type { Place, ReferencePin, FavouritedPin } from '../../shared/types';

type RouteMode = 'explore' | 'itinerary';

export function RouteScreen() {
  const { state, dispatch } = useAppStore();
  const {
    city, cityGeo, persona, personaProfile, selectedPlaces,
    referencePins, favouritedPins, cityFootprints,
    tripContext, itinerary, weather,
  } = state;

  // Start in itinerary mode when places are already selected (e.g. coming from "Build Itinerary")
  const [mode, setMode] = useState<RouteMode>(() => selectedPlaces.length > 0 ? 'itinerary' : 'explore');
  const [activeMarker, setActiveMarker] = useState<MarkerData | null>(null);
  const [referencePinsLoading, setReferencePinsLoading] = useState(false);
  const [itineraryActiveStop, setItineraryActiveStop] = useState(0);
  const [showSequencingReveal, setShowSequencingReveal] = useState(false);
  const [sequencingNote, setSequencingNote] = useState<string | null>(null);
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false);
  const mapRef = useRef<MapHandle>(null);
  const insightCacheRef = useRef(new Map<string, string>());
  const { loading: itineraryLoading, error: itineraryError, buildItinerary } = useRoute();
  const { details, fetchDetails } = usePlaceDetails();
  const { triggerSimilar, clearSimilar, similarPinsState } = useSimilarPins();

  const center: [number, number] = cityGeo
    ? [cityGeo.lat, cityGeo.lon]
    : [35.68, 139.69];

  // Load reference pins on mount
  useEffect(() => {
    if (!city || referencePins.length > 0) return;
    setReferencePinsLoading(true);
    api.referencePins({
      city,
      personaArchetype: persona?.archetype ?? 'Explorer',
      days: tripContext.days,
    }).then(result => {
      if (result.pins?.length) {
        dispatch({ type: 'SET_REFERENCE_PINS', pins: result.pins });
      }
    }).catch(console.error).finally(() => setReferencePinsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const selectedIds = new Set(selectedPlaces.map(p => p.id));
  const favouritedIds = new Set(favouritedPins.map(f => f.placeId));
  const similarIds = new Set(similarPinsState?.similarIds ?? []);

  const markers: MarkerData[] = [
    ...selectedPlaces.map((p): MarkerData => ({
      kind: 'place', place: p,
      state: 'added',
      isFavourited: favouritedIds.has(p.id),
    })),
    ...referencePins
      .filter(rp => !selectedIds.has(rp.id))
      .map((rp): MarkerData => ({
        kind: 'reference', pin: rp,
        state: similarIds.has(rp.id) ? 'similar' : 'reference',
      })),
  ];

  const activePlace: Place | null = activeMarker?.kind === 'place' ? activeMarker.place : null;
  const activeRefPin: ReferencePin | null = activeMarker?.kind === 'reference' ? activeMarker.pin : null;
  const activePlaceForCard: Place | null = activePlace ?? (activeRefPin ? {
    id: activeRefPin.id,
    title: activeRefPin.title,
    lat: activeRefPin.lat,
    lon: activeRefPin.lon,
    category: activeRefPin.category,
  } : null);

  const handleMarkerClick = useCallback((marker: MarkerData) => {
    setActiveMarker(marker);
    if (marker.kind === 'place') {
      fetchDetails(marker.place);
    }
  }, [fetchDetails]);

  const handleAdd = useCallback(() => {
    if (!activePlaceForCard) return;
    dispatch({ type: 'TOGGLE_PLACE', place: activePlaceForCard });
    dispatch({
      type: 'ADD_CITY_FOOTPRINT',
      footprint: {
        city,
        emoji: '📍',
        pinCount: selectedPlaces.length + (selectedIds.has(activePlaceForCard.id) ? -1 : 1),
        lat: cityGeo?.lat ?? 0,
        lon: cityGeo?.lon ?? 0,
      },
    });
  }, [activePlaceForCard, city, cityGeo, selectedPlaces, selectedIds, dispatch]);

  const handleFavourite = useCallback(() => {
    if (!activePlaceForCard) return;
    const fav: FavouritedPin = {
      placeId: activePlaceForCard.id,
      title: activePlaceForCard.title,
      lat: activePlaceForCard.lat,
      lon: activePlaceForCard.lon,
      city,
    };
    dispatch({ type: 'TOGGLE_FAVOURITE', pin: fav });
  }, [activePlaceForCard, city, dispatch]);

  const handleSimilar = useCallback(() => {
    if (!activePlaceForCard) return;
    triggerSimilar({
      id: activePlaceForCard.id,
      title: activePlaceForCard.title,
      lat: activePlaceForCard.lat,
      lon: activePlaceForCard.lon,
      category: activePlaceForCard.category,
    });
  }, [activePlaceForCard, triggerSimilar]);

  const handleFootprintTap = useCallback((footprint: typeof cityFootprints[0]) => {
    mapRef.current?.flyTo(footprint.lat, footprint.lon, 13);
  }, []);

  // ── Itinerary mode ──────────────────────────────────────────────────────
  if (mode === 'itinerary') {
    const isMultiDay = (tripContext.days ?? 1) > 1;

    // Multi-day scrollable timeline view
    if (isMultiDay && itinerary) {
      const stops = itinerary.itinerary;
      // Group stops by day
      const dayMap = new Map<number, typeof stops>();
      for (const s of stops) {
        const d = s.day ?? 1;
        if (!dayMap.has(d)) dayMap.set(d, []);
        dayMap.get(d)!.push(s);
      }
      const days = Array.from(dayMap.entries()).sort(([a], [b]) => a - b);

      return (
        <div style={{ position: 'fixed', inset: 0 }} className="bg-[var(--color-bg)] flex flex-col overflow-hidden">
          {/* Multi-day sticky header */}
          <div className="sticky top-0 z-10 bg-[var(--color-bg)] border-b border-[var(--color-divider)] px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setMode('explore')}
              className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
            >
              <span className="ms text-[var(--color-text-2)]">arrow_back</span>
            </button>
            <div>
              <div className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--color-text-1)]">{city}</div>
              <div className="text-[11px] text-[var(--color-text-3)]">{tripContext.days} days</div>
            </div>
          </div>

          {/* Timeline scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
            {days.map(([dayNum, dayStops]) => {
              const dayLabel = `Day ${dayNum}`;
              return (
                <div key={dayNum}>
                  {/* Day divider */}
                  <div className="flex items-center gap-3 my-[22px]">
                    <div className="flex-1 h-px bg-[var(--color-divider)]" />
                    <span className="font-[family-name:var(--font-heading)] text-[13px] font-bold text-[var(--color-text-2)]">
                      {dayLabel}
                    </span>
                    <div className="flex-1 h-px bg-[var(--color-divider)]" />
                  </div>

                  {/* Timeline stops */}
                  {dayStops.map((stop, stopIdx) => {
                    const isLast = stopIdx === dayStops.length - 1;
                    return (
                      <div
                        key={`${dayNum}-${stopIdx}`}
                        className="flex gap-3 items-start"
                        style={{ opacity: 0, animation: `cardEntry 0.4s ease ${stopIdx * 0.1}s forwards` }}
                      >
                        <div className="relative flex flex-col items-center">
                          <div className="w-8 h-8 rounded-[10px] bg-[var(--color-primary-bg)] flex items-center justify-center flex-shrink-0">
                            <span className="ms text-[var(--color-primary)] text-[18px]">{stop.category ?? 'location_on'}</span>
                          </div>
                          {!isLast && <div className="w-px flex-1 min-h-[20px] bg-[var(--color-divider)] mt-1" />}
                        </div>
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[14px] px-[14px] py-3 flex-1 mb-2">
                          <div className="text-[11px] text-[var(--color-primary)] font-semibold mb-1">{stop.time}</div>
                          <div className="font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--color-text-1)]">{stop.place}</div>
                          <div className="text-[11px] text-[var(--color-text-3)] mt-1">{stop.tip}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
        {/* Back to explore */}
        <button
          onClick={() => setMode('explore')}
          style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 12,
            zIndex: 30,
            cursor: 'pointer',
          }}
          className="w-10 h-10 rounded-full bg-black/30 [backdrop-filter:blur(8px)] flex items-center justify-center"
        >
          <span className="ms text-white">arrow_back</span>
        </button>

        {/* Top 50%: map with numbered pins + route line */}
        <div style={{ flex: '0 0 50%', position: 'relative', background: '#0a0f1a' }}>
          <ItineraryMapCard
            mapRef={mapRef}
            center={center}
            selectedPlaces={selectedPlaces}
            activeStopIdx={itineraryActiveStop}
            onFullMap={() => setMode('explore')}
          />
        </div>

        {/* Bottom 50%: swipeable place card */}
        <div style={{
          flex: '0 0 50%', position: 'relative', overflow: 'hidden',
          background: '#0d1117', borderTop: '1px solid rgba(255,255,255,.06)',
        }}>
          {itinerary ? (
            <ItineraryPlaceCard
              stops={itinerary.itinerary}
              selectedPlaces={selectedPlaces}
              weather={weather}
              referencePins={referencePins}
              travelDate={tripContext.date ?? ''}
              onStopChange={setItineraryActiveStop}
              persona={persona ?? null}
              personaProfile={personaProfile ?? null}
              insightCache={insightCacheRef}
            />
          ) : itineraryLoading ? (
            <div style={{
              height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, color: '#94a3b8', fontSize: '0.85rem',
            }}>
              <span className="ms fill" style={{ fontSize: 32, color: '#6366f1', animation: 'spin 1s linear infinite' }}>route</span>
              Building your itinerary…
            </div>
          ) : itineraryError ? (
            <div style={{
              height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, color: '#f87171', fontSize: '0.82rem', padding: '0 24px', textAlign: 'center',
            }}>
              <span>{itineraryError}</span>
              <button
                onClick={() => buildItinerary()}
                style={{
                  marginTop: 4, padding: '8px 20px', borderRadius: 10,
                  background: '#6366f1', color: '#fff', border: 'none',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </div>
          ) : (
            <div style={{
              height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b', fontSize: '0.85rem',
            }}>
              No itinerary yet — add places in Explore mode
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Explore mode ────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <MapLibreMap
        ref={mapRef}
        center={center}
        places={[]}
        selectedPlace={null}
        onPlaceClick={() => {}}
        onMoveEnd={() => {}}
      >
        <ExploreMapMarkers
          markers={markers}
          selectedId={
            activeMarker?.kind === 'place'
              ? activeMarker.place.id
              : activeMarker?.kind === 'reference'
                ? activeMarker.pin.id
                : null
          }
          onMarkerClick={handleMarkerClick}
        />
        {!activeMarker && favouritedPins.length > 0 && (
          <FavoritesMarker
            pins={favouritedPins}
            onClick={() => setShowFavoritesSheet(true)}
          />
        )}
      </MapLibreMap>

      <FootprintChips
        footprints={cityFootprints}
        activeCityIdx={cityFootprints.findIndex(f => f.city === city)}
        onChipTap={handleFootprintTap}
      />

      {similarPinsState && (
        <SimilarPinsBanner
          category={activePlaceForCard?.category ?? 'places'}
          onClear={clearSimilar}
        />
      )}

      {referencePinsLoading && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'rgba(15,20,30,.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 999,
          padding: '8px 16px',
          fontSize: '0.75rem', color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          <span className="ms" style={{ fontSize: 14, color: '#6366f1' }}>autorenew</span>
          Loading place suggestions…
        </div>
      )}

      {showFavoritesSheet && !activeMarker && (
        <FavoritesSheet
          pins={favouritedPins}
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
            mapRef.current?.flyTo(pin.lat, pin.lon);
            setActiveMarker({ kind: 'place', place, state: 'added', isFavourited: true });
          }}
        />
      )}


      {/* Sequencing reveal overlay */}
      {showSequencingReveal && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(5,8,15,0.88)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          animation: 'fadeIn 0.3s ease',
        }}>
          <span className="ms fill" style={{ fontSize: 48, color: '#6366f1', animation: 'spin 1s linear infinite' }}>
            route
          </span>
          {sequencingNote && (
            <div style={{
              maxWidth: 280, textAlign: 'center',
              fontSize: '0.85rem', color: 'rgba(193,198,215,.8)',
              lineHeight: 1.55, padding: '12px 20px',
              background: 'rgba(99,102,241,.1)',
              border: '1px solid rgba(99,102,241,.2)',
              borderRadius: 14,
            }}>
              {sequencingNote}
            </div>
          )}
        </div>
      )}

      {/* Itinerary button */}
      <button
        onClick={() => {
          setSequencingNote(
            selectedPlaces.length > 1
              ? `Sequenced ${selectedPlaces.length} stops by travel time and your preferences`
              : null
          );
          setShowSequencingReveal(true);
          setTimeout(() => {
            setShowSequencingReveal(false);
            setMode('itinerary');
          }, 1800);
        }}
        disabled={selectedPlaces.length === 0}
        style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
          right: 16,
          zIndex: 20,
          background: selectedPlaces.length === 0 ? 'rgba(99,102,241,.4)' : '#6366f1',
          border: 'none',
          borderRadius: 14, padding: '12px 20px',
          fontSize: '0.85rem', fontWeight: 700, color: '#fff',
          cursor: selectedPlaces.length === 0 ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(99,102,241,.4)',
        }}
      >
        <span className="ms fill" style={{ fontSize: 18 }}>route</span>
        Itinerary ({selectedPlaces.length})
      </button>

      {/* Back button */}
      <button
        onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          left: cityFootprints.length > 0 ? undefined : 12,
          right: cityFootprints.length > 0 ? 12 : undefined,
          zIndex: 20,
          cursor: 'pointer',
        }}
        className="w-10 h-10 rounded-full bg-black/30 [backdrop-filter:blur(8px)] flex items-center justify-center"
      >
        <span className="ms text-white">arrow_back</span>
      </button>

      {/* PinCard */}
      {activePlaceForCard && (
        <PinCard
          place={activePlaceForCard}
          city={city}
          isSelected={selectedIds.has(activePlaceForCard.id)}
          isFavourited={favouritedIds.has(activePlaceForCard.id)}
          onAdd={handleAdd}
          onClose={() => setActiveMarker(null)}
          onSimilar={handleSimilar}
          onFavourite={handleFavourite}
          details={details}
          referencePin={activeRefPin}
          travelDate={tripContext.date}
        />
      )}
    </div>
  );
}
