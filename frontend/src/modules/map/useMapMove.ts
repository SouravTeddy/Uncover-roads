import { useCallback, useRef } from 'react';

const TILE_ZOOM  = 14;   // ~2.4 km tiles at equator, ~1.5 km at 45°
const DEBOUNCE   = 500;  // ms — wait until the user stops moving
const MIN_ZOOM   = 12;   // don't fetch pins when zoomed too far out
const PREFETCH_DELAY = 350; // ms after primary fetch fires adjacent tiles

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
  onFetch: (center: [number, number], zoom: number) => void;
  onZoomedOut: () => void;
}

export function useMapMove({ onFetch, onZoomedOut }: UseMapMoveProps) {
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedTiles = useRef(new Set<string>());

  const handleMoveEnd = useCallback(
    (center: [number, number], zoom: number) => {
      // Cancel both the debounce and any pending prefetch — fast zoom/pan should
      // only fire a fetch for where the user actually stops, not intermediate tiles
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (prefetchRef.current) clearTimeout(prefetchRef.current);

      debounceRef.current = setTimeout(() => {
        if (zoom < MIN_ZOOM) {
          // Zoomed too far out — clear cache so zooming back in re-fetches fresh data
          fetchedTiles.current.clear();
          onZoomedOut();
          return;
        }

        const [tx, ty] = latLonToTile(center[0], center[1], TILE_ZOOM);
        const key = `${tx}/${ty}`;

        // Tile already fetched — nothing to do
        if (fetchedTiles.current.has(key)) return;

        // Primary tile
        fetchedTiles.current.add(key);
        onFetch(center, zoom);

        // Prefetch orthogonal neighbours after a short delay so the primary
        // fetch gets a head start and the server isn't hit by 5 requests at once
        if (prefetchRef.current) clearTimeout(prefetchRef.current);
        prefetchRef.current = setTimeout(() => {
          for (const [dx, dy] of NEIGHBOURS) {
            const nKey = `${tx + dx}/${ty + dy}`;
            if (!fetchedTiles.current.has(nKey)) {
              fetchedTiles.current.add(nKey);
              onFetch(tileCenter(tx + dx, ty + dy, TILE_ZOOM), zoom);
            }
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

  return { handleMoveEnd, setLastFetch };
}
