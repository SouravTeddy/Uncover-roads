import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAppStore } from '../../../shared/store';
import { buildReelCards } from './reel-builder';
import { ReelIntroCard } from './ReelIntroCard';
import { ReelStopCard } from './ReelStopCard';
import { ReelRecoCard } from './ReelRecoCard';
import { ReelIntelCard } from './ReelIntelCard';
import { ReelTransitCard } from './ReelTransitCard';
import { ReelFinaleCard } from './ReelFinaleCard';
import { ReelSummaryCard } from './ReelSummaryCard';
import { ReelDayDividerCard } from './ReelDayDividerCard';
import type { ReelCard, ReelRecoCard as ReelRecoCardType } from './types';
import { api, getPlacePhotoUrl } from '../../../shared/api';
import { useCityPhotoBatch } from '../../destination/useCityPhoto';
import { ReelBalanceCard } from './ReelBalanceCard';
import ReelScenicCard from './ReelScenicCard';
import { computeRecoSignal, deriveRecos, buildInteraction } from '../reco-engine';
import { syncRecoInteractions } from '../../../shared/userSync';
import { supabase } from '../../../shared/supabase';
import { TripDetailsSheet } from './TripDetailsSheet';



function preloadImages(srcs: string[]): Promise<void> {
  if (srcs.length === 0) return Promise.resolve();
  return Promise.all(
    srcs.map(src => new Promise<void>(resolve => {
      const img = new Image();
      img.onload = img.onerror = () => resolve();
      img.src = src;
    })),
  ).then(() => undefined);
}

