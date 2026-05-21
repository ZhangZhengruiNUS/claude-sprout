import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  createSessionSnapshot,
  smokeSessionFilePath,
  writeSessionSnapshot,
  writeSmokeSettings,
} from './session-smoke.mjs'

async function tempRoot(name) {
  const root = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

describe('session smoke helpers', () => {
  it('writes the schema consumed by the Rust session store', async () => {
    const root = await tempRoot('claude-sprout-session-smoke')
    try {
      const snapshot = createSessionSnapshot({
        sessionId: 'smoke-a',
        status: 'waiting_permission',
        updatedAt: '2026-05-20T12:00:00.000Z',
      })
      await writeSessionSnapshot(root, snapshot)

      const raw = JSON.parse(await readFile(smokeSessionFilePath(root, 'smoke-a'), 'utf8'))
      expect(raw).toMatchObject({
        session_id: 'smoke-a',
        project_name: 'Claude Sprout Smoke',
        status: 'waiting_permission',
        notification_type: 'permission_prompt',
        source: 'claude-sprout-smoke',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('writes do-not-disturb settings used by the app-data settings store', async () => {
    const root = await tempRoot('claude-sprout-session-smoke')
    try {
      await writeSmokeSettings(root, true)

      const raw = JSON.parse(await readFile(join(root, 'settings.json'), 'utf8'))
      expect(raw).toMatchObject({
        doNotDisturb: true,
        petAlwaysOnTop: true,
        petLockPosition: false,
        petSizePreset: 'medium',
        petDisplayMode: 'minimal',
        petCompletionToastSeconds: 5,
        petActivityVisibleCount: 3,
        petConversationPreviewEnabled: false,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
