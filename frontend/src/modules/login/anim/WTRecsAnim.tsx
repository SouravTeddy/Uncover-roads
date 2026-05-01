// frontend/src/modules/login/anim/WTRecsAnim.tsx
import { motion } from 'framer-motion'

const CARDS = [
  { label: 'Trending now', color: 'var(--color-amber)',   border: 'rgba(196,152,64,.4)',  blink: true,  delay: 0.2 },
  { label: 'Skip this one', color: '#e57373',             border: 'rgba(192,57,43,.4)',   blink: false, delay: 0.5 },
  { label: 'Hidden gem',   color: 'var(--color-sage)',    border: 'rgba(107,148,112,.4)', blink: false, delay: 0.8 },
]

export function WTRecsAnim() {
  return (
    <div className="flex flex-col gap-2 w-36">
      {CARDS.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: card.delay }}
          className="rounded-xl p-2.5 border border-white/8 border-l-[3px]"
          style={{ background: 'var(--color-surface)', borderLeftColor: card.color, boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <motion.div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: card.color }}
              animate={card.blink ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: card.color }}>{card.label}</span>
          </div>
          <div className="h-1 rounded-full bg-[var(--color-surface2)] w-4/5 mb-1" />
          <div className="h-1 rounded-full bg-[var(--color-surface2)] w-3/5 opacity-60" />
        </motion.div>
      ))}
    </div>
  )
}
