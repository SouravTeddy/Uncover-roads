import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../shared/store';
import { MapLibreMap } from '../map/MapLibreMap';
import { JourneyOriginCard } from './JourneyOriginCard';
import { JourneyCityCard } from './JourneyCityCard';
import { JourneyTransitCard } from './JourneyTransitCard';
import { JourneyAdvisorThread } from './JourneyAdvisorThread';
import { JourneyStrip } from './JourneyStrip';
import { buildJourneyLegs, calculateArrivalDates } from '../map/journey-legs';
import { isJourneyMode } from '../map/journey-utils';
import { generateAdvisorMessage } from '../map/advisor-utils';
import type { JourneyLeg, Place, StartType } from '../../shared/types';
import { computeTotalDays } from '../map/trip-capacity-utils';

export function JourneyScreen() {
  const { state, dispatch } = useAppStore();
  const {
    selectedPlaces, journey, journeyBudgetDays,
    travelStartDate, travelEndDate, personaProfile,
    tripContext,
  } = state;

  const [activeIndex, setActiveIndex] = useState(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const [legs, setLegs] = useState<JourneyLeg[]>(journey ?? []);

  const stopsPerDay = personaProfile?.stops_per_day ?? 3;
  const originLeg = journey?.find(l => l.type === 'origin') as Extract<JourneyLeg, { type: 'origin' }> | undefined;
  const isLongHaul = originLeg?.place.isLongHaul ?? tripContext.isLongHaul;

  // Rebuild legs when selectedPlaces change
  useEffect(() => {
    if (!isJourneyMode(selectedPlaces)) return;

    const origin = originLeg?.place ?? null;

    buildJourneyLegs(selectedPlaces, origin, stopsPerDay, isLongHaul).then(newLegs => {
      const startDate = travelStartDate ?? new Date().toISOString().slice(0, 10);
      const datedLegs = calculateArrivalDates(newLegs, startDate);
      setLegs(datedLegs);
      dispatch({ type: 'UPDATE_JOURNEY_LEGS', legs: datedLegs });

      // Dispatch transit_auto_flight for any flight transit legs
      datedLegs
        .filter(l => l.type === 'transit' && (l as Extract<JourneyLeg, { type: 'transit' }>).mode === 'flight')
        .forEach(l => {
          const tl = l as Extract<JourneyLeg, { type: 'transit' }>;
          dispatch({
            type: 'ADD_ADVISOR_MESSAGE',
            message: {
              id: `flight-${tl.to}-${Date.now()}`,
              trigger: 'transit_auto_flight',
              message: generateAdvisorMessage('transit_auto_flight', { cityName: tl.to }),
              timestamp: Date.now(),
            },
          });
        });

      // Dispatch long_haul_arrival for first city if long haul
      const firstCityLeg = datedLegs.find(l => l.type === 'city') as Extract<JourneyLeg, { type: 'city' }> | undefined;
      if (isLongHaul && firstCityLeg) {
        dispatch({
          type: 'ADD_ADVISOR_MESSAGE',
          message: {
            id: `long-haul-${Date.now()}`,
            trigger: 'long_haul_arrival',
            message: generateAdvisorMessage('long_haul_arrival', { cityName: firstCityLeg.city }),
            timestamp: Date.now(),
          },
        });
      }

      // Budget vs actual check
      const totalDays = travelStartDate && travelEndDate
        ? computeTotalDays(travelStartDate, travelEndDate)
        : journeyBudgetDays;

      if (totalDays) {
        const cityDaysTotal = datedLegs
          .filter(l => l.type === 'city')
          .reduce((s, l) => s + (l as Extract<JourneyLeg, { type: 'city' }>).estimatedDays, 0);

        if (cityDaysTotal > totalDays) {
          dispatch({
            type: 'ADD_ADVISOR_MESSAGE',
            message: {
              id: `overflow-${Date.now()}`,
              trigger: 'duration_exceeded',
              message: generateAdvisorMessage('duration_exceeded', {
                placeCount: selectedPlaces.length,
                estimatedDays: cityDaysTotal,
                budgetDays: totalDays,
              }),
              timestamp: Date.now(),
            },
          });
        } else if (cityDaysTotal < totalDays - 1) {
          // More than 1 day under budget — prompt user
          dispatch({
            type: 'ADD_ADVISOR_MESSAGE',
            message: {
              id: `under-${Date.now()}`,
              trigger: 'duration_under_used',
              message: generateAdvisorMessage('duration_under_used', { budgetDays: totalDays }),
              timestamp: Date.now(),
            },
          });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaces.length, stopsPerDay, isLongHaul, travelStartDate]);

  // Track active card index on scroll
  const handleScroll = useCallback(() => {
    if (!deckRef.current) return;
    const scrollLeft = deckRef.current.scrollLeft;
    const cardWidth = deckRef.current.offsetWidth;
    setActiveIndex(Math.round(scrollLeft / cardWidth));
  }, []);

  // Scroll to card programmatically (from progress strip tap)
  function scrollToCard(index: number) {
    if (!deckRef.current) return;
    deckRef.current.scrollTo({ left: index * deckRef.current.offsetWidth, behavior: 'smooth' });
  }

  const activeLeg = legs[activeIndex];
  const activePlaces: Place[] = activeLeg?.type === 'city' ? activeLeg.places : [];

  // Center map on active city
  const activeCenter: [number, number] | null = activePlaces.length > 0
    ? [activePlaces[0].lat, activePlaces[0].lon]
    : null;

  function renderTopPanel() {
    if (!activeLeg || activeLeg.type !== 'transit') {
      return (
        <MapLibreMap
          center={activeCenter ?? [20, 0]}
          zoom={activeCenter ? 13 : 2}
          places={activePlaces}
          selectedPlace={null}
          onPlaceClick={() => {}}
          onMoveEnd={() => {}}
          onClick={() => {}}
          routeGeojson={null}
          pinDropResult={null}
        />
      );
    }
    // Transit card: full-bleed transit visual handled by the card itself
    return null;
  }

  if (!isJourneyMode(selectedPlaces)) {
    dispatch({ type: 'GO_TO', screen: 'map' });
    return null;
  }

  function handleBuildItinerary() {
    const cityLegsTotal = legs
      .filter(l => l.type === 'city')
      .reduce((s, l) => s + (l as Extract<JourneyLeg, { type: 'city' }>).estimatedDays, 0);

    const days = (travelStartDate && travelEndDate
      ? computeTotalDays(travelStartDate, travelEndDate)
      : journeyBudgetDays) ?? Math.max(cityLegsTotal, 1);

    const startDate = travelStartDate ?? new Date().toISOString().slice(0, 10);

    const originTypeMap: Record<string, StartType> = {
      hotel: 'hotel', airport: 'airport', home: 'pin', custom: 'pin',
    };
    const startType: StartType = originLeg
      ? (originTypeMap[originLeg.place.originType] ?? 'hotel')
      : 'hotel';

    dispatch({ type: 'SET_ITINERARY', itinerary: null });
    dispatch({ type: 'SET_ITINERARY_DAYS', days: [] });
    dispatch({
      type: 'SET_TRIP_CONTEXT',
      ctx: {
        date:        startDate,
        days:        Math.max(days, 1),
        dayNumber:   1,
        startType,
        arrivalTime: originLeg?.place.departureTime ?? null,
        isLongHaul,
        locationLat:  originLeg?.place.lat ?? null,
        locationLon:  originLeg?.place.lon ?? null,
        locationName: originLeg?.place.name ?? null,
        flightTime:   null,
      },
    });
    dispatch({ type: 'GO_TO', screen: 'route' });
  }

  return (
    <div className="fixed inset-0" style={{ display: 'flex', flexDirection: 'column', zIndex: 10 }}>
      {/* Top 60% — map or transit background */}
      <div style={{ flex: '0 0 60%', position: 'relative', overflow: 'hidden', background: '#0c1445' }}>
        {renderTopPanel()}

        {/* Back button */}
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
          className="absolute"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 16, zIndex: 20,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(15,20,30,.82)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span className="ms text-text-2 text-base">arrow_back</span>
        </button>
      </div>

      {/* Bottom 40% — card deck */}
      <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', background: '#0d1117', overflow: 'hidden' }}>
        {/* Progress strip */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {legs.map((leg, i) => {
            const label = leg.type === 'origin' ? '📍' : leg.type === 'city' ? leg.city : '✈';
            const active = i === activeIndex;
            return (
              <button
                key={i}
                onClick={() => scrollToCard(i)}
                style={{
                  flexShrink: 0, height: 28, padding: '0 10px',
                  borderRadius: 999, cursor: 'pointer',
                  background: active ? 'rgba(59,130,246,.2)' : 'rgba(255,255,255,.05)',
                  border: `1px solid ${active ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.08)'}`,
                  fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700,
                  color: active ? '#93c5fd' : '#8e9099',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
          {/* Add city */}
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
            style={{
              flexShrink: 0, height: 28, padding: '0 10px',
              borderRadius: 999, cursor: 'pointer',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.08)',
              fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#8e9099',
            }}
          >
            + city
          </button>
        </div>

        {/* Swipeable cards */}
        <div
          ref={deckRef}
          onScroll={handleScroll}
          style={{
            display: 'flex', flex: 1,
            overflowX: 'scroll', overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties}
        >
          {legs.map((leg, i) => (
            <div key={i} style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start', overflow: 'hidden' }}>
              {leg.type === 'origin' && (
                <JourneyOriginCard
                  place={leg.place}
                  onEdit={() => dispatch({ type: 'GO_TO', screen: 'map' })}
                />
              )}
              {leg.type === 'city' && (
                <JourneyCityCard
                  city={leg.city}
                  countryCode={leg.countryCode}
                  places={leg.places}
                  estimatedDays={leg.estimatedDays}
                  arrivalDate={leg.arrivalDate}
                  advisorMessage={leg.advisorMessage}
                  onAddPlaces={() => dispatch({ type: 'GO_TO', screen: 'map' })}
                />
              )}
              {leg.type === 'transit' && (
                <JourneyTransitCard
                  mode={leg.mode}
                  from={leg.from}
                  to={leg.to}
                  durationMinutes={leg.durationMinutes}
                  distanceKm={leg.distanceKm}
                  advisorMessage={leg.advisorMessage}
                />
              )}
            </div>
          ))}
        </div>

        {/* Journey strip + advisor thread + build CTA */}
        <div style={{ padding: '8px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <JourneyStrip />
          <JourneyAdvisorThread />
          <button
            onClick={handleBuildItinerary}
            style={{
              width: '100%', height: 50,
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none', borderRadius: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 15, fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 24px rgba(59,130,246,.35)',
              flexShrink: 0,
            }}
          >
            <span className="ms fill" style={{ fontSize: 20 }}>auto_fix</span>
            Build my itinerary
          </button>
        </div>
      </div>
    </div>
  );
}
