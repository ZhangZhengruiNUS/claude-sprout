import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APP_SETTINGS,
  PET_SCALE_MIN,
  PET_SIZE_OPTIONS,
  clampPetScale,
  loadAppSettings,
  saveAppSettings,
  hasStoredAppSettings,
  settingsWithPetSizePreset,
} from './appSettings'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('app settings persistence', () => {
  it('loads defaults when storage is empty', () => {
    expect(loadAppSettings(new MemoryStorage())).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('sanitizes saved values and clamps pet scale', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'claude-sprout.settings.v1',
      JSON.stringify({
        doNotDisturb: true,
        language: 'zh-CN',
        theme: 'dark',
        petAlwaysOnTop: false,
        petLockPosition: true,
        petScale: 99,
        petSizePreset: 'large',
        petDisplayMode: 'activity',
        petCompletionToastSeconds: 0,
        petActivityVisibleCount: 6,
        petActivityWindowWidth: 420,
        petMessageBoxOpacity: 55,
        petConversationPreviewEnabled: true,
      }),
    )

    expect(loadAppSettings(storage)).toEqual({
      doNotDisturb: true,
      language: 'zh-CN',
      theme: 'dark',
      petAlwaysOnTop: false,
      petLockPosition: true,
      petScale: PET_SIZE_OPTIONS.large.scale,
      petSizePreset: 'large',
      activePetId: null,
      petDisplayMode: 'activity',
      petCompletionToastSeconds: 0,
      petActivityVisibleCount: 6,
      petActivityWindowWidth: 420,
      petMessageBoxOpacity: 55,
      petConversationPreviewEnabled: true,
    })
  })

  it('normalizes pet assistant settings from invalid stored values', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'claude-sprout.settings.v1',
      JSON.stringify({
        petDisplayMode: 'dashboard',
        petCompletionToastSeconds: -4,
        petActivityVisibleCount: 0,
        petActivityWindowWidth: 120,
        petMessageBoxOpacity: 10,
      }),
    )

    expect(loadAppSettings(storage)).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('falls back to the default scale when stored scale is not numeric', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'claude-sprout.settings.v1',
      JSON.stringify({
        petScale: 'wide',
        petSizePreset: 'custom',
      }),
    )

    expect(loadAppSettings(storage).petScale).toBe(DEFAULT_APP_SETTINGS.petScale)
  })

  it('allows the pet scale to shrink to the smaller supported minimum', () => {
    expect(PET_SCALE_MIN).toBe(0.55)
    expect(clampPetScale(0.4)).toBe(0.55)
  })

  it('migrates the older pet scale key into current settings', () => {
    const storage = new MemoryStorage()
    storage.setItem('claude-sprout.pet-scale', '1.25')

    expect(loadAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      petScale: 1.25,
      petSizePreset: 'custom',
    })
  })

  it('saves selected pet size presets with their scale', () => {
    const settings = settingsWithPetSizePreset(DEFAULT_APP_SETTINGS, 'small')
    const storage = new MemoryStorage()

    saveAppSettings(settings, storage)

    expect(loadAppSettings(storage)).toEqual({
      ...DEFAULT_APP_SETTINGS,
      petScale: PET_SIZE_OPTIONS.small.scale,
      petSizePreset: 'small',
    })
  })

  it('maps the small preset to a visibly smaller pet size', () => {
    expect(settingsWithPetSizePreset(DEFAULT_APP_SETTINGS, 'small').petScale).toBe(0.65)
  })

  it('detects current or legacy stored settings', () => {
    const storage = new MemoryStorage()
    expect(hasStoredAppSettings(storage)).toBe(false)

    storage.setItem('claude-sprout.pet-scale', '1')
    expect(hasStoredAppSettings(storage)).toBe(true)
  })

  it('persists the active imported pet id', () => {
    const storage = new MemoryStorage()

    saveAppSettings({ ...DEFAULT_APP_SETTINGS, activePetId: 'sprout-custom' }, storage)

    expect(loadAppSettings(storage).activePetId).toBe('sprout-custom')
  })

  it('keeps conversation preview disabled unless explicitly enabled', () => {
    const storage = new MemoryStorage()
    expect(loadAppSettings(storage).petConversationPreviewEnabled).toBe(false)

    saveAppSettings({ ...DEFAULT_APP_SETTINGS, petConversationPreviewEnabled: true }, storage)

    expect(loadAppSettings(storage).petConversationPreviewEnabled).toBe(true)
  })

  it('defaults invalid theme values to system', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'claude-sprout.settings.v1',
      JSON.stringify({
        theme: 'sepia',
      }),
    )

    expect(loadAppSettings(storage).theme).toBe('system')
  })
})
