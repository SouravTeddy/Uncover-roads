// frontend/src/modules/login/anim/WTCityAnim.tsx
import { motion } from 'framer-motion'

const PINS = [
  { top: '28%', left: '32%', color: 'var(--color-primary)', shadow: 'rgba(224,120,84,.6)', delay: 0.2 },
  { top: '45%', left: '58%', color: 'var(--color-sky)',     shadow: 'rgba(79,143,171,.6)',  delay: 0.5 },
  { top: '60%', left: '26%', color: 'var(--color-sage)',    shadow: 'rgba(107,148,112,.6)', delay: 0.8 },
  { top: '36%', left: '64%', color: 'var(--color-amber)',   shadow: 'rgba(196,152,64,.6)',  delay: 1.1 },
]

export function WTCityAnim() {
  return (
    <div className="absolute inset-0">
      {/* Map grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)',
        backgroundSize: '18px 18px',
      }} />
      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="absolute top-4 left-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-m)', boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}
      >
        <span className="ms text-[var(--color-text-3)] text-sm">search</span>
        <div className="flex-1 h-1 rounded-full bg-[var(--color-surface2)]" />
        <motion.div
          className="w-0.5 h-3 rounded-sm bg-[var(--color-primary)]"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </motion.div>
      {/* Pins */}
      {PINS.map((pin, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top: pin.top, left: pin.left }}
          initial={{ opacity: 0, y: -20, scale: 0.6 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: pin.delay, type: 'spring', stiffness: 300, damping: 14 }}
        >
          <div className="relative">
            <div className="w-3 h-3 rounded-full border-2 border-white/80" style={{ background: pin.color, boxShadow: `0 0 8px ${pin.shadow}` }} />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: pin.color, opacity: 0.35 }}
              animate={{ scale: [0.5, 2.6], opacity: [0.7, 0] }}
              transition={{ delay: pin.delay + 0.3, duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  )
}
