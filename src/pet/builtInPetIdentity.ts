export const BUILT_IN_PET_ID = 'built-in-claude-sprout'

const RETIRED_BUILT_IN_PET_IDS = new Set(['claude-sprout', BUILT_IN_PET_ID])

export function isBuiltInPetSelectionId(petId: string | null | undefined) {
  return petId == null || RETIRED_BUILT_IN_PET_IDS.has(petId)
}

export function normalizePetSelectionId(petId: string | null) {
  return isBuiltInPetSelectionId(petId) ? null : petId
}

export function isRetiredBuiltInPetAsset(pet: { id: string; name: string; atlas: string }) {
  return pet.id === 'claude-sprout' && pet.name === 'Claude Sprout' && pet.atlas === 'codex-8x9'
}
