// Carte d'une publication dans le feed Global : auteur, aperçu média, capacités, vote, partage.
// La zone de contenu navigue vers le détail ; le pied (vote / partage) reste indépendant du clic.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../contexts/I18nContext'
import { publicMediaUrl, votePublication } from '../../services/api'
import type { Publication, PublicVote } from '../../types'
import { TypeBadge } from '../history/TypeBadge'
import { VoteControl } from '../ui/VoteControl'
import { AuthorBadge } from './AuthorBadge'
import { ShareButton } from './ShareButton'

export function PublicationCard({ publication }: { publication: Publication }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [pub, setPub] = useState(publication)
  const p = pub.payload
  const isVideo = pub.type === 'video'

  async function handleVote(value: PublicVote): Promise<void> {
    const previous = pub
    // Optimiste : le score varie de (nouvelle valeur − valeur précédente).
    setPub({ ...pub, myVote: value, score: pub.score + (value - pub.myVote) })
    try {
      const result = await votePublication(pub.id, value)
      setPub((current) => ({
        ...current,
        score: result.score,
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        myVote: result.myVote,
      }))
    } catch {
      setPub(previous)
    }
  }

  const caps = [
    isVideo && t('history.cap.video'),
    (p.audioTranscript || (p.transcriptSegments?.length ?? 0) > 0) && t('history.cap.transcript'),
    p.music && p.music.length > 0 && t('history.cap.music'),
  ].filter(Boolean) as string[]

  return (
    <div className="surface overflow-hidden transition-shadow hover:shadow-card-hover">
      <button
        type="button"
        onClick={() => navigate(`/global/${pub.id}`)}
        className="block w-full p-4 text-left"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <AuthorBadge name={pub.author.name} avatar={pub.author.avatar} createdAt={pub.createdAt} />
          <TypeBadge type={pub.type} size="sm" />
        </div>

        {pub.caption && (
          <p className="mb-3 text-[15px] font-medium text-ink-900 dark:text-ink-50">{pub.caption}</p>
        )}

        {pub.hasThumbnail && (
          <div className="relative mb-3 overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
            <img
              src={publicMediaUrl(pub.slug)}
              alt=""
              loading="lazy"
              className="max-h-80 w-full object-cover"
            />
            {isVideo && (
              <span className="absolute inset-0 grid place-items-center bg-black/20">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-ink-900">
                  <svg className="h-6 w-6 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            )}
          </div>
        )}

        <p className="line-clamp-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {p.description}
        </p>

        {caps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {caps.map((c) => (
              <span
                key={c}
                className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Pied d'actions (hors zone navigable). */}
      <div className="flex items-center gap-3 border-t border-ink-100 px-4 py-2.5 dark:border-ink-800">
        <VoteControl score={pub.score} myVote={pub.myVote} onChange={handleVote} />
        <span
          className="inline-flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400"
          aria-label={t('global.comments')}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {pub.commentCount}
        </span>
        <ShareButton slug={pub.slug} className="ml-auto" />
      </div>
    </div>
  )
}
