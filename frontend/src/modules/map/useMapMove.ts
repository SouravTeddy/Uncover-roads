// modules/map/useMapMove.ts
import { useCallback } from 'react';

interface UseMapMoveProps {
  onSearchHere: (center: [number, number]) => void;
}

export function useMapMove({ onSearchHere }: UseMapMoveProps) {
  const handleMoveEnd = useCallback(
    (center: [number, number], _zoom: number) => {
      onSearchHere(center);
    },
    [onSearchHere]
  );

  return { handleMoveEnd };
}
