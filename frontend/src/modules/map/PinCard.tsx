import { useState } from 'react';
import type { Place, PlaceDetails } from '../../shared/types';
import { CATEGORY_LABELS } from './types';
import { getPlacePhotoUrl } from '../../shared/api';
import { filterTypes, getHoursLabel, parseOpenClose, getDirectionsUrl } from './pincard-utils';

interface Props {
  place: Place;
  city: string;
  isSelected: boolean;
  onAdd: () => void;
  onClose: () => void;
  details?: PlaceDetails | null;
  detailsLoading?: boolean;
}

const PRICE: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export function PinCard({ place, city, isSelected, onAdd, onClose, details, detailsLoading }: Props) {
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place';
  const [hoursExpanded, setHoursExpanded] = useState(false);

  // Treat details as absent if Google returned a response but all meaningful fields are null
  const hasGoogleData = !!(
    details?.rating !== undefined ||
    details?.address ||
    details?.phone ||
    details?.website ||
    details?.open_now !== undefined ||
    (details?.weekday_text?.length ?? 0) > 0 ||
    details?.photo_ref
  );
  const activeDetails = hasGoogleData ? details : null;

  const photoUrl = activeDetails?.photo_ref ? getPlacePhotoUrl(activeDetails.photo_ref) : null;
  const typeTags = activeDetails?.types ? filterTypes(activeDetails.types) : [];

  const todayJsDay = new Date().getDay();
  const rawHoursLine = activeDetails?.weekday_text?.length
    ? getHoursLabel(activeDetails.weekday_text, todayJsDay)
    : null;
  const hoursLabel =
    rawHoursLine !== null && activeDetails?.open_now !== undefined
      ? parseOpenClose(rawHoursLine, activeDetails.open_now)
      : rawHoursLine;

  const directionsUrl = getDirectionsUrl(
    activeDetails?.lat ?? place.lat,
    activeDetails?.lon ?? place.lon,
  );

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '0 auto',
        background: '#111',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
        border: '1px solid rgba(255,255,255,.08)',
      }}
    >
      {/* ── Hero image ─────────────────────────────────── */}
      <div style={{ height: 150, position: 'relative' }}>
        {detailsLoading ? (
          /* Shimmer skeleton */
          <div style={{ position: 'absolute', inset: 0, background: '#1a1a1a', overflow: 'hidden' }}>
            <div className="shimmer" style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
              <div style={{ height: 18, width: '60%', background: '#2a2a2a', borderRadius: 4, marginBottom: 6 }} />
              <div style={{ height: 11, width: '40%', background: '#222', borderRadius: 4 }} />
            </div>
          </div>
        ) : (
          <>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={place.title}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'cover',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(140deg, rgba(59,130,246,.2), rgba(99,102,241,.1))',
                }}
              />
            )}
            <div
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.05) 55%)',
              }}
            />
          </>
        )}

        {/* Category badge — top left */}
        <div
          style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 20, padding: '3px 9px',
            fontSize: 8, fontWeight: 600, color: '#d1d5db',
            textTransform: 'uppercase', letterSpacing: 1,
          }}
        >
          {categoryLabel}
        </div>

        {/* Close button — top right */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: '50%', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#999', fontSize: 14, cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {/* Name always visible; meta row only after details load */}
        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 44 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {place.title}
          </div>
          {!detailsLoading && (activeDetails?.rating || activeDetails?.open_now !== undefined || activeDetails?.price_level) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                {activeDetails!.rating !== undefined && (
                  <>
                    <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                      ★ {activeDetails!.rating}
                    </span>
                    {activeDetails!.rating_count !== undefined && (
                      <span style={{ fontSize: 10, color: '#999' }}>
                        {activeDetails!.rating_count.toLocaleString()} reviews
                      </span>
                    )}
                  </>
                )}
                {activeDetails!.open_now !== undefined && (
                  <span
                    style={{
                      fontSize: 10,
                      color: activeDetails!.open_now ? '#22c55e' : '#ef4444',
                      fontWeight: 600,
                    }}
                  >
                    ● {activeDetails!.open_now ? 'Open' : 'Closed'}
                  </span>
                )}
                {activeDetails!.price_level !== undefined && activeDetails!.price_level > 0 && (
                  <span style={{ fontSize: 10, color: '#999' }}>
                    {PRICE[activeDetails!.price_level]}
                  </span>
                )}
              </div>
            )}
        </div>
      </div>

      {/* ── Details body ───────────────────────────────── */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Type tags — Google details OR OSM cuisine tag */}
        {detailsLoading ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="shimmer" style={{ height: 22, width: 110, background: '#1f1f1f', borderRadius: 20 }} />
            <div className="shimmer" style={{ height: 22, width: 60, background: '#1f1f1f', borderRadius: 20 }} />
          </div>
        ) : (() => {
          const tags = typeTags.length > 0
            ? typeTags
            : place.tags?.cuisine
              ? place.tags.cuisine.split(';').map(s => s.trim().replace(/_/g, ' ')).filter(Boolean)
              : [];
          return tags.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    background: '#1f1f1f', border: '1px solid #333',
                    borderRadius: 20, padding: '3px 9px', fontSize: 9, color: '#aaa',
                    textTransform: 'capitalize',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        {/* Hours row — Google details OR OSM opening_hours */}
        {detailsLoading ? (
          <div className="shimmer" style={{ height: 12, width: '80%', background: '#1a1a1a', borderRadius: 4 }} />
        ) : hoursLabel ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 12, marginTop: 1 }}>🕐</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 10, fontWeight: 600,
                    color: (activeDetails?.open_now ?? false) ? '#22c55e' : '#ef4444',
                  }}
                >
                  {hoursLabel}
                </span>
                {activeDetails?.weekday_text && activeDetails.weekday_text.length > 0 && (
                  <button
                    onClick={() => setHoursExpanded(e => !e)}
                    style={{
                      fontSize: 9, color: '#6366f1',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    {hoursExpanded ? 'Hide ▴' : 'See hours ▾'}
                  </button>
                )}
              </div>
              {hoursExpanded && activeDetails?.weekday_text && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {details.weekday_text.map((line, i) => {
                    const isToday = i === (todayJsDay === 0 ? 6 : todayJsDay - 1);
                    const colonIdx = line.indexOf(':');
                    const day = colonIdx > -1 ? line.slice(0, colonIdx) : line;
                    const hours = colonIdx > -1 ? line.slice(colonIdx + 2) : '';
                    return (
                      <div
                        key={i}
                        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}
                      >
                        <span style={{ color: isToday ? '#22c55e' : '#666', fontWeight: isToday ? 600 : 400 }}>
                          {day}
                        </span>
                        <span style={{ color: '#aaa', fontWeight: isToday ? 600 : 400 }}>
                          {hours}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : place.tags?.opening_hours ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 12, marginTop: 1 }}>🕐</span>
            <span style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>{place.tags.opening_hours}</span>
          </div>
        ) : null}

        {/* Address row — Google details only */}
        {detailsLoading ? (
          <div className="shimmer" style={{ height: 12, width: '65%', background: '#1a1a1a', borderRadius: 4 }} />
        ) : activeDetails?.address ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 12, marginTop: 1 }}>📍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>{activeDetails.address}</div>
              <a
                href={directionsUrl}
                style={{
                  fontSize: 9, color: '#6366f1', marginTop: 3,
                  display: 'block', textDecoration: 'none',
                }}
              >
                Get directions ↗
              </a>
            </div>
          </div>
        ) : null}

        {/* Phone + website tiles — Google details OR OSM website */}
        {detailsLoading ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <div className="shimmer" style={{ flex: 1, height: 36, background: '#1f1f1f', borderRadius: 10 }} />
            <div className="shimmer" style={{ flex: 1, height: 36, background: '#1f1f1f', borderRadius: 10 }} />
          </div>
        ) : (() => {
          const phone = activeDetails?.phone;
          const website = activeDetails?.website || place.tags?.website || null;
          return (phone || website) ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  style={{
                    flex: 1, background: '#1a1a1a', borderRadius: 10, padding: 8,
                    display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>📞</span>
                  <span style={{ fontSize: 9, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {phone}
                  </span>
                </a>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1, background: '#1a1a1a', borderRadius: 10, padding: 8,
                    display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>🌐</span>
                  <span style={{ fontSize: 9, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(() => { try { return new URL(website).hostname; } catch { return website; } })()}
                  </span>
                </a>
              )}
            </div>
          ) : null;
        })()}
      </div>

      {/* ── Action bar ─────────────────────────────────── */}
      <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}>
        <button
          onClick={onAdd}
          style={{
            flex: 1,
            background: isSelected ? 'rgba(99,102,241,.15)' : '#6366f1',
            border: isSelected ? '1px solid rgba(99,102,241,.4)' : 'none',
            borderRadius: 12, padding: 10,
            fontSize: 11, fontWeight: 700,
            color: isSelected ? '#a5b4fc' : '#fff',
            cursor: 'pointer',
          }}
        >
          {isSelected ? '✓ Added' : 'Add to trip'}
        </button>
        <button
          onClick={() => {
            const url = `https://www.google.com/search?q=${encodeURIComponent(`${place.title} ${city}`)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
          style={{
            width: 40, background: '#1f1f1f', border: 'none',
            borderRadius: 12, fontSize: 13, cursor: 'pointer', color: '#fff',
          }}
        >
          ↗
        </button>
      </div>
    </div>
  );
}
