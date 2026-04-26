import { useState, useEffect, useRef, useCallback } from 'react';
import type { Place, PlaceDetails, ReferencePin } from '../../shared/types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import { getPlacePhotoUrl, api } from '../../shared/api';
import { getTravelDateBadge } from './pincard-utils';

interface Props {
  place: Place;
  city: string;
  isSelected: boolean;
  isFavourited: boolean;
  onAdd: () => void;
  onClose: () => void;
  onSimilar: () => void;
  onFavourite: () => void;
  details?: PlaceDetails | null;
  referencePin?: ReferencePin | null;
  travelDate?: string | null;
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

export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onSimilar, onFavourite,
  details, referencePin, travelDate,
}: Props) {
  const [visible, setVisible]   = useState(false);
  const [imgSrc, setImgSrc]     = useState<string | null>(null);
  const sheetRef    = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const dragY       = useRef(0);
  const closing     = useRef(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overscrollBehaviorY = 'none';
    return () => {
      cancelAnimationFrame(id);
      document.documentElement.style.overscrollBehaviorY = '';
      document.body.style.overscrollBehaviorY = '';
    };
  }, []);

  const photoRef       = details?.photo_ref ?? place.photo_ref ?? null;
  const googlePhotoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null;

  useEffect(() => {
    closing.current = false;
    if (googlePhotoUrl) {
      setImgSrc(googlePhotoUrl);
    } else {
      setImgSrc(null);
      api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, googlePhotoUrl]);

  const handleImgError = useCallback(() => {
    api.placeImage(place.title, city).then(url => setImgSrc(url));
  }, [place.title, city]);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setVisible(false);
    setTimeout(onClose, 380);
  }, [onClose]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; dragY.current = 0; };
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0 && (scrollRef.current?.scrollTop ?? 0) === 0 && sheetRef.current) {
        if (e.cancelable) e.preventDefault();
        sheetRef.current.style.transition = 'none';
        sheetRef.current.style.transform = `translateY(${dy}px)`;
        dragY.current = dy;
      }
    };
    const onEnd = () => {
      if (!sheetRef.current) return;
      sheetRef.current.style.transition = '';
      if (dragY.current > 80) handleClose();
      else sheetRef.current.style.transform = 'translateY(0)';
      dragY.current = 0;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
      el.removeEventListener('touchend',   onEnd);
    };
  }, [handleClose]);

  const icon  = CATEGORY_ICONS[place.category] ?? 'location_on';
  const color = CATEGORY_COLORS[place.category] ?? '#6b7280';
  const bg    = CATEGORY_BG[place.category] ?? 'rgba(107,114,128,.12)';

  const d = details ?? null;
  const rating      = d?.rating      ?? place.rating      ?? null;
  const ratingCount = d?.rating_count                     ?? null;
  const priceLevel  = d?.price_level ?? place.price_level ?? null;

  const travelBadge = travelDate && d?.weekday_text?.length
    ? getTravelDateBadge(d.weekday_text, travelDate)
    : null;

  const intelPills: { text: string; color: string; bg: string }[] = [];
  if (travelBadge?.status === 'closed') {
    intelPills.push({ text: travelBadge.text, color: '#fbbf24', bg: 'rgba(251,191,36,.12)' });
  }
  if (place.tags?.entry_requirement && intelPills.length < 2) {
    intelPills.push({
      text: place.tags.entry_requirement,
      color: '#94a3b8',
      bg: 'rgba(148,163,184,.1)',
    });
  }

  const whyRec = referencePin?.whyRec ?? place.reason ?? null;
  const localTip = referencePin?.localTip ?? null;

  const googleMapsUrl = details?.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${details.place_id}`
    : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
  const website = d?.website || place.tags?.website || null;

  let catLabel = CATEGORY_LABELS[place.category] ?? 'Place';
  if (place.tags?.cuisine) {
    catLabel += ' · ' + place.tags.cuisine.replace(/;/g, ', ').replace(/_/g, ' ');
  }

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)',
          zIndex: 39, opacity: visible ? 1 : 0,
          transition: 'opacity .38s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#141921', borderRadius: '20px 20px 0 0',
          zIndex: 40,
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform .38s cubic-bezier(.32,.72,0,1)',
          maxHeight: '80dvh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 48px rgba(0,0,0,.7)',
          willChange: 'transform',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0, touchAction: 'none' }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2 }} />
        </div>

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
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.5) 100%)' }} />

          {travelBadge?.status === 'open' && (
            <div style={{
              position: 'absolute', bottom: 10, left: 12,
              display: 'inline-flex', alignItems: 'center',
              height: 26, padding: '0 10px', borderRadius: 999,
              background: 'rgba(22,163,74,.3)',
              border: '1px solid rgba(74,222,128,.3)',
              backdropFilter: 'blur(12px)',
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.5px',
              color: '#4ade80',
            }}>
              {travelBadge.text}
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onFavourite(); }}
            style={{
              position: 'absolute', top: 10, right: 44,
              background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer',
            }}
            aria-label={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
          >
            {isFavourited ? '❤️' : '🤍'}
          </button>

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

        <div ref={scrollRef} style={{
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: `16px 20px calc(env(safe-area-inset-bottom, 0px) + 24px)`,
          flex: 1, minHeight: 0,
        }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F9F9FF', lineHeight: 1.25 }}>
              {place.title}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(193,198,215,.45)', marginTop: 3 }}>
              {catLabel}
            </div>
          </div>

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

          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', marginBottom: 14 }} />

          {intelPills.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {intelPills.map((pill, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 10,
                  background: pill.bg,
                  border: `1px solid ${pill.color}30`,
                  fontSize: '0.75rem', color: pill.color, lineHeight: 1.4,
                }}>
                  {pill.text}
                </div>
              ))}
            </div>
          )}

          {whyRec && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.8px',
                textTransform: 'uppercase', color: '#6366f1', marginBottom: 5,
              }}>
                Why this for you
              </div>
              <div style={{
                fontSize: '0.85rem', color: 'rgba(193,198,215,.85)',
                lineHeight: 1.55, fontStyle: 'italic',
              }}>
                {whyRec}
              </div>
            </div>
          )}

          {localTip && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(251,191,36,.07)',
              border: '1px solid rgba(251,191,36,.15)',
              marginBottom: 14,
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
                Local tip
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(193,198,215,.8)', lineHeight: 1.5 }}>
                {localTip}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
            <a href={googleMapsUrl} target="_blank" rel="noreferrer"
              style={{ ...linkBtn, color: '#93c5fd', borderColor: 'rgba(59,130,246,.3)', background: 'rgba(59,130,246,.1)' }}>
              <span className="ms fill" style={{ fontSize: 14 }}>map</span>
              Google Maps
            </a>
            {website && (
              <a href={website} target="_blank" rel="noreferrer" style={linkBtn}>
                <span className="ms" style={{ fontSize: 14 }}>language</span>
                {(() => { try { return new URL(website).hostname; } catch { return 'Website'; } })()}
              </a>
            )}
          </div>

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
              marginBottom: 10,
            }}
          >
            <span className="ms" style={{ fontSize: 16 }}>{isSelected ? 'check_circle' : 'add_circle'}</span>
            {isSelected ? 'Added to itinerary' : 'Add to itinerary'}
          </button>

          <button
            onClick={() => { handleClose(); onSimilar(); }}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid rgba(99,102,241,.35)',
              borderRadius: 14, padding: '12px 0',
              fontSize: 13, fontWeight: 700, color: '#a5b4fc',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            ✦ Similar
          </button>
        </div>
      </div>
    </>
  );
}
