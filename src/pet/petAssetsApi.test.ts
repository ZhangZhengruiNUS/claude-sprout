import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  importCodexPet,
  listPetAssets,
  scanCodexPetCandidates,
  type InstalledPet,
} from './petAssetsApi'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: invokeMock,
}))

function setTauriRuntime(enabled: boolean) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })

  if (enabled) {
    Object.defineProperty(globalThis, 'isTauri', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(globalThis, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    return
  }

  Reflect.deleteProperty(globalThis, 'isTauri')
  Reflect.deleteProperty(globalThis, '__TAURI_INTERNALS__')
}

describe('pet asset api', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    setTauriRuntime(true)
  })

  it('scans Codex pet candidates from Tauri', async () => {
    invokeMock.mockResolvedValueOnce([
      {
        id: 'sprout',
        sourcePath: 'C:/Users/Test/.codex/pets/sprout',
        valid: true,
        reason: null,
      },
    ])

    await expect(scanCodexPetCandidates()).resolves.toEqual([
      {
        id: 'sprout',
        sourcePath: 'C:/Users/Test/.codex/pets/sprout',
        valid: true,
        reason: null,
      },
    ])
    expect(invokeMock).toHaveBeenCalledWith('scan_codex_pets')
  })

  it('imports a Codex pet by source path', async () => {
    invokeMock.mockResolvedValueOnce({
      id: 'sprout',
      name: 'sprout',
      sourcePath: 'C:/Users/Test/.codex/pets/sprout',
    })

    await importCodexPet('C:/Users/Test/.codex/pets/sprout')

    expect(invokeMock).toHaveBeenCalledWith('import_codex_pet', {
      path: 'C:/Users/Test/.codex/pets/sprout',
    })
  })

  it('returns no scan candidates outside Tauri', async () => {
    setTauriRuntime(false)

    await expect(scanCodexPetCandidates()).resolves.toEqual([])
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('maps installed pets into renderable assets', async () => {
    invokeMock.mockResolvedValueOnce([
      {
        id: 'sprout',
        name: 'Sprout',
        description: null,
        spritesheetPath: 'C:/pets/sprout/spritesheet.webp',
        atlas: 'codex-8x9',
      },
      {
        id: 'unknown',
        name: 'Unknown',
        description: null,
        spritesheetPath: 'C:/pets/unknown/spritesheet.webp',
        atlas: 'other',
      },
    ] satisfies InstalledPet[])

    const assets = await listPetAssets()

    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      id: 'sprout',
      imageSrc: 'asset://C:/pets/sprout/spritesheet.webp',
    })
  })

  it('hides the retired imported Claude Sprout duplicate now that it is built in', async () => {
    invokeMock.mockResolvedValueOnce([
      {
        id: 'claude-sprout',
        name: 'Claude Sprout',
        description: null,
        spritesheetPath: 'C:/pets/claude-sprout/spritesheet.webp',
        atlas: 'codex-8x9',
      },
      {
        id: 'handoff',
        name: 'handoff',
        description: null,
        spritesheetPath: 'C:/pets/handoff/spritesheet.webp',
        atlas: 'codex-8x9',
      },
    ] satisfies InstalledPet[])

    const assets = await listPetAssets()

    expect(assets.map((asset) => asset.id)).toEqual(['handoff'])
  })
})
