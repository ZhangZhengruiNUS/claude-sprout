/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const appCss = readFileSync(fileURLToPath(new URL('./app.css', import.meta.url)), 'utf8')

function cssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = appCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'))
  return match?.[1] ?? ''
}

describe('panel layout', () => {
  it('keeps the pet preview rail visible while panel content scrolls', () => {
    expect(cssBlock('.app-shell')).toContain('height: 100vh')
    expect(cssBlock('.app-shell')).toContain('overflow: hidden')
    expect(cssBlock('.pet-rail')).toContain('position: sticky')
    expect(cssBlock('.pet-rail')).toContain('top: 0')
    expect(cssBlock('.pet-rail')).toContain('height: 100vh')
    expect(cssBlock('.content-panel')).toContain('height: 100vh')
    expect(cssBlock('.content-panel')).toContain('overflow-y: auto')
  })
})
