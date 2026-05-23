import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')

function cssBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`))
  return match?.groups?.body ?? ''
}

describe('pet Activity layout CSS', () => {
  it('anchors imported Activity HUD from a measured top variable', () => {
    expect(cssBlock('.floating-pet-shell.imported-pet-active.activity .pet-activity-hud')).toContain(
      'top: var(--pet-activity-hud-top',
    )
  })

  it('anchors the minimal HUD from a measured bottom variable so it follows small pets', () => {
    expect(cssBlock('.pet-minimal-hud')).toContain('bottom: var(--pet-minimal-hud-bottom')
  })
})
