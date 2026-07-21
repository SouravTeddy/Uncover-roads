import { useState, useCallback } from 'react';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary, FavouritedPin } from '../../shared/types';
import { getPlacePhotoUrl } from '../../shared/api';
import { useCityPhoto } from '../destination/useCityPhoto';
import { formatCityLabel } from '../../shared/cityPhoto';
import { SmartUpdates } from './SmartUpdates';
import { RecalibrationStack } from './RecalibrationStack';
import { ItineraryReelScreen } from '../route/reel';
import { SavedPlacesTab } from './SavedPlacesTab';
import { DateRangeCalendar } from '../destination/DateRangeCalendar';

// ── Utilities ────────────────────────────────────────────────

function formatDateRange(start: string, days: number): string {
  const s = new Date(start);
  const e = new Date(start);
  e.setDate(e.getDate() + days - 1);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (s.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

type TripStatus = 'ongoing' | 'upcoming' | 'past';

function getTripStatus(item: SavedItinerary): { status: TripStatus; daysUntil: number | null } {
  const start = item.travelDate;
  if (!start) return { status: 'past', daysUntil: null };

  const engineDays = (item.itinerary as any)?.days;
  const numDays: number = Array.isArray(engineDays) ? engineDays.length : 1;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startDate = new Date(start); startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(start);
  endDate.setDate(startDate.getDate() + numDays - 1);
  endDate.setHours(23, 59, 59, 999);

  const nowTs = today.getTime();
  if (nowTs >= startDate.getTime() && nowTs <= endDate.getTime()) return { status: 'ongoing', daysUntil: 0 };
  if (nowTs < startDate.getTime()) {
    const d = Math.ceil((startDate.getTime() - nowTs) / 86400000);
    return { status: 'upcoming', daysUntil: d };
  }
  return { status: 'past', daysUntil: null };
}

function buildGoogleMapsUrl(stops: any[]): string | null {
  const pts = stops
    .filter((s: any) => typeof s.lat === 'number' && typeof s.lon === 'number')
    .map((s: any) => ({ lat: s.lat as number, lon: s.lon as number }));
  if (pts.length < 2) return null;
  const origin = `${pts[0].lat},${pts[0].lon}`;
  const dest = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lon}`;
  const middle = pts.slice(1, -1).slice(0, 8);
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`;
  return middle.length > 0
    ? `${base}&waypoints=${middle.map(p => `${p.lat},${p.lon}`).join('|')}`
    : base;
}

// ── Nudge Sheet ──────────────────────────────────────────────

function NudgeSheet({
  item, cityDisplayName, allStops, numDays, status, photoUrl, onClose, onPlay,
}: {
  item: SavedItinerary;
  cityDisplayName: string;
  allStops: any[];
  numDays: number;
  status: TripStatus;
  photoUrl: string | null;
  onClose: () => void;
  onPlay: () => void;
}) {
  const dateLabel = item.travelDate
    ? formatDateRange(item.travelDate, numDays)
    : timeAgo(item.date);

  const subLabel = `${dateLabel} · ${allStops.length} stop${allStops.length !== 1 ? 's' : ''}${numDays > 1 ? ` · ${numDays} days` : ''}`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)',
          zIndex: 50,
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--color-surface)',
        borderRadius: '24px 24px 0 0',
        borderTop: '1px solid var(--color-border)',
        zIndex: 51,
        animation: 'springUp 0.3s cubic-bezier(.32,1,.46,1) both',
      }}>
        {/* Handle */}
        <div style={{ width: 34, height: 4, borderRadius: 99, background: 'var(--color-border)', margin: '10px auto 0' }} />

        {/* Trip identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 12px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: 'var(--color-surface2)',
            backgroundImage: photoUrl ? `url('${photoUrl}')` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            overflow: 'hidden',
          }} />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1 }}>
              {cityDisplayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-4)', marginTop: 3 }}>{subLabel}</div>
          </div>
        </div>

        {/* Smart updates / changes */}
        <div style={{ padding: '12px 18px' }}>
          {status !== 'past'
            ? <SmartUpdates trip={item} />
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="ms" style={{ fontSize: 16, color: 'var(--color-text-4)' }}>history</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-4)', lineHeight: 1.45 }}>This trip is complete. Replay the reel to revisit it.</span>
              </div>
            )
          }
          <RecalibrationStack trip={item} autoRun={false} />
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 18px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Primary CTA */}
          <button
            onClick={onPlay}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14,
              border: '1px solid rgba(212,168,83,.4)',
              background: 'rgba(212,168,83,.15)',
              fontSize: 14, fontWeight: 700, color: 'var(--color-primary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <span className="ms fill" style={{ fontSize: 16 }}>play_circle</span>
            Open plan
          </button>
          {/* Secondary row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(() => {
              const mapsUrl = buildGoogleMapsUrl(allStops);
              return mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 11,
                    border: '1px solid var(--color-border-m)',
                    background: 'var(--color-surface)',
                    fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    textDecoration: 'none',
                  }}
                >
                  <span className="ms" style={{ fontSize: 14, color: '#4285f4' }}>map</span>
                  Google Maps
                </a>
              ) : null;
            })()}
            <button
              onClick={onClose}
              style={{
                padding: '10px 18px', borderRadius: 11,
                border: '1px solid var(--color-border)', background: 'none',
                fontSize: 12, fontWeight: 600, color: 'var(--color-text-4)', cursor: 'pointer',
              }}
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Trip Card ────────────────────────────────────────────────

function buildMonthGroups(items: SavedItinerary[]): { label: string; items: SavedItinerary[] }[] {
  const map = new Map<string, { label: string; items: SavedItinerary[] }>();
  for (const item of items) {
    const d = new Date(item.travelDate ?? item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, { label, items: [] });
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values());
}

const GROUP_THRESHOLD = 5;

function TripCard({ item, index }: { item: SavedItinerary; index: number }) {
  const { dispatch } = useAppStore();
  const [nudgeOpen, setNudgeOpen] = useState(false);

  const engineDays = (item.itinerary as any)?.days as any[] | undefined;
  const allStops: any[] = engineDays
    ? engineDays.flatMap((d: any) => d.stops ?? [])
    : item.itinerary?.itinerary ?? [];
  const numDays = engineDays?.length ?? 1;

  // Multi-city label: "Paris +1". Use whichever source gives the most distinct cities.
  // `cities` from the engine response may be [] or single-city even for multi-city builds
  // (if the second city wasn't detected at build time), so always prefer engineDays.city
  // if it reveals more cities.
  const rawCities = ((item.itinerary as any)?.cities as string[] | undefined)?.filter(Boolean) ?? [];
  const daysCities: string[] = engineDays
    ? [...new Set(engineDays.map((d: any) => d.city).filter(Boolean))]
    : [];
  const itinCities: string[] = (() => {
    if (rawCities.length > 1) return rawCities;
    if (daysCities.length > 1) return daysCities;
    if (rawCities.length > 0) return rawCities;
    return daysCities;
  })();
  const cityDisplayName = formatCityLabel(itinCities.length > 0 ? itinCities : [item.city]);

  const { status, daysUntil } = getTripStatus(item);

  // Hero photo: first stop with a photo → city Google photo
  const heroStop = allStops.find((s: any) => s.imageUrl || s.photoRef);
  const stopPhoto = heroStop?.imageUrl
    ?? (heroStop?.photoRef ? getPlacePhotoUrl(heroStop.photoRef, 600) : null);
  const cityPhoto = useCityPhoto(item.city);
  const photoUrl = stopPhoto ?? cityPhoto;

  const dateLabel = item.travelDate
    ? formatDateRange(item.travelDate, numDays)
    : timeAgo(item.date);

  const hasUnresolvedSwaps = (item.pendingSwapCards ?? []).some((c: any) => !c.resolved);

  function handlePlay() {
    setNudgeOpen(false);
    dispatch({ type: 'SET_REEL_SAVED_ID', id: item.id });
    dispatch({ type: 'SET_TRIPS_TAB', tab: 'current' });
  }

  const isPast = status === 'past';

  return (
    <>
      <div
        style={{
          marginBottom: 12,
          opacity: isPast ? 0.65 : 1,
          filter: isPast ? 'saturate(0.45)' : 'none',
          animation: `cardEntry 0.38s ease ${index * 0.08}s both`,
          cursor: 'pointer',
        }}
        onClick={handlePlay}
      >
        <div style={{
          position: 'relative',
          height: 186,
          borderRadius: 20,
          overflow: 'hidden',
          background: 'var(--color-surface2)',
        }}>
          {/* Photo */}
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}

          {/* Scrim */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(10,9,8,.22) 0%, rgba(10,9,8,.04) 30%, rgba(10,9,8,.55) 58%, rgba(10,9,8,.96) 100%)',
          }} />

          {/* Top row */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Date/status pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999,
              fontSize: 10.5, fontWeight: 600, letterSpacing: '0.01em',
              backdropFilter: 'blur(12px)',
              ...(status === 'ongoing'
                ? { background: 'rgba(107,148,112,.2)', color: '#82c087', border: '1px solid rgba(107,148,112,.32)' }
                : status === 'upcoming'
                ? { background: 'rgba(212,168,83,.16)', color: '#d4a853', border: '1px solid rgba(212,168,83,.28)' }
                : { background: 'rgba(255,255,255,.07)', color: 'rgba(242,237,230,.45)', border: '1px solid rgba(255,255,255,.1)' }),
            }}>
              <span className="ms" style={{ fontSize: 11 }}>calendar_month</span>
              {status === 'ongoing'
                ? `Today · ${item.travelDate ? new Date(item.travelDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
                : status === 'upcoming' && daysUntil !== null
                ? `In ${daysUntil} day${daysUntil !== 1 ? 's' : ''} · ${dateLabel}`
                : dateLabel}
            </div>

            {/* Right pill: alert if changes, visited if past, else nothing */}
            {hasUnresolvedSwaps && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 9px', borderRadius: 999,
                fontSize: 10, fontWeight: 600,
                background: 'rgba(224,120,84,.18)', color: '#e07854', border: '1px solid rgba(224,120,84,.28)',
                backdropFilter: 'blur(12px)',
              }}>
                <span className="ms" style={{ fontSize: 11 }}>warning</span>
                Updates
              </div>
            )}
          </div>

          {/* Bottom: city + stats + arrow */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '0 14px 13px',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Stat row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: 'rgba(255,255,255,.80)', fontWeight: 500 }}>
                  <span className="ms" style={{ fontSize: 14, color: 'rgba(255,255,255,.60)' }}>route</span>
                  {allStops.length} stop{allStops.length !== 1 ? 's' : ''}
                  {numDays > 1 && ` · ${numDays} days`}
                </span>
                {isPast && (
                  <>
                    <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,.25)' }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: 'rgba(255,255,255,.80)', fontWeight: 500 }}>
                      <span className="ms" style={{ fontSize: 14, color: 'rgba(255,255,255,.60)' }}>history</span>
                      {timeAgo(item.travelDate ?? item.date)}
                    </span>
                  </>
                )}
              </div>
              {/* City name */}
              <div style={{
                fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700,
                color: '#fff', lineHeight: 1,
                textShadow: '0 2px 14px rgba(0,0,0,.55)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {cityDisplayName}
              </div>
            </div>

            {/* Arrow button — opens nudge sheet with smart updates */}
            <button
              onClick={e => { e.stopPropagation(); setNudgeOpen(true); }}
              style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,.8)', cursor: 'pointer',
              }}
            >
              <span className="ms" style={{ fontSize: 15 }}>arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {nudgeOpen && (
        <NudgeSheet
          item={item}
          cityDisplayName={cityDisplayName}
          allStops={allStops}
          numDays={numDays}
          status={status}
          photoUrl={photoUrl}
          onClose={() => setNudgeOpen(false)}
          onPlay={handlePlay}
        />
      )}
    </>
  );
}

// ── Main Screen ──────────────────────────────────────────────

export function TripsScreen() {
  const { state, dispatch } = useAppStore();
  const { savedItineraries, tripsActiveTab, hasBuiltThisSession, reelSavedId, favouritedPins, savedEvents, activeBuild } = state;
  const [tabBarHidden, setTabBarHidden] = useState(false);

  // Calendar overlay for opening a saved pin on the map
  const [pendingPin, setPendingPin] = useState<FavouritedPin | null>(null);
  const [showPinCalendar, setShowPinCalendar] = useState(false);
  const [pinCalStart, setPinCalStart] = useState<string | null>(null);
  const [pinCalEnd, setPinCalEnd] = useState<string | null>(null);

  function openPinCalendar(pin: FavouritedPin) {
    dispatch({ type: 'SET_CITY', city: pin.city });
    setPendingPin(pin);
    setPinCalStart(null);
    setPinCalEnd(null);
    setShowPinCalendar(true);
  }

  function handlePinCalendarDone() {
    if (!pendingPin || !pinCalStart || !pinCalEnd) return;
    dispatch({ type: 'SET_CITY_GEO', geo: {
      lat: pendingPin.lat, lon: pendingPin.lon,
      bbox: [pendingPin.lat - 0.15, pendingPin.lat + 0.15, pendingPin.lon - 0.15, pendingPin.lon + 0.15],
    }});
    dispatch({ type: 'SET_TRAVEL_DATES', startDate: pinCalStart, endDate: pinCalEnd });
    dispatch({ type: 'SET_PENDING_PLACE', place: {
      id: pendingPin.placeId,
      title: pendingPin.title,
      lat: pendingPin.lat,
      lon: pendingPin.lon,
      category: pendingPin.category ?? 'place',
      place_id: pendingPin.placeId.startsWith('osm-') ? undefined : pendingPin.placeId,
      photo_ref: pendingPin.photoRef ?? undefined,
    }});
    setShowPinCalendar(false);
    setPendingPin(null);
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  const sorted = [...savedItineraries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const setTab = useCallback((tab: 'current' | 'saved' | 'places') => {
    dispatch({ type: 'SET_TRIPS_TAB', tab });
    setTabBarHidden(false);
  }, [dispatch]);

  // Tab bar: blurred, theme-aware, hides when reel scrolls past card 1
  const TAB_BAR: React.CSSProperties = {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 45,
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
    paddingLeft: 20, paddingRight: 20,
    paddingBottom: 0,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    background: 'rgba(var(--color-bg-raw, 15,13,12), 0.82)',
    borderBottom: '1px solid var(--color-border)',
    transform: tabBarHidden ? 'translateY(-110%)' : 'translateY(0)',
    opacity: tabBarHidden ? 0 : 1,
    transition: 'transform 0.3s cubic-bezier(.4,0,.2,1), opacity 0.3s',
  };

  return (
    <div className="fixed inset-0" style={{ background: 'var(--color-bg)', zIndex: 20 }}>

      {/* ── Tab bar ── */}
      <div style={TAB_BAR}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-divider)', paddingBottom: 0 }}>
          {tripsActiveTab === 'places' ? (
            /* Saved Places header */
            <>
              <button
                onClick={() => setTab('saved')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px 12px 0', display: 'flex', alignItems: 'center', color: 'var(--color-text-3)' }}
              >
                <span className="ms" style={{ fontSize: 20 }}>arrow_back</span>
              </button>
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)', paddingBottom: 12 }}>
                Saved Places
              </span>
            </>
          ) : (
            /* Current / Saved tabs + heart */
            <>
              {(['current', 'saved'] as const).map(tab => {
                const isActive = tripsActiveTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setTab(tab)}
                    style={{
                      padding: '0 0 12px', marginRight: 28,
                      background: 'none', border: 'none', cursor: 'pointer',
                      borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                      position: 'relative', bottom: -1,
                      transition: 'border-color .2s',
                    }}
                  >
                    <span style={{
                      fontSize: 17, fontWeight: 600,
                      color: isActive ? 'var(--color-text-1)' : 'var(--color-text-3)',
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '-.01em',
                      transition: 'color .2s',
                    }}>
                      {tab === 'current' ? 'Current' : 'Saved'}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => setTab('places')}
                style={{
                  marginLeft: 'auto', marginBottom: 12,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#e05c7a', padding: 4,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <span className="ms fill heart-pulse" style={{ fontSize: 22 }}>favorite</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Current: reel / building / empty ── */}
      {tripsActiveTab === 'current' && (
        hasBuiltThisSession || reelSavedId || activeBuild?.status === 'pending' || activeBuild?.status === 'running' ? (
          <ItineraryReelScreen
            key={reelSavedId ?? 'live'}
            onTabBarScroll={setTabBarHidden}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="ms" style={{ fontSize: 30, color: 'var(--color-text-4)' }}>route</span>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8, lineHeight: 1.2 }}>No itinerary yet</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.6 }}>Explore a city and build your<br />itinerary to see it here.</p>
            </div>
            <button
              onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
              style={{ padding: '12px 28px', borderRadius: 14, background: 'rgba(212,168,83,.15)', border: '1px solid rgba(212,168,83,.4)', color: 'var(--color-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Start exploring
            </button>
          </div>
        )
      )}

      {/* ── Places: saved places ── */}
      {tripsActiveTab === 'places' && (
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 68px)', paddingBottom: 112 } as React.CSSProperties}
          className="no-scrollbar"
        >
          <SavedPlacesTab
            favouritedPins={favouritedPins}
            savedEvents={savedEvents}
            onOpenMap={openPinCalendar}
            onRemovePin={(placeId) => {
              const pin = favouritedPins.find(p => p.placeId === placeId);
              if (pin) dispatch({ type: 'TOGGLE_FAVOURITE', pin });
            }}
            onRemoveEvent={(id) => dispatch({ type: 'REMOVE_EVENT', id })}
          />
        </div>
      )}

      {/* ── Saved: trips list ── */}
      {tripsActiveTab === 'saved' && (
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 68px)' } as React.CSSProperties}
          className="no-scrollbar"
        >
          {sorted.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, padding: '64px 32px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="ms" style={{ fontSize: 30, color: 'var(--color-text-4)' }}>route</span>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8, lineHeight: 1.2 }}>No trips yet</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.6 }}>Explore a city and build your itinerary.<br />Your trips are saved automatically.</p>
              </div>
              <button
                onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
                style={{ padding: '12px 28px', borderRadius: 14, background: 'rgba(212,168,83,.15)', border: '1px solid rgba(212,168,83,.4)', color: 'var(--color-primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Start exploring
              </button>
            </div>
          ) : sorted.length <= GROUP_THRESHOLD ? (
            <div style={{ padding: '8px 16px 112px' }}>
              {sorted.map((item, idx) => <TripCard key={item.id} item={item} index={idx} />)}
            </div>
          ) : (
            <div style={{ padding: '8px 16px 112px' }}>
              {buildMonthGroups(sorted).map(group => (
                <div key={group.label}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-4)', padding: '4px 2px 10px' }}>
                    {group.label}
                  </div>
                  {group.items.map((item, idx) => <TripCard key={item.id} item={item} index={idx} />)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pin calendar overlay — opened from saved place card tap ── */}
      {showPinCalendar && pendingPin && (
        <>
          <div
            onClick={() => { setShowPinCalendar(false); setPendingPin(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.01)' }}
          />
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'var(--color-bg)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)', paddingBottom: 12, borderBottom: '1px solid var(--color-divider)' }}>
              <button
                className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center flex-shrink-0"
                onClick={() => { setShowPinCalendar(false); setPendingPin(null); }}
              >
                <span className="ms text-[var(--color-text-2)]" style={{ fontSize: 18 }}>arrow_back</span>
              </button>
              <div>
                <div className="text-[16px] font-semibold text-[var(--color-text-1)] tracking-tight">{pendingPin.city}</div>
                <div className="text-[12px] text-[var(--color-text-3)]">{pendingPin.title}</div>
              </div>
            </div>
            {/* Calendar */}
            <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 200px)' }}>
              <DateRangeCalendar
                key={pendingPin.placeId}
                city={pendingPin.city}
                maxDays={14}
                onSelect={(start, end) => { setPinCalStart(start); setPinCalEnd(end); }}
              />
            </div>
            {/* Done CTA */}
            {pinCalStart && pinCalEnd && (
              <div style={{
                position: 'fixed', left: 0, right: 0,
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
                zIndex: 51, height: 90,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                padding: '0 16px 12px',
                background: 'linear-gradient(to top, var(--color-bg) 70%, transparent)',
              }}>
                <button
                  onClick={handlePinCalendarDone}
                  className="text-sm font-semibold text-[var(--color-primary)] px-5 py-2 rounded-full"
                  style={{ background: 'var(--color-primary-bg)' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Embeddable trips list (no fixed wrapper) for use inside SavedScreen
export function TripsList() {
  const { state, dispatch } = useAppStore();
  const { savedItineraries } = state;

  const sorted = [...savedItineraries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center', gap: 16 }}>
        <span className="ms" style={{ fontSize: 40, color: 'var(--color-text-4)' }}>route</span>
        <div>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8, lineHeight: 1.2 }}>No trips yet</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.6 }}>Your planned itineraries appear here.</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
          style={{ padding: '10px 24px', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Start exploring
        </button>
      </div>
    );
  }

  if (sorted.length <= GROUP_THRESHOLD) {
    return (
      <div style={{ padding: '8px 16px 16px' }}>
        {sorted.map((item, idx) => (
          <TripCard key={item.id} item={item} index={idx} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      {buildMonthGroups(sorted).map(group => (
        <div key={group.label}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-4)', padding: '4px 2px 10px' }}>
            {group.label}
          </div>
          {group.items.map((item, idx) => (
            <TripCard key={item.id} item={item} index={idx} />
          ))}
        </div>
      ))}
    </div>
  );
}
