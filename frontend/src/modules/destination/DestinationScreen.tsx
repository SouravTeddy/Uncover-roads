import { useAppStore } from '../../shared/store';
import { CitySearch } from './CitySearch';
import { ARCHETYPE_CITIES, DEFAULT_CITIES } from './types';
import { ARCHETYPE_COLORS } from '../persona/types';
import { api } from '../../shared/api';
import type { SavedItinerary } from '../../shared/types';

export function DestinationScreen() {
  const { state, dispatch } = useAppStore();
  const { persona, savedItineraries } = state;

  // Real user info from localStorage
  const rawUser = localStorage.getItem('ur_user');
  const user: { name: string; avatar: string | null } | null = rawUser ? JSON.parse(rawUser) : null;

  const archetype  = persona?.archetype ?? null;
  const color      = archetype ? (ARCHETYPE_COLORS[archetype] ?? ARCHETYPE_COLORS.voyager) : null;
  const citySuggestions = archetype
    ? (ARCHETYPE_CITIES[archetype] ?? DEFAULT_CITIES)
    : DEFAULT_CITIES;

  const recentTrips = [...savedItineraries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

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
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = await res.json();
        const addr = data.address ?? {};
        const cityName: string =
          addr.city ?? addr.town ?? addr.village ?? addr.county ?? data.display_name.split(',')[0];
        // Nominatim returns bbox as [south, north, west, east] strings
        const bb: [number, number, number, number] = data.boundingbox
          ? [
              parseFloat(data.boundingbox[0]),
              parseFloat(data.boundingbox[1]),
              parseFloat(data.boundingbox[2]),
              parseFloat(data.boundingbox[3]),
            ]
          : [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05];
        dispatch({ type: 'SET_CITY', city: cityName });
        dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: bb } });
      } catch {
        // Reverse geocode failed — use raw coords with a default bbox
        dispatch({ type: 'SET_CITY', city: 'My Location' });
        dispatch({ type: 'SET_CITY_GEO', geo: { lat, lon, bbox: [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05] } });
      }
      dispatch({ type: 'GO_TO', screen: 'map' });
    });
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col" style={{ zIndex: 20 }}>

      {/* Header */}
      <header
        className="flex items-center justify-between px-5 border-b border-white/6 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem' }}
      >
        <h1 className="font-heading font-bold text-text-1 text-lg">Uncover Roads</h1>
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.2)' }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary font-bold text-sm">
              {(user?.name ?? 'U')[0].toUpperCase()}
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-28">

        <h2 className="font-heading font-extrabold text-text-1 text-2xl mb-5 tracking-tight">
          Where to next?
        </h2>

        {/* Search */}
        <div className="mb-3">
          <CitySearch onSelect={selectCity} />
        </div>

        {/* Use location */}
        <button
          onClick={useLocation}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl font-medium text-sm border border-primary/20 mb-8"
          style={{ background: 'rgba(59,130,246,.08)', color: '#60a5fa' }}
        >
          <span className="ms text-base">near_me</span>
          Use my current location
        </button>

        {/* ── Persona city suggestions ── */}
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            {color ? (
              <>
                <div
                  className="w-1.5 h-4 rounded-full flex-shrink-0"
                  style={{ background: color.primary }}
                />
                <p className="font-heading font-bold text-text-1 text-base">
                  For {persona?.archetype_name ?? 'explorers'}
                </p>
              </>
            ) : (
              <>
                <div className="w-1.5 h-4 rounded-full flex-shrink-0 bg-primary" />
                <p className="font-heading font-bold text-text-1 text-base">Popular destinations</p>
              </>
            )}
          </div>

          <div
            className="flex gap-3 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {citySuggestions.map(city => (
              <button
                key={city.name}
                onClick={() => selectCity(city.name)}
                className="flex-shrink-0 flex flex-col justify-between rounded-2xl px-4 py-3.5 text-left transition-all active:scale-95"
                style={{
                  width: 130,
                  height: 110,
                  background: color
                    ? `linear-gradient(140deg, ${color.glow}, rgba(255,255,255,.03))`
                    : 'rgba(255,255,255,.04)',
                  border: color
                    ? `1px solid ${color.primary}25`
                    : '1px solid rgba(255,255,255,.08)',
                }}
              >
                <span className="text-2xl leading-none">{city.emoji}</span>
                <div>
                  <p className="font-heading font-bold text-white text-sm leading-tight">{city.name}</p>
                  <p className="text-white/35 text-[10px] mt-0.5">{city.country}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Recent trips ── */}
        {recentTrips.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,.2)' }} />
              <p className="font-heading font-bold text-text-1 text-base">Jump back in</p>
            </div>
            <div className="flex flex-col gap-2">
              {recentTrips.map(trip => (
                <RecentTripCard key={trip.id} trip={trip} onSelect={selectCity} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentTripCard({
  trip,
  onSelect,
}: {
  trip: SavedItinerary;
  onSelect: (city: string) => void;
}) {
  const stopCount = trip.itinerary?.itinerary?.length ?? 0;
  const date = new Date(trip.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const archetype = trip.persona?.archetype ?? '';
  const color = ARCHETYPE_COLORS[archetype] ?? { primary: '#60a5fa', glow: 'rgba(96,165,250,.15)' };

  return (
    <button
      onClick={() => onSelect(trip.city)}
      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[.99]"
      style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}
    >
      {/* Dot */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color.glow, border: `1px solid ${color.primary}30` }}
      >
        <span className="ms fill text-base" style={{ color: color.primary }}>route</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">{trip.city}</p>
        <p className="text-white/35 text-xs mt-0.5">{date} · {stopCount} stop{stopCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Arrow */}
      <span className="ms text-white/20 text-base flex-shrink-0">arrow_forward</span>
    </button>
  );
}
