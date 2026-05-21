import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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

const shimmerBase: React.CSSProperties = {
  background: 'var(--color-surface2)',
  borderRadius: 6,
  overflow: 'hidden',
  position: 'relative',
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
  const [imgSrcs, setImgSrcs] = useState<string[]>([])
  const [slideIdx, setSlideIdx] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const dragY = useRef(0)
  const closing = useRef(false)
  const heroTouchStartX = useRef(0)
  const heroTouchStartY = useRef(0)

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

  useEffect(() => {
    closing.current = false
    setImgSrcs([])
    setSlideIdx(0)

    const refs: string[] =
      (details?.photo_refs && details.photo_refs.length > 0)
        ? details.photo_refs
        : (details?.photo_ref ?? place.photo_ref)
        ? [details?.photo_ref ?? place.photo_ref!]
        : []

    if (refs.length > 0) {
      const urls = refs.map(r => getPlacePhotoUrl(r))
      Promise.allSettled(
        urls.map(url => new Promise<string>((res, rej) => {
          const img = new Image(); img.onload = () => res(url); img.onerror = rej; img.src = url
        }))
      ).then(results => {
        const loaded = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map(r => r.value)
        if (loaded.length > 0) {
          setImgSrcs(loaded)
        } else {
          api.placeImage(place.title, city).then(url => { if (url) setImgSrcs([url]) })
        }
      })
    } else {
      api.placeImage(place.title, city).then(url => { if (url) setImgSrcs([url]) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, details?.photo_refs, details?.photo_ref])

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

  const handleHeroTouchStart = useCallback((e: React.TouchEvent) => {
    heroTouchStartX.current = e.touches[0].clientX
    heroTouchStartY.current = e.touches[0].clientY
  }, [])
  const handleHeroTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - heroTouchStartX.current
    const dy = e.changedTouches[0].clientY - heroTouchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      setSlideIdx(i =>
        dx < 0
          ? Math.min(i + 1, imgSrcs.length - 1)
          : Math.max(i - 1, 0)
      )
    }
  }, [imgSrcs.length])

  const catColor = CATEGORY_COLORS[place.category] ?? '#6b7280'
  const catIcon = CATEGORY_ICONS[place.category] ?? 'location_on'
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place'
  const rating = details?.rating ?? place.rating ?? null
  const ratingCount = details?.rating_count ?? null
  const weekdayText = details?.weekday_text ?? []
  const description = details?.editorial_summary ?? details?.top_review ?? null

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

        {/* Hero — 190px fixed height, swipeable image carousel */}
        <div
          style={{ height: 190, position: 'relative', overflow: 'hidden', flexShrink: 0 }}
          onTouchStart={handleHeroTouchStart}
          onTouchEnd={handleHeroTouchEnd}
        >
          {/* Base: category gradient + icon (always behind images) */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: `linear-gradient(135deg, ${catColor}22, ${catColor}44)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="ms fill" style={{ fontSize: 56, color: catColor, opacity: 0.6 }}>{catIcon}</span>
          </div>

          {/* Sweep skeleton while images are loading */}
          {imgSrcs.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                width: '38%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.13), transparent)',
                animation: 'sweep 2s ease-in-out infinite',
              }} />
            </div>
          )}

          {/* Carousel — fades in once images are ready */}
          {imgSrcs.length > 0 && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 3, animation: 'fadeIn 0.5s ease forwards' }}>
              <div
                style={{
                  display: 'flex',
                  width: `${imgSrcs.length * 100}%`,
                  height: '100%',
                  transform: `translateX(-${slideIdx * (100 / imgSrcs.length)}%)`,
                  transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
                }}
              >
                {imgSrcs.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={place.title}
                    style={{ width: `${100 / imgSrcs.length}%`, height: '100%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ))}
              </div>
              {imgSrcs.length > 1 && (
                <div style={{
                  position: 'absolute', bottom: 36, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 5,
                  pointerEvents: 'none',
                }}>
                  {imgSrcs.map((_, i) => (
                    <div key={i} style={{
                      width: i === slideIdx ? 16 : 5,
                      height: 5, borderRadius: 3,
                      background: i === slideIdx ? '#fff' : 'rgba(255,255,255,0.45)',
                      transition: 'all 0.25s ease',
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom gradient */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: 'linear-gradient(to top, var(--color-surface) 0%, transparent 55%)', pointerEvents: 'none' }} />
          {/* Heart button */}
          <button
            onClick={onFavourite}
            style={{
              position: 'absolute', top: 11, right: 11, zIndex: 5,
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
        <div
          style={{
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '12px 16px 32px',
            flex: 1,
          }}
        >
          {/* Category chip — immediate */}
          <div style={{ marginBottom: 6 }}>
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
          </div>

          {/* Place name — immediate */}
          <h2 style={{
            margin: '0 0 4px',
            fontFamily: 'var(--font-heading)',
            fontSize: 24, fontWeight: 700, lineHeight: 1.1,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}>
            {place.title}
          </h2>

          {/* Address — shimmer while loading */}
          {details == null ? (
            <div style={{ ...shimmerBase, height: 11, width: '55%', marginBottom: 10 }} />
          ) : details?.address ? (
            <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--color-text-3)', animation: 'sectionReveal 360ms 0ms cubic-bezier(.22,1,.36,1) both' }}>
              {details.address.split(',')[0]}
            </p>
          ) : null}

          {/* Meta chips — rating only, shimmer while loading */}
          {details == null ? (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <div style={{ ...shimmerBase, height: 22, width: 52, borderRadius: 99 }} />
              <div style={{ ...shimmerBase, height: 22, width: 38, borderRadius: 99 }} />
            </div>
          ) : rating !== null ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, animation: 'sectionReveal 360ms 50ms cubic-bezier(.22,1,.36,1) both' }}>
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
            </div>
          ) : null}

          {/* Analysis strip — shimmer while loading */}
          {details == null ? (
            <div style={{ ...shimmerBase, height: 62, width: '100%', borderRadius: 10, marginBottom: 14 }} />
          ) : insights.length > 0 ? (
            <div
              style={{
                position: 'relative',
                background: 'var(--color-primary-bg)',
                border: '1px solid rgba(212,168,83,.22)',
                borderRadius: 12,
                padding: '10px 12px 10px 16px',
                marginBottom: 14,
                overflow: 'hidden',
                animation: 'sectionReveal 360ms 100ms cubic-bezier(.22,1,.36,1) both',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom, var(--color-primary), var(--color-primary-dk))', borderRadius: '12px 0 0 12px' }} />
              <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'var(--color-primary-glow)', filter: 'blur(24px)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                {insights.map((insight, i) => {
                  const dotColor = insight.state === 'green' ? '#6b9470' : insight.state === 'red' ? '#c26464' : 'var(--color-primary)'
                  const textColor = insight.state === 'green' ? '#7aaa80' : insight.state === 'red' ? '#d48080' : 'var(--color-text-2)'
                  const hasBg = insight.state !== 'gold'
                  const bgColor = insight.state === 'green' ? 'rgba(107,148,112,.12)' : 'rgba(194,100,100,.12)'
                  const borderColor = insight.state === 'green' ? 'rgba(107,148,112,.25)' : 'rgba(194,100,100,.22)'
                  return (
                    <div key={i} style={{
                      background: hasBg ? bgColor : 'transparent',
                      border: hasBg ? `1px solid ${borderColor}` : 'none',
                      borderRadius: hasBg ? 8 : 0,
                      padding: hasBg ? '4px 6px' : 0,
                      marginLeft: hasBg ? -2 : 0,
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                    }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 7 }} />
                      <span style={{ fontSize: '0.75rem', color: textColor, lineHeight: 1.45 }}>
                        {insight.text}
                        {insight.linkLabel && details?.website && (
                          <a
                            href={details.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--color-primary)', textDecoration: 'underline', marginLeft: 4, verticalAlign: 'middle' }}
                          >
                            {insight.linkLabel} ↗
                          </a>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Hours toggle — shimmer while loading */}
          {details == null ? (
            <div style={{ ...shimmerBase, height: 13, width: '40%', marginBottom: 14 }} />
          ) : weekdayText.length > 0 ? (
            <div style={{ marginBottom: 14, animation: 'sectionReveal 360ms 150ms cubic-bezier(.22,1,.36,1) both' }}>
              <button
                onClick={() => setHoursOpen(h => !h)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
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
            </div>
          ) : null}

          {/* Description — shimmer while loading */}
          {details == null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
              <div style={{ ...shimmerBase, height: 10, width: '100%' }} />
              <div style={{ ...shimmerBase, height: 10, width: '80%' }} />
              <div style={{ ...shimmerBase, height: 10, width: '55%' }} />
            </div>
          ) : description ? (
            <div style={{ marginBottom: 12, animation: 'sectionReveal 360ms 200ms cubic-bezier(.22,1,.36,1) both' }}>
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
            </div>
          ) : null}

          {/* CTA — shimmer while loading */}
          {details == null ? (
            <div style={{ ...shimmerBase, height: 42, width: '100%', borderRadius: 12 }} />
          ) : (
            <div style={{ animation: 'sectionReveal 360ms 250ms cubic-bezier(.22,1,.36,1) both' }}>
              <button
                onClick={onAdd}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 14,
                  border: isSelected ? '1px solid rgba(212,168,83,.35)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: 700,
                  background: isSelected ? 'transparent' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
                  color: isSelected ? 'var(--color-primary)' : '#0f0d0c',
                  boxShadow: isSelected ? 'none' : '0 6px 28px rgba(212,168,83,.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isSelected ? '✓ In itinerary' : '+ Add to itinerary'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
