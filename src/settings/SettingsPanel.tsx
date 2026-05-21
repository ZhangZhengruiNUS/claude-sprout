import { Download, FileText, Lock, Pin, RefreshCw, Search, VolumeX } from 'lucide-react'
import type { CodexPetCandidate, PetAsset } from '../pet/petAssetsApi'
import type { PetAnimation } from '../pet/petStateMapper'
import { StoragePanel } from '../storage/StoragePanel'
import type { StorageCleanKind, StorageSummary } from '../storage/storageApi'
import type { AppSettings, PetDisplayMode, PetSizePreset } from './appSettings'
import {
  PET_ACTIVITY_WINDOW_WIDTH_MAX,
  PET_ACTIVITY_WINDOW_WIDTH_MIN,
  PET_MESSAGE_BOX_OPACITY_MAX,
  PET_MESSAGE_BOX_OPACITY_MIN,
  PET_SIZE_OPTIONS,
} from './appSettings'

type Props = {
  settings: AppSettings
  petAssets: PetAsset[]
  previewPetId: string | null
  codexPetCandidates: CodexPetCandidate[]
  hasScannedCodexPets: boolean
  isScanningCodexPets: boolean
  importingPetSourcePath: string | null
  petImportError: string | null
  storageSummary: StorageSummary | null
  isStorageLoading: boolean
  isStorageCleaning: boolean
  storageMessage: string | null
  onSettingsChange: (settings: AppSettings) => void
  onPetSizePresetChange: (preset: Exclude<PetSizePreset, 'custom'>) => void
  onPreviewPet: (petId: string | null) => void
  onApplyPetSelection: () => void
  onPreviewPetAnimation: (action: PetAnimation) => void
  onRefreshPetAssets: () => void
  onScanCodexPets: () => void
  onImportCodexPet: (candidate: CodexPetCandidate) => void
  onRefreshStorage: () => void
  onCleanStorage: (kind: StorageCleanKind) => void
  onOpenDataFolder: () => void
}

const PET_SIZE_PRESETS = ['small', 'medium', 'large'] as const
const PET_DISPLAY_MODES: Array<{ value: PetDisplayMode; label: string }> = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'activity', label: 'Activity' },
]

