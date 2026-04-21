import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { useTripPlanInput } from './useTripPlanInput';
import { OriginSearchCard } from './OriginSearchCard';
import { ORIGIN_STRINGS } from '../../shared/strings';
import { computeTotalDays } from './trip-capacity-utils';
import type { OriginPlace } from '../../shared/types';

interface Props {
  onClose: () => void;
}

const SURFACE  = '#141921';
const PRIMARY  = '#3b82f6';
const PRIMARY_BG = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1 = '#f1f5f9';
const TEXT3 = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

export function TripPlanningCard({ onClose }: Props) {
  const { state } = useAppStore();
  const city        = state.city;
  const placesCount = state.selectedPlaces.length;
  const { travelStartDate, travelEndDate } = state;
  const totalDays = computeTotalDays(travelStartDate, travelEndDate);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const { handleBuild } = useTripPlanInput();

  function formatDateShort(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function handleOriginDone(origin: OriginPlace | null) {
    handleBuild(origin);
    onClose();
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 16, right: 16,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
          zIndex: 51,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 48px)',
        }}
      >
        {/* Header */}
        <div style={{
          position: 'relative',
          padding: '22px 20px 18px',
          background: `linear-gradient(135deg, rgba(59,130,246,.08) 0%, rgba(15,23,42,0) 60%)`,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: PRIMARY, marginBottom: 6,
            fontFamily: 'Inter, sans-serif',
          }}>
            Plan your day
          </div>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 22, fontWeight: 800, color: TEXT1, lineHeight: 1.1,
          }}>
            {city || 'Your City'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {travelStartDate && travelEndDate ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 24, padding: '0 10px',
                background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
                borderRadius: 999,
              }}>
                <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>calendar_month</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                  {formatDateShort(travelStartDate)} – {formatDateShort(travelEndDate)} · {totalDays} day{totalDays !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 24, padding: '0 10px',
                background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`,
                borderRadius: 999,
              }}>
                <span className="ms" style={{ fontSize: 12, color: TEXT3 }}>calendar_month</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: TEXT3, fontFamily: 'Inter, sans-serif' }}>
                  Set dates in explore
                </span>
              </div>
            )}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 24, padding: '0 10px',
              background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
              borderRadius: 999,
            }}>
              <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>place</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                {placesCount} place{placesCount !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 17, fontWeight: 700, color: '#f1f5f9',
            lineHeight: 1.3, marginBottom: 16,
          }}>
            {ORIGIN_STRINGS.cardHeading}
          </div>
          <OriginSearchCard onDone={handleOriginDone} />
        </div>
      </div>
    </>,
    document.body,
  );
}
