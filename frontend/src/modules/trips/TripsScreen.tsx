import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../shared/store';
import type { SavedItinerary, FavouritedPin } from '../../shared/types';
import { ARCHETYPE_COLORS, ARCHETYPE_EMOJI, ARCHETYPE_SHORT } from '../persona/types';
import { getPlacePhotoUrl } from '../../shared/api';

// ── Utilities ────────────────────────────────────────────────

function formatDateRange(start: string, days: number): string {
  const s = new Date(start);
  const e = new Date(start);
  e.setDate(e.getDate() + days - 1);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (s.getFullYear() !== new Date().getFullYear()) {
    opts.year = 'numeric';
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

type TripStatus = 'ongoing' | 'upcoming' | 'past';

function getTripStatus(item: SavedItinerary): { status: TripStatus; daysUntil: number | null } {
  const start = item.travelDate;
  if (!start) return { status: 'past', daysUntil: null };

  const engineDays = (item.itinerary as any)?.days;
  const numDays: number = Array.isArray(engineDays) ? engineDays.length : 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(start);
  endDate.setDate(startDate.getDate() + numDays - 1);
  endDate.setHours(23, 59, 59, 999);

  const nowTs = today.getTime();
  const startTs = startDate.getTime();
  const endTs = endDate.getTime();

  if (nowTs >= startTs && nowTs <= endTs) return { status: 'ongoing', daysUntil: 0 };
  if (nowTs < startTs) {
    const days = Math.ceil((startTs - nowTs) / (1000 * 60 * 60 * 24));
    return { status: 'upcoming', daysUntil: days };
  }
  return { status: 'past', daysUntil: null };
}

// ── Trip Card ────────────────────────────────────────────────

const CITY_FALLBACK = (city: string) =>
  `https://source.unsplash.com/featured/800x400/?${encodeURIComponent(city)},city`;

function TripCard({ item, index, onDelete }: { item: SavedItinerary; index: number; onDelete: (id: string) => void }) {
  const { dispatch } = useAppStore();
  const [expanded, setExpanded] = useState(false);

  const archetypeKey    = item.persona?.archetype ?? '';
  const archetypeColors = ARCHETYPE_COLORS[archetypeKey] ?? { primary: '#d4a853', glow: 'rgba(212,168,83,.22)' };
  const archetypeEmoji  = ARCHETYPE_EMOJI[archetypeKey]  ?? '◆';
  const archetypeName   = ARCHETYPE_SHORT[archetypeKey]  ?? (item.persona?.archetype_name ?? archetypeKey);

  const engineDays = (item.itinerary as any)?.days as any[] | undefined;
  const allStops: any[] = engineDays
    ? engineDays.flatMap((d: any) => d.stops ?? [])
    : item.itinerary?.itinerary ?? [];

  const numDays = engineDays?.length ?? 1;
  const { status, daysUntil } = getTripStatus(item);

  // Hero: first stop with imageUrl → photoRef → city fallback
  const heroStop = allStops.find((s: any) => s.imageUrl || s.photoRef);
  const heroPhoto = heroStop?.imageUrl
    ?? (heroStop?.photoRef ? getPlacePhotoUrl(heroStop.photoRef, 600) : null)
    ?? null;

  const dateLabel = item.travelDate
    ? formatDateRange(item.travelDate, numDays)
    : formatShortDate(item.date);

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    dispatch({ type: 'SET_REEL_SAVED_ID', id: item.id });
    dispatch({ type: 'GO_TO', screen: 'itinerary-reel' });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete(item.id);
  }

  const isPast = status === 'past';

  return (
    <div style={{ marginBottom: 12, opacity: isPast ? 0.72 : 1, filter: isPast ? 'saturate(0.6)' : 'none', animation: `cardEntry 0.4s ease ${index * 0.08}s both` }}>
      {/* Card */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          position: 'relative',
          height: 152,
          borderRadius: expanded ? '20px 20px 0 0' : 20,
          overflow: 'hidden',
          cursor: 'pointer',
          background: heroPhoto
            ? `url('${heroPhoto}') center/cover no-repeat`
            : `linear-gradient(135deg, ${archetypeColors.glow}, rgba(14,10,8,1))`,
        }}
      >
        {!heroPhoto && (
          <img
            src={CITY_FALLBACK(item.city)}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(10,8,6,.15) 0%, rgba(10,8,6,.82) 100%)',
        }} />

        {/* Status indicator — top left */}
        <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          {status === 'ongoing' && (
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#d4a853', flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(212,168,83,.3)',
              animation: 'glowPulse 2s ease-in-out infinite',
            }} />
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.65)' }}>
            {status === 'ongoing'
              ? 'Ongoing'
              : status === 'upcoming' && daysUntil !== null
              ? daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`
              : 'Completed'}
          </span>
        </div>

        {/* Archetype badge — top right */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 9px', borderRadius: 999,
          fontSize: 10, fontWeight: 700,
          background: archetypeColors.glow,
          border: `1px solid ${archetypeColors.primary}55`,
          color: archetypeColors.primary,
          backdropFilter: 'blur(8px)',
        }}>
          {archetypeEmoji} {archetypeName}
        </div>

        {/* Bottom: city + date row */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '32px 16px 14px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1, marginBottom: 4 }}>
            {item.city}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>
            {dateLabel} · {allStops.length} stop{allStops.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Continue pill */}
        <div
          onClick={handlePlay}
          style={{
            position: 'absolute', bottom: 14, right: 14,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 11px', borderRadius: 999,
            background: 'rgba(212,168,83,.18)',
            border: '1px solid rgba(212,168,83,.4)',
            backdropFilter: 'blur(8px)',
            fontSize: 11, fontWeight: 600, color: '#d4a853',
            cursor: 'pointer',
          }}
        >
          <span className="ms fill" style={{ fontSize: 13 }}>play_arrow</span>
          Continue
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          aria-label="Delete trip"
          style={{
            position: 'absolute', top: 44, right: 14,
            width: 28, height: 28, borderRadius: '50%', border: 'none',
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span className="ms" style={{ fontSize: 14, color: 'rgba(255,255,255,.7)' }}>delete</span>
        </button>
      </div>

      {/* Expanded stop list */}
      {expanded && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 20px 20px',
          padding: '12px 16px 16px',
          animation: 'springUp 0.25s ease both',
        }}>
          {allStops.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-4)', textAlign: 'center', padding: '12px 0' }}>No stops</p>
          ) : (
            <div>
              {allStops.map((stop: any, i: number) => (
                <div key={stop.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
                  borderBottom: i < allStops.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-primary-bg)',
                    border: '1px solid rgba(212,168,83,.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {stop.title ?? stop.place}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>{stop.time ?? ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
    if (!map.has(key)) {
      map.set(key, { key, city: pin.city, travelDate: pin.travelDate ?? null, pins: [] });
    }
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
        position: 'relative',
        width: 130,
        height: 170,
        borderRadius: 16,
        flexShrink: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        background: gradient,
      }}
    >
      {photoUrl && (
        <img
          src={photoUrl}
          alt={pin.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.18) 55%, transparent 100%)',
      }} />

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove"
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 24, height: 24, borderRadius: '50%', border: 'none',
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
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
    dispatch({ type: 'SET_CITY', city });
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
            {/* Group header */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 16px 10px' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-1)' }}>
                  {group.city}
                </span>
                {dateLabel && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 8 }}>{dateLabel}</span>
                )}
              </div>
              <button
                onClick={() => handleOpenMap(group.city)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, color: 'var(--color-primary)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                <span className="ms" style={{ fontSize: 13 }}>map</span>
                Open map
              </button>
            </div>

            {/* Horizontal carousel */}
            <div style={{
              display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden',
              padding: '0 16px 4px',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}>
              {group.pins.map(pin => (
                <PlaceCard
                  key={pin.placeId}
                  pin={pin}
                  onRemove={() => handleRemove(pin)}
                  onOpen={() => handleOpenMap(group.city)}
                />
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

  function handleDelete(id: string) {
    dispatch({ type: 'REMOVE_ITINERARY', id });
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      setActiveTab(dx < 0 ? 'places' : 'trips');
    }
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
      <div
        style={{
          flexShrink: 0,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: 0,
          paddingLeft: 20,
          paddingRight: 20,
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>
          My Journeys
        </h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {(['trips', 'places'] as Tab[]).map(tab => {
            const isActive = activeTab === tab;
            const count = tab === 'trips' ? sorted.length : favouritedPins.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 4px',
                  marginRight: 20,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
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
                    padding: '1px 6px', borderRadius: 999,
                    transition: 'color 0.2s, background 0.2s',
                  }}>
                    {count}
                  </span>
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
          ) : (
            <div style={{ padding: '16px 16px 112px' }}>
              {sorted.map((item, idx) => (
                <TripCard key={item.id} item={item} index={idx} onDelete={handleDelete} />
              ))}
            </div>
          )
        )}

        {activeTab === 'places' && <PlacesTab />}
      </div>
    </div>
  );
}

