import { codexAtlasProfile } from './atlasProfiles/codex8x9'
import { BUILT_IN_PET_ID } from './builtInPetIdentity'
import type { PetAsset } from './petAssetsApi'

const builtInSpritesheetUrl = new URL(
  '../assets/glint-spritesheet.webp',
  import.meta.url,
).href

export const builtInPetAsset: PetAsset = {
  id: BUILT_IN_PET_ID,
  name: 'Glint',
  description: 'The standard Glint desktop companion for Agent Desktop Companion.',
  spritesheetPath: builtInSpritesheetUrl,
  atlas: 'codex-8x9',
  imageSrc: builtInSpritesheetUrl,
  atlasProfile: codexAtlasProfile,
}
