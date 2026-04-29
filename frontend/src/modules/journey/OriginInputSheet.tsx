import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { OriginSearchCard } from '../map/OriginSearchCard';
import { ORIGIN_STRINGS } from '../../shared/strings';
import type { OriginPlace } from '../../shared/types';

const PRIMARY = '#3b82f6';
const TEXT1   = '#f1f5f9';
const TEXT3   = '#8e9099';
const BORDER  = 'rgba(255,255,255,.08)';
const SURFACE = '#141921';

interface Props {
  onDone: (origin: OriginPlace | null) => void;
  onClose: () => void;
}

export function OriginInputSheet({ onDone, onClose }: Props) {
  const { dispatch } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleDone(origin: OriginPlace | null) {
    if (origin) {
      dispatch({ type: 'SET_JOURNEY_ORIGIN', place: origin });
    }
    onDone(origin);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 65,
          background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0, transition: 'opacity .3s',
        }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: 16, right: 16,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          zIndex: 66, background: SURFACE,
          border: `1px solid ${BORDER}`, borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 20px 18px', borderBottom: `1px solid ${BORDER}`, position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16, width: 32, height: 32,
              borderRadius: '50%', background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
            color: PRIMARY, marginBottom: 6, fontFamily: 'var(--font-sans)',
          }}>
            Starting point
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800, color: TEXT1 }}>
            {ORIGIN_STRINGS.cardHeading}
          </div>
        </div>
        <div style={{ padding: '20px 20px 24px' }}>
          <OriginSearchCard onDone={handleDone} />
        </div>
      </div>
    </>,
    document.body,
  );
}
