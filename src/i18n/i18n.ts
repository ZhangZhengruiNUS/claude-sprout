import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { locale as osLocale } from '@tauri-apps/plugin-os'
import type { AppLanguage } from '../settings/appSettings'
import { isTauriRuntime } from '../tauriRuntime'
import { resources } from './resources'

export type ResolvedAppLanguage = 'en' | 'zh-CN'

function browserLocale() {
  return typeof navigator === 'undefined' ? null : navigator.language
}

export function resolveAppLanguage(language: AppLanguage, systemLocale: string | null = browserLocale()) {
  const candidate = language === 'system' ? systemLocale : language
  const normalized = candidate?.toLowerCase()
  if (normalized?.startsWith('zh')) return 'zh-CN'
  return 'en'
}

export async function detectSystemLocale() {
  if (isTauriRuntime()) {
    try {
      return await osLocale()
    } catch {
      return browserLocale()
    }
  }

  return browserLocale()
}

export async function applyAppLanguage(language: AppLanguage) {
  const resolvedLanguage = resolveAppLanguage(language, await detectSystemLocale())
  if (i18n.resolvedLanguage !== resolvedLanguage) {
    await i18n.changeLanguage(resolvedLanguage)
  }
  document.documentElement.lang = resolvedLanguage
  return resolvedLanguage
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh-CN'],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

export default i18n
