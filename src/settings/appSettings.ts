export type PetSizePreset = 'small' | 'medium' | 'large' | 'custom'

export type AppSettings = {
  doNotDisturb: boolean
  petAlwaysOnTop: boolean
  petLockPosition: boolean
  petScale: number
  petSizePreset: PetSizePreset
}

type StoredAppSettings = Partial<AppSettings>

export const APP_SETTINGS_STORAGE_KEY = 'claude-sprout.settings.v1'
export const LEGACY_PET_SCALE_STORAGE_KEY = 'claude-sprout.pet-scale'

export const PET_SCALE_MIN = 0.75
export const PET_SCALE_MAX = 1.65

export const PET_SIZE_OPTIONS = {
  small: { label: 'Small', scale: 0.85 },
  medium: { label: 'Medium', scale: 1 },
  large: { label: 'Large', scale: 1.25 },
} as const

export const DEFAULT_APP_SETTINGS: AppSettings = {
  doNotDisturb: false,
  petAlwaysOnTop: true,
  petLockPosition: false,
  petScale: PET_SIZE_OPTIONS.medium.scale,
  petSizePreset: 'medium',
}

const PET_SIZE_PRESETS = new Set<PetSizePreset>(['small', 'medium', 'large', 'custom'])

export function clampPetScale(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_APP_SETTINGS.petScale
  return Math.min(PET_SCALE_MAX, Math.max(PET_SCALE_MIN, value))
}

export function settingsWithPetScale(settings: AppSettings, petScale: number): AppSettings {
  const scale = clampPetScale(petScale)
  const preset = Object.entries(PET_SIZE_OPTIONS).find(([, option]) => option.scale === scale)?.[0]

  return {
    ...settings,
    petScale: scale,
    petSizePreset: isPetSizePreset(preset) ? preset : 'custom',
  }
}

export function settingsWithPetSizePreset(
  settings: AppSettings,
  petSizePreset: Exclude<PetSizePreset, 'custom'>,
): AppSettings {
  return {
    ...settings,
    petScale: PET_SIZE_OPTIONS[petSizePreset].scale,
    petSizePreset,
  }
}

export function loadAppSettings(storage: Storage = window.localStorage): AppSettings {
  const storedSettings = parseStoredSettings(storage.getItem(APP_SETTINGS_STORAGE_KEY))
  const legacyScale = parseFiniteNumber(storage.getItem(LEGACY_PET_SCALE_STORAGE_KEY))

  return normalizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    ...(legacyScale === null ? null : { petScale: legacyScale, petSizePreset: 'custom' as const }),
    ...storedSettings,
  })
}

export function saveAppSettings(settings: AppSettings, storage: Storage = window.localStorage) {
  storage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAppSettings(settings)))
}

export function hasStoredAppSettings(storage: Storage = window.localStorage) {
  return (
    storage.getItem(APP_SETTINGS_STORAGE_KEY) !== null ||
    storage.getItem(LEGACY_PET_SCALE_STORAGE_KEY) !== null
  )
}

function normalizeAppSettings(settings: StoredAppSettings): AppSettings {
  const petSizePreset = isPetSizePreset(settings.petSizePreset)
    ? settings.petSizePreset
    : DEFAULT_APP_SETTINGS.petSizePreset
  const presetScale = petSizePreset === 'custom' ? null : PET_SIZE_OPTIONS[petSizePreset].scale
  const storedScale = typeof settings.petScale === 'number' ? settings.petScale : Number(settings.petScale)

  return {
    doNotDisturb: settings.doNotDisturb ?? DEFAULT_APP_SETTINGS.doNotDisturb,
    petAlwaysOnTop: settings.petAlwaysOnTop ?? DEFAULT_APP_SETTINGS.petAlwaysOnTop,
    petLockPosition: settings.petLockPosition ?? DEFAULT_APP_SETTINGS.petLockPosition,
    petScale: clampPetScale(presetScale ?? storedScale ?? DEFAULT_APP_SETTINGS.petScale),
    petSizePreset,
  }
}

function parseStoredSettings(raw: string | null): StoredAppSettings {
  if (!raw) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as StoredAppSettings
  } catch {
    return {}
  }
}

function parseFiniteNumber(raw: string | null) {
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function isPetSizePreset(value: unknown): value is PetSizePreset {
  return typeof value === 'string' && PET_SIZE_PRESETS.has(value as PetSizePreset)
}
