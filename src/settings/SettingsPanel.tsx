import { Download, Lock, Pin, RefreshCw, Search, VolumeX } from 'lucide-react'
import type { CodexPetCandidate, PetAsset } from '../pet/petAssetsApi'
import type { PetAnimation } from '../pet/petStateMapper'
import type { AppSettings, PetSizePreset } from './appSettings'
import { PET_SIZE_OPTIONS } from './appSettings'

type Props = {
  settings: AppSettings
  petAssets: PetAsset[]
  previewPetId: string | null
  codexPetCandidates: CodexPetCandidate[]
  hasScannedCodexPets: boolean
  isScanningCodexPets: boolean
  importingPetSourcePath: string | null
  petImportError: string | null
  onSettingsChange: (settings: AppSettings) => void
  onPetSizePresetChange: (preset: Exclude<PetSizePreset, 'custom'>) => void
  onPreviewPet: (petId: string | null) => void
  onApplyPetSelection: () => void
  onPreviewPetAnimation: (action: PetAnimation) => void
  onRefreshPetAssets: () => void
  onScanCodexPets: () => void
  onImportCodexPet: (candidate: CodexPetCandidate) => void
}

const PET_SIZE_PRESETS = ['small', 'medium', 'large'] as const

export function SettingsPanel({
  settings,
  petAssets,
  previewPetId,
  codexPetCandidates,
  hasScannedCodexPets,
  isScanningCodexPets,
  importingPetSourcePath,
  petImportError,
  onSettingsChange,
  onPetSizePresetChange,
  onPreviewPet,
  onApplyPetSelection,
  onPreviewPetAnimation,
  onRefreshPetAssets,
  onScanCodexPets,
  onImportCodexPet,
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
          <button type="button" onClick={() => onPreviewPetAnimation('wave')}>
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
    </section>
  )
}
