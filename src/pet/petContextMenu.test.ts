import { describe, expect, it } from 'vitest'
import { shouldDismissPetContextMenu } from './petContextMenu'

type ContainsNode = {
  contains: (target: Node | null) => boolean
}

describe('pet context menu dismissal', () => {
  it('dismisses when a pointer event starts outside the menu', () => {
    const outsideTarget = new EventTarget()
    const menu: ContainsNode = {
      contains: (target) => target !== (outsideTarget as unknown as Node),
    }

    expect(shouldDismissPetContextMenu(outsideTarget, menu)).toBe(true)
  })

  it('keeps the menu open when a pointer event starts inside the menu', () => {
    const insideTarget = new EventTarget()
    const menu: ContainsNode = {
      contains: (target) => target === (insideTarget as unknown as Node),
    }

    expect(shouldDismissPetContextMenu(insideTarget, menu)).toBe(false)
  })

  it('keeps the menu open when no menu element is mounted yet', () => {
    expect(shouldDismissPetContextMenu(new EventTarget(), null)).toBe(false)
  })
})
