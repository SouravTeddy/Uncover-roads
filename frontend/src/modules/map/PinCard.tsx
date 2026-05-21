import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Place, PlaceDetails } from '../../shared/types'
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types'
import { getPlacePhotoUrl, api } from '../../shared/api'
import { computeAnalysisInsights } from './pincard-utils'
import type { OurPickBadge } from './pincard-utils'
import { useSheetDismiss } from '../../shared/useSheetDismiss'

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
}

const PRICE: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

interface Props {
  place: Place
  city: string
  isSelected: boolean
  isFavourited: boolean
  onAdd: () => void
  onClose: () => void
  onFavourite: () => void
  details?: PlaceDetails | null
  travelDate?: string | null
  travelStartDate?: string | null
  travelEndDate?: string | null
  ourPickBadge?: OurPickBadge
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}

export function PinCard({
  place, city, isSelected, isFavourited,
  onAdd, onClose, onFavourite,
  details, travelDate, travelStartDate, travelEndDate,
  ourPickBadge = null,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const dragY = useRef(0)
  const closing = useRef(false)

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

  const photoRef = details?.photo_ref ?? place.photo_ref ?? null
  const googlePhotoUrl = photoRef ? getPlacePhotoUrl(photoRef) : null

  useEffect(() => {
    closing.current = false
    setImgSrc(null)
    if (googlePhotoUrl) {
      const img = new Image()
      img.onload = () => setImgSrc(googlePhotoUrl)
      img.onerror = () => {
        api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url) })
      }
      img.src = googlePhotoUrl
    } else {
      api.placeImage(place.title, city).then(url => { if (url) setImgSrc(url) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, googlePhotoUrl])

  useEffect(() => {
    setHoursOpen(false)
    setDescExpanded(false)
  }, [place.id])

  useSheetDismiss(onClose, true)

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

  const catColor = CATEGORY_COLORS[place.category] ?? '#6b7280'
  const catIcon = CATEGORY_ICONS[place.category] ?? 'location_on'
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place'
  const rating = details?.rating ?? place.rating ?? null
  const ratingCount = details?.rating_count ?? null
  const priceLevel = details?.price_level ?? null
  const openNow = details?.open_now ?? null
  const weekdayText = details?.weekday_text ?? []
  const description = (place as Place & { description?: string }).description ?? null

  // Prefer explicit start/end dates; fall back to single travelDate
  const resolvedStart = travelStartDate ?? travelDate ?? null
  const resolvedEnd = travelEndDate ?? travelDate ?? null

  const insights = computeAnalysisInsights(place, details ?? null, ourPickBadge, resolvedStart, resolvedEnd)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { if (!closing.current) { closing.current = true; onClose() } }}
        style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.01)' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
          backdropFilter: 'blur(20px)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
          willChange: 'transform',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, touchAction: 'none', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-m)' }} />
        </div>

        {/* Hero — 190px fixed height, does not scroll */}
        <div style={{ height: 190, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {imgSrc ? (
            <img src={imgSrc} alt={place.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(135deg, ${catColor}22, ${catColor}44)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms fill" style={{ fontSize: 56, color: catColor, opacity: 0.6 }}>{catIcon}</span>
            </div>
          )}
          {/* Bottom gradient fade */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--color-surface) 0%, transparent 55%)' }} />

          {/* Heart button — dark glass overlay, same on both themes */}
          <button
            onClick={onFavourite}
            style={{
              position: 'absolute', top: 11, right: 11,
              width: 36, height: 36, borderRadius: '50%',
              background: isFavourited ? 'rgba(212,168,83,0.35)' : 'rgba(0,0,0,0.48)',
              border: `1px solid ${isFavourited ? 'rgba(212,168,83,0.5)' : 'rgba(255,255,255,0.18)'}`,
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isFavourited ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Scrollable body */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '12px 16px 32px',
            flex: 1,
          }}
        >
          {/* Category chip */}
          <motion.div variants={sectionVariants} style={{ marginBottom: 6 }}>
            <span style={{
              display: 'inline-block',
              fontSize: '0.7rem', fontWeight: 700,
              color: catColor,
              background: catColor + '18',
              borderRadius: 99,
              padding: '2px 8px',
            }}>
              {categoryLabel}
            </span>
          </motion.div>

          {/* Place name — Cormorant Garamond, gold gradient */}
          <motion.h2
            variants={sectionVariants}
            style={{
              margin: '0 0 4px',
              fontFamily: 'var(--font-heading)',
              fontSize: 24, fontWeight: 700, lineHeight: 1.1,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            {place.title}
          </motion.h2>

          {/* Address */}
          {details?.address && (
            <motion.p
              variants={sectionVariants}
              style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--color-text-3)' }}
            >
              {details.address.split(',')[0]}
            </motion.p>
          )}

          {/* Meta chips */}
          <motion.div variants={sectionVariants} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {openNow !== null && (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: 99,
                background: openNow ? 'var(--color-sage-bg)' : 'var(--color-amber-bg)',
                border: `1px solid ${openNow ? 'var(--color-sage-bdr)' : 'var(--color-amber-bdr)'}`,
                color: openNow ? 'var(--color-sage)' : 'var(--color-amber)',
              }}>
                {openNow ? 'Open' : 'Closed'}
              </span>
            )}
            {rating !== null && (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: 99,
                background: 'var(--color-amber-bg)',
                border: '1px solid var(--color-amber-bdr)',
                color: 'var(--color-amber)',
              }}>
                ★ {typeof rating === 'number' ? rating.toFixed(1) : rating}
                {ratingCount !== null && (
                  <span style={{ fontWeight: 400, opacity: 0.7 }}> ({(ratingCount as number).toLocaleString()})</span>
                )}
              </span>
            )}
            {priceLevel !== null && priceLevel in PRICE && (
              <span style={{
                fontSize: '0.72rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: 99,
                background: 'var(--color-surface2)',
                border: '1px solid var(--color-border-m)',
                color: 'var(--color-text-3)',
              }}>
                {PRICE[priceLevel as keyof typeof PRICE]}
              </span>
            )}
          </motion.div>

          {/* Our Analysis aura strip */}
          {insights.length > 0 && (
            <motion.div
              variants={sectionVariants}
              style={{
                position: 'relative',
                background: 'var(--color-primary-bg)',
                border: '1px solid rgba(212,168,83,.22)',
                borderRadius: 12,
                padding: '10px 12px 10px 16px',
                marginBottom: 14,
                overflow: 'hidden',
              }}
            >
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3,
                background: 'linear-gradient(to bottom, var(--color-primary), var(--color-primary-dk))',
                borderRadius: '12px 0 0 12px',
              }} />
              {/* Glow */}
              <div style={{
                position: 'absolute', top: -20, left: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--color-primary-glow)',
                filter: 'blur(24px)',
                pointerEvents: 'none',
              }} />
              <p style={{ margin: '0 0 6px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', position: 'relative' }}>
                Our Analysis
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                {insights.map((text, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-2)', lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Description */}
          {description && (
            <motion.div variants={sectionVariants} style={{ marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                {descExpanded || description.length <= 120 ? description : description.slice(0, 120) + '…'}
              </p>
              {description.length > 120 && (
                <button
                  onClick={() => setDescExpanded(e => !e)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: 'var(--color-primary)', cursor: 'pointer', marginTop: 2 }}
                >
                  {descExpanded ? 'See less' : 'See more →'}
                </button>
              )}
            </motion.div>
          )}

          {/* Hours row */}
          {weekdayText.length > 0 && (
            <motion.div variants={sectionVariants} style={{ marginBottom: 14 }}>
              <button
                onClick={() => setHoursOpen(h => !h)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '0.75rem', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <span className="ms" style={{ fontSize: 14 }}>schedule</span>
                Hours
                <span className="ms" style={{ fontSize: 13 }}>{hoursOpen ? 'expand_less' : 'expand_more'}</span>
              </button>
              <AnimatePresence>
                {hoursOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {weekdayText.map((line, i) => (
                        <p key={i} style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-3)' }}>{line}</p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* CTA */}
          <motion.div variants={sectionVariants}>
            <button
              onClick={onAdd}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                border: isSelected ? '1px solid rgba(212,168,83,.35)' : 'none',
                cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 700,
                background: isSelected
                  ? 'transparent'
                  : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
                color: isSelected ? 'var(--color-primary)' : '#0f0d0c',
                boxShadow: isSelected ? 'none' : '0 6px 28px rgba(212,168,83,.25)',
                transition: 'all 0.15s ease',
              }}
            >
              {isSelected ? '✓ In itinerary' : '+ Add to itinerary'}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}
