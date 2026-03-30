import { useAppStore } from '../../shared/store';
import { CitySearch } from './CitySearch';
import { TRENDING_CITIES } from './types';
import { api } from '../../shared/api';

export function DestinationScreen() {
  const { dispatch } = useAppStore();

  async function selectCity(name: string) {
    dispatch({ type: 'SET_CITY', city: name });
    try {
      const geo = await api.geocode(name);
      dispatch({ type: 'SET_CITY_GEO', geo });
    } catch {
      // proceed anyway — map will handle missing geo
    }
    dispatch({ type: 'GO_TO', screen: 'map' });
  }

  async function useLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      dispatch({
        type: 'SET_TRIP_CONTEXT',
        ctx: { locationLat: lat, locationLon: lon },
      });
      dispatch({ type: 'GO_TO', screen: 'map' });
    });
  }

  // Group trending cities for the bento layout
  const lg = TRENDING_CITIES.find(c => c.size === 'lg')!;
  const md = TRENDING_CITIES.find(c => c.size === 'md')!;
  const smCities = TRENDING_CITIES.filter(c => c.size === 'sm');

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/6 flex-shrink-0">
        <h1 className="font-heading font-bold text-text-1 text-lg">Uncover Roads</h1>
        <div className="w-8 h-8 rounded-full overflow-hidden bg-surface">
          <img src="https://i.pravatar.cc/80?img=11" alt="" className="w-full h-full object-cover" />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24">
        <h2 className="font-heading font-extrabold text-text-1 text-2xl mb-5 tracking-tight">
          Where to next?
        </h2>

        {/* Search */}
        <div className="mb-4">
          <CitySearch onSelect={selectCity} />
        </div>

        {/* Use location */}
        <button
          onClick={useLocation}
          className="w-full flex items-center justify-center gap-3 h-12 rounded-2xl bg-primary/10 text-primary font-medium text-sm border border-primary/20 mb-6"
        >
          <span className="ms text-base">near_me</span>
          Get My Current Location
        </button>

        {/* Trending section */}
        <p className="text-text-3 text-xs uppercase tracking-widest mb-1">Curated Selection</p>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-text-1 text-lg">Trending Destinations</h2>
          <button className="text-primary text-xs font-semibold">View all</button>
        </div>

        {/* Bento grid */}
        <div className="flex flex-col gap-3">
          {/* Large card */}
          <BentoCity city={lg} onSelect={selectCity} className="aspect-[2/1]" />

          {/* Medium card */}
          <BentoCity city={md} onSelect={selectCity} className="aspect-[2/1]" />

          {/* Small cards - 2 per row */}
          {[0, 1].map(row => (
            <div key={row} className="grid grid-cols-2 gap-3">
              {smCities.slice(row * 2, row * 2 + 2).map(city => (
                <BentoCity key={city.name} city={city} onSelect={selectCity} className="aspect-square" />
              ))}
            </div>
          ))}
        </div>

        {/* AI section */}
        <div className="mt-6 bg-surface rounded-2xl p-5">
          <h3 className="font-heading font-bold text-text-1 text-base mb-2">
            Can&apos;t decide where to go?
          </h3>
          <p className="text-text-2 text-sm mb-4">
            Let Uncover Roads AI analyze your travel style and recommend the perfect destination.
          </p>
          <button className="px-5 py-2.5 rounded-2xl bg-primary/10 text-primary font-semibold text-sm border border-primary/20">
            Ask Uncover Roads AI
          </button>
        </div>
      </div>
    </div>
  );
}

function BentoCity({
  city,
  onSelect,
  className,
}: {
  city: (typeof TRENDING_CITIES)[number];
  onSelect: (name: string) => void;
  className: string;
}) {
  return (
    <div
      onClick={() => onSelect(city.name)}
      className={`relative overflow-hidden rounded-2xl cursor-pointer ${className}`}
    >
      <img src={city.imageUrl} alt={city.name} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      {city.badge && (
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-primary/80 text-white text-xs font-bold">
          {city.badge}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="font-heading font-bold text-white text-lg">{city.name}</h3>
        {city.description && (
          <p className="text-white/70 text-xs">{city.description}</p>
        )}
      </div>
    </div>
  );
}
