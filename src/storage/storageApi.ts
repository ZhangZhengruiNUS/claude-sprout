import { invoke } from '@tauri-apps/api/core'

export type StorageCleanKind = 'safe_sessions' | 'old_events'

export type StorageBucketSummary = {
  fileCount: number
  directoryCount: number
  totalBytes: number
  cleanableFileCount: number
  cleanableBytes: number
}

export type StorageSummary = {
  rootPath: string
  sessions: StorageBucketSummary
  events: StorageBucketSummary
  pets: StorageBucketSummary
}

export type StorageCleanResult = {
  deletedFileCount: number
  deletedBytes: number
  keptFileCount: number
}

export type StorageCleanRequest = {
  kind: StorageCleanKind
  expectedCleanableFileCount: number
  expectedCleanableBytes: number
}

const EMPTY_BUCKET: StorageBucketSummary = {
  fileCount: 0,
  directoryCount: 0,
  totalBytes: 0,
  cleanableFileCount: 0,
  cleanableBytes: 0,
}

const EMPTY_SUMMARY: StorageSummary = {
  rootPath: '%USERPROFILE%\\.claude-sprout',
  sessions: EMPTY_BUCKET,
  events: EMPTY_BUCKET,
  pets: EMPTY_BUCKET,
}

function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window
}

export async function getStorageSummary(): Promise<StorageSummary> {
  if (!isTauriRuntime()) {
    return EMPTY_SUMMARY
  }

  return invoke<StorageSummary>('get_storage_summary')
}

export async function cleanStorage(request: StorageCleanRequest): Promise<StorageCleanResult> {
  if (!isTauriRuntime()) {
    return {
      deletedFileCount: 0,
      deletedBytes: 0,
      keptFileCount: 0,
    }
  }

  return invoke<StorageCleanResult>('clean_storage', { request })
}

export async function openDataFolder(): Promise<void> {
  if (!isTauriRuntime()) {
    console.info('Open data folder')
    return
  }

  await invoke('open_data_folder')
}
