import { clampPetScale, type PetDisplayMode } from '../settings/appSettings'

const MINIMAL_WIDTH = 180
const MINIMAL_HEIGHT = 210
const ACTIVITY_WIDTH = 260
const ACTIVITY_BASE_HEIGHT = 166
const ACTIVITY_ROW_HEIGHT = 42

type PetWindowSizeOptions = {
  scale: number
  displayMode: PetDisplayMode
  visibleCount: number
}

export function petWindowSizeForDisplay({
  scale,
  displayMode,
  visibleCount,
}: PetWindowSizeOptions) {
  const normalizedScale = clampPetScale(scale)
  const baseSize =
    displayMode === 'activity'
      ? {
          width: ACTIVITY_WIDTH,
          height: ACTIVITY_BASE_HEIGHT + clampVisibleCount(visibleCount) * ACTIVITY_ROW_HEIGHT,
        }
      : {
          width: MINIMAL_WIDTH,
          height: MINIMAL_HEIGHT,
        }

  return {
    width: Math.round(baseSize.width * normalizedScale),
    height: Math.round(baseSize.height * normalizedScale),
  }
}

function clampVisibleCount(value: number) {
  if (!Number.isFinite(value)) return 3
  return Math.min(12, Math.max(1, Math.round(value)))
}
