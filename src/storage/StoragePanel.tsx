import { Database, FolderOpen, RefreshCw, Trash2 } from 'lucide-react'
import type { StorageCleanKind, StorageSummary } from './storageApi'
import { formatBytes } from './storageFormatting'

type Props = {
  summary: StorageSummary | null
  isLoading: boolean
  isCleaning: boolean
  message: string | null
  onRefresh: () => void
  onClean: (kind: StorageCleanKind) => void
  onOpenDataFolder: () => void
}

type StorageRowProps = {
  label: string
  detail: string
  files: number
  directories: number
  bytes: number
  cleanableFiles?: number
  cleanableBytes?: number
  cleanLabel?: string
  cleanKind?: StorageCleanKind
  isCleaning: boolean
  onClean: (kind: StorageCleanKind) => void
}

export function StoragePanel({
  summary,
  isLoading,
  isCleaning,
  message,
  onRefresh,
  onClean,
  onOpenDataFolder,
}: Props) {
  return (
    <section className="storage-panel" aria-live="polite">
      <div className="setting-row storage-heading">
        <span>
          <strong>Storage</strong>
          <small>{summary?.rootPath ?? '%USERPROFILE%\\.claude-sprout'}</small>
        </span>
        <div className="setting-actions">
          <button type="button" onClick={onRefresh} disabled={isLoading || isCleaning}>
            <RefreshCw size={16} />
            {isLoading ? 'Refreshing' : 'Refresh storage'}
          </button>
          <button type="button" onClick={onOpenDataFolder}>
            <FolderOpen size={16} />
            Open data folder
          </button>
        </div>
      </div>

      {message ? <p className="storage-message">{message}</p> : null}

      <div className="storage-list">
        <StorageRow
          label="Sessions"
          detail="Safe cleanup keeps running and waiting sessions."
          files={summary?.sessions.fileCount ?? 0}
          directories={summary?.sessions.directoryCount ?? 0}
          bytes={summary?.sessions.totalBytes ?? 0}
          cleanableFiles={summary?.sessions.cleanableFileCount ?? 0}
          cleanableBytes={summary?.sessions.cleanableBytes ?? 0}
          cleanLabel="Clean safe sessions"
          cleanKind="safe_sessions"
          isCleaning={isCleaning}
          onClean={onClean}
        />
        <StorageRow
          label="Events"
          detail="Old events are files older than 14 days."
          files={summary?.events.fileCount ?? 0}
          directories={summary?.events.directoryCount ?? 0}
          bytes={summary?.events.totalBytes ?? 0}
          cleanableFiles={summary?.events.cleanableFileCount ?? 0}
          cleanableBytes={summary?.events.cleanableBytes ?? 0}
          cleanLabel="Clean old events"
          cleanKind="old_events"
          isCleaning={isCleaning}
          onClean={onClean}
        />
        <StorageRow
          label="Imported pets"
          detail="Pet assets are counted only in this version."
          files={summary?.pets.fileCount ?? 0}
          directories={summary?.pets.directoryCount ?? 0}
          bytes={summary?.pets.totalBytes ?? 0}
          isCleaning={isCleaning}
          onClean={onClean}
        />
      </div>
    </section>
  )
}

function StorageRow({
  label,
  detail,
  files,
  directories,
  bytes,
  cleanableFiles = 0,
  cleanableBytes = 0,
  cleanLabel,
  cleanKind,
  isCleaning,
  onClean,
}: StorageRowProps) {
  const canClean = Boolean(cleanKind && cleanableFiles > 0 && !isCleaning)

  return (
    <div className="storage-row">
      <div className="storage-row-title">
        <Database size={16} />
        <span>
          <strong>{label}</strong>
          <small>{detail}</small>
        </span>
      </div>
      <div className="storage-metrics">
        <span>{files} files</span>
        <span>{directories} folders</span>
        <span>{formatBytes(bytes)}</span>
        {cleanKind ? (
          <span>
            {cleanableFiles} cleanable / {formatBytes(cleanableBytes)}
          </span>
        ) : null}
      </div>
      {cleanKind && cleanLabel ? (
        <button type="button" disabled={!canClean} onClick={() => onClean(cleanKind)}>
          <Trash2 size={16} />
          {isCleaning ? 'Cleaning' : cleanLabel}
        </button>
      ) : null}
    </div>
  )
}
