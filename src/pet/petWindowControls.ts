import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi'
import { getCurrentWindow, Window } from '@tauri-apps/api/window'
import { loadAppSettings, type AppSettings } from '../settings/appSettings'
import { isTauriRuntime } from '../tauriRuntime'
import { petWindowSizeForDisplay, type PetWindowSize } from './petWindowLayout'

export type PetDragOrigin = {
  screenX: number
  screenY: number
  targetOffsetX?: number
  targetOffsetY?: number
  targetWidth?: number
  targetHeight?: number
}

export type PetDragSession = {
  start?: () => Promise<void>
  move: (screenX: number, screenY: number) => Promise<void>
  end?: () => Promise<void>
}

export type PetDragWindowResize = {
  dragSize: PetWindowSize
  restoreSize: PetWindowSize
}

export function loadPetScale() {
  return loadAppSettings().petScale
}

export async function applyPetScale(
  value: number,
  targetWindow?: Window,
  layoutSettings?: Pick<AppSettings, 'petDisplayMode' | 'petActivityVisibleCount' | 'petActivityWindowWidth'> & {
    petFrameSize?: { width: number; height: number } | null
  },
) {
  const size = petWindowSizeForDisplay({
    scale: value,
    displayMode: layoutSettings?.petDisplayMode ?? 'minimal',
    visibleCount: layoutSettings?.petActivityVisibleCount ?? 3,
    activityWidth: layoutSettings?.petActivityWindowWidth,
    petFrameSize: layoutSettings?.petFrameSize,
  })

  if (isTauriRuntime()) {
    await (targetWindow ?? getCurrentWindow()).setSize(
      new LogicalSize(size.width, size.height),
    )
  }

  return value
}

export async function beginPetDrag(
  origin: PetDragOrigin,
  resize?: PetDragWindowResize | null,
): Promise<PetDragSession | null> {
  if (!isTauriRuntime()) return null

  const appWindow = getCurrentWindow()
  const [initialPosition, scaleFactor] = await Promise.all([
    appWindow.outerPosition(),
    appWindow.scaleFactor(),
  ])
  let startPosition = initialPosition
  let dragResizeStarted = false

  return {
    async start() {
      if (!resize || dragResizeStarted) return
      dragResizeStarted = true

      const offsetX = dragAnchorOffset(origin, resize.dragSize, 'x')
        ?? origin.screenX - initialPosition.x / scaleFactor
      const offsetY = dragAnchorOffset(origin, resize.dragSize, 'y')
        ?? origin.screenY - initialPosition.y / scaleFactor
      const nextX =
        (origin.screenX - Math.min(Math.max(offsetX, 0), resize.dragSize.width)) * scaleFactor
      const nextY =
        (origin.screenY - Math.min(Math.max(offsetY, 0), resize.dragSize.height)) * scaleFactor
      startPosition = new PhysicalPosition(Math.round(nextX), Math.round(nextY))

      await Promise.all([
        appWindow.setSize(new LogicalSize(resize.dragSize.width, resize.dragSize.height)),
        appWindow.setPosition(startPosition),
      ])
    },
    async move(screenX: number, screenY: number) {
      const deltaX = Math.round((screenX - origin.screenX) * scaleFactor)
      const deltaY = Math.round((screenY - origin.screenY) * scaleFactor)

      await appWindow.setPosition(
        new PhysicalPosition(startPosition.x + deltaX, startPosition.y + deltaY),
      )
    },
    async end() {
      if (!resize || !dragResizeStarted) return
      await appWindow.setSize(new LogicalSize(resize.restoreSize.width, resize.restoreSize.height))
    },
  }
}

function dragAnchorOffset(
  origin: PetDragOrigin,
  dragSize: PetWindowSize,
  axis: 'x' | 'y',
) {
  const offset = axis === 'x' ? origin.targetOffsetX : origin.targetOffsetY
  const targetSize = axis === 'x' ? origin.targetWidth : origin.targetHeight
  const windowSize = axis === 'x' ? dragSize.width : dragSize.height

  if (!isFiniteNumber(offset) || !isFiniteNumber(targetSize) || targetSize <= 0) {
    return null
  }

  return offset + (windowSize - targetSize) / 2
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function applyPetAlwaysOnTop(alwaysOnTop: boolean, targetWindow?: Window) {
  if (!isTauriRuntime()) return
  await (targetWindow ?? getCurrentWindow()).setAlwaysOnTop(alwaysOnTop)
}

export async function getPetWindow() {
  if (!isTauriRuntime()) return null
  return Window.getByLabel('pet')
}

export async function hideCurrentPetWindow() {
  if (!isTauriRuntime()) return
  await getCurrentWindow().hide()
}
