import { codexAtlasProfile } from './atlasProfiles/codex8x9'
import type { PetAsset } from './petAssetsApi'

const builtInSpritesheetUrl = new URL(
  '../assets/claude-sprout-spritesheet.webp',
  import.meta.url,
).href

export const BUILT_IN_PET_ID = 'built-in-claude-sprout'

export const builtInPetAsset: PetAsset = {
  id: BUILT_IN_PET_ID,
  name: 'Claude Sprout',
  description: 'The standard Claude Sprout desktop companion.',
  spritesheetPath: builtInSpritesheetUrl,
  atlas: 'codex-8x9',
  imageSrc: builtInSpritesheetUrl,
  atlasProfile: codexAtlasProfile,
}
