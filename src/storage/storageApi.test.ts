import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanStorage, getStorageSummary, openDataFolder } from './storageApi'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

function setTauriRuntime(enabled: boolean) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  })

  if (enabled) {
    Object.defineProperty(globalThis, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    return
  }

  Reflect.deleteProperty(globalThis, '__TAURI_INTERNALS__')
}

describe('storage api', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    setTauriRuntime(true)
  })

  it('loads storage summary from Tauri', async () => {
    invokeMock.mockResolvedValueOnce({
      rootPath: 'C:/Users/Test/.claude-sprout',
      sessions: {
        fileCount: 2,
        directoryCount: 0,
        totalBytes: 200,
        cleanableFileCount: 1,
        cleanableBytes: 100,
      },
      events: {
        fileCount: 1,
        directoryCount: 0,
        totalBytes: 50,
        cleanableFileCount: 0,
        cleanableBytes: 0,
      },
      pets: {
        fileCount: 3,
        directoryCount: 1,
        totalBytes: 500,
        cleanableFileCount: 0,
        cleanableBytes: 0,
      },
    })

    const summary = await getStorageSummary()

    expect(summary.rootPath).toBe('C:/Users/Test/.claude-sprout')
    expect(invokeMock).toHaveBeenCalledWith('get_storage_summary')
  })

  it('cleans selected storage kind through Tauri', async () => {
    invokeMock.mockResolvedValueOnce({
      deletedFileCount: 2,
      deletedBytes: 100,
      keptFileCount: 1,
    })

    await cleanStorage('safe_sessions')

    expect(invokeMock).toHaveBeenCalledWith('clean_storage', { kind: 'safe_sessions' })
  })

  it('opens the data folder through Tauri', async () => {
    invokeMock.mockResolvedValueOnce(undefined)

    await openDataFolder()

    expect(invokeMock).toHaveBeenCalledWith('open_data_folder')
  })

  it('returns empty storage data outside Tauri', async () => {
    setTauriRuntime(false)

    const summary = await getStorageSummary()
    const result = await cleanStorage('old_events')
    await openDataFolder()

    expect(summary.sessions.fileCount).toBe(0)
    expect(result.deletedFileCount).toBe(0)
    expect(invokeMock).not.toHaveBeenCalled()
  })
})
