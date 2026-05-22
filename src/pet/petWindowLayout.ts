import {
  PET_ACTIVITY_WINDOW_WIDTH_MAX,
  PET_ACTIVITY_WINDOW_WIDTH_MIN,
  clampPetScale,
  type PetDisplayMode,
} from '../settings/appSettings'

const MINIMAL_WIDTH = 180
const MINIMAL_HEIGHT = 210
const IMPORTED_PET_PADDING = 24
const ACTIVITY_BASE_HEIGHT = 232
const ACTIVITY_ROW_HEIGHT = 64

type PetWindowSizeOptions = {
  scale: number
  displayMode: PetDisplayMode
  visibleCount: number
  activityWidth?: number
  petFrameSize?: { width: number; height: number } | null
}

export type PetWindowSize = {
  width: number
  height: number
}

export function petWindowSizeForDisplay({
  scale,
  displayMode,
  visibleCount,
  activityWidth,
  petFrameSize,
}: PetWindowSizeOptions) {
  const normalizedScale = clampPetScale(scale)
  if (petFrameSize) {
    const footprint = importedPetFootprint(petFrameSize, normalizedScale)
    if (displayMode === 'activity') {
      const activityHudHeight = importedActivityHudHeight(visibleCount, normalizedScale)
      return {
        width: Math.max(Math.round(clampActivityWidth(activityWidth) * normalizedScale), footprint.width),
        height: footprint.height + activityHudHeight,
      }
    }

    return footprint
  }

  const baseSize =
    displayMode === 'activity'
      ? {
          width: clampActivityWidth(activityWidth),
          height: ACTIVITY_BASE_HEIGHT + clampVisibleCount(visibleCount) * ACTIVITY_ROW_HEIGHT,
        }
      : {
          width: minimalWidthForPet(petFrameSize),
          height: minimalHeightForPet(petFrameSize),
        }

  return {
    width: Math.round(baseSize.width * normalizedScale),
    height: Math.round(baseSize.height * normalizedScale),
  }
}

function importedPetFootprint(
  petFrameSize: NonNullable<PetWindowSizeOptions['petFrameSize']>,
  scale: number,
) {
  return {
    width: Math.round(Math.max(petFrameSize.width, petFrameSize.width * scale) + IMPORTED_PET_PADDING),
    height: Math.round(Math.max(petFrameSize.height, petFrameSize.height * scale) + IMPORTED_PET_PADDING),
  }
}

function importedActivityHudHeight(visibleCount: number, scale: number) {
  const count = clampVisibleCount(visibleCount)
  if (count === 0) return 0
  return Math.round((ACTIVITY_ROW_HEIGHT + count * ACTIVITY_ROW_HEIGHT) * Math.max(1, scale))
}

function minimalWidthForPet(petFrameSize: PetWindowSizeOptions['petFrameSize']) {
  return Math.max(MINIMAL_WIDTH, Math.round((petFrameSize?.width ?? 0) + IMPORTED_PET_PADDING))
}

function minimalHeightForPet(petFrameSize: PetWindowSizeOptions['petFrameSize']) {
  return Math.max(MINIMAL_HEIGHT, Math.round((petFrameSize?.height ?? 0) + IMPORTED_PET_PADDING))
}

function clampVisibleCount(value: number) {
  if (!Number.isFinite(value)) return 3
  return Math.min(12, Math.max(0, Math.round(value)))
}

function clampActivityWidth(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 360
  return Math.min(PET_ACTIVITY_WINDOW_WIDTH_MAX, Math.max(PET_ACTIVITY_WINDOW_WIDTH_MIN, Math.round(value)))
}
