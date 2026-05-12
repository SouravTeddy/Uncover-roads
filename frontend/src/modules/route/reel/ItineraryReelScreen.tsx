import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../../shared/store';
import { buildReelCards } from './reel-builder';
import { ReelIntroCard } from './ReelIntroCard';
import { ReelStopCard } from './ReelStopCard';
import { ReelRecoCard } from './ReelRecoCard';
import { ReelTransitCard } from './ReelTransitCard';
import { ReelFinaleCard } from './ReelFinaleCard';
import type { ReelCard } from './types';

const UNDO_DURATION = 3500;

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

  const [cards, setCards] = useState<ReelCard[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [removedStopIds, setRemovedStopIds] = useState<Set<string>>(new Set());
  const [undoPending, setUndoPending] = useState<{ id: string; label: string } | null>(null);
  const [saved, setSaved] = useState(!!savedItem);
  const scrollRef = useRef<HTMLDivElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeItinerary) return;
    const built = buildReelCards(activeItinerary, journey ?? null, reelSavedId, weather, personaName);
    const filtered = built.filter(c => {
      if (c.type === 'stop') return !removedStopIds.has(c.stop.id);
      if (c.type === 'reco') return !removedStopIds.has(c.afterStopId);
      return true;
    });
    setCards(filtered);
  }, [activeItinerary, journey, weather, personaName, removedStopIds, reelSavedId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const idx = Math.round(el.scrollTop / window.innerHeight);
      setActiveIdx(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleRemove = useCallback((stopId: string) => {
    const stopCard = cards.find(c => c.type === 'stop' && c.stop.id === stopId);
    const label = stopCard?.type === 'stop' ? stopCard.stop.title : 'Stop';

    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoPending({ id: stopId, label });
    setRemovedStopIds(prev => new Set([...prev, stopId]));

    undoTimer.current = setTimeout(() => {
      setUndoPending(null);
      dispatch({ type: 'SET_SELECTED_PLACES', places: state.selectedPlaces.filter(p => p.id !== stopId) });
      dispatch({ type: 'INCREMENT_GENERATION_COUNT' });
      dispatch({ type: 'SET_ENGINE_ITINERARY', itinerary: null });
    }, UNDO_DURATION);
  }, [cards, dispatch, state.selectedPlaces]);

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
        city: city || activeItinerary.city,
        date: new Date().toISOString(),
        travelDate: state.travelStartDate,
        cityLat: state.cityGeo?.lat ?? null,
        cityLon: state.cityGeo?.lon ?? null,
        selectedPlaces: state.selectedPlaces,
        itinerary: activeItinerary as any,
        persona: persona!,
        lastUpdateCheck: null,
        pendingSwapCards: [],
      },
    });
    setSaved(true);
  }, [saved, activeItinerary, city, dispatch, state, persona]);

  if (!activeItinerary) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0c0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="ms" style={{ fontSize: 32, color: 'rgba(255,255,255,.2)', animation: 'spin 1s linear infinite' }}>autorenew</span>
      </div>
    );
  }

  const dotCards = cards.filter(c => c.type !== 'reco' && c.type !== 'transit');
  const activeDotIdx = dotCards.indexOf(cards[activeIdx]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

      {/* Snap-scroll container */}
      <div
        ref={scrollRef}
        style={{
          width: '100%', height: '100%',
          overflowY: 'scroll', overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          scrollBehavior: 'smooth',
        }}
        className="no-scrollbar"
      >
        {cards.map((card, idx) => {
          const isActive = idx === activeIdx;
          if (card.type === 'intro')   return <ReelIntroCard   key={idx}                              card={card} active={isActive} />;
          if (card.type === 'stop')    return <ReelStopCard    key={card.stop.id}                     card={card} active={isActive} onRemove={handleRemove} />;
          if (card.type === 'reco')    return <ReelRecoCard    key={`reco-${card.afterStopId}`}       card={card} active={isActive} />;
          if (card.type === 'transit') return <ReelTransitCard key={`transit-${card.from}-${card.to}`} card={card} active={isActive} />;
          if (card.type === 'finale')  return <ReelFinaleCard  key="finale"                           card={card} active={isActive} onSave={handleSave} saved={saved} />;
          return null;
        })}
      </div>

      {/* Floating header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        paddingTop: 48, paddingLeft: 16, paddingRight: 16, paddingBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(0,0,0,.52), transparent)',
        pointerEvents: 'none',
      }}>
        <button
          onClick={() => {
            dispatch({ type: 'SET_REEL_SAVED_ID', id: null });
            dispatch({ type: 'GO_TO', screen: reelSavedId ? 'trips' : 'route' });
          }}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', pointerEvents: 'all',
          }}
        >
          <span className="ms" style={{ fontSize: 18, color: '#fff' }}>arrow_back</span>
        </button>

        {weather && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            background: 'rgba(18,18,22,.75)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(242,237,230,.07)',
            pointerEvents: 'none',
          }}>
            <span className="ms fill" style={{ fontSize: 14, color: '#4a7fa0' }}>{weather.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{weather.temp}°</span>
          </div>
        )}
      </div>

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

      {/* Undo toast */}
      {undoPending && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(18,18,22,.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(242,237,230,.07)',
          padding: '12px 18px', borderRadius: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          zIndex: 40, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
            <strong style={{ color: '#fff' }}>{undoPending.label}</strong> removed
          </span>
          <button
            onClick={handleUndo}
            style={{ fontSize: 13, fontWeight: 700, color: '#d4a853', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
