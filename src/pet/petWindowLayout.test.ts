import { describe, expect, it } from 'vitest'
import { petWindowSizeForDisplay } from './petWindowLayout'

describe('pet window layout', () => {
  it('keeps minimal mode at the compact pet size', () => {
    expect(petWindowSizeForDisplay({ scale: 1, displayMode: 'minimal', visibleCount: 3 })).toEqual({
      width: 180,
      height: 210,
    })
  })

  it('expands activity mode for the configured visible session rows', () => {
    expect(petWindowSizeForDisplay({ scale: 1, displayMode: 'activity', visibleCount: 3 })).toEqual({
      width: 300,
      height: 364,
    })
  })

  it('applies the pet scale after choosing the display-mode size', () => {
    expect(petWindowSizeForDisplay({ scale: 1.25, displayMode: 'activity', visibleCount: 2 })).toEqual({
      width: 375,
      height: 398,
    })
  })
})
