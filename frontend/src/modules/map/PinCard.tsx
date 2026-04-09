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
}

const PRICE: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

export function PinCard({ place, city, isSelected, onAdd, onClose, details }: Props) {
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
    details?.photo_ref ||
    details?.editorial_summary
  );
  const activeDetails = hasGoogleData ? details : null;

  // Use place fields as immediate values — available before details loads
  const photoRef = activeDetails?.photo_ref ?? place.photo_ref ?? null;
  const rating = activeDetails?.rating ?? place.rating ?? null;
  const ratingCount = activeDetails?.rating_count ?? null;
  const openNow = activeDetails?.open_now ?? place.open_now ?? null;
  const priceLevel = activeDetails?.price_level ?? place.price_level ?? null;

  const photoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null;
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

  // Description priority: Google editorial → Wikipedia (in editorial_summary after merge) → OSM
  const description =
    activeDetails?.editorial_summary ||
    (activeDetails?.top_review
      ? activeDetails.top_review.slice(0, 200) + (activeDetails.top_review.length > 200 ? '…' : '')
      : null) ||
    place.tags?.description ||
    null;

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
      {/* ── Hero image — fixed 120px, ONLY badges here ── */}
      <div style={{ height: 120, position: 'relative', flexShrink: 0 }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={place.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(140deg, rgba(59,130,246,.25), rgba(99,102,241,.15))',
            }}
          />
        )}
        {/* Subtle bottom fade so text below reads cleanly */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.1) 0%, rgba(0,0,0,.35) 100%)' }} />

        {/* Category badge — top left */}
        <div
          style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.12)',
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
            background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: '50%', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#aaa', fontSize: 14, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Title + meta — always below hero ── */}
      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
          {place.title}
        </div>

        {/* Meta row: rating · open/closed · price — shown immediately from place data */}
        {(rating !== null || openNow !== null || priceLevel !== null) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
            {rating !== null && (
              <>
                <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                  ★ {rating}
                </span>
                {ratingCount !== null && (
                  <span style={{ fontSize: 10, color: '#777' }}>
                    ({ratingCount.toLocaleString()})
                  </span>
                )}
              </>
            )}
            {openNow !== null && (
              <span style={{ fontSize: 10, color: openNow ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                ● {openNow ? 'Open' : 'Closed'}
              </span>
            )}
            {priceLevel !== null && priceLevel > 0 && (
              <span style={{ fontSize: 10, color: '#777' }}>
                {PRICE[priceLevel]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Details body ── */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Type tags — Google OR OSM cuisine */}
        {(() => {
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
                    background: '#1a1a1a', border: '1px solid #2a2a2a',
                    borderRadius: 20, padding: '3px 9px', fontSize: 9, color: '#999',
                    textTransform: 'capitalize',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null;
        })()}

        {/* Description */}
        {description && (
          <div style={{ fontSize: 10, color: '#bbb', lineHeight: 1.55 }}>
            {description}
          </div>
        )}

        {/* Hours — Google OR OSM */}
        {hoursLabel ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 11, marginTop: 1, flexShrink: 0 }}>🕐</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: (openNow ?? false) ? '#22c55e' : '#ef4444' }}>
                  {hoursLabel}
                </span>
                {activeDetails?.weekday_text && activeDetails.weekday_text.length > 0 && (
                  <button
                    onClick={() => setHoursExpanded(e => !e)}
                    style={{ fontSize: 9, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {hoursExpanded ? 'Hide ▴' : 'See hours ▾'}
                  </button>
                )}
              </div>
              {hoursExpanded && activeDetails?.weekday_text && (
                <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {activeDetails.weekday_text.map((line, i) => {
                    const isToday = i === (todayJsDay === 0 ? 6 : todayJsDay - 1);
                    const colonIdx = line.indexOf(':');
                    const day = colonIdx > -1 ? line.slice(0, colonIdx) : line;
                    const hours = colonIdx > -1 ? line.slice(colonIdx + 2) : '';
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                        <span style={{ color: isToday ? '#22c55e' : '#666', fontWeight: isToday ? 600 : 400 }}>{day}</span>
                        <span style={{ color: '#aaa', fontWeight: isToday ? 600 : 400 }}>{hours}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : place.tags?.opening_hours ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 11, marginTop: 1, flexShrink: 0 }}>🕐</span>
            <span style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>{place.tags.opening_hours}</span>
          </div>
        ) : null}

        {/* Address + Get Directions — always shown */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 11, marginTop: 1, flexShrink: 0 }}>📍</span>
          <div style={{ flex: 1 }}>
            {(activeDetails?.address || place.tags?.address) && (
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4, marginBottom: 2 }}>
                {activeDetails?.address || place.tags?.address}
              </div>
            )}
            <a href={directionsUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 9, color: '#6366f1', textDecoration: 'none' }}>
              Get directions ↗
            </a>
          </div>
        </div>

        {/* Phone + website */}
        {(() => {
          const phone = activeDetails?.phone || place.tags?.phone || null;
          const website = activeDetails?.website || place.tags?.website || null;
          return (phone || website) ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {phone && (
                <a href={`tel:${phone}`}
                  style={{ flex: 1, background: '#1a1a1a', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', overflow: 'hidden' }}>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>📞</span>
                  <span style={{ fontSize: 9, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phone}</span>
                </a>
              )}
              {website && (
                <a href={website} target="_blank" rel="noreferrer"
                  style={{ flex: 1, background: '#1a1a1a', borderRadius: 10, padding: 8, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', overflow: 'hidden' }}>
                  <span style={{ fontSize: 11, flexShrink: 0 }}>🌐</span>
                  <span style={{ fontSize: 9, color: '#60a5fa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(() => { try { return new URL(website).hostname; } catch { return website; } })()}
                  </span>
                </a>
              )}
            </div>
          ) : null;
        })()}
      </div>

      {/* ── Action bar ── */}
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
          style={{ width: 40, background: '#1f1f1f', border: 'none', borderRadius: 12, fontSize: 13, cursor: 'pointer', color: '#fff' }}
        >
          ↗
        </button>
      </div>
    </div>
  );
}
