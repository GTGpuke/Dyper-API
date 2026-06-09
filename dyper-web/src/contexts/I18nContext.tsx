// Contexte d'internationalisation : langue courante + fonction de traduction t().
// La langue pilote l'UI et la langue des réponses IA. Persistée en localStorage, synchronisée
// depuis les préférences du compte après connexion.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { type Lang, translations } from '../i18n/translations'

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const LANG_KEY = 'dyper-lang'

function detectInitial(): Lang {
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'fr' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial)

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l)
    document.documentElement.setAttribute('lang', l)
    setLangState(l)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      // Repli sur le français si la langue ou la clé est inconnue (jamais de crash ni de clé brute).
      const dict = translations[lang] ?? translations.fr
      let str = dict[key] ?? translations.fr[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.split(`{${k}}`).join(String(v))
        }
      }
      return str
    },
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n doit être utilisé dans un I18nProvider.')
  return ctx
}
