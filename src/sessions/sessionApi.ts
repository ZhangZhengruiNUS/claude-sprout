import { invoke } from '@tauri-apps/api/core'
import { Window } from '@tauri-apps/api/window'
import { mockSessions } from './mockSessions'
import type { SessionSnapshot } from './sessionTypes'

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window
}

export async function loadSessions(): Promise<SessionSnapshot[]> {
  if (!isTauriRuntime()) {
    return mockSessions
  }

  try {
    return await invoke<SessionSnapshot[]>('list_sessions')
  } catch (error) {
    console.warn('Falling back to mock sessions after list_sessions failed.', error)
    return mockSessions
  }
}

export async function refreshSessions(): Promise<void> {
  if (!isTauriRuntime()) {
    return
  }

  await invoke('refresh_sessions')
}

export async function openProjectFolder(cwd: string): Promise<void> {
  if (!isTauriRuntime()) {
    console.info('Open project folder:', cwd)
    return
  }

  await invoke('open_project_folder', { path: cwd })
}

export async function showSessionPanel(): Promise<void> {
  if (!isTauriRuntime()) {
    console.info('Show session panel')
    return
  }

  try {
    const panelWindow = await Window.getByLabel('main')
    if (panelWindow) {
      await panelWindow.show()
      await panelWindow.setFocus()
      return
    }
  } catch (error) {
    console.warn('Falling back to backend session panel command.', error)
  }

  await invoke('show_session_panel')
}
