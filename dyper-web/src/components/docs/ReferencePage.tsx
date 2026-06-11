// Page de référence d'une ressource API : endpoints détaillés + mini-sommaire « Sur cette page »
// avec scroll-spy (l'endpoint visible est mis en évidence dans le sommaire).
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { API_SECTIONS } from '../../docs/apiReference'
import { cn } from '../../lib/cn'
import { EndpointSection } from './EndpointSection'

export function ReferencePage() {
  const { t } = useI18n()
  const location = useLocation()
  const { sectionId } = useParams<{ sectionId: string }>()
  const section = API_SECTIONS.find((s) => s.id === sectionId)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Défilement vers l'endpoint ciblé par l'ancre (#ep-<id>), notamment depuis la recherche.
  useEffect(() => {
    if (!location.hash) return
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash])

  // Scroll-spy : surligne dans le sommaire l'endpoint actuellement visible.
  useEffect(() => {
    if (!section) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-10% 0px -75% 0px' }
    )
    for (const endpoint of section.endpoints) {
      const el = document.getElementById(`ep-${endpoint.id}`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [section])

  if (!section) return <Navigate to="/api-docs" replace />

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
          {t(section.titleKey)}
        </h1>
        {section.introKey && (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-400">
            {t(section.introKey)}
          </p>
        )}
        <div className="mt-4">
          {section.endpoints.map((endpoint) => (
            <div key={endpoint.id} id={`ep-${endpoint.id}`} className="scroll-mt-6">
              <EndpointSection endpoint={endpoint} />
            </div>
          ))}
        </div>
      </div>

      {/* Mini-sommaire des endpoints (grands écrans). */}
      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-2">
          <p className="eyebrow mb-2.5">{t('docs.onThisPage')}</p>
          <ul className="flex flex-col gap-1 border-l border-ink-200 dark:border-ink-800">
            {section.endpoints.map((endpoint) => (
              <li key={endpoint.id}>
                <Link
                  to={`#ep-${endpoint.id}`}
                  className={cn(
                    '-ml-px block break-all border-l py-0.5 pl-3 font-mono text-xs transition-colors',
                    activeId === `ep-${endpoint.id}`
                      ? 'border-brand-500 font-semibold text-brand-600 dark:text-brand-300'
                      : 'border-transparent text-ink-500 hover:border-brand-400 hover:text-brand-600 dark:text-ink-400 dark:hover:text-brand-300'
                  )}
                >
                  {endpoint.method} {endpoint.path}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
