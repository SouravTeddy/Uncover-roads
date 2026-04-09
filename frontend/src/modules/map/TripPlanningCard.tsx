import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { useTripPlanInput } from './useTripPlanInput';
import type { StartChip } from './useTripPlanInput';

interface Props {
  onClose: () => void;
  onRequestPinDrop: () => void;
  pinDropResult: { lat: number; lon: number } | null;
  pinPlaceName?: string | null;
  onClearPin: () => void;
}

const CHIPS: Array<{ value: StartChip; icon: string; label: string }> = [
  { value: 'hotel',   icon: '🏨', label: 'Hotel'   },
  { value: 'airport', icon: '✈',  label: 'Airport' },
  { value: 'pin',     icon: '📍', label: 'Pin'     },
];

export function TripPlanningCard({ onClose, onRequestPinDrop, pinDropResult, pinPlaceName, onClearPin }: Props) {
  const { state } = useAppStore();
  const city = state.city;
  const placesCount = state.selectedPlaces.length;

  const locationInputRef = useRef<HTMLDivElement>(null);

  const {
    dates, selectedDate, setSelectedDate,
    startChip, handleChipChange,
    locationQuery, locationResults, locationLoading, selectedLocation,
    handleLocationInput, handleSelectLocation,
    startTimeDisplay,
    canBuild, handleBuild,
  } = useTripPlanInput();

  function handlePinChip() {
    handleChipChange('pin');
    onRequestPinDrop();
    onClose();
  }

  function handleClearPin() {
    onClearPin();
    handleChipChange('hotel');
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '8%',
          left: '16px',
          right: '16px',
          zIndex: 51,
          background: 'linear-gradient(160deg, rgba(30,20,60,.95), rgba(10,18,30,.98))',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Cinematic header ─────────────────────────── */}
        <div style={{ height: 90, position: 'relative', overflow: 'hidden' }}>
          {/* Gradient backdrop (no city image in state — dark gradient fallback) */}
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, #0d1f35, #1a0d35, #0d1f1a)',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, transparent, rgba(20,14,50,.95))',
            }}
          />
          {/* Close button */}
          <button
            aria-label="Close"
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
          {/* Place count */}
          <div
            style={{
              position: 'absolute', top: 13, right: 48,
              fontSize: 10, color: 'rgba(255,255,255,.3)',
            }}
          >
            {placesCount} place{placesCount !== 1 ? 's' : ''}
          </div>
          {/* City name */}
          <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
            <div
              style={{
                fontSize: 10, color: 'rgba(255,255,255,.5)',
                textTransform: 'uppercase', letterSpacing: 2,
              }}
            >
              Your day in
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{city}</div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────── */}
        <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Starting point */}
          <div>
            <div
              style={{
                fontSize: 8, color: 'rgba(255,255,255,.35)',
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
              }}
            >
              Starting point
            </div>

            {/* Chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {CHIPS.map(chip => {
                const active = startChip === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => {
                      if (chip.value === 'pin') { handlePinChip(); return; }
                      handleChipChange(chip.value);
                    }}
                    style={{
                      flex: 1, padding: '6px 0',
                      background: active ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.05)',
                      border: active
                        ? '1px solid rgba(99,102,241,.4)'
                        : '1px solid rgba(255,255,255,.08)',
                      borderRadius: 20, fontSize: 9,
                      color: active ? '#a5b4fc' : 'rgba(255,255,255,.4)',
                      fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {chip.icon} {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Pin drop confirmation */}
            {pinDropResult ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(20,184,166,.1)', border: '1px solid rgba(20,184,166,.3)', borderRadius: 11 }}>
                <span style={{ fontSize: 10, color: '#2dd4bf' }}>📍</span>
                <span style={{ fontSize: 10, color: '#5eead4', flex: 1 }}>
                  {pinPlaceName ?? `${pinDropResult.lat.toFixed(4)}, ${pinDropResult.lon.toFixed(4)}`}
                </span>
                <button
                  onClick={handleClearPin}
                  style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear
                </button>
              </div>
            ) : startChip !== 'pin' && (
              /* Hotel/Airport search input */
              <div ref={locationInputRef} style={{ position: 'relative' }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 11, padding: '9px 12px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {startChip === 'hotel' ? '🏨' : '✈'}
                  </span>
                  <input
                    type="text"
                    aria-label={startChip === 'hotel' ? 'Hotel or address search' : 'Airport search'}
                    value={locationQuery}
                    onChange={e => handleLocationInput(e.target.value)}
                    placeholder={startChip === 'hotel' ? 'Search hotel or address…' : 'Search airport…'}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      fontSize: 11, color: 'rgba(255,255,255,.8)',
                    }}
                  />
                  {locationLoading && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>⋯</span>
                  )}
                  {selectedLocation && !locationLoading && (
                    <span style={{ fontSize: 10, color: '#22c55e', flexShrink: 0 }}>✓</span>
                  )}
                </div>

                {locationResults.length > 0 && (() => {
                  const r = locationInputRef.current?.getBoundingClientRect();
                  if (!r) return null;
                  return createPortal(
                  <div
                    style={{
                      position: 'fixed',
                      top: r.bottom + 4,
                      left: r.left,
                      width: r.width,
                      zIndex: 9999,
                      background: 'rgba(10,14,24,.97)',
                      border: '1px solid rgba(255,255,255,.1)',
                      borderRadius: 11, overflow: 'hidden',
                    }}
                  >
                    {locationResults.map((r, i) => (
                      <button
                        key={r.place_id}
                        onMouseDown={() => handleSelectLocation(r)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 12px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderTop: i > 0 ? '1px solid rgba(255,255,255,.06)' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
                          {r.main_text}
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
                          {r.secondary_text}
                        </div>
                      </button>
                    ))}
                  </div>,
                  document.body,
                  );
                })()}
              </div>
            )}
          </div>

          {/* Travel date strip */}
          <div>
            <div
              style={{
                fontSize: 8, color: 'rgba(255,255,255,.35)',
                textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8,
              }}
            >
              Travel date
            </div>
            <div
              style={{
                display: 'flex', gap: 5,
                overflowX: 'auto', paddingBottom: 4,
                scrollbarWidth: 'none',
              }}
            >
              {dates.map(d => {
                const active = d.isoDate === selectedDate;
                return (
                  <button
                    key={d.isoDate}
                    onClick={() => setSelectedDate(d.isoDate)}
                    aria-label={`Select ${d.dayAbbr} ${d.dayNum}`}
                    aria-pressed={active}
                    style={{
                      flexShrink: 0, width: 44, padding: '7px 4px',
                      background: active ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.04)',
                      border: active
                        ? '1px solid rgba(99,102,241,.5)'
                        : '1px solid rgba(255,255,255,.07)',
                      borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 8, color: active ? '#a5b4fc' : 'rgba(255,255,255,.3)' }}>
                      {d.dayAbbr}
                    </div>
                    <div
                      style={{
                        fontSize: 13, marginTop: 2,
                        fontWeight: active ? 800 : 700,
                        color: active ? '#fff' : 'rgba(255,255,255,.4)',
                      }}
                    >
                      {d.dayNum}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recommended start time */}
          <div
            style={{
              background: 'rgba(99,102,241,.1)',
              border: '1px solid rgba(99,102,241,.25)',
              borderRadius: 11, padding: '9px 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 8, color: '#818cf8',
                  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
                }}
              >
                ⚡ Recommended start
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c7d2fe' }}>
                {startTimeDisplay}
              </div>
            </div>
            <div
              style={{
                fontSize: 9, color: 'rgba(255,255,255,.3)',
                textAlign: 'right', lineHeight: 1.5,
              }}
            >
              Based on {placesCount} place{placesCount !== 1 ? 's' : ''}<br />
              + opening hours
            </div>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────── */}
        <div style={{ padding: 14 }}>
          <button
            onClick={() => handleBuild(pinDropResult)}
            disabled={!canBuild}
            style={{
              width: '100%',
              background: canBuild
                ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                : 'rgba(255,255,255,.08)',
              borderRadius: 14, padding: 12,
              fontSize: 12, fontWeight: 800,
              color: canBuild ? '#fff' : 'rgba(255,255,255,.3)',
              letterSpacing: 0.3, border: 'none', cursor: canBuild ? 'pointer' : 'default',
            }}
          >
            Build my itinerary ✦
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
