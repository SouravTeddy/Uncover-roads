import { useState } from 'react';
import { CitySearch } from './CitySearch';

interface ExploreSearchBarProps {
  onCitySelect: (city: string, geo?: import('../../shared/types').GeoData) => void;
  onNearMe: () => void;
}

export function ExploreSearchBar({ onCitySelect, onNearMe }: ExploreSearchBarProps) {
  const [showSearch, setShowSearch] = useState(false);

  function handleSelect(city: string, geo?: { lat: number; lon: number; name?: string; address?: string } | null) {
    onCitySelect(city, geo ? (geo as import('../../shared/types').GeoData) : undefined);
    setShowSearch(false);
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {/* Tappable search bar */}
      <button
        type="button"
        onClick={() => setShowSearch(true)}
        className="flex-1 flex items-center gap-2 h-[44px] px-3 rounded-xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <span className="ms" style={{ color: 'var(--color-text-3)', fontSize: '20px' }}>search</span>
        <span className="text-sm" style={{ color: 'var(--color-text-3)' }}>
          Search city or country...
        </span>
      </button>

      {/* Near me button */}
      <button
        type="button"
        onClick={onNearMe}
        className="flex-shrink-0 flex items-center justify-center w-[44px] h-[44px] rounded-xl"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
        aria-label="Use my location"
      >
        <span className="ms" style={{ color: 'var(--color-text-3)', fontSize: '20px' }}>near_me</span>
      </button>

      {/* CitySearch overlay */}
      {showSearch && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'var(--color-bg)' }}
        >
          <div className="p-4">
            <CitySearch onSelect={(city, geo) => handleSelect(city, geo)} />
          </div>
          <button
            type="button"
            onClick={() => setShowSearch(false)}
            className="mx-4 mt-2 text-sm"
            style={{ color: 'var(--color-text-3)' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
