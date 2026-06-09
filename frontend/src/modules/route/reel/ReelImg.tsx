import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  src: string | null | undefined;
  style: CSSProperties;
  onFallback?: () => void;
}

/**
 * Drop-in replacement for <img> in reel cards.
 * - Shows shimmer while image is loading or src is not yet available.
 * - Retries once after 800ms on first load failure (transient network errors).
 * - Calls onFallback() after a second failure so the parent can show a gradient.
 * - Fades the image in smoothly once loaded.
 */
export function ReelImg({ src, style, onFallback }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
  }, [src]);

  const handleError = () => {
    if (attempt === 0) {
      setTimeout(() => setAttempt(1), 800);
    } else {
      onFallback?.();
    }
  };

  return (
    <>
      {!loaded && (
        <div
          className="shimmer"
          style={{ position: 'absolute', inset: 0, background: '#141210', zIndex: 0 }}
        />
      )}
      {src && (
        <img
          key={`${src}-${attempt}`}
          src={src}
          style={{
            ...style,
            opacity: loaded ? 1 : 0,
            transition: loaded ? 'opacity 0.4s ease' : 'none',
          }}
          alt=""
          onLoad={() => setLoaded(true)}
          onError={handleError}
        />
      )}
    </>
  );
}
