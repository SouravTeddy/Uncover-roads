import { useEffect, useState } from 'react';
import type { ReelIntroCard } from './types';
import { WeatherCanvas } from '../WeatherCanvas';
import { useAppStore } from '../../../shared/store';
import { TripDetailsSheet } from './TripDetailsSheet';
import type { TripDetails } from '../../../shared/types';

interface Props {
  card: ReelIntroCard;
  active: boolean;
  onAddDetail?: () => void;
}

const GRADIENT = 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,.05) 35%, rgba(0,0,0,.55) 60%, rgba(0,0,0,.9) 80%, rgba(0,0,0,.97) 100%)';

const CHANGE_LABELS: Record<string, string> = {
  swap:       'Swapped a stop to fit your style',
  insert:     'Added something you might love',
  resequence: 'Rearranged for a smoother day',
  weather:    'Worked around the forecast',
  transit:    'Accounted for travel time',
  advisory:   'Flagged something important',
  event:      'Planned around a local event',
};

const CHANGE_ICONS: Record<string, string> = {
  swap:       'swap_horiz',
  insert:     'add_circle',
  resequence: 'swap_vert',
  weather:    'wb_cloudy',
  transit:    'directions_transit',
  advisory:   'info',
  event:      'event',
};

function WeatherIcon({ condition }: { condition: string }) {
  const lower = condition.toLowerCase();
  const isRain = /rain|drizzle|shower/.test(lower);
  const isThunder = /thunder|storm|lightning/.test(lower);
  const isCloudy = /cloud|overcast/.test(lower);

  if (isThunder) {
    return (
      <span className="ms fill" style={{ fontSize: 15, color: 'rgba(255,255,255,.8)', animation: 'weather-flicker 2.4s ease-in-out infinite' }}>
        bolt
      </span>
    );
  }
  if (isRain) {
    return (
      <span className="ms fill" style={{ fontSize: 15, color: 'rgba(255,255,255,.7)', animation: 'weather-fall .9s ease-in-out infinite alternate' }}>
        water_drop
      </span>
    );
  }
  if (isCloudy) {
    return (
      <span className="ms fill" style={{ fontSize: 15, color: 'rgba(255,255,255,.7)', animation: 'weather-drift 3s ease-in-out infinite alternate' }}>
        cloud
      </span>
    );
  }
  return (
    <span className="ms fill" style={{ fontSize: 15, color: 'rgba(255,255,255,.8)', animation: 'weather-pulse 2.5s ease-in-out infinite' }}>
      wb_sunny
    </span>
  );
}

