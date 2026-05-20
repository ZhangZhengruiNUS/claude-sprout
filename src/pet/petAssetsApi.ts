import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { codexAtlasProfile } from './atlasProfiles/codex8x9'

export type InstalledPet = {
  id: string
  name: string
  description: string | null
  spritesheetPath: string
  atlas: string
}

export type PetAsset = InstalledPet & {
  imageSrc: string
  atlasProfile: typeof codexAtlasProfile
}

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window
}

export async function listPetAssets(): Promise<PetAsset[]> {
  if (!isTauriRuntime()) return []

  const pets = await invoke<InstalledPet[]>('list_installed_pets')
  return pets
    .filter((pet) => pet.atlas === 'codex-8x9')
    .map((pet) => ({
      ...pet,
      imageSrc: convertFileSrc(pet.spritesheetPath),
      atlasProfile: codexAtlasProfile,
    }))
}
