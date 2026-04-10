import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../shared/store';
import { useTripPlanInput } from './useTripPlanInput';
import type { StartChip } from './useTripPlanInput';
import { computeTotalDays } from './trip-capacity-utils';

interface Props {
  onClose: () => void;
  onRequestPinDrop: () => void;
  pinDropResult: { lat: number; lon: number } | null;
  pinPlaceName?: string | null;
  onClearPin: () => void;
}

// ── Design tokens (match app theme) ─────────────────────────────
const SURFACE  = '#141921';
const SURFACE2 = '#1A1F2B';
const PRIMARY  = '#3b82f6';
const PRIMARY_BG = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1 = '#f1f5f9';
const TEXT3 = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

const CHIPS: Array<{ value: StartChip; icon: string; label: string }> = [
  { value: 'hotel',   icon: 'hotel',   label: 'Hotel'   },
  { value: 'airport', icon: 'flight',  label: 'Airport' },
  { value: 'pin',     icon: 'location_on', label: 'Drop pin' },
];

export function TripPlanningCard({
  onClose,
  onRequestPinDrop,
  pinDropResult,
  pinPlaceName,
  onClearPin,
}: Props) {
  const { state } = useAppStore();
  const city        = state.city;
  const placesCount = state.selectedPlaces.length;
  const { travelStartDate, travelEndDate } = state;
  const totalDays = computeTotalDays(travelStartDate, travelEndDate);
  const locationInputRef = useRef<HTMLDivElement>(null);

  function formatDateShort(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });
  }

  // Entrance animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const {
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
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,.7)',
          backdropFilter: 'blur(4px)',
          opacity: mounted ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      />

      {/* Modal sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 16, right: 16,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
          zIndex: 51,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 24,
          boxShadow: '0 -8px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)',
          transform: mounted ? 'translateY(0)' : 'translateY(32px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform .38s cubic-bezier(.32,.72,0,1), opacity .3s ease',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            padding: '22px 20px 18px',
            background: `linear-gradient(135deg, rgba(59,130,246,.08) 0%, rgba(15,23,42,0) 60%)`,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          {/* Close */}
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,.07)',
              border: `1px solid ${BORDER}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span className="ms" style={{ fontSize: 16, color: TEXT3 }}>close</span>
          </button>

          {/* Label + city */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: PRIMARY, marginBottom: 6,
            fontFamily: 'Inter, sans-serif',
          }}>
            Plan your day
          </div>
          <div style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 22, fontWeight: 800, color: TEXT1, lineHeight: 1.1,
          }}>
            {city || 'Your City'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Date range badge */}
            {travelStartDate && travelEndDate ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 24, padding: '0 10px',
                background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
                borderRadius: 999,
              }}>
                <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>calendar_month</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                  {formatDateShort(travelStartDate)} – {formatDateShort(travelEndDate)} · {totalDays} day{totalDays !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 24, padding: '0 10px',
                background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}`,
                borderRadius: 999,
              }}>
                <span className="ms" style={{ fontSize: 12, color: TEXT3 }}>calendar_month</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: TEXT3, fontFamily: 'Inter, sans-serif' }}>
                  Set dates in explore
                </span>
              </div>
            )}
            {/* Places badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 24, padding: '0 10px',
              background: PRIMARY_BG, border: `1px solid ${PRIMARY_BORDER}`,
              borderRadius: 999,
            }}>
              <span className="ms" style={{ fontSize: 12, color: PRIMARY }}>place</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', fontFamily: 'Inter, sans-serif' }}>
                {placesCount} place{placesCount !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Starting point */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
              textTransform: 'uppercase', color: TEXT3, marginBottom: 12,
              fontFamily: 'Inter, sans-serif',
            }}>
              Starting point
            </div>

            {/* Chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
                      flex: 1,
                      height: 44,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 2,
                      background: active ? PRIMARY_BG : 'rgba(255,255,255,.04)',
                      border: `1.5px solid ${active ? PRIMARY_BORDER : BORDER}`,
                      borderRadius: 14, cursor: 'pointer',
                      transition: 'all .15s ease',
                    }}
                  >
                    <span className="ms" style={{
                      fontSize: 17,
                      color: active ? PRIMARY : TEXT3,
                    }}>
                      {chip.icon}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: active ? '#93c5fd' : TEXT3,
                      fontFamily: 'Inter, sans-serif',
                    }}>
                      {chip.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Pin drop confirmation */}
            {pinDropResult ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px',
                background: 'rgba(20,184,166,.08)',
                border: '1px solid rgba(20,184,166,.25)',
                borderRadius: 14,
              }}>
                <span className="ms" style={{ fontSize: 18, color: '#2dd4bf', flexShrink: 0 }}>location_on</span>
                <span style={{ fontSize: 13, color: '#5eead4', flex: 1, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  {pinPlaceName ?? `${pinDropResult.lat.toFixed(4)}, ${pinDropResult.lon.toFixed(4)}`}
                </span>
                <button
                  onClick={handleClearPin}
                  style={{
                    fontSize: 11, fontWeight: 700, color: TEXT3,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Clear
                </button>
              </div>
            ) : startChip !== 'pin' && (
              /* Hotel/Airport search input */
              <div ref={locationInputRef} style={{ position: 'relative' }}>
                <div
                  style={{
                    background: SURFACE2,
                    border: `1.5px solid ${BORDER}`,
                    borderRadius: 14, height: 52,
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0 14px',
                    transition: 'border-color .15s',
                  }}
                >
                  <span className="ms" style={{ fontSize: 20, color: TEXT3, flexShrink: 0 }}>
                    {startChip === 'hotel' ? 'hotel' : 'flight'}
                  </span>
                  <input
                    type="text"
                    aria-label={startChip === 'hotel' ? 'Hotel or address search' : 'Airport search'}
                    value={locationQuery}
                    onChange={e => handleLocationInput(e.target.value)}
                    placeholder={startChip === 'hotel' ? 'Search hotel or address…' : 'Search airport…'}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      fontSize: 14, fontWeight: 600, color: TEXT1,
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      caretColor: PRIMARY,
                    }}
                  />
                  {locationLoading && (
                    <span className="ms animate-spin" style={{ fontSize: 16, color: TEXT3, flexShrink: 0 }}>autorenew</span>
                  )}
                  {selectedLocation && !locationLoading && (
                    <span className="ms" style={{ fontSize: 18, color: '#4ade80', flexShrink: 0 }}>check_circle</span>
                  )}
                </div>

                {locationResults.length > 0 && (() => {
                  const rect = locationInputRef.current?.getBoundingClientRect();
                  if (!rect) return null;
                  return createPortal(
                    <div
                      style={{
                        position: 'fixed',
                        top: rect.bottom + 4,
                        left: rect.left,
                        width: rect.width,
                        zIndex: 9999,
                        background: '#1E2535',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,.6)',
                      }}
                    >
                      {locationResults.map((r, i) => (
                        <button
                          key={r.place_id}
                          onMouseDown={() => handleSelectLocation(r)}
                          style={{
                            width: '100%', textAlign: 'left',
                            padding: '12px 16px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                            display: 'flex', alignItems: 'center', gap: 12,
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: PRIMARY_BG,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span className="ms" style={{ fontSize: 16, color: PRIMARY }}>
                              {startChip === 'hotel' ? 'hotel' : 'flight'}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                              {r.main_text}
                            </div>
                            <div style={{ fontSize: 11, color: TEXT3, marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
                              {r.secondary_text}
                            </div>
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

          {/* Recommended start time */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
            background: 'rgba(59,130,246,.06)',
            border: `1px solid ${PRIMARY_BORDER}`,
            borderRadius: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: PRIMARY_BG,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms" style={{ fontSize: 20, color: PRIMARY }}>schedule</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                textTransform: 'uppercase', color: '#60a5fa',
                fontFamily: 'Inter, sans-serif', marginBottom: 3,
              }}>
                Recommended start
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800, color: TEXT1, lineHeight: 1,
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}>
                {startTimeDisplay}
              </div>
            </div>
            <div style={{
              fontSize: 11, color: TEXT3, textAlign: 'right', lineHeight: 1.6,
              fontFamily: 'Inter, sans-serif',
            }}>
              Based on {placesCount} place{placesCount !== 1 ? 's' : ''}<br />
              + opening hours
            </div>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <div style={{ padding: 20 }}>
          <button
            onClick={() => handleBuild(pinDropResult)}
            disabled={!canBuild}
            style={{
              width: '100%', height: 54,
              background: canBuild
                ? `linear-gradient(135deg, ${PRIMARY}, #2563eb)`
                : 'rgba(255,255,255,.06)',
              border: 'none',
              borderRadius: 16, cursor: canBuild ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 15, fontWeight: 800,
              color: canBuild ? '#fff' : 'rgba(255,255,255,.25)',
              letterSpacing: 0.2,
              boxShadow: canBuild ? `0 4px 24px rgba(59,130,246,.35)` : 'none',
              transition: 'all .2s ease',
            }}
          >
            <span className="ms" style={{ fontSize: 20 }}>auto_fix</span>
            {totalDays > 1 ? `Build my ${totalDays}-day itinerary` : 'Build my itinerary'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
