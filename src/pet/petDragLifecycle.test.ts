import { describe, expect, it } from 'vitest'
import { PET_DRAG_CANCEL_EVENTS } from './petDragLifecycle'

describe('pet drag lifecycle', () => {
  it('listens for window-level release paths that can bypass the pet button', () => {
    expect(PET_DRAG_CANCEL_EVENTS).toEqual(['pointerup', 'pointercancel', 'blur'])
  })
})
