import { useState, useRef } from 'react'
import { useAppStore } from '../../shared/store'

const CARDS = [
  {
    id: 'beta',
    img: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=900&q=85',
    label: 'Beta Access',
    accent: '#d4a853',
    title: "You're shaping the future of travel",
    desc: "Welcome to the Uncover Roads beta. Your instincts are already our best feature.",
  },
  {
    id: 'dna',
    img: 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=900&q=85',
    label: 'Your DNA',
    accent: '#5a8a60',
    title: 'Travel like no one else does',
    desc: '9 questions. One archetype. Every recommendation tuned to who you are.',
  },
  {
    id: 'city',
    img: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=900&q=85',
    label: 'Any Destination',
    accent: '#4a7fa0',
    title: 'Any city, anywhere on earth',
    desc: 'From Tokyo backstreets to Lisbon hilltops — your day, not a tourist list.',
  },
  {
    id: 'pin',
    img: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&q=85',
    label: 'Pin & Plan',
    accent: '#8878b8',
    title: 'Pin what calls to you',
    desc: 'Browse the map, discover hidden gems, build your own shortlist.',
  },
  {
    id: 'ai',
    img: 'https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?w=900&q=85',
    label: 'AI Itinerary',
    accent: '#b88c3a',
    title: 'AI builds your perfect day',
    desc: 'Your persona + your picks = a timed, ordered day crafted just for you.',
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

      {/* Editorial watermark */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '30%',
        zIndex: 2, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: 'var(--font-heading), serif',
          fontWeight: 700, fontSize: 110,
          color: 'rgba(255,255,255,.06)',
          letterSpacing: '-.03em', lineHeight: 1,
          textAlign: 'center', whiteSpace: 'nowrap',
          animation: 'heroKenBurns 12s ease-out forwards',
        }}>explore</div>
      </div>

      {/* Skip */}
      <div style={{
        position: 'absolute', zIndex: 10,
        top: 'calc(env(safe-area-inset-top, 0px) + 52px)',
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
              fontSize: 12, fontWeight: 600,
              color: 'rgba(255,255,255,.7)', cursor: 'pointer',
            }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Text block — anchored bottom */}
      <div
        key={`text-${animKey}`}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 28px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 44px)',
          zIndex: 5,
          animation: exiting ? 'none' : 'fadeUp .5s ease both',
          animationDelay: '.1s',
          opacity: exiting ? 0 : 1,
          transition: exiting ? 'opacity .2s ease' : 'none',
        }}
      >
        {/* Accent label pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999, marginBottom: 14,
          border: `1px solid ${card.accent}60`,
          background: `${card.accent}18`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: card.accent,
            animation: 'glowPulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700,
            letterSpacing: '.14em', textTransform: 'uppercase',
            color: card.accent,
          }}>
            {card.label}
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-heading), serif',
          fontWeight: 700, fontSize: 44,
          color: '#fff', lineHeight: 1.0,
          letterSpacing: '-.02em',
          margin: '0 0 12px',
        }}>
          {card.title}
        </h1>

        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,.55)',
          lineHeight: 1.65, margin: '0 0 28px',
          maxWidth: 300, fontWeight: 400,
        }}>
          {card.desc}
        </p>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22, alignItems: 'center' }}>
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

        {/* CTA */}
        <button
          onClick={next}
          style={{
            width: '100%', height: 56,
            borderRadius: 16, border: 'none',
            cursor: 'pointer',
            background: isLast
              ? `linear-gradient(135deg, ${card.accent}, #8a6820)`
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
