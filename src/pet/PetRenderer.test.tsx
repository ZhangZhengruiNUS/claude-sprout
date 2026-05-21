import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { codexAtlasProfile } from './atlasProfiles/codex8x9'
import type { PetAsset } from './petAssetsApi'
import { PetRenderer } from './PetRenderer'

const codexPetAsset: PetAsset = {
  id: 'handoff',
  name: 'Handoff',
  description: null,
  spritesheetPath: 'C:/Users/Test/.claude-sprout/pets/handoff/spritesheet.webp',
  atlas: 'codex-8x9',
  imageSrc: 'asset://handoff/spritesheet.webp',
  atlasProfile: codexAtlasProfile,
}

describe('PetRenderer', () => {
  it('renders imported Codex rows with full atlas sizing and used-frame stepping', () => {
    const html = renderToStaticMarkup(
      <PetRenderer status="tool_running" alertCount={0} petAsset={codexPetAsset} />,
    )

    expect(html).toContain('sprite-pet loop')
    expect(html).toContain('--sprite-frames:6')
    expect(html).toContain('--sprite-sheet-width:1536px')
    expect(html).toContain('--sprite-sheet-height:1872px')
    expect(html).toContain('--sprite-row-offset:-1456px')
    expect(html).toContain('--sprite-end-offset:-1152px')
    expect(html).toContain('--sprite-duration:820ms')
  })

  it('holds one-shot imported animations on the last used frame', () => {
    const html = renderToStaticMarkup(
      <PetRenderer status="idle" alertCount={0} action="waving" petAsset={codexPetAsset} />,
    )

    expect(html).toContain('sprite-pet once')
    expect(html).toContain('--sprite-frames:4')
    expect(html).toContain('--sprite-once-steps:3')
    expect(html).toContain('--sprite-hold-offset:-576px')
    expect(html).toContain('--sprite-end-offset:-768px')
    expect(html).not.toContain('--sprite-hold-offset:-768px')
  })
})
