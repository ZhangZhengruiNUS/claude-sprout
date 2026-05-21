import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi'
import { getCurrentWindow, Window } from '@tauri-apps/api/window'
import { clampPetScale, loadAppSettings } from '../settings/appSettings'
import { isTauriRuntime } from '../tauriRuntime'

const BASE_WIDTH = 180
const BASE_HEIGHT = 210

export type PetDragOrigin = {
  screenX: number
  screenY: number
}

export type PetDragSession = {
  move: (screenX: number, screenY: number) => Promise<void>
}

export function loadPetScale() {
  return loadAppSettings().petScale
}

export async function applyPetScale(value: number, targetWindow?: Window) {
  const scale = clampPetScale(value)

  if (isTauriRuntime()) {
    await (targetWindow ?? getCurrentWindow()).setSize(
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
