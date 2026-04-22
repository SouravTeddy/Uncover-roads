import type { ParsedQuery, DateValidation } from './parseSearchQuery';
import type { StructuredQuery } from './useSearchMode';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';
import type { Category } from '../../shared/types';

interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
}

interface Props {
  parsedQuery: ParsedQuery;
  locationSuggestions: NominatimSuggestion[];
  dateValidation: DateValidation | null;
  onSelect: (query: StructuredQuery) => void;
}

const CATEGORY_EMOJI: Partial<Record<Category, string>> = {
  museum: '🏛',
  restaurant: '🍜',
  park: '🌿',
  historic: '🏯',
  event: '🎉',
  cafe: '☕',
};

export function SearchDropdown({ parsedQuery, locationSuggestions, dateValidation, onSelect }: Props) {
  const { category, dateString } = parsedQuery;

  // Build place rows (Places group)
  const placeRows = category && category !== 'event'
    ? locationSuggestions.map(loc => ({
        label: `${CATEGORY_EMOJI[category] ?? '📍'} ${CATEGORY_LABELS[category] ?? category} near ${loc.name || loc.display_name.split(',')[0]}`,
        query: {
          category,
          locationName: loc.name || loc.display_name.split(',')[0],
          locationLat: parseFloat(loc.lat),
          locationLon: parseFloat(loc.lon),
        } satisfies StructuredQuery,
        nudge: null,
      }))
    : [];

  // Build event rows (Events group)
  const eventRows = category === 'event' && dateString && dateValidation?.isoDate
    ? locationSuggestions.map(loc => ({
        label: `🎉 Events on ${dateString} near ${loc.name || loc.display_name.split(',')[0]}`,
        query: {
          category: 'event' as Category,
          locationName: loc.name || loc.display_name.split(',')[0],
          locationLat: parseFloat(loc.lat),
          locationLon: parseFloat(loc.lon),
          date: dateValidation.isoDate!,
        } satisfies StructuredQuery,
        nudge: dateValidation.nudgeMessage,
      }))
    : [];

  // Nominatim area fallback (no category detected)
  const areaRows = !category
    ? locationSuggestions.map(loc => ({
        label: `📍 ${loc.name || loc.display_name.split(',')[0]}`,
        query: {
          category: 'place' as Category,
          locationName: loc.name || loc.display_name.split(',')[0],
          locationLat: parseFloat(loc.lat),
          locationLon: parseFloat(loc.lon),
        } satisfies StructuredQuery,
        nudge: null,
      }))
    : [];

  const hasRows = placeRows.length > 0 || eventRows.length > 0 || areaRows.length > 0;
  if (!hasRows) return null;

  const rowStyle: React.CSSProperties = {
    borderBottom: '1px solid rgba(255,255,255,.06)',
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  };

  const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,.88)', fontSize: 13 };
  const sectionStyle: React.CSSProperties = {
    padding: '5px 14px 3px',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'rgba(255,255,255,.3)',
    borderBottom: '1px solid rgba(255,255,255,.06)',
  };
  const nudgeStyle: React.CSSProperties = {
    fontSize: 10,
    color: '#fb923c',
    marginTop: 2,
  };

  return (
    <div
      className="mx-12 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15,20,30,.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.1)',
        pointerEvents: 'auto',
      }}
    >
      {placeRows.length > 0 && (
        <>
          <div style={sectionStyle}>Places</div>
          {placeRows.map((row, i) => (
            <button
              key={i}
              onMouseDown={() => onSelect(row.query)}
              style={{ ...rowStyle, borderBottom: i < placeRows.length - 1 ? rowStyle.borderBottom : 'none' }}
            >
              <span style={labelStyle}>{row.label}</span>
            </button>
          ))}
        </>
      )}

      {eventRows.length > 0 && (
        <>
          <div style={sectionStyle}>Events</div>
          {eventRows.map((row, i) => (
            <button
              key={i}
              onMouseDown={() => onSelect(row.query)}
              style={{ ...rowStyle, borderBottom: 'none' }}
            >
              <span style={labelStyle}>{row.label}</span>
              {row.nudge && <span style={nudgeStyle}>⚠ {row.nudge}. Still search?</span>}
            </button>
          ))}
        </>
      )}

      {areaRows.length > 0 && (
        <>
          <div style={sectionStyle}>Areas</div>
          {areaRows.map((row, i) => (
            <button
              key={i}
              onMouseDown={() => onSelect(row.query)}
              style={{ ...rowStyle, borderBottom: i < areaRows.length - 1 ? rowStyle.borderBottom : 'none' }}
            >
              <span style={labelStyle}>{row.label}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