export function SettingsPanel({
  settings,
  petAssets,
  previewPetId,
  codexPetCandidates,
  hasScannedCodexPets,
  isScanningCodexPets,
  importingPetSourcePath,
  petImportError,
  storageSummary,
  isStorageLoading,
  isStorageCleaning,
  storageMessage,
  onSettingsChange,
  onPetSizePresetChange,
  onPreviewPet,
  onApplyPetSelection,
  onPreviewPetAnimation,
  onRefreshPetAssets,
  onScanCodexPets,
  onImportCodexPet,
  onRefreshStorage,
  onCleanStorage,
  onOpenDataFolder,
}: Props) {
  const installedPetIds = new Set(petAssets.map((petAsset) => petAsset.id))
  const hasPendingPetSelection = previewPetId !== settings.activePetId

  return (
    <section className="settings-panel">
      <h2>Settings</h2>
      <label className="setting-row">
        <span>
          <strong>Do not disturb</strong>
          <small>Suppress non-critical notifications while keeping session state visible.</small>
        </span>
        <span className="setting-control">
          <VolumeX size={16} />
          <input
            type="checkbox"
            checked={settings.doNotDisturb}
            onChange={(event) => onSettingsChange({ ...settings, doNotDisturb: event.target.checked })}
          />
        </span>
      </label>
      <div className="setting-row">
        <span>
          <strong>Pet information mode</strong>
          <small>Choose between quiet daily counts and a persistent session activity stack.</small>
        </span>
        <div className="size-segment" role="group" aria-label="Pet information mode">
          {PET_DISPLAY_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={settings.petDisplayMode === mode.value ? 'active' : ''}
              onClick={() => onSettingsChange({ ...settings, petDisplayMode: mode.value })}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
      <label className="setting-row">
        <span>
          <strong>Completion message</strong>
          <small>Seconds to show finished-task cards. Use 0 to keep them until acknowledged.</small>
        </span>
        <input
          className="setting-number"
          type="number"
          min={0}
          max={120}
          value={settings.petCompletionToastSeconds}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              petCompletionToastSeconds: Number(event.target.value),
            })
          }
        />
      </label>
      <label className="setting-row">
        <span>
          <strong>Activity rows</strong>
          <small>Number of open sessions shown before pager controls appear.</small>
        </span>
        <input
          className="setting-number"
          type="number"
          min={1}
          max={12}
          value={settings.petActivityVisibleCount}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              petActivityVisibleCount: Number(event.target.value),
            })
          }
        />
      </label>
      <label className="setting-row">
        <span>
          <strong>Activity width</strong>
          <small>Wider Activity cards can show longer conversation previews.</small>
        </span>
        <input
          className="setting-number"
          type="number"
          min={PET_ACTIVITY_WINDOW_WIDTH_MIN}
          max={PET_ACTIVITY_WINDOW_WIDTH_MAX}
          step={20}
          value={settings.petActivityWindowWidth}
          onChange={(event) =>
            onSettingsChange({
              ...settings,
              petActivityWindowWidth: Number(event.target.value),
            })
          }
        />
      </label>
      <label className="setting-row">
        <span>
          <strong>Message opacity</strong>
          <small>Adjust the glass background opacity for pet message and activity cards.</small>
        </span>
        <span className="setting-slider">
          <input
            type="range"
            min={PET_MESSAGE_BOX_OPACITY_MIN}
            max={PET_MESSAGE_BOX_OPACITY_MAX}
            step={5}
            value={settings.petMessageBoxOpacity}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                petMessageBoxOpacity: Number(event.target.value),
              })
            }
          />
          <small>{settings.petMessageBoxOpacity}%</small>
        </span>
      </label>
      <label className="setting-row">
        <span>
          <strong>Read conversation preview</strong>
          <small>Allow Activity cards to show short transcript snippets. Leave off for metadata-only cards.</small>
        </span>
        <span className="setting-control">
          <FileText size={16} />
          <input
            type="checkbox"
            checked={settings.petConversationPreviewEnabled}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                petConversationPreviewEnabled: event.target.checked,
              })
            }
          />
        </span>
      </label>
      <label className="setting-row">
        <span>
          <strong>Always on top pet window</strong>
          <small>Keep the pet visible above normal desktop windows.</small>
        </span>
        <span className="setting-control">
          <Pin size={16} />
          <input
            type="checkbox"
            checked={settings.petAlwaysOnTop}
            onChange={(event) => onSettingsChange({ ...settings, petAlwaysOnTop: event.target.checked })}
          />
        </span>
      </label>
      <div className="setting-row">
        <span>
          <strong>Pet size</strong>
          <small>Apply a fixed window size without relying on wheel gestures.</small>
        </span>
        <div className="size-segment" role="group" aria-label="Pet size">
          {PET_SIZE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={settings.petSizePreset === preset ? 'active' : ''}
              onClick={() => onPetSizePresetChange(preset)}
            >
              {PET_SIZE_OPTIONS[preset].label}
            </button>
          ))}
        </div>
      </div>
      <label className="setting-row">
        <span>
          <strong>Lock pet position</strong>
          <small>Disable drag movement while keeping click and size controls active.</small>
        </span>
        <span className="setting-control">
          <Lock size={16} />
          <input
            type="checkbox"
            checked={settings.petLockPosition}
            onChange={(event) => onSettingsChange({ ...settings, petLockPosition: event.target.checked })}
          />
        </span>
      </label>
      <div className="setting-row">
        <span>
          <strong>Pet appearance</strong>
          <small>Use an imported Codex-compatible 8x9 spritesheet, or keep the built-in sprout.</small>
        </span>
        <div className="setting-actions">
          <button type="button" onClick={onRefreshPetAssets}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button type="button" onClick={onScanCodexPets} disabled={isScanningCodexPets}>
            <Search size={16} />
            {isScanningCodexPets ? 'Scanning' : 'Scan Codex'}
          </button>
        </div>
      </div>
      <div className="pet-picker">
        <button
          type="button"
          className={previewPetId === null ? 'active' : ''}
          onClick={() => onPreviewPet(null)}
        >
          Built-in sprout
        </button>
        {petAssets.map((petAsset) => (
          <button
            key={petAsset.id}
            type="button"
            className={previewPetId === petAsset.id ? 'active' : ''}
            onClick={() => onPreviewPet(petAsset.id)}
          >
            {petAsset.name}
          </button>
        ))}
      </div>
      <div className="pet-apply-row">
        <span>
          {hasPendingPetSelection
            ? 'Previewing a different pet. Apply to use it in the floating window.'
            : 'Current pet selection is applied.'}
        </span>
        <div className="setting-actions">
          <button type="button" onClick={() => onPreviewPetAnimation('waving')}>
            Preview wave
          </button>
          <button
            type="button"
            disabled={!hasPendingPetSelection}
            onClick={() => onPreviewPet(settings.activePetId)}
          >
            Cancel
          </button>
          <button type="button" disabled={!hasPendingPetSelection} onClick={onApplyPetSelection}>
            Apply
          </button>
        </div>
      </div>
      {(hasScannedCodexPets || petImportError) && (
        <div className="pet-import-list" aria-live="polite">
          {petImportError && <p className="pet-import-error">{petImportError}</p>}
          {codexPetCandidates.length === 0 && hasScannedCodexPets && !isScanningCodexPets ? (
            <p className="pet-import-empty">No Codex-compatible pet folders were found.</p>
          ) : (
            codexPetCandidates.map((candidate) => {
              const isImporting = importingPetSourcePath === candidate.sourcePath
              const isInstalled = installedPetIds.has(candidate.id)

              return (
                <div key={candidate.sourcePath} className="pet-import-row">
                  <span className="pet-import-meta">
                    <strong>{candidate.id}</strong>
                    <small>{candidate.sourcePath}</small>
                    {!candidate.valid && candidate.reason && (
                      <small className="pet-import-error">{candidate.reason}</small>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={!candidate.valid || isImporting || isInstalled}
                    onClick={() => onImportCodexPet(candidate)}
                  >
                    <Download size={16} />
                    {isImporting ? 'Importing' : isInstalled ? 'Installed' : 'Import'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
      <StoragePanel
        summary={storageSummary}
        isLoading={isStorageLoading}
        isCleaning={isStorageCleaning}
        message={storageMessage}
        onRefresh={onRefreshStorage}
        onClean={onCleanStorage}
        onOpenDataFolder={onOpenDataFolder}
      />
    </section>
  )
}
