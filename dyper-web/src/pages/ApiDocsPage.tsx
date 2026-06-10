// Page publique de documentation de l'API Dyper (style Stripe/Claude) :
// barre supérieure (langue + thème), navigation latérale avec scroll-spy, sections d'endpoints.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EndpointSection } from '../components/docs/EndpointSection'
import { Segmented } from '../components/ui/Segmented'
import { useI18n } from '../contexts/I18nContext'
import { useTheme } from '../contexts/ThemeContext'
import { API_SECTIONS } from '../docs/apiReference'
import { cn } from '../lib/cn'

export function ApiDocsPage() {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const [activeSection, setActiveSection] = useState<string>(API_SECTIONS[0]?.id ?? '')
  const contentRef = useRef<HTMLDivElement>(null)

  // Scroll-spy : met en évidence la section visible dans la navigation latérale.
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { root, rootMargin: '-15% 0px -75% 0px' }
    )
    for (const section of API_SECTIONS) {
      const el = document.getElementById(`section-${section.id}`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  function jumpTo(sectionId: string): void {
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth' })
    history.replaceState(null, '', `#section-${sectionId}`)
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-ink-900">
      {/* Barre supérieure. */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-200 px-4 dark:border-ink-800 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold tracking-tight text-ink-900 dark:text-ink-50">
            Dyper <span className="font-normal text-ink-400 dark:text-ink-500">API</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'fr', label: 'FR' },
              { value: 'en', label: 'EN' },
            ]}
          />
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
            aria-label={t('settings.appearance.theme')}
            title={t('settings.appearance.theme')}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <Link
            to="/"
            className="rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {t('docs.backToApp')}
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Navigation latérale (desktop). */}
        <nav className="hidden w-60 shrink-0 overflow-y-auto border-r border-ink-200 px-4 py-6 dark:border-ink-800 lg:block">
          <p className="eyebrow mb-3">{t('docs.nav.title')}</p>
          <ul className="flex flex-col gap-0.5">
            {API_SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(section.id)}
                  className={cn(
                    'w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                    activeSection === `section-${section.id}` || activeSection === section.id
                      ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300'
                      : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
                  )}
                >
                  {t(section.titleKey)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contenu. */}
        <div ref={contentRef} className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
            <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
              {t('docs.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-400">
              {t('docs.subtitle')}
            </p>

            {/* Encadré d'authentification. */}
            <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-700/40 dark:bg-brand-600/10">
              <h2 className="text-sm font-semibold text-brand-800 dark:text-brand-300">
                {t('docs.auth.title')}
              </h2>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
                <li>{t('docs.auth.appKey')}</li>
                <li>{t('docs.auth.cookie')}</li>
              </ul>
            </div>

            {API_SECTIONS.map((section) => (
              <section key={section.id} id={`section-${section.id}`} className="scroll-mt-16 pt-10">
                <h2 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
                  {t(section.titleKey)}
                </h2>
                {section.introKey && (
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500 dark:text-ink-400">
                    {t(section.introKey)}
                  </p>
                )}
                <div className="mt-2">
                  {section.endpoints.map((endpoint) => (
                    <EndpointSection key={endpoint.id} endpoint={endpoint} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
