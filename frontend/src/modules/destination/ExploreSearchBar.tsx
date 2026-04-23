import { useAppStore } from '../../shared/store';
import { CitySearch } from './CitySearch';
import { api } from '../../shared/api';

interface Props {
  onCitySelected: () => void;
}

export function ExploreSearchBar({ onCitySelected }: Props) {
  const { dispatch } = useAppStore();

  async function selectCity(
    name: string,
    googleGeo?: { lat: number; lon: number; name?: string; address?: string } | null,
  ) {
    dispatch({ type: 'SET_CITY', city: name });
    if (googleGeo) {
      const { lat, lon } = googleGeo;
      dispatch({
        type: 'SET_CITY_GEO',
        geo: { lat, lon, bbox: [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05] },
      });
    } else {
      try {
        const geo = await api.geocode(name);
        dispatch({ type: 'SET_CITY_GEO', geo });
      } catch {
        // proceed without geo — map handles it
      }
    }
    onCitySelected();
  }

  function useLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      let resolvedCity = 'My Location';
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = await res.json();
        const addr = data.address ?? {};
        resolvedCity =
          addr.city ?? addr.town ?? addr.village ?? addr.county ?? data.display_name.split(',')[0];
        const bb: [number, number, number, number] = data.boundingbox
          ? [
              parseFloat(data.boundingbox[0]),
              parseFloat(data.boundingbox[1]),
              parseFloat(data.boundingbox[2]),
              parseFloat(data.boundingbox[3]),
            ]
          : [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05];
        dispatch({ type: 'SET_CITY', city: resolvedCity });
        dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: bb } });
      } catch {
        dispatch({ type: 'SET_CITY', city: resolvedCity });
        dispatch({
          type: 'SET_CITY_GEO',
          geo: { lat, lon, bbox: [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05] },
        });
      }
      onCitySelected();
    });
  }

  return (
    <div
      className="px-5 pb-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center gap-2 pr-0.5">
        <div className="flex-1 relative min-w-0">
          <CitySearch onSelect={selectCity} />
        </div>
        <button
          onClick={useLocation}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 h-11 rounded-2xl text-xs font-semibold"
          style={{
            background: 'linear-gradient(135deg, rgba(108,143,255,0.16), rgba(176,108,255,0.16))',
            border: '1px solid rgba(108,143,255,0.22)',
            color: '#8aa8ff',
          }}
        >
          <span className="ms text-sm">my_location</span>
          Near me
        </button>
      </div>
    </div>
  );
}
