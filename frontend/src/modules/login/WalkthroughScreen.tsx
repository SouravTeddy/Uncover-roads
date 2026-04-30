import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../shared/store'
import { WTPersonaAnim }   from './anim/WTPersonaAnim'
import { WTCityAnim }      from './anim/WTCityAnim'
import { WTRecsAnim }      from './anim/WTRecsAnim'
import { WTMultiCityAnim } from './anim/WTMultiCityAnim'
import { WTPricingAnim }   from './anim/WTPricingAnim'

const CARDS = [
  {
    id: 'persona',
    chip: 'Persona',
    accentVar: 'var(--color-primary)',
    accentBg: 'var(--color-primary-bg)',
    accentBdr: 'rgba(224,120,84,.25)',
    ctaStyle: 'linear-gradient(135deg,#e07854,#c4613d)',
    title: 'Discover your travel DNA',
    desc: '9 questions. One archetype. Every recommendation tuned to who you are.',
    Animation: WTPersonaAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(224,120,84,.12) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'city',
    chip: 'Explore',
    accentVar: 'var(--color-sky)',
    accentBg: 'var(--color-sky-bg)',
    accentBdr: 'rgba(79,143,171,.25)',
    ctaStyle: 'linear-gradient(135deg,#4f8fab,#2e6b89)',
    title: 'Any city, anywhere',
    desc: 'Search any destination and step straight onto its map — Tokyo to Lisbon.',
    Animation: WTCityAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(79,143,171,.12) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'recs',
    chip: 'Smart Picks',
    accentVar: 'var(--color-amber)',
    accentBg: 'var(--color-amber-bg)',
    accentBdr: 'rgba(196,152,64,.25)',
    ctaStyle: 'linear-gradient(135deg,#c49840,#9c7a1e)',
    title: "Knows what's worth it",
    desc: 'Tracks trends, flags what to skip, surfaces hidden gems others miss.',
    Animation: WTRecsAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(196,152,64,.1) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'multicity',
    chip: 'Multi-city',
    accentVar: 'var(--color-sage)',
    accentBg: 'var(--color-sage-bg)',
    accentBdr: 'rgba(107,148,112,.25)',
    ctaStyle: 'linear-gradient(135deg,#6b9470,#3d6642)',
    title: 'One trip, many cities',
    desc: 'Paris, Rome, Barcelona — a full itinerary for every stop, in one place.',
    Animation: WTMultiCityAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(107,148,112,.1) 0%, transparent 70%)',
    cta: 'Next',
  },
  {
    id: 'pricing',
    chip: 'Trip Packages',
    accentVar: 'var(--color-primary)',
    accentBg: 'var(--color-primary-bg)',
    accentBdr: 'rgba(224,120,84,.25)',
    ctaStyle: 'linear-gradient(135deg,#e07854,#c4613d)',
    title: 'First 2 trips on us',
    desc: 'Your first two full itineraries are free. After that, pay only for the trips you take.',
    Animation: WTPricingAnim,
    stageBg: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(224,120,84,.08) 0%, transparent 70%)',
    cta: 'Get started',
    hideSkip: true,
  },
] as const

const textVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const textItem = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

export function WalkthroughScreen() {
  const { dispatch } = useAppStore()
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const touchStartX = useRef<number | null>(null)

  const card = CARDS[index]
  const isLast = index === CARDS.length - 1

  function finish() {
    try { localStorage.setItem('ur_walkthrough_seen', '1') } catch { /* ignore */ }
    dispatch({ type: 'GO_TO', screen: 'ob1' })
  }

  function advance(dir: 1 | -1) {
    const next = index + dir
    if (next < 0 || next >= CARDS.length) return
    setDirection(dir)
    setIndex(next)
  }

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 48) advance(delta > 0 ? 1 : -1)
    touchStartX.current = null
  }

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? '60%' : '-60%', opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.25, 1, 0.5, 1] } },
    exit:   (d: number) => ({ x: d > 0 ? '-60%' : '60%', opacity: 0, transition: { duration: 0.25 } }),
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[var(--color-bg)]"
      style={{ zIndex: 20 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip */}
      <div className="flex-shrink-0 flex justify-end px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 1rem)' }}>
        {!card.hideSkip ? (
          <button onClick={finish} className="text-[var(--color-text-3)] text-sm font-medium px-3 py-1.5 rounded-full hover:text-[var(--color-text-2)] transition-colors">
            Skip
          </button>
        ) : <div className="h-8" />}
      </div>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={card.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex flex-col"
          >
            {/* Animation stage */}
            <div
              className="flex-1 relative overflow-hidden flex items-center justify-center"
              style={{ background: `${card.stageBg}, var(--color-bg)` }}
            >
              <card.Animation />
            </div>

            {/* Text */}
            <motion.div
              className="flex-shrink-0 px-6 pt-5 pb-2"
              variants={textVariants}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={textItem}>
                <span
                  className="inline-block text-[10px] font-bold tracking-widest uppercase rounded-full px-3 py-1 mb-3 border"
                  style={{ background: card.accentBg, borderColor: card.accentBdr, color: card.accentVar }}
                >
                  {card.chip}
                </span>
              </motion.div>
              <motion.h1
                variants={textItem}
                className="font-[family-name:var(--font-heading)] text-[22px] font-bold text-[var(--color-text-1)] leading-snug mb-2"
              >
                {card.title}
              </motion.h1>
              <motion.p variants={textItem} className="text-[var(--color-text-2)] text-sm leading-relaxed">
                {card.desc}
              </motion.p>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom */}
      <div
        className="flex-shrink-0 px-6 pb-10 flex flex-col gap-4 items-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 2rem)' }}
      >
        {/* Step dots */}
        <div className="flex gap-1.5 items-center">
          {CARDS.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i) }}
              animate={{ width: i === index ? 16 : 5, background: i === index ? card.accentVar : 'var(--color-surface2)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="h-1.5 rounded-full"
              style={{ minWidth: 5 }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={isLast ? finish : () => advance(1)}
          className="w-full h-14 rounded-2xl font-heading font-bold text-white text-base flex items-center justify-center gap-2"
          style={{ background: card.ctaStyle, boxShadow: `0 8px 24px ${card.accentVar}40` }}
        >
          {card.cta}
          <span className="ms fill text-white" style={{ fontSize: 20 }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
