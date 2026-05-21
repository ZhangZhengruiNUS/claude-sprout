import {
  PET_ACTIVITY_WINDOW_WIDTH_MAX,
  PET_ACTIVITY_WINDOW_WIDTH_MIN,
  clampPetScale,
  type PetDisplayMode,
} from '../settings/appSettings'

const MINIMAL_WIDTH = 180
const MINIMAL_HEIGHT = 210
const ACTIVITY_BASE_HEIGHT = 232
const ACTIVITY_ROW_HEIGHT = 64

type PetWindowSizeOptions = {
  scale: number
  displayMode: PetDisplayMode
  visibleCount: number
  activityWidth?: number
}

export function petWindowSizeForDisplay({
  scale,
  displayMode,
  visibleCount,
  activityWidth,
}: PetWindowSizeOptions) {
  const normalizedScale = clampPetScale(scale)
  const baseSize =
    displayMode === 'activity'
      ? {
          width: clampActivityWidth(activityWidth),
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
  return Math.min(12, Math.max(0, Math.round(value)))
}

function clampActivityWidth(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 360
  return Math.min(PET_ACTIVITY_WINDOW_WIDTH_MAX, Math.max(PET_ACTIVITY_WINDOW_WIDTH_MIN, Math.round(value)))
}
