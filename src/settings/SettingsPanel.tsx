import { Lock, Pin, VolumeX } from 'lucide-react'
import type { PetAsset } from '../pet/petAssetsApi'
import type { AppSettings, PetSizePreset } from './appSettings'
import { PET_SIZE_OPTIONS } from './appSettings'

type Props = {
  settings: AppSettings
  petAssets: PetAsset[]
  onSettingsChange: (settings: AppSettings) => void
  onPetSizePresetChange: (preset: Exclude<PetSizePreset, 'custom'>) => void
  onRefreshPetAssets: () => void
}

const PET_SIZE_PRESETS = ['small', 'medium', 'large'] as const

export function SettingsPanel({
  settings,
  petAssets,
  onSettingsChange,
  onPetSizePresetChange,
  onRefreshPetAssets,
}: Props) {
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
        <button type="button" onClick={onRefreshPetAssets}>
          Refresh pets
        </button>
      </div>
      <div className="pet-picker">
        <button
          type="button"
          className={!settings.activePetId ? 'active' : ''}
          onClick={() => onSettingsChange({ ...settings, activePetId: null })}
        >
          Built-in sprout
        </button>
        {petAssets.map((petAsset) => (
          <button
            key={petAsset.id}
            type="button"
            className={settings.activePetId === petAsset.id ? 'active' : ''}
            onClick={() => onSettingsChange({ ...settings, activePetId: petAsset.id })}
          >
            {petAsset.name}
          </button>
        ))}
      </div>
    </section>
  )
}
