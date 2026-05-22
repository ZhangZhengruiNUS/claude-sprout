import type { StorageCleanKind } from './storageApi'
import i18n from '../i18n/i18n'

export function formatBytes(value: number) {
  const bytes = Math.max(0, value)
  if (bytes < 1024) return `${bytes} B`

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${formatUnit(kilobytes)} KB`

  return `${formatUnit(kilobytes / 1024)} MB`
}

export function cleanStorageConfirmationText(
  kind: StorageCleanKind,
  fileCount: number,
  bytes: number,
) {
  if (kind === 'safe_sessions') {
    return i18n.t('storage.confirmSafeSessions', {
      count: fileCount,
      fileLabel: pluralize(fileCount, 'file'),
      bytes: formatBytes(bytes),
    })
  }

  return i18n.t('storage.confirmOldEvents', {
    count: fileCount,
    fileLabel: pluralize(fileCount, 'file'),
    bytes: formatBytes(bytes),
  })
}

function formatUnit(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function pluralize(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`
}
