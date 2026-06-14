// Page publique d'une publication (sans connexion), accessible via /p/:slug : média + analyse +
// commentaires en lecture seule, avec appel à se connecter pour interagir. Met à jour le titre
// et les balises OpenGraph côté client (le contenu publié est garanti tout public).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import logo from '../assets/dyper-logo.svg'
import { AuthorBadge } from '../components/global/AuthorBadge'
import { CommentSection } from '../components/global/CommentSection'
import { PublicationView } from '../components/global/PublicationView'
import { Skeleton } from '../components/ui/Skeleton'
import { useI18n } from '../contexts/I18nContext'
import { getPublicPublication, publicMediaUrl } from '../services/api'
import type { Publication, PublicationComment } from '../types'

// Met à jour une balise meta (créée si absente). Best-effort, pour l'aperçu de partage.
function setMeta(property: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('property', property)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

export function PublicPublicationPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useI18n()
  const [pub, setPub] = useState<Publication | null>(null)
  const [comments, setComments] = useState<PublicationComment[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')

  useEffect(() => {
    if (!slug) return
    let active = true
    getPublicPublication(slug)
      .then(({ publication, comments: list }) => {
        if (!active) return
        setPub(publication)
        setComments(list)
        setState('ok')
        // Aperçu de partage (titre + OpenGraph) — best-effort côté client.
        const title = publication.caption || publication.payload.description.slice(0, 70)
        document.title = `${title} · Dyper AI`
        setMeta('og:title', title)
        setMeta('og:description', publication.payload.description.slice(0, 160))
        if (publication.hasThumbnail) setMeta('og:image', publicMediaUrl(publication.slug))
      })
      .catch(() => active && setState('notfound'))
    return () => {
      active = false
    }
  }, [slug])

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-900">
      <header className="flex items-center justify-between border-b border-ink-200 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-bold tracking-tight text-ink-900 dark:text-ink-50">Dyper AI</span>
        </Link>
        <Link
          to="/"
          className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
        >
          {t('public.openApp')}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {state === 'loading' && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-96" />
          </div>
        )}

        {state === 'notfound' && (
          <div className="surface p-10 text-center">
            <h1 className="text-lg font-bold text-ink-900 dark:text-ink-50">
              {t('public.notfound.title')}
            </h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {t('public.notfound.desc')}
            </p>
          </div>
        )}

        {state === 'ok' && pub && (
          <div className="flex flex-col gap-6">
            <AuthorBadge name={pub.author.name} avatar={pub.author.avatar} createdAt={pub.createdAt} />
            <div className="surface p-6">
              <PublicationView publication={pub} />
            </div>
            <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="text-sm text-ink-500 dark:text-ink-400">{t('public.voteHint')}</span>
              <Link
                to="/login"
                className="rounded-xl border border-ink-200 px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                {t('public.signIn')}
              </Link>
            </div>
            <div className="surface p-6">
              <CommentSection comments={comments} readOnly />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
