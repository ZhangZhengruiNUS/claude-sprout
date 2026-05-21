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
      width: 360,
      height: 424,
    })
  })

  it('applies the pet scale after choosing the display-mode size', () => {
    expect(
      petWindowSizeForDisplay({
        scale: 1.25,
        displayMode: 'activity',
        visibleCount: 2,
        activityWidth: 420,
      }),
    ).toEqual({
      width: 525,
      height: 450,
    })
  })

  it('clamps configurable activity width', () => {
    expect(
      petWindowSizeForDisplay({ scale: 1, displayMode: 'activity', visibleCount: 1, activityWidth: 999 }),
    ).toEqual({
      width: 520,
      height: 296,
    })
  })
})
