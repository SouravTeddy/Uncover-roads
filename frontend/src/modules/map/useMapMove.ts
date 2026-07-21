import { useCallback, useRef } from 'react';

const TILE_ZOOM      = 14;   // ~2.4 km tiles at equator, ~1.5 km at 45°
const DEBOUNCE       = 500;  // ms — wait until the user stops moving
const MIN_ZOOM       = 12;   // don't fetch pins when zoomed too far out
const PREFETCH_DELAY = 600;  // ms after primary fetch fires adjacent tiles

function latLonToTile(lat: number, lon: number, z: number): [number, number] {
  const n = Math.pow(2, z);
  const x = Math.floor((lon + 180) / 360 * n);
  const lr = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n);
  return [x, y];
}

function tileCenter(tx: number, ty: number, z: number): [number, number] {
  const n = Math.pow(2, z);
  const lon = (tx + 0.5) / n * 360 - 180;
  const lr = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n)));
  return [lr * 180 / Math.PI, lon];
}

// N, S, W, E orthogonal neighbours — most likely next direction of travel
const NEIGHBOURS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

interface UseMapMoveProps {
  // Returns true on success, false on abort/error.
  // Primary fetches use isPrefetch=false; neighbour prefetches use isPrefetch=true.
  // Callers must use separate AbortControllers for each so prefetches cannot
  // cancel the primary fetch that was fired for the user's actual position.
  onFetch: (center: [number, number], zoom: number, isPrefetch: boolean) => Promise<boolean>;
  onZoomedOut: () => void;
}

export function useMapMove({ onFetch, onZoomedOut }: UseMapMoveProps) {
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedTiles  = useRef(new Set<string>());
  // Tiles whose fetch is currently in-flight — prevents duplicate concurrent requests
  // for the same tile before the first one has had a chance to settle.
  const inFlightTiles = useRef(new Set<string>());

  const handleMoveEnd = useCallback(
    (center: [number, number], zoom: number) => {
      // Cancel both the debounce and any pending prefetch — fast zoom/pan should
      // only fire a fetch for where the user actually stops, not intermediate tiles.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (prefetchRef.current) clearTimeout(prefetchRef.current);

      debounceRef.current = setTimeout(() => {
        if (zoom < MIN_ZOOM) {
          // Zoomed too far out — clear caches so zooming back in re-fetches fresh data.
          fetchedTiles.current.clear();
          inFlightTiles.current.clear();
          onZoomedOut();
          return;
        }

        const [tx, ty] = latLonToTile(center[0], center[1], TILE_ZOOM);
        const key = `${tx}/${ty}`;

        // Skip if already successfully fetched or currently in-flight.
        if (fetchedTiles.current.has(key) || inFlightTiles.current.has(key)) return;

        // Mark in-flight immediately to block duplicate requests; only move to
        // fetchedTiles once the promise resolves with success=true.
        inFlightTiles.current.add(key);
        onFetch(center, zoom, false).then(success => {
          inFlightTiles.current.delete(key);
          if (success) {
            fetchedTiles.current.add(key);
          } else {
            // Instant retry on failure — one attempt, no delay.
            inFlightTiles.current.add(key);
            onFetch(center, zoom, false).then(retrySuccess => {
              inFlightTiles.current.delete(key);
              if (retrySuccess) fetchedTiles.current.add(key);
            });
          }
        });

        // Prefetch orthogonal neighbours after a longer delay so the primary
        // fetch has time to complete before neighbours are started.
        prefetchRef.current = setTimeout(() => {
          for (const [dx, dy] of NEIGHBOURS) {
            const nKey = `${tx + dx}/${ty + dy}`;
            if (fetchedTiles.current.has(nKey) || inFlightTiles.current.has(nKey)) continue;
            inFlightTiles.current.add(nKey);
            onFetch(tileCenter(tx + dx, ty + dy, TILE_ZOOM), zoom, true).then(success => {
              inFlightTiles.current.delete(nKey);
              if (success) fetchedTiles.current.add(nKey);
            });
          }
        }, PREFETCH_DELAY);
      }, DEBOUNCE);
    },
    [onFetch, onZoomedOut],
  );

  // Called on initial city load so the starting tile is recorded as already fetched,
  // preventing a duplicate fetch when the user pans back to the starting position.
  const setLastFetch = useCallback((center: [number, number]) => {
    const [tx, ty] = latLonToTile(center[0], center[1], TILE_ZOOM);
    fetchedTiles.current.add(`${tx}/${ty}`);
  }, []);

  // Call before flying to a search result — evicts that tile so handleMoveEnd
  // always fires a fresh fetch instead of skipping a stale cache hit.
  const evictTile = useCallback((lat: number, lon: number) => {
    const [tx, ty] = latLonToTile(lat, lon, TILE_ZOOM);
    const key = `${tx}/${ty}`;
    fetchedTiles.current.delete(key);
    inFlightTiles.current.delete(key);
  }, []);

  return { handleMoveEnd, setLastFetch, evictTile };
}
