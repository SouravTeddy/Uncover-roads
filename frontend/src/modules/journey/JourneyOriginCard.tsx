import type { OriginPlace } from '../../shared/types';

const SURFACE2 = '#1A1F2B';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';

const ORIGIN_ICONS: Record<string, string> = {
  home: 'home', hotel: 'hotel', airport: 'flight', custom: 'location_on',
};

interface Props {
  place: OriginPlace;
  advisorMessage?: string;
  onEdit: () => void;
}

export function JourneyOriginCard({ place, advisorMessage, onEdit }: Props) {
  const icon = ORIGIN_ICONS[place.originType] ?? 'location_on';

  function timeRow(label: string, time: string) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span className="ms text-[var(--color-sky)] text-[22px]">{label === 'Landing' ? 'flight_land' : 'schedule'}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: TEXT3 }}>{label}</span>
        <span className="font-[family-name:var(--font-heading)] text-[13px] font-bold text-[var(--color-text-1)]" style={{ marginLeft: 'auto' }}>{time}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(59,130,246,.12)', border: `1px solid rgba(59,130,246,.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="ms text-[var(--color-sky)] text-[22px]">{icon}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--color-sky)', marginBottom: 4 }}>
            Starting point
          </div>
          <div className="font-[family-name:var(--font-heading)] text-[18px] font-semibold text-[var(--color-text-1)]" style={{ lineHeight: 1.2 }}>
            {place.name}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: TEXT3, marginTop: 2 }}>{place.address}</div>
        </div>
      </div>

      {/* Time rows */}
      <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '12px 16px' }}>
        {place.originType === 'home' && place.departureTime && timeRow('Leaving', place.departureTime)}
        {place.originType === 'airport' && place.departureTime && timeRow('Landing', place.departureTime)}
        {place.originType === 'hotel' && place.checkInTime && timeRow('Check-in', place.checkInTime)}
        {place.originType === 'hotel' && place.checkOutTime && timeRow('Check-out', place.checkOutTime)}
        {(place.originType === 'custom' || (!place.departureTime && !place.checkInTime)) && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: TEXT3 }}>No time constraints — start whenever you're ready.</span>
        )}
      </div>

      {/* Advisor message */}
      {advisorMessage && (
        <div style={{ background: 'rgba(59,130,246,.06)', border: `1px solid rgba(59,130,246,.18)`, borderRadius: 14, padding: '12px 14px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: '#93c5fd', lineHeight: 1.5, margin: 0 }}>{advisorMessage}</p>
        </div>
      )}

      {/* Edit */}
      <button
        onClick={onEdit}
        style={{ marginTop: 'auto', height: 44, background: 'rgba(255,255,255,.05)', border: `1px solid ${BORDER}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: TEXT3 }}
      >
        Change starting point
      </button>
    </div>
  );
}
