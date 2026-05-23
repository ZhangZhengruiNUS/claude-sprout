import { describe, expect, it } from 'vitest'
import { resolveAppTheme } from './appTheme'

describe('app theme', () => {
  it('resolves explicit themes directly', () => {
    expect(resolveAppTheme('light', true)).toBe('light')
    expect(resolveAppTheme('dark', false)).toBe('dark')
  })

  it('uses system color scheme when theme is system', () => {
    expect(resolveAppTheme('system', true)).toBe('dark')
    expect(resolveAppTheme('system', false)).toBe('light')
  })
})
