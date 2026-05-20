import type { PetAnimation } from '../petStateMapper'

export type AtlasAnimation = {
  row: number
  frameCount: number
  mode: 'loop' | 'once'
  durationMs?: number
}

export const codexAtlasProfile = {
  rows: 8,
  cols: 9,
  frameWidth: 192,
  frameHeight: 208,
  defaultFrameDurationMs: 120,
  animations: {
    idle: { row: 0, frameCount: 9, mode: 'loop' },
    wave: { row: 1, frameCount: 9, mode: 'once' },
    run: { row: 2, frameCount: 9, mode: 'loop' },
    failed: { row: 3, frameCount: 9, mode: 'once' },
    review: { row: 4, frameCount: 9, mode: 'loop' },
    jump: { row: 5, frameCount: 9, mode: 'once' },
    extra1: { row: 6, frameCount: 9, mode: 'loop' },
    extra2: { row: 7, frameCount: 9, mode: 'loop' },
  } satisfies Record<PetAnimation, AtlasAnimation>,
}
