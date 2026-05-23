import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { builtInPetAsset } from './builtInPetAsset'
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
  it('renders the standard built-in Claude Sprout as a Codex atlas sprite', () => {
    const html = renderToStaticMarkup(
      <PetRenderer status="idle" alertCount={0} petAsset={builtInPetAsset} />,
    )

    expect(html).toContain('pet-hit-target')
    expect(html).toContain('sprite-pet loop')
    expect(html).toContain('pet-surface idle imported-pet')
    expect(html).toContain('claude-sprout-spritesheet.webp')
    expect(html).toContain('--sprite-frame-width:192px')
    expect(html).toContain('--sprite-frame-height:208px')
  })

  it('renders imported Codex rows with full atlas sizing and used-frame stepping', () => {
    const html = renderToStaticMarkup(
      <PetRenderer status="tool_running" alertCount={0} petAsset={codexPetAsset} />,
    )

    expect(html).toContain('sprite-pet loop')
    expect(html).toContain('pet-surface tool_running imported-pet')
    expect(html).toContain('--sprite-frames:6')
    expect(html).toContain('--sprite-sheet-width:1536px')
    expect(html).toContain('--sprite-sheet-height:1872px')
    expect(html).toContain('--sprite-row-offset:-1456px')
    expect(html).toContain('--sprite-end-offset:-1152px')
    expect(html).toContain('--sprite-duration:820ms')
  })

  it('uses quiet idle playback for idle atlas sprites without muting active loop states', () => {
    const idleHtml = renderToStaticMarkup(
      <PetRenderer status="idle" alertCount={0} petAsset={codexPetAsset} />,
    )
    const runningHtml = renderToStaticMarkup(
      <PetRenderer status="running" alertCount={0} petAsset={codexPetAsset} />,
    )

    expect(idleHtml).toContain('sprite-pet loop quiet-idle')
    expect(idleHtml).toContain('--sprite-quiet-cycle:10000ms')
    expect(runningHtml).toContain('sprite-pet loop')
    expect(runningHtml).not.toContain('quiet-idle')
    expect(runningHtml).not.toContain('--sprite-quiet-cycle')
  })

  it('keeps compact interaction handlers on a tighter pet hit target', () => {
    const html = renderToStaticMarkup(
      <PetRenderer status="idle" alertCount={0} compact petAsset={builtInPetAsset} />,
    )

    expect(html).toContain('pet-hit-target')
    expect(html.indexOf('pet-hit-target')).toBeLessThan(html.indexOf('sprite-pet loop'))
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

  it('renders imported Codex directional drag rows when an action overrides status', () => {
    const rightHtml = renderToStaticMarkup(
      <PetRenderer status="idle" alertCount={0} action="runningRight" petAsset={codexPetAsset} />,
    )
    const leftHtml = renderToStaticMarkup(
      <PetRenderer status="idle" alertCount={0} action="runningLeft" petAsset={codexPetAsset} />,
    )

    expect(rightHtml).toContain('--sprite-row-offset:-208px')
    expect(leftHtml).toContain('--sprite-row-offset:-416px')
  })
})