export function ItineraryReelScreen() {
  const { state, dispatch } = useAppStore();
  const {
    engineItinerary, reelSavedId, savedItineraries,
    journey, weather, persona, personaProfile, city,
  } = state;

  const savedItem = reelSavedId
    ? savedItineraries.find(s => s.id === reelSavedId) ?? null
    : null;

  // When playing a saved trip, use its itinerary cast to EngineItinerary
  const activeItinerary = savedItem
    ? (savedItem.itinerary as unknown as import('../../../shared/types').EngineItinerary)
    : engineItinerary;

  const personaName =
    savedItem?.persona?.archetype_name ??
    persona?.archetype_name ??
    personaProfile?.archetype ??
    'Explorer';

  const archetype: string =
    (activeItinerary as import('../../../shared/types').EngineItinerary | null)?.archetypeSnapshot ??
    savedItem?.persona?.archetype ??
    persona?.archetype ??
    'explorer';

  const itineraryCities = activeItinerary
    ? (activeItinerary.cities?.length ? activeItinerary.cities : [activeItinerary.city ?? city].filter(Boolean))
    : [];
  const cityPhotoMap = useCityPhotoBatch(itineraryCities as string[]);

  const existingPlaceIds = state.selectedPlaces.map(p => p.place_id ?? p.id);

  const [cards, setCards] = useState<ReelCard[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [removedStopIds, setRemovedStopIds] = useState<Set<string>>(new Set());
  const [undoPending, setUndoPending] = useState<{ id: string; label: string } | null>(null);
  const [saved, setSaved] = useState(!!savedItem);
  const [imagesReady, setImagesReady] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const autoSavedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weatherRef = useRef(weather);
  const personaNameRef = useRef(personaName);

  useEffect(() => { weatherRef.current = weather; }, [weather]);
  useEffect(() => { personaNameRef.current = personaName; }, [personaName]);

  function buildFiltered(itinerary: typeof activeItinerary, w: typeof weather, pName: string, photoMap = cityPhotoMap) {
    const journeyLegs = savedItem ? (savedItem.journeyLegs ?? null) : (journey ?? null);

    const recosByDayIdx = new Map<number, ReelRecoCardType[]>();
    if (itinerary) {
      itinerary.days.forEach((_, dayIdx) => {
        const signal = computeRecoSignal(
          { ...state, weather: w },
          dayIdx,
          itinerary,
        );
        const dayStops = itinerary.days[dayIdx]?.stops ?? [];
        const recos = deriveRecos(dayStops, signal);
        recosByDayIdx.set(dayIdx, recos);
      });
    }

    const built = buildReelCards(itinerary!, journeyLegs, reelSavedId, w, pName, recosByDayIdx, photoMap);
    return built.filter(c => {
      if (c.type === 'stop') return !removedStopIds.has(c.stop.id);
      if (c.type === 'reco') return !removedStopIds.has(c.afterStopId);
      return true;
    });
  }

  // Full rebuild + image preload — only on structural changes (not weather/personaName)
  useEffect(() => {
    if (!activeItinerary) return;
    setImagesReady(false);
    const filtered = buildFiltered(activeItinerary, weatherRef.current, personaNameRef.current);
    setCards(filtered);

    const srcs: string[] = [];
    for (const c of filtered) {
      if (c.type === 'stop') {
        const url = c.stop.imageUrl ?? (c.stop.photoRef ? getPlacePhotoUrl(c.stop.photoRef, 400) : null);
        if (url) srcs.push(url);
      } else if (c.type === 'intro' && c.imageUrl) {
        srcs.push(c.imageUrl);
      } else if (c.type === 'intel' && c.imageUrl) {
        srcs.push(c.imageUrl);
      }
    }
    preloadImages(srcs).then(() => setImagesReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItinerary, removedStopIds, reelSavedId, journey]);

  // Enrichment-only updates — when weather, personaName, or city photos arrive
  useEffect(() => {
    if (!activeItinerary || cards.length === 0) return;
    setCards(buildFiltered(activeItinerary, weather, personaName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather, personaName]);

  useEffect(() => {
    if (!activeItinerary || cards.length === 0) return;
    setCards(buildFiltered(activeItinerary, weatherRef.current, personaNameRef.current, cityPhotoMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityPhotoMap]);

  // Fetch weather if not already in state (e.g. opening saved trip without going through route screen)
  useEffect(() => {
    if (state.weather) return;
    const cityName = city || activeItinerary?.city || activeItinerary?.cities?.[0];
    if (!cityName) return;
    api.weather(cityName).then(wx => {
      if (wx) dispatch({ type: 'SET_WEATHER', weather: wx });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // Auto-save new itinerary on first view (before user manually saves)
  useEffect(() => {
    if (!activeItinerary || savedItem || saved || autoSavedRef.current) return;
    autoSavedRef.current = true;
    const id = `reel-${Date.now()}`;
    dispatch({
      type: 'SAVE_ITINERARY',
      saved: {
        id,
        city: city || activeItinerary.city || activeItinerary.cities[0] || '',
        date: new Date().toISOString(),
        travelDate: state.travelStartDate,
        cityLat: state.cityGeo?.lat ?? null,
        cityLon: state.cityGeo?.lon ?? null,
        selectedPlaces: state.selectedPlaces,
        itinerary: activeItinerary as any,
        persona: persona ?? { archetype: 'explorer', archetype_name: 'Explorer' } as any,
        lastUpdateCheck: null,
        pendingSwapCards: [],
        journeyLegs: journey ?? null,
        tripDetails: null,
      },
    });
    setSaved(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItinerary]);

  // Scroll-based active card tracking
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || cards.length === 0) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
      setActiveIdx(Math.min(Math.max(idx, 0), cards.length - 1));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [cards.length]);



  const handleCloseTripDetails = useCallback(() => setShowTripDetails(false), []);

  const handleUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (undoPending) setRemovedStopIds(prev => { const s = new Set(prev); s.delete(undoPending.id); return s; });
    setUndoPending(null);
  }, [undoPending]);

  const handleSave = useCallback(() => {
    if (saved || !activeItinerary) return;
    const id = `reel-${Date.now()}`;
    dispatch({
      type: 'SAVE_ITINERARY',
      saved: {
        id,
        city: city || activeItinerary.city || activeItinerary.cities[0] || '',
        date: new Date().toISOString(),
        travelDate: state.travelStartDate,
        cityLat: state.cityGeo?.lat ?? null,
        cityLon: state.cityGeo?.lon ?? null,
        selectedPlaces: state.selectedPlaces,
        itinerary: activeItinerary as any,
        persona: persona!,
        lastUpdateCheck: null,
        pendingSwapCards: [],
        journeyLegs: journey ?? null,
        tripDetails: null,
      },
    });
    setSaved(true);
  }, [saved, activeItinerary, city, dispatch, state, persona]);

  useEffect(() => {
    return () => {
      if (state.recoInteractions.length === 0) return;
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) syncRecoInteractions(user.id, state.recoInteractions as any).catch(console.warn);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeItinerary || !imagesReady || !state.persona) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0c0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span className="ms" style={{ fontSize: 36, color: 'rgba(212,168,83,.6)', animation: 'spin 1s linear infinite' }}>autorenew</span>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', letterSpacing: '.04em' }}>Preparing your trip</p>
      </div>
    );
  }

  const dotCards = cards.filter(c => c.type !== 'reco' && c.type !== 'transit' && c.type !== 'intel' && c.type !== 'summary' && c.type !== 'scenic');
  const activeDotIdx = (() => {
    let last = -1;
    for (let i = 0; i <= activeIdx; i++) {
      const j = dotCards.indexOf(cards[i]);
      if (j !== -1) last = j;
    }
    return last;
  })();

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

      {/* Snap-scroll container */}
      <div
        ref={scrollRef}
        style={{
          width: '100%', height: '100%',
          overflowY: 'scroll', overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
        }}
        className="no-scrollbar"
      >
        {cards.map((card, idx) => {
          const isActive = idx === activeIdx;
          const setRef = (el: HTMLDivElement | null) => { cardRefs.current[idx] = el; };
          let child: ReactNode = null;
          if (card.type === 'intro')       child = <ReelIntroCard    card={card} active={isActive} onShowTripDetails={() => setShowTripDetails(true)} />;
          else if (card.type === 'summary') child = <ReelSummaryCard  card={card} active={isActive} />;
          else if (card.type === 'stop')    child = <ReelStopCard     card={card} active={isActive} weather={weather} />;
          else if (card.type === 'reco')    child = (
            <ReelRecoCard
              card={card} active={isActive}
              archetype={archetype}
              existingPlaceIds={existingPlaceIds}
              onInteract={(action) => {
                const interaction = buildInteraction(
                  card, action, card.id.includes('-conflict'),
                  archetype, state.rawOBAnswers?.pace?.[0] ?? 'moderate', null, 1, state.weather?.condition ?? null,
                );
                dispatch({ type: 'ADD_RECO_INTERACTION', interaction });
              }}
            />
          );
          else if (card.type === 'intel')   child = <ReelIntelCard    card={card} active={isActive} />;
          else if (card.type === 'transit') child = <ReelTransitCard  card={card} active={isActive} />;
          else if (card.type === 'balance') child = <ReelBalanceCard card={card} active={isActive} />;
          else if (card.type === 'scenic') child = <ReelScenicCard card={card} active={isActive} />;
          else if (card.type === 'finale')  child = <ReelFinaleCard   card={card} active={isActive} onSave={handleSave} saved={saved} />;
          else if (card.type === 'day_divider') child = <ReelDayDividerCard card={card} />;
          if (!child) return null;
          const cardKey =
            card.type === 'stop' ? card.stop.id :
            card.type === 'reco' ? card.id :
            card.type === 'intel' ? card.id :
            card.type === 'transit' ? `transit-${card.from}-${card.to}` :
            card.type === 'day_divider' ? `day-${card.day}` :
            card.type === 'scenic' ? `scenic-${card.pos}` :
            card.type;
          return (
            <div key={cardKey} ref={setRef} style={{ height: '100dvh', flexShrink: 0, scrollSnapStop: 'always' }}>
              {child}
            </div>
          );
        })}
      </div>

      {/* Floating back button — top-left, screen layer, back button only */}
      <button
        onClick={() => {
          dispatch({ type: 'SET_REEL_SAVED_ID', id: null });
          dispatch({ type: 'GO_BACK' });
        }}
        style={{
          position: 'fixed', top: 8, left: 16, zIndex: 30,
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span className="ms" style={{ fontSize: 18, color: '#fff' }}>arrow_back</span>
      </button>

      {/* Progress dots */}
      <div style={{
        position: 'fixed', right: 14, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 5, zIndex: 30,
        pointerEvents: 'none',
      }}>
        {dotCards.map((_, i) => (
          <div key={i} style={{
            borderRadius: 99,
            background: i === activeDotIdx ? '#fff' : 'rgba(255,255,255,.3)',
            width: i === activeDotIdx ? 5 : 4,
            height: i === activeDotIdx ? 18 : 4,
            transition: 'all .3s cubic-bezier(.25,0,0,1)',
          }} />
        ))}
      </div>

      {/* Scroll-to-top button — appears after first card */}
      {activeIdx > 0 && (
        <button
          onClick={() => {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            setActiveIdx(0);
          }}
          style={{
            position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)', right: 16,
            width: 38, height: 38, borderRadius: '50%', zIndex: 35,
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            animation: 'fadeUp .3s ease both',
          }}
          aria-label="Back to top"
        >
          <span className="ms" style={{ fontSize: 18, color: 'rgba(255,255,255,.85)' }}>arrow_upward</span>
        </button>
      )}

      {/* Trip details sheet */}
      {showTripDetails && activeItinerary && (
        <TripDetailsSheet
          cities={activeItinerary.cities ?? [activeItinerary.city ?? '']}
          journeyLegs={savedItem?.journeyLegs ?? journey ?? null}
          existingDetails={savedItem?.tripDetails ?? state.pendingTripDetails ?? null}
          onSave={(details) => {
            dispatch({ type: 'SET_PENDING_TRIP_DETAILS', details });
            setShowTripDetails(false);
          }}
          onClose={handleCloseTripDetails}
        />
      )}

      {/* Undo toast */}
      {undoPending && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--color-surface)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--color-border)',
          padding: '12px 18px', borderRadius: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          zIndex: 40, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
            <strong style={{ color: 'var(--color-text-1)' }}>{undoPending.label}</strong> removed
          </span>
          <button
            onClick={handleUndo}
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-text)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
