import { useState, useEffect, useRef, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { Place, PlaceDetails, ReferencePin } from '../../shared/types'
import type { Persona, PersonaProfile } from '../../shared/types'
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types'
import { getPlacePhotoUrl, api } from '../../shared/api'
import { getTravelDateBadge } from './pincard-utils'
import { ShimmerLine } from '../../shared/Shimmer'
import { computePersonaBadges, usePersonaInsight } from './pincard-persona'

// ── Design tokens ─────────────────────────────────────────────
const SURFACE  = 'rgba(15,19,28,0.97)'
const BORDER   = 'rgba(255,255,255,0.08)'
const TEXT1    = '#f1f5f9'
const TEXT3    = 'rgba(193,198,215,0.7)'
const ACCENT   = '#3b82f6'
const AI_MARK  = '#8b5cf6'
const PRICE: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }
const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
}

// ── Props ─────────────────────────────────────────────────────
interface Props {
  place: Place
  city: string
  isSelected: boolean
  isFavourited: boolean
  onAdd: () => void
  onClose: () => void
  onSimilar: () => void
  onFavourite: () => void
  details?: PlaceDetails | null
  referencePin?: ReferencePin | null
  travelDate?: string | null
  persona?: Persona | null
  personaProfile?: PersonaProfile | null
  insightCache?: MutableRefObject<Map<string, string>>
}

const linkStyle: React.CSSProperties = {
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
  height: 36, padding: '0 14px', borderRadius: 999,
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
  fontSize: '0.72rem', fontWeight: 700, color: 'rgba(193,198,215,.8)',
  textDecoration: 'none', WebkitTapHighlightColor: 'transparent',
}

