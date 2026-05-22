import { useEffect, useRef, useState } from 'react';
import type { ReelStopCard } from './types';
import { getPlacePhotoUrl } from '../../../shared/api';

interface Props {
  card: ReelStopCard;
  active: boolean;
  onRemove: (stopId: string) => void;
}

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.5) 62%, rgba(0,0,0,.88) 82%, rgba(0,0,0,.97) 100%)';

const REASON_ICONS: Record<string, string> = {
  opening_hours: 'schedule',
  golden_hour:   'wb_sunny',
  walking:       'directions_walk',
  crowd:         'groups',
  meal:          'restaurant',
  default:       'auto_fix_high',
};

function inferReasonIcon(reason: string | null): string {
  if (!reason) return REASON_ICONS.default;
  if (/hour|open|clos/i.test(reason)) return REASON_ICONS.opening_hours;
  if (/light|golden|sunset|sunrise/i.test(reason)) return REASON_ICONS.golden_hour;
  if (/walk|distance|km/i.test(reason)) return REASON_ICONS.walking;
  if (/crowd|busy|quiet/i.test(reason)) return REASON_ICONS.crowd;
  return REASON_ICONS.default;
}

export function ReelStopCard({ card, active, onRemove }: Props) {
  const [visible, setVisible] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [active]);

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -120));
  }
  function onTouchEnd() {
    setSwiping(false);
    if (swipeX < -80) {
      onRemove(card.stop.id);
    } else {
      setSwipeX(0);
    }
  }

  const { stop, stopNumber, totalStops, orderReason, orderConsequence, movedFrom } = card;
  const imageUrl = stop.imageUrl ?? (stop.photoRef ? getPlacePhotoUrl(stop.photoRef, 400) : null);

  return (
    <div
      className="reel-card"
      style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {imageUrl
        ? <img src={imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `translateX(${swipeX * 0.1}px)`, transition: swiping ? 'none' : 'transform .3s ease' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #111114, #1a1420)' }} />
      }
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      {/* Delete reveal */}
      <div style={{
        position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)',
        opacity: Math.min(1, Math.abs(swipeX) / 80),
        transition: swiping ? 'none' : 'opacity .3s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,.2)', border: '1px solid rgba(239,68,68,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ms" style={{ fontSize: 22, color: '#ef4444' }}>delete</span>
        </div>
        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Remove</span>
      </div>

      {/* Card content */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${swipeX}px)`, transition: swiping ? 'none' : 'transform .3s cubic-bezier(.25,0,0,1)' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 80px' }}>

          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 4, opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>
            Stop {stopNumber} of {totalStops}
          </p>

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 8 }}>
            {stop.time}
            <span style={{ color: 'rgba(255,255,255,.4)', margin: '0 6px' }}>·</span>
            {stop.durationMin}min
          </p>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginBottom: 12, animation: visible ? 'fadeUp .5s .12s both' : 'none' }}>
            {stop.title}
          </h2>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, animation: visible ? 'fadeUp .5s .2s both' : 'none' }}>
            <span style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(6px)', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
              {stop.category}
            </span>
            {stop.area && (
              <span style={{ padding: '4px 9px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.28)', backdropFilter: 'blur(6px)', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
                {stop.area}
              </span>
            )}
            {movedFrom !== null && (
              <span style={{ padding: '4px 9px', borderRadius: 999, background: 'rgba(212,168,83,.08)', border: '1px solid rgba(212,168,83,.18)', fontSize: 11, color: '#d4a853', fontWeight: 700 }}>
                ↑ moved
              </span>
            )}
          </div>

          {orderReason && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', padding: '8px 12px', borderRadius: 12, animation: visible ? 'fadeUp .5s .25s both' : 'none' }}>
              <span className="ms" style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', flexShrink: 0, marginTop: 1 }}>{inferReasonIcon(orderReason)}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.5 }}>
                {orderReason}
                {orderConsequence && (
                  <> · <span style={{ color: 'rgba(255,255,255,.45)' }}>{orderConsequence}</span></>
                )}
              </span>
            </div>
          )}

          {(stop.localTip || stop.whyForYou) && (
            <p style={{ fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', animation: visible ? 'fadeUp .5s .3s both' : 'none' }}>
              {stop.localTip ?? stop.whyForYou}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
