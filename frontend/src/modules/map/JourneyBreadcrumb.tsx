import { useEffect, useState } from 'react';

interface Props {
  cities: string[];
}

/**
 * Animated pill strip showing the journey cities in order.
 * Fades + slides in when journey mode activates (>1 city).
 * Returns null when only 1 city is selected.
 */
export function JourneyBreadcrumb({ cities }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (cities.length > 1) {
      // Defer to next frame so CSS transition fires
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
    }
  }, [cities.length]);

  if (cities.length <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
        scrollbarWidth: 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity .35s ease, transform .35s ease',
        pointerEvents: 'auto',
      }}
    >
      {cities.map((city, i) => (
        <span key={city + i} style={{ display: 'contents' }}>
          <span
            style={{
              flexShrink: 0,
              height: 26,
              padding: '0 10px',
              background: 'rgba(59,130,246,.12)',
              border: '1px solid rgba(59,130,246,.25)',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: '#93c5fd',
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              letterSpacing: 0.3,
              whiteSpace: 'nowrap',
            }}
          >
            {city}
          </span>
          {i < cities.length - 1 && (
            <span
              className="ms"
              style={{ fontSize: 13, color: 'rgba(148,163,184,.4)', flexShrink: 0 }}
            >
              arrow_forward
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
