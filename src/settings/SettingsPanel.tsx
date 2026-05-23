import { Download, FileText, Lock, Monitor, Moon, Pin, RefreshCw, Search, Sun, VolumeX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  isBuiltInPetSelectionId,
  normalizePetSelectionId,
} from '../pet/builtInPetIdentity'
import type { CodexPetCandidate, PetAsset } from '../pet/petAssetsApi'
import type { PetAnimation } from '../pet/petStateMapper'
import { StoragePanel } from '../storage/StoragePanel'
import type { StorageCleanKind, StorageSummary } from '../storage/storageApi'
import type { AppLanguage, AppSettings, AppTheme, PetDisplayMode, PetSizePreset } from './appSettings'
import {
  PET_ACTIVITY_WINDOW_WIDTH_MAX,
  PET_ACTIVITY_WINDOW_WIDTH_MIN,
  PET_MESSAGE_BOX_OPACITY_MAX,
  PET_MESSAGE_BOX_OPACITY_MIN,
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
const APP_LANGUAGE_OPTIONS: Array<{ value: AppLanguage; labelKey: string }> = [
  { value: 'system', labelKey: 'language.system' },
  { value: 'en', labelKey: 'language.english' },
  { value: 'zh-CN', labelKey: 'language.chinese' },
]
const APP_THEME_OPTIONS: Array<{
  value: AppTheme
  labelKey: string
  Icon: typeof Monitor
}> = [
  { value: 'system', labelKey: 'theme.system', Icon: Monitor },
  { value: 'light', labelKey: 'theme.light', Icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', Icon: Moon },
]
const PET_DISPLAY_MODES: Array<{ value: PetDisplayMode; labelKey: string }> = [
  { value: 'minimal', labelKey: 'settings.minimal' },
  { value: 'activity', labelKey: 'settings.activity' },
]
const PET_SIZE_LABEL_KEYS: Record<Exclude<PetSizePreset, 'custom'>, string> = {
  small: 'settings.petSizeSmall',
  medium: 'settings.petSizeMedium',
  large: 'settings.petSizeLarge',
}

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
  const { t } = useTranslation()
  const installedPetIds = new Set(petAssets.map((petAsset) => petAsset.id))
  const normalizedPreviewPetId = normalizePetSelectionId(previewPetId)
  const normalizedActivePetId = normalizePetSelectionId(settings.activePetId)
  const hasPendingPetSelection = normalizedPreviewPetId !== normalizedActivePetId

  return (
    <section className="settings-panel">
      <h2>{t('settings.title')}</h2>
      <div className="setting-row">
        <span>
          <strong>{t('settings.languageTitle')}</strong>
          <small>{t('settings.languageDescription')}</small>
        </span>
        <div className="size-segment" role="group" aria-label={t('settings.languageTitle')}>
          {APP_LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={settings.language === option.value ? 'active' : ''}
              onClick={() => onSettingsChange({ ...settings, language: option.value })}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span>
          <strong>{t('settings.themeTitle')}</strong>
          <small>{t('settings.themeDescription')}</small>
        </span>
        <div className="size-segment theme-segment" role="group" aria-label={t('settings.themeTitle')}>
          {APP_THEME_OPTIONS.map(({ value, labelKey, Icon }) => (
            <button
              key={value}
              type="button"
              className={settings.theme === value ? 'active' : ''}
              onClick={() => onSettingsChange({ ...settings, theme: value })}
            >
              <Icon size={15} />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
      <label className="setting-row">
        <span>
          <strong>{t('app.doNotDisturb')}</strong>
          <small>{t('settings.doNotDisturbDescription')}</small>
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
          <strong>{t('settings.petInformationMode')}</strong>
          <small>{t('settings.petInformationModeDescription')}</small>
        </span>
        <div className="size-segment" role="group" aria-label={t('settings.petInformationMode')}>
          {PET_DISPLAY_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={settings.petDisplayMode === mode.value ? 'active' : ''}
              onClick={() => onSettingsChange({ ...settings, petDisplayMode: mode.value })}
            >
              {t(mode.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <label className="setting-row">
        <span>
          <strong>{t('settings.completionMessage')}</strong>
          <small>{t('settings.completionMessageDescription')}</small>
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
          <strong>{t('settings.activityRows')}</strong>
          <small>{t('settings.activityRowsDescription')}</small>
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
          <strong>{t('settings.activityWidth')}</strong>
          <small>{t('settings.activityWidthDescription')}</small>
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
          <strong>{t('settings.messageOpacity')}</strong>
          <small>{t('settings.messageOpacityDescription')}</small>
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
          <strong>{t('settings.readConversationPreview')}</strong>
          <small>{t('settings.readConversationPreviewDescription')}</small>
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
          <strong>{t('settings.alwaysOnTop')}</strong>
          <small>{t('settings.alwaysOnTopDescription')}</small>
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
          <strong>{t('settings.petSize')}</strong>
          <small>{t('settings.petSizeDescription')}</small>
        </span>
        <div className="size-segment" role="group" aria-label={t('settings.petSize')}>
          {PET_SIZE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={settings.petSizePreset === preset ? 'active' : ''}
              onClick={() => onPetSizePresetChange(preset)}
            >
              {t(PET_SIZE_LABEL_KEYS[preset])}
            </button>
          ))}
        </div>
      </div>
      <label className="setting-row">
        <span>
          <strong>{t('settings.lockPetPosition')}</strong>
          <small>{t('settings.lockPetPositionDescription')}</small>
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
          <strong>{t('settings.petAppearance')}</strong>
          <small>{t('settings.petAppearanceDescription')}</small>
        </span>
        <div className="setting-actions">
          <button type="button" onClick={onRefreshPetAssets}>
            <RefreshCw size={16} />
            {t('settings.refreshPets')}
          </button>
          <button type="button" onClick={onScanCodexPets} disabled={isScanningCodexPets}>
            <Search size={16} />
            {isScanningCodexPets ? t('settings.scanning') : t('settings.scanCodex')}
          </button>
        </div>
      </div>
      <div className="pet-picker">
        <button
          type="button"
          className={normalizedPreviewPetId === null ? 'active' : ''}
          onClick={() => onPreviewPet(null)}
        >
          Claude Sprout
        </button>
        {petAssets.map((petAsset) => (
          <button
            key={petAsset.id}
            type="button"
            className={normalizedPreviewPetId === petAsset.id ? 'active' : ''}
            onClick={() => onPreviewPet(petAsset.id)}
          >
            {petAsset.name}
          </button>
        ))}
      </div>
      <div className="pet-apply-row">
        <span>
          {hasPendingPetSelection
            ? t('settings.previewingPet')
            : t('settings.currentPetApplied')}
        </span>
        <div className="setting-actions">
          <button type="button" onClick={() => onPreviewPetAnimation('waving')}>
            {t('settings.previewWave')}
          </button>
          <button
            type="button"
            disabled={!hasPendingPetSelection}
            onClick={() => onPreviewPet(normalizedActivePetId)}
          >
            {t('common.cancel')}
          </button>
          <button type="button" disabled={!hasPendingPetSelection} onClick={onApplyPetSelection}>
            {t('common.apply')}
          </button>
        </div>
      </div>
      {(hasScannedCodexPets || petImportError) && (
        <div className="pet-import-list" aria-live="polite">
          {petImportError && <p className="pet-import-error">{petImportError}</p>}
          {codexPetCandidates.length === 0 && hasScannedCodexPets && !isScanningCodexPets ? (
            <p className="pet-import-empty">{t('settings.noCodexPets')}</p>
          ) : (
            codexPetCandidates.map((candidate) => {
              const isImporting = importingPetSourcePath === candidate.sourcePath
              const isInstalled = installedPetIds.has(candidate.id) || isBuiltInPetSelectionId(candidate.id)

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
                    {isImporting
                      ? t('settings.importing')
                      : isInstalled
                        ? t('settings.installed')
                        : t('settings.import')}
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
