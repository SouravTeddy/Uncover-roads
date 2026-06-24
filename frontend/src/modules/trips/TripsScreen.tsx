import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary, FavouritedPin } from '../../shared/types';
import { getPlacePhotoUrl } from '../../shared/api';
import { useCityPhoto } from '../destination/useCityPhoto';
import { formatCityLabel } from '../../shared/cityPhoto';
import { SmartUpdates } from './SmartUpdates';
import { RecalibrationStack } from './RecalibrationStack';

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
        <div style={{ padding: '8px 18px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', display: 'flex', gap: 9 }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 16px', borderRadius: 12,
              border: '1px solid var(--color-border)', background: 'none',
              fontSize: 13, fontWeight: 600, color: 'var(--color-text-4)', cursor: 'pointer',
            }}
          >
            Later
          </button>
          <button
            onClick={onPlay}
            style={{
              flex: 1, padding: 12, borderRadius: 12,
              border: '1px solid rgba(212,168,83,.4)',
              background: 'rgba(212,168,83,.15)',
              fontSize: 13, fontWeight: 600, color: '#d4a853',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span className="ms fill" style={{ fontSize: 15 }}>play_circle</span>
            Open plan
          </button>
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
    dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
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
        onClick={() => setNudgeOpen(true)}
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
            {!hasUnresolvedSwaps && isPast && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 9px', borderRadius: 999,
                fontSize: 10, color: 'rgba(255,255,255,.3)', border: '1px solid rgba(255,255,255,.1)',
                backdropFilter: 'blur(12px)',
              }}>
                Visited
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'rgba(255,255,255,.48)', fontWeight: 500 }}>
                  <span className="ms" style={{ fontSize: 11, color: 'rgba(255,255,255,.32)' }}>route</span>
                  {allStops.length} stop{allStops.length !== 1 ? 's' : ''}
                  {numDays > 1 && ` · ${numDays} days`}
                </span>
                {isPast && (
                  <>
                    <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,.14)' }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'rgba(255,255,255,.48)', fontWeight: 500 }}>
                      <span className="ms" style={{ fontSize: 11, color: 'rgba(255,255,255,.32)' }}>history</span>
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

            {/* Arrow button */}
            <button
              onClick={e => { e.stopPropagation(); setNudgeOpen(true); }}
              style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
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

// ── Places Tab ───────────────────────────────────────────────

const CATEGORY_GRADIENT: Record<string, string> = {
  historic:   'linear-gradient(160deg, #3d2a1a, #1a130e)',
  museum:     'linear-gradient(160deg, #3d2a1a, #1a130e)',
  park:       'linear-gradient(160deg, #1e2f1a, #111a0e)',
  restaurant: 'linear-gradient(160deg, #2d1c1c, #150f0f)',
  cafe:       'linear-gradient(160deg, #2d1c1c, #150f0f)',
  tourism:    'linear-gradient(160deg, #1a2535, #0f1620)',
  beach:      'linear-gradient(160deg, #1a2535, #0f1620)',
};

interface PinGroup {
  key: string;
  city: string;
  travelDate: string | null;
  pins: FavouritedPin[];
}

function buildPinGroups(pins: FavouritedPin[]): PinGroup[] {
  const map = new Map<string, PinGroup>();
  for (const pin of pins) {
    const key = `${pin.city}|${pin.travelDate ?? ''}`;
    if (!map.has(key)) map.set(key, { key, city: pin.city, travelDate: pin.travelDate ?? null, pins: [] });
    map.get(key)!.pins.push(pin);
  }
  return Array.from(map.values());
}

function PlaceCard({ pin, onRemove, onOpen }: { pin: FavouritedPin; onRemove: () => void; onOpen: () => void }) {
  const photoUrl = pin.photoRef ? getPlacePhotoUrl(pin.photoRef, 400) : null;
  const gradient = CATEGORY_GRADIENT[pin.category ?? ''] ?? 'linear-gradient(160deg, var(--color-surface2), var(--color-bg))';

  return (
    <div
      onClick={onOpen}
      style={{
        position: 'relative', width: 130, height: 170, borderRadius: 16,
        flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
        background: gradient, boxShadow: 'var(--shadow-md)',
      }}
    >
      {photoUrl && (
        <img
          src={photoUrl} alt={pin.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.18) 55%, transparent 100%)' }} />

      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove"
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 24, height: 24, borderRadius: '50%', border: 'none',
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <span className="ms" style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>close</span>
      </button>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 10px 10px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3, margin: 0 }}>{pin.title}</p>
        {pin.category && (
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,.55)', marginTop: 2, textTransform: 'capitalize' }}>{pin.category}</p>
        )}
      </div>
    </div>
  );
}

