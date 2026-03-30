import { useState, useCallback } from 'react';
import { useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';

const MOVE_THRESHOLD_M = 200; // metres

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface UseMapMoveResult {
  showSearchHere: boolean;
  currentCenter: { lat: number; lon: number } | null;
  currentBbox: [number, number, number, number] | null; // [south, north, west, east]
  resetSearchHere: () => void;
}

export function useMapMove(
  initialCenter: { lat: number; lon: number } | null,
): UseMapMoveResult {
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [currentCenter, setCurrentCenter] = useState(initialCenter);
  const [currentBbox, setCurrentBbox] = useState<[number, number, number, number] | null>(null);
  const [baseCenter, setBaseCenter] = useState(initialCenter);

  useMapEvents({
    moveend(e) {
      const map: LeafletMap = e.target;
      const center = map.getCenter();
      const bounds = map.getBounds();
      const newCenter = { lat: center.lat, lon: center.lng };
      const bbox: [number, number, number, number] = [
        bounds.getSouth(),
        bounds.getNorth(),
        bounds.getWest(),
        bounds.getEast(),
      ];
      setCurrentCenter(newCenter);
      setCurrentBbox(bbox);

      if (baseCenter) {
        const dist = haversineM(baseCenter.lat, baseCenter.lon, center.lat, center.lng);
        if (dist > MOVE_THRESHOLD_M) {
          setShowSearchHere(true);
        }
      } else {
        setBaseCenter(newCenter);
      }
    },
  });

  const resetSearchHere = useCallback(() => {
    setShowSearchHere(false);
    setBaseCenter(currentCenter);
  }, [currentCenter]);

  return { showSearchHere, currentCenter, currentBbox, resetSearchHere };
}
