import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import uz from './uz.js'
import ru from './ru.js'
import en from './en.js'

const DICTS = { uz, ru, en }
export const LANGS = [
  { code: 'uz', label: "O'zbekcha", short: 'UZ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
]

const I18nCtx = createContext(null)

function initialLang() {
  try {
    const saved = localStorage.getItem('kpi.lang')
    if (saved && DICTS[saved]) return saved
  } catch { /* localStorage yopiq bo'lishi mumkin */ }
  const nav = (navigator.language || 'uz').slice(0, 2)
  return DICTS[nav] ? nav : 'uz'
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang)

  const setLang = useCallback((l) => {
    if (!DICTS[l]) return
    setLangState(l)
    try { localStorage.setItem('kpi.lang', l) } catch { /* ignore */ }
  }, [])

  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const t = useCallback((key, vars) => {
    let s = DICTS[lang][key] ?? DICTS.uz[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
    return s
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export const useI18n = () => useContext(I18nCtx)
