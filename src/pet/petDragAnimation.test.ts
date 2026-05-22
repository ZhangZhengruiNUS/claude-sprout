import { describe, expect, it } from 'vitest'
import { dragDeltaToPetAnimation } from './petDragAnimation'

describe('pet drag animation', () => {
  it('maps horizontal drag direction to Codex directional running rows', () => {
    expect(dragDeltaToPetAnimation(12)).toBe('runningRight')
    expect(dragDeltaToPetAnimation(-12)).toBe('runningLeft')
  })

  it('ignores tiny horizontal movement to avoid animation flicker', () => {
    expect(dragDeltaToPetAnimation(0)).toBeNull()
    expect(dragDeltaToPetAnimation(3)).toBeNull()
    expect(dragDeltaToPetAnimation(-3)).toBeNull()
  })
})
