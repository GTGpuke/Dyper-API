// Coquille de la documentation (style platform.claude.com/docs) : topbar avec recherche,
// navigation latérale groupée (drawer sur mobile), contenu routé et liens précédent/suivant.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/dyper-logo.svg'
import { useI18n } from '../../contexts/I18nContext'
import { useTheme } from '../../contexts/ThemeContext'
import { API_SECTIONS } from '../../docs/apiReference'
import { GUIDES } from '../../docs/guides'
import { cn } from '../../lib/cn'
import { Segmented } from '../ui/Segmented'

interface NavEntry {
  path: string
  label: string
}

interface NavGroup {
  label: string
  entries: NavEntry[]
}

/** Construit la navigation groupée (et l'ordre du fil précédent/suivant). */
function useDocsNav(): NavGroup[] {
  const { t, lang } = useI18n()
  return useMemo(() => {
    const guide = (id: string): NavEntry => {
      const g = GUIDES.find((x) => x.id === id)
      return { path: `/api-docs/guide/${id}`, label: g ? g.title[lang] : id }
    }
    return [
      {
        label: t('docs.group.start'),
        entries: [
          { path: '/api-docs', label: t('docs.nav.home') },
          guide('quickstart'),
          guide('authentication'),
          guide('errors'),
        ],
      },
      {
        label: t('docs.group.guides'),
        entries: [guide('video'), guide('platform-links'), guide('chat')],
      },
      {
        label: t('docs.group.reference'),
        entries: API_SECTIONS.map((s) => ({
          path: `/api-docs/reference/${s.id}`,
          label: t(s.titleKey),
        })),
      },
    ]
  }, [t, lang])
}

/** Recherche plein texte simple : pages de la nav + endpoints (titre, méthode, chemin). */
function useSearchResults(query: string): NavEntry[] {
  const { t } = useI18n()
  const groups = useDocsNav()
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const out: NavEntry[] = []
    for (const group of groups) {
      for (const entry of group.entries) {
        if (entry.label.toLowerCase().includes(q)) out.push(entry)
      }
    }
    for (const section of API_SECTIONS) {
      for (const ep of section.endpoints) {
        const haystack = `${ep.method} ${ep.path} ${t(ep.descKey)}`.toLowerCase()
        if (haystack.includes(q)) {
          out.push({
            path: `/api-docs/reference/${section.id}#ep-${ep.id}`,
            label: `${ep.method} ${ep.path}`,
          })
        }
      }
    }
    return out.slice(0, 8)
  }, [query, groups, t])
}

export function DocsLayout() {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const groups = useDocsNav()
  const [query, setQuery] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const results = useSearchResults(query)
  const mainRef = useRef<HTMLElement>(null)

  // Remonte en haut à chaque changement de page (sauf navigation vers une ancre).
  useEffect(() => {
    if (!location.hash) mainRef.current?.scrollTo({ top: 0 })
  }, [location.pathname, location.hash])

  // Fil précédent/suivant : ordre aplati de la navigation.
  const flat = groups.flatMap((g) => g.entries)
  const currentIndex = flat.findIndex((e) => e.path === location.pathname)
  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null

  function goTo(path: string): void {
    setQuery('')
    setNavOpen(false)
    navigate(path)
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-ink-900">
      {/* Barre supérieure. */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 px-4 dark:border-ink-800 sm:px-6">
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800 lg:hidden"
          aria-label={t('docs.toggleNav')}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-bold tracking-tight text-ink-900 dark:text-ink-50">
            Dyper AI <span className="font-normal text-ink-400 dark:text-ink-500">Docs</span>
          </span>
        </Link>

        {/* Recherche. */}
        <div className="relative mx-auto hidden w-full max-w-md sm:block">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('docs.searchPlaceholder')}
            className="w-full rounded-xl border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:shadow-focus dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50"
          />
          {results.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-card-hover dark:border-ink-700 dark:bg-ink-800">
              {results.map((r) => (
                <li key={r.path}>
                  <button
                    type="button"
                    onClick={() => goTo(r.path)}
                    className="w-full px-3.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-700/60"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
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
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <Link
            to="/"
            className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            {t('docs.backToApp')}
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Navigation latérale (fixe en desktop, panneau en mobile). */}
        <nav
          className={cn(
            'w-64 shrink-0 overflow-y-auto border-r border-ink-200 bg-ink-50 px-4 py-6 dark:border-ink-800 dark:bg-ink-950 lg:block',
            navOpen ? 'absolute bottom-0 left-0 top-14 z-30 block shadow-card-hover' : 'hidden'
          )}
        >
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="eyebrow mb-2 px-2.5">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {group.entries.map((entry) => (
                  <li key={entry.path}>
                    <NavLink
                      to={entry.path}
                      end={entry.path === '/api-docs'}
                      onClick={() => setNavOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300'
                            : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
                        )
                      }
                    >
                      {entry.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Contenu + fil précédent/suivant. */}
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
            <Outlet />

            {currentIndex >= 0 && (prev || next) && (
              <div className="mt-12 flex gap-3 border-t border-ink-100 pt-6 dark:border-ink-800">
                {prev && (
                  <Link
                    to={prev.path}
                    className="group flex-1 rounded-xl border border-ink-200 p-3.5 transition-colors hover:border-brand-400 dark:border-ink-700 dark:hover:border-brand-500"
                  >
                    <span className="text-xs text-ink-400 dark:text-ink-500">← {t('docs.prev')}</span>
                    <span className="mt-0.5 block text-sm font-medium text-ink-800 group-hover:text-brand-600 dark:text-ink-100 dark:group-hover:text-brand-300">
                      {prev.label}
                    </span>
                  </Link>
                )}
                {next && (
                  <Link
                    to={next.path}
                    className="group flex-1 rounded-xl border border-ink-200 p-3.5 text-right transition-colors hover:border-brand-400 dark:border-ink-700 dark:hover:border-brand-500"
                  >
                    <span className="text-xs text-ink-400 dark:text-ink-500">{t('docs.next')} →</span>
                    <span className="mt-0.5 block text-sm font-medium text-ink-800 group-hover:text-brand-600 dark:text-ink-100 dark:group-hover:text-brand-300">
                      {next.label}
                    </span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
