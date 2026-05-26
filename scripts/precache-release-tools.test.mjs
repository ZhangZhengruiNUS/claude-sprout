import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPrecachePlan,
  releaseToolTargetNames,
  resolveReleaseToolTargets,
} from './precache-release-tools.mjs'

describe('release tool pre-cache helpers', () => {
  it('defaults to pre-caching both installer toolchains', () => {
    expect(resolveReleaseToolTargets({})).toEqual(['nsis', 'wix'])
  })

  it('can narrow the pre-cache plan to NSIS only', () => {
    expect(resolveReleaseToolTargets({ target: 'nsis' })).toEqual(['nsis'])
  })

  it('builds deterministic cache destinations from release doctor constants', () => {
    const root = 'C:\\repo\\agent-desktop-companion'
    const plan = buildPrecachePlan({ repoRoot: root, targets: releaseToolTargetNames })

    expect(plan.map((entry) => entry.name)).toEqual(['nsis', 'nsis-tauri-utils', 'wix'])
    expect(plan[0]).toMatchObject({
      archiveSha1: 'EF7FF767E5CBD9EDD22ADD3A32C9B8F4500BB10D',
      cacheRoot: join(root, 'src-tauri', 'target', '.tauri', 'NSIS'),
    })
    expect(plan[1]).toMatchObject({
      fileSha1: '75197FEE3C6A814FE035788D1C34EAD39349B860',
      destination: join(
        root,
        'src-tauri',
        'target',
        '.tauri',
        'NSIS',
        'Plugins',
        'x86-unicode',
        'additional',
        'nsis_tauri_utils.dll',
      ),
    })
    expect(plan[2]).toMatchObject({
      archiveSha256: '6ac824e1642d6f7277d0ed7ea09411a508f6116ba6fae0aa5f2c7daa2ff43d31',
      cacheRoot: join(root, 'src-tauri', 'target', '.tauri', 'WixTools314'),
    })
  })
})
