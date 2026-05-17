import type { Persona } from '../../shared/types';
import { getCityPhotoUrl } from '../../shared/cityPhoto';
import { ARCHETYPE_CITIES, DEFAULT_CITIES } from './types';

interface CuratedCityCardsProps {
  persona: Persona | null;
  travelStartDate: string | null;
  travelEndDate: string | null;
  onCitySelect: (city: string) => void;
}

function formatDatePill(start: string, end: string | null): string {
  const s = new Date(start + 'T12:00:00');
  if (!end || start === end)
    return s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end + 'T12:00:00');
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default function CuratedCityCards({
  persona,
  travelStartDate,
  travelEndDate,
  onCitySelect,
}: CuratedCityCardsProps) {
  const archetype = persona?.archetype ?? null;
  const cities =
    archetype && ARCHETYPE_CITIES[archetype]
      ? ARCHETYPE_CITIES[archetype].slice(0, 6)
      : DEFAULT_CITIES;

  const cardHeight = travelStartDate ? 178 : 188;

  return (
    <section className="px-4 pt-4 pb-2">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <h2
          style={{
            color: 'var(--color-text-2)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: 0,
            fontWeight: 600,
          }}
        >
          {persona
            ? (persona.archetype_name ?? persona.archetype)
            : 'Destinations'}
        </h2>
        {travelStartDate && (
          <span
            style={{
              background: 'var(--color-primary-bg)',
              color: 'var(--color-primary-text)',
              fontSize: 11,
              fontWeight: 500,
              borderRadius: 999,
              padding: '2px 8px',
              lineHeight: 1.4,
            }}
          >
            {formatDatePill(travelStartDate, travelEndDate)}
          </span>
        )}
      </div>

      {/* Horizontal scroll row */}
      <div
        className="flex gap-3 overflow-x-auto no-scrollbar"
        style={{ paddingBottom: 4 }}
      >
        {cities.map((city) => (
          <button
            key={city.name}
            onClick={() => onCitySelect(city.name)}
            className="flex-shrink-0 relative overflow-hidden rounded-2xl"
            style={{ width: 136, height: cardHeight, padding: 0, border: 'none', cursor: 'pointer' }}
          >
            {/* Background photo */}
            <img
              src={getCityPhotoUrl(city.name)}
              alt={city.name}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />

            {/* Dark gradient overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.65) 100%)',
              }}
            />

            {/* Text content */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '0 10px 10px',
              }}
            >
              {/* Archetype tag pill — only shown when persona is set */}
              {persona && (
                <span
                  style={{
                    display: 'inline-block',
                    background: 'var(--color-primary-bg)',
                    color: 'var(--color-primary-text)',
                    fontSize: 9,
                    fontWeight: 600,
                    borderRadius: 999,
                    padding: '2px 6px',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {persona.archetype}
                </span>
              )}

              {/* City name */}
              <div
                style={{
                  fontFamily: '"Cormorant Garamond", serif',
                  color: '#ffffff',
                  fontSize: 18,
                  lineHeight: 1.15,
                  fontWeight: 600,
                }}
              >
                {city.name}
              </div>

              {/* Country name */}
              <div
                style={{
                  color: 'rgba(255,255,255,.7)',
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                {city.country}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
