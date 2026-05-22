import type { PetAnimation } from './petStateMapper'

export type PetDragAnimation = Extract<PetAnimation, 'runningRight' | 'runningLeft'>

export function dragDeltaToPetAnimation(deltaX: number, deadZone = 4): PetDragAnimation | null {
  if (!Number.isFinite(deltaX) || Math.abs(deltaX) < deadZone) {
    return null
  }

  return deltaX > 0 ? 'runningRight' : 'runningLeft'
}
