import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi'
import { getCurrentWindow } from '@tauri-apps/api/window'

const BASE_WIDTH = 180
const BASE_HEIGHT = 210
const MIN_SCALE = 0.75
const MAX_SCALE = 1.65
const STORAGE_KEY = 'claude-sprout.pet-scale'

export type PetDragOrigin = {
  screenX: number
  screenY: number
}

export type PetDragSession = {
  move: (screenX: number, screenY: number) => Promise<void>
}

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window
}

export function loadPetScale() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number(raw) : 1
  if (!Number.isFinite(parsed)) return 1
  return clampPetScale(parsed)
}

export function clampPetScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export async function applyPetScale(value: number) {
  const scale = clampPetScale(value)
  window.localStorage.setItem(STORAGE_KEY, String(scale))

  if (isTauriRuntime()) {
    await getCurrentWindow().setSize(
      new LogicalSize(Math.round(BASE_WIDTH * scale), Math.round(BASE_HEIGHT * scale)),
    )
  }

  return scale
}

export async function beginPetDrag(origin: PetDragOrigin): Promise<PetDragSession | null> {
  if (!isTauriRuntime()) return null

  const appWindow = getCurrentWindow()
  const [startPosition, scaleFactor] = await Promise.all([
    appWindow.outerPosition(),
    appWindow.scaleFactor(),
  ])

  return {
    async move(screenX: number, screenY: number) {
      const deltaX = Math.round((screenX - origin.screenX) * scaleFactor)
      const deltaY = Math.round((screenY - origin.screenY) * scaleFactor)

      await appWindow.setPosition(
        new PhysicalPosition(startPosition.x + deltaX, startPosition.y + deltaY),
      )
    },
  }
}
