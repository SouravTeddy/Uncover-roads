import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';
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
  const [building, setBuilding] = React.useState(false);

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

  const handleBuild = () => {
    setBuilding(true);
    setTimeout(() => {
      setBuilding(false);
      handleBuildItinerary();
    }, 800);
  };

  return (
    <div className="fixed inset-0" style={{ display: 'flex', flexDirection: 'column', zIndex: 10 }}>
      {/* Top 58% — map or transit background */}
      <div
        className="relative overflow-hidden"
        style={{ height: '58%', background: 'radial-gradient(ellipse at center, #0c1020 0%, #060c1a 100%)' }}
      >
        {/* SVG grid overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Keep existing city dots + route SVG — do NOT remove them */}
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

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[60px] pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--color-bg))' }}
        />
      </div>

      {/* Bottom 42% — card deck */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117', overflow: 'hidden' }}>
        {/* Progress strip */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
          {legs.map((leg, i) => {
            const label = leg.type === 'origin' ? '📍' : leg.type === 'city' ? leg.city : '✈';
            const active = i === activeIndex;
            return (
              <button
                key={i}
                onClick={() => scrollToCard(i)}
                className={`h-[28px] px-4 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'bg-[var(--color-primary-bg)] border border-[var(--color-primary)] text-[var(--color-primary)] scale-[1.05]'
                    : 'text-[var(--color-text-3)] bg-white/5 border border-white/[0.08]'
                }`}
              >
                {label}
              </button>
            );
          })}
          {/* Add city */}
          <button
            onClick={() => dispatch({ type: 'GO_TO', screen: 'map' })}
            className="flex-shrink-0 h-[28px] px-3 rounded-full text-[12px] text-[var(--color-text-3)] border border-dashed border-[var(--color-border)] bg-white/[0.03]"
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
            onClick={handleBuild}
            className={`w-full h-[50px] rounded-2xl font-bold text-[15px] text-white transition-all active:scale-[.97] ${
              building
                ? 'bg-green-600'
                : 'bg-gradient-to-br from-[#e07854] to-[#c4613d] [box-shadow:var(--shadow-primary)]'
            }`}
          >
            {building
              ? <span className="ms text-[20px]" style={{ animation: 'spin 0.8s linear infinite' }}>autorenew</span>
              : 'Build My Trip'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
