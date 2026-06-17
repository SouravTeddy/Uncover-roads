import { useState, useEffect, useCallback } from 'react';
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setFailed(false);
  }, [src]);

  // When img is already in browser cache, onLoad won't fire — check img.complete on mount.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  const handleError = () => {
    if (attempt === 0) {
      setTimeout(() => setAttempt(1), 800);
    } else {
      setFailed(true);
      onFallback?.();
    }
  };

  const showShimmer = !!src && !loaded && !failed;

  return (
    <>
      {showShimmer && (
        <div
          className="shimmer"
          style={{ position: 'absolute', inset: 0, background: '#141210', zIndex: 0 }}
        />
      )}
      {src && (
        <img
          ref={imgRef}
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
