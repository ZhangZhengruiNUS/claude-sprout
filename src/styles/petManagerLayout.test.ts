/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(fileURLToPath(new URL('./app.css', import.meta.url)), 'utf8')

function cssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = appCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'))
  return match?.[1] ?? ''
}

describe('pet manager layout CSS', () => {
  it('keeps hover feedback inside the scroll container bounds', () => {
    const hoverBlock = cssBlock(
      '.pet-manager-card.selectable:hover:not(:has(.pet-manager-card-actions button:hover))',
    )

    expect(hoverBlock).not.toContain('translateY')
    expect(hoverBlock).not.toContain('0 12px')
    expect(hoverBlock).toContain('inset 0')
  })
})
