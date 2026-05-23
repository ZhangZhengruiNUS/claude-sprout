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
const IMPORTED_ACTIVITY_PET_SCALE = 0.78
const IMPORTED_ACTIVITY_HUD_GAP = 14
const IMPORTED_ACTIVITY_HUD_BOTTOM_MARGIN = 8
const IMPORTED_ACTIVITY_HUD_CHROME_HEIGHT = 68
const IMPORTED_ACTIVITY_CARD_ROW_HEIGHT = 70
const MINIMAL_HUD_BASE_BOTTOM = 7
const COMPACT_HIT_TARGET_HEIGHT_RATIO = 0.9
const MINIMAL_HUD_SCALE_FOLLOW_RATIO = 0.3

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
      const activityHudTop = importedActivityHudTop(petFrameSize.height, normalizedScale)
      const activityHudHeight = importedActivityHudHeight(visibleCount)
      return {
        width: Math.max(Math.round(clampActivityWidth(activityWidth) * normalizedScale), footprint.width),
        height: Math.max(
          footprint.height,
          activityHudTop + activityHudHeight + IMPORTED_ACTIVITY_HUD_BOTTOM_MARGIN,
        ),
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

export function importedActivityHudTop(frameHeight: number, scale: number) {
  return Math.round(frameHeight * scale * IMPORTED_ACTIVITY_PET_SCALE + IMPORTED_ACTIVITY_HUD_GAP)
}

export function minimalHudBottomOffset(frameHeight: number, scale: number) {
  const normalizedScale = clampPetScale(scale)
  const shrinkOffset =
    Math.max(0, 1 - normalizedScale) *
    frameHeight *
    COMPACT_HIT_TARGET_HEIGHT_RATIO *
    MINIMAL_HUD_SCALE_FOLLOW_RATIO
  return Math.round(MINIMAL_HUD_BASE_BOTTOM + shrinkOffset)
}

function importedActivityHudHeight(visibleCount: number) {
  const count = clampVisibleCount(visibleCount)
  if (count === 0) return 0
  return IMPORTED_ACTIVITY_HUD_CHROME_HEIGHT + count * IMPORTED_ACTIVITY_CARD_ROW_HEIGHT
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
