import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { computeTotalDays } from '../map/trip-capacity-utils';
import { calculateTravelDays } from '../map/journey-legs';
import { isJourneyMode, getJourneyCities } from '../map/journey-utils';

const PRIMARY  = '#3b82f6';
const TEXT1    = '#f1f5f9';
const TEXT3    = '#8e9099';
const BORDER   = 'rgba(255,255,255,.08)';
const SURFACE  = '#141921';

function fmt(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  onDurationChange?: (days: number) => void;
}

export function JourneyStrip({ onDurationChange }: Props) {
  const { state, dispatch } = useAppStore();
  const { selectedPlaces, travelStartDate, travelEndDate, journey, journeyBudgetDays } = state;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftDays, setDraftDays] = useState(journeyBudgetDays ?? 7);

  const isJourney = isJourneyMode(selectedPlaces);
  if (!isJourney) return null;

  const cities = getJourneyCities(selectedPlaces);
  const totalDays = travelStartDate && travelEndDate
    ? computeTotalDays(travelStartDate, travelEndDate)
    : (journeyBudgetDays ?? null);

  // Find first transit leg to estimate travel days
  const firstTransit = journey?.find(l => l.type === 'transit') as Extract<NonNullable<typeof journey>[0], { type: 'transit' }> | undefined;
  const originLeg = journey?.find(l => l.type === 'origin') as Extract<NonNullable<typeof journey>[0], { type: 'origin' }> | undefined;
  const travelDays = calculateTravelDays(originLeg?.place.originType, firstTransit?.durationMinutes);

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        style={{
          width: '100%', height: 40,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(59,130,246,.08)',
          border: `1px solid rgba(59,130,246,.25)`,
          borderRadius: 12, padding: '0 14px', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span className="ms" style={{ fontSize: 15, color: PRIMARY, flexShrink: 0 }}>flight_takeoff</span>

        <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 12, fontWeight: 700, color: TEXT1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {travelStartDate && travelEndDate
            ? `${fmt(travelStartDate)} – ${fmt(travelEndDate)}`
            : totalDays ? `~${totalDays} day${totalDays !== 1 ? 's' : ''}` : 'Set trip duration'}
          {totalDays ? ` · ${totalDays} days` : ''}
          {travelDays > 0 ? ` · ${travelDays} travel` : ''}
          {` · ${cities.length} cit${cities.length === 1 ? 'y' : 'ies'}`}
        </span>

        <span className="ms" style={{ fontSize: 14, color: TEXT3, flexShrink: 0 }}>chevron_right</span>
      </button>

      {pickerOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', left: 16, right: 16,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
              zIndex: 61, background: SURFACE,
              border: `1px solid ${BORDER}`, borderRadius: 24,
              boxShadow: '0 -8px 60px rgba(0,0,0,.85)',
              padding: 24,
            }}
          >
            <p style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 18, fontWeight: 800, color: TEXT1, marginBottom: 4 }}>
              How many days?
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: TEXT3, marginBottom: 24 }}>
              We'll fit your cities and flag when you're running short.
            </p>

            {/* Tap +/- to adjust days */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 28 }}>
              <button
                onClick={() => setDraftDays(d => Math.max(1, d - 1))}
                style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`, fontSize: 22, color: TEXT1, cursor: 'pointer' }}
              >−</button>
              <span style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 40, fontWeight: 800, color: TEXT1, minWidth: 60, textAlign: 'center' }}>{draftDays}</span>
              <button
                onClick={() => setDraftDays(d => d + 1)}
                style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`, fontSize: 22, color: TEXT1, cursor: 'pointer' }}
              >+</button>
            </div>

            <button
              onClick={() => {
                dispatch({ type: 'SET_JOURNEY_BUDGET', days: draftDays });
                onDurationChange?.(draftDays);
                setPickerOpen(false);
              }}
              style={{
                width: '100%', height: 54,
                background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`,
                border: 'none', borderRadius: 16, cursor: 'pointer',
                fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, fontWeight: 800, color: '#fff',
              }}
            >
              Set {draftDays} days
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
