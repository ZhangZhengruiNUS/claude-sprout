export const BUILT_IN_PET_ID = 'built-in-glint'

const BUILT_IN_PET_IDS = new Set([
  BUILT_IN_PET_ID,
  'built-in-claude-sprout',
  'claude-sprout',
])

export function isBuiltInPetSelectionId(petId: string | null | undefined) {
  return petId == null || BUILT_IN_PET_IDS.has(petId)
}

export function normalizePetSelectionId(petId: string | null) {
  return isBuiltInPetSelectionId(petId) ? null : petId
}

export function isRetiredBuiltInPetAsset(pet: { id: string; name: string; atlas: string }) {
  return pet.id === 'claude-sprout' && pet.name === 'Claude Sprout' && pet.atlas === 'codex-8x9'
}