export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onSimilar, onFavourite,
  details, referencePin, travelDate,
  persona, personaProfile, insightCache,
}: Props) {
  const [visible, setVisible]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [imgSrc, setImgSrc]     = useState<string | null>(null)
  const sheetRef    = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const dragY       = useRef(0)
  const closing     = useRef(false)

  // Slide-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    document.documentElement.style.overscrollBehaviorY = 'none'
    document.body.style.overscrollBehaviorY = 'none'
    return () => {
      cancelAnimationFrame(id)
      document.documentElement.style.overscrollBehaviorY = ''
      document.body.style.overscrollBehaviorY = ''
    }
  }, [])

  // Hero image loading
  const photoRef = details?.photo_ref ?? place.photo_ref ?? null
  const googlePhotoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null
  useEffect(() => {
    closing.current = false
    if (googlePhotoUrl) {
      const img = new Image()
      img.onload = () => setImgSrc(googlePhotoUrl)
      img.onerror = () => {
        api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url) })
      }
      img.src = googlePhotoUrl
    } else {
      setImgSrc(null)
      api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, googlePhotoUrl])

  // LLM archetype insight
  const fallbackCache = useRef(new Map<string, string>())
  const activeCache = insightCache ?? fallbackCache
  const { insight, loading: insightLoading } = usePersonaInsight(
    place, persona ?? null, 'map', activeCache,
  )

  // Persona badges — computed synchronously
  const personaBadges = (persona && personaProfile != null)
    ? computePersonaBadges(place, persona, personaProfile, 'map')
    : []

  // Swipe to dismiss handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    dragY.current = 0
  }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`
      dragY.current = dy
    }
  }, [])
  const handleTouchEnd = useCallback(() => {
    if (dragY.current > 80 && !closing.current) {
      closing.current = true
      if (sheetRef.current) {
        sheetRef.current.style.transform = 'translateY(100%)'
        sheetRef.current.style.transition = 'transform 0.25s ease'
      }
      setTimeout(onClose, 240)
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    dragY.current = 0
  }, [onClose])

  // Data from Google Places (factual — no AI marker)
  const rating      = details?.rating      ?? place.rating      ?? null
  const ratingCount = details?.rating_count ?? null
  const priceLevel  = details?.price_level  ?? null
  const dateAlert   = travelDate ? getTravelDateBadge(details?.weekday_text ?? null, travelDate) : null
  const catColor    = CATEGORY_COLORS[place.category] ?? '#6b7280'
  const catIcon     = CATEGORY_ICONS[place.category]  ?? 'location_on'
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place'
  const websiteUrl  = details?.website ?? place.tags?.website ?? null
  const mapsUrl     = details?.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${details.place_id}`
    : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { if (!closing.current) { closing.current = true; onClose() } }}
        style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'transparent' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: SURFACE, borderRadius: '20px 20px 0 0',
          border: `1px solid ${BORDER}`, borderBottom: 'none',
          backdropFilter: 'blur(20px)',
          maxHeight: expanded ? '92vh' : '48vh',
          overflow: expanded ? 'auto' : 'hidden',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1), max-height 0.3s ease',
          willChange: 'transform',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, touchAction: 'none' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Hero image */}
        <div style={{ height: 140, background: catColor + '22', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {imgSrc ? (
            <img src={imgSrc} alt={place.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span className="ms fill" style={{ fontSize: 48, color: catColor, opacity: 0.6 }}>{catIcon}</span>
            </div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,19,28,0.8) 0%, transparent 50%)' }} />
        </div>

        {/* Card body */}
        <div style={{ padding: '12px 16px 20px' }}>
          {/* Title + area */}
          <h2 style={{ margin: '0 0 2px', fontSize: '1.1rem', fontWeight: 800, color: TEXT1, lineHeight: 1.2 }}>
            {place.title}
          </h2>
          {place.area && (
            <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: TEXT3 }}>{place.area}</p>
          )}

          {/* Rating + price + category chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {rating !== null && (
              <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700 }}>
                ★ {typeof rating === 'number' ? rating.toFixed(1) : rating}
                {ratingCount !== null && (
                  <span style={{ color: TEXT3, fontWeight: 400 }}> ({(ratingCount as number).toLocaleString()})</span>
                )}
              </span>
            )}
            {priceLevel !== null && priceLevel in PRICE && (
              <span style={{ fontSize: '0.75rem', color: TEXT3 }}>{PRICE[priceLevel as keyof typeof PRICE]}</span>
            )}
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: catColor, background: catColor + '18', borderRadius: 99, padding: '2px 8px' }}>
              {categoryLabel}
            </span>
          </div>

          {/* Intel pill — travel date alert (factual, from Google Places) */}
          {dateAlert && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 99, marginBottom: 8,
              background: dateAlert.type === 'warning' ? 'rgba(234,179,8,.12)' : 'rgba(34,197,94,.1)',
              border: `1px solid ${dateAlert.type === 'warning' ? 'rgba(234,179,8,.3)' : 'rgba(34,197,94,.3)'}`,
              fontSize: '0.7rem', fontWeight: 700,
              color: dateAlert.type === 'warning' ? '#fbbf24' : '#86efac',
            }}>
              {dateAlert.type === 'warning' ? '⚠️' : '✓'} {dateAlert.label}
            </div>
          )}

          {/* Persona badges */}
          {personaBadges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {personaBadges.map((badge) => (
                <div key={badge.text} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 999,
                  fontSize: '0.68rem', fontWeight: 700,
                  color: badge.color,
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                }}>
                  {badge.text}
                </div>
              ))}
            </div>
          )}

          {/* Archetype insight — LLM ✦ (persona tone only, no facts) */}
          <div style={{ marginBottom: 12, minHeight: 20 }}>
            {insightLoading ? (
              <ShimmerLine width="80%" height={14} />
            ) : insight ? (
              <p style={{ margin: 0, fontSize: '0.78rem', color: TEXT3, fontStyle: 'italic', lineHeight: 1.5 }}>
                <span style={{ color: AI_MARK, marginRight: 4 }}>✦</span>{insight}
              </p>
            ) : null}
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <button onClick={onFavourite} style={{
              flex: 1, padding: '10px 0', borderRadius: 12,
              background: isFavourited ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.06)',
              border: `1px solid ${isFavourited ? 'rgba(239,68,68,.4)' : BORDER}`,
              color: isFavourited ? '#f87171' : TEXT3,
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}>
              {isFavourited ? '❤️ Saved' : '🤍 Save'}
            </button>
            <button onClick={onAdd} style={{
              flex: 2, padding: '10px 0', borderRadius: 12,
              background: isSelected ? 'rgba(59,130,246,.15)' : ACCENT,
              border: `1px solid ${isSelected ? 'rgba(59,130,246,.4)' : 'transparent'}`,
              color: isSelected ? '#60a5fa' : '#fff',
              fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}>
              {isSelected ? '✓ In itinerary' : '+ Add to itinerary'}
            </button>
            <button onClick={() => { onSimilar(); setExpanded(false) }} style={{
              flex: 1, padding: '10px 0', borderRadius: 12,
              background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}`,
              color: AI_MARK, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
            }}>
              ✦ Similar
            </button>
          </div>

          {/* Expand toggle */}
          {!expanded && (
            <button onClick={() => setExpanded(true)} style={{
              width: '100%', marginTop: 8, padding: '8px 0',
              background: 'transparent', border: 'none', color: TEXT3, fontSize: '0.72rem', cursor: 'pointer',
            }}>
              More details ↓
            </button>
          )}

          {/* Expanded content */}
          {expanded && (
            <div>
              {referencePin?.localTip && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.2)',
                }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: TEXT3, lineHeight: 1.5 }}>
                    <span style={{ color: AI_MARK, marginRight: 4 }}>✦</span>{referencePin.localTip}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  <span className="ms" style={{ fontSize: 14 }}>map</span> Google Maps
                </a>
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    <span className="ms" style={{ fontSize: 14 }}>language</span> Website
                  </a>
                )}
              </div>
              <button onClick={() => setExpanded(false)} style={{
                width: '100%', marginTop: 12, padding: '8px 0',
                background: 'transparent', border: 'none', color: TEXT3, fontSize: '0.72rem', cursor: 'pointer',
              }}>
                Show less ↑
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
