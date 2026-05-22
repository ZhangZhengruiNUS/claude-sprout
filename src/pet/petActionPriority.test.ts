import { describe, expect, it } from 'vitest'
import { resolvePetWindowAction } from './petActionPriority'

describe('pet action priority', () => {
  it('keeps event actions visible over imported pet drag direction', () => {
    expect(resolvePetWindowAction(true, 'jumping', 'runningRight')).toBe('jumping')
    expect(resolvePetWindowAction(true, 'failed', 'runningLeft')).toBe('failed')
  })

  it('uses drag direction only for imported pets without an event action', () => {
    expect(resolvePetWindowAction(true, null, 'runningRight')).toBe('runningRight')
    expect(resolvePetWindowAction(false, null, 'runningRight')).toBeNull()
  })
})
