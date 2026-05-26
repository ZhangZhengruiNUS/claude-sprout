import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_PET_ID,
  isBuiltInPetSelectionId,
  isRetiredBuiltInPetAsset,
  normalizePetSelectionId,
} from './builtInPetIdentity'

describe('built-in pet identity', () => {
  it('treats Glint and retired Claude Sprout ids as the built-in pet', () => {
    expect(normalizePetSelectionId(null)).toBeNull()
    expect(normalizePetSelectionId(BUILT_IN_PET_ID)).toBeNull()
    expect(normalizePetSelectionId('built-in-claude-sprout')).toBeNull()
    expect(normalizePetSelectionId('claude-sprout')).toBeNull()
    expect(normalizePetSelectionId('handoff')).toBe('handoff')
    expect(isBuiltInPetSelectionId(BUILT_IN_PET_ID)).toBe(true)
    expect(isBuiltInPetSelectionId('built-in-claude-sprout')).toBe(true)
    expect(isBuiltInPetSelectionId('claude-sprout')).toBe(true)
  })

  it('detects the retired imported Claude Sprout asset without hiding other pets', () => {
    expect(
      isRetiredBuiltInPetAsset({
        id: 'claude-sprout',
        name: 'Claude Sprout',
        atlas: 'codex-8x9',
      }),
    ).toBe(true)

    expect(
      isRetiredBuiltInPetAsset({
        id: 'claude-sprout',
        name: 'Custom Sprout',
        atlas: 'codex-8x9',
      }),
    ).toBe(false)
  })
})
