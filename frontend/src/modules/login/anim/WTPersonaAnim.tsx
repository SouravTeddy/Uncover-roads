// frontend/src/modules/login/anim/WTPersonaAnim.tsx
import { motion } from 'framer-motion'

export function WTPersonaAnim() {
  return (
    <div className="relative flex flex-col items-center gap-3">
      {/* Ambient glow */}
      <motion.div
        className="absolute w-28 h-28 rounded-full"
        style={{ background: 'rgba(224,120,84,.18)', filter: 'blur(32px)', top: '-10%' }}
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.12, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Silhouette */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <div className="relative w-12">
          <div className="w-6 h-6 rounded-full mx-auto" style={{ background: 'linear-gradient(160deg,#e07854,#c4613d)', boxShadow: '0 4px 16px rgba(224,120,84,.4)' }} />
          <div className="w-11 h-12 rounded-[14px_14px_10px_10px] mt-0.5 mx-auto" style={{ background: 'linear-gradient(160deg,#c4613d,#8b3d22)', boxShadow: '0 6px 20px rgba(196,97,61,.35)' }}>
            <motion.div
              className="absolute top-2.5 -right-2.5 w-3 h-2.5 rounded bg-[var(--color-surface2)] border border-white/10"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            />
          </div>
        </div>
      </motion.div>
      {/* Archetype badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.8, type: 'spring', stiffness: 300, damping: 18 }}
        className="px-4 py-1.5 rounded-full border"
        style={{ background: 'var(--color-surface)', borderColor: 'rgba(224,120,84,.3)', boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}
      >
        <span className="font-[family-name:var(--font-heading)] text-sm font-bold" style={{ color: 'var(--color-primary)' }}>The Wanderer</span>
      </motion.div>
      {/* Trait lines */}
      <div className="flex flex-col gap-1 w-28">
        {[1, 0.8, 0.6].map((w, i) => (
          <motion.div key={i}
            className="h-1 rounded-full"
            style={{ background: `rgba(224,120,84,${0.25 - i * 0.06})`, width: `${w * 100}%` }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1 + i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}
