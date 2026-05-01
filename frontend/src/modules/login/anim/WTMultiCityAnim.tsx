// frontend/src/modules/login/anim/WTMultiCityAnim.tsx
import { motion } from 'framer-motion'

const CITIES = [
  { color: 'var(--color-sage)', bg: 'var(--color-sage-bg)', bdr: 'var(--color-sage-bdr)', delay: 0.2, width: 56 },
  { color: 'var(--color-sky)',  bg: 'var(--color-sky-bg)',  bdr: 'var(--color-sky-bdr)',  delay: 0.65, width: 48 },
]

export function WTMultiCityAnim() {
  return (
    <div className="flex flex-col items-center w-36">
      {CITIES.map((city, i) => (
        <div key={i} className="w-full flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: city.delay, type: 'spring', stiffness: 280, damping: 18 }}
            className="w-full flex items-center gap-2 p-2 rounded-xl border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: '0 2px 12px rgba(0,0,0,.4)' }}
          >
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border" style={{ background: city.bg, borderColor: city.bdr }}>
              <div className="w-2 h-2 rounded-full" style={{ background: city.color, boxShadow: `0 0 5px ${city.color}` }} />
            </div>
            <div>
              <div className="h-1.5 rounded-full bg-white/25 mb-1" style={{ width: city.width }} />
              <div className="h-1 rounded-full bg-white/10" style={{ width: city.width * 0.65 }} />
            </div>
          </motion.div>
          {i < CITIES.length - 1 && (
            <motion.div
              className="w-0.5 rounded-full"
              style={{ background: 'linear-gradient(to bottom, var(--color-sage), var(--color-sky))' }}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 14, opacity: 1 }}
              transition={{ delay: city.delay + 0.35, duration: 0.3 }}
            />
          )}
        </div>
      ))}
      {/* After last connector */}
      <motion.div
        className="w-0.5 rounded-full"
        style={{ background: 'linear-gradient(to bottom, var(--color-sky), rgba(79,143,171,.2))' }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 14, opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.3 }}
      />
      {/* Add city */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.1, type: 'spring', stiffness: 280, damping: 18 }}
        className="w-full flex items-center gap-2 p-2 rounded-xl border"
        style={{ borderColor: 'rgba(79,143,171,.35)', borderStyle: 'dashed', background: 'transparent' }}
      >
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border border-dashed border-sky/40 bg-white/4">
          <span className="text-sky/70 text-sm leading-none font-light">+</span>
        </div>
        <span className="text-[9px] font-semibold text-[var(--color-sky)] opacity-70">Add a city</span>
      </motion.div>
    </div>
  )
}
