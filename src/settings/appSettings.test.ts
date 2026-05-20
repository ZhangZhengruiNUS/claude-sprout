import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APP_SETTINGS,
  PET_SIZE_OPTIONS,
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
        petAlwaysOnTop: false,
        petLockPosition: true,
        petScale: 99,
        petSizePreset: 'large',
      }),
    )

    expect(loadAppSettings(storage)).toEqual({
      doNotDisturb: true,
      petAlwaysOnTop: false,
      petLockPosition: true,
      petScale: PET_SIZE_OPTIONS.large.scale,
      petSizePreset: 'large',
    })
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

  it('detects current or legacy stored settings', () => {
    const storage = new MemoryStorage()
    expect(hasStoredAppSettings(storage)).toBe(false)

    storage.setItem('claude-sprout.pet-scale', '1')
    expect(hasStoredAppSettings(storage)).toBe(true)
  })
})
