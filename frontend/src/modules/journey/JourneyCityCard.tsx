import type { Place } from '../../shared/types';

const PRIMARY  = '#3b82f6';
const TEXT1    = '#f1f5f9';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';
const SURFACE2 = '#1A1F2B';

interface Props {
  city: string;
  countryCode: string;
  places: Place[];
  estimatedDays: number;
  arrivalDate?: string;
  advisorMessage?: string;
  onAddPlaces: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function JourneyCityCard({ city, countryCode, places, estimatedDays, arrivalDate, advisorMessage, onAddPlaces }: Props) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: PRIMARY, marginBottom: 6 }}>
          {arrivalDate ? fmtDate(arrivalDate) : 'City'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 24, fontWeight: 800, color: TEXT1 }}>{city}</span>
          {countryCode && <span style={{ fontSize: 20 }}>{countryFlag(countryCode)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Pill icon="place" label={`${places.length} place${places.length !== 1 ? 's' : ''}`} />
          <Pill icon="calendar_today" label={`~${estimatedDays} day${estimatedDays !== 1 ? 's' : ''}`} />
        </div>
      </div>

      {/* Place list preview */}
      <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', flex: 1 }}>
        {places.slice(0, 4).map((p, i) => (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}
          >
            <span className="ms fill" style={{ fontSize: 16, color: PRIMARY }}>location_on</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
          </div>
        ))}
        {places.length > 4 && (
          <div style={{ padding: '8px 14px', borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: TEXT3 }}>+{places.length - 4} more</span>
          </div>
        )}
      </div>

      {/* Advisor message */}
      {advisorMessage && (
        <div style={{ background: 'rgba(59,130,246,.06)', border: `1px solid rgba(59,130,246,.18)`, borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#93c5fd', lineHeight: 1.5, margin: 0 }}>{advisorMessage}</p>
        </div>
      )}

      {/* Add more */}
      <button
        onClick={onAddPlaces}
        style={{ height: 44, background: 'rgba(255,255,255,.05)', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: TEXT3 }}
      >
        Add more places
      </button>
    </div>
  );
}

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.22)', borderRadius: 999 }}>
      <span className="ms" style={{ fontSize: 13, color: PRIMARY }}>{icon}</span>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>{label}</span>
    </div>
  );
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
