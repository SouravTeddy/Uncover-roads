import { motion, AnimatePresence } from 'framer-motion'
import type { LayerState } from './ob-layers'

interface Props {
  layerState: LayerState
}

// Tailwind classes for each layer variant — extend as illustration assets are added
const SKY_CLASSES: Record<LayerState['sky'], string> = {
  'midnight-indigo':    'bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-800',
  'golden-dusk':        'bg-gradient-to-b from-orange-900 via-amber-800 to-amber-600',
  'warm-noon':          'bg-gradient-to-b from-sky-700 via-sky-500 to-amber-300',
  'cool-dawn':          'bg-gradient-to-b from-slate-800 via-slate-600 to-sky-400',
  'electric-night':     'bg-gradient-to-b from-violet-950 via-violet-900 to-indigo-800',
}

const ENVIRONMENT_CLASSES: Record<LayerState['environment'], string> = {
  'minimal':             '',
  'cobblestone-alley':   'bg-[url(/illustrations/env-alley.svg)] bg-bottom bg-no-repeat bg-contain',
  'forest-path':         'bg-[url(/illustrations/env-forest.svg)] bg-bottom bg-no-repeat bg-contain',
  'market-street':       'bg-[url(/illustrations/env-market.svg)] bg-bottom bg-no-repeat bg-contain',
  'rooftop-cityscape':   'bg-[url(/illustrations/env-rooftop.svg)] bg-bottom bg-no-repeat bg-contain',
  'coastal-promenade':   'bg-[url(/illustrations/env-coastal.svg)] bg-bottom bg-no-repeat bg-contain',
}

const FOREGROUND_CLASSES: Record<LayerState['foreground'], string> = {
  'empty':         '',
  'lantern-table': 'bg-[url(/illustrations/fg-lantern.svg)] bg-bottom bg-no-repeat bg-auto',
  'camera-strap':  'bg-[url(/illustrations/fg-camera.svg)] bg-bottom-right bg-no-repeat bg-auto',
  'wine-glass':    'bg-[url(/illustrations/fg-wine.svg)] bg-bottom-right bg-no-repeat bg-auto',
  'worn-map':      'bg-[url(/illustrations/fg-map.svg)] bg-bottom-left bg-no-repeat bg-auto',
  'running-shoes': 'bg-[url(/illustrations/fg-shoes.svg)] bg-bottom bg-no-repeat bg-auto',
}

const COLOUR_TEMP_CLASSES: Record<LayerState['colorTemp'], string> = {
  'neutral':            'opacity-0',
  'warm-amber':         'bg-amber-500/20',
  'cool-steel':         'bg-slate-400/20',
  'electric-saturated': 'bg-violet-500/25',
  'muted-earth':        'bg-stone-600/20',
}

const ATMOSPHERE_CLASSES: Record<LayerState['atmosphere'], string> = {
  'clear':        'opacity-0',
  'soft-mist':    'bg-white/10 backdrop-blur-[1px]',
  'golden-glow':  'bg-amber-300/15',
  'rain-sheen':   'bg-slate-300/15',
  'dappled-light':'bg-amber-200/10',
  'neon-haze':    'bg-fuchsia-500/15',
}

const TRANSITION = { duration: 0.6, ease: 'easeInOut' as const }

export function OBBackground({ layerState }: Props) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Layer 1 — Sky */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.sky}
          className={`absolute inset-0 ${SKY_CLASSES[layerState.sky]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>

      {/* Layer 2 — Environment */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.environment}
          className={`absolute inset-0 ${ENVIRONMENT_CLASSES[layerState.environment]}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>

      {/* Layer 3 — Foreground element */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.foreground}
          className={`absolute inset-0 ${FOREGROUND_CLASSES[layerState.foreground]}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ ...TRANSITION, duration: 0.8 }}
        />
      </AnimatePresence>

      {/* Layer 4 — Colour temperature overlay */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.colorTemp}
          className={`absolute inset-0 ${COLOUR_TEMP_CLASSES[layerState.colorTemp]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>

      {/* Layer 5 — Atmosphere overlay */}
      <AnimatePresence mode="sync">
        <motion.div
          key={layerState.atmosphere}
          className={`absolute inset-0 ${ATMOSPHERE_CLASSES[layerState.atmosphere]}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        />
      </AnimatePresence>
    </div>
  )
}
