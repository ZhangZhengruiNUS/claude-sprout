import { describe, expect, it } from 'vitest'
import { codexAtlasProfile } from './codex8x9'

describe('Codex 8x9 atlas profile', () => {
  it('matches the Codex pet atlas geometry', () => {
    expect(codexAtlasProfile).toMatchObject({
      rows: 9,
      cols: 8,
      frameWidth: 192,
      frameHeight: 208,
    })
  })

  it('exposes Codex animation rows with their used frames and playback modes', () => {
    expect(codexAtlasProfile.animations).toEqual({
      idle: { row: 0, frameCount: 6, mode: 'loop', durationMs: 1100 },
      runningRight: { row: 1, frameCount: 8, mode: 'loop', durationMs: 1060 },
      runningLeft: { row: 2, frameCount: 8, mode: 'loop', durationMs: 1060 },
      waving: { row: 3, frameCount: 4, mode: 'once', durationMs: 700 },
      jumping: { row: 4, frameCount: 5, mode: 'once', durationMs: 840 },
      failed: { row: 5, frameCount: 8, mode: 'once', durationMs: 1220 },
      waiting: { row: 6, frameCount: 6, mode: 'loop', durationMs: 1010 },
      running: { row: 7, frameCount: 6, mode: 'loop', durationMs: 820 },
      review: { row: 8, frameCount: 6, mode: 'loop', durationMs: 1030 },
    })
  })
})
