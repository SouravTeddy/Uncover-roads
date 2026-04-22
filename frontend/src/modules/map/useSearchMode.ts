import { useState, useCallback } from 'react';
import type { Place, Category } from '../../shared/types';
import { searchNearby, api } from '../../shared/api';

export interface StructuredQuery {
  category: Category;
  locationName: string;
  locationLat: number;
  locationLon: number;
  date?: string; // ISO date, only for 'event' category
}

export interface SearchResult extends Place {
  searchIndex: number;
}

interface SearchModeState {
  isActive: boolean;
  queryLabel: string;
  searchResults: SearchResult[];
  activeResultIndex: number;
  addedIds: Set<string>;
  isLoading: boolean;
}

// Maps our app Category to Google Places API type string
const CATEGORY_TO_GOOGLE_TYPE: Record<string, string> = {
  museum: 'museum',
  restaurant: 'restaurant',
  cafe: 'cafe',
  park: 'park',
  historic: 'tourist_attraction',
  tourism: 'tourist_attraction',
  place: 'point_of_interest',
  event: 'point_of_interest',
};

export function useSearchMode(city: string) {
  const [state, setState] = useState<SearchModeState>({
    isActive: false,
    queryLabel: '',
    searchResults: [],
    activeResultIndex: 0,
    addedIds: new Set(),
    isLoading: false,
  });

  const executeQuery = useCallback(
    async (query: StructuredQuery) => {
      const label = `${query.category} near ${query.locationName}${query.date ? ` · ${query.date}` : ''}`;
      setState(s => ({
        ...s,
        isActive: true,
        queryLabel: label,
        isLoading: true,
        searchResults: [],
        activeResultIndex: 0,
        addedIds: new Set(),
      }));

      try {
        let results: Place[];

        if (query.category === 'event' && query.date) {
          const raw = await api.events(city, query.date, query.date, query.locationLat, query.locationLon);
          results = (Array.isArray(raw) ? raw : []).map((p, i) => ({
            ...p,
            id: p.id ?? `search-event-${i}`,
          }));
        } else {
          const googleType = CATEGORY_TO_GOOGLE_TYPE[query.category] ?? 'point_of_interest';
          const raw = await searchNearby(query.locationLat, query.locationLon, googleType, 1500, 15);
          results = raw.map((r, i): Place => ({
            id: r.place_id || `search-${query.category}-${i}`,
            title: r.name,
            category: query.category,
            lat: r.lat,
            lon: r.lon,
            rating: r.rating,
            place_id: r.place_id,
          }));
        }

        const searchResults: SearchResult[] = results.map((p, i) => ({
          ...p,
          searchIndex: i,
        }));

        setState(s => ({ ...s, isLoading: false, searchResults }));
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    },
    [city],
  );

  const clearSearch = useCallback(() => {
    setState({
      isActive: false,
      queryLabel: '',
      searchResults: [],
      activeResultIndex: 0,
      addedIds: new Set(),
      isLoading: false,
    });
  }, []);

  const goToResult = useCallback((index: number) => {
    setState(s => ({
      ...s,
      activeResultIndex: Math.max(0, Math.min(index, s.searchResults.length - 1)),
    }));
  }, []);

  const markAdded = useCallback((id: string) => {
    setState(s => {
      const addedIds = new Set(s.addedIds);
      addedIds.add(id);
      // Advance to next unread result after adding
      const next = Math.min(s.activeResultIndex + 1, s.searchResults.length - 1);
      return { ...s, addedIds, activeResultIndex: next };
    });
  }, []);

  return {
    isActive: state.isActive,
    queryLabel: state.queryLabel,
    searchResults: state.searchResults,
    activeResultIndex: state.activeResultIndex,
    addedIds: state.addedIds,
    isLoading: state.isLoading,
    executeQuery,
    clearSearch,
    goToResult,
    markAdded,
  };
}
