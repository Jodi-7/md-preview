import type { ContentWidth, FontSize, Theme } from '../types'

const STORAGE_KEY = 'md-preview.prefs.v1'

export interface Prefs {
  theme: Theme
  fontSize: FontSize
  width: ContentWidth
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  fontSize: 'md',
  width: 'narrow',
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

function isFontSize(value: unknown): value is FontSize {
  return value === 'sm' || value === 'md' || value === 'lg'
}

function isWidth(value: unknown): value is ContentWidth {
  return value === 'narrow' || value === 'wide'
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const prefersDark =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      return { ...DEFAULT_PREFS, theme: prefersDark ? 'dark' : 'light' }
    }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_PREFS.theme,
      fontSize: isFontSize(parsed.fontSize) ? parsed.fontSize : DEFAULT_PREFS.fontSize,
      width: isWidth(parsed.width) ? parsed.width : DEFAULT_PREFS.width,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* 隐私模式下写入会失败，忽略即可，不影响使用 */
  }
}
