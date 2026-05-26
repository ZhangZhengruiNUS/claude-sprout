export type PetSizePreset = 'small' | 'medium' | 'large' | 'custom'
export type PetDisplayMode = 'minimal' | 'activity'
export type AppLanguage = 'system' | 'en' | 'zh-CN'
export type AppTheme = 'system' | 'light' | 'dark'

export type AppSettings = {
  doNotDisturb: boolean
  language: AppLanguage
  theme: AppTheme
  petAlwaysOnTop: boolean
  petLockPosition: boolean
  petScale: number
  petSizePreset: PetSizePreset
  activePetId: string | null
  petDisplayMode: PetDisplayMode
  petCompletionToastSeconds: number
  petActivityVisibleCount: number
  petActivityWindowWidth: number
  petMessageBoxOpacity: number
  petConversationPreviewEnabled: boolean
}

type StoredAppSettings = Partial<AppSettings>

export const APP_SETTINGS_STORAGE_KEY = 'agent-desktop-companion.settings.v1'
export const LEGACY_APP_SETTINGS_STORAGE_KEY = 'claude-sprout.settings.v1'
export const LEGACY_PET_SCALE_STORAGE_KEY = 'claude-sprout.pet-scale'

export const PET_SCALE_MIN = 0.55
export const PET_SCALE_MAX = 1.65
export const PET_COMPLETION_TOAST_SECONDS_MAX = 120
export const PET_ACTIVITY_VISIBLE_COUNT_MAX = 12
export const PET_ACTIVITY_WINDOW_WIDTH_MIN = 300
export const PET_ACTIVITY_WINDOW_WIDTH_MAX = 520
export const PET_MESSAGE_BOX_OPACITY_MIN = 25
export const PET_MESSAGE_BOX_OPACITY_MAX = 95

export const PET_SIZE_OPTIONS = {
  small: { label: 'Small', scale: 0.65 },
  medium: { label: 'Medium', scale: 1 },
  large: { label: 'Large', scale: 1.25 },
} as const

export const DEFAULT_APP_SETTINGS: AppSettings = {
  doNotDisturb: false,
  language: 'system',
  theme: 'system',
  petAlwaysOnTop: true,
  petLockPosition: false,
  petScale: PET_SIZE_OPTIONS.medium.scale,
  petSizePreset: 'medium',
  activePetId: null,
  petDisplayMode: 'minimal',
  petCompletionToastSeconds: 5,
  petActivityVisibleCount: 3,
  petActivityWindowWidth: 360,
  petMessageBoxOpacity: 68,
  petConversationPreviewEnabled: false,
}

const PET_SIZE_PRESETS = new Set<PetSizePreset>(['small', 'medium', 'large', 'custom'])
const PET_DISPLAY_MODES = new Set<PetDisplayMode>(['minimal', 'activity'])
const APP_LANGUAGES = new Set<AppLanguage>(['system', 'en', 'zh-CN'])
const APP_THEMES = new Set<AppTheme>(['system', 'light', 'dark'])

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
  const storedSettings = parseStoredSettings(
    storage.getItem(APP_SETTINGS_STORAGE_KEY) ??
      storage.getItem(LEGACY_APP_SETTINGS_STORAGE_KEY),
  )
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
    storage.getItem(LEGACY_APP_SETTINGS_STORAGE_KEY) !== null ||
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
    language: isAppLanguage(settings.language) ? settings.language : DEFAULT_APP_SETTINGS.language,
    theme: isAppTheme(settings.theme) ? settings.theme : DEFAULT_APP_SETTINGS.theme,
    petAlwaysOnTop: settings.petAlwaysOnTop ?? DEFAULT_APP_SETTINGS.petAlwaysOnTop,
    petLockPosition: settings.petLockPosition ?? DEFAULT_APP_SETTINGS.petLockPosition,
    petScale: clampPetScale(presetScale ?? storedScale ?? DEFAULT_APP_SETTINGS.petScale),
    petSizePreset,
    activePetId: typeof settings.activePetId === 'string' ? settings.activePetId : null,
    petDisplayMode: isPetDisplayMode(settings.petDisplayMode)
      ? settings.petDisplayMode
      : DEFAULT_APP_SETTINGS.petDisplayMode,
    petCompletionToastSeconds: clampIntegerSetting(
      settings.petCompletionToastSeconds,
      0,
      PET_COMPLETION_TOAST_SECONDS_MAX,
      DEFAULT_APP_SETTINGS.petCompletionToastSeconds,
    ),
    petActivityVisibleCount: clampIntegerSetting(
      settings.petActivityVisibleCount,
      1,
      PET_ACTIVITY_VISIBLE_COUNT_MAX,
      DEFAULT_APP_SETTINGS.petActivityVisibleCount,
    ),
    petActivityWindowWidth: clampIntegerSetting(
      settings.petActivityWindowWidth,
      PET_ACTIVITY_WINDOW_WIDTH_MIN,
      PET_ACTIVITY_WINDOW_WIDTH_MAX,
      DEFAULT_APP_SETTINGS.petActivityWindowWidth,
    ),
    petMessageBoxOpacity: clampIntegerSetting(
      settings.petMessageBoxOpacity,
      PET_MESSAGE_BOX_OPACITY_MIN,
      PET_MESSAGE_BOX_OPACITY_MAX,
      DEFAULT_APP_SETTINGS.petMessageBoxOpacity,
    ),
    petConversationPreviewEnabled:
      settings.petConversationPreviewEnabled === true
        ? true
        : DEFAULT_APP_SETTINGS.petConversationPreviewEnabled,
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

function isPetDisplayMode(value: unknown): value is PetDisplayMode {
  return typeof value === 'string' && PET_DISPLAY_MODES.has(value as PetDisplayMode)
}

function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && APP_LANGUAGES.has(value as AppLanguage)
}

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && APP_THEMES.has(value as AppTheme)
}

function clampIntegerSetting(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.round(parsed)
  if (rounded < min) return fallback
  return Math.min(max, rounded)
}
