import { invoke } from '@tauri-apps/api/core'
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  hasStoredAppSettings,
  loadAppSettings,
  saveAppSettings,
} from './appSettings'

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window
}

export async function loadPersistedAppSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    return loadAppSettings()
  }

  const settings = await invoke<AppSettings>('load_app_settings')
  if (isDefaultSettings(settings) && hasStoredAppSettings()) {
    return savePersistedAppSettings(loadAppSettings())
  }

  saveAppSettings(settings)
  return settings
}

export async function savePersistedAppSettings(settings: AppSettings): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    saveAppSettings(settings)
    return settings
  }

  const saved = await invoke<AppSettings>('save_app_settings', { settings })
  saveAppSettings(saved)
  return saved
}

function isDefaultSettings(settings: AppSettings) {
  return JSON.stringify(settings) === JSON.stringify(DEFAULT_APP_SETTINGS)
}
