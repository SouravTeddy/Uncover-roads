import { useEffect, useRef } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import type { FavouritedPin } from '../../shared/types';
import { CATEGORY_ICONS } from './types';

// ── Pure helper (exported for testing) ──────────────────────────────────────

export function computeCentroid(
  pins: { lat: number; lon: number }[],
): { lat: number; lon: number } | null {
  if (pins.length === 0) return null;
  const lat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
  const lon = pins.reduce((s, p) => s + p.lon, 0) / pins.length;
  return { lat, lon };
}

// ── FavoritesMarker ──────────────────────────────────────────────────────────

interface MarkerProps {
  pins: FavouritedPin[];
  onClick: () => void;
}

export function FavoritesMarker({ pins, onClick }: MarkerProps) {
  const centroid = computeCentroid(pins);
  if (!centroid || pins.length === 0) return null;

  return (
    <Marker
      latitude={centroid.lat}
      longitude={centroid.lon}
      anchor="center"
      onClick={(e) => { e.originalEvent.stopPropagation(); onClick(); }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(15,20,30,.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,.15)',
          boxShadow: '0 4px 16px rgba(0,0,0,.5)',
          fontSize: '0.78rem', fontWeight: 700, color: '#f9f9ff',
          cursor: 'pointer', userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: 14 }}>❤️</span>
        <span>{pins.length}</span>
      </div>
    </Marker>
  );
}

// ── FavoritesSheet ───────────────────────────────────────────────────────────

interface SheetProps {
  pins: FavouritedPin[];
  onClose: () => void;
  onSelect: (pin: FavouritedPin) => void;
}

export function FavoritesSheet({ pins, onClose, onSelect }: SheetProps) {
  const sheetRef    = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const dragY       = useRef(0);

  // Swipe-to-dismiss — same pattern as cluster picker in MapScreen
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      dragY.current = 0;
    };
    const onMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0 && el) {
        if (e.cancelable) e.preventDefault();
        el.style.transition = 'none';
        el.style.transform  = `translateY(${dy}px)`;
        dragY.current = dy;
      }
    };
    const onEnd = () => {
      if (!el) return;
      el.style.transition = '';
      if (dragY.current > 80) {
        el.style.transform = 'translateY(100%)';
        setTimeout(onClose, 220);
      } else {
        el.style.transform = 'translateY(0)';
      }
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
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.4)',
          zIndex: 19,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(15,20,30,.96)',
          backdropFilter: 'blur(16px)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(255,255,255,.1)',
          zIndex: 20,
          maxHeight: '60dvh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,.6)',
          transition: 'transform 0.22s ease',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px', touchAction: 'none' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>❤️</span>
            <span style={{ color: '#f9f9ff', fontWeight: 700, fontSize: '0.9rem' }}>
              Your saved places
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, color: '#6366f1',
              background: 'rgba(99,102,241,.15)', padding: '2px 7px', borderRadius: 999,
            }}>
              {pins.length}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: 1 }}>
          {pins.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '32px 16px', color: 'rgba(193,198,215,.4)', fontSize: '0.82rem', textAlign: 'center',
            }}>
              Tap ❤️ on any place to save it here
            </div>
          ) : (
            pins.map((pin, i) => (
              <button
                key={pin.placeId}
                onClick={() => onSelect(pin)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : undefined,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(99,102,241,.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="ms fill text-primary" style={{ fontSize: 16 }}>
                    {CATEGORY_ICONS['place']}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#f9f9ff', fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pin.title}
                  </div>
                  <div style={{ color: 'rgba(193,198,215,.45)', fontSize: '0.72rem', marginTop: 2 }}>
                    {pin.city}
                  </div>
                </div>
                <span className="ms" style={{ fontSize: 16, color: 'rgba(255,255,255,.25)' }}>chevron_right</span>
              </button>
            ))
          )}
          {/* Safe area bottom padding */}
          <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
        </div>
      </div>
    </>
  );
}
