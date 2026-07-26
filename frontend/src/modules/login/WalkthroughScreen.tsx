import { useState, useRef } from 'react'
import { useAppStore } from '../../shared/store'

const CARDS = [
  {
    id: 'explore',
    img: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900&q=85',
    label: 'Explore',
    accent: '#4a7fa0',
    accentDark: '#2d5a78',
    title: 'Search a city, find your places',
    desc: 'A live map opens — curated pins already plotted. Tap any one, read the details, add it to your shortlist.',
  },
  {
    id: 'build',
    img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=85',
    label: 'Build',
    accent: '#5a8a60',
    accentDark: '#2e5233',
    title: 'Build your day in one tap',
    desc: 'The engine sequences your stops — opening hours, walk distance, crowd timing. Add your flight times and the plan reshapes around them.',
  },
  {
    id: 'multi',
    img: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=900&q=85',
    label: 'Multi-city',
    accent: '#8878b8',
    accentDark: '#4a3d78',
    title: 'Plan the whole trip, not just one day',
    desc: 'Add more cities — each gets its own day plan, all in one trip. Tokyo Monday, Kyoto Tuesday, Osaka Wednesday.',
  },
  {
    id: 'saved',
    img: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=900&q=85',
    label: 'Saved trips',
    accent: '#c07a4a',
    accentDark: '#7a4820',
    title: 'All your trips, always there',
    desc: 'Every trip saves to your account. Open any of them, pick up where you left off. If a place closes or changes, your itinerary updates automatically.',
  },
]

export function WalkthroughScreen() {
  const { dispatch } = useAppStore()
  const [index, setIndex] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [exiting, setExiting] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const card = CARDS[index]
  const isLast = index === CARDS.length - 1

  function finish() {
    try { localStorage.setItem('ur_walkthrough_seen', '1') } catch { /* ignore */ }
    dispatch({ type: 'GO_TO', screen: 'ob1' })
  }

  function goTo(next: number) {
    if (next < 0 || next >= CARDS.length) return
    setExiting(true)
    setTimeout(() => {
      setIndex(next)
      setAnimKey(k => k + 1)
      setExiting(false)
    }, 200)
  }

  function next() { isLast ? finish() : goTo(index + 1) }
  function prev() { if (index > 0) goTo(index - 1) }

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -40) next()
    else if (dx > 40) prev()
    touchStartX.current = null
  }

  return (
    <div
      data-theme="dark"
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#080808', userSelect: 'none', zIndex: 20 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Full-bleed hero photo */}
      <div
        key={animKey}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          opacity: exiting ? 0 : 1,
          transition: 'opacity .22s ease',
        }}
      >
        <img
          src={card.img}
          alt=""
          aria-hidden
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            animation: 'heroKenBurns 12s ease-out forwards',
          }}
        />
      </div>

      {/* Gradient overlay — dark at top and heavy at bottom */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(to bottom, rgba(0,0,0,.35) 0%, transparent 30%, rgba(0,0,0,.5) 55%, rgba(0,0,0,.92) 100%)',
      }} />

      {/* Skip */}
      <div style={{
        position: 'absolute', zIndex: 10,
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        right: 20,
      }}>
        {!isLast && (
          <button
            onClick={finish}
            style={{
              background: 'rgba(255,255,255,.12)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 999, padding: '6px 14px',
              fontSize: 12, fontWeight: 700,
              color: 'rgba(255,255,255,.7)', cursor: 'pointer',
            }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Text + dots — anchored above the CTA button */}
      <div
        key={`text-${animKey}`}
        style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px + 56px + 16px)',
          left: 0, right: 0,
          padding: '0 28px',
          zIndex: 5,
          animation: exiting ? 'none' : 'fadeUp .5s ease both',
          animationDelay: '.1s',
          opacity: exiting ? 0 : 1,
          transition: exiting ? 'opacity .2s ease' : 'none',
        }}
      >
        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-heading), serif',
          fontWeight: 700, fontSize: 40,
          color: '#fff', lineHeight: 1.05,
          letterSpacing: '-.02em',
          margin: '0 0 10px',
        }}>
          {card.title}
        </h1>

        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,.55)',
          lineHeight: 1.65, margin: '0 0 22px',
          maxWidth: 300, fontWeight: 400,
        }}>
          {card.desc}
        </p>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {CARDS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                height: 3, borderRadius: 2, border: 'none',
                cursor: 'pointer', padding: 0,
                width: i === index ? 28 : 8,
                background: i === index ? card.accent : 'rgba(255,255,255,.25)',
                transition: 'all .35s cubic-bezier(.25,0,0,1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* CTA — always pinned at fixed bottom position */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
        left: 28, right: 28,
        zIndex: 5,
        opacity: exiting ? 0 : 1,
        transition: exiting ? 'opacity .2s ease' : 'none',
      }}>
        <button
          onClick={next}
          style={{
            width: '100%', height: 56,
            borderRadius: 16, border: 'none',
            cursor: 'pointer',
            background: isLast
              ? `linear-gradient(135deg, ${card.accent}, ${'accentDark' in card ? card.accentDark : '#5a3a10'})`
              : 'rgba(255,255,255,.95)',
            color: isLast ? '#fff' : '#0c0c0e',
            fontSize: 15, fontWeight: 700,
            fontFamily: 'var(--font-heading), serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: isLast ? `0 8px 28px ${card.accent}50` : '0 4px 16px rgba(0,0,0,.3)',
          }}
        >
          {isLast ? 'Get started' : 'Next'}
          <span className="ms fill" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
