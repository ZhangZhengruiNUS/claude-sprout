import { describe, expect, it } from 'vitest'
import {
  nextPetDisplayMode,
  petDisplayModeMenuLabel,
  petDisplayModeMenuTitle,
} from './petDisplayModeMenu'

describe('pet display mode menu helpers', () => {
  it('toggles between Minimal and Activity modes', () => {
    expect(nextPetDisplayMode('minimal')).toBe('activity')
    expect(nextPetDisplayMode('activity')).toBe('minimal')
  })

  it('labels the menu with the mode it will switch to', () => {
    expect(petDisplayModeMenuLabel('minimal')).toBe('Board')
    expect(petDisplayModeMenuLabel('activity')).toBe('Message')
  })

  it('describes the mode switch in the button title', () => {
    expect(petDisplayModeMenuTitle('minimal')).toBe('Switch to Board mode')
    expect(petDisplayModeMenuTitle('activity')).toBe('Switch to Message mode')
  })
})
