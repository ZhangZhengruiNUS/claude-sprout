import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSessions, showSessionPanel } from './sessionApi'

const invokeMock = vi.hoisted(() => vi.fn())
const getByLabelMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/api/window', () => ({
  Window: {
    getByLabel: getByLabelMock,
  },
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

describe('session api', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    getByLabelMock.mockReset()
    setTauriRuntime(true)
  })

  it('opens and focuses the main session panel window from the pet window', async () => {
    const unminimize = vi.fn().mockResolvedValue(undefined)
    const show = vi.fn().mockResolvedValue(undefined)
    const setFocus = vi.fn().mockResolvedValue(undefined)
    getByLabelMock.mockResolvedValue({ unminimize, show, setFocus })

    await showSessionPanel()

    expect(getByLabelMock).toHaveBeenCalledWith('main')
    expect(unminimize).toHaveBeenCalled()
    expect(show).toHaveBeenCalled()
    expect(setFocus).toHaveBeenCalled()
  })

  it('does not show mock sessions when Tauri session loading fails', async () => {
    invokeMock.mockRejectedValueOnce(new Error('bad session file'))

    await expect(loadSessions()).resolves.toEqual([])
  })
})
