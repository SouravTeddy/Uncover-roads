import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Place, PlaceDetails, Persona } from '../../shared/types'
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types'
import { getPlacePhotoUrl, api } from '../../shared/api'
import { computeAnalysisInsights, getTravelDateBadge } from './pincard-utils'
import type { OurPickBadge } from './pincard-utils'
import { useSheetDismiss } from '../../shared/useSheetDismiss'
import { usePersonaInsight } from './pincard-persona'

const CATEGORY_COLORS: Record<string, string> = {
  restaurant: '#ef4444', cafe: '#f97316', park: '#22c55e',
  museum: '#8b5cf6', historic: '#a16207', tourism: '#0ea5e9',
  event: '#ec4899', place: '#6b7280',
}

const CATEGORY_BEST_LABEL: Record<string, string> = {
  restaurant: 'Best thing to order', cafe: 'Best thing to order',
  bar: 'Best thing to order', bakery: 'Best thing to order',
  park: 'Best thing to do', viewpoint: 'Best thing to do',
  beach: 'Best thing to do', market: 'Best thing to do',
  zoo: 'Best thing to do', aquarium: 'Best thing to do',
  amusement_park: 'Best thing to do',
  museum: 'Best thing to experience', historic: 'Best thing to experience',
  gallery: 'Best thing to experience', spiritual: 'Best thing to experience',
  library: 'Best thing to experience', cinema: 'Best thing to experience',
}

const CATEGORY_DURATION: Record<string, string> = {
  restaurant: '1–2 hours', cafe: '45 min – 1.5 hours', bakery: '30–60 min',
  bar: '1–3 hours', nightlife: '2–4 hours',
  park: '2–4 hours', beach: '2–5 hours', viewpoint: '30–60 min',
  museum: '2–3 hours', gallery: '1–2 hours', zoo: '3–4 hours',
  aquarium: '2–3 hours', historic: '1–2 hours', spiritual: '30–60 min',
  market: '1–2 hours', cinema: '2–3 hours', library: '1–2 hours',
  amusement_park: '3–5 hours',
}

