import { describe, expect, it } from 'vitest'
import { petAnimationRenderKey } from './petAnimation'

describe('pet animation render keys', () => {
  it('keeps loop animations stable', () => {
    expect(
      petAnimationRenderKey({
        animation: 'running',
        mode: 'loop',
        actionActive: false,
        actionReplayKey: 1,
        petAssetId: 'sprout-a',
        status: 'running',
        alertCount: 0,
      }),
    ).toBe('running')
  })

  it('restarts one-shot action animations when replay key changes', () => {
    const first = petAnimationRenderKey({
      animation: 'waving',
      mode: 'once',
      actionActive: true,
      actionReplayKey: 1,
      petAssetId: 'sprout-a',
      status: 'idle',
      alertCount: 0,
    })
    const second = petAnimationRenderKey({
      animation: 'waving',
      mode: 'once',
      actionActive: true,
      actionReplayKey: 2,
      petAssetId: 'sprout-a',
      status: 'idle',
      alertCount: 0,
    })

    expect(second).not.toBe(first)
  })

  it('restarts explicit one-shot attention animations when alert count changes', () => {
    const first = petAnimationRenderKey({
      animation: 'jumping',
      mode: 'once',
      actionActive: false,
      actionReplayKey: 0,
      petAssetId: 'sprout-a',
      status: 'waiting_permission',
      alertCount: 1,
    })
    const second = petAnimationRenderKey({
      animation: 'jumping',
      mode: 'once',
      actionActive: false,
      actionReplayKey: 0,
      petAssetId: 'sprout-a',
      status: 'waiting_permission',
      alertCount: 2,
    })

    expect(second).not.toBe(first)
  })

  it('restarts one-shot animations when the rendered pet asset changes', () => {
    const first = petAnimationRenderKey({
      animation: 'failed',
      mode: 'once',
      actionActive: false,
      actionReplayKey: 0,
      petAssetId: 'sprout-a',
      status: 'error',
      alertCount: 0,
    })
    const second = petAnimationRenderKey({
      animation: 'failed',
      mode: 'once',
      actionActive: false,
      actionReplayKey: 0,
      petAssetId: 'sprout-b',
      status: 'error',
      alertCount: 0,
    })

    expect(second).not.toBe(first)
  })
})
