import { describe, expect, it } from 'vitest'
import { petAnimationRenderKey } from './petAnimation'

describe('pet animation render keys', () => {
  it('keeps loop animations stable', () => {
    expect(
      petAnimationRenderKey({
        animation: 'run',
        mode: 'loop',
        actionActive: false,
        actionReplayKey: 1,
        petAssetId: 'sprout-a',
        status: 'running',
        alertCount: 0,
      }),
    ).toBe('run')
  })

  it('restarts one-shot action animations when replay key changes', () => {
    const first = petAnimationRenderKey({
      animation: 'wave',
      mode: 'once',
      actionActive: true,
      actionReplayKey: 1,
      petAssetId: 'sprout-a',
      status: 'idle',
      alertCount: 0,
    })
    const second = petAnimationRenderKey({
      animation: 'wave',
      mode: 'once',
      actionActive: true,
      actionReplayKey: 2,
      petAssetId: 'sprout-a',
      status: 'idle',
      alertCount: 0,
    })

    expect(second).not.toBe(first)
  })

  it('restarts one-shot status animations when alert count changes', () => {
    const first = petAnimationRenderKey({
      animation: 'jump',
      mode: 'once',
      actionActive: false,
      actionReplayKey: 0,
      petAssetId: 'sprout-a',
      status: 'waiting_permission',
      alertCount: 1,
    })
    const second = petAnimationRenderKey({
      animation: 'jump',
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