const CATEGORY_BEST_TIME: Record<string, string> = {
  restaurant: 'for dinner — arrive 15–20 min early to avoid queues',
  cafe: 'on a weekday morning for the quietest experience',
  bakery: 'early morning for fresh-baked items',
  bar: 'an hour after opening for atmosphere without the full crowd',
  nightlife: 'after 10 PM when the energy picks up',
  park: 'early morning or late afternoon for cooler air and better light',
  beach: 'early morning — smaller crowds and golden-hour light',
  viewpoint: 'at sunrise or sunset for the best views',
  museum: 'at opening time on a weekday — crowds thin out by noon',
  gallery: 'on a weekday afternoon for a peaceful browse',
  zoo: 'in the morning when animals are most active',
  aquarium: 'on a weekday morning for smaller crowds',
  historic: 'in the morning for soft light and fewer tourists',
  spiritual: 'early morning for a tranquil visit',
  market: 'mid-morning when all stalls are set up and stocked',
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
  badgeReason?: string | null
  userTier?: 'free' | 'pack' | 'pro'
  persona?: Persona | null
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
  badgeReason = null,
  userTier = 'free',
  persona = null,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [descOpen, setDescOpen] = useState(true)
  const [bestHereOpen, setBestHereOpen] = useState(false)
  const [planVisitOpen, setPlanVisitOpen] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [imgSrcs, setImgSrcs] = useState<string[]>([])
  const [slideIdx, setSlideIdx] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const dragY = useRef(0)
  const closing = useRef(false)
  const heroTouchStartX = useRef(0)
  const heroTouchStartY = useRef(0)
  const heroWasSwiped = useRef(false)
  const insightCache = useRef(new Map<string, string>())

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
          api.placeImage(place.title, city, place.id).then(url => { if (url) setImgSrcs([url]) })
        }
      })
    } else {
      api.placeImage(place.title, city, place.id).then(url => { if (url) setImgSrcs([url]) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id, details?.photo_refs, details?.photo_ref])

  useEffect(() => {
    setHoursOpen(false)
    setDescOpen(true)
    setBestHereOpen(false)
    setPlanVisitOpen(false)
    setReviewsOpen(false)
    setGalleryOpen(false)
    setGalleryIdx(0)
  }, [place.id])

  const { insight: personaInsight } = usePersonaInsight(place, persona, 'map', insightCache)

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
      heroWasSwiped.current = true
      setSlideIdx(i =>
        dx < 0
          ? Math.min(i + 1, imgSrcs.length - 1)
          : Math.max(i - 1, 0)
      )
    } else {
      heroWasSwiped.current = false
    }
  }, [imgSrcs.length])

  const catColor = CATEGORY_COLORS[place.category] ?? '#6b7280'
  const catIcon = CATEGORY_ICONS[place.category] ?? 'location_on'
  const categoryLabel = CATEGORY_LABELS[place.category] ?? 'Place'
  const rating = details?.rating ?? place.rating ?? null
  const ratingCount = details?.rating_count ?? null
  const weekdayText = details?.weekday_text ?? []
  const priceLevel = details?.price_level ?? null
  const phone = details?.phone ?? null
  const website = details?.website ?? null
  const description = details?.editorial_summary ?? null
  const PRICE_SYMBOLS = ['', '₹', '₹₹', '₹₹₹', '₹₹₹₹']

  const whyForYouText = personaInsight ?? place.reason ?? null

  const resolvedStart = travelStartDate ?? travelDate ?? null
  const resolvedEnd = travelEndDate ?? travelDate ?? null

  const insights = computeAnalysisInsights(place, details ?? null, ourPickBadge, resolvedStart, resolvedEnd)

  const TRENDING_VIEW_KEY = 'ur_trending_views'
  const trendingLocked = useMemo(() => {
    if (ourPickBadge !== 'trending') return false
    if (userTier === 'pro') return false
    const count = parseInt(localStorage.getItem(TRENDING_VIEW_KEY) ?? '0', 10)
    return count >= 3
  }, [ourPickBadge, userTier])

  useEffect(() => {
    if (ourPickBadge !== 'trending' || trendingLocked || userTier === 'pro') return
    const count = parseInt(localStorage.getItem(TRENDING_VIEW_KEY) ?? '0', 10)
    localStorage.setItem(TRENDING_VIEW_KEY, String(count + 1))
  }, [ourPickBadge]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes trendPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); }
          50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
        }
        @keyframes offbeatPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(20,184,166,.5); }
          50%      { box-shadow: 0 0 0 5px rgba(20,184,166,0); }
        }
        @keyframes sweep { 0% { left:-38%; } 100% { left:100%; } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes sectionReveal {
          from { opacity:0; transform:translateY(4px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes galleryIn {
          from { opacity:0; transform:scale(.97) }
          to   { opacity:1; transform:scale(1) }
        }
      `}</style>

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

        {/* Hero — 190px fixed height, swipeable image carousel, tap to open gallery */}
        <div
          style={{ height: 190, position: 'relative', overflow: 'hidden', flexShrink: 0, cursor: imgSrcs.length > 0 ? 'pointer' : 'default' }}
          onTouchStart={handleHeroTouchStart}
          onTouchEnd={handleHeroTouchEnd}
          onClick={() => { if (!heroWasSwiped.current && imgSrcs.length > 0) { setGalleryOpen(true); setGalleryIdx(slideIdx) } }}
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
            onClick={e => { e.stopPropagation(); onFavourite(); }}
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

          {/* Tap hint — N photos */}
          {imgSrcs.length > 1 && (
            <div style={{
              position: 'absolute', bottom: 34, right: 12, zIndex: 6,
              background: 'rgba(0,0,0,.45)', borderRadius: 8, padding: '3px 8px',
              fontSize: 9, color: 'rgba(255,255,255,.7)', backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
            }}>
              {imgSrcs.length} photos ›
            </div>
          )}

          {/* Hero badge — trending or hidden gem */}
          {ourPickBadge === 'trending' && !trendingLocked && (
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 6,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 7,
              background: 'rgba(245,158,11,.28)', border: '1px solid rgba(245,158,11,.45)',
              backdropFilter: 'blur(6px)', fontSize: 10, fontWeight: 700, color: '#f59e0b',
            }}>
              <span className="ms fill" style={{ fontSize: 10 }}>trending_up</span>
              Trending now
            </div>
          )}
          {ourPickBadge === 'hidden_gem' && (
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 6,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 7,
              background: 'rgba(20,184,166,.25)', border: '1px solid rgba(20,184,166,.4)',
              backdropFilter: 'blur(6px)', fontSize: 10, fontWeight: 700, color: '#14b8a6',
            }}>
              <span className="ms fill" style={{ fontSize: 10 }}>diamond</span>
              Hidden gem
            </div>
          )}
        </div>

        {/* Thumbnail strip — only when multiple images loaded */}
        {imgSrcs.length > 1 && (
          <div style={{
            display: 'flex', gap: 5, padding: '8px 14px 0',
            overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
          }}>
            {imgSrcs.map((src, i) => (
              <div
                key={i}
                onClick={() => { setSlideIdx(i); setGalleryOpen(true); setGalleryIdx(i) }}
                style={{
                  width: 54, height: 46, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  border: i === slideIdx ? '2px solid #d4a853' : '2px solid transparent',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
              >
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        {/* Scrollable body */}
        <div
          style={{
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '12px 16px 16px',
            flex: 1,
          }}
        >
          {/* Badge reason banner — top of card, only when pin has a badge */}
          {ourPickBadge && badgeReason && (() => {
            const cfg = {
              trending:     { c: '#f59e0b', bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.25)', icon: 'trending_up',      label: 'Trending now' },
              hidden_gem:   { c: '#14b8a6', bg: 'rgba(20,184,166,.10)',  border: 'rgba(20,184,166,.25)',  icon: 'diamond',           label: 'Hidden gem'  },
              getting_busy: { c: '#f97316', bg: 'rgba(249,115,22,.10)',  border: 'rgba(249,115,22,.25)',  icon: 'local_fire_department', label: 'Getting busy' },
            }[ourPickBadge]
            if (!cfg) return null
            return (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 11, marginBottom: 12,
                background: cfg.bg, border: `1px solid ${cfg.border}`,
              }}>
                <span className="ms fill" style={{ fontSize: 16, color: cfg.c, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: cfg.c, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>{cfg.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(242,237,230,.78)', lineHeight: 1.5 }}>{badgeReason}</div>
                </div>
              </div>
            )
          })()}

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

          {/* Chips row — travel-date timing + rating + price */}
          {details == null ? (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <div style={{ ...shimmerBase, height: 22, width: 120, borderRadius: 99 }} />
              <div style={{ ...shimmerBase, height: 22, width: 52, borderRadius: 99 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, animation: 'sectionReveal 360ms 50ms cubic-bezier(.22,1,.36,1) both' }}>
              {weekdayText.length > 0 && resolvedStart && (() => {
                const badge = getTravelDateBadge(weekdayText, resolvedStart)
                if (!badge) return null
                const isOpen = badge.status === 'open'
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.72rem', fontWeight: 600,
                    padding: '3px 9px', borderRadius: 99,
                    background: isOpen ? 'rgba(107,148,112,.15)' : 'rgba(194,100,100,.15)',
                    border: `1px solid ${isOpen ? 'rgba(107,148,112,.3)' : 'rgba(194,100,100,.3)'}`,
                    color: isOpen ? '#7aaa80' : '#d48080',
                  }}>
                    <span className="ms fill" style={{ fontSize: 11 }}>schedule</span>
                    {badge.text}
                  </span>
                )
              })()}
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
              {priceLevel !== null && priceLevel > 0 && (
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600,
                  padding: '3px 8px', borderRadius: 99,
                  background: 'var(--color-surface2)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-3)',
                }}>
                  {PRICE_SYMBOLS[priceLevel as number] ?? ''}
                </span>
              )}
            </div>
          )}


          {/* Trending description block */}
          {ourPickBadge === 'trending' && !trendingLocked && (
            <div style={{
              position: 'relative', overflow: 'hidden',
              background: '#160f00',
              border: '1px solid rgba(245,158,11,.3)',
              borderRadius: 12, padding: '12px 12px 12px 14px', marginBottom: 14,
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,#f59e0b,#d97706)', borderRadius: '12px 0 0 12px' }} />
              <div style={{ position: 'absolute', top: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,.18),transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 8, position: 'relative' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'trendPulse 1.8s infinite', flexShrink: 0 }} />
                What's happening here
              </div>
              {badgeReason && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(245,158,11,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span className="ms fill" style={{ fontSize: 12, color: '#f59e0b' }}>trending_up</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>{badgeReason}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(245,158,11,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span className="ms fill" style={{ fontSize: 12, color: '#f59e0b' }}>groups</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>People are visiting this <strong style={{ color: '#f5f0ea' }}>significantly more</strong> than a few months ago</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(245,158,11,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span className="ms fill" style={{ fontSize: 12, color: '#f59e0b' }}>videocam</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>Showing up in recent <strong style={{ color: '#f5f0ea' }}>travel content</strong> for this area</span>
              </div>
            </div>
          )}

          {/* Offbeat / hidden gem block */}
          {ourPickBadge === 'hidden_gem' && (
            <div style={{
              position: 'relative', overflow: 'hidden',
              background: '#001412',
              border: '1px solid rgba(20,184,166,.28)',
              borderRadius: 12, padding: '12px 12px 12px 14px', marginBottom: 14,
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,#14b8a6,#0d9488)', borderRadius: '12px 0 0 12px' }} />
              <div style={{ position: 'absolute', top: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(20,184,166,.15),transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#14b8a6', marginBottom: 8, position: 'relative' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6', animation: 'offbeatPulse 1.8s infinite', flexShrink: 0 }} />
                Why this is offbeat
              </div>
              {badgeReason && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(20,184,166,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <span className="ms fill" style={{ fontSize: 12, color: '#14b8a6' }}>explore</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>{badgeReason}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, position: 'relative' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(20,184,166,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span className="ms fill" style={{ fontSize: 12, color: '#14b8a6' }}>people</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}><strong style={{ color: '#f5f0ea' }}>Most visitors skip this</strong> — a fraction of the foot traffic of similar spots</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(20,184,166,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span className="ms fill" style={{ fontSize: 12, color: '#14b8a6' }}>photo_camera</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>Rarely photographed — most angles here are still <strong style={{ color: '#f5f0ea' }}>undiscovered</strong></span>
              </div>
            </div>
          )}

          {/* Trending locked — free gate */}
          {ourPickBadge === 'trending' && trendingLocked && (
            <div style={{
              background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 14, marginBottom: 14,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(245,158,11,.13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="ms fill" style={{ fontSize: 18, color: '#f59e0b' }}>lock</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)' }}>Trending insights are Pro</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)', lineHeight: 1.55 }}>Go Pro to see what's driving the buzz on every trending place.</div>
              <button style={{
                width: '100%', padding: 9,
                background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dk))',
                border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
                color: '#1a1200', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Go Pro · $9.99/mo
              </button>
            </div>
          )}

          {/* ── Accordion sections ── */}
          {details == null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
              <div style={{ ...shimmerBase, height: 40, width: '100%', borderRadius: 8 }} />
              <div style={{ ...shimmerBase, height: 40, width: '100%', borderRadius: 8 }} />
              <div style={{ ...shimmerBase, height: 40, width: '100%', borderRadius: 8 }} />
            </div>
          ) : (
            <div style={{ animation: 'sectionReveal 360ms 180ms cubic-bezier(.22,1,.36,1) both' }}>

              {/* ① Description */}
              {(description || website || phone) && (
                <div style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <button
                    onClick={() => setDescOpen(o => !o)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
                  >
                    <span className="ms" style={{ fontSize: 14, color: 'var(--color-text-3)', flexShrink: 0 }}>description</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!descOpen && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {description
                            ? description.length > 60 ? description.slice(0, 60) + '…' : description
                            : website ? 'Official website available' : phone ?? 'Tap to find out more'}
                        </div>
                      )}
                    </div>
                    <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, transform: descOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
                  </button>
                  <AnimatePresence>
                    {descOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                        <div style={{ paddingBottom: 12 }}>
                          {description && (
                            <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--color-text-2)', lineHeight: 1.55 }}>{description}</p>
                          )}
                          {(website || phone) && (
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                              {website && (
                                <a href={website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}>Official website ↗</a>
                              )}
                              {phone && (
                                <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}>{phone}</a>
                              )}
                            </div>
                          )}
                          {!description && !website && !phone && (
                            <a href={`https://www.google.com/search?q=${encodeURIComponent(place.title + ' ' + city)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '0.78rem', color: 'var(--color-primary)', textDecoration: 'underline' }}>Find out more ↗</a>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ② What's best here — review_summary when available, persona insight as fallback */}
              {(details.review_summary || whyForYouText) && (
                <div style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <button
                    onClick={() => setBestHereOpen(o => !o)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
                  >
                    <span className="ms fill" style={{ fontSize: 14, color: 'var(--color-primary)', flexShrink: 0 }}>auto_awesome</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--color-primary)', marginBottom: 2 }}>
                        {CATEGORY_BEST_LABEL[place.category] ?? 'What people love'}
                      </div>
                      {!bestHereOpen && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(() => {
                            const text = details.review_summary ?? whyForYouText ?? ''
                            return text.length > 55 ? text.slice(0, 55) + '…' : text
                          })()}
                        </div>
                      )}
                    </div>
                    <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, transform: bestHereOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
                  </button>
                  <AnimatePresence>
                    {bestHereOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                        <div style={{ paddingBottom: 12 }}>
                          <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--color-primary)', lineHeight: 1.55 }}>
                            {details.review_summary ?? whyForYouText}
                          </p>
                          {details.review_summary && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: 'var(--color-text-4)' }}>
                              <span className="ms fill" style={{ fontSize: 10 }}>auto_awesome</span>
                              AI summary from thousands of reviews
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ③ Plan your visit */}
              {(() => {
                const duration = CATEGORY_DURATION[place.category] ?? '1–2 hours'
                const bestTime = CATEGORY_BEST_TIME[place.category]
                return (
                  <div style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <button
                      onClick={() => setPlanVisitOpen(o => !o)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
                    >
                      <span className="ms" style={{ fontSize: 14, color: 'var(--color-text-3)', flexShrink: 0 }}>timer</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {!planVisitOpen && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Allow {duration}{website ? ' · check bookings' : ''}
                          </div>
                        )}
                      </div>
                      <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, transform: planVisitOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
                    </button>
                    <AnimatePresence>
                      {planVisitOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                          <div style={{ paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 8 }} />
                              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', lineHeight: 1.45 }}>
                                Allow <strong style={{ color: 'var(--color-text-1)' }}>{duration}</strong> for a comfortable visit
                              </span>
                            </div>
                            {bestTime && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 8 }} />
                                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', lineHeight: 1.45 }}>Best visited {bestTime}</span>
                              </div>
                            )}
                            {website && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6b9470', flexShrink: 0, marginTop: 8 }} />
                                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', lineHeight: 1.45 }}>
                                  Check for reservations or tickets —{' '}
                                  <a href={website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>official website ↗</a>
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })()}

            </div>
          )}

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

          {/* ④ Hours accordion */}
          {weekdayText.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--color-border)', animation: 'sectionReveal 360ms 150ms cubic-bezier(.22,1,.36,1) both' }}>
              <button
                onClick={() => setHoursOpen(h => !h)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
              >
                <span className="ms" style={{ fontSize: 14, color: 'var(--color-text-3)', flexShrink: 0 }}>schedule</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!hoursOpen && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(() => {
                        const visitLine = resolvedStart ? weekdayText.find(l => {
                          const d = new Date(resolvedStart + 'T00:00:00')
                          const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]
                          return l.startsWith(day)
                        }) : null
                        return visitLine
                          ? visitLine.replace(/^[^:]+:\s*/, '')
                          : weekdayText[0].replace(/^[^:]+:\s*/, '')
                      })()}
                    </div>
                  )}
                </div>
                <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, transform: hoursOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
              </button>
              <AnimatePresence>
                {hoursOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div style={{ paddingBottom: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {weekdayText.map((line, i) => {
                        const isVisitDay = resolvedStart ? (() => {
                          const d = new Date(resolvedStart + 'T00:00:00')
                          const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]
                          return line.startsWith(day)
                        })() : false
                        return (
                          <p key={i} style={{ margin: 0, fontSize: '0.75rem', color: isVisitDay ? 'var(--color-text-2)' : 'var(--color-text-3)', fontWeight: isVisitDay ? 600 : 400 }}>
                            {line}{isVisitDay ? ' ← your visit' : ''}
                          </p>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ⑤ Reviews accordion */}
          {details?.reviews && details.reviews.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--color-border)', animation: 'sectionReveal 360ms 160ms cubic-bezier(.22,1,.36,1) both' }}>
              <button
                onClick={() => setReviewsOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
              >
                <span className="ms" style={{ fontSize: 14, color: 'var(--color-text-3)', flexShrink: 0 }}>chat_bubble</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!reviewsOpen && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      "{details.reviews[0].text.slice(0, 55)}{details.reviews[0].text.length > 55 ? '…' : ''}"
                    </div>
                  )}
                </div>
                <span className="ms" style={{ fontSize: 13, color: 'var(--color-text-3)', flexShrink: 0, transform: reviewsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>expand_more</span>
              </button>
              <AnimatePresence>
                {reviewsOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div style={{ paddingBottom: 12 }}>
                      {details.reviews.map((review, i) => (
                        <div key={i} style={{ borderRadius: 10, padding: '10px 12px', background: 'var(--color-surface2)', marginBottom: 6 }}>
                          <p style={{ fontSize: 12, lineHeight: 1.55, fontStyle: 'italic', marginBottom: 6, color: 'rgba(242,237,230,.72)' }}>"{review.text}"</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(212,168,83,.18)', color: '#d4a853', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                              {review.author_name?.[0]?.toUpperCase() ?? 'G'}
                            </div>
                            <span style={{ fontSize: 10, color: 'rgba(242,237,230,.38)' }}>{review.author_name || 'Google reviewer'}</span>
                            <span style={{ fontSize: 9, color: '#c49840', marginLeft: 'auto' }}>{'★'.repeat(Math.round(review.rating))}</span>
                          </div>
                        </div>
                      ))}
                      {details.rating_count != null && (
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(place.title + ' ' + city)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: 'var(--color-primary)', display: 'block', textAlign: 'right', marginTop: 2, textDecoration: 'none' }}>
                          See all {(details.rating_count as number).toLocaleString()} reviews on Google →
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

        </div>

        {/* Pinned CTA footer */}
        <div style={{ flexShrink: 0, padding: '10px 16px', paddingBottom: 'env(safe-area-inset-bottom, 10px)', borderTop: '1px solid var(--color-border)' }}>
          {details == null ? (
            <div style={{ ...shimmerBase, height: 42, width: '100%', borderRadius: 12 }} />
          ) : (
            <button
              onClick={onAdd}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                border: isSelected
                  ? '1px solid rgba(212,168,83,.35)'
                  : trendingLocked ? '1px solid var(--color-border)' : 'none',
                cursor: trendingLocked ? 'default' : 'pointer',
                fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
                background: isSelected
                  ? 'transparent'
                  : trendingLocked
                  ? 'var(--color-surface2)'
                  : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dk))',
                color: isSelected
                  ? 'var(--color-primary)'
                  : trendingLocked
                  ? 'var(--color-text-3)'
                  : '#0f0d0c',
                opacity: trendingLocked ? 0.35 : 1,
                boxShadow: isSelected || trendingLocked ? 'none' : '0 6px 28px rgba(212,168,83,.25)',
                transition: 'all 0.15s ease',
                pointerEvents: trendingLocked ? 'none' : 'auto',
              }}
            >
              {isSelected ? '✓ In itinerary' : '+ Add to itinerary'}
            </button>
          )}
        </div>

        {/* Gallery overlay */}
        {galleryOpen && imgSrcs.length > 0 && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: '#000',
            display: 'flex', flexDirection: 'column',
            animation: 'galleryIn 0.22s ease',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <button
                onClick={() => setGalleryOpen(false)}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(255,255,255,.12)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, cursor: 'pointer',
                }}
              >✕</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{place.title}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>
                  Photo {galleryIdx + 1} of {imgSrcs.length}
                </div>
              </div>
              <div style={{ width: 30 }} />
            </div>

            {/* Main image */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={imgSrcs[galleryIdx]}
                alt={place.title}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
              {galleryIdx > 0 && (
                <button
                  onClick={() => setGalleryIdx(i => i - 1)}
                  style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(6px)',
                    border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >‹</button>
              )}
              {galleryIdx < imgSrcs.length - 1 && (
                <button
                  onClick={() => setGalleryIdx(i => i + 1)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(6px)',
                    border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >›</button>
              )}
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 0' }}>
              {imgSrcs.map((_, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 2,
                  width: i === galleryIdx ? 16 : 5,
                  background: i === galleryIdx ? '#fff' : 'rgba(255,255,255,.25)',
                  transition: 'all 0.2s',
                }} />
              ))}
            </div>

            {/* Thumbnail strip */}
            <div style={{ display: 'flex', gap: 6, padding: '0 14px 18px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {imgSrcs.map((src, i) => (
                <div
                  key={i}
                  onClick={() => setGalleryIdx(i)}
                  style={{
                    width: 56, height: 50, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                    opacity: i === galleryIdx ? 1 : 0.5,
                    border: `2px solid ${i === galleryIdx ? '#d4a853' : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
