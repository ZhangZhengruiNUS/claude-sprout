import type { PetDisplayMode } from '../settings/appSettings'

export function nextPetDisplayMode(currentMode: PetDisplayMode): PetDisplayMode {
  return currentMode === 'activity' ? 'minimal' : 'activity'
}

export function petDisplayModeMenuLabel(currentMode: PetDisplayMode) {
  return currentMode === 'activity' ? 'Message' : 'Board'
}

export function petDisplayModeMenuTitle(currentMode: PetDisplayMode) {
  return `Switch to ${petDisplayModeMenuLabel(currentMode)} mode`
}
