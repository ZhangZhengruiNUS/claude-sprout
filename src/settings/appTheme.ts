import type { AppTheme } from './appSettings'

export type ResolvedAppTheme = 'light' | 'dark'

export function resolveAppTheme(theme: AppTheme, prefersDark: boolean): ResolvedAppTheme {
  if (theme === 'dark' || theme === 'light') return theme
  return prefersDark ? 'dark' : 'light'
}

export function applyAppTheme(theme: AppTheme) {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const resolvedTheme = resolveAppTheme(theme, media?.matches ?? true)

  document.documentElement.dataset.themePreference = theme
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme

  return resolvedTheme
}
