import { useState, useEffect, useRef, useCallback } from 'react';
import type { Place, PlaceDetails } from '../../shared/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { getPlacePhotoUrl, api } from '../../shared/api';
import { filterTypes, getHoursLabel, parseOpenClose, getDirectionsUrl } from './pincard-utils';

interface Props {
  place: Place;
  city: string;
  isSelected: boolean;
  onAdd: () => void;
  onClose: () => void;
  details?: PlaceDetails | null;
}

const PRICE: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
};

const CATEGORY_BG: Record<string, string> = {
  restaurant: 'rgba(239,68,68,.12)', cafe: 'rgba(249,115,22,.12)',
  park: 'rgba(34,197,94,.12)', museum: 'rgba(139,92,246,.12)',
  historic: 'rgba(161,98,7,.12)', tourism: 'rgba(14,165,233,.12)',
  event: 'rgba(236,72,153,.12)', place: 'rgba(107,114,128,.12)',
};

const linkBtn: React.CSSProperties = {
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
  height: 36, padding: '0 14px', borderRadius: 999,
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
  fontSize: '0.72rem', fontWeight: 700, color: 'rgba(193,198,215,.8)',
  textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
};

export function PinCard({ place, city, isSelected, onAdd, onClose, details }: Props) {
  const [visible, setVisible]         = useState(false);
  const [imgSrc, setImgSrc]           = useState<string | null>(null);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const sheetRef    = useRef<HTMLDivElement>(null);
  const handleRef   = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const dragY       = useRef(0);
  const closing     = useRef(false);

  // Slide-in on mount + block Chrome pull-to-refresh while card is open
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    // overscroll-behavior-y:none prevents Chrome's pull-to-refresh gesture
    // from firing while the user is swiping the card down to close it.
    document.body.style.overscrollBehaviorY = 'none';
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overscrollBehaviorY = '';
    };
  }, []);

  // Image: Google photo → Wikipedia fallback
  const photoRef       = details?.photo_ref ?? place.photo_ref ?? null;
  const googlePhotoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null;

  useEffect(() => {
    closing.current = false;
    setHoursExpanded(false);

    if (googlePhotoUrl) {
      setImgSrc(googlePhotoUrl);
    } else {
      setImgSrc(null);
      // No Google photo — try Wikipedia/Wikimedia immediately
      api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, googlePhotoUrl]);

  const handleImgError = useCallback(() => {
    // Google photo proxy failed (API key not set in Railway) — try wiki
    api.placeImage(place.title, city).then(url => setImgSrc(url));
  }, [place.title, city]);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setVisible(false);
    setTimeout(onClose, 380);
  }, [onClose]);

  // Swipe-to-close — non-passive imperative listeners on the drag handle so
  // we can call preventDefault() and block browser pull-to-refresh / OS
  // gesture navigation (Android edge swipe / bottom-bar gesture).
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      dragY.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0 && sheetRef.current) {
        if (e.cancelable) e.preventDefault(); // block pull-to-refresh / OS gesture
        sheetRef.current.style.transition = 'none';
        sheetRef.current.style.transform = `translateY(${dy}px)`;
        dragY.current = dy;
      }
    };
    const onEnd = () => {
      if (!sheetRef.current) return;
      sheetRef.current.style.transition = '';
      if (dragY.current > 80) {
        handleClose();
      } else {
        sheetRef.current.style.transform = 'translateY(0)';
      }
      dragY.current = 0;
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false }); // must be non-passive for preventDefault
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [handleClose]);

  // ── Derived data ─────────────────────────────────────────────
  const icon  = CATEGORY_ICONS[place.category] ?? 'location_on';
  const color = CATEGORY_COLORS[place.category] ?? '#6b7280';
  const bg    = CATEGORY_BG[place.category] ?? 'rgba(107,114,128,.12)';

  const hasGoogleData = !!(
    details?.rating !== undefined || details?.address ||
    details?.open_now !== undefined ||
    (details?.weekday_text?.length ?? 0) > 0 ||
    details?.editorial_summary
  );
  const d = hasGoogleData ? details : null;

  const rating      = d?.rating      ?? place.rating      ?? null;
  const ratingCount = d?.rating_count                     ?? null;
  const openNow     = d?.open_now    ?? place.open_now    ?? null;
  const priceLevel  = d?.price_level ?? place.price_level ?? null;
  const typeTags    = d?.types ? filterTypes(d.types) : [];

  const todayJsDay  = new Date().getDay();
  const rawHoursLine = d?.weekday_text?.length
    ? getHoursLabel(d.weekday_text, todayJsDay) : null;
  const hoursLabel  = rawHoursLine !== null && d?.open_now !== undefined
    ? parseOpenClose(rawHoursLine, d.open_now) : rawHoursLine;

  const description = d?.editorial_summary || place.tags?.description || null;

  const cuisineTags = place.tags?.cuisine
    ? place.tags.cuisine.split(';').map(s => s.trim().replace(/_/g, ' ')).filter(Boolean)
    : [];
  const chips = typeTags.length > 0 ? typeTags : cuisineTags;

  const directionsUrl  = getDirectionsUrl(d?.lat ?? place.lat, d?.lon ?? place.lon);
  const website        = d?.website || place.tags?.website || null;
  const googleMapsUrl  = details?.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${details.place_id}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title + ' ' + city)}`;

  let catLabel = CATEGORY_LABELS[place.category] ?? 'Place';
  if (place.tags?.cuisine) {
    catLabel += ' · ' + place.tags.cuisine.replace(/;/g, ', ').replace(/_/g, ' ');
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.45)',
          backdropFilter: 'blur(2px)',
          zIndex: 39,
          opacity: visible ? 1 : 0,
          transition: 'opacity .38s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#141921',
          borderRadius: '20px 20px 0 0',
          zIndex: 40,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform .38s cubic-bezier(.32,.72,0,1)',
          maxHeight: '80dvh',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 48px rgba(0,0,0,.7)',
          willChange: 'transform',
        }}
      >
        {/* Drag handle */}
        <div
          ref={handleRef}
          style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0, touchAction: 'none' }}
        >
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2 }} />
        </div>

        {/* Hero */}
        <div style={{
          position: 'relative', width: '100%', height: 180,
          background: bg, overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {imgSrc ? (
            <img
              src={imgSrc} alt={place.title}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={handleImgError}
            />
          ) : (
            <span className="ms fill" style={{ fontSize: 56, color: color + '55' }}>{icon}</span>
          )}
          {/* Bottom gradient */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.5) 100%)' }} />

          {/* Open/closed badge */}
          {openNow !== null && (
            <div style={{
              position: 'absolute', bottom: 10, left: 12,
              display: 'inline-flex', alignItems: 'center',
              height: 26, padding: '0 10px', borderRadius: 999,
              background: openNow ? 'rgba(22,163,74,.3)' : 'rgba(220,38,38,.2)',
              border: `1px solid ${openNow ? 'rgba(74,222,128,.3)' : 'rgba(248,113,113,.25)'}`,
              backdropFilter: 'blur(12px)',
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.5px',
              color: openNow ? '#4ade80' : '#f87171',
            }}>
              ● {openNow ? 'Open now' : 'Closed'}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#aaa', fontSize: 14, cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body — minHeight:0 is required for flex child to actually scroll */}
        <div style={{
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: `16px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)`,
          flex: 1, minHeight: 0,
        }}>

          {/* Title + category */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F9F9FF', lineHeight: 1.25 }}>
              {place.title}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(193,198,215,.45)', marginTop: 3 }}>
              {catLabel}
            </div>
          </div>

          {/* Rating + price */}
          {(rating !== null || priceLevel !== null) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {rating !== null && (
                <>
                  <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>★ {rating}</span>
                  {ratingCount !== null && (
                    <span style={{ fontSize: 10, color: '#555' }}>({ratingCount.toLocaleString()})</span>
                  )}
                </>
              )}
              {priceLevel !== null && priceLevel > 0 && (
                <span style={{ fontSize: 10, color: '#666' }}>{PRICE[priceLevel]}</span>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 14 }} />

          {/* Hours */}
          {hoursLabel ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
              <span className="ms" style={{ fontSize: 15, color: 'rgba(193,198,215,.4)', marginTop: 1, flexShrink: 0 }}>schedule</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: (openNow ?? false) ? '#4ade80' : '#f87171' }}>
                    {hoursLabel}
                  </span>
                  {d?.weekday_text && d.weekday_text.length > 0 && (
                    <button
                      onClick={() => setHoursExpanded(e => !e)}
                      style={{ fontSize: 9, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                    >
                      {hoursExpanded ? 'Hide ▴' : 'All hours ▾'}
                    </button>
                  )}
                </div>
                {hoursExpanded && d?.weekday_text && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {d.weekday_text.map((line, i) => {
                      const isToday = i === (todayJsDay === 0 ? 6 : todayJsDay - 1);
                      const colonIdx = line.indexOf(':');
                      const day   = colonIdx > -1 ? line.slice(0, colonIdx) : line;
                      const hours = colonIdx > -1 ? line.slice(colonIdx + 2) : '';
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                          <span style={{ color: isToday ? '#4ade80' : '#555', fontWeight: isToday ? 600 : 400 }}>{day}</span>
                          <span style={{ color: '#888', fontWeight: isToday ? 600 : 400 }}>{hours}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : place.tags?.opening_hours ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="ms" style={{ fontSize: 15, color: 'rgba(193,198,215,.4)', flexShrink: 0 }}>schedule</span>
              <span style={{ fontSize: 11, color: '#aaa', lineHeight: 1.4 }}>{place.tags.opening_hours}</span>
            </div>
          ) : null}

          {/* Description */}
          {description && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(193,198,215,.75)', lineHeight: 1.6, marginBottom: 14 }}>
              {description}
            </div>
          )}

          {/* Type / cuisine chips */}
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {chips.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    height: 28, padding: '0 10px', borderRadius: 999,
                    background: 'rgba(255,255,255,.06)',
                    border: '1px solid rgba(255,255,255,.08)',
                    fontSize: '0.7rem', fontWeight: 600,
                    color: 'rgba(193,198,215,.8)', textTransform: 'capitalize',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Link pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
            <a href={googleMapsUrl} target="_blank" rel="noreferrer" style={{ ...linkBtn, color: '#93c5fd', borderColor: 'rgba(59,130,246,.3)', background: 'rgba(59,130,246,.1)' }}>
              <span className="ms fill" style={{ fontSize: 14 }}>map</span>
              Google Maps
            </a>
            <a href={directionsUrl} target="_blank" rel="noreferrer" style={linkBtn}>
              <span className="ms" style={{ fontSize: 14 }}>directions</span>
              Directions
            </a>
            {website && (
              <a href={website} target="_blank" rel="noreferrer" style={linkBtn}>
                <span className="ms" style={{ fontSize: 14 }}>language</span>
                {(() => { try { return new URL(website).hostname; } catch { return 'Website'; } })()}
              </a>
            )}
            <a
              href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(place.title + ' ' + city)}`}
              target="_blank" rel="noreferrer"
              style={linkBtn}
            >
              <span className="ms" style={{ fontSize: 14 }}>open_in_new</span>
              Wikipedia
            </a>
          </div>

          {/* Add to trip */}
          <button
            onClick={onAdd}
            style={{
              width: '100%',
              background: isSelected ? 'rgba(99,102,241,.15)' : '#6366f1',
              border: isSelected ? '1px solid rgba(99,102,241,.4)' : 'none',
              borderRadius: 14, padding: '13px 0',
              fontSize: 13, fontWeight: 700,
              color: isSelected ? '#a5b4fc' : '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span className="ms" style={{ fontSize: 16 }}>{isSelected ? 'check_circle' : 'add_circle'}</span>
            {isSelected ? 'Added to trip' : 'Add to trip'}
          </button>
        </div>
      </div>
    </>
  );
}
