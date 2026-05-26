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

function introSkyTint(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return 'linear-gradient(180deg,rgba(25,38,62,.65),rgba(25,38,62,.40))';
  if (c.includes('thunder') || c.includes('storm'))  return 'linear-gradient(180deg,rgba(85,40,125,.60),rgba(60,25,95,.45))';
  if (c.includes('snow'))                            return 'rgba(55,72,100,.55)';
  if (c.includes('fog') || c.includes('mist'))       return 'rgba(110,118,132,.55)';
  if (c.includes('clear') || c.includes('sunny'))    return 'linear-gradient(180deg,rgba(255,210,140,.18),rgba(255,210,140,.04) 40%,transparent 70%)';
  if (c.includes('cloud') || c.includes('overcast') || c.includes('partly')) return 'rgba(150,165,185,.16)';
  return 'rgba(0,0,0,.12)';
}

function introTodGradient(hour: number): string | null {
  if (hour >= 6 && hour < 8)   return 'linear-gradient(180deg,rgba(255,210,180,.08) 0%,rgba(255,180,140,.18) 40%,rgba(250,150,110,.40) 72%,rgba(228,118,86,.62) 92%,rgba(212,98,68,.68) 100%)';
  if (hour >= 8 && hour < 11)  return 'linear-gradient(180deg,rgba(255,225,180,.05) 0%,rgba(255,205,140,.16) 50%,rgba(238,168,100,.40) 78%,rgba(216,138,80,.62) 100%)';
  if (hour >= 11 && hour < 16) return 'linear-gradient(180deg,rgba(180,210,235,.14) 0%,rgba(220,225,210,.08) 35%,rgba(245,225,170,.24) 70%,rgba(232,205,150,.40) 92%,rgba(218,188,130,.50) 100%)';
  if (hour >= 18 && hour < 20) return 'linear-gradient(180deg,rgba(80,55,120,.18) 0%,rgba(180,70,110,.28) 38%,rgba(200,80,90,.44) 60%,rgba(160,55,110,.60) 82%,rgba(95,40,130,.68) 100%)';
  if (hour >= 20)               return 'linear-gradient(180deg,rgba(20,28,55,.24) 0%,rgba(35,50,98,.36) 45%,rgba(40,55,110,.52) 75%,rgba(22,32,72,.68) 100%)';
  return null;
}

const GRADIENT = 'linear-gradient(180deg,transparent 0%,transparent 35%,rgba(0,0,0,.45) 65%,rgba(0,0,0,.85) 90%,rgba(10,10,13,.95) 100%)';

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

  const condition = (card.weather?.condition ?? '').toLowerCase();
  const introHour = 9; // default midday; startTime not on card type
  const skyTint = introSkyTint(condition);
  const todGrad = introTodGradient(introHour);
  const showSun = (condition.includes('clear') || condition.includes('sunny')) && introHour >= 8 && introHour < 18;

  const topChanges = card.engineChanges.slice(0, 2);

  return (
    <div className="reel-card" style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      {card.imageUrl
        ? <img src={card.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0c0c0e, #1a1420)' }} />
      }
      {/* Sky tint */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: skyTint, pointerEvents: 'none' }} />

      {/* Time-of-day gradient */}
      {todGrad && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: todGrad, pointerEvents: 'none' }} />
      )}

      {/* Sun rays — clear daytime only */}
      {showSun && (
        <>
          <div style={{
            position: 'absolute', zIndex: 4,
            right: '-20%', top: '-20%',
            width: '90%', height: '80%',
            background: 'radial-gradient(ellipse at top right,rgba(255,215,150,.38),rgba(255,215,150,0) 60%)',
            filter: 'blur(6px)',
            animation: 'sunGlow 6s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', zIndex: 4,
            top: '-40%', right: '-10%',
            width: '90%', height: '180%',
            transformOrigin: 'top right',
            animation: 'rayRotate 80s linear infinite',
            pointerEvents: 'none',
          }}>
            <div style={{ position: 'absolute', top: 0, left: '40%', width: 80, height: '100%', background: 'linear-gradient(180deg,rgba(255,225,160,.25),rgba(255,225,160,0) 65%)', transform: 'rotate(18deg)', transformOrigin: 'top center', filter: 'blur(12px)' }} />
            <div style={{ position: 'absolute', top: 0, left: '55%', width: 40, height: '100%', background: 'linear-gradient(180deg,rgba(255,235,180,.35),rgba(255,235,180,0) 65%)', transform: 'rotate(14deg)', transformOrigin: 'top center', filter: 'blur(8px)' }} />
          </div>
        </>
      )}

      {/* Weather particle layer — rendered above atmospheric layers, below scrim */}
      {card.weather && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
          <WeatherCanvas condition={card.weather.condition} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: GRADIENT }} />

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

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 17px 32px', zIndex: 10 }}>

        {/* Label */}
        <p className="reel-meta" style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.5)', marginBottom: 7,
          animation: visible ? 'fadeUp .5s .05s both' : 'none',
        }}>
          {card.totalDays === 1 ? 'Your day' : `Your ${card.totalDays}-day trip`}
        </p>

        {/* City */}
        <h1 className="reel-h1" style={{
          fontFamily: 'var(--font-heading)', fontSize: 50, fontWeight: 700,
          color: '#fff', lineHeight: 1, marginBottom: 13,
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
                    padding: '5px 10px', borderRadius: 9,
                    background: 'rgba(0,0,0,.28)',
                    border: '1px solid rgba(255,255,255,.09)',
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
