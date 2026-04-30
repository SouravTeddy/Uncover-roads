// frontend/src/modules/login/anim/WTPricingAnim.tsx
import { motion } from 'framer-motion'

const CONFETTI = [
  { top: '18%', left: '30%', color: 'var(--color-primary)', delay: 0.5, size: 5 },
  { top: '16%', left: '55%', color: 'var(--color-amber)',   delay: 0.65, size: 4 },
  { top: '22%', left: '42%', color: 'var(--color-sage)',    delay: 0.8,  size: 3 },
  { top: '15%', left: '68%', color: 'var(--color-sky)',     delay: 0.55, size: 5 },
  { top: '24%', left: '20%', color: 'var(--color-primary)', delay: 0.72, size: 4 },
]

export function WTPricingAnim() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Confetti */}
      {CONFETTI.map((c, i) => (
        <motion.div key={i}
          className="absolute rounded-full"
          style={{ top: c.top, left: c.left, width: c.size, height: c.size, background: c.color }}
          initial={{ opacity: 0, y: 0, rotate: 0 }}
          animate={{ opacity: [0, 1, 0], y: 40, rotate: 480 }}
          transition={{ delay: c.delay, duration: 0.8 }}
        />
      ))}
      <div className="flex flex-col gap-2 w-36 z-10">
        {/* FREE card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.4, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 14 }}
          className="relative rounded-2xl p-3 border text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'rgba(224,120,84,.35)', boxShadow: '0 4px 24px rgba(224,120,84,.2)' }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-lg" style={{ background: 'var(--color-primary)', boxShadow: '0 4px 12px rgba(224,120,84,.5)' }}>
            <span className="text-white text-[9px] font-black tracking-wide">FREE</span>
          </div>
          <div className="mt-2 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-1)]">First 2 trips</div>
          <div className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--color-primary)' }}>No credit card needed</div>
        </motion.div>
        {/* Pay per trip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="rounded-2xl p-3 border text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
        >
          <div className="text-[9px] font-bold text-[var(--color-text-2)] mb-1">After that</div>
          <div className="text-[9px] text-[var(--color-text-3)] mb-2">Buy only the trips you need</div>
          <div className="rounded-lg py-1 text-center" style={{ background: 'var(--color-surface2)' }}>
            <span className="text-[9px] font-bold text-[var(--color-text-1)]">Pay per trip</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
