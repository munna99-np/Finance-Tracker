export type AppSettings = {
  currency: string
  locale: string
  theme: 'light' | 'dark'
}

const CURRENCY_KEY = 'app_currency'
const LOCALE_KEY = 'app_locale'
const THEME_KEY = 'app_theme'

export function getCurrency(): string {
  return localStorage.getItem(CURRENCY_KEY) || 'INR'
}

export function setCurrency(cur: string) {
  localStorage.setItem(CURRENCY_KEY, cur || 'INR')
}

export function getLocale(): string {
  return localStorage.getItem(LOCALE_KEY) || 'en-IN'
}

export function setLocale(loc: string) {
  localStorage.setItem(LOCALE_KEY, loc || 'en-IN')
}

export function getTheme(): 'light' | 'dark' {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: 'light' | 'dark') {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

export function applyTheme(theme?: 'light' | 'dark') {
  const t = theme || getTheme()
  const root = document.documentElement
  if (t === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

// Notify app to re-render after settings change
export function notifySettingsChanged() {
  try {
    window.dispatchEvent(new CustomEvent('app:settings'))
  } catch {}
}
