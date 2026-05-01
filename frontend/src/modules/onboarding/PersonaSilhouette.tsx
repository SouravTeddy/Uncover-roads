import { motion } from 'framer-motion'
import type { LayerState } from './ob-layers'

interface Props {
  layerState: LayerState
  /** 0–9: how many questions answered so far */
  answeredCount: number
}

export function PersonaSilhouette({ layerState, answeredCount }: Props) {
  const opacity = 0.15 + (answeredCount / 9) * 0.55  // 0.15 → 0.70 over 9 steps

  return (
    <motion.div
      className="absolute bottom-8 right-6 w-20 h-32 pointer-events-none"
      animate={{ opacity }}
      transition={{ duration: 0.6 }}
    >
      <svg viewBox="0 0 80 128" fill="none" xmlns="http://www.w3.org/2000/svg"
           className="w-full h-full">
        {/* Base silhouette — always visible */}
        <ellipse cx="40" cy="16" rx="10" ry="12" className="fill-white/60" />
        <rect x="28" y="28" width="24" height="40" rx="4" className="fill-white/60" />
        <rect x="18" y="30" width="10" height="30" rx="4" className="fill-white/50" />
        <rect x="52" y="30" width="10" height="30" rx="4" className="fill-white/50" />
        <rect x="28" y="68" width="10" height="36" rx="4" className="fill-white/60" />
        <rect x="42" y="68" width="10" height="36" rx="4" className="fill-white/60" />

        {/* Camera — visible when foreground=camera-strap */}
        {layerState.foreground === 'camera-strap' && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <rect x="46" y="38" width="14" height="10" rx="2" className="fill-white/80" />
            <circle cx="53" cy="43" r="3" className="fill-white/40" />
          </motion.g>
        )}

        {/* Wine glass — visible when foreground=wine-glass */}
        {layerState.foreground === 'wine-glass' && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <path d="M20 56 L16 70 L24 70 L20 80 M18 70 L22 70"
                  className="stroke-white/80" strokeWidth="1.5" />
          </motion.g>
        )}

        {/* Map — visible when foreground=worn-map */}
        {layerState.foreground === 'worn-map' && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <rect x="44" y="54" width="14" height="10" rx="1" className="fill-white/80" />
            <line x1="46" y1="57" x2="56" y2="57" className="stroke-white/40" strokeWidth="0.8" />
            <line x1="46" y1="60" x2="54" y2="60" className="stroke-white/40" strokeWidth="0.8" />
          </motion.g>
        )}

        {/* Bag strap — visible when answeredCount > 4 */}
        {answeredCount > 4 && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ duration: 0.6 }}>
            <path d="M38 28 Q34 22 30 24 Q28 26 30 30"
                  className="stroke-white/70" fill="none" strokeWidth="1.5" />
          </motion.g>
        )}
      </svg>
    </motion.div>
  )
}
