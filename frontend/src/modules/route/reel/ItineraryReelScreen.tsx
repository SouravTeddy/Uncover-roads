import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAppStore } from '../../../shared/store';
import { buildReelCards } from './reel-builder';
import { ReelIntroCard } from './ReelIntroCard';
import { ReelStopCard } from './ReelStopCard';
import { ReelRecoCard } from './ReelRecoCard';
import { ReelIntelCard } from './ReelIntelCard';
import { ReelTransitCard } from './ReelTransitCard';
import { ReelFinaleCard } from './ReelFinaleCard';
import { ReelDayDividerCard } from './ReelDayDividerCard';
import { ReelDayTransitionCard } from './ReelDayTransitionCard';
import type { ReelCard, ReelRecoCard as ReelRecoCardType, ReelStopCard as ReelStopCardType } from './types';
import type { WeatherData, TripDetails } from '../../../shared/types';
import { api, getPlacePhotoUrl } from '../../../shared/api';
import { useCityPhotoBatch } from '../../destination/useCityPhoto';
import { ReelBalanceCard } from './ReelBalanceCard';
import ReelScenicCard from './ReelScenicCard';
import { ReelGroupCard } from './ReelGroupCard';
import { ReelDayIntelCard } from './ReelDayIntelCard';
import { ReelGrowthCard } from './ReelGrowthCard';
import { computeRecoSignal, deriveRecos, buildInteraction } from '../reco-engine';
import { syncRecoInteractions } from '../../../shared/userSync';
import { supabase } from '../../../shared/supabase';
import { TripDetailsSheet } from './TripDetailsSheet';
import { enrichScenicCardsWithTransit } from './transit-enrichment';



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
    journey, weather, persona, personaProfile, city, cityCountries,
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

  const existingPlaceIds = [
    ...state.selectedPlaces.map(p => p.place_id ?? p.id),
    ...(activeItinerary?.days?.flatMap(d => d.stops.map(s => s.placeId).filter(Boolean)) ?? []),
  ];

  const [weatherByCity, setWeatherByCity] = useState<Map<string, WeatherData>>(new Map());
  const [cards, setCards] = useState<ReelCard[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [removedStopIds, setRemovedStopIds] = useState<Set<string>>(new Set());
  const [undoPending, setUndoPending] = useState<{ id: string; label: string } | null>(null);
  const [saved, setSaved] = useState(!!savedItem);
  const [imagesReady, setImagesReady] = useState(false);
  // stop title → resolved image URL (for stops that had no photoRef at build time)
  const [resolvedStopImages, setResolvedStopImages] = useState<Map<string, string>>(new Map());
  const [loadingStep, setLoadingStep] = useState<0 | 1>(0);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [tripDetailsSavedToast, setTripDetailsSavedToast] = useState(false);
  // Session-scoped strikeout: stops that were just adjusted by a trip-details save this session
  const [recentlyAdjustedIds, setRecentlyAdjustedIds] = useState<Set<string>>(new Set());
  const [rebuildingReel, setRebuildingReel] = useState(false);
  const [arrowVisible, setArrowVisible] = useState(false);
  const arrowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSavedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weatherByCityRef = useRef(weatherByCity);
  const personaNameRef = useRef(personaName);
  const tripDetailsRef = useRef<TripDetails | null>(savedItem?.tripDetails ?? state.pendingTripDetails ?? null);

  useEffect(() => { weatherByCityRef.current = weatherByCity; }, [weatherByCity]);
  useEffect(() => { personaNameRef.current = personaName; }, [personaName]);
  useEffect(() => { tripDetailsRef.current = savedItem?.tripDetails ?? state.pendingTripDetails ?? null; }, [savedItem?.tripDetails, state.pendingTripDetails]);

  function buildFiltered(
    itinerary: typeof activeItinerary,
    wxByCity: Map<string, WeatherData>,
    pName: string,
    photoMap = cityPhotoMap,
    stopImages = resolvedStopImages,
  ) {
    const journeyLegs = savedItem ? (savedItem.journeyLegs ?? null) : (journey ?? null);

    const recosByDayIdx = new Map<number, ReelRecoCardType[]>();
    if (itinerary) {
      (itinerary.days ?? []).forEach((day, dayIdx) => {
        const cityWeather = wxByCity.get(day.city.toLowerCase()) ?? null;
        const signal = computeRecoSignal(
          { ...state, weather: cityWeather },
          dayIdx,
          itinerary,
        );
        const dayStops = itinerary.days[dayIdx]?.stops ?? [];
        const recos = deriveRecos(dayStops, signal);
        recosByDayIdx.set(dayIdx, recos);
      });
    }

    const built = buildReelCards(itinerary!, journeyLegs, reelSavedId, wxByCity, pName, recosByDayIdx, photoMap, cityCountries, tripDetailsRef.current, state.rawOBAnswers?.group ?? 'solo');

    // Inject pre-fetched images for stops that had no photoRef at build time
    for (const card of built) {
      if (card.type === 'stop' && !card.stop.imageUrl && !card.stop.photoRef) {
        const url = stopImages.get(card.stop.title);
        if (url) card.stop.imageUrl = url;
      }
    }

    return built.filter(c => {
      if (c.type === 'stop') return !removedStopIds.has(c.stop.id);
      if (c.type === 'reco') return !removedStopIds.has(c.afterStopId);
      return true;
    });
  }

  // Full rebuild + image preload — fetches ALL missing stop images before showing the reel
  useEffect(() => {
    if (!activeItinerary) return;
    setImagesReady(false);
    setLoadingStep(0);
    let cancelled = false;

    const FETCH_TIMEOUT_MS = 10_000;

    (async () => {
      const primaryCity = activeItinerary.city ?? activeItinerary.cities?.[0] ?? '';
      const allCities = [
        ...new Set([
          ...(activeItinerary.cities ?? []),
          ...(activeItinerary.days ?? []).map(d => d.city),
          primaryCity,
        ].filter(Boolean) as string[]),
      ];

      // Collect all stops that have no image yet
      const stopsNeedingImages = (activeItinerary.days ?? []).flatMap(d =>
        (d.stops ?? [])
          .filter(s => !s.imageUrl)
          .map(s => ({ stop: s, city: s.city ?? d.city ?? primaryCity }))
      );

      // Fetch city photos + all missing stop images in parallel, race against timeout
      const raceTimeout = new Promise<never>(resolve =>
        setTimeout(() => resolve(undefined as never), FETCH_TIMEOUT_MS)
      );

      const [cityPhotosRaw, ...stopImageResults] = await Promise.all([
        Promise.race([api.cityPhotos(allCities), raceTimeout.then(() => ({} as Record<string, string | null>))]),
        ...stopsNeedingImages.map(({ stop, city }) =>
          Promise.race([
            api.placeImage(stop.title, city).then(url => ({ title: stop.title, url })),
            raceTimeout.then(() => ({ title: stop.title, url: null as string | null })),
          ])
        ),
      ]);

      if (cancelled) return;

      // Build city photo map: Google proxy paths from DB only
      const apiBase = import.meta.env.VITE_API_URL ?? '';
      const builtCityPhotoMap = new Map<string, string | null>();
      for (const c of allCities) {
        const key = c.toLowerCase();
        const dbUrl = (cityPhotosRaw as Record<string, string | null>)[c]
          ?? (cityPhotosRaw as Record<string, string | null>)[key]
          ?? null;
        const resolved = dbUrl?.startsWith('/place-photo') ? `${apiBase}${dbUrl}`
          : dbUrl?.startsWith('http') ? dbUrl
          : null;
        builtCityPhotoMap.set(key, resolved);
      }

      // Store resolved stop images so enrichment rebuilds keep them
      const newStopImages = new Map<string, string>();
      for (const r of stopImageResults as Array<{ title: string; url: string | null }>) {
        if (r.url) newStopImages.set(r.title, r.url);
      }
      setResolvedStopImages(newStopImages);

      // Build cards with all resolved images
      setLoadingStep(1);
      const filtered = buildFiltered(
        activeItinerary,
        weatherByCityRef.current,
        personaNameRef.current,
        builtCityPhotoMap,
        newStopImages,
      );
      setCards(filtered);

      // Async transit enrichment — fires in background, updates scenic cards
      // when transit data arrives without blocking the reel from showing
      enrichScenicCardsWithTransit(filtered, apiBase).then(enriched => {
        if (!cancelled) setCards(enriched);
      }).catch(() => { /* transit enrichment is best-effort */ });

      // Preload every image URL into the browser cache before revealing the reel
      const srcs: string[] = [];
      for (const c of filtered) {
        if (c.type === 'stop') {
          const url = c.stop.imageUrl ?? (c.stop.photoRef ? getPlacePhotoUrl(c.stop.photoRef, 800, 1200) : null);
          if (url) srcs.push(url);
        } else if (c.type === 'intro' && c.imageUrl) {
          srcs.push(c.imageUrl);
        } else if (c.type === 'intel' && c.imageUrl) {
          srcs.push(c.imageUrl);
        } else if (c.type === 'reco' && c.anchorPhotoUrl) {
          srcs.push(c.anchorPhotoUrl);
        } else if (c.type === 'scenic') {
          if (c.originPhotoUrl) srcs.push(c.originPhotoUrl);
          if (c.destPhotoUrl) srcs.push(c.destPhotoUrl);
        }
      }

      await Promise.race([preloadImages(srcs), raceTimeout.catch(() => {})]);

      if (!cancelled) setImagesReady(true);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItinerary, removedStopIds, reelSavedId, journey]);

  // Enrichment-only updates — when weatherByCity, personaName, or city photos arrive
  useEffect(() => {
    if (!activeItinerary || cards.length === 0) return;
    setCards(buildFiltered(activeItinerary, weatherByCity, personaName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherByCity, personaName]);

  useEffect(() => {
    if (!activeItinerary || cards.length === 0) return;
    setCards(buildFiltered(activeItinerary, weatherByCityRef.current, personaNameRef.current, cityPhotoMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityPhotoMap]);

  // Fetch weather for all unique cities in the itinerary
  useEffect(() => {
    if (!activeItinerary) return;
    const cities = [
      ...new Set([
        ...(activeItinerary.cities ?? []),
        activeItinerary.city,
      ].filter(Boolean) as string[])
    ];

    cities.forEach(c => {
      api.weather(c).then(wx => {
        if (wx && wx.condition && wx.temp != null) {
          setWeatherByCity(prev => new Map(prev).set(c.toLowerCase(), wx));
          // Also keep global weather state for the primary city
          if (c === (activeItinerary.city ?? cities[0])) {
            dispatch({ type: 'SET_WEATHER', weather: wx });
          }
        }
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, activeItinerary?.id]);

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
  // NOTE: imagesReady is in the deps because the scroll container only mounts after
  // imagesReady=true. Without it, scrollRef.current is null when cards.length first
  // becomes non-zero, so the listener never gets registered and activeIdx stays 0.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || cards.length === 0) return;
    const update = () => {
      const idx = Math.round(el.scrollTop / el.clientHeight);
      setActiveIdx(Math.min(Math.max(idx, 0), cards.length - 1));
    };
    // RAF-debounce collapses many scroll events per frame into one update,
    // preventing mid-snap re-renders that can cause iOS scroll-snap to get stuck
    let rafId = 0;
    const handleScroll = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(update); };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { el.removeEventListener('scroll', handleScroll); cancelAnimationFrame(rafId); };
  }, [cards.length, imagesReady]);



  // Show the scroll-to-top arrow for 1 s whenever the active card changes, then fade it out
  useEffect(() => {
    if (activeIdx === 0) { setArrowVisible(false); return; }
    setArrowVisible(true);
    if (arrowTimer.current) clearTimeout(arrowTimer.current);
    arrowTimer.current = setTimeout(() => setArrowVisible(false), 1000);
    return () => { if (arrowTimer.current) clearTimeout(arrowTimer.current); };
  }, [activeIdx]);

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
    const stopCount = activeItinerary?.days?.flatMap(d => d.stops ?? []).length ?? 0;
    const days = activeItinerary?.days?.length ?? 0;
    const cityName = activeItinerary?.city ?? activeItinerary?.cities?.[0] ?? '';

    const STEPS: { label: string; done: boolean }[] = [
      { label: 'Itinerary built',      done: !!activeItinerary },
      { label: 'Gathering photos',     done: loadingStep >= 1 },
      { label: 'Preparing your reel',  done: imagesReady },
    ];
    const activeStep = STEPS.findIndex(s => !s.done);

    // Collect photo URLs for the mosaic: stop photos first, city photos as supplement
    const mosaicSrcs: string[] = [];
    for (const day of activeItinerary?.days ?? []) {
      for (const stop of day.stops ?? []) {
        if (stop.imageUrl && !mosaicSrcs.includes(stop.imageUrl)) {
          mosaicSrcs.push(stop.imageUrl);
          if (mosaicSrcs.length >= 9) break;
        }
      }
      if (mosaicSrcs.length >= 9) break;
    }
    for (const [, url] of cityPhotoMap) {
      if (url && !mosaicSrcs.includes(url)) {
        mosaicSrcs.push(url);
        if (mosaicSrcs.length >= 9) break;
      }
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* Photo mosaic background */}
        {mosaicSrcs.length > 0 && (
          <div style={{ position: 'absolute', inset: '-12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 3, filter: 'blur(14px) saturate(0.6)', overflow: 'hidden' }}>
            {Array.from({ length: 9 }, (_, i) => {
              const src = mosaicSrcs[i % mosaicSrcs.length];
              const isAlt = i % 2 === 1;
              return (
                <img
                  key={i}
                  src={src}
                  alt=""
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    animation: `${isAlt ? 'kenBurns2' : 'kenBurns'} ${18 + (i % 3) * 4}s ease-in-out infinite alternate`,
                  }}
                />
              );
            })}
          </div>
        )}
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: mosaicSrcs.length > 0 ? 'rgba(10,8,6,0.72)' : 'transparent', pointerEvents: 'none' }} />
        {/* Colour accents on top */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 55% at 50% 30%, rgba(212,168,83,.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 80% 80%, rgba(79,143,171,.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 40% 30% at 15% 70%, rgba(212,168,83,.04) 0%, transparent 55%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '0 40px', width: '100%', maxWidth: 340 }}>

          {/* Heading */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 600, color: 'var(--color-text-1)', margin: 0, lineHeight: 1.1, letterSpacing: '-.01em' }}>
              Your itinerary<br />is almost ready
            </p>
            {cityName && days > 0 && (
              <p style={{ fontSize: 12, color: 'var(--color-text-4)', margin: '10px 0 0', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {cityName} · {days} day{days !== 1 ? 's' : ''} · {stopCount} stop{stopCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isDone = step.done;
              return (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Icon */}
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? 'var(--color-primary-bg)' : isActive ? 'var(--color-surface)' : 'transparent',
                    border: isDone ? '1px solid var(--color-primary-glow)' : isActive ? '1px solid var(--color-border-m)' : '1px solid var(--color-border)',
                    transition: 'all .4s ease',
                  }}>
                    {isDone
                      ? <span className="ms" style={{ fontSize: 13, color: 'var(--color-primary)' }}>check</span>
                      : isActive
                      ? <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', animation: 'spin 1s linear infinite' }}>autorenew</span>
                      : null
                    }
                  </div>
                  {/* Label */}
                  <span style={{
                    fontSize: 14,
                    color: isDone ? 'var(--color-text-3)' : isActive ? 'var(--color-text-1)' : 'var(--color-text-4)',
                    fontWeight: isActive ? 500 : 400,
                    transition: 'color .4s ease',
                  }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Thin progress bar */}
          <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: imagesReady ? '100%' : loadingStep >= 1 ? '66%' : activeItinerary ? '33%' : '5%',
              background: 'linear-gradient(90deg, rgba(212,168,83,.5), rgba(212,168,83,.9))',
              borderRadius: 99,
              transition: 'width .6s cubic-bezier(.25,0,0,1)',
            }} />
          </div>
        </div>
      </div>
    );
  }

  function fmtMinutes(mins: number): string {
    if (mins < 60)  return `${mins} min`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)} day${Math.round(mins / 1440) !== 1 ? 's' : ''}`;
  }

  const travelGroup = state.rawOBAnswers?.group ?? 'solo';

  // Build displayCards: collect scenic/reco/intel cards between stops into group trays
  const displayCards: ReelCard[] = (() => {
    const TRIGGER_META: Record<string, { label: string; icon: string; color: string }> = {
      lunch:             { label: 'Lunch window',    icon: 'restaurant',      color: '#c27c4a' },
      dinner:            { label: 'Dinner window',   icon: 'dinner_dining',   color: '#7c6f9f' },
      evening:           { label: 'Evening',         icon: 'nightlight',      color: '#7c6f9f' },
      culture:           { label: 'Culture',         icon: 'museum',          color: '#8b9e6a' },
      rest:              { label: 'Rest break',      icon: 'local_cafe',      color: '#d4a853' },
      hidden_gem:        { label: 'Hidden gem',      icon: 'auto_awesome',    color: '#8b9e6a' },
      category_diversity:{ label: 'Variety',         icon: 'grid_view',       color: '#8b9e6a' },
      social_gap:        { label: 'Social',          icon: 'people',          color: '#4f8fab' },
      density_sparse:    { label: 'Room to add',     icon: 'explore',         color: '#8b9e6a' },
    };

    // Contextual fallback images — used when no real place photo is available.
    // Selected by trigger type and travel group so they feel intentional, not generic.
    const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=600&q=75`;
    const CONTEXTUAL_IMAGES: Record<string, Record<string, string>> = {
      dinner: {
        couple:  u('1414235077428-338989a2e8c0'), // intimate candlelit table for two
        family:  u('1555396273-367ea4eb4db5'),    // warm family restaurant scene
        friends: u('1556909114-44e3e70034e2'),    // lively group dinner
        solo:    u('1467003909585-2f8a72700288'), // solo dining, counter seat
      },
      lunch: {
        couple:  u('1528605248644-14dd04022da1'), // bright bistro table
        family:  u('1565557623262-b51206a682c8'), // casual family lunch
        friends: u('1529543544282-ea669407fca3'), // group brunch
        solo:    u('1498837167922-ddd27525d352'), // clean solo lunch setup
      },
      evening: {
        couple:  u('1516450360452-9312f5e86fc7'), // couple at rooftop bar
        family:  u('1555992336-03a23c7b20ee'),    // family evening outing
        friends: u('1543007630-9359431a5d87'),    // friends at a bar
        solo:    u('1514362545857-3bc16c4c7d1b'), // solo evening drinks
      },
      culture: {
        _any:    u('1530305408560-82d13781b33a'), // museum interior gallery
      },
      rest: {
        _any:    u('1501339847302-ac426a4a7cbb'), // cosy café corner
      },
      hidden_gem: {
        _any:    u('1550159930-40066082a4fc'),    // narrow atmospheric alley
      },
      walking_gap: {
        _any:    u('1477959858617-67f85cf4f1df'), // city walk street scene
      },
      social_gap: {
        couple:  u('1516450360452-9312f5e86fc7'),
        friends: u('1543007630-9359431a5d87'),
        family:  u('1555992336-03a23c7b20ee'),
        solo:    u('1501339847302-ac426a4a7cbb'),
      },
      _default: {
        _any:    u('1476514525535-07fb3b4ae5f1'), // open street exploration
      },
    };

    function contextualImg(trigger: string): string {
      const map = CONTEXTUAL_IMAGES[trigger] ?? CONTEXTUAL_IMAGES['_default'];
      return map[travelGroup] ?? map['_any'] ?? CONTEXTUAL_IMAGES['_default']['_any']!;
    }

    const result: ReelCard[] = [];
    let lastStopTitle  = '';
    let lastStopArea   = '';
    let nextStopTitle  = '';
    let nextStopArea   = '';
    let miniCards: import('./types').ReelGroupMiniCard[] = [];
    let usedImgUrls: Set<string> = new Set();
    let groupAnchorLat: number | null = null;
    let groupAnchorLon: number | null = null;

    function claimImg(url: string | null | undefined, fallback: string): string {
      if (!url) return fallback;
      if (usedImgUrls.has(url)) return fallback;
      usedImgUrls.add(url);
      return url;
    }

    function flushGroup() {
      if (miniCards.length > 0 && lastStopTitle) {
        result.push({
          type: 'group',
          fromStop: lastStopTitle, fromArea: lastStopArea,
          toStop: nextStopTitle, toArea: nextStopArea,
          cards: miniCards,
          anchorLat: groupAnchorLat ?? undefined,
          anchorLon: groupAnchorLon ?? undefined,
        });
        miniCards = [];
        usedImgUrls = new Set();
        groupAnchorLat = null;
        groupAnchorLon = null;
      }
    }

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];

      if (card.type === 'stop') {
        nextStopTitle = card.stop.title;
        nextStopArea  = card.stop.area ?? '';
        flushGroup();
        lastStopTitle = card.stop.title;
        lastStopArea  = card.stop.area ?? '';
        result.push(card);

      } else if (card.type === 'scenic') {
        flushGroup();
        result.push(card);

      } else if (card.type === 'reco') {
        const meta = TRIGGER_META[card.trigger] ?? { label: 'Nearby', icon: 'explore', color: '#d4a853' };
        const recoImg = claimImg(card.anchorPhotoUrl, contextualImg(card.trigger));
        // Capture first reco's coordinates as the group's map anchor
        if (!groupAnchorLat && card.stopLat) { groupAnchorLat = card.stopLat; groupAnchorLon = card.stopLon ?? null; }
        miniCards.push({
          type: 'reco',
          title: meta.label,
          imageUrl: recoImg,
          name: card.label,
          data: card.consequence || '',
          footer: `Near ${card.nearbyCity}`,
          icon: meta.icon,
          accent: meta.color,
        });

      } else if (card.type === 'intel') {
        // EXCLUDE transit-decision intel cards — these say "taking transit because distance > X km"
        // which directly contradicts walk/scenic cards in the same group and confuses the user.
        // Transit decisions are engine mechanics, not user-facing recommendations.
        const isTransitDecision =
          (card.messageType === 'insert' || card.messageType === 'transit') &&
          (
            (card.headline ?? '').toLowerCase().includes('transit') ||
            (card.detail ?? '').toLowerCase().includes('walking range') ||
            (card.detail ?? '').toLowerCase().includes('exceeds')
          );
        if (isTransitDecision) {
          // skip — engine transit decisions don't belong in the group tray
        } else if (card.messageType === 'insert' && !card.imageUrl) {
          // Insert with no image — engine added a place (coffee, rest, etc.)
          const rawDetail = card.detail ?? '';
          const cleanedDetail = rawDetail.includes(' · ') ? rawDetail.split(' · ').slice(1).join(' · ') : rawDetail;
          const footer = cleanedDetail.replace(/(\d+)\s+minutes?/g, (_m, n) => fmtMinutes(Number(n)));
          miniCards.push({
            type: 'activity',
            title: 'Added for you',
            imageUrl: null,
            name: card.headline,
            data: '',
            footer: footer || 'Added to your itinerary',
            icon: 'auto_awesome',
            accent: '#d4a853',
          });
        } else if (card.messageType === 'weather' || card.messageType === 'culture' || card.messageType === 'evening') {
          // Context cards — genuinely useful for the user
          const typeLabel = card.messageType === 'weather' ? 'Weather' : card.messageType === 'culture' ? 'Culture' : 'Evening';
          const typeIcon  = card.messageType === 'weather' ? 'wb_cloudy' : card.messageType === 'culture' ? 'museum' : 'nightlight';
          miniCards.push({
            type: 'activity',
            title: typeLabel,
            imageUrl: claimImg(card.imageUrl, contextualImg(card.messageType)),
            name: card.headline,
            data: '',
            footer: card.detail ?? '',
            icon: typeIcon,
            accent: '#4f8fab',
          });
        }
        // swap, resequence, advisory — pure engine mechanics, skip silently

      } else {
        // intro, finale, day_divider, transit, balance — flush and keep in vertical feed
        flushGroup();
        result.push(card);
      }
    }
    flushGroup();
    return result;
  })();

  // Old-format saved trips (flat itinerary, no days) produce zero cards
  if (displayCards.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0c0e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 44, lineHeight: 1 }}>🗺️</span>
        <div>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: '0 0 8px', lineHeight: 1.2 }}>
            Reel not available
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.38)', lineHeight: 1.5, margin: 0 }}>
            This trip was saved in an older format and can't be replayed as a reel.
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'trips' })}
          style={{ marginTop: 8, padding: '12px 28px', borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Back to trips
        </button>
      </div>
    );
  }

  const dotCards = displayCards.filter(c => c.type !== 'reco' && c.type !== 'transit' && c.type !== 'intel' && c.type !== 'scenic' && c.type !== 'group' && c.type !== 'day_transition');
  const activeDotIdx = (() => {
    let last = -1;
    for (let i = 0; i <= activeIdx; i++) {
      const j = (dotCards as typeof displayCards).indexOf(displayCards[i]);
      if (j !== -1) last = j;
    }
    return last;
  })();

  return (
    <>
      {/* Reel rebuild overlay — shown for ~600ms after trip details saved */}
      {rebuildingReel && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(10,10,12,0.82)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
          animation: 'fadeIn .2s ease both',
        }}>
          <style>{`
            @keyframes reelSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid rgba(212,168,83,0.18)',
            borderTopColor: '#d4a853',
            animation: 'reelSpin .9s linear infinite',
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,235,180,.75)', fontFamily: 'var(--font-sans)', letterSpacing: '.02em' }}>
            Updating your reel…
          </span>
        </div>
      )}

      {/* Snap-scroll container — position:fixed so nothing clips its scroll events */}
      <div
        ref={scrollRef}
        style={{
          position: 'fixed', inset: 0,
          overflowY: 'scroll', overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          touchAction: 'pan-y',
          overscrollBehavior: 'none',
          background: 'var(--color-bg)',
        }}
        className="no-scrollbar"
      >
        {displayCards.map((card, idx) => {
          const isActive = idx === activeIdx;
          const setRef = (el: HTMLDivElement | null) => { cardRefs.current[idx] = el; };
          let child: ReactNode = null;
          if (card.type === 'intro') {
            const tripDets = savedItem?.tripDetails ?? state.pendingTripDetails;
            const tripStart = tripDets?.arrivalDate ?? state.travelStartDate ?? null;
            const tripEnd   = tripDets?.departureDate ?? state.travelEndDate ?? null;
            const firstDay = activeItinerary?.days?.[0]?.date ?? null;
            const lastDay  = activeItinerary?.days?.at(-1)?.date ?? null;
            let tripTimingNote: string | null = null;
            if (tripDets?.arrivalDate && firstDay) {
              if (tripDets.arrivalDate < firstDay) {
                const d = new Date(tripDets.arrivalDate + 'T12:00:00');
                const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                tripTimingNote = `Arriving ${label} — a day ahead of the plan. Time to find your footing.`;
              } else if (tripDets.arrivalDate > firstDay) {
                const d = new Date(tripDets.arrivalDate + 'T12:00:00');
                const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                tripTimingNote = `Arriving ${label} — some of Day 1 runs before you get in.`;
              }
            }
            if (!tripTimingNote && tripDets?.departureDate && lastDay) {
              if (tripDets.departureDate > lastDay) {
                const d = new Date(tripDets.departureDate + 'T12:00:00');
                const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                tripTimingNote = `Departing ${label} — a day after the plan ends. Extra time to linger.`;
              } else if (tripDets.departureDate < lastDay) {
                const d = new Date(tripDets.departureDate + 'T12:00:00');
                const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                tripTimingNote = `Leaving ${label} — before the last day of the plan.`;
              }
            }
            child = <ReelIntroCard card={card} active={isActive} onShowTripDetails={() => setShowTripDetails(true)} tripStartDate={tripStart} tripEndDate={tripEnd} tripTimingNote={tripTimingNote} />;
          }
          else if (card.type === 'stop') {
            const isJustAdjusted = recentlyAdjustedIds.has((card as ReelStopCardType).stop.id);
            child = <ReelStopCard
              card={card} active={isActive} weather={weather}
              primaryCity={city || activeItinerary?.city || ''}
              isJustAdjusted={isJustAdjusted}
              onExplore={() => {
                const { lat, lon } = (card as ReelStopCardType).stop;
                dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: [lat - 0.03, lat + 0.03, lon - 0.03, lon + 0.03] } });
                dispatch({ type: 'GO_TO', screen: 'map' });
              }}
              onRemove={() => {
                const stop = (card as ReelStopCardType).stop;
                if (undoTimer.current) clearTimeout(undoTimer.current);
                setRemovedStopIds(prev => new Set([...prev, stop.id]));
                setUndoPending({ id: stop.id, label: stop.title });
                undoTimer.current = setTimeout(() => setUndoPending(null), 4000);
              }}
            />;
          }
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
              onMapNavigate={(lat, lon, places) => {
                if (places.length > 0) dispatch({ type: 'SET_RECO_FOCUS_PLACES', places });
                dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05] } });
                dispatch({ type: 'SET_FILTER', filter: 'curated' });
                dispatch({ type: 'GO_TO', screen: 'map' });
              }}
            />
          );
          else if (card.type === 'intel')   child = <ReelIntelCard    card={card} active={isActive} />;
          else if (card.type === 'transit') child = <ReelTransitCard  card={card} active={isActive} />;
          else if (card.type === 'balance') child = <ReelBalanceCard card={card} active={isActive} />;
          else if (card.type === 'growth') child = (
            <ReelGrowthCard
              card={card}
              active={isActive}
              onBrowse={() => {
                dispatch({ type: 'SET_CITY_GEO', geo: { lat: card.lastLat, lon: card.lastLon, bbox: [card.lastLat - 0.05, card.lastLat + 0.05, card.lastLon - 0.05, card.lastLon + 0.05] } });
                dispatch({ type: 'GO_TO', screen: 'map' });
              }}
            />
          );
          else if (card.type === 'group')   child = (
            <ReelGroupCard
              card={card}
              active={isActive}
              onMapNavigate={(lat, lon) => {
                dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: [lat, lat, lon, lon] } });
                dispatch({ type: 'GO_TO', screen: 'map' });
              }}
            />
          );
          else if (card.type === 'scenic') child = <ReelScenicCard card={card} active={isActive} />;
          else if (card.type === 'finale')  child = <ReelFinaleCard   card={card} active={isActive} onSave={handleSave} saved={saved} />;
          else if (card.type === 'day_divider') child = <ReelDayDividerCard card={card} />;
          else if (card.type === 'day_transition') child = <ReelDayTransitionCard card={card} active={isActive} />;
          else if (card.type === 'day_intel') child = (
            <ReelDayIntelCard
              card={card}
              active={isActive}
              selectedPlaces={state.selectedPlaces}
              onInteract={(action) => {
                if (action === 'tapped') dispatch({ type: 'ADD_RECO_INTERACTION', interaction: { cardId: card.id, action: 'tapped', timestamp: Date.now() } as any });
              }}
              onMapNavigate={(lat, lon, places) => {
                if (places.length > 0) dispatch({ type: 'SET_RECO_FOCUS_PLACES', places });
                dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05] } });
                dispatch({ type: 'SET_FILTER', filter: 'curated' });
                dispatch({ type: 'GO_TO', screen: 'map' });
              }}
            />
          );
          if (!child) return null;
          const cardKey =
            card.type === 'stop' ? card.stop.id :
            card.type === 'reco' ? card.id :
            card.type === 'intel' ? card.id :
            card.type === 'transit' ? `transit-${card.from}-${card.to}` :
            card.type === 'day_divider' ? `day-${card.day}` :
            card.type === 'day_transition' ? `transition-${card.prevDay}-${card.nextDay}` :
            card.type === 'day_intel' ? card.id :
            card.type === 'scenic' ? `scenic-${idx}-${card.pos}` :
            card.type === 'group' ? `group-${idx}-${card.fromStop}` :
            card.type === 'growth' ? 'growth-card' :
            `${card.type}-${idx}`;
          return (
            <div key={cardKey} ref={setRef} style={{ height: '100dvh', flexShrink: 0, scrollSnapStop: 'always', scrollSnapAlign: 'start' }}>
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

      {/* Scroll-to-top button — flashes for 1 s after each card change, then fades */}
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
            opacity: arrowVisible ? 1 : 0,
            transition: 'opacity .4s ease',
            pointerEvents: arrowVisible ? 'auto' : 'none',
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
          firstDayDate={activeItinerary.days?.[0]?.date ?? null}
          lastDayDate={activeItinerary.days?.at(-1)?.date ?? null}
          onSave={(details) => {
            dispatch({ type: 'SET_PENDING_TRIP_DETAILS', details });
            if (details.arrivalDate && details.departureDate) {
              dispatch({ type: 'SET_TRAVEL_DATES', startDate: details.arrivalDate, endDate: details.departureDate });
            }
            setShowTripDetails(false);
            setTripDetailsSavedToast(true);
            setTimeout(() => setTripDetailsSavedToast(false), 3000);
            // Rebuild reel with new trip details and reveal after brief loading animation
            if (activeItinerary) {
              setRebuildingReel(true);
              tripDetailsRef.current = details;
              setTimeout(() => {
                const freshCards = buildFiltered(activeItinerary, weatherByCityRef.current, personaNameRef.current);
                setCards(freshCards);
                const adjusted = new Set<string>(
                  freshCards
                    .filter((c): c is ReelStopCardType => c.type === 'stop' && !!c.timingAdjustment)
                    .map(c => c.stop.id)
                );
                setRecentlyAdjustedIds(adjusted);
                setRebuildingReel(false);
              }, 600);
            }
          }}
          onClose={handleCloseTripDetails}
        />
      )}

      {/* Trip details saved toast */}
      {tripDetailsSavedToast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--color-sage-bg)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--color-sage-bdr)',
          padding: '10px 16px', borderRadius: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          zIndex: 40, whiteSpace: 'nowrap',
          animation: 'fadeUp .3s ease both',
        }}>
          <span className="ms fill" style={{ fontSize: 16, color: 'var(--color-sage)' }}>check_circle</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-sage)' }}>Trip details saved</span>
        </div>
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
    </>
  );
}