function PlacesTab() {
  const { state, dispatch } = useAppStore();
  const { favouritedPins } = state;

  function handleRemove(pin: FavouritedPin) {
    dispatch({ type: 'TOGGLE_FAVOURITE', pin });
  }

  function handleOpenMap(city: string) {
    const pin = favouritedPins.find(p => p.city === city);
    dispatch({ type: 'SET_CITY', city });
    if (pin) {
      dispatch({
        type: 'SET_CITY_GEO',
        geo: { lat: pin.lat, lon: pin.lon, bbox: [pin.lat - 0.15, pin.lat + 0.15, pin.lon - 0.15, pin.lon + 0.15] },
      });
    }
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  if (favouritedPins.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center', gap: 12 }}>
        <span className="ms" style={{ fontSize: 44, color: 'var(--color-text-4)' }}>favorite_border</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 4 }}>No saved places yet</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-4)', lineHeight: 1.5 }}>Tap ❤ on any pin on the map to save it here.</p>
        </div>
      </div>
    );
  }

  const groups = buildPinGroups(favouritedPins);

  return (
    <div style={{ paddingBottom: 32, paddingTop: 8 }}>
      {groups.map(group => {
        const dateLabel = group.travelDate
          ? new Date(group.travelDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
          : null;
        return (
          <div key={group.key} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 16px 10px' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)' }}>{group.city}</span>
                {dateLabel && <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 8 }}>{dateLabel}</span>}
              </div>
              <button
                onClick={() => handleOpenMap(group.city)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span className="ms" style={{ fontSize: 13 }}>map</span>
                Open map
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden', padding: '0 16px 4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              {group.pins.map(pin => (
                <PlaceCard key={pin.placeId} pin={pin} onRemove={() => handleRemove(pin)} onOpen={() => handleOpenMap(group.city)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Screen ──────────────────────────────────────────────

type Tab = 'trips' | 'places';

export function TripsScreen() {
  const { state, dispatch } = useAppStore();
  const { savedItineraries, favouritedPins } = state;
  const [activeTab, setActiveTab] = useState<Tab>('trips');
  const touchStartX = useRef<number | null>(null);

  const sorted = [...savedItineraries].sort((a, b) => {
    const aDate = a.travelDate ?? a.date;
    const bDate = b.travelDate ?? b.date;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) setActiveTab(dx < 0 ? 'places' : 'trips');
    touchStartX.current = null;
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: 'var(--color-bg)', zIndex: 20 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
        paddingBottom: 0, paddingLeft: 20, paddingRight: 20,
        borderBottom: '1px solid var(--color-divider)',
      }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>
          My Journeys
        </h1>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['trips', 'places'] as Tab[]).map(tab => {
            const isActive = activeTab === tab;
            const count = tab === 'trips' ? sorted.length : favouritedPins.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 4px', marginRight: 20, background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'border-color 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--color-text-1)' : 'var(--color-text-3)', transition: 'color 0.2s' }}>
                  {tab === 'trips' ? 'Trips' : 'Places'}
                </span>
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-4)',
                    background: isActive ? 'var(--color-primary-bg)' : 'var(--color-surface2)',
                    padding: '1px 6px', borderRadius: 999, transition: 'color 0.2s, background 0.2s',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
        {activeTab === 'trips' && (
          sorted.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: '64px 32px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="ms" style={{ fontSize: 30, color: 'var(--color-text-4)' }}>route</span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 6 }}>No trips saved yet</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-4)', lineHeight: 1.5 }}>Explore a city and build your itinerary.<br />Your trips are saved automatically.</p>
              </div>
              <button
                onClick={() => dispatch({ type: 'GO_TO', screen: 'destination' })}
                style={{ padding: '10px 24px', borderRadius: 12, background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Start exploring
              </button>
            </div>
          ) : sorted.length <= GROUP_THRESHOLD ? (
            <div style={{ padding: '16px 16px 112px' }}>
              {sorted.map((item, idx) => (
                <TripCard key={item.id} item={item} index={idx} />
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px 16px 112px' }}>
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
          )
        )}
        {activeTab === 'places' && <PlacesTab />}
      </div>
    </div>
  );
}

// Embeddable trips list (no fixed wrapper) for use inside SavedScreen
export function TripsList() {
  const { state, dispatch } = useAppStore();
  const { savedItineraries } = state;

  const sorted = [...savedItineraries].sort((a, b) => {
    const aDate = a.travelDate ?? a.date;
    const bDate = b.travelDate ?? b.date;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  if (sorted.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center', gap: 16 }}>
        <span className="ms" style={{ fontSize: 40, color: 'var(--color-text-4)' }}>route</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-2)', marginBottom: 4 }}>No trips saved yet</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-4)', lineHeight: 1.5 }}>Your planned itineraries appear here.</p>
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
