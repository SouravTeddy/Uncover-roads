import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOriginInput } from './useOriginInput';
import { useAppStore } from '../../shared/store';
import { ORIGIN_STRINGS, PLACE_TYPE_LABELS } from '../../shared/strings';
import { classifyOriginType } from '../../shared/origin-utils';
import type { OriginPlace } from '../../shared/types';

const SURFACE2 = '#1A1F2B';
const PRIMARY  = '#3b82f6';
const PRIMARY_BG = 'rgba(59,130,246,.12)';
const PRIMARY_BORDER = 'rgba(59,130,246,.25)';
const TEXT1 = '#f1f5f9';
const TEXT3 = '#8e9099';
const BORDER = 'rgba(255,255,255,.08)';

const TYPE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  hotel:   { bg: 'rgba(168,85,247,.15)',   color: '#a855f7' },
  airport: { bg: 'rgba(59,130,246,.15)',   color: '#3b82f6' },
  home:    { bg: 'rgba(34,197,94,.15)',    color: '#22c55e' },
  custom:  { bg: 'rgba(100,116,139,.2)',   color: '#94a3b8' },
};

interface Props {
  /** Called when origin is confirmed. null = "not decided" path. */
  onDone: (origin: OriginPlace | null) => void;
}

export function OriginSearchCard({ onDone }: Props) {
  const {
    step,
    searchQuery,
    searchResults,
    searchLoading,
    searchError,
    selectedOrigin,
    timeFieldLabel,
    timeValue,
    handleSearchInput,
    handleSelectResult,
    handleTimeChange,
    chooseNotDecided,
    buildOrigin,
  } = useOriginInput();

  const { state } = useAppStore();
  const firstPlace = state.selectedPlaces[0] ?? null;

  const inputRef = useRef<HTMLDivElement>(null);

  function handleConfirm() {
    onDone(buildOrigin());
  }

  const badgeStyle = selectedOrigin
    ? (TYPE_BADGE_STYLES[selectedOrigin.originType] ?? TYPE_BADGE_STYLES.custom)
    : TYPE_BADGE_STYLES.custom;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Opening / Searching state ── */}
      {(step === 'opening' || step === 'searching') && (
        <>
          <div ref={inputRef} style={{ position: 'relative' }}>
            <div style={{
              background: SURFACE2,
              border: `1.5px solid ${step === 'searching' ? PRIMARY_BORDER : BORDER}`,
              borderRadius: 14, height: 52,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 14px',
              transition: 'border-color .15s',
            }}>
              <span className="ms" style={{ fontSize: 20, color: TEXT3, flexShrink: 0 }}>search</span>
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                placeholder={ORIGIN_STRINGS.searchPlaceholder}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 14, fontWeight: 600, color: TEXT1,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  caretColor: PRIMARY,
                }}
              />
              {searchLoading && (
                <span className="ms animate-spin" style={{ fontSize: 16, color: TEXT3, flexShrink: 0 }}>autorenew</span>
              )}
            </div>

            {searchError && (
              <div style={{
                marginTop: 8,
                padding: '8px 12px',
                background: 'rgba(239,68,68,.1)',
                border: '1px solid rgba(239,68,68,.25)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span className="ms" style={{ fontSize: 15, color: '#f87171', flexShrink: 0 }}>info</span>
                <span style={{ fontSize: 12, color: '#fca5a5', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
                  {searchError}
                </span>
              </div>
            )}

            {searchResults.length > 0 && (() => {
              const rect = inputRef.current?.getBoundingClientRect();
              if (!rect) return null;
              return createPortal(
                <div style={{
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
                }}>
                  {searchResults.map((r, i) => (
                    <button
                      key={r.place_id}
                      onMouseDown={() => handleSelectResult(r)}
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
                        <span className="ms" style={{ fontSize: 16, color: PRIMARY }}>location_on</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                          {r.main_text}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT3, marginTop: 2, fontFamily: 'Inter, sans-serif' }}>
                          {r.secondary_text}
                        </div>
                      </div>
                      {(() => {
                        const type = classifyOriginType(r.types ?? []);
                        const badge = TYPE_BADGE_STYLES[type] ?? TYPE_BADGE_STYLES.custom;
                        return (
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 600,
                            fontFamily: 'Inter, sans-serif', flexShrink: 0,
                            background: badge.bg, color: badge.color,
                          }}>
                            {PLACE_TYPE_LABELS[type] ?? 'Place'}
                          </span>
                        );
                      })()}
                    </button>
                  ))}
                </div>,
                document.body,
              );
            })()}
          </div>

          <button
            onClick={chooseNotDecided}
            style={{
              height: 48, width: '100%',
              background: 'none',
              border: `1.5px dashed ${PRIMARY_BORDER}`,
              borderRadius: 14, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13, fontWeight: 600, color: '#93c5fd',
            }}
          >
            {ORIGIN_STRINGS.notDecidedLabel}
          </button>
        </>
      )}

      {/* ── Selected state ── */}
      {step === 'selected' && selectedOrigin && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            background: PRIMARY_BG,
            border: `1px solid ${PRIMARY_BORDER}`,
            borderRadius: 14,
          }}>
            <span className="ms" style={{ fontSize: 18, color: '#4ade80', flexShrink: 0 }}>check_circle</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT1, flex: 1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              {selectedOrigin.name}
            </span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              background: badgeStyle.bg, color: badgeStyle.color,
            }}>
              {PLACE_TYPE_LABELS[selectedOrigin.originType] ?? 'Place'}
            </span>
          </div>

          {timeFieldLabel && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                textTransform: 'uppercase', color: TEXT3, marginBottom: 8,
                fontFamily: 'Inter, sans-serif',
              }}>
                {timeFieldLabel} <span style={{ color: '#475569', fontWeight: 400 }}>— optional</span>
              </div>
              <input
                type="time"
                value={timeValue}
                onChange={e => handleTimeChange(e.target.value)}
                style={{
                  width: '100%', height: 52, background: SURFACE2,
                  border: `1.5px solid rgba(59,130,246,.35)`, borderRadius: 14,
                  fontSize: 24, fontWeight: 800, color: TEXT1,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  textAlign: 'center', outline: 'none', cursor: 'pointer',
                  colorScheme: 'dark',
                }}
              />
              <div style={{ fontSize: 11, color: PRIMARY, marginTop: 8, fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                {ORIGIN_STRINGS.optionalNudge}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Not decided state ── */}
      {step === 'not_decided' && (
        <div style={{
          background: 'rgba(59,130,246,.06)',
          border: `1px solid ${PRIMARY_BORDER}`,
          borderRadius: 14,
          padding: '16px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT1, fontFamily: '"Plus Jakarta Sans", sans-serif', marginBottom: 4 }}>
            {ORIGIN_STRINGS.notDecidedHeading}
          </div>
          <div style={{ fontSize: 12, color: TEXT3, fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
            {ORIGIN_STRINGS.notDecidedSub}
          </div>
          {firstPlace && (
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: 'rgba(255,255,255,.04)',
              borderRadius: 10,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span className="ms" style={{ fontSize: 16, color: '#3b82f6', flexShrink: 0, marginTop: 1 }}>location_on</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  {firstPlace.title}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
                  Get here early for the best experience
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm button (selected + not_decided only) ── */}
      {(step === 'selected' || step === 'not_decided') && (
        <button
          onClick={handleConfirm}
          style={{
            width: '100%', height: 48,
            background: `linear-gradient(135deg, ${PRIMARY}, #2563eb)`,
            border: 'none', borderRadius: 14, cursor: 'pointer',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 14, fontWeight: 700, color: '#fff',
            boxShadow: '0 4px 20px rgba(59,130,246,.3)',
          }}
        >
          {ORIGIN_STRINGS.cta}
        </button>
      )}
    </div>
  );
}
