import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { hasBlockingReleaseToolWarnings, inspectReleaseTools } from './release-doctor.mjs'

async function tempRoot(name) {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

describe('release doctor', () => {
  it('reports missing local NSIS cache files with the expected cache path', async () => {
    const root = await tempRoot('claude-sprout-release-doctor')
    try {
      const report = await inspectReleaseTools({ repoRoot: root, envPath: '' })

      expect(report.nsis.cacheRoot).toBe(join(root, 'src-tauri', 'target', '.tauri', 'NSIS'))
      expect(report.nsis.requiredFiles.map((file) => file.name)).toContain('makensis.exe')
      expect(report.nsis.requiredFiles.map((file) => file.name)).toContain(
        'Plugins/x86-unicode/additional/nsis_tauri_utils.dll',
      )
      expect(report.nsis.requiredFiles.every((file) => file.status === 'missing')).toBe(true)
      expect(report.pathTools.makensis).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('detects cached NSIS tools and validates the tauri utils dll hash', async () => {
    const root = await tempRoot('claude-sprout-release-doctor')
    const nsisRoot = join(root, 'src-tauri', 'target', '.tauri', 'NSIS')
    const nsisDllPath = join(nsisRoot, 'Plugins', 'x86-unicode', 'additional')
    try {
      await mkdir(nsisDllPath, { recursive: true })
      await writeFile(join(nsisRoot, 'makensis.exe'), 'fake exe')
      await writeFile(join(nsisDllPath, 'nsis_tauri_utils.dll'), 'fake dll')

      const report = await inspectReleaseTools({ repoRoot: root, envPath: '' })
      const makensis = report.nsis.requiredFiles.find((file) => file.name === 'makensis.exe')
      const dll = report.nsis.requiredFiles.find((file) =>
        file.name.endsWith('nsis_tauri_utils.dll'),
      )

      expect(makensis.status).toBe('present')
      expect(dll.status).toBe('hash-mismatch')
      expect(dll.expectedSha1).toBe('75197FEE3C6A814FE035788D1C34EAD39349B860')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not block NSIS releases when only WiX tools are missing', async () => {
    const report = {
      nsis: {
        requiredFiles: [
          { name: 'makensis.exe', status: 'present' },
          { name: 'Plugins/x86-unicode/additional/nsis_tauri_utils.dll', status: 'present' },
        ],
      },
      wix: {
        requiredFiles: [
          { name: 'candle.exe', status: 'missing' },
          { name: 'light.exe', status: 'missing' },
        ],
      },
    }

    expect(hasBlockingReleaseToolWarnings(report, 'nsis')).toBe(false)
    expect(hasBlockingReleaseToolWarnings(report, 'msi')).toBe(true)
  })
})
