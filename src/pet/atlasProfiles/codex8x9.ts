import type { PetAnimation } from '../petStateMapper'

export type AtlasAnimation = {
  row: number
  frameCount: number
  mode: 'loop' | 'once'
  durationMs: number
}

export const codexAtlasProfile = {
  rows: 9,
  cols: 8,
  frameWidth: 192,
  frameHeight: 208,
  defaultFrameDurationMs: 120,
  animations: {
    idle: { row: 0, frameCount: 6, mode: 'loop', durationMs: 1100 },
    runningRight: { row: 1, frameCount: 8, mode: 'loop', durationMs: 1060 },
    runningLeft: { row: 2, frameCount: 8, mode: 'loop', durationMs: 1060 },
    waving: { row: 3, frameCount: 4, mode: 'once', durationMs: 700 },
    jumping: { row: 4, frameCount: 5, mode: 'once', durationMs: 840 },
    failed: { row: 5, frameCount: 8, mode: 'once', durationMs: 1220 },
    waiting: { row: 6, frameCount: 6, mode: 'loop', durationMs: 1010 },
    running: { row: 7, frameCount: 6, mode: 'loop', durationMs: 820 },
    review: { row: 8, frameCount: 6, mode: 'loop', durationMs: 1030 },
  } satisfies Record<PetAnimation, AtlasAnimation>,
}
