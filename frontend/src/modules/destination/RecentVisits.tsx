import type { Place } from '../../shared/types';
import type { LastSession } from './useLastSession';
import { getCityPhotoUrl } from '../../shared/cityPhoto';

interface RecentVisitsProps {
  session: LastSession | null;
  onOpenMap: (places: Place[]) => void;
}

const MAX_VISIBLE = 4;
const OVERFLOW_THUMB_COUNT = 2;

function PlaceThumbnail({
  place,
  city,
  size,
}: {
  place: Place;
  city: string;
  size: number;
}) {
  const src = place.imageUrl ?? getCityPhotoUrl(place._city ?? city);
  return (
    <img
      src={src}
      alt={place.title}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        objectFit: 'cover',
        objectPosition: 'center',
        flexShrink: 0,
      }}
    />
  );
}

function PlaceRow({
  place,
  city,
  showDivider,
  onTap,
}: {
  place: Place;
  city: string;
  showDivider: boolean;
  onTap: () => void;
}) {
  return (
    <>
      {showDivider && (
        <div style={{ height: 1, background: 'var(--color-divider)', margin: '0 0' }} />
      )}
      <button
        onClick={onTap}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Thumbnail */}
        <PlaceThumbnail place={place} city={city} size={40} />

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: 'var(--color-text-1)',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {place.title}
          </div>
          <div
            style={{
              color: 'var(--color-text-2)',
              fontSize: 12,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 1,
            }}
          >
            {place.category}
          </div>
        </div>

        {/* Chevron */}
        <span
          className="material-symbols-outlined"
          style={{
            color: 'var(--color-text-4)',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          chevron_right
        </span>
      </button>
    </>
  );
}

function CityGroup({
  cityName,
  places,
  sessionCity,
  onOpenMap,
  isFirst,
}: {
  cityName: string;
  places: Place[];
  sessionCity: string;
  onOpenMap: (places: Place[]) => void;
  isFirst: boolean;
}) {
  const visible = places.slice(0, MAX_VISIBLE);
  const overflow = places.slice(MAX_VISIBLE);
  const hasOverflow = overflow.length > 0;

  return (
    <div style={{ marginTop: isFirst ? 0 : 12 }}>
      {/* City heading */}
      <div
        style={{
          color: 'var(--color-primary-text)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 4,
        }}
      >
        {cityName}
      </div>

      {/* Place rows */}
      {visible.map((place, idx) => (
        <PlaceRow
          key={place.id}
          place={place}
          city={sessionCity}
          showDivider={idx > 0}
          onTap={() => onOpenMap([place])}
        />
      ))}

      {/* Overflow row */}
      {hasOverflow && (
        <>
          <div style={{ height: 1, background: 'var(--color-divider)' }} />
          <button
            onClick={() => onOpenMap(places)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 56,
              width: '100%',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {/* Stacked thumbnails */}
            <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
              {overflow.slice(0, OVERFLOW_THUMB_COUNT).map((p, i) => (
                <img
                  key={p.id}
                  src={p.imageUrl ?? getCityPhotoUrl(p._city ?? sessionCity)}
                  alt={p.title}
                  style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    objectFit: 'cover',
                    top: i === 0 ? 0 : 16,
                    left: i === 0 ? 0 : 16,
                    border: '1.5px solid var(--color-surface)',
                  }}
                />
              ))}
            </div>

            {/* Count text */}
            <div style={{ flex: 1 }}>
              <span
                style={{
                  color: 'var(--color-text-2)',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                +{overflow.length} more {overflow.length === 1 ? 'pin' : 'pins'}
              </span>
            </div>

            <span
              className="material-symbols-outlined"
              style={{ color: 'var(--color-text-4)', fontSize: 18, flexShrink: 0 }}
            >
              chevron_right
            </span>
          </button>
        </>
      )}
    </div>
  );
}

export default function RecentVisits({ session, onOpenMap }: RecentVisitsProps) {
  // ── Empty state ──────────────────────────────────────────────
  if (!session) {
    return (
      <section className="px-4 pt-4 pb-6">
        <h2
          style={{
            color: 'var(--color-text-3)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
            margin: '0 0 12px',
          }}
        >
          Recent visits
        </h2>
        <div
          className="rounded-2xl"
          style={{
            border: '1.5px dashed var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '32px 16px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: 'var(--color-text-4)', fontSize: 28 }}
          >
            pin_drop
          </span>
          <p
            style={{
              color: 'var(--color-text-3)',
              fontSize: 13,
              margin: 0,
              textAlign: 'center',
            }}
          >
            Your saved pins will appear here
          </p>
        </div>
      </section>
    );
  }

  // ── Group places by city ──────────────────────────────────────
  const cityMap = new Map<string, Place[]>();
  for (const place of session.places) {
    const cityKey = place._city ?? session.city;
    const existing = cityMap.get(cityKey);
    if (existing) {
      existing.push(place);
    } else {
      cityMap.set(cityKey, [place]);
    }
  }

  const isMultiCity = cityMap.size > 1;
  const cityEntries = Array.from(cityMap.entries());

  // ── Single-city flat layout ───────────────────────────────────
  if (!isMultiCity) {
    const places = session.places;
    const visible = places.slice(0, MAX_VISIBLE);
    const overflow = places.slice(MAX_VISIBLE);
    const hasOverflow = overflow.length > 0;

    return (
      <section className="px-4 pt-4 pb-6">
        <h2
          style={{
            color: 'var(--color-text-3)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
            margin: '0 0 8px',
          }}
        >
          Recent visits · {session.city}
        </h2>

        {visible.map((place, idx) => (
          <PlaceRow
            key={place.id}
            place={place}
            city={session.city}
            showDivider={idx > 0}
            onTap={() => onOpenMap([place])}
          />
        ))}

        {hasOverflow && (
          <>
            <div style={{ height: 1, background: 'var(--color-divider)' }} />
            <button
              onClick={() => onOpenMap(places)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 56,
                width: '100%',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Stacked thumbnails */}
              <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                {overflow.slice(0, OVERFLOW_THUMB_COUNT).map((p, i) => (
                  <img
                    key={p.id}
                    src={p.imageUrl ?? getCityPhotoUrl(p._city ?? session.city)}
                    alt={p.title}
                    style={{
                      position: 'absolute',
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      objectFit: 'cover',
                      top: i === 0 ? 0 : 16,
                      left: i === 0 ? 0 : 16,
                      border: '1.5px solid var(--color-surface)',
                    }}
                  />
                ))}
              </div>

              <div style={{ flex: 1 }}>
                <span
                  style={{
                    color: 'var(--color-text-2)',
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  +{overflow.length} more {overflow.length === 1 ? 'pin' : 'pins'}
                </span>
              </div>

              <span
                className="material-symbols-outlined"
                style={{ color: 'var(--color-text-4)', fontSize: 18, flexShrink: 0 }}
              >
                chevron_right
              </span>
            </button>
          </>
        )}
      </section>
    );
  }

  // ── Multi-city grouped layout ─────────────────────────────────
  return (
    <section className="px-4 pt-4 pb-6">
      <h2
        style={{
          color: 'var(--color-text-3)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          margin: '0 0 8px',
        }}
      >
        Recent visits
      </h2>

      {cityEntries.map(([cityName, places], idx) => (
        <CityGroup
          key={cityName}
          cityName={cityName}
          places={places}
          sessionCity={session.city}
          onOpenMap={onOpenMap}
          isFirst={idx === 0}
        />
      ))}
    </section>
  );
}
