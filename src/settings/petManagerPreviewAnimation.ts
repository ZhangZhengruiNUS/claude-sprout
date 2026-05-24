import type { PetAnimation } from '../pet/petStateMapper'

export type PetManagerPreviewAnimationState = {
  action: PetAnimation | null
  replayKey: number
}

export function nextPetManagerPreviewAnimationState(
  current: PetManagerPreviewAnimationState,
  action: PetAnimation,
): PetManagerPreviewAnimationState {
  return {
    action,
    replayKey: current.replayKey + 1,
  }
}
