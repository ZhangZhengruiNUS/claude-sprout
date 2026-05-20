import type { StorageCleanKind } from './storageApi'

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
    return `Clean ${fileCount} safe session ${pluralize(fileCount, 'file')} and free ${formatBytes(bytes)}? Running and waiting sessions will be kept.`
  }

  return `Clean ${fileCount} old event ${pluralize(fileCount, 'file')} and free ${formatBytes(bytes)}? Recent event files will be kept.`
}

function formatUnit(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function pluralize(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`
}