export function ReelIntroCard({ card, active }: Props) {
  const { state, dispatch } = useAppStore();
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [active]);

  // Resolve saved trip vs. fresh reel
  const savedItem = state.reelSavedId
    ? state.savedItineraries.find(s => s.id === state.reelSavedId) ?? null
    : null;
  const existingDetails: TripDetails | null = savedItem?.tripDetails ?? state.pendingTripDetails ?? null;
  const cities: string[] = state.engineItinerary?.cities?.length
    ? state.engineItinerary.cities
    : [card.city];
  const journeyLegs = savedItem?.journeyLegs ?? state.journey ?? null;
  const hasDetails = !!(existingDetails?.arrivalDate);

  function handleTripDetailsSave(details: TripDetails) {
    if (savedItem) {
      dispatch({ type: 'UPDATE_SAVED_ITINERARY', id: savedItem.id, patch: { tripDetails: details } });
    } else {
      dispatch({ type: 'SET_PENDING_TRIP_DETAILS', details });
    }
  }

  const topChanges = card.engineChanges.slice(0, 2);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      {card.imageUrl
        ? <img src={card.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0c0c0e, #1a1420)' }} />
      }
      {/* Weather particle layer — rendered above photo, below gradient */}
      {card.weather && <WeatherCanvas condition={card.weather.condition} />}
      <div style={{ position: 'absolute', inset: 0, background: GRADIENT }} />

      {/* Trip details button — top right */}
      <button
        onClick={() => setSheetOpen(true)}
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 14,
          zIndex: 10,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '7px 12px', borderRadius: 999,
          background: hasDetails ? 'rgba(212,168,83,.18)' : 'rgba(255,255,255,.12)',
          backdropFilter: 'blur(8px)',
          border: hasDetails ? '1px solid rgba(212,168,83,.35)' : '1px solid rgba(255,255,255,.18)',
          fontSize: 11, fontWeight: 600,
          color: hasDetails ? '#d4a853' : 'rgba(255,255,255,.85)',
          cursor: 'pointer',
        }}
      >
        <span className="ms" style={{ fontSize: 13 }}>
          {hasDetails ? 'hotel' : 'edit_calendar'}
        </span>
        {hasDetails ? 'Trip details set' : 'Add trip details'}
      </button>

      {sheetOpen && (
        <TripDetailsSheet
          cities={cities}
          journeyLegs={journeyLegs}
          existingDetails={existingDetails}
          travelDate={savedItem?.travelDate ?? state.travelStartDate ?? null}
          onSave={handleTripDetailsSave}
          onClose={() => setSheetOpen(false)}
        />
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 88px', zIndex: 10 }}>

        {/* Label */}
        <p className="reel-meta" style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.5)', marginBottom: 8,
          animation: visible ? 'fadeUp .5s .05s both' : 'none',
        }}>
          {card.totalDays === 1 ? 'Your day' : `Your ${card.totalDays}-day trip`}
        </p>

        {/* City */}
        <h1 className="reel-h1" style={{
          fontFamily: 'var(--font-heading)', fontSize: 52, fontWeight: 700,
          color: '#fff', lineHeight: 1, marginBottom: 18,
          animation: visible ? 'fadeUp .5s .15s both' : 'none',
        }}>{card.city}</h1>

        {/* Stats + weather row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
          animation: visible ? 'fadeUp .5s .25s both' : 'none',
        }}>
          <span className="reel-meta" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 999,
            border: '1px solid var(--color-border)',
            background: 'rgba(255,255,255,.07)',
          }}>
            <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>place</span>
            {card.totalStops} stops
          </span>

          {card.totalDays > 1 && (
            <span className="reel-meta" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999,
              border: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.08)',
            }}>
              <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>calendar_today</span>
              {card.totalDays} days
            </span>
          )}

          {card.weather && (
            <span className="reel-meta" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 999,
              border: '1px solid rgba(255,255,255,.12)',
              background: 'rgba(255,255,255,.08)',
            }}>
              <WeatherIcon condition={card.weather.condition} />
              {card.weather.temp}° · {card.weather.condition}
            </span>
          )}

          <span className="reel-meta" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 999,
            border: '1px solid var(--color-border)',
            background: 'rgba(255,255,255,.07)',
          }}>
            <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>person</span>
            {card.persona}
          </span>
        </div>

        {/* Pro tip or engine intelligence */}
        {(card.proTip || topChanges.length > 0) && (
          <div style={{ animation: visible ? 'fadeUp .5s .35s both' : 'none', marginBottom: 16 }}>
            {card.proTip && (
              <p className="reel-meta" style={{
                fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: topChanges.length > 0 ? 10 : 0,
              }}>{card.proTip}</p>
            )}
            {topChanges.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topChanges.map(({ type, count }) => (
                  <div key={type} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '6px 10px', borderRadius: 10,
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.1)',
                    backdropFilter: 'blur(6px)',
                  }}>
                    <span className="ms reel-meta" style={{ fontSize: 13, color: 'rgba(212,168,83,.85)' }}>{CHANGE_ICONS[type] ?? 'tune'}</span>
                    <span className="reel-meta" style={{ fontSize: 11, color: 'rgba(255,255,255,.65)' }}>
                      {CHANGE_LABELS[type] ?? type}{count > 1 ? ` ×${count}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Swipe hint */}
        <div style={{ textAlign: 'center', marginTop: 8, animation: visible ? 'fadeUp .5s .45s both' : 'none' }}>
          <span className="ms" style={{ fontSize: 20, color: 'rgba(255,255,255,.3)' }}>swipe_up</span>
        </div>
      </div>
    </div>
  );
}
