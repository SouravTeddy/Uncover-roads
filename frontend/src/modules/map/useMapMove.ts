import { useCallback, useRef } from 'react';

interface UseMapMoveProps {
  onFetch: (center: [number, number], zoom: number) => void;
  onZoomedOut: () => void;
}

export function useMapMove({ onFetch, onZoomedOut }: UseMapMoveProps) {
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<[number, number] | null>(null);

  const handleMoveEnd = useCallback(
    (center: [number, number], zoom: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        // Zoom gate — don't load pins when zoomed too far out
        if (zoom < 12) {
          // Clear lastFetch so zooming back in always triggers a fresh fetch
          lastFetchRef.current = null;
          onZoomedOut();
          return;
        }

        // Displacement check — only fetch if moved >40% of viewport width
        const viewportWidthDeg = 360 / Math.pow(2, zoom);
        const thresholdDeg = viewportWidthDeg * 0.4;

        if (lastFetchRef.current) {
          const [lastLat, lastLon] = lastFetchRef.current;
          const dLat = Math.abs(center[0] - lastLat);
          const dLon = Math.abs(center[1] - lastLon);
          if (dLat < thresholdDeg && dLon < thresholdDeg) return;
        }

        lastFetchRef.current = center;
        onFetch(center, zoom);
      }, 700);
    },
    [onFetch, onZoomedOut],
  );

  // Call when a fetch is initiated externally (e.g. initial load)
  // so the displacement check starts from the right position
  const setLastFetch = useCallback((center: [number, number]) => {
    lastFetchRef.current = center;
  }, []);

  return { handleMoveEnd, setLastFetch };
}
