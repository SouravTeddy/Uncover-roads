import type { Place } from '../../shared/types';

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
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--color-sky)', marginBottom: 6 }}>
          {arrivalDate ? fmtDate(arrivalDate) : 'City'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="font-[family-name:var(--font-heading)] text-[var(--color-text-1)] text-[15px] font-semibold" style={{ fontSize: 24 }}>{city}</span>
          {countryCode && <span style={{ fontSize: 20 }}>{countryFlag(countryCode)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Pill icon="place" label={`${places.length} place${places.length !== 1 ? 's' : ''}`} />
          <span className="text-[11px] bg-[var(--color-sky-bg)] text-[var(--color-sky)] border border-[var(--color-sky-bdr)] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <span className="ms" style={{ fontSize: 13 }}>calendar_today</span>
            {`~${estimatedDays} day${estimatedDays !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Place list preview */}
      <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden', flex: 1 }}>
        {places.slice(0, 4).map((p, i) => (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}
          >
            <div className="w-[44px] h-[44px] rounded-[10px] overflow-hidden flex-shrink-0 bg-white/[0.06] flex items-center justify-center">
              <span className="ms fill text-[var(--color-sky)] text-[20px]">location_on</span>
            </div>
            <span className="font-[family-name:var(--font-heading)] text-[var(--color-text-1)] text-[15px] font-semibold" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
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
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onAddPlaces}
          style={{ height: 44, flex: 1, background: 'rgba(255,255,255,.05)', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: TEXT3 }}
        >
          Add more places
        </button>
        <button
          onClick={onAddPlaces}
          className="border border-dashed border-[var(--color-border)] rounded-full px-3 py-1 text-[12px] text-[var(--color-text-3)]"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.22)', borderRadius: 999 }}>
      <span className="ms" style={{ fontSize: 13, color: 'var(--color-sky)' }}>{icon}</span>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#93c5fd' }}>{label}</span>
    </div>
  );
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
