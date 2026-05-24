/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const appCss = readFileSync(fileURLToPath(new URL('./app.css', import.meta.url)), 'utf8')

function cssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = appCss.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'))
  return match?.[1] ?? ''
}

describe('pet hit target layout', () => {
  it('lets only the visible pet target receive pointer interactions in compact mode', () => {
    expect(cssBlock('.floating-pet-shell')).toContain('pointer-events: none')
    expect(cssBlock('.pet-surface.compact')).toContain('pointer-events: none')
    expect(cssBlock('.pet-hit-target')).toContain('pointer-events: auto')
    expect(cssBlock('.pet-context-menu')).toContain('pointer-events: auto')
    expect(cssBlock('.pet-surface.compact .pet-hit-target')).toContain('cursor: grab')
    expect(cssBlock('.pet-surface.compact .pet-hit-target')).toContain('border-radius: 999px')
    expect(cssBlock('.pet-surface.compact.locked .pet-hit-target')).toContain('cursor: pointer')
    expect(cssBlock('.pet-surface.compact:active .pet-hit-target')).toContain('cursor: grabbing')
    expect(cssBlock('.pet-surface.compact:hover')).toContain('transform: none')
  })

  it('honors reduced-motion preferences for the always-on-top pet surface', () => {
    expect(appCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(appCss).toContain('.sprite-pet.loop')
    expect(appCss).toContain('.pet-message-card')
    expect(appCss).toContain('animation: none')
  })
})
