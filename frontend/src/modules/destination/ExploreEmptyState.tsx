import { getCityPhotoUrl } from './DestinationScreen';

const SUGGESTED_CITIES = [
  { name: 'Paris', country: 'France' },
  { name: 'Tokyo', country: 'Japan' },
  { name: 'Rome', country: 'Italy' },
  { name: 'Barcelona', country: 'Spain' },
  { name: 'Lisbon', country: 'Portugal' },
  { name: 'Amsterdam', country: 'Netherlands' },
  { name: 'Kyoto', country: 'Japan' },
  { name: 'Istanbul', country: 'Turkey' },
]

export function ExploreEmptyState() {
  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* Section label */}
      <p
        className="px-5"
        style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}
      >
        Popular destinations
      </p>

      {/* Horizontal scroll of city photo cards */}
      <div
        className="flex gap-3 px-5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {SUGGESTED_CITIES.map(city => (
          <div
            key={city.name}
            className="relative overflow-hidden rounded-[22px] flex-shrink-0"
            style={{
              width: 200,
              height: 260,
              background: `url('${getCityPhotoUrl(city.name)}') center/cover no-repeat`,
            }}
          >
            {/* Gradient overlay */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(15,10,6,.9) 0%, rgba(15,10,6,.2) 60%, transparent 100%)' }}
            />
            {/* City name */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p
                className="font-[family-name:var(--font-heading)] font-bold text-white"
                style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 2 }}
              >
                {city.name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--color-text-2)', fontWeight: 500 }}>
                {city.country}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
