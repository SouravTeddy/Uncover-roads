// Layer keys and their possible values.
// Values are CSS class names applied to each layer div in OBBackground.
export type SkyVariant =
  | 'midnight-indigo'   // default — deep blue night
  | 'golden-dusk'       // solo traveller
  | 'warm-noon'         // family / couple
  | 'cool-dawn'         // explorer / voyager
  | 'electric-night'    // pulse / nightlife

export type EnvironmentVariant =
  | 'minimal'           // default
  | 'cobblestone-alley' // explore / wanderer
  | 'forest-path'       // slow traveller / scenic
  | 'market-street'     // food / culture
  | 'rooftop-cityscape' // pulse / efficiency
  | 'coastal-promenade' // voyager

export type ForegroundVariant =
  | 'empty'             // default
  | 'lantern-table'     // food / epicurean
  | 'camera-strap'      // explorer / wanderer
  | 'wine-glass'        // evening-wind / rest
  | 'worn-map'          // historian / culture
  | 'running-shoes'     // pace-fast / efficiency

export type ColourTempVariant =
  | 'neutral'           // default
  | 'warm-amber'        // food / culture / slow
  | 'cool-steel'        // efficiency / voyager
  | 'electric-saturated' // pulse / nightlife
  | 'muted-earth'       // wanderer / crowd-averse

export type AtmosphereVariant =
  | 'clear'             // default
  | 'soft-mist'         // slow traveller / wanderer
  | 'golden-glow'       // epicurean / food
  | 'rain-sheen'        // temperate / oceanic
  | 'dappled-light'     // explorer / scenic
  | 'neon-haze'         // pulse / nightlife

export interface LayerState {
  sky: SkyVariant
  environment: EnvironmentVariant
  foreground: ForegroundVariant
  colorTemp: ColourTempVariant
  atmosphere: AtmosphereVariant
}

export interface OBLayerUpdate {
  layer: keyof LayerState
  value: LayerState[keyof LayerState]
}

export const INITIAL_LAYER_STATE: LayerState = {
  sky: 'midnight-indigo',
  environment: 'minimal',
  foreground: 'empty',
  colorTemp: 'neutral',
  atmosphere: 'clear',
}

// Answer → layer updates mapping
const ANSWER_LAYER_MAP: Record<string, Record<string, OBLayerUpdate[]>> = {
  group: {
    solo:    [{ layer: 'sky', value: 'golden-dusk' }],
    couple:  [{ layer: 'sky', value: 'warm-noon' }, { layer: 'atmosphere', value: 'golden-glow' }],
    family:  [{ layer: 'sky', value: 'warm-noon' }],
    friends: [{ layer: 'sky', value: 'electric-night' }, { layer: 'colorTemp', value: 'electric-saturated' }],
  },
  mood: {
    explore:   [{ layer: 'environment', value: 'cobblestone-alley' }, { layer: 'atmosphere', value: 'dappled-light' }],
    culture:   [{ layer: 'environment', value: 'market-street' }, { layer: 'foreground', value: 'worn-map' }],
    food:      [{ layer: 'foreground', value: 'lantern-table' }, { layer: 'colorTemp', value: 'warm-amber' }],
    nightlife: [{ layer: 'sky', value: 'electric-night' }, { layer: 'atmosphere', value: 'neon-haze' }],
    relax:     [{ layer: 'environment', value: 'coastal-promenade' }, { layer: 'atmosphere', value: 'soft-mist' }],
  },
  pace: {
    slow:      [{ layer: 'atmosphere', value: 'soft-mist' }, { layer: 'colorTemp', value: 'muted-earth' }],
    balanced:  [],
    fast:      [{ layer: 'foreground', value: 'running-shoes' }, { layer: 'colorTemp', value: 'cool-steel' }],
  },
  movement: {
    walk:      [{ layer: 'environment', value: 'cobblestone-alley' }],
    mixed:     [],
    transit:   [{ layer: 'colorTemp', value: 'cool-steel' }],
  },
  crowd_aversion: {
    always:    [{ layer: 'colorTemp', value: 'muted-earth' }, { layer: 'atmosphere', value: 'soft-mist' }],
    sometimes: [],
    never:     [{ layer: 'colorTemp', value: 'electric-saturated' }],
  },
  spontaneity: {
    always:    [{ layer: 'atmosphere', value: 'dappled-light' }],
    sometimes: [],
    never:     [{ layer: 'colorTemp', value: 'cool-steel' }],
  },
  evening: {
    dinner_wind: [{ layer: 'foreground', value: 'wine-glass' }, { layer: 'sky', value: 'golden-dusk' }],
    explore:     [{ layer: 'atmosphere', value: 'dappled-light' }],
    nightlife:   [{ layer: 'sky', value: 'electric-night' }, { layer: 'atmosphere', value: 'neon-haze' }],
    rest:        [{ layer: 'atmosphere', value: 'soft-mist' }, { layer: 'colorTemp', value: 'muted-earth' }],
  },
  budget: {
    budget:     [{ layer: 'colorTemp', value: 'muted-earth' }],
    mid_range:  [],
    splurge:    [{ layer: 'foreground', value: 'wine-glass' }, { layer: 'atmosphere', value: 'golden-glow' }],
  },
}

/** Get the layer updates triggered by a specific question + answer. */
export function getLayerUpdatesForAnswer(
  question: string,
  answer: string
): OBLayerUpdate[] {
  return ANSWER_LAYER_MAP[question]?.[answer] ?? []
}

/** Merge a list of layer updates onto the initial state. Later updates win. */
export function resolveLayerState(updates: OBLayerUpdate[]): LayerState {
  return updates.reduce<LayerState>(
    (state, update) => ({ ...state, [update.layer]: update.value }),
    { ...INITIAL_LAYER_STATE }
  )
}
