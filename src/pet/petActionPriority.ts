import type { PetDragAnimation } from './petDragAnimation'
import type { PetAnimation } from './petStateMapper'

export function resolvePetWindowAction(
  hasImportedPet: boolean,
  eventAction: PetAnimation | null,
  dragAnimation: PetDragAnimation | null,
): PetAnimation | null {
  if (eventAction) {
    return eventAction
  }

  return hasImportedPet ? dragAnimation : null
}
