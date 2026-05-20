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

export type CodexPetCandidate = {
  id: string
  sourcePath: string
  valid: boolean
  reason: string | null
}

export type PetManifest = {
  id: string
  name: string
  description: string | null
  source: string
  sourcePath: string
  spritesheet: string
  atlas: string
  importedAt: string
}

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window
}

export async function scanCodexPetCandidates(): Promise<CodexPetCandidate[]> {
  if (!isTauriRuntime()) return []

  return invoke<CodexPetCandidate[]>('scan_codex_pets')
}

export async function importCodexPet(sourcePath: string): Promise<PetManifest> {
  return invoke<PetManifest>('import_codex_pet', { path: sourcePath })
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
