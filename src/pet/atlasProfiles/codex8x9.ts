import type { PetAnimation } from '../petStateMapper'

export type AtlasAnimation = {
  row: number
  mode: 'loop' | 'once'
}

export const codexAtlasProfile = {
  rows: 8,
  cols: 9,
  frameWidth: 192,
  frameHeight: 208,
  defaultFrameDurationMs: 120,
  animations: {
    idle: { row: 0, mode: 'loop' },
    wave: { row: 1, mode: 'once' },
    run: { row: 2, mode: 'loop' },
    failed: { row: 3, mode: 'once' },
    review: { row: 4, mode: 'loop' },
    jump: { row: 5, mode: 'once' },
    extra1: { row: 6, mode: 'loop' },
    extra2: { row: 7, mode: 'loop' },
  } satisfies Record<PetAnimation, AtlasAnimation>,
}
