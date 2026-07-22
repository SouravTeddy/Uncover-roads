import { useEffect, useLayoutEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAppStore } from '../../../shared/store';
import { buildReelCards } from './reel-builder';
import { ReelIntroCard } from './ReelIntroCard';
import { ReelStopCard } from './ReelStopCard';
import { ReelIntelCard } from './ReelIntelCard';
import { ReelTransitCard } from './ReelTransitCard';
import { ReelFinaleCard } from './ReelFinaleCard';
import { ReelDayDividerCard } from './ReelDayDividerCard';
import { ReelDayTransitionCard } from './ReelDayTransitionCard';
import type { ReelCard, ReelStopCard as ReelStopCardType } from './types';
import type { WeatherData, TripDetails } from '../../../shared/types';
import { api } from '../../../shared/api';
import { useCityPhotoBatch } from '../../destination/useCityPhoto';
import { getPreloadedUrls } from '../../../shared/imagePreloader';
import { ReelBalanceCard } from './ReelBalanceCard';
import ReelScenicCard from './ReelScenicCard';
import { ReelGroupCard } from './ReelGroupCard';
import { ReelDayIntelCard } from './ReelDayIntelCard';
import { ReelGrowthCard } from './ReelGrowthCard';
import { rebalanceItinerary } from './rebalance';
import { TripDetailsSheet } from './TripDetailsSheet';
import { enrichScenicCardsWithTransit } from './transit-enrichment';
import { computeGoldenHour } from './golden-hour';
import type { ReelScenicCard as ReelScenicCardType, ReelDayDividerCard as ReelDayDividerCardType } from './types';
import { supabase } from '../../../shared/supabase';
import { syncSavedItinerary } from '../../../shared/userSync';
function timeToMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function formatGoldenHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

async function enrichPhotoMomentCards(
  built: ReelCard[],
  isCancelled: () => boolean,
): Promise<ReelCard[]> {
  const result = [...built];
  const PHOTO_CATS = new Set(['viewpoint', 'beach', 'park']);
  for (let i = 0; i < result.length; i++) {
    const card = result[i];
    if (card.type !== 'stop') continue;
    if (!PHOTO_CATS.has(card.stop.category)) continue;
    // Don't inject if a scenic card already follows this stop
    const next = result[i + 1];
    if (next?.type === 'scenic') continue;
    const dayCard = built.find((c) => c.type === 'day_divider') as ReelDayDividerCardType | undefined;
    const dateStr = card.visitDate ?? dayCard?.date ?? '';
    if (!dateStr) continue;
    const goldenHour = await computeGoldenHour(card.stop.lat, card.stop.lon, dateStr);
    if (isCancelled()) return result;
    if (!goldenHour) continue;
    const stopMin = timeToMin(card.stop.time);
    const goldenMin = timeToMin(goldenHour);
    const endMin = stopMin + (card.stop.durationMin ?? 60);
    const windowEnd = goldenMin + 90;
    if (endMin < goldenMin || stopMin > windowEnd) continue;
    const goldenHourDisplay = formatGoldenHour(goldenHour);
    const momentCard: ReelScenicCardType = {
      type:          'scenic',
      sceneType:     'walk',
      accent:        '#fbbf24',     // amber — photography / warm light
      cardType:      'GOLDEN HOUR',
      pos:           1,
      total:         1,
      timing:        goldenHourDisplay,
      metaRight:     `Golden hour · ${goldenHourDisplay}`,
      place:         card.stop.title,
      from:          card.stop.area ?? card.stop.title,
      to:            '',
      modeIcon:      'walk',
      tag:           'Photo moment',
      vizType:       'route',
      persona:       '',
      personaDisplay:'',
      personaIcon:   'camera',
      why:           `${card.stop.title} is framed perfectly at golden hour (${goldenHourDisplay}).`,
      sensory:       'The light will be perfect for photography during your visit.',
      sensoryIcon:   'camera',
      reelPos:       '',
      photoUrl:      card.stop.imageUrl ?? null,
      detourKm:      0,
      detourMin:     0,
    };
    result.splice(i + 1, 0, momentCard);
    i++; // skip the just-inserted card
  }
  return result;
}

