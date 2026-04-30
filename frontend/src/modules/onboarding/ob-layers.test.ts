import { describe, it, expect } from 'vitest'
import { resolveLayerState, INITIAL_LAYER_STATE, getLayerUpdatesForAnswer } from './ob-layers'
import type { LayerState, OBLayerUpdate } from './ob-layers'

describe('resolveLayerState', () => {
  it('returns initial state with no updates', () => {
    const state = resolveLayerState([])
    expect(state).toEqual(INITIAL_LAYER_STATE)
  })

  it('applies a single layer update', () => {
    const updates: OBLayerUpdate[] = [
      { layer: 'sky', value: 'dusk-blue' as any }
    ]
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('dusk-blue')
    expect(state.environment).toBe(INITIAL_LAYER_STATE.environment)
  })

  it('later updates override earlier ones on the same layer', () => {
    const updates: OBLayerUpdate[] = [
      { layer: 'sky', value: 'golden-hour' as any },
      { layer: 'sky', value: 'dusk-blue' as any },
    ]
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('dusk-blue')
  })

  it('group=solo sets sky to golden-dusk', () => {
    const updates = getLayerUpdatesForAnswer('group', 'solo')
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('golden-dusk')
  })

  it('group=family sets sky to warm-noon', () => {
    const updates = getLayerUpdatesForAnswer('group', 'family')
    const state = resolveLayerState(updates)
    expect(state.sky).toBe('warm-noon')
  })

  it('mood=explore sets environment to cobblestone-alley', () => {
    const updates = getLayerUpdatesForAnswer('mood', 'explore')
    const state = resolveLayerState(updates)
    expect(state.environment).toBe('cobblestone-alley')
  })
})
