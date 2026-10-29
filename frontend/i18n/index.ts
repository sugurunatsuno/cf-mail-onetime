import { readonly, ref, watchEffect } from 'vue'
import { commonMessages } from './common'
import { modalMessages } from './modals'
import { viewMessages } from './views'

export type Locale = 'zh-CN' | 'en'
export const LOCALE_STORAGE_KEY = 'cf-mail.locale'
const messages = { ...commonMessages, ...modalMessages, ...viewMessages }
export type MessageKey = keyof typeof messages
export type MessageParams = Record<string, string | number>

function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'en'
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Browsers may disallow storage; language selection still works in memory.
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

const currentLocale = ref<Locale>(initialLocale())
export const locale = readonly(currentLocale)

export function t(key: MessageKey, params: MessageParams = {}): string {
  const text = currentLocale.value === 'zh-CN' ? messages[key] : key
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  )
}

export function setLocale(value: string): void {
  if (!isLocale(value)) return
  currentLocale.value = value
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, value)
  } catch {
    // A denied storage write must not prevent switching language.
  }
}

/** Map known backend errors only. Unknown provider text uses a localized fallback. */
export function apiErrorKey(error: unknown, fallback: MessageKey): MessageKey {
  if (typeof error === 'string' && Object.hasOwn(commonMessages, error)) {
    return error as keyof typeof commonMessages
  }
  return fallback
}

watchEffect(() => {
  document.documentElement.lang = currentLocale.value
  document.title = t('CF Mail Post Office')
})

export function useI18n() {
  return { t, locale, setLocale }
}