const IMAGE_CACHE_NAME = 'uncover-trip-images-v1';

function preCacheTripImages(itinerary: import('../../../shared/types').EngineItinerary): void {
  if (!('caches' in self)) return;
  const urls: string[] = [];
  for (const day of itinerary.days ?? []) {
    for (const stop of day.stops ?? []) {
      const url = (stop as any).imageUrl as string | undefined;
      if (url && url.startsWith('http')) urls.push(url);
    }
  }
  if (urls.length === 0) return;
  caches.open(IMAGE_CACHE_NAME).then((cache) => {
    for (const url of urls) {
      cache.match(url).then((hit) => {
        if (!hit) fetch(url).then((r) => { if (r.ok || r.type === 'opaque') cache.put(url, r); }).catch(() => {});
      });
    }
  }).catch(() => {});
}


interface ItineraryReelScreenProps {
  onTabBarScroll?: (hidden: boolean) => void;
}

export function ItineraryReelScreen({ onTabBarScroll }: ItineraryReelScreenProps = {}) {
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

  const itineraryCities = activeItinerary
    ? (activeItinerary.cities?.length ? activeItinerary.cities : [activeItinerary.city ?? city].filter(Boolean))
    : [];
  const cityPhotoMap = useCityPhotoBatch(itineraryCities as string[]);



  const [weatherByCity, setWeatherByCity] = useState<Map<string, WeatherData>>(new Map());
  const [cards, setCards] = useState<ReelCard[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  // When true, the next cards update should restore scroll position (secondary rebuild)
  const restoreScrollRef = useRef(false);
  const [removedStopIds, setRemovedStopIds] = useState<Set<string>>(new Set());
  const [undoPending, setUndoPending] = useState<{ id: string; label: string } | null>(null);
  const [saved, setSaved] = useState(!!savedItem);
  const [imagesReady, setImagesReady] = useState(!!savedItem);
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
  // Lazy image loading: track fetched stop titles and used image URLs (to prevent duplicates)
  const lazyFetchedRef = useRef<Set<string>>(new Set());
  const lazyUsedUrlsRef = useRef<Set<string>>(new Set());
  const lazyPrimaryCity = useRef('');
  const cardsDataRef = useRef<ReelCard[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelControlRef = useRef<import('./ReelStopCard').PanelControl | null>(null);
  const weatherByCityRef = useRef(weatherByCity);
  const personaNameRef = useRef(personaName);
  const tripDetailsRef = useRef<TripDetails | null>(savedItem?.tripDetails ?? state.pendingTripDetails ?? null);
  // Refs for async callbacks — avoids stale closures in lazy-fetch and write-back
  const reelSavedIdRef = useRef(reelSavedId);
  const activeItineraryRef = useRef(activeItinerary);
  // True when this reel was opened from TripsScreen (vs freshly built) — write-back is safe
  const isReopenedSavedTripRef = useRef(!!savedItem);

  useEffect(() => { weatherByCityRef.current = weatherByCity; }, [weatherByCity]);
  useEffect(() => { personaNameRef.current = personaName; }, [personaName]);
  useEffect(() => { tripDetailsRef.current = savedItem?.tripDetails ?? state.pendingTripDetails ?? null; }, [savedItem?.tripDetails, state.pendingTripDetails]);
  useEffect(() => { reelSavedIdRef.current = reelSavedId; }, [reelSavedId]);
  useEffect(() => { activeItineraryRef.current = activeItinerary; }, [activeItinerary]);

  function buildFiltered(
    itinerary: typeof activeItinerary,
    wxByCity: Map<string, WeatherData>,
    pName: string,
    photoMap = cityPhotoMap,
    stopImages = resolvedStopImages,
  ) {
    const journeyLegs = savedItem ? (savedItem.journeyLegs ?? null) : (journey ?? null);

    const baseItinerary = itinerary;

    // Rebalance stops across days for even distribution before building reel cards.
    const balancedItinerary = baseItinerary ? rebalanceItinerary(baseItinerary) : baseItinerary;

    // Pre-inject resolved stop images so scenic cards (built inside buildReelCards)
    // also get originPhotoUrl/destPhotoUrl from stops that lacked photoRef at save time.
    const itineraryForBuild = {
      ...balancedItinerary!,
      days: balancedItinerary!.days.map(day => ({
        ...day,
        stops: day.stops.map(stop =>
          (stopImages.size > 0 && !stop.imageUrl && stopImages.has(stop.title))
            ? { ...stop, imageUrl: stopImages.get(stop.title)! }
            : stop
        ),
      })),
    };

    const built = buildReelCards(itineraryForBuild, journeyLegs, reelSavedId, wxByCity, pName, photoMap, cityCountries, tripDetailsRef.current, state.rawOBAnswers?.group ?? 'solo');

    // Also patch any stop cards that still have no image (title-lookup fallback)
    for (const card of built) {
      if (card.type === 'stop' && !card.stop.imageUrl) {
        const url = stopImages.get(card.stop.title);
        if (url) card.stop.imageUrl = url;
      }
    }

    return built.filter(c => {
      if (c.type === 'stop') return !removedStopIds.has(c.stop.id);
      return true;
    });
  }

  // Full rebuild + image preload — fetches ALL missing stop images before showing the reel
  useEffect(() => {
    if (!activeItinerary) return;

    // Saved trips: open instantly — data is already in store. cityPhotoMap/weather
    // arrive via their own effects (lines ~421-433) and rebuild cards in the background.
    if (savedItem) {
      try {
        setCards(buildFiltered(activeItinerary, weatherByCityRef.current, personaNameRef.current, cityPhotoMap, resolvedStopImages));
      } catch (e) {
        console.warn('[reel] buildFiltered failed for saved trip:', e);
        setCards([]);
      }
      setLoadingStep(1);
      setImagesReady(true);
      return;
    }

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

      lazyPrimaryCity.current = primaryCity;
      lazyFetchedRef.current = new Set();
      lazyUsedUrlsRef.current = new Set();

      // Eager batch: only first 10 stops without images — rest lazy-load on scroll
      const stopsNeedingImages = (activeItinerary.days ?? []).flatMap(d =>
        (d.stops ?? [])
          .filter(s => !s.imageUrl && s.title)
          .map(s => ({ stop: s, city: s.city ?? d.city ?? primaryCity }))
      ).slice(0, 10);
      // Pre-mark eager stops as fetched so lazy effect skips them
      for (const { stop } of stopsNeedingImages) lazyFetchedRef.current.add(stop.title);

      // Race timeout shared by photo fetches
      const raceTimeout = new Promise<never>(resolve =>
        setTimeout(() => resolve(undefined as never), FETCH_TIMEOUT_MS)
      );

      // Run city photos and stop images in parallel
      const [cityPhotosRaw, ...stopImageResults] = await Promise.all([
        Promise.race([api.cityPhotos(allCities), raceTimeout.then(() => ({} as Record<string, string | null>))]),
        ...stopsNeedingImages.map(({ stop, city }) =>
          Promise.race([
            api.placeImage(stop.title, city, stop.placeId ?? undefined).then(url => ({ title: stop.title, url })),
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
        if (r.url) {
          newStopImages.set(r.title, r.url);
          lazyUsedUrlsRef.current.add(r.url); // seed dedup set so lazy-fetch won't reuse
        }
      }
      setResolvedStopImages(newStopImages);

      // Persist resolved imageUrls into the saved itinerary so re-opens are instant.
      // Run before setCards so the store is updated before scenic enrichment can overwrite.
      const savedIdAtBuild = reelSavedIdRef.current;
      if (savedIdAtBuild && newStopImages.size > 0) {
        dispatch({ type: 'UPDATE_SAVED_ITINERARY', id: savedIdAtBuild, patch: {
          itinerary: {
            ...activeItinerary,
            days: (activeItinerary.days ?? []).map(d => ({
              ...d,
              stops: (d.stops ?? []).map(s =>
                !s.imageUrl && s.title && newStopImages.has(s.title)
                  ? { ...s, imageUrl: newStopImages.get(s.title)! }
                  : s
              ),
            })),
          } as any,
        }});
      }

      // Build cards — backend already injected reco stops into the itinerary
      setLoadingStep(1);
      const filtered = buildFiltered(
        activeItinerary,
        weatherByCityRef.current,
        personaNameRef.current,
        builtCityPhotoMap,
        newStopImages,
      );
      setCards(filtered);
      // Show the reel immediately — remaining images lazy-load on scroll
      if (!cancelled) setImagesReady(true);

      // Fetch live events for all days in the trip.
      // Clear stale events first so a city change doesn't carry over previous results.
      dispatch({ type: 'SET_LIVE_EVENTS', events: [] });
      if (activeItinerary.days.length > 0) {
        const firstDay = activeItinerary.days[0];
        const lastDay = activeItinerary.days[activeItinerary.days.length - 1];
        const eventsCity = activeItinerary.city ?? activeItinerary.cities?.[0] ?? '';
        if (eventsCity && firstDay.date && lastDay.date) {
          api.events(eventsCity, firstDay.date, lastDay.date)
            .then((places) => {
              if (cancelled) return;
              // Convert Place[] to LiveEvent[] shape.
              // Place.title (not .name), Place.id is required, Place.lat/lon are non-nullable.
              // No googleMapsUrl on Place — use place_id to build a Maps URL.
              // date is left empty so computeLiveEvent matches on title presence, not specific date.
              const events: import('../../../shared/types').LiveEvent[] = places.map(p => ({
                id:         p.place_id ?? p.id,
                title:      p.title,
                lat:        p.lat,
                lon:        p.lon,
                venueName:  p.title,
                date:       '',
                time:       '',
                genre:      p.category ?? '',
                url:        p.place_id ? `https://www.google.com/maps/place/?q=place_id:${p.place_id}` : '',
                imageUrl:   p.imageUrl ?? null,
              }));
              dispatch({ type: 'SET_LIVE_EVENTS', events });
            })
            .catch(() => { /* non-critical — events just won't show */ });
        }
      }

      // Async transit enrichment — fires in background, updates scenic cards
      // when transit data arrives without blocking the reel from showing
      enrichScenicCardsWithTransit(filtered, apiBase)
        .then(enriched => enrichPhotoMomentCards(enriched, () => cancelled))
        .then(withMoments => {
          if (cancelled) return;
          setCards(withMoments);
        })
        .catch(() => { /* non-critical — show cards without photo moments */ });

    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItinerary, removedStopIds, reelSavedId, journey]);

  // Keep activeIdxRef in sync so the scroll restore effect can read it synchronously
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  // Keep a live snapshot of cards for the lazy-fetch effect (avoids stale closure)
  useEffect(() => { cardsDataRef.current = cards; }, [cards]);

  // Lazy-fetch images for the current card and next 3 stop cards as the user scrolls
  useEffect(() => {
    if (!imagesReady) return;
    // Include activeIdx so the very first card always gets an image
    const upcoming = cardsDataRef.current.slice(activeIdx, activeIdx + 4);
    for (const card of upcoming) {
      if (card.type !== 'stop') continue;
      const { stop } = card;
      if (stop.imageUrl || stop.photoRef) continue;
      if (!stop.title) continue;
      if (lazyFetchedRef.current.has(stop.title)) continue;
      lazyFetchedRef.current.add(stop.title);
      const city = stop.city ?? lazyPrimaryCity.current;
      api.placeImage(stop.title, city, stop.placeId ?? undefined)
        .then(url => {
          if (!url) return;
          // Skip if this exact URL is already used by another card (prevents duplicates)
          if (lazyUsedUrlsRef.current.has(url)) return;
          lazyUsedUrlsRef.current.add(url);
          setCards(prev => prev.map(c =>
            c.type === 'stop' && c.stop.title === stop.title && !c.stop.imageUrl
              ? { ...c, stop: { ...c.stop, imageUrl: url } }
              : c
          ));
          // Write imageUrl back into the saved itinerary so future re-opens don't re-fetch.
          // Only for re-opened saved trips — new builds use scenic enrichment which owns setCards.
          const savedId = reelSavedIdRef.current;
          const itin = activeItineraryRef.current;
          if (isReopenedSavedTripRef.current && savedId && itin) {
            dispatch({ type: 'UPDATE_SAVED_ITINERARY', id: savedId, patch: {
              itinerary: {
                ...itin,
                days: (itin.days ?? []).map(d => ({
                  ...d,
                  stops: (d.stops ?? []).map(s =>
                    s.title === stop.title && !s.imageUrl ? { ...s, imageUrl: url } : s
                  ),
                })),
              } as any,
            }});
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, imagesReady]);

  // After secondary card rebuilds (weather/persona/photos), restore scroll so the
  // user stays on the same card — prevents iOS scroll-snap jumping mid-gesture.
  useLayoutEffect(() => {
    if (!restoreScrollRef.current || !scrollRef.current) return;
    restoreScrollRef.current = false;
    const el = scrollRef.current;
    el.scrollTop = activeIdxRef.current * el.clientHeight;
  }, [cards]);

  // Enrichment-only updates — when weatherByCity or personaName arrive.
  // Do NOT set restoreScrollRef here: these don't change card count, so scrollTop is
  // already correct. Touching scrollTop mid-swipe is what causes "same card again" bug.
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
    const savedEntry = {
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
    };
    dispatch({ type: 'SAVE_ITINERARY', saved: savedEntry });
    dispatch({ type: 'SET_REEL_SAVED_ID', id });
    setSaved(true);
    preCacheTripImages(activeItinerary);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) syncSavedItinerary(user.id, savedEntry).catch(console.warn);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItinerary]);

  // Scroll-based active card tracking + tab bar hide/show for parent TripsScreen
  // NOTE: imagesReady is in the deps because the scroll container only mounts after
  // imagesReady=true. Without it, scrollRef.current is null when cards.length first
  // becomes non-zero, so the listener never gets registered and activeIdx stays 0.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || cards.length === 0) return;
    const update = () => {
      const scrollTop = el.scrollTop;
      const cardH = el.clientHeight;
      const idx = Math.round(scrollTop / cardH);
      setActiveIdx(Math.min(Math.max(idx, 0), cards.length - 1));
      // Hide tab bar whenever past the first card; show it only when back at card 0
      if (onTabBarScroll) {
        onTabBarScroll(idx >= 1);
      }
    };
    // RAF-debounce collapses many scroll events per frame into one update,
    // preventing mid-snap re-renders that can cause iOS scroll-snap to get stuck
    let rafId = 0;
    const handleScroll = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(update); };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { el.removeEventListener('scroll', handleScroll); cancelAnimationFrame(rafId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, imagesReady, onTabBarScroll]);




  // Collapse the panel whenever the active card changes so expanded state
  // from a previous card doesn't bleed into the next one.
  useEffect(() => {
    panelControlRef.current?.collapse();
  }, [activeIdx]);

  // Show the scroll-to-top arrow for 1 s whenever the active card changes, then fade it out
  useEffect(() => {
    if (activeIdx === 0) { setArrowVisible(false); return; }
    setArrowVisible(true);
    if (arrowTimer.current) clearTimeout(arrowTimer.current);
    arrowTimer.current = setTimeout(() => setArrowVisible(false), 1000);
    return () => { if (arrowTimer.current) clearTimeout(arrowTimer.current); };
  }, [activeIdx]);

  const handleCloseTripDetails = useCallback(() => setShowTripDetails(false), []);
  const registerPanelControl = useCallback((ctrl: import('./ReelStopCard').PanelControl | null) => { panelControlRef.current = ctrl; }, []);

  const handleUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (undoPending) setRemovedStopIds(prev => { const s = new Set(prev); s.delete(undoPending.id); return s; });
    setUndoPending(null);
  }, [undoPending]);


  if (!activeItinerary || !imagesReady || !state.persona) {
    const stopCount = activeItinerary?.days?.flatMap(d => d.stops ?? []).length ?? 0;
    const days = activeItinerary?.days?.length ?? 0;
    const cityName = activeItinerary?.city ?? activeItinerary?.cities?.[0] ?? '';

    const STEPS: { label: string; done: boolean }[] = [
      { label: 'Building your itinerary', done: !!activeItinerary },
      { label: 'Gathering photos',        done: loadingStep >= 1 },
      { label: 'Preparing your reel',     done: imagesReady },
    ];
    const activeStep = STEPS.findIndex(s => !s.done);

    // Collect photo URLs for the mosaic: stop photos first, city photos as supplement,
    // then fall back to anything already in the browser bitmap cache (preloaded from destination screen).
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
    // Seed from preloaded bitmap cache so the background appears instantly
    if (mosaicSrcs.length < 3) {
      for (const url of getPreloadedUrls()) {
        if (!mosaicSrcs.includes(url)) mosaicSrcs.push(url);
        if (mosaicSrcs.length >= 9) break;
      }
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
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
            <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: '14px 0 0', lineHeight: 1.5 }}>
              We're crafting a personalised trip just for you — this takes a little time.
            </p>
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
              width: imagesReady ? '100%' : loadingStep >= 1 ? '66%' : activeItinerary ? '33%' : '8%',
              background: 'linear-gradient(90deg, rgba(212,168,83,.5), rgba(212,168,83,.9))',
              borderRadius: 99,
              transition: 'width .6s cubic-bezier(.25,0,0,1)',
            }} />
          </div>
        </div>
      </div>
    );
  }

  // Guard: imagesReady but cards is empty means buildFiltered failed on the saved itinerary
  if (imagesReady && cards.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 32px', textAlign: 'center', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
        <span className="ms fill" style={{ fontSize: 40, color: 'var(--color-text-4)' }}>error_outline</span>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-2)', margin: 0 }}>Couldn't load this trip</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-4)', margin: 0 }}>The saved data may be incomplete. Try going back and opening it again.</p>
        <button
          onClick={() => dispatch({ type: 'GO_BACK' })}
          style={{ marginTop: 8, padding: '10px 24px', borderRadius: 99, background: 'var(--color-surface)', border: '1px solid var(--color-border-m)', color: 'var(--color-text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Go back
        </button>
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
      walkable_detour: {
        _any:    u('1477959858617-67f85cf4f1df'), // city walk street scene
      },
      famous_spots: {
        _any:    u('1499856845038-586f388a7b93'), // iconic city monument
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
      <div style={{ position: 'fixed', inset: 0, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 32px', textAlign: 'center', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms" style={{ fontSize: 30, color: 'var(--color-text-3)' }}>route</span>
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: 'var(--color-text-1)', margin: '0 0 8px', lineHeight: 1.2 }}>
            Reel not available
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5, margin: 0 }}>
            This trip was saved in an older format and can't be replayed as a reel.
          </p>
        </div>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'trips' })}
          style={{ marginTop: 8, padding: '12px 28px', borderRadius: 12, border: '1px solid var(--color-border-m)', background: 'var(--color-surface)', color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Back to trips
        </button>
      </div>
    );
  }

  const dotCards = displayCards.filter(c => c.type !== 'transit' && c.type !== 'intel' && c.type !== 'scenic' && c.type !== 'group' && c.type !== 'day_transition');
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

      {/* Screen reader live region — announces the active stop name as user scrolls */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {displayCards[activeIdx]?.type === 'stop' ? `Now viewing: ${(displayCards[activeIdx] as any).stop?.title ?? ''}` : ''}
      </div>

      {/* Snap-scroll container — position:fixed so nothing clips its scroll events */}
      <div
        ref={scrollRef}
        role="region"
        aria-label="Itinerary reel"
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
            // Recompute stop number from visible (non-removed) stop cards so numbers
            // stay consecutive after deletions (e.g. removing stop 1 doesn't leave "2 of 10")
            const visibleStopCards = displayCards.filter((c): c is ReelStopCardType => c.type === 'stop');
            const visibleStopCount = visibleStopCards.length;
            const visibleStopNumber = visibleStopCards.findIndex(c => c.stop.id === (card as ReelStopCardType).stop.id) + 1;
            const cardWithFixedNumbers: ReelStopCardType = {
              ...(card as ReelStopCardType),
              stopNumber: visibleStopNumber,
              totalStops: visibleStopCount,
            };
            child = <ReelStopCard
              card={cardWithFixedNumbers} active={isActive} weather={weather}
              primaryCity={city || activeItinerary?.city || ''}
              cityPhotoUrl={
                cityPhotoMap.get((card as ReelStopCardType).stop.city?.toLowerCase() ?? '')
                ?? cityPhotoMap.get((city ?? activeItinerary?.city ?? '').toLowerCase())
                ?? null
              }
              isJustAdjusted={isJustAdjusted}
              onRemove={() => {
                const stop = (card as ReelStopCardType).stop;
                if (undoTimer.current) clearTimeout(undoTimer.current);
                setRemovedStopIds(prev => new Set([...prev, stop.id]));
                setUndoPending({ id: stop.id, label: stop.title });
                undoTimer.current = setTimeout(() => setUndoPending(null), 4000);
              }}
              onRegisterPanelControl={isActive ? registerPanelControl : undefined}
            />;
          }
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
          else if (card.type === 'scenic_pending') child = (
            <div style={{
              background: 'var(--color-surface, #1a1714)',
              borderRadius: 20,
              padding: 24,
              margin: '0 0 2px',
              minHeight: 180,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(245,240,234,.3)' }}>
                Between {card.from} and {card.to}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[120, 80, 100].map((w, i) => (
                  <div key={i} style={{
                    height: 12, borderRadius: 6,
                    background: 'linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.05) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    width: `${w}px`,
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(245,240,234,.3)' }}>Couldn't load scenic info for this stretch</div>
              <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
            </div>
          );
          else if (card.type === 'scenic') child = <ReelScenicCard card={card} active={isActive} />;
          else if (card.type === 'finale')  child = <ReelFinaleCard card={card} active={isActive} />;
          else if (card.type === 'day_divider') child = <ReelDayDividerCard card={card} />;
          else if (card.type === 'day_transition') child = <ReelDayTransitionCard card={card} active={isActive} />;
          // day_nudge removed — reco engine fills sparse days with "Our pick" stops
          else if (card.type === 'day_intel') child = (
            <ReelDayIntelCard
              card={card}
              active={isActive}
              selectedPlaces={state.selectedPlaces}
              onInteract={(_action) => {
                // ADD_RECO_INTERACTION removed — reco engine deleted in Task 7
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
            card.type === 'intel' ? card.id :
            card.type === 'transit' ? `transit-${card.from}-${card.to}` :
            card.type === 'day_divider' ? `day-${card.day}` :
            card.type === 'day_transition' ? `transition-${card.prevDay}-${card.nextDay}` :
            card.type === 'day_intel' ? card.id :
            card.type === 'scenic' ? `scenic-${card.from}-${card.to}` :
            card.type === 'group' ? `group-${card.fromStop}-${card.toStop}` :
            card.type === 'growth' ? 'growth-card' :
            `${card.type}-${idx}`;
          return (
            <div key={cardKey} ref={setRef} style={{ height: '100dvh', flexShrink: 0, scrollSnapStop: 'always', scrollSnapAlign: 'start' }}>
              {child}
            </div>
          );
        })}
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
