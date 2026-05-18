import { CitySearch } from './CitySearch';
import type { GeoData } from '../../shared/types';

interface ExploreSearchBarProps {
  onCitySelect: (city: string, geo?: GeoData) => void;
}

export function ExploreSearchBar({ onCitySelect }: ExploreSearchBarProps) {
  function handleSelect(city: string, geo?: { lat: number; lon: number; name?: string; address?: string } | null) {
    onCitySelect(city, geo ? (geo as GeoData) : undefined);
  }

  return (
    <div className="px-4 py-3">
      <CitySearch onSelect={handleSelect} />
    </div>
  );
}
